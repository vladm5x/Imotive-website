'use strict';

const CURRENT_YEAR = new Date().getFullYear();

const REVIEW_STATUSES = new Set([
  'approved',
  'needs_review',
  'rejected',
  'archived',
  'duplicate',
  'expired',
  'broken_link',
  'low_trust',
  'no_application_path',
  'needs_review_stale',
  'archived_candidate'
]);

const ADMIN_REVIEW_STATUSES = new Set(['approved', 'rejected', 'archived']);

const GENERIC_PLACEHOLDERS = new Set([
  '',
  'Unknown',
  'See scholarship page',
  'See scholarship page for eligibility.',
  'See scholarship page for required documents.',
  'See the scholarship page for application instructions.',
  'Apply via the scholarship provider.',
  'Apply through the institution directly.',
  'See the scholarship page.',
  'See scholarship page for application instructions.'
]);

const SCHOLARSHIP_TERMS = /\b(scholarships?|stipends?|stipendier|stipendium|grants?|anslag|bidrag|bursar(y|ies)|awards?|fellowships?|studentships?|tuition waivers?|fee waivers?|funded positions?|research funding|travel grants?|mobility grants?|doctoral funding|phd funding)\b/i;
const APPLICATION_TERMS = /\b(apply|application|application form|submit application|start application|how to apply|ansok|ansok har|ansokan|ansokningsformular|ansök|ansök här|ansökan|ansökningsformulär|nominate|nomination|register|portal|prisma|universityadmissions\.se|e-application|send your application|email your application)\b/i;
const RECURRING_TERMS = /\b(annual|annually|yearly|every year|each year|opens each year|next application round|application period|usually opens|recurring|rolling|löpande|arligen|årligen|varje år|ansökningsperiod)\b/i;
const GENERIC_TITLE_PATTERNS = [
  /page not found/i,
  /access denied/i,
  /cookie/i,
  /privacy/i,
  /^scholarships?$/i,
  /^funding opportunities?$/i,
  /^grants?$/i,
  /^students?$/i,
  /^apply$/i,
  /^read more$/i,
  /^learn more$/i,
  /^search/i,
  /^browse/i,
  /^list of/i,
  /^(top|best) \d+/i,
  /scholarship (guide|tips|advice|essay|interview)/i,
  /^how to /i,
  /^what is /i
];

const BLOG_ONLY_PATTERNS = /\b(blog|news|press release|article|guide|tips|essay writing|interview tips|seo)\b/i;
const NEGATIVE_PAGE_PATTERNS = /\b(page not found|404 not found|access denied|forbidden|coming soon|search results|no results found|privacy policy|cookie policy|terms of use)\b/i;
const SOCIAL_OR_SHARE_DOMAINS = /\b(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|pinterest\.com|reddit\.com|t\.co|bit\.ly|addtoany|sharethis|sharer)\b/i;
const SUSPICIOUS_DOMAINS = /\b(coupon|casino|betting|loan|payday|essaywriter|write-my|telegram|whatsapp|bit\.ly|tinyurl|goo\.gl)\b/i;
const AGGREGATOR_DOMAINS = /\b(scholarship-positions\.com|afterschoolafrica\.com|opportunitydesk\.org|scholarshipportal\.com|mastersportal\.eu|phdportal\.eu|findamasters\.com|findaphd\.com|academicpositions\.com|scholarshipdb\.net|inomics\.com|bidragsguiden\.se|stipendier\.se)\b/i;
const OFFICIAL_DOMAIN_HINTS = /\b(\.edu|\.ac\.|\.gov|\.gouv|\.gc\.ca|\.europa\.eu|\.eu\.int|\.org|\.se|\.dk|\.no|\.fi|\.is|university|universitet|college|research|council|foundation|stiftelse|kommun|region)\b/i;

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

function uniqueList(values, limit = 20) {
  return [...new Set((values || []).map(cleanText).filter(Boolean))].slice(0, limit);
}

function canonicalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const removable = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'source'
    ];
    removable.forEach(param => parsed.searchParams.delete(param));
    parsed.searchParams.sort();
    let rendered = parsed.href.replace(/\/$/, '');
    rendered = rendered.replace(/\/\?/, '?');
    return rendered;
  } catch {
    return '';
  }
}

