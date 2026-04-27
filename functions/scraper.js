'use strict';

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');
const SEED_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');

// Random delay 1–3 s so every request waits a different amount of time
function randomDelay() {
  return Math.floor(1000 + Math.random() * 2000);
}

// Supabase client — null if env vars not set (scraper still runs without them)
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// Per-run counters for scrape_logs
const runStats = { attempted: 0, success: 0, fail: 0, blocked: 0 };

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

// Puppeteer fetch for JS-rendered pages — lazy require so scraper still runs without puppeteer
async function fetchPageJS(url, waitSelector = null) {
  let browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
    }
    const html = await page.content();
    return cheerio.load(html);
  } catch (err) {
    console.warn(`  [warn] Puppeteer failed for ${url}: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
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

  const dmy = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
  if (dmy) return `${dmy[3]}-${months[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, '0')}`;

  const mdy = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (mdy) return `${mdy[3]}-${months[mdy[1].toLowerCase()]}-${mdy[2].padStart(2, '0')}`;

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

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
  if (t.includes('bachelor') || t.includes('undergraduate') || t.includes('first cycle') || t.includes("bachelor's")) levels.push('Bachelor');
  if (t.includes('master') || t.includes('postgraduate') || t.includes('second cycle') || t.includes("master's")) levels.push('Master');
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
  if (t.includes('architecture') || t.includes('design') || t.includes('urban planning')) fields.push('Architecture');
  if (t.includes('it') || t.includes('information technology') || t.includes('data science') || t.includes('software')) fields.push('IT');
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

function extractAmount(text) {
  const m = text.match(/(?:SEK|EUR|USD|GBP)\s*[\d,]+(?:\s*[-–]\s*[\d,]+)?/i)
    || text.match(/[\d,]+\s*(?:SEK|EUR|USD|GBP)/i)
    || text.match(/kr\.?\s*[\d,]+/i);
  return m ? m[0] : null;
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

// Generic university scraper — used by most universities that share similar HTML patterns
async function scrapeUniversity({ name, prefix, pages, defaultInstructions }) {
  console.log(`Scraping ${name}...`);
  const results = [];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    const containerSelectors = [
      '.accordion__item', '.expandable-block', '.scholarship-item', '.funding-item',
      '.card', 'article', '.grant-item', '.stipend-item', 'li.item', '.list-item',
      '.entry', '.content-block', '.panel', '.block', 'section'
    ];

    let scraped = false;

    for (const sel of containerSelectors) {
      if ($(sel).length < 2) continue;

      $(sel).each((_, el) => {
        const headingEl = $(el).find('h2, h3, h4, h5, .accordion__heading, .card__title, .title, strong').first();
        const title = headingEl.text().trim();
        if (!title || title.length < 8 || title.length > 150) return;
        if (!/scholarship|grant|stipend|award|bursary|funding|fellowship|prize|stöd|bidrag/i.test(title)) return;

        const fullText = $(el).text();
        const paragraphs = $(el).find('p').map((_, p) => $(p).text().trim()).get().filter(Boolean);
        const eligibility = paragraphs[0] || '';
        const deadline = parseDeadline(fullText);
        const link = $(el).find('a').first().attr('href') || '';
        const absUrl = link.startsWith('http') ? link : (link ? `${new URL(pageUrl).origin}${link}` : pageUrl);

        results.push(buildEntry({
          id: `${prefix}-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline,
          fullText,
          source: name,
          url: absUrl,
          eligibility,
          documents: paragraphs.find(p => /document|requir|submit/i.test(p)) || '',
          instructions: paragraphs.find(p => /apply|application|contact/i.test(p)) || defaultInstructions
        }));
      });

      if (results.length) { scraped = true; break; }
    }

    // Fallback: heading scan
    if (!scraped) {
      $('h2, h3, h4').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8 || title.length > 150) return;
        if (!/scholarship|grant|stipend|award|bursary|funding|fellowship|prize/i.test(title)) return;

        const sibling = $(el).nextAll('p, ul, div').first();
        const fullText = title + ' ' + sibling.text();
        const deadline = parseDeadline(fullText);
        const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href') || '';
        const absUrl = link.startsWith('http') ? link : (link ? `${new URL(pageUrl).origin}${link}` : pageUrl);

        results.push(buildEntry({
          id: `${prefix}-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline,
          fullText,
          source: name,
          url: absUrl,
          eligibility: sibling.find('p').first().text().trim() || sibling.text().trim().slice(0, 200),
          documents: '',
          instructions: defaultInstructions
        }));
      });
    }

    console.log(`  ${name} (${pageUrl.split('/').pop() || 'root'}): ${results.length} so far`);
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: Lund University ──────────────────────────────────────────────────

async function scrapeLund() {
  return scrapeUniversity({
    name: 'Lund University',
    prefix: 'lund',
    pages: [
      'https://www.lunduniversity.lu.se/admissions/bachelors-and-masters-studies/scholarships-and-awards',
      'https://www.lth.se/english/study/fees-and-scholarships/',
      'https://www.medicine.lu.se/education/scholarships-and-grants'
    ],
    defaultInstructions: 'Apply via Lund University scholarship portal.'
  });
}

// ─── Source: KTH Royal Institute of Technology ────────────────────────────────

async function scrapeKTH() {
  return scrapeUniversity({
    name: 'KTH Royal Institute of Technology',
    prefix: 'kth',
    pages: [
      'https://www.kth.se/en/studies/master/admissions/scholarships/kth-scholarship-1.72827'
    ],
    defaultInstructions: 'Apply through KTH scholarship system during application period.'
  });
}

// ─── Source: Uppsala University ───────────────────────────────────────────────

async function scrapeUppsala() {
  return scrapeUniversity({
    name: 'Uppsala University',
    prefix: 'uu',
    pages: [
      'https://www.uu.se/en/study/masters-studies/scholarships'
    ],
    defaultInstructions: 'Apply through Uppsala University admissions portal.'
  });
}

// ─── Source: Stockholm University ────────────────────────────────────────────

async function scrapeStockholm() {
  return scrapeUniversity({
    name: 'Stockholm University',
    prefix: 'su',
    pages: [
      'https://www.su.se/english/education/how-to-apply/costs-fees-and-scholarships/scholarships'
    ],
    defaultInstructions: 'Apply via Stockholm University scholarship application.'
  });
}

// ─── Source: Chalmers University of Technology ───────────────────────────────

async function scrapeChalmers() {
  return scrapeUniversity({
    name: 'Chalmers University of Technology',
    prefix: 'chalmers',
    pages: [
      'https://www.chalmers.se/en/education/application-and-admission/scholarships-for-fee-paying-students/'
    ],
    defaultInstructions: 'Apply through Chalmers University scholarship portal.'
  });
}

// ─── Source: University of Gothenburg ────────────────────────────────────────

async function scrapeGothenburg() {
  return scrapeUniversity({
    name: 'University of Gothenburg',
    prefix: 'gu',
    pages: [
      'https://www.gu.se/en/study-in-gothenburg/apply/scholarships-for-fee-paying-students'
    ],
    defaultInstructions: 'Apply through University of Gothenburg scholarship system.'
  });
}

// ─── Source: Linköping University ────────────────────────────────────────────

async function scrapeLinkoping() {
  return scrapeUniversity({
    name: 'Linköping University',
    prefix: 'liu',
    pages: [
      'https://liu.se/en/article/scholarships'
    ],
    defaultInstructions: 'Apply via Linköping University international office.'
  });
}

// ─── Source: Umeå University ──────────────────────────────────────────────────

async function scrapeUmea() {
  return scrapeUniversity({
    name: 'Umeå University',
    prefix: 'umu',
    pages: [
      'https://www.umu.se/en/education/application-and-admission/scholarships/'
    ],
    defaultInstructions: 'Apply through Umeå University scholarship portal.'
  });
}

// ─── Source: Malmö University ─────────────────────────────────────────────────

async function scrapeMalmo() {
  return scrapeUniversity({
    name: 'Malmö University',
    prefix: 'mau',
    pages: [
      'https://mau.se/en/education/scholarships/'
    ],
    defaultInstructions: 'Apply via Malmö University scholarship programme.'
  });
}

// ─── Source: Örebro University ────────────────────────────────────────────────

async function scrapeOrebro() {
  return scrapeUniversity({
    name: 'Örebro University',
    prefix: 'oru',
    pages: [
      'https://www.oru.se/english/study/master-students/scholarships/oruscholarship/'
    ],
    defaultInstructions: 'Apply via Örebro University international office.'
  });
}

// ─── Source: Jönköping University ────────────────────────────────────────────

async function scrapeJonkoping() {
  return scrapeUniversity({
    name: 'Jönköping University',
    prefix: 'ju',
    pages: [
      'https://ju.se/en/study-at-ju/application-and-admission/scholarships-and-funding.html'
    ],
    defaultInstructions: 'Apply through Jönköping University scholarship system.'
  });
}

// ─── Source: Karlstad University ─────────────────────────────────────────────

async function scrapeKarlstad() {
  return scrapeUniversity({
    name: 'Karlstad University',
    prefix: 'kau',
    pages: [
      'https://www.kau.se/en/education/explore-student-life/application-admission/scholarships'
    ],
    defaultInstructions: 'Apply through Karlstad University scholarship portal.'
  });
}

// ─── Source: Södertörn University ────────────────────────────────────────────

async function scrapeSodertorn() {
  return scrapeUniversity({
    name: 'Södertörn University',
    prefix: 'sh',
    pages: [
      'https://www.sh.se/english/sodertorn-university/student/prospective-students/scholarships'
    ],
    defaultInstructions: 'Apply via Södertörn University international office.'
  });
}

// ─── Source: Mälardalen University ───────────────────────────────────────────

async function scrapeMalardalen() {
  return scrapeUniversity({
    name: 'Mälardalen University',
    prefix: 'mdu',
    pages: [
      'https://www.mdu.se/en/malardalen-university/education/international/application-and-admission/malardalen-university-scholarship-programme'
    ],
    defaultInstructions: 'Apply through Mälardalen University scholarship programme.'
  });
}

// ─── Source: Halmstad University ─────────────────────────────────────────────

async function scrapeHalmstad() {
  return scrapeUniversity({
    name: 'Halmstad University',
    prefix: 'hh',
    pages: [
      'https://www.hh.se/english/education/apply-to-halmstad-university/scholarships.html'
    ],
    defaultInstructions: 'Apply via Halmstad University scholarship portal.'
  });
}

// ─── Source: Swedish Institute ────────────────────────────────────────────────

async function scrapeSwedishInstitute() {
  console.log('Scraping Swedish Institute...');
  const results = [];

  const pages = [
    'https://si.se/en/apply/scholarships/',
    'https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals-sisgp/',
    'https://si.se/en/apply/scholarships/swedish-institute-study-scholarships/'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    $('article, .listing-item, .card, .programme-item, .si-card, .scholarship-card').each((_, el) => {
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

  // Site uses CSS Modules: li[class*="scholarship"] contains <a> with title
  $('li[class*="scholarship"], li[class*="Scholarship"]').each((_, el) => {
    const a = $(el).find('a').first();
    const title = a.text().replace('↗️', '').trim();
    if (!title || title.length < 8) return;

    const link = a.attr('href') || '';
    const absUrl = link.startsWith('http') ? link : `https://studyinsweden.se${link}`;
    const category = $(el).find('span').first().text().trim();
    const fullText = category + ' ' + title + ' scholarship Sweden';

    results.push(buildEntry({
      id: `sis-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline: parseDeadline(fullText),
      fullText,
      source: 'Study in Sweden',
      url: absUrl,
      eligibility: category || 'See scholarship page for eligibility.',
      documents: '',
      instructions: 'See the scholarship page for application instructions.'
    }));
  });

  console.log(`  study in sweden: ${results.length}`);
  return results;
}

// ─── Source: UHR ─────────────────────────────────────────────────────────────

async function scrapeUHR() {
  console.log('Scraping UHR...');
  const results = [];

  const pageUrl = 'https://www.uhr.se/en/start/international-opportunities/';
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

// ─── Source: Nordplus ─────────────────────────────────────────────────────────

async function scrapeNordplus() {
  console.log('Scraping Nordplus...');
  const results = [];

  const pages = [
    'https://www.nordplusonline.org/programmes',
    'https://www.nordplusonline.org/programmes/nordplus-higher-education'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    $('article, .card, .programme-card, .listing-item, .programme').each((_, el) => {
      const title = $(el).find('h2, h3, h4, .title, .card-title').first().text().trim();
      if (!title || title.length < 8) return;

      const fullText = $(el).text() + ' exchange travel nordic international student';
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://www.nordplusonline.org${link}`;

      results.push(buildEntry({
        id: `nordplus-${slugify(title)}`,
        title,
        amount: extractAmount(fullText) || 'Nordic mobility grant (varies)',
        deadline: parseDeadline(fullText),
        fullText,
        source: 'Nordplus',
        url: absUrl || pageUrl,
        eligibility: $(el).find('p').first().text().trim() || 'Students at Nordic higher education institutions.',
        documents: 'Mobility agreement, transcript, enrolment certificate.',
        instructions: 'Apply through your home institution\'s international office.'
      }));
    });

    if (!results.length) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8) return;
        const fullText = title + ' exchange travel nordic international student ' + $(el).nextAll('p').first().text();
        results.push(buildEntry({
          id: `nordplus-${slugify(title)}`,
          title,
          amount: extractAmount(fullText) || 'Nordic mobility grant (varies)',
          deadline: parseDeadline(fullText),
          fullText,
          source: 'Nordplus',
          url: pageUrl,
          eligibility: $(el).nextAll('p').first().text().trim() || 'Students at Nordic higher education institutions.',
          documents: 'Mobility agreement, transcript, enrolment certificate.',
          instructions: 'Apply through your home institution\'s international office.'
        }));
      });
    }

    console.log(`  nordplus: ${results.length} so far`);
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: ScholarshipPositions ────────────────────────────────────────────

