'use strict';

const assert = require('assert');
const cheerio = require('cheerio');
const scraper = require('./scraper');
const quality = require('./scholarshipQuality');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('parseDeadline handles common formats', () => {
  assert.strictEqual(scraper.parseDeadline('Apply by 31 March 2027'), '2027-03-31');
  assert.strictEqual(scraper.parseDeadline('Deadline: March 2027'), '2027-03-31');
  assert.strictEqual(scraper.parseDeadline('2027/04/05'), '2027-04-05');
});

test('recurring deadline avoids expiry', () => {
  assert.strictEqual(quality.isExpiredEntry({ deadline: '2024-01-01', deadline_type: 'recurring' }), false);
  assert.strictEqual(quality.isExpiredEntry({ deadline: '2024-01-01' }, new Date('2026-05-07')), true);
});

test('extractAmount finds currencies and waivers', () => {
  assert.strictEqual(scraper.extractAmount('The award is SEK 50 000 for travel.'), 'SEK 50 000');
  assert.strictEqual(scraper.extractAmount('Includes a full tuition waiver.'), 'full tuition waiver');
});

test('canonicalizeUrl removes tracking and hash', () => {
  assert.strictEqual(
    scraper.canonicalizeUrl('https://www.Example.org/path/?utm_source=x&b=2#a'),
    'https://example.org/path?b=2'
  );
});

test('application URL extraction rejects share links', () => {
  const $ = cheerio.load('<a href="https://facebook.com/share">Apply now</a><a href="/application-form">Application form</a>');
  assert.strictEqual(scraper.extractApplicationUrlStrict($, 'https://example.edu/scholarship'), 'https://example.edu/application-form');
});

test('isProbablyScholarshipPage detects usable funding pages', () => {
  assert.strictEqual(quality.isProbablyScholarshipPage({
    title: 'Master Scholarship for International Students',
    eligibility: 'Eligible students can apply for a tuition waiver before the deadline.',
    instructions: 'Submit the application form online.'
  }), true);
  assert.strictEqual(quality.isProbablyScholarshipPage({ title: 'Scholarship essay writing tips' }), false);
});

test('hasUsableApplicationPath accepts verified URL or strong instructions', () => {
  assert.strictEqual(quality.hasUsableApplicationPath({
    application_url: 'https://example.edu/apply',
    application_url_status: 'ok:200'
  }), true);
  assert.strictEqual(quality.hasUsableApplicationPath({
    instructions: 'To apply, submit the application form, CV, transcript, and motivation letter by email before the deadline.'
  }), true);
});

test('publishability requires validation and trust', () => {
  const entry = quality.normalizeScholarshipEntry({
    id: 'x',
    title: 'University Research Scholarship for Master Students',
    source: 'Example University',
    url: 'https://example.edu/scholarship',
    source_url_status: 'ok:200',
    application_url: 'https://example.edu/apply',
    application_url_status: 'ok:200',
    deadline: '2027-05-01',
    amount: 'SEK 10 000',
    eligibility: 'Eligible master students at Example University may apply for research project support.',
    instructions: 'Apply through the online application form with CV and transcript before the deadline.'
  });
  assert.strictEqual(quality.isPublishableScholarship(entry), true);
});

test('deduplication prefers official provider over aggregator', () => {
  const [entry] = scraper.deduplicate([
    { id: 'a', title: 'Research Scholarship', source: 'Scholarship Positions', url: 'https://scholarship-positions.com/research-scholarship', instructions: 'Apply via provider.' },
    { id: 'b', title: 'Research Scholarship', source: 'Example University', url: 'https://example.edu/research-scholarship', instructions: 'Apply through the online application form with CV and transcript.' }
  ]);
  assert.strictEqual(entry.source, 'Example University');
});

test('wall and suspicious detectors work', () => {
  assert.strictEqual(quality.detectLoginWall('https://example.edu/login', '<input type="password"> Sign in'), true);
  assert.strictEqual(quality.detectSoft404('<title>Page not found</title>', 'https://example.edu/missing'), true);
  assert.strictEqual(quality.isSuspiciousDomain('https://casino-scholarships.example/apply'), true);
});

// ─── pageClassifier tests ─────────────────────────────────────────────────────

const classifier = require('./pageClassifier');
const { PAGE_TYPES } = classifier;

