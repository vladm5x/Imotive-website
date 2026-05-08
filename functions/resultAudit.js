'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const {
  isAggregatorDomain,
  isOfficialProviderDomain,
  isSocialOrShareUrl,
  isSuspiciousDomain,
  hasUsableApplicationPath,
  isExpiredEntry,
  isStatusOk,
  cleanText
} = require('./scholarshipQuality');

const {
  PAGE_TYPES,
  classifyPage,
  extractEvidence,
  isAcceptableSourcePageType,
  isAcceptableApplicationPageType
} = require('./pageClassifier');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

// Module-level cache — shared across all auditEntryWithFetch calls in the same process.
// Prevents refetching the same URL multiple times during a single audit run.
const _urlCache = new Map();

async function fetchPageTextCached(url, { timeout = 12000 } = {}) {
  if (!url) return { html: '', ok: false, status: null };
  const key = url.toLowerCase().replace(/\/$/, '');
  if (_urlCache.has(key)) return _urlCache.get(key);

  try {
    const res = await axios.get(url, {
      timeout,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: () => true,
      headers: FETCH_HEADERS
    });
    const result = {
      html: String(res.data || '').slice(0, 15000),
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      finalUrl: res.request?.res?.responseUrl || url
    };
    _urlCache.set(key, result);
    return result;
  } catch (err) {
    const result = { html: '', ok: false, status: null, error: err.message };
    _urlCache.set(key, result);
    return result;
  }
}

function clearCache() {
  _urlCache.clear();
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function isHomepageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /^\/?(index\.(html?|php|asp|aspx|jsp))?$/i.test(parsed.pathname) && !parsed.search;
  } catch { return false; }
}

function isSearchResultsUrl(url) {
  if (!url) return false;
  return /[?&](q|query|search|s|keyword|keywords|term|terms)=/i.test(url)
    || /\/(search|results|find|sok|s[oø]k|s[oø]kning|haku)(\/|$|\?)/i.test(url);
}

function isAdmissionsPageUrl(url) {
  if (!url) return false;
  try {
    const { pathname } = new URL(url);
    return /\/(admissions?|applications?|fees?-and-scholarships?|tuition|scholarships?|funding)(\/|$|\?)/i.test(pathname);
  } catch { return false; }
}

function isApplicationFormUrl(url) {
  return /\/(application[-_]form|apply[-_]online|submit[-_]application|online[-_]application|ansokningsformular|ans[öo]kan)(\/|$|\?)/i.test(url || '');
}

function isSpecificScholarshipUrl(url) {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    return last.length > 5 && !/^scholarships?$|^grants?$|^awards?$|^funding$|^apply$|^admissions?$/i.test(last);
  } catch { return false; }
}

// ─── Static audit (no HTTP fetching) ─────────────────────────────────────────

