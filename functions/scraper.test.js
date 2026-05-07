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

console.log('All scraper logic tests passed.');
