'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');
const SEED_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');
const DELAY_MS = 2000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GrantlyScraper/1.0; educational research bot)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9,sv;q=0.8'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
    return cheerio.load(res.data);
  } catch (err) {
    console.warn(`  [warn] Could not fetch ${url}: ${err.message}`);
    return null;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function parseDeadline(text) {
  const months = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04',
    jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // 15 January 2027 / 15th January 2027
  const dmy = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
  if (dmy) return `${dmy[3]}-${months[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, '0')}`;

  // January 15, 2027
  const mdy = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (mdy) return `${mdy[3]}-${months[mdy[1].toLowerCase()]}-${mdy[2].padStart(2, '0')}`;

  // YYYY-MM-DD
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  // DD/MM/YYYY
  const dmy2 = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;

  return null;
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (t.includes('tuition') || t.includes('fee waiver') || t.includes('fee reduction')) return 'Tuition';
  if (t.includes('travel') || t.includes('exchange') || t.includes('abroad') || t.includes('conference')) return 'Travel';
  if (t.includes('research') || t.includes('thesis') || t.includes('dissertation') || t.includes('lab')) return 'Research';
  return 'Living costs';
}

function inferLevels(text) {
  const t = text.toLowerCase();
  const levels = [];
  if (t.includes('bachelor') || t.includes('undergraduate') || t.includes('first cycle') || t.includes('bachelor\'s')) levels.push('Bachelor');
  if (t.includes('master') || t.includes('postgraduate') || t.includes('second cycle') || t.includes('master\'s')) levels.push('Master');
  if (t.includes('phd') || t.includes('doctoral') || t.includes('third cycle') || t.includes('doctorate')) levels.push('PhD');
  return levels.length ? levels : ['Bachelor', 'Master'];
}

function inferNationality(text) {
  const t = text.toLowerCase();
  const nat = [];
  if (t.includes('swedish citizen') || t.includes('swedish national') || /\bswedish\b/.test(t)) nat.push('Swedish');
  if (t.includes('eu/eea') || t.includes('european union') || t.includes('eea student') || t.includes('eu student')) nat.push('EU/EEA');
  if (t.includes('international') || t.includes('non-eu') || t.includes('outside europe') || t.includes('fee-paying')) nat.push('International non-EU');
  return nat.length ? nat : ['Swedish', 'EU/EEA', 'International non-EU'];
}

function inferNeed(text) {
  const t = text.toLowerCase();
  if (t.includes('financial need') || t.includes('means-tested') || t.includes('economic hardship') || t.includes('low income')) return ['High'];
  if (t.includes('merit-based') || t.includes('academic excellence') || t.includes('outstanding academic')) return ['Low', 'Medium'];
  return ['Low', 'Medium', 'High'];
}

function inferInterests(text) {
  const t = text.toLowerCase();
  const interests = [];
  if (t.includes('sustainab') || t.includes('environment') || t.includes('climate') || t.includes('green energy')) interests.push('Sustainability');
  if (t.includes('research') || t.includes('academic') || t.includes('thesis') || t.includes('scientific')) interests.push('Research');
  if (t.includes('leadership') || t.includes('community') || t.includes('social impact') || t.includes('civil society')) interests.push('Leadership');
  if (t.includes('travel') || t.includes('exchange') || t.includes('international mobility')) interests.push('Travel');
  return interests.length ? interests : ['Any interest'];
}

function inferFields(text) {
  const t = text.toLowerCase();
  const fields = [];
  if (t.includes('engineering') || t.includes('lth') || t.includes('technology') || t.includes('computer science')) fields.push('Engineering');
  if (t.includes('medicine') || t.includes('medical') || t.includes('health') || t.includes('clinical') || t.includes('nursing')) fields.push('Medicine');
  if (t.includes('social science') || t.includes('sociology') || t.includes('political science')) fields.push('Social sciences');
  if (t.includes('law') || t.includes('legal') || t.includes('jurisprudence')) fields.push('Law');
  if (t.includes('humanities') || t.includes('arts') || t.includes('language') || t.includes('literature') || t.includes('history')) fields.push('Humanities');
  if (t.includes('natural science') || t.includes('physics') || t.includes('chemistry') || t.includes('biology')) fields.push('Natural sciences');
  if (t.includes('economics') || t.includes('business') || t.includes('management') || t.includes('finance')) fields.push('Economics');
  return fields.length ? fields : ['Any field'];
}

function extractKeywords(text) {
  const candidates = [
    'academic merit', 'financial need', 'motivation letter', 'research', 'leadership',
    'sustainability', 'international student', 'fee-paying', 'enrolled student',
    'exchange student', 'fieldwork', 'conference', 'thesis', 'dissertation',
    'clinical research', 'technology', 'innovation', 'community engagement',
    'merit-based', 'social impact', 'diversity', 'equity'
  ];
  const t = text.toLowerCase();
  return candidates.filter(k => t.includes(k)).slice(0, 6);
}

function extractRequiredInfo(text) {
  const info = ['first name', 'last name', 'email'];
  const t = text.toLowerCase();
  if (t.includes('cv') || t.includes('curriculum vitae')) info.push('CV');
  if (t.includes('transcript') || t.includes('academic record') || t.includes('grade')) info.push('academic records');
  if (t.includes('motivation') || t.includes('personal statement') || t.includes('cover letter')) info.push('personal statement');
  if (t.includes('reference') || t.includes('recommendation letter')) info.push('reference letter');
  if (t.includes('supervisor')) info.push('supervisor statement');
  if (t.includes('budget') || t.includes('financial plan')) info.push('budget');
  if (t.includes('research plan') || t.includes('project proposal')) info.push('research plan');
  info.push('proof of enrolment');
  return [...new Set(info)].slice(0, 8);
}

function buildEntry({ id, title, amount, deadline, fullText, source, url, eligibility, documents, instructions }) {
  return {
    id,
    title: title.slice(0, 120),
    amount: amount || 'See scholarship page',
    deadline: deadline || '2027-09-01',
    category: inferCategory(fullText),
    level: inferLevels(fullText),
    fields: inferFields(fullText),
    nationality: inferNationality(fullText),
    interests: inferInterests(fullText),
    need: inferNeed(fullText),
    source,
    url,
    eligibility: (eligibility || '').slice(0, 300) || 'See scholarship page for eligibility.',
    documents: (documents || 'See scholarship page for required documents.').slice(0, 300),
    instructions: (instructions || 'Apply via the scholarship provider.').slice(0, 300),
    requirementKeywords: extractKeywords(fullText),
    requiredApplicantInfo: extractRequiredInfo(fullText)
  };
}

function extractAmount(text) {
  const m = text.match(/(?:SEK|EUR|USD|GBP)\s*[\d,]+(?:\s*[-–]\s*[\d,]+)?/i)
    || text.match(/[\d,]+\s*(?:SEK|EUR|USD|GBP)/i);
  return m ? m[0] : null;
}

// ─── Source: Lund University ──────────────────────────────────────────────────

async function scrapeLund() {
  console.log('Scraping Lund University...');
  const results = [];

  const pages = [
    'https://www.lunduniversity.lu.se/international-admissions/fees-and-funding/scholarships-and-funding',
    'https://www.lunduniversity.lu.se/study-in-sweden/fees-and-funding/scholarships',
    'https://www.lth.se/english/study/fees-and-scholarships/',
    'https://www.medicine.lu.se/education/scholarships-and-grants'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    // Try structured item selectors first
    const containerSelectors = [
      '.accordion__item', '.expandable-block', '.scholarship-item',
      '.funding-item', '.card', 'article'
    ];

    let scraped = false;
    for (const sel of containerSelectors) {
      if ($(sel).length < 2) continue;

      $(sel).each((_, el) => {
        const headingEl = $(el).find('h2, h3, h4, .accordion__heading, .card__title, strong').first();
        const title = headingEl.text().trim();
        if (!title || title.length < 8) return;
        if (!/scholarship|grant|stipend|award|bursary|funding/i.test(title)) return;

        const fullText = $(el).text();
        const paragraphs = $(el).find('p').map((_, p) => $(p).text().trim()).get().filter(Boolean);
        const eligibility = paragraphs[0] || '';
        const deadline = parseDeadline(fullText);

        results.push(buildEntry({
          id: `lund-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline,
          fullText,
          source: 'Lund University',
          url: pageUrl,
          eligibility,
          documents: paragraphs.find(p => /document|requir|submit/i.test(p)) || '',
          instructions: paragraphs.find(p => /apply|application|contact/i.test(p)) || ''
        }));
      });

      if (results.length) { scraped = true; break; }
    }

    // Fallback: scan all headings for scholarship keywords
    if (!scraped) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8) return;
        if (!/scholarship|grant|stipend|award|bursary|funding/i.test(title)) return;

        const sibling = $(el).nextAll('p, ul, div').first();
        const fullText = title + ' ' + sibling.text();
        const deadline = parseDeadline(fullText);

        results.push(buildEntry({
          id: `lund-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline,
          fullText,
          source: 'Lund University',
          url: pageUrl,
          eligibility: sibling.find('p').first().text().trim() || sibling.text().trim().slice(0, 200),
          documents: '',
          instructions: 'Apply via Lund University scholarship portal.'
        }));
      });
    }

    console.log(`  lund (${pageUrl.split('/').pop() || 'root'}): ${results.length} so far`);
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: Swedish Institute ────────────────────────────────────────────────

async function scrapeSwedishInstitute() {
  console.log('Scraping Swedish Institute...');
  const results = [];

  const pages = [
    'https://si.se/en/apply/scholarships/',
    'https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals-sisgp/'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    // SI uses a listing of scholarship programme cards/articles
    $('article, .listing-item, .card, .programme-item, .si-card').each((_, el) => {
      const title = $(el).find('h2, h3, h4, .card__title, .listing-item__title').first().text().trim();
      if (!title || title.length < 8) return;

      const fullText = $(el).text();
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://si.se${link}`;
      const deadline = parseDeadline(fullText);
      const eligibility = $(el).find('p').first().text().trim();

      results.push(buildEntry({
        id: `si-${slugify(title)}`,
        title,
        amount: extractAmount(fullText) || 'See Swedish Institute',
        deadline,
        fullText,
        source: 'Swedish Institute',
        url: absUrl || pageUrl,
        eligibility,
        documents: '',
        instructions: 'Apply through the Swedish Institute application portal.'
      }));
    });

    // Fallback: headings
    if (!results.length) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8) return;
        if (!/scholarship|grant|stipend|programme/i.test(title)) return;
        const fullText = title + ' ' + $(el).nextAll('p').first().text();
        results.push(buildEntry({
          id: `si-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline: parseDeadline(fullText),
          fullText,
          source: 'Swedish Institute',
          url: pageUrl,
          eligibility: $(el).nextAll('p').first().text().trim(),
          documents: '',
          instructions: 'Apply through the Swedish Institute application portal.'
        }));
      });
    }

    console.log(`  swedish institute: ${results.length} so far`);
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: Study in Sweden ──────────────────────────────────────────────────

async function scrapeStudyInSweden() {
  console.log('Scraping Study in Sweden...');
  const results = [];

  const pageUrl = 'https://studyinsweden.se/scholarships/';
  const $ = await fetchPage(pageUrl);
  if (!$) return results;

  $('article, .scholarship-item, .card, .post, .entry, .item').each((_, el) => {
    const title = $(el).find('h2, h3, h4, .entry-title, .card-title').first().text().trim();
    if (!title || title.length < 8) return;

    const fullText = $(el).text();
    const link = $(el).find('a').first().attr('href') || '';
    const absUrl = link.startsWith('http') ? link : `https://studyinsweden.se${link}`;
    const deadline = parseDeadline(fullText);
    const eligibility = $(el).find('p').first().text().trim();

    results.push(buildEntry({
      id: `sis-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline,
      fullText,
      source: 'Study in Sweden',
      url: absUrl || pageUrl,
      eligibility,
      documents: '',
      instructions: 'See the scholarship page for application instructions.'
    }));
  });

  console.log(`  study in sweden: ${results.length}`);
  return results;
}

// ─── Source: UHR (Swedish Council for Higher Education) ──────────────────────

async function scrapeUHR() {
  console.log('Scraping UHR...');
  const results = [];

  const pageUrl = 'https://www.uhr.se/en/start/scholarships-and-grants/';
  const $ = await fetchPage(pageUrl);
  if (!$) return results;

  $('article, .card, .listing-item').each((_, el) => {
    const title = $(el).find('h2, h3, h4, .title').first().text().trim();
    if (!title || title.length < 8) return;
    if (!/scholarship|grant|stipend|award|bursary/i.test(title)) return;

    const fullText = $(el).text();
    const link = $(el).find('a').first().attr('href') || '';
    const absUrl = link.startsWith('http') ? link : `https://www.uhr.se${link}`;

    results.push(buildEntry({
      id: `uhr-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline: parseDeadline(fullText),
      fullText,
      source: 'UHR – Swedish Council for Higher Education',
      url: absUrl || pageUrl,
      eligibility: $(el).find('p').first().text().trim(),
      documents: '',
      instructions: 'Apply via UHR or the respective programme administrator.'
    }));
  });

  // Fallback heading scan
  if (!results.length) {
    $('h2, h3').each((_, el) => {
      const title = $(el).text().trim();
      if (!title || title.length < 8) return;
      if (!/scholarship|grant|stipend|award/i.test(title)) return;
      const fullText = title + ' ' + $(el).nextAll('p, ul').first().text();
      results.push(buildEntry({
        id: `uhr-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText,
        source: 'UHR – Swedish Council for Higher Education',
        url: pageUrl,
        eligibility: $(el).nextAll('p').first().text().trim(),
        documents: '',
        instructions: 'Apply via UHR or the respective programme administrator.'
      }));
    });
  }

  console.log(`  uhr: ${results.length}`);
  return results;
}

// ─── Source: Scholarship Portal (Sweden-filtered) ─────────────────────────────

async function scrapeScholarshipPortal() {
  console.log('Scraping Scholarship Portal...');
  const results = [];

  // Use their search filtered to Sweden
  const pageUrl = 'https://www.scholarshipportal.com/scholarships/search?destinationCountry=se';
  const $ = await fetchPage(pageUrl);
  if (!$) return results;

  $('[class*="scholarship"], [class*="card"], article, .result-item').each((_, el) => {
    const title = $(el).find('h2, h3, h4, [class*="title"], [class*="name"]').first().text().trim();
    if (!title || title.length < 8) return;

    const fullText = $(el).text();
    const link = $(el).find('a').first().attr('href') || '';
    const absUrl = link.startsWith('http') ? link : `https://www.scholarshipportal.com${link}`;

    results.push(buildEntry({
      id: `sp-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline: parseDeadline(fullText),
      fullText,
      source: 'Scholarship Portal',
      url: absUrl || pageUrl,
      eligibility: $(el).find('p, [class*="description"]').first().text().trim(),
      documents: '',
      instructions: 'Apply via the scholarship provider directly.'
    }));
  });

  console.log(`  scholarship portal: ${results.length}`);
  return results;
}

// ─── Source: Erasmus+ / European scholarships ─────────────────────────────────

async function scrapeErasmus() {
  console.log('Scraping Erasmus+ opportunities...');
  const results = [];

  const pageUrl = 'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/studying-abroad';
  const $ = await fetchPage(pageUrl);
  if (!$) return results;

  $('article, .card, .opportunity-item, [class*="opportunity"]').each((_, el) => {
    const title = $(el).find('h2, h3, h4, [class*="title"]').first().text().trim();
    if (!title || title.length < 8) return;

    const fullText = $(el).text();
    const link = $(el).find('a').first().attr('href') || '';
    const absUrl = link.startsWith('http') ? link : `https://erasmus-plus.ec.europa.eu${link}`;

    results.push(buildEntry({
      id: `erasmus-${slugify(title)}`,
      title,
      amount: extractAmount(fullText) || 'Monthly grant (varies by country)',
      deadline: parseDeadline(fullText),
      fullText: fullText + ' exchange travel international EU/EEA student',
      source: 'Erasmus+',
      url: absUrl || pageUrl,
      eligibility: $(el).find('p').first().text().trim() || 'EU/EEA students at participating institutions.',
      documents: 'Learning agreement, transcript, enrolment certificate.',
      instructions: 'Apply through your home university\'s international office.'
    }));
  });

  console.log(`  erasmus+: ${results.length}`);
  return results;
}

// ─── Merge & deduplicate ──────────────────────────────────────────────────────

function loadSeed() {
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function deduplicate(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.id)) seen.set(entry.id, entry);
  }
  return Array.from(seen.values());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Grantly Scholarship Scraper ===\n');

  // Load seed data (manually curated + previous scrape results)
  const seed = loadSeed();
  console.log(`Loaded ${seed.length} seed scholarships\n`);

  const sources = [
    scrapeLund,
    scrapeSwedishInstitute,
    scrapeStudyInSweden,
    scrapeUHR,
    scrapeScholarshipPortal,
    scrapeErasmus
  ];

  const scraped = [];

  for (const source of sources) {
    try {
      const results = await source();
      console.log(`  -> ${results.length} scholarships\n`);
      scraped.push(...results);
    } catch (err) {
      console.error(`  [error] ${err.message}\n`);
    }
    await sleep(DELAY_MS);
  }

  // Seed entries take priority (they have manually verified data).
  // New scraped entries are added only if their id isn't already in seed.
  const seedIds = new Set(seed.map(s => s.id));
  const newEntries = scraped.filter(s => !seedIds.has(s.id));
  const combined = deduplicate([...seed, ...newEntries]);

  console.log(`\nSeed: ${seed.length} | Scraped new: ${newEntries.length} | Total: ${combined.length}`);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(combined, null, 2));
  console.log(`Saved to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
