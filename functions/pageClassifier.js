'use strict';

const {
  isAggregatorDomain,
  isOfficialProviderDomain,
  isSocialOrShareUrl,
  isSuspiciousDomain,
  detectSoft404,
  detectCaptchaOrBotWall,
  detectLoginWall,
  isProbablyScholarshipPage,
  cleanText
} = require('./scholarshipQuality');

const PAGE_TYPES = {
  OFFICIAL_SCHOLARSHIP_DETAIL: 'official_scholarship_detail',
  OFFICIAL_SCHOLARSHIP_INDEX: 'official_scholarship_index',
  OFFICIAL_APPLICATION_FORM: 'official_application_form',
  OFFICIAL_APPLICATION_PORTAL: 'official_application_portal',
  AGGREGATOR_DETAIL: 'aggregator_detail',
  GENERIC_HOMEPAGE: 'generic_homepage',
  GENERIC_ADMISSIONS_PAGE: 'generic_admissions_page',
  SEARCH_RESULTS_PAGE: 'search_results_page',
  SOCIAL_OR_SHARE: 'social_or_share',
  LOGIN_WALL: 'login_wall',
  CAPTCHA_OR_BOT_WALL: 'captcha_or_bot_wall',
  SOFT_404: 'soft_404',
  EXPIRED_OR_REMOVED: 'expired_or_removed',
  UNRELATED_PAGE: 'unrelated_page'
};

const HOMEPAGE_PATH_RE = /^\/?(index\.(html?|php|asp|aspx|jsp))?$/i;
const SEARCH_RESULTS_RE = /[?&](q|query|search|s|keyword|keywords|term|terms)=/i;
const SEARCH_PATH_RE = /\/(search|results|find|sok|s[oø]k|s[oø]kning|haku)(\/|$|\?)/i;
const ADMISSIONS_PATH_RE = /\/(admissions?|applications?|fees?-and-scholarships?|tuition|scholarships?|funding)(\/|$|\?)/i;
const APPLICATION_FORM_RE = /\/(application[-_]form|apply[-_]online|submit[-_]application|online[-_]application|ansokningsformular|ans[öo]kan)(\/|$|\?)/i;
const APPLICATION_PORTAL_RE = /\b(prisma|universityadmissions\.se|application\s+portal|application\s+system|e-application)\b/i;
const EXPIRED_TEXT_RE = /\b(applications?\s+(?:are\s+)?closed|deadline\s+(?:has\s+)?passed|no\s+longer\s+accepting|application\s+period\s+ended|closed\s+for\s+applications?|this\s+round\s+has\s+ended)\b/i;
const SCHOLARSHIP_PLURAL_RE = /\b(scholarships|stipendier|grants|fellowships|awards|funding opportunities)\b/i;

function extractEvidence(html, entry) {
  const pageText = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const titleWords = ((entry && entry.title) || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);

  let matchIdx = -1;
  for (const word of titleWords) {
    const idx = pageText.toLowerCase().indexOf(word);
    if (idx >= 0) { matchIdx = idx; break; }
  }

  if (matchIdx >= 0) {
    const start = Math.max(0, matchIdx - 50);
    return cleanText(pageText.slice(start, start + 250));
  }

  const schIdx = pageText.search(/\b(scholarship|stipend|grant|bursary|fellowship|award)\b/i);
  if (schIdx >= 0) return cleanText(pageText.slice(schIdx, schIdx + 200));

  return cleanText(pageText.slice(0, 200));
}

function isSpecificScholarshipPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  const last = segments[segments.length - 1] || '';
  return last.length > 5 && !/^scholarships?$|^grants?$|^awards?$|^funding$|^apply$|^admissions?$/i.test(last);
}

// URL-only classification (no HTML needed)
function classifyUrl(url) {
  if (!url) return PAGE_TYPES.UNRELATED_PAGE;
  if (isSocialOrShareUrl(url)) return PAGE_TYPES.SOCIAL_OR_SHARE;
  if (isSuspiciousDomain(url)) return PAGE_TYPES.UNRELATED_PAGE;

  let parsed;
  try { parsed = new URL(url); } catch { return PAGE_TYPES.UNRELATED_PAGE; }

  const pathname = parsed.pathname || '/';
  const search = parsed.search || '';

  if (HOMEPAGE_PATH_RE.test(pathname) && !search) return PAGE_TYPES.GENERIC_HOMEPAGE;
  if (SEARCH_RESULTS_RE.test(search) || SEARCH_PATH_RE.test(pathname)) return PAGE_TYPES.SEARCH_RESULTS_PAGE;
  if (APPLICATION_FORM_RE.test(pathname)) return PAGE_TYPES.OFFICIAL_APPLICATION_FORM;
  if (isAggregatorDomain(url)) return PAGE_TYPES.AGGREGATOR_DETAIL;

  return null; // needs HTML for definitive classification
}