test('classifyPage identifies generic homepage', () => {
  const r = classifier.classifyPage('https://example.edu/');
  assert.strictEqual(r.type, PAGE_TYPES.GENERIC_HOMEPAGE);
});

test('classifyPage identifies search results page', () => {
  const r = classifier.classifyPage('https://example.edu/search?q=scholarship');
  assert.strictEqual(r.type, PAGE_TYPES.SEARCH_RESULTS_PAGE);
});

test('classifyPage identifies search path URL', () => {
  const r = classifier.classifyPage('https://example.edu/search/scholarships');
  assert.strictEqual(r.type, PAGE_TYPES.SEARCH_RESULTS_PAGE);
});

test('classifyPage identifies official application form URL', () => {
  const r = classifier.classifyPage('https://example.edu/application-form');
  assert.strictEqual(r.type, PAGE_TYPES.OFFICIAL_APPLICATION_FORM);
});

test('classifyPage identifies aggregator domain', () => {
  const r = classifier.classifyPage('https://scholarship-positions.com/some-scholarship/');
  assert.strictEqual(r.type, PAGE_TYPES.AGGREGATOR_DETAIL);
});

test('classifyPage identifies expired or removed page', () => {
  const html = '<html><body><p>Applications are closed for this round.</p></body></html>';
  const r = classifier.classifyPage('https://example.edu/scholarships/expired', html, {});
  assert.strictEqual(r.type, PAGE_TYPES.EXPIRED_OR_REMOVED);
});

test('classifyPage identifies social/share URL', () => {
  const r = classifier.classifyPage('https://facebook.com/share?u=...');
  assert.strictEqual(r.type, PAGE_TYPES.SOCIAL_OR_SHARE);
});

test('classifyPage identifies official scholarship detail with HTML', () => {
  const html = '<html><body><h1>Merit Scholarship</h1><p>Apply for this scholarship by submitting the application form.</p></body></html>';
  const r = classifier.classifyPage(
    'https://example.edu/scholarships/merit-award',
    html,
    { title: 'Merit Scholarship', eligibility: 'merit students' }
  );
  assert.strictEqual(r.type, PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL);
});

test('isAcceptableSourcePageType allows official and aggregator', () => {
  assert.strictEqual(classifier.isAcceptableSourcePageType(PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL), true);
  assert.strictEqual(classifier.isAcceptableSourcePageType(PAGE_TYPES.AGGREGATOR_DETAIL), true);
  assert.strictEqual(classifier.isAcceptableSourcePageType(PAGE_TYPES.GENERIC_HOMEPAGE), false);
  assert.strictEqual(classifier.isAcceptableSourcePageType(PAGE_TYPES.SEARCH_RESULTS_PAGE), false);
});

test('isAcceptableApplicationPageType allows form, portal, and detail', () => {
  assert.strictEqual(classifier.isAcceptableApplicationPageType(PAGE_TYPES.OFFICIAL_APPLICATION_FORM), true);
  assert.strictEqual(classifier.isAcceptableApplicationPageType(PAGE_TYPES.OFFICIAL_APPLICATION_PORTAL), true);
  assert.strictEqual(classifier.isAcceptableApplicationPageType(PAGE_TYPES.OFFICIAL_SCHOLARSHIP_DETAIL), true);
  assert.strictEqual(classifier.isAcceptableApplicationPageType(PAGE_TYPES.GENERIC_HOMEPAGE), false);
  assert.strictEqual(classifier.isAcceptableApplicationPageType(PAGE_TYPES.SOCIAL_OR_SHARE), false);
});

// ─── resultAudit tests ────────────────────────────────────────────────────────

const audit = require('./resultAudit');

test('auditEntryStatic flags generic homepage source URL', () => {
  const r = audit.auditEntryStatic({
    id: 'x', title: 'Test Scholarship', source: 'Example',
    source_url: 'https://example.edu/',
    application_url: null
  });
  assert.strictEqual(r.audit_status, 'manual_review');
  assert.ok(r.audit_reason.includes('generic homepage'));
});

test('auditEntryStatic flags search results source URL', () => {
  const r = audit.auditEntryStatic({
    id: 'x', title: 'Test Scholarship', source: 'Example',
    source_url: 'https://example.edu/search?q=scholarship',
    application_url: null
  });
  assert.ok(['manual_review', 'reject'].includes(r.audit_status));
  assert.ok(r.audit_reason.includes('search results'));
});