async function scrapeScholarshipPositions() {
  console.log('Scraping ScholarshipPositions...');
  const results = [];

  for (let pageNum = 1; pageNum <= 35; pageNum++) {
    const url = pageNum === 1
      ? 'https://scholarship-positions.com/category/sweden-scholarships/'
      : `https://scholarship-positions.com/category/sweden-scholarships/page/${pageNum}/`;

    const $ = await fetchPage(url);
    if (!$) break;

    let pageCount = 0;
    $('article').each((_, el) => {
      const titleEl = $(el).find('h2, h3, .entry-title, .post-title').first();
      const title = titleEl.text().trim();
      if (!title || title.length < 8 || title.length > 200) return;

      const fullText = $(el).text();
      const link = titleEl.find('a').attr('href') || $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://scholarship-positions.com${link}`;
      const deadline = parseDeadline(fullText);
      const eligibility = $(el).find('p').first().text().trim();

      results.push(buildEntry({
        id: `spos-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline,
        fullText,
        source: 'Scholarship Positions',
        url: absUrl || url,
        eligibility,
        documents: '',
        instructions: 'See the scholarship page for application instructions.'
      }));
      pageCount++;
    });

    console.log(`  scholarship-positions page ${pageNum}: +${pageCount} (total: ${results.length})`);
    if (pageCount === 0) break;
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: AfterSchoolAfrica Sweden ────────────────────────────────────────

async function scrapeAfterSchoolAfrica() {
  console.log('Scraping AfterSchoolAfrica...');
  const results = [];

  for (let pageNum = 1; pageNum <= 15; pageNum++) {
    const url = pageNum === 1
      ? 'https://www.afterschoolafrica.com/tag/sweden-scholarships/'
      : `https://www.afterschoolafrica.com/tag/sweden-scholarships/page/${pageNum}/`;

    const $ = await fetchPage(url);
    if (!$) break;

    let pageCount = 0;
    $('h2, h3').each((_, el) => {
      const a = $(el).find('a').first();
      const title = a.text().trim() || $(el).text().trim();
      if (!title || title.length < 8 || title.length > 200) return;
      if (!/scholarship|grant|stipend|award|fellowship|bursary|study|research/i.test(title)) return;

      const link = a.attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://www.afterschoolafrica.com${link}`;
      const sibling = $(el).nextAll('p').first().text();
      const fullText = title + ' ' + sibling + ' scholarship sweden international';
      const deadline = parseDeadline(fullText);

      results.push(buildEntry({
        id: `asa-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline,
        fullText,
        source: 'AfterSchoolAfrica',
        url: absUrl || url,
        eligibility: sibling.slice(0, 200) || 'See scholarship page for eligibility.',
        documents: '',
        instructions: 'See the scholarship page for application instructions.'
      }));
      pageCount++;
    });

    console.log(`  afterschoolafrica page ${pageNum}: +${pageCount} (total: ${results.length})`);
    if (pageCount === 0) break;
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: ScholarshipDB (Puppeteer — JS-rendered, paginated) ───────────────

async function scrapeScholarshipDB() {
  console.log('Scraping ScholarshipDB (Puppeteer)...');
  const results = [];
  const seenTitles = new Set();

  let browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);

    // Dismiss GDPR consent popup if present
    await page.goto('https://scholarshipdb.net/scholarships-in/Sweden', { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(2000);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const accept = btns.find(b => /accept|agree|ok|continue|allow/i.test(b.textContent));
      if (accept) accept.click();
      // Also try common consent frameworks
      const cmpBtn = document.querySelector('.sp-acceptAllButton, #accept-all, .accept-all, [id*="accept"], [class*="accept-all"]');
      if (cmpBtn) cmpBtn.click();
    }).catch(() => {});
    await sleep(1500);

    for (let pageNum = 1; pageNum <= 20; pageNum++) {
      const url = pageNum === 1
        ? 'https://scholarshipdb.net/scholarships-in/Sweden'
        : `https://scholarshipdb.net/scholarships-in/Sweden-Page${pageNum}`;

      try {
        if (pageNum > 1) await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
        await sleep(1500);

        const html = await page.content();
        const $ = cheerio.load(html);

        let pageCount = 0;
        $('li.list-group-item, .scholarship-item, article, [class*="scholarship"]').each((_, el) => {
          const a = $(el).find('a').first();
          const title = a.text().trim() || $(el).find('h2,h3,h4,.title').first().text().trim();
          if (!title || title.length < 8 || title.length > 200) return;
          if (seenTitles.has(title)) return;
          seenTitles.add(title);

          const fullText = $(el).text();
          const link = a.attr('href') || '';
          const absUrl = link.startsWith('http') ? link : `https://scholarshipdb.net${link}`;

          results.push(buildEntry({
            id: `sdb-${slugify(title)}`,
            title,
            amount: extractAmount(fullText),
            deadline: parseDeadline(fullText),
            fullText,
            source: 'ScholarshipDB',
            url: absUrl || url,
            eligibility: $(el).find('p, .description, small').first().text().trim(),
            documents: '',
            instructions: 'Apply via the scholarship provider directly.'
          }));
          pageCount++;
        });

        console.log(`  scholarshipdb page ${pageNum}: +${pageCount} new (total: ${results.length})`);
        if (pageCount === 0) break;
        await sleep(DELAY_MS);
      } catch (err) {
        console.warn(`  [warn] ScholarshipDB page ${pageNum}: ${err.message}`);
        break;
      }
    }
  } catch (err) {
    console.warn(`  [warn] ScholarshipDB Puppeteer failed: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  console.log(`  scholarshipdb total: ${results.length}`);
  return results;
}

// ─── Source: Fulbright Sweden ─────────────────────────────────────────────────

async function scrapeFulbright() {
  console.log('Scraping Fulbright Sweden...');
  const results = [];

  const pages = [
    'https://fulbright.se/grants/',
    'https://fulbright.se/grants-for-swedish-citizens/',
    'https://fulbright.se/grants-for-american-citizens/'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    $('article, .card, .grant-item, .program-item, .entry').each((_, el) => {
      const title = $(el).find('h2, h3, h4, .title, .entry-title').first().text().trim();
      if (!title || title.length < 8) return;

      const fullText = $(el).text() + ' scholarship grant fellowship international';
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://fulbright.se${link}`;

      results.push(buildEntry({
        id: `fulbright-${slugify(title)}`,
        title,
        amount: extractAmount(fullText) || 'Full Fulbright grant (travel, living, tuition)',
        deadline: parseDeadline(fullText),
        fullText,
        source: 'Fulbright Sweden',
        url: absUrl || pageUrl,
        eligibility: $(el).find('p').first().text().trim() || 'Swedish or US citizens depending on grant type.',
        documents: 'Project proposal, CV, references, language proficiency.',
        instructions: 'Apply through the Fulbright Sweden application portal.'
      }));
    });

    // Fallback heading scan
    if (!results.length) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8 || title.length > 120) return;
        const fullText = title + ' scholarship grant fellowship international ' + $(el).nextAll('p').first().text();
        results.push(buildEntry({
          id: `fulbright-${slugify(title)}`,
          title,
          amount: 'Full Fulbright grant (travel, living, tuition)',
          deadline: parseDeadline(fullText),
          fullText,
          source: 'Fulbright Sweden',
          url: pageUrl,
          eligibility: $(el).nextAll('p').first().text().trim() || 'See Fulbright Sweden for eligibility.',
          documents: 'Project proposal, CV, references, language proficiency.',
          instructions: 'Apply through the Fulbright Sweden application portal.'
        }));
      });
    }

    console.log(`  fulbright: ${results.length} so far`);
    await sleep(DELAY_MS);
  }

  return results;
}

// ─── Source: Scholarship Portal (Puppeteer — JS-rendered) ─────────────────────

function extractScholarshipPortalEntries($, seenTitles) {
  const entries = [];
  $('[class*="ScholarshipCard"], [class*="scholarship-card"], [class*="scholarshipCard"], article, [class*="ResultCard"], [class*="result-card"]').each((_, el) => {
    const title = $(el).find('h2, h3, h4, [class*="title"], [class*="Title"], [class*="name"], [class*="Name"]').first().text().trim();
    if (!title || title.length < 8 || title.length > 150) return;
    if (seenTitles.has(title)) return; // skip duplicate from same scrape run
    seenTitles.add(title);

    const fullText = $(el).text();
    const link = $(el).find('a').first().attr('href') || '';
    const absUrl = link.startsWith('http') ? link : `https://www.scholarshipportal.com${link}`;

    entries.push(buildEntry({
      id: `sp-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline: parseDeadline(fullText),
      fullText,
      source: 'Scholarship Portal',
      url: absUrl || 'https://www.scholarshipportal.com/scholarships/search?destinationCountry=se',
      eligibility: $(el).find('p, [class*="description"], [class*="desc"]').first().text().trim(),
      documents: '',
      instructions: 'Apply via the scholarship provider directly.'
    }));
  });
  return entries;
}

async function scrapeScholarshipPortalJS() {
  console.log('Scraping Scholarship Portal (Puppeteer)...');
  const results = [];
  const seenTitles = new Set();

  const baseUrl = 'https://www.scholarshipportal.com/scholarships/search?destinationCountry=se';

  let browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(2000);

    for (let pageNum = 1; pageNum <= 15; pageNum++) {
      try {
        await page.waitForSelector('[class*="ScholarshipCard"], [class*="scholarship-card"], [class*="ResultCard"], article', { timeout: 10000 }).catch(() => {});
        await sleep(1500);

        const html = await page.content();
        const $ = cheerio.load(html);
        const pageEntries = extractScholarshipPortalEntries($, seenTitles);
        results.push(...pageEntries);

        console.log(`  scholarship portal page ${pageNum}: +${pageEntries.length} new (total: ${results.length})`);

        // Try to click Next page button
        const nextClicked = await page.evaluate(() => {
          const selectors = [
            '[aria-label="Next page"]',
            '[aria-label="next"]',
            'button[class*="next"]',
            'a[class*="next"]',
            '[class*="pagination"] [class*="next"]',
            '[class*="Pagination"] button:last-child',
            'nav[aria-label*="pagination"] li:last-child a',
            'nav[aria-label*="pagination"] li:last-child button'
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && !el.disabled && !el.getAttribute('aria-disabled')) {
              el.click();
              return true;
            }
          }
          return false;
        });

        if (!nextClicked || pageEntries.length === 0) {
          console.log(`  scholarship portal: no next page at page ${pageNum}`);
          break;
        }

        await sleep(DELAY_MS);
      } catch (err) {
        console.warn(`  [warn] ScholarshipPortal page ${pageNum}: ${err.message}`);
        break;
      }
    }
  } catch (err) {
    console.warn(`  [warn] Puppeteer not available for ScholarshipPortal: ${err.message}`);
    const $ = await fetchPage(baseUrl);
    if ($) {
      const entries = extractScholarshipPortalEntries($, seenTitles);
      results.push(...entries);
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(`  scholarship portal total: ${results.length}`);
  return results;
}

// ─── Source: Erasmus+ (Puppeteer — JS-rendered) ───────────────────────────────

async function scrapeErasmusJS() {
  console.log('Scraping Erasmus+ (Puppeteer)...');
  const results = [];

  const pages = [
    'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/studying-abroad',
    'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/traineeships-abroad',
    'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/young-people'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPageJS(pageUrl, 'article, .card, [class*="opportunity"]');
    if (!$) continue;

    $('article, .card, .opportunity-item, [class*="opportunity"], [class*="Opportunity"]').each((_, el) => {
      const title = $(el).find('h2, h3, h4, [class*="title"]').first().text().trim();
      if (!title || title.length < 8 || title.length > 150) return;

      const fullText = $(el).text();
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://erasmus-plus.ec.europa.eu${link}`;

      results.push(buildEntry({
        id: `erasmus-${slugify(title)}`,
        title,
        amount: extractAmount(fullText) || 'Monthly grant (varies by country pair)',
        deadline: parseDeadline(fullText),
        fullText: fullText + ' exchange travel international EU/EEA student',
        source: 'Erasmus+',
        url: absUrl || pageUrl,
        eligibility: $(el).find('p').first().text().trim() || 'EU/EEA students at participating institutions.',
        documents: 'Learning agreement, transcript, enrolment certificate.',
        instructions: "Apply through your home university's international office."
      }));
    });

    if (!results.length) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8) return;
        const fullText = title + ' exchange travel international EU/EEA student ' + $(el).nextAll('p').first().text();
        results.push(buildEntry({
          id: `erasmus-${slugify(title)}`,
          title,
          amount: 'Monthly grant (varies by country pair)',
          deadline: parseDeadline(fullText),
          fullText,
          source: 'Erasmus+',
          url: pageUrl,
          eligibility: $(el).nextAll('p').first().text().trim() || 'EU/EEA students at participating institutions.',
          documents: 'Learning agreement, transcript, enrolment certificate.',
          instructions: "Apply through your home university's international office."
        }));
      });
    }

    console.log(`  erasmus+: ${results.length} so far`);
    await sleep(DELAY_MS);
  }

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

  const seed = loadSeed();
  console.log(`Loaded ${seed.length} seed scholarships\n`);

  const sources = [
    // Swedish universities (HTML/axios)
    scrapeLund,
    scrapeKTH,
    scrapeUppsala,
    scrapeStockholm,
    scrapeChalmers,
    scrapeGothenburg,
    scrapeLinkoping,
    scrapeUmea,
    scrapeMalmo,
    scrapeOrebro,
    scrapeJonkoping,
    scrapeKarlstad,
    scrapeSodertorn,
    scrapeMalardalen,
    scrapeHalmstad,
    // National/government sources
    scrapeSwedishInstitute,
    scrapeStudyInSweden,
    scrapeUHR,
    scrapeNordplus,
    // Additional sources
    scrapeFulbright,
    scrapeScholarshipPositions,
    scrapeAfterSchoolAfrica,
    // JS-rendered (Puppeteer)
    scrapeScholarshipPortalJS,
    scrapeErasmusJS,
    scrapeScholarshipDB
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

  // Seed entries take priority (manually verified data)
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
