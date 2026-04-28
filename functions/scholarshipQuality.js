'use strict';

const GENERIC_TITLE_PATTERNS = [
  /page not found/i,
  /sorry.*not find/i,
  /website is new/i,
  /scholarship recipients/i,
  /key facts/i,
  /opens doors/i,
  /cookie/i,
  /privacy/i
];

const STALE_YEAR_PATTERN = /\b(20[0-1]\d|2020|2021|2022|2023|2024|2025)\b/;
const SCHOLARSHIP_WORDS = /\b(scholarship|grant|stipend|award|bursary|funding|fellowship|tuition fee waiver)\b/i;

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

function normalizeScholarshipEntry(entry) {
  const normalized = {
    ...entry,
    title: cleanText(entry.title).slice(0, 140),
    amount: cleanText(entry.amount) || 'See scholarship page',
    deadline: cleanText(entry.deadline) || 'Unknown',
    source: cleanText(entry.source),
    eligibility: cleanText(entry.eligibility),
    documents: cleanText(entry.documents),
    instructions: cleanText(entry.instructions),
    requirementKeywords: uniqueList(entry.requirementKeywords || entry.requirement_keywords || []),
    requiredApplicantInfo: uniqueList(entry.requiredApplicantInfo || entry.required_applicant_info || [])
  };

  const quality = assessScholarshipQuality(normalized);
  normalized.qualityScore = quality.score;
  normalized.qualityFlags = quality.flags;
  normalized.reviewStatus = quality.reviewStatus;
  return normalized;
}

function assessScholarshipQuality(entry) {
  const flags = [];
  let score = 100;
  const title = cleanText(entry.title);
  const text = `${title} ${entry.eligibility || ''} ${entry.instructions || ''}`;

  if (!title || title.length < 8) addFlag(flags, 'short_title');
  if (!SCHOLARSHIP_WORDS.test(text)) addFlag(flags, 'weak_scholarship_signal');
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title))) addFlag(flags, 'generic_or_error_title');
  if (!entry.url || !/^https?:\/\//i.test(entry.url)) addFlag(flags, 'missing_source_url');
  if (!entry.deadline || entry.deadline === 'Unknown') addFlag(flags, 'unknown_deadline');
  if (!entry.applicationUrl && !entry.application_url) addFlag(flags, 'missing_application_url');
  if (!entry.eligibility || entry.eligibility.length < 40) addFlag(flags, 'thin_eligibility');
  if (entry.unreachable || entry.scrapeSuccess === false || entry.scrape_success === false) addFlag(flags, 'unreachable_source');
  if (STALE_YEAR_PATTERN.test(title) && (!entry.deadline || entry.deadline === 'Unknown')) addFlag(flags, 'likely_stale');

  const penalties = {
    short_title: 35,
    generic_or_error_title: 50,
    weak_scholarship_signal: 25,
    missing_source_url: 35,
    unknown_deadline: 15,
    missing_application_url: 8,
    thin_eligibility: 12,
    unreachable_source: 18,
    likely_stale: 30
  };

  for (const flag of flags) score -= penalties[flag] || 0;
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    flags,
    reviewStatus: score >= 75 ? 'publishable' : score >= 50 ? 'needs_review' : 'hide'
  };
}

function shouldPublishEntry(entry) {
  const quality = entry.qualityScore === undefined
    ? assessScholarshipQuality(entry)
    : { score: entry.qualityScore, reviewStatus: entry.reviewStatus };
  return quality.score >= 50 && quality.reviewStatus !== 'hide';
}

function uniqueList(values) {
  return [...new Set((values || []).map(cleanText).filter(Boolean))].slice(0, 10);
}

function addFlag(flags, flag) {
  if (!flags.includes(flag)) flags.push(flag);
}

module.exports = {
  assessScholarshipQuality,
  cleanText,
  normalizeScholarshipEntry,
  shouldPublishEntry
};