function auditEntryStatic(entry) {
  const sourceUrl = entry.final_url || entry.source_url || entry.url;
  const appUrl = entry.application_final_url || entry.application_url || entry.applicationUrl;
  const title = cleanText(entry.title || entry.scholarship_name);
  const source = cleanText(entry.source);

  const issues = [];
  let auditStatus = 'pass';
  let suggestedFix = '';

  // Source URL checks
  if (!sourceUrl) {
    issues.push('missing source URL');
    auditStatus = 'reject';
    suggestedFix = 'add source URL';
  } else if (isSocialOrShareUrl(sourceUrl)) {
    issues.push('source URL is social/share');
    auditStatus = 'reject';
    suggestedFix = 'find official provider URL';
  } else if (isSuspiciousDomain(sourceUrl)) {
    issues.push('source URL on suspicious domain');
    auditStatus = 'reject';
    suggestedFix = 'discard — suspicious domain';
  } else if (isHomepageUrl(sourceUrl)) {
    issues.push('source URL is generic homepage');
    if (auditStatus === 'pass') auditStatus = 'manual_review';
    suggestedFix = suggestedFix || 'find scholarship-specific page on this domain';
  } else if (isSearchResultsUrl(sourceUrl)) {
    issues.push('source URL is search results page');
    if (auditStatus === 'pass') auditStatus = 'manual_review';
    suggestedFix = suggestedFix || 'find direct scholarship page URL';
  } else if (isAdmissionsPageUrl(sourceUrl) && !isSpecificScholarshipUrl(sourceUrl)) {
    issues.push('source URL is generic admissions page');
    if (auditStatus === 'pass') auditStatus = 'manual_review';
    suggestedFix = suggestedFix || 'find specific scholarship detail page';
  }

  // Application URL checks
  if (!appUrl && !hasUsableApplicationPath(entry)) {
    issues.push('no application URL or instructions');
    if (auditStatus === 'pass') auditStatus = 'manual_review';
    suggestedFix = suggestedFix || 'find application form or add clear instructions';
  } else if (appUrl) {
    if (isSocialOrShareUrl(appUrl)) {
      issues.push('application URL is social/share');
      auditStatus = 'reject'; // social/share app URL always rejects
      suggestedFix = suggestedFix || 'find real application form URL';
    } else if (isHomepageUrl(appUrl)) {
      issues.push('application URL is generic homepage');
      if (auditStatus === 'pass') auditStatus = 'manual_review';
      suggestedFix = suggestedFix || 'find specific application form URL';
    } else if (isSearchResultsUrl(appUrl)) {
      issues.push('application URL is search results page');
      if (auditStatus === 'pass') auditStatus = 'manual_review';
      suggestedFix = suggestedFix || 'find direct application form URL';
    }
  }

  // Aggregator provenance check
  if (sourceUrl && isAggregatorDomain(sourceUrl) && !(appUrl && isOfficialProviderDomain(appUrl))) {
    issues.push('source is aggregator, no official application URL');
    if (auditStatus === 'pass') auditStatus = 'manual_review';
    suggestedFix = suggestedFix || 'replace with official provider URL or find official application link';
  }

  // Expiry
  if (isExpiredEntry(entry)) {
    issues.push('expired deadline');
    auditStatus = 'reject';
    suggestedFix = suggestedFix || 'remove or archive';
  }

  // Source URL HTTP status
  const srcStatus = entry.source_url_status || entry.sourceUrlStatus;
  if (srcStatus && !isStatusOk(srcStatus) && !/instructions_only|missing_url/.test(srcStatus)) {
    issues.push(`source URL status: ${srcStatus}`);
    if (auditStatus === 'pass') auditStatus = 'manual_review';
  }

  // Derive static page types without fetching
  const sourcePageType = sourceUrl
    ? (isSocialOrShareUrl(sourceUrl) ? PAGE_TYPES.SOCIAL_OR_SHARE
      : isHomepageUrl(sourceUrl) ? PAGE_TYPES.GENERIC_HOMEPAGE
      : isSearchResultsUrl(sourceUrl) ? PAGE_TYPES.SEARCH_RESULTS_PAGE
      : isAggregatorDomain(sourceUrl) ? PAGE_TYPES.AGGREGATOR_DETAIL
      : isAdmissionsPageUrl(sourceUrl) && !isSpecificScholarshipUrl(sourceUrl) ? PAGE_TYPES.GENERIC_ADMISSIONS_PAGE
      : isApplicationFormUrl(sourceUrl) ? PAGE_TYPES.OFFICIAL_APPLICATION_FORM
      : PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL)
    : null;

  const applicationPageType = appUrl
    ? (isSocialOrShareUrl(appUrl) ? PAGE_TYPES.SOCIAL_OR_SHARE
      : isHomepageUrl(appUrl) ? PAGE_TYPES.GENERIC_HOMEPAGE
      : isSearchResultsUrl(appUrl) ? PAGE_TYPES.SEARCH_RESULTS_PAGE
      : isApplicationFormUrl(appUrl) ? PAGE_TYPES.OFFICIAL_APPLICATION_FORM
      : PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL)
    : null;

  return {
    id: entry.id || '',
    title,
    source,
    source_url: sourceUrl || '',
    application_url: appUrl || '',
    source_page_type: sourcePageType,
    application_page_type: applicationPageType,
    source_evidence_snippet: '',
    application_evidence_snippet: '',
    audit_status: auditStatus,
    audit_reason: issues.join('; ') || 'passes static checks',
    suggested_fix: suggestedFix || (auditStatus !== 'pass' ? 'manual review' : '')
  };
}