function normalizeTitleForDedup(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9åäöéü\s]/gi, ' ')
    .replace(/\b(the|a|an|scholarship|grant|stipend|award|fellowship|programme|program)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(a, b) {
  const left = new Set(normalizeTitleForDedup(a).split(/\s+/).filter(Boolean));
  const right = new Set(normalizeTitleForDedup(b).split(/\s+/).filter(Boolean));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap++;
  return overlap / Math.max(left.size, right.size);
}

function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isSocialOrShareUrl(url) {
  return SOCIAL_OR_SHARE_DOMAINS.test(String(url || ''));
}

function isSuspiciousDomain(url) {
  return SUSPICIOUS_DOMAINS.test(domainOf(url));
}

function isAggregatorDomain(url) {
  return AGGREGATOR_DOMAINS.test(domainOf(url));
}

function isOfficialProviderDomain(url) {
  const domain = domainOf(url);
  if (!domain || isAggregatorDomain(url) || isSuspiciousDomain(url) || isSocialOrShareUrl(url)) return false;
  return OFFICIAL_DOMAIN_HINTS.test(domain);
}

function detectSoft404(html, url = '') {
  const text = cleanText(html).toLowerCase();
  if (!text) return true;
  if (text.length < 250 && /not found|404|gone|removed|does not exist|no longer available/i.test(text)) return true;
  if (/page not found|404 not found|we can'?t find|could not be found|not exist|no longer available/i.test(text)) return true;
  if (/\/404\b|not-found/i.test(String(url || ''))) return true;
  return false;
}

function detectCaptchaOrBotWall(html) {
  const text = String(html || '').toLowerCase();
  return /captcha|recaptcha|cf-challenge|cloudflare|verify you are human|are you a robot|bot detection|access to this page has been denied/.test(text);
}

function detectLoginWall(url, html) {
  const t = String(html || '').toLowerCase();
  const host = domainOf(url);
  if (/\b(login|auth|account|portal|member|my\.)/.test(host) && /password|sign in|log in|authenticate/.test(t)) return true;
  const hasPasswordInput = /type=["']password["']/.test(t);
  const hasScholarshipText = SCHOLARSHIP_TERMS.test(t);
  return hasPasswordInput && /sign in|log in|login|authenticate/.test(t) && !hasScholarshipText;
}

function isProbablyScholarshipPage(entry = {}, html = '', text = '') {
  const combined = cleanText([
    entry.title,
    entry.scholarship_name,
    entry.provider_name,
    entry.eligibility,
    entry.requirements,
    entry.instructions,
    entry.application_instructions,
    entry.fullText,
    text,
    html ? cheerlessText(html).slice(0, 5000) : ''
  ].filter(Boolean).join(' '));
  if (!combined) return false;
  if (NEGATIVE_PAGE_PATTERNS.test(combined)) return false;
  const positiveMatches = (combined.match(new RegExp(SCHOLARSHIP_TERMS.source, 'gi')) || []).length;
  if (positiveMatches >= 2) return true;
  if (positiveMatches === 1 && APPLICATION_TERMS.test(combined)) return true;
  if (positiveMatches === 1 && /\b(eligible|eligibility|deadline|tuition|amount|value|students?|doctoral|master|bachelor)\b/i.test(combined)) return true;
  return false;
}

function cheerlessText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function isSpecificTitle(title) {
  const clean = cleanText(title);
  if (clean.length < 10) return false;
  if (GENERIC_TITLE_PATTERNS.some(pattern => pattern.test(clean))) return false;
  return /\b(scholarship|grant|stipend|stipendium|stipendier|award|bursary|fellowship|studentship|funding|tuition|waiver|phd|doctoral|master|research|travel|mobility)\b/i.test(clean)
    || clean.split(/\s+/).length >= 4;
}

function isRecurringDeadline(entry = {}) {
  return entry.is_recurring === true || entry.isRecurring === true || entry.deadline_type === 'recurring' || RECURRING_TERMS.test(entry.fullText || entry.instructions || entry.deadline || '');
}

function isExpiredEntry(entry = {}, now = new Date()) {
  if (entry.expired === true) return true;
  if (isRecurringDeadline(entry)) return false;
  const deadline = cleanText(entry.deadline);
  if (!deadline || deadline === 'Unknown') return false;
  const date = new Date(`${deadline}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date < now;
}

function isStatusOk(status) {
  if (status === true) return true;
  const value = cleanText(status).toLowerCase();
  if (!value) return false;
  if (/^(ok|verified|success)/.test(value)) return true;
  const code = value.match(/\b(\d{3})\b/);
  return !!code && Number(code[1]) >= 200 && Number(code[1]) < 400;
}

function isStatusBroken(status) {
  const value = cleanText(status).toLowerCase();
  if (!value) return false;
  if (/broken|timeout|redirect_loop|ssl|dns|soft_404|login_wall|captcha|blocked|suspicious/.test(value)) return true;
  const code = value.match(/\b(\d{3})\b/);
  return !!code && Number(code[1]) >= 400;
}

function hasClearApplicationInstructions(entry = {}) {
  const text = cleanText(`${entry.instructions || ''} ${entry.application_instructions || ''} ${entry.eligibility || ''}`);
  if (GENERIC_PLACEHOLDERS.has(text)) return false;
  if (text.length < 45) return false;
  return APPLICATION_TERMS.test(text) && /\b(deadline|submit|form|portal|email|documents?|cv|transcript|motivation|statement|nomination|prisma|universityadmissions)\b/i.test(text);
}

function hasUsableApplicationPath(entry = {}) {
  const applicationUrl = entry.applicationUrl || entry.application_url;
  if (applicationUrl && !isSocialOrShareUrl(applicationUrl) && !isSuspiciousDomain(applicationUrl) && isStatusOk(entry.application_url_status || entry.applicationUrlStatus)) {
    return true;
  }
  return hasClearApplicationInstructions(entry);
}

function providerTypeFromEntry(entry = {}) {
  if (entry.provider_type) return entry.provider_type;
  const text = cleanText(`${entry.provider_name || ''} ${entry.source || ''} ${domainOf(entry.final_url || entry.url || entry.source_url)}`).toLowerCase();
  if (/university|universitet|college|institute of technology|school of economics|\.edu|\.ac\./.test(text)) return 'university';
  if (/government|council|agency|europa|\.gov|uhr|swedish institute|formas|forte|vinnova|nordforsk/.test(text)) return 'government';
  if (/municipality|kommun|region/.test(text)) return 'municipality';
  if (/foundation|stiftelse|fund|trust|wallenberg|fulbright|stint/.test(text)) return 'foundation';
  if (/student union|studentkår/.test(text)) return 'student_union';
  if (/ngo|non-profit|association/.test(text)) return 'NGO';
  if (isAggregatorDomain(entry.final_url || entry.url || entry.source_url)) return 'aggregator';
  if (/company|inc|ltd|ab\b/.test(text)) return 'company';
  return 'other';
}

function calculateTrustScore(entry = {}) {
  let score = 0;
  const flags = new Set(entry.qualityFlags || entry.quality_flags || []);
  const text = cleanText(`${entry.title || ''} ${entry.eligibility || ''} ${entry.instructions || ''} ${entry.fullText || ''}`);
  const sourceUrl = entry.final_url || entry.source_url || entry.url;
  const applicationUrl = entry.application_final_url || entry.application_url || entry.applicationUrl;

  if (isOfficialProviderDomain(sourceUrl)) score += 25;
  if (isProbablyScholarshipPage(entry, '', text)) score += 20;
  if (applicationUrl && isStatusOk(entry.application_url_status || entry.applicationUrlStatus)) score += 15;
  if (hasClearApplicationInstructions(entry)) score += 12;
  if (entry.eligibility && !GENERIC_PLACEHOLDERS.has(cleanText(entry.eligibility)) && cleanText(entry.eligibility).length >= 45) score += 10;
  if ((entry.deadline && entry.deadline !== 'Unknown') || isRecurringDeadline(entry)) score += 10;
  if (entry.contact_email || entry.provider_name || entry.source) score += 8;
  if (entry.amount && !GENERIC_PLACEHOLDERS.has(cleanText(entry.amount))) score += 5;
  if (isStatusOk(entry.source_url_status || entry.sourceUrlStatus) && !entry.requiresLogin && !entry.blocked) score += 5;

  if (isAggregatorDomain(sourceUrl) && !isOfficialProviderDomain(applicationUrl)) score -= 15;
  if (flags.has('weak_content')) score -= 20;
  if (flags.has('generic_title')) score -= 25;
  if (BLOG_ONLY_PATTERNS.test(text) && !hasUsableApplicationPath(entry)) score -= 30;
  if (!hasUsableApplicationPath(entry)) score -= 35;
  if (isStatusBroken(entry.application_url_status || entry.applicationUrlStatus)) score -= 40;
  if (isStatusBroken(entry.source_url_status || entry.sourceUrlStatus)) score -= 40;
  if (isExpiredEntry(entry)) score -= 50;
  if (entry.requiresLogin || entry.requires_login) score -= 50;
  if (isSuspiciousDomain(sourceUrl) || isSuspiciousDomain(applicationUrl)) score -= 60;
  if (!isProbablyScholarshipPage(entry, '', text)) score -= 70;

  return Math.max(0, Math.min(100, score));
}

function assessScholarshipQuality(entry = {}) {
  const flags = new Set();
  if (entry.duplicateOf || entry.duplicate_of) flags.add('duplicate');
  let score = 100;
  const title = cleanText(entry.title || entry.scholarship_name);
  const sourceUrl = entry.final_url || entry.source_url || entry.url;
  const applicationUrl = entry.application_final_url || entry.application_url || entry.applicationUrl;
  const text = cleanText(`${title} ${entry.eligibility || ''} ${entry.requirements || ''} ${entry.instructions || ''} ${entry.application_instructions || ''} ${entry.fullText || ''}`);

  if (isStatusOk(entry.source_url_status || entry.sourceUrlStatus)) flags.add('source_verified');
  if (isStatusOk(entry.application_url_status || entry.applicationUrlStatus)) flags.add('application_url_verified');
  if (isOfficialProviderDomain(sourceUrl)) flags.add('official_provider');
  if (isAggregatorDomain(sourceUrl)) flags.add('aggregator_source');
  if (!entry.deadline || entry.deadline === 'Unknown') flags.add('missing_deadline');
  if (isRecurringDeadline(entry)) flags.add('recurring_deadline');
  if (!entry.amount || GENERIC_PLACEHOLDERS.has(cleanText(entry.amount))) flags.add('missing_amount');
  if (!entry.eligibility || GENERIC_PLACEHOLDERS.has(cleanText(entry.eligibility)) || cleanText(entry.eligibility).length < 45) flags.add('missing_eligibility');
  if (!entry.documents || GENERIC_PLACEHOLDERS.has(cleanText(entry.documents))) flags.add('missing_documents');
  if (!applicationUrl) flags.add('missing_application_url');
  if (hasClearApplicationInstructions(entry)) flags.add('has_application_instructions');
  if (!hasUsableApplicationPath(entry)) flags.add('no_application_path');
  if (isExpiredEntry(entry)) flags.add('expired');
  if (entry.duplicateOf || entry.duplicate_of) flags.add('duplicate');
  if (isStatusBroken(entry.source_url_status || entry.sourceUrlStatus)) flags.add('broken_source_url');
  if (isStatusBroken(entry.application_url_status || entry.applicationUrlStatus)) flags.add('broken_application_url');
  if (entry.requiresLogin || entry.requires_login) flags.add('login_wall');
  if (entry.captcha || entry.captcha_or_bot_wall) flags.add('captcha_or_bot_wall');
  if (!isSpecificTitle(title)) flags.add('generic_title');
  if (!isProbablyScholarshipPage(entry, '', text)) flags.add('weak_content');
  if (isSuspiciousDomain(sourceUrl) || isSuspiciousDomain(applicationUrl)) flags.add('suspicious_domain');
  if (/\.pdf($|\?)/i.test(sourceUrl)) {
    flags.add('pdf_source');
    flags.add('needs_manual_pdf_review');
  }

  const penalties = {
    missing_deadline: 8,
    missing_amount: 3,
    missing_eligibility: 12,
    missing_documents: 2,
    missing_application_url: 12,
    no_application_path: 35,
    expired: 60,
    duplicate: 80,
    broken_source_url: 60,
    broken_application_url: 45,
    login_wall: 70,
    captcha_or_bot_wall: 55,
    generic_title: 35,
    weak_content: 70,
    suspicious_domain: 70,
    aggregator_source: isOfficialProviderDomain(applicationUrl) ? 5 : 18,
    needs_manual_pdf_review: 15
  };

  for (const flag of flags) score -= penalties[flag] || 0;
  score = Math.max(0, Math.min(100, score));

  const trustScore = entry.trustScore ?? entry.trust_score ?? calculateTrustScore({ ...entry, qualityFlags: [...flags] });
  let reviewStatus = determineReviewStatus({ ...entry, qualityScore: score, trustScore, qualityFlags: [...flags] });
  if (ADMIN_REVIEW_STATUSES.has(entry.reviewStatus || entry.review_status)) reviewStatus = entry.reviewStatus || entry.review_status;

  if (reviewStatus === 'approved') flags.add('approved_candidate');
  if (['rejected', 'low_trust', 'broken_link', 'expired', 'no_application_path'].includes(reviewStatus)) flags.add('reject_candidate');

  return { score, trustScore, flags: [...flags], reviewStatus };
}

function determineReviewStatus(entry = {}) {
  const flags = new Set(entry.qualityFlags || entry.quality_flags || []);
  if (entry.duplicateOf || entry.duplicate_of || flags.has('duplicate')) return 'duplicate';
  if (isExpiredEntry(entry) || flags.has('expired')) return 'expired';
  if (flags.has('broken_source_url')) return 'broken_link';
  if (flags.has('login_wall') || flags.has('captcha_or_bot_wall') || flags.has('suspicious_domain') || flags.has('weak_content')) return 'rejected';
  if (!hasUsableApplicationPath(entry)) return 'no_application_path';
  const qualityScore = entry.qualityScore ?? entry.quality_score ?? 0;
  const trustScore = entry.trustScore ?? entry.trust_score ?? 0;
  if (qualityScore >= 85 && trustScore >= 85 && isPublishableScholarship({ ...entry, reviewStatus: 'approved' }, { allowStatus: true })) return 'approved';
  if (trustScore < 50 || qualityScore < 50) return 'low_trust';
  return 'needs_review';
}

function isPublishableScholarship(entry = {}, options = {}) {
  const status = entry.reviewStatus || entry.review_status;
  if (!options.allowStatus && status !== 'approved') return false;
  if ((entry.qualityScore ?? entry.quality_score ?? 0) < 85) return false;
  if ((entry.trustScore ?? entry.trust_score ?? 0) < 85) return false;
  if (!isStatusOk(entry.source_url_status || entry.sourceUrlStatus)) return false;
  if (isExpiredEntry(entry)) return false;
  if (entry.duplicateOf || entry.duplicate_of) return false;
  if (entry.blocked || entry.requiresLogin || entry.requires_login) return false;
  if (isSuspiciousDomain(entry.final_url || entry.source_url || entry.url)) return false;
  if (!isSpecificTitle(entry.title || entry.scholarship_name)) return false;
  if (!isProbablyScholarshipPage(entry, '', `${entry.title || ''} ${entry.eligibility || ''} ${entry.instructions || ''} ${entry.fullText || ''}`)) return false;
  if (!hasUsableApplicationPath(entry)) return false;
  return true;
}

function normalizeScholarshipEntry(entry = {}) {
  const sourceUrl = entry.source_url || entry.url || '';
  const applicationUrl = entry.application_url || entry.applicationUrl || '';
  const normalized = {
    ...entry,
    id: cleanText(entry.id),
    scholarship_name: cleanText(entry.scholarship_name || entry.title),
    title: cleanText(entry.title || entry.scholarship_name).slice(0, 180),
    provider_name: cleanText(entry.provider_name || entry.source),
    provider_type: providerTypeFromEntry(entry),
    source: cleanText(entry.source || entry.provider_name),
    source_url: sourceUrl,
    url: entry.url || sourceUrl,
    final_url: entry.final_url || entry.finalUrl || '',
    application_url: applicationUrl,
    applicationUrl,
    application_final_url: entry.application_final_url || entry.applicationFinalUrl || '',
    country: cleanText(entry.country),
    region_or_city: cleanText(entry.region_or_city),
    eligible_nationalities: uniqueList(entry.eligible_nationalities || entry.nationality || []),
    eligible_institutions: uniqueList(entry.eligible_institutions || []),
    eligible_study_levels: uniqueList(entry.eligible_study_levels || entry.level || []),
    eligible_fields: uniqueList(entry.eligible_fields || entry.fields || []),
    amount: cleanText(entry.amount),
    currency: cleanText(entry.currency),
    deadline: cleanText(entry.deadline) || 'Unknown',
    deadline_type: entry.deadline_type || (isRecurringDeadline(entry) ? 'recurring' : (entry.deadline && entry.deadline !== 'Unknown' ? 'fixed' : 'unknown')),
    is_recurring: entry.is_recurring ?? entry.isRecurring ?? (isRecurringDeadline(entry) ? true : null),
    category: cleanText(entry.category),
    level: uniqueList(entry.level || entry.eligible_study_levels || []),
    fields: uniqueList(entry.fields || entry.eligible_fields || []),
    nationality: uniqueList(entry.nationality || entry.eligible_nationalities || []),
    interests: uniqueList(entry.interests || []),
    need: uniqueList(entry.need || []),
    eligibility: cleanText(entry.eligibility),
    requirements: cleanText(entry.requirements),
    documents: cleanText(entry.documents),
    instructions: cleanText(entry.instructions),
    application_instructions: cleanText(entry.application_instructions || entry.applicationInstructions || entry.instructions),
    contact_email: cleanText(entry.contact_email),
    language: cleanText(entry.language),
    page_type: entry.page_type || (isAggregatorDomain(sourceUrl) ? 'aggregator' : (/\.pdf($|\?)/i.test(sourceUrl) ? 'pdf' : 'official_page')),
    source_url_status: cleanText(entry.source_url_status || entry.sourceUrlStatus),
    application_url_status: cleanText(entry.application_url_status || entry.applicationUrlStatus),
    validationStatus: cleanText(entry.validationStatus || entry.validation_status),
    validationNotes: cleanText(entry.validationNotes || entry.validation_notes),
    scrapeSuccess: entry.scrapeSuccess ?? entry.scrape_success ?? true,
    blocked: entry.blocked ?? false,
    requiresLogin: entry.requiresLogin ?? entry.requires_login ?? false,
    expired: entry.expired ?? false,
    duplicateOf: entry.duplicateOf || entry.duplicate_of || '',
    lastVerifiedAt: entry.lastVerifiedAt || entry.last_verified_at || '',
    scrapedAt: entry.scrapedAt || entry.date_scraped || new Date().toISOString(),
    requirementKeywords: uniqueList(entry.requirementKeywords || entry.requirement_keywords || []),
    requiredApplicantInfo: uniqueList(entry.requiredApplicantInfo || entry.required_applicant_info || [])
  };

  const quality = assessScholarshipQuality(normalized);
  normalized.qualityScore = quality.score;
  normalized.trustScore = quality.trustScore;
  normalized.qualityFlags = quality.flags;
  normalized.reviewStatus = REVIEW_STATUSES.has(quality.reviewStatus) ? quality.reviewStatus : 'needs_review';
  normalized.review_status = normalized.reviewStatus;
  normalized.quality_score = normalized.qualityScore;
  normalized.trust_score = normalized.trustScore;
  normalized.quality_flags = normalized.qualityFlags;
  normalized.expired = isExpiredEntry(normalized);
  return normalized;
}

function shouldPublishEntry(entry) {
  return isPublishableScholarship(normalizeScholarshipEntry(entry));
}

function reasonNeedsReview(entry = {}) {
  const flags = new Set(entry.qualityFlags || entry.quality_flags || []);
  if (flags.has('missing_deadline')) return 'missing deadline';
  if (flags.has('missing_application_url')) return 'no application URL found';
  if (flags.has('aggregator_source')) return 'source is aggregator, needs official link';
  if (flags.has('missing_eligibility')) return 'weak eligibility information';
  if (flags.has('needs_manual_pdf_review')) return 'PDF needs manual inspection';
  if (flags.has('generic_title')) return 'title too generic';
  if (flags.has('broken_application_url')) return 'application URL not verified';
  if (flags.has('recurring_deadline')) return 'recurring scholarship needs next deadline check';
  return 'manual verification required';
}

module.exports = {
  ADMIN_REVIEW_STATUSES,
  REVIEW_STATUSES,
  assessScholarshipQuality,
  calculateSimilarity,
  calculateTrustScore,
  canonicalizeUrl,
  cleanText,
  detectCaptchaOrBotWall,
  detectLoginWall,
  detectSoft404,
  hasUsableApplicationPath,
  isAggregatorDomain,
  isExpiredEntry,
  isOfficialProviderDomain,
  isProbablyScholarshipPage,
  isPublishableScholarship,
  isSocialOrShareUrl,
  isSpecificTitle,
  isStatusOk,
  isSuspiciousDomain,
  normalizeScholarshipEntry,
  normalizeTitleForDedup,
  reasonNeedsReview,
  shouldPublishEntry,
  uniqueList
};