test('auditEntryStatic flags aggregator source without official app URL', () => {
  const r = audit.auditEntryStatic({
    id: 'x', title: 'Test Scholarship', source: 'Scholarship Positions',
    source_url: 'https://scholarship-positions.com/test-scholarship/',
    application_url: null
  });
  assert.ok(r.audit_reason.includes('aggregator'));
});

test('auditEntryStatic passes clean official entry', () => {
  const r = audit.auditEntryStatic({
    id: 'x',
    title: 'Research Scholarship for Master Students',
    source: 'Example University',
    source_url: 'https://example.edu/scholarships/research-scholarship',
    application_url: 'https://example.edu/apply',
    source_url_status: 'ok:200',
    application_url_status: 'ok:200',
    deadline: '2027-05-01',
    eligibility: 'Master students at Example University may apply for research funding.',
    instructions: 'Apply through the online form with CV and transcript before the deadline.'
  });
  assert.strictEqual(r.audit_status, 'pass');
});

test('auditEntryStatic rejects social/share application URL', () => {
  const r = audit.auditEntryStatic({
    id: 'x', title: 'Test Scholarship', source: 'Example',
    source_url: 'https://example.edu/scholarships/test',
    application_url: 'https://facebook.com/share?u=test'
  });
  assert.strictEqual(r.audit_status, 'reject');
  assert.ok(r.audit_reason.includes('social/share'));
});

test('auditEntryStatic rejects expired entry', () => {
  const r = audit.auditEntryStatic({
    id: 'x', title: 'Old Scholarship', source: 'Example',
    source_url: 'https://example.edu/scholarships/old',
    deadline: '2020-01-01'
  });
  assert.strictEqual(r.audit_status, 'reject');
  assert.ok(r.audit_reason.includes('expired'));
});

test('auditEntryStatic is idempotent for same entry', () => {
  const entry = {
    id: 'a', title: 'Test Scholarship', source: 'X',
    source_url: 'https://example.edu/scholarship',
    application_url: 'https://example.edu/apply'
  };
  const r1 = audit.auditEntryStatic(entry);
  const r2 = audit.auditEntryStatic(entry);
  assert.strictEqual(r1.audit_status, r2.audit_status);
  assert.strictEqual(r1.audit_reason, r2.audit_reason);
  assert.strictEqual(r1.source_page_type, r2.source_page_type);
});

test('summarizeAudit produces correct counts', () => {
  const results = [
    { audit_status: 'pass', source_page_type: 'official_scholarship_detail', audit_reason: 'passes static checks' },
    { audit_status: 'pass', source_page_type: 'official_scholarship_detail', audit_reason: 'passes static checks' },
    { audit_status: 'manual_review', source_page_type: 'aggregator_detail', audit_reason: 'source is aggregator, no official application URL' },
    { audit_status: 'reject', source_page_type: 'generic_homepage', audit_reason: 'source URL is generic homepage' }
  ];
  const s = audit.summarizeAudit(results);
  assert.strictEqual(s.total, 4);
  assert.strictEqual(s.pass, 2);
  assert.strictEqual(s.manual_review, 1);
  assert.strictEqual(s.reject, 1);
  assert.strictEqual(s.pass_rate, 0.5);
});

test('isHomepageUrl correctly identifies root paths', () => {
  assert.strictEqual(audit.isHomepageUrl('https://example.edu/'), true);
  assert.strictEqual(audit.isHomepageUrl('https://example.edu'), true);
  assert.strictEqual(audit.isHomepageUrl('https://example.edu/scholarships'), false);
  assert.strictEqual(audit.isHomepageUrl('https://example.edu/index.html'), true);
});

test('isSearchResultsUrl correctly identifies search URLs', () => {
  assert.strictEqual(audit.isSearchResultsUrl('https://example.edu/search?q=scholarship'), true);
  assert.strictEqual(audit.isSearchResultsUrl('https://example.edu/?s=test'), true);
  assert.strictEqual(audit.isSearchResultsUrl('https://example.edu/scholarships/merit'), false);
});

// ─── improvement loop guard test ─────────────────────────────────────────────

test('improvement loop has Supabase guard constant', () => {
  const improveModule = require('./improve-scraper');
  assert.strictEqual(improveModule.SUPABASE_FORBIDDEN, true);
});

console.log('All scraper logic tests passed.');