// ─── Full audit with optional HTTP fetching ───────────────────────────────────

async function auditEntryWithFetch(entry, { fetchPages = false } = {}) {
  const result = auditEntryStatic(entry);
  if (!fetchPages || result.audit_status === 'reject') return result;

  const sourceUrl = entry.final_url || entry.source_url || entry.url;
  const appUrl = entry.application_final_url || entry.application_url || entry.applicationUrl;

  if (sourceUrl) {
    const { html, ok } = await fetchPageTextCached(sourceUrl);
    if (html) {
      const { type, evidence } = classifyPage(sourceUrl, html, entry);
      result.source_page_type = type;
      result.source_evidence_snippet = evidence || extractEvidence(html, entry);
      if (!isAcceptableSourcePageType(type)) {
        if (result.audit_status === 'pass') result.audit_status = 'manual_review';
        result.audit_reason += `; source page classified as: ${type}`;
        result.suggested_fix = result.suggested_fix || 'find specific scholarship detail page';
      }
    } else if (!ok) {
      if (result.audit_status === 'pass') result.audit_status = 'manual_review';
      result.audit_reason += '; source URL unreachable during audit';
    }
  }

  if (appUrl && result.audit_status !== 'reject') {
    const { html } = await fetchPageTextCached(appUrl);
    if (html) {
      const { type, evidence } = classifyPage(appUrl, html, entry);
      result.application_page_type = type;
      result.application_evidence_snippet = evidence || '';
      if (!isAcceptableApplicationPageType(type)) {
        if (result.audit_status === 'pass') result.audit_status = 'manual_review';
        result.audit_reason += `; application page classified as: ${type}`;
        result.suggested_fix = result.suggested_fix || 'find real application form or portal URL';
      }
    }
  }

  return result;
}

// ─── Batch audit ──────────────────────────────────────────────────────────────

async function auditResults(entries, { fetchPages = false, concurrency = 4, onProgress = null } = {}) {
  const results = [];
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(entry => auditEntryWithFetch(entry, { fetchPages }))
    );
    results.push(...batchResults);
    if (onProgress) onProgress(Math.min(i + concurrency, entries.length), entries.length);
  }
  return results;
}

// ─── Summary + export ─────────────────────────────────────────────────────────

function summarizeAudit(results) {
  const pass = results.filter(r => r.audit_status === 'pass').length;
  const manual = results.filter(r => r.audit_status === 'manual_review').length;
  const reject = results.filter(r => r.audit_status === 'reject').length;

  const byType = {};
  for (const r of results) {
    const t = r.source_page_type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }

  const topIssues = {};
  for (const r of results) {
    if (r.audit_reason && r.audit_reason !== 'passes static checks') {
      for (const issue of r.audit_reason.split(';').map(s => s.trim()).filter(Boolean)) {
        topIssues[issue] = (topIssues[issue] || 0) + 1;
      }
    }
  }

  return {
    total: results.length,
    pass,
    manual_review: manual,
    reject,
    pass_rate: results.length ? pass / results.length : 0,
    source_page_types: byType,
    top_issues: Object.entries(topIssues).sort((a, b) => b[1] - a[1]).slice(0, 10)
  };
}

function writeAuditResults(results, { csvPath, jsonPath } = {}) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  }

  if (csvPath) {
    const cols = [
      'id', 'title', 'source', 'source_url', 'application_url',
      'source_page_type', 'application_page_type',
      'source_evidence_snippet', 'application_evidence_snippet',
      'audit_status', 'audit_reason', 'suggested_fix'
    ];
    const csvEsc = v => {
      const s = String(v || '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [cols.join(','), ...results.map(r => cols.map(c => csvEsc(r[c])).join(','))];
    fs.writeFileSync(csvPath, lines.join('\n'));
  }
}

module.exports = {
  auditEntryStatic,
  auditEntryWithFetch,
  auditResults,
  summarizeAudit,
  writeAuditResults,
  fetchPageTextCached,
  clearCache,
  isHomepageUrl,
  isSearchResultsUrl,
  isAdmissionsPageUrl,
  isApplicationFormUrl,
  isSpecificScholarshipUrl
};