// Full classification with optional HTML
function classifyPage(url, html, entry) {
  html = html || '';
  entry = entry || {};

  if (!url) return { type: PAGE_TYPES.UNRELATED_PAGE, evidence: 'no URL' };
  if (isSocialOrShareUrl(url)) return { type: PAGE_TYPES.SOCIAL_OR_SHARE, evidence: 'social/share URL pattern' };
  if (isSuspiciousDomain(url)) return { type: PAGE_TYPES.UNRELATED_PAGE, evidence: 'suspicious domain' };

  let parsed;
  try { parsed = new URL(url); } catch { return { type: PAGE_TYPES.UNRELATED_PAGE, evidence: 'invalid URL' }; }

  const pathname = parsed.pathname || '/';
  const search = parsed.search || '';

  // Wall/error types — require HTML
  if (html) {
    if (detectCaptchaOrBotWall(html)) return { type: PAGE_TYPES.CAPTCHA_OR_BOT_WALL, evidence: 'CAPTCHA/bot text detected' };
    if (detectLoginWall(url, html)) return { type: PAGE_TYPES.LOGIN_WALL, evidence: 'login form detected' };
    if (detectSoft404(html, url)) return { type: PAGE_TYPES.SOFT_404, evidence: '404/not-found content' };
  }

  const pageText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  if (pageText && EXPIRED_TEXT_RE.test(pageText)) {
    return { type: PAGE_TYPES.EXPIRED_OR_REMOVED, evidence: extractEvidence(html, entry) };
  }

  // URL-deterministic types
  if (HOMEPAGE_PATH_RE.test(pathname) && !search) return { type: PAGE_TYPES.GENERIC_HOMEPAGE, evidence: 'root path' };
  if (SEARCH_RESULTS_RE.test(search) || SEARCH_PATH_RE.test(pathname)) return { type: PAGE_TYPES.SEARCH_RESULTS_PAGE, evidence: 'search query or path' };
  if (APPLICATION_FORM_RE.test(pathname)) return { type: PAGE_TYPES.OFFICIAL_APPLICATION_FORM, evidence: 'application form URL path' };
  if (isAggregatorDomain(url)) return { type: PAGE_TYPES.AGGREGATOR_DETAIL, evidence: 'known aggregator domain' };

  if (!html) {
    // URL hints only
    if (ADMISSIONS_PATH_RE.test(pathname) && !isSpecificScholarshipPath(pathname)) {
      return { type: PAGE_TYPES.GENERIC_ADMISSIONS_PAGE, evidence: 'generic admissions/scholarships path' };
    }
    if (isOfficialProviderDomain(url)) return { type: PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL, evidence: 'official domain (no HTML)' };
    return { type: PAGE_TYPES.UNRELATED_PAGE, evidence: 'no HTML to classify' };
  }

  // HTML-based checks
  if (APPLICATION_PORTAL_RE.test(pageText)) {
    return { type: PAGE_TYPES.OFFICIAL_APPLICATION_PORTAL, evidence: extractEvidence(html, entry) };
  }

  // Scholarship index: many scholarship references + list structure on official domain
  const scholarshipPluralCount = (pageText.match(new RegExp(SCHOLARSHIP_PLURAL_RE.source, 'gi')) || []).length;
  if (scholarshipPluralCount >= 4 && isOfficialProviderDomain(url)) {
    return { type: PAGE_TYPES.OFFICIAL_SCHOLARSHIP_INDEX, evidence: `${scholarshipPluralCount} plural scholarship references` };
  }

  // Generic admissions page: admissions path but no specific scholarship content
  if (ADMISSIONS_PATH_RE.test(pathname) && !isSpecificScholarshipPath(pathname)) {
    const hasSpecific = isProbablyScholarshipPage(entry, html, pageText);
    if (!hasSpecific) {
      return { type: PAGE_TYPES.GENERIC_ADMISSIONS_PAGE, evidence: 'admissions/scholarships path, no specific scholarship detected' };
    }
  }

  // Official scholarship detail
  if (isOfficialProviderDomain(url) && isProbablyScholarshipPage(entry, html, pageText)) {
    return { type: PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL, evidence: extractEvidence(html, entry) };
  }

  // Aggregator detail (non-official but has scholarship content)
  if (isProbablyScholarshipPage(entry, html, pageText)) {
    return { type: PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL, evidence: extractEvidence(html, entry) };
  }

  return { type: PAGE_TYPES.UNRELATED_PAGE, evidence: 'no scholarship content detected' };
}

function isAcceptableSourcePageType(pageType) {
  return [
    PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL,
    PAGE_TYPES.OFFICIAL_SCHOLARSHIP_INDEX,
    PAGE_TYPES.AGGREGATOR_DETAIL
  ].includes(pageType);
}

function isAcceptableApplicationPageType(pageType) {
  return [
    PAGE_TYPES.OFFICIAL_APPLICATION_FORM,
    PAGE_TYPES.OFFICIAL_APPLICATION_PORTAL,
    PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL
  ].includes(pageType);
}

module.exports = {
  PAGE_TYPES,
  classifyUrl,
  classifyPage,
  extractEvidence,
  isAcceptableSourcePageType,
  isAcceptableApplicationPageType
};
