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

async function fetchPage(url, { retries = 3, backoff = 2000 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
      return cheerio.load(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status && [401, 403, 429].includes(status)) {
        runStats.blocked++;
        console.warn(`  [warn] Blocked (${status}) ${url}`);
        return null; // don't retry on auth/rate-limit
      }
      if (attempt < retries - 1) {
        await sleep(backoff * (attempt + 1));
      } else {
        console.warn(`  [warn] Failed after ${retries} attempts ${url}: ${err.message}`);
      }
    }
  }
  return null;
}

// Click common cookie/consent accept buttons — call after page.goto in any Puppeteer context
async function acceptCookieBanners(page) {
  await page.evaluate(() => {
    const patterns = [
      '#accept-all', '#acceptAll', '.accept-all', '.acceptAll',
      '[id*="accept-all"]', '[id*="acceptAll"]', '[class*="accept-all"]',
      '[data-testid*="accept"]', '[aria-label*="Accept all"]',
      '#onetrust-accept-btn-handler', '.cc-accept', '#CybotCookiebotDialogBodyButtonAccept',
      '.sp-acceptAllButton', '.js-accept-all-cookies', '#cookie-accept'
    ];
    for (const sel of patterns) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return; }
    }
    // Fallback: click any visible button whose text matches
    const btns = [...document.querySelectorAll('button, [role="button"]')];
    const accept = btns.find(b => /^(accept all|accept cookies|i agree|agree|ok|allow all)$/i.test(b.textContent.trim()));
    if (accept) accept.click();
  }).catch(() => {});
  await sleep(600);
}

// Returns true if page content looks like a login/auth wall
function isLoginWall(html) {
  const t = html.toLowerCase();
  return (
    (t.includes('sign in') || t.includes('log in') || t.includes('login') || t.includes('please authenticate')) &&
    (t.includes('<form') || t.includes('password')) &&
    !t.includes('scholarship') && !t.includes('grant')
  );
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
    await acceptCookieBanners(page);
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
    }
    const html = await page.content();
    if (isLoginWall(html)) {
      console.warn(`  [warn] Login wall detected at ${url}, skipping`);
      return null;
    }
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

// Find the actual application form/portal URL on a detail page.
// Returns null if application is email-based or no apply link found.
function extractApplicationUrl($, baseUrl) {
  const applyText = /^(apply(\s+(now|here|online|today))?|start\s+application|submit\s+application|application\s+form|go\s+to\s+application|apply\s+for\s+this|apply\s+to\s+this)$/i;
  const applyHref = /[/=](apply|application|ansok|ans%C3%B6kan|ansökan|apply-now|applynow)/i;

  let found = null;

  // Pass 1: anchor text match (most reliable)
  $('a').each((_, el) => {
    if (found) return;
    const text = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!href || href === '#' || href.startsWith('mailto:')) return;
    if (!applyText.test(text)) return;
    try {
      found = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    } catch { /* skip malformed */ }
  });

  // Pass 2: href keyword match (apply/application in URL path)
  if (!found) {
    $('a').each((_, el) => {
      if (found) return;
      const href = $(el).attr('href') || '';
      if (!href || href === '#' || href.startsWith('mailto:')) return;
      if (!applyHref.test(href)) return;
      // Skip if it points back to the same page (anchor or same path)
      try {
        const abs = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        if (abs === baseUrl) return;
        found = abs;
      } catch { /* skip malformed */ }
    });
  }

  return found;
}

function buildEntry({ id, title, amount, deadline, fullText, source, url, eligibility, documents, instructions, applicationUrl = null }) {
  return {
    url,
    applicationUrl,
    id,
    title: title.slice(0, 120),
    amount: amount || 'See scholarship page',
    deadline: deadline || 'Unknown',
    category: inferCategory(fullText),
    level: inferLevels(fullText),
    fields: inferFields(fullText),
    nationality: inferNationality(fullText),
    interests: inferInterests(fullText),
    need: inferNeed(fullText),
    source,
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
    await sleep(randomDelay());
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
    await sleep(randomDelay());
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
    await sleep(randomDelay());
  }

  return results;
}

// ─── Source: ScholarshipPositions ────────────────────────────────────────────

async function scrapeScholarshipPositions() {
  console.log('Scraping ScholarshipPositions...');
  const results = [];

  for (let pageNum = 1; pageNum <= 70; pageNum++) {
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
    await sleep(randomDelay());
  }

  return results;
}

// ─── Source: AfterSchoolAfrica Sweden ────────────────────────────────────────

async function scrapeAfterSchoolAfrica() {
  console.log('Scraping AfterSchoolAfrica...');
  const results = [];

  for (let pageNum = 1; pageNum <= 40; pageNum++) {
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
    await sleep(randomDelay());
  }

  // Always deep-scrape AfterSchoolAfrica — small entry count, detail pages have real data
  await enrichEntries(results, { label: 'AfterSchoolAfrica' });
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

    await page.goto('https://scholarshipdb.net/scholarships-in/Sweden', { waitUntil: 'networkidle2', timeout: 35000 });
    await acceptCookieBanners(page);
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
        await sleep(randomDelay());
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
    await sleep(randomDelay());
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
    await acceptCookieBanners(page);
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

        await sleep(randomDelay());
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
    await sleep(randomDelay());
  }

  return results;
}

// ─── Source: Scholars4Dev ─────────────────────────────────────────────────────

async function scrapeScholars4Dev() {
  console.log('Scraping Scholars4Dev...');
  const results = [];

  for (let pageNum = 1; pageNum <= 25; pageNum++) {
    const url = pageNum === 1
      ? 'https://www.scholars4dev.com/tag/scholarships-in-sweden/'
      : `https://www.scholars4dev.com/tag/scholarships-in-sweden/page/${pageNum}/`;

    const $ = await fetchPage(url);
    if (!$) break;

    let count = 0;
    $('article, .post').each((_, el) => {
      const titleEl = $(el).find('h2, h3, .entry-title').first();
      const a = titleEl.find('a').first();
      const title = (a.text() || titleEl.text()).trim();
      if (!title || title.length < 8 || title.length > 200) return;

      const link = a.attr('href') || '';
      const fullText = $(el).text();

      results.push(buildEntry({
        id: `s4d-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + ' scholarship sweden',
        source: 'Scholars4Dev',
        url: link || url,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: 'See the scholarship page for application instructions.'
      }));
      count++;
    });

    console.log(`  scholars4dev page ${pageNum}: +${count} (total: ${results.length})`);
    if (count === 0) break;
    await sleep(randomDelay());
  }

  return results;
}

// ─── Source: Opportunity Desk ─────────────────────────────────────────────────

async function scrapeOpportunityDesk() {
  console.log('Scraping Opportunity Desk...');
  const results = [];

  for (let pageNum = 1; pageNum <= 20; pageNum++) {
    const url = pageNum === 1
      ? 'https://opportunitydesk.org/tag/sweden-scholarships/'
      : `https://opportunitydesk.org/tag/sweden-scholarships/page/${pageNum}/`;

    const $ = await fetchPage(url);
    if (!$) break;

    let count = 0;
    $('article, .post').each((_, el) => {
      const titleEl = $(el).find('h2, h3, .entry-title').first();
      const a = titleEl.find('a').first();
      const title = (a.text() || titleEl.text()).trim();
      if (!title || title.length < 8 || title.length > 200) return;

      const link = a.attr('href') || '';
      const fullText = $(el).text();

      results.push(buildEntry({
        id: `od-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + ' scholarship sweden',
        source: 'Opportunity Desk',
        url: link || url,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: 'See the scholarship page for application instructions.'
      }));
      count++;
    });

    console.log(`  opportunity desk page ${pageNum}: +${count} (total: ${results.length})`);
    if (count === 0) break;
    await sleep(randomDelay());
  }

  return results;
}

// ─── Source: Euraxess Sweden ──────────────────────────────────────────────────

async function scrapeEuraxess() {
  console.log('Scraping Euraxess...');
  const results = [];

  const pages = [
    'https://euraxess.ec.europa.eu/jobs/search?country_of_offer=SE',
    'https://euraxess.ec.europa.eu/fellowships/search?country_of_offer=SE'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPageJS(pageUrl, '.jobs-listing, article, .card');
    if (!$) continue;

    $('article, .card, .job-item, .fellowship-item, li.views-row').each((_, el) => {
      const title = $(el).find('h2, h3, h4, .field-content, .views-field-title').first().text().trim();
      if (!title || title.length < 8 || title.length > 200) return;

      const fullText = $(el).text();
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://euraxess.ec.europa.eu${link}`;

      results.push(buildEntry({
        id: `euraxess-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + ' research grant fellowship sweden',
        source: 'Euraxess',
        url: absUrl || pageUrl,
        eligibility: $(el).find('p, .field-content').first().text().trim(),
        documents: '',
        instructions: 'Apply through Euraxess or the hosting institution.'
      }));
    });

    console.log(`  euraxess: ${results.length} so far`);
    await sleep(randomDelay());
  }

  return results;
}

// ─── Source: Swedish Research Council (Vetenskapsrådet) ──────────────────────

async function scrapeVetenskapsradet() {
  return scrapeUniversity({
    name: 'Swedish Research Council',
    prefix: 'vr',
    pages: [
      'https://www.vr.se/english/applying-for-funding/calls/calls-for-proposals.html'
    ],
    defaultInstructions: 'Apply via the Swedish Research Council application portal PRISMA.'
  });
}

// ─── Source: Formas ───────────────────────────────────────────────────────────

async function scrapeFormas() {
  return scrapeUniversity({
    name: 'Formas',
    prefix: 'formas',
    pages: [
      'https://formas.se/en/start/applying-for-funding/calls-for-proposals.html'
    ],
    defaultInstructions: 'Apply via Formas e-application system.'
  });
}

// ─── Source: Vinnova ──────────────────────────────────────────────────────────

async function scrapeVinnova() {
  return scrapeUniversity({
    name: 'Vinnova',
    prefix: 'vinnova',
    pages: [
      'https://www.vinnova.se/en/apply-for-funding/find-the-right-funding/'
    ],
    defaultInstructions: 'Apply via Vinnova\'s online application system.'
  });
}

// ─── Source: Wallenberg Foundations ──────────────────────────────────────────

async function scrapeWallenberg() {
  return scrapeUniversity({
    name: 'Wallenberg Foundations',
    prefix: 'wallenberg',
    pages: [
      'https://www.wallenberg.com/en/grants',
      'https://kaw.wallenberg.org/en/apply'
    ],
    defaultInstructions: 'Apply through the Wallenberg foundation portal.'
  });
}

// ─── Source: KK-stiftelsen ────────────────────────────────────────────────────

async function scrapeKKStiftelsen() {
  return scrapeUniversity({
    name: 'KK-stiftelsen',
    prefix: 'kk',
    pages: [
      'https://www.kks.se/en/grants/'
    ],
    defaultInstructions: 'Apply through KK-stiftelsen\'s application portal.'
  });
}

// ─── Source: Karolinska Institutet ───────────────────────────────────────────

async function scrapeKarolinska() {
  return scrapeUniversity({
    name: 'Karolinska Institutet',
    prefix: 'ki',
    pages: [
      'https://ki.se/en/education/fees-and-scholarships',
      'https://ki.se/en/research/scholarships-and-grants'
    ],
    defaultInstructions: 'Apply through Karolinska Institutet scholarship portal.'
  });
}

// ─── Source: Swedish University of Agricultural Sciences ─────────────────────

async function scrapeSLU() {
  return scrapeUniversity({
    name: 'Swedish University of Agricultural Sciences',
    prefix: 'slu',
    pages: [
      'https://www.slu.se/en/education/programmes-courses/masters-studies/scholarships/'
    ],
    defaultInstructions: 'Apply through SLU scholarship portal.'
  });
}

// ─── Source: Luleå University of Technology ──────────────────────────────────

async function scrapeLTU() {
  return scrapeUniversity({
    name: 'Luleå University of Technology',
    prefix: 'ltu',
    pages: [
      'https://www.ltu.se/en/study-at-ltu/application-and-tuition-fees/scholarships'
    ],
    defaultInstructions: 'Apply through Luleå University scholarship portal.'
  });
}

// ─── Source: Blekinge Institute of Technology ─────────────────────────────────

async function scrapeBTH() {
  return scrapeUniversity({
    name: 'Blekinge Institute of Technology',
    prefix: 'bth',
    pages: [
      'https://www.bth.se/eng/study/scholarships/'
    ],
    defaultInstructions: 'Apply through BTH scholarship portal.'
  });
}

// ─── Source: Mid Sweden University ───────────────────────────────────────────

async function scrapeMidSweden() {
  return scrapeUniversity({
    name: 'Mid Sweden University',
    prefix: 'miun',
    pages: [
      'https://www.miun.se/en/study-at-mid-sweden-university/scholarship/'
    ],
    defaultInstructions: 'Apply through Mid Sweden University scholarship portal.'
  });
}

// ─── Source: Stockholm School of Economics ────────────────────────────────────

async function scrapeHHS() {
  return scrapeUniversity({
    name: 'Stockholm School of Economics',
    prefix: 'hhs',
    pages: [
      'https://www.hhs.se/en/education/bsc/scholarships/',
      'https://www.hhs.se/en/education/msc/scholarships/'
    ],
    defaultInstructions: 'Apply through Stockholm School of Economics scholarship portal.'
  });
}

// ─── Source: University of Borås ─────────────────────────────────────────────

async function scrapeHB() {
  return scrapeUniversity({
    name: 'University of Borås',
    prefix: 'hb',
    pages: [
      'https://www.hb.se/en/study-at-hb/study-options/scholarships/'
    ],
    defaultInstructions: 'Apply through University of Borås scholarship portal.'
  });
}

// ─── Source: Concurrency helper ───────────────────────────────────────────────

async function withConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ─── Deep scraping — follow links to individual scholarship pages ─────────────

async function scrapeDetailPage(url) {
  const $ = await fetchPage(url);
  if (!$) return null;

  const fullText = $('body').text();

  // Extract section content by finding a heading that matches a keyword,
  // then grabbing the next block of text
  function extractSection(...keywords) {
    let found = '';
    $('h1, h2, h3, h4, h5, strong, b, dt').each((_, el) => {
      if (found) return;
      const heading = $(el).text().toLowerCase();
      if (keywords.some(k => heading.includes(k))) {
        const next = $(el).nextAll('p, ul, ol, div, dd').first();
        const text = next.text().trim();
        if (text.length > 10) found = text.slice(0, 400);
      }
    });
    return found;
  }

  return {
    amount: extractAmount(fullText),
    deadline: parseDeadline(fullText),
    eligibility: extractSection('eligib', 'who can apply', 'criteria', 'requirement'),
    documents: extractSection('document', 'what you need', 'required material', 'application material'),
    instructions: extractSection('how to apply', 'application process', 'apply now', 'to apply'),
    applicationUrl: extractApplicationUrl($, url),
    fullText
  };
}

const CHECKPOINT_PATH = path.join(__dirname, '..', 'data', '.deep_checkpoint.json');
const GENERIC_PLACEHOLDERS = new Set([
  'See scholarship page', 'See scholarship page for eligibility.',
  'See scholarship page for required documents.', 'Apply via the scholarship provider.',
  'See the scholarship page for application instructions.'
]);

function needsEnrichment(entry) {
  return (
    GENERIC_PLACEHOLDERS.has(entry.amount) ||
    entry.deadline === 'Unknown' ||
    GENERIC_PLACEHOLDERS.has(entry.eligibility) ||
    GENERIC_PLACEHOLDERS.has(entry.instructions)
  );
}

function mergeDetail(entry, detail) {
  if (!detail) return;
  if (detail.amount && GENERIC_PLACEHOLDERS.has(entry.amount)) entry.amount = detail.amount;
  if (detail.deadline && entry.deadline === '2027-09-01') entry.deadline = detail.deadline;
  if (detail.eligibility && GENERIC_PLACEHOLDERS.has(entry.eligibility)) entry.eligibility = detail.eligibility.slice(0, 300);
  if (detail.documents && GENERIC_PLACEHOLDERS.has(entry.documents)) entry.documents = detail.documents.slice(0, 300);
  if (detail.instructions && GENERIC_PLACEHOLDERS.has(entry.instructions)) entry.instructions = detail.instructions.slice(0, 300);
  if (detail.applicationUrl && !entry.applicationUrl) entry.applicationUrl = detail.applicationUrl;
  if (detail.fullText) {
    const betterFields = inferFields(detail.fullText);
    if (betterFields[0] !== 'Any field') entry.fields = betterFields;
    const betterLevel = inferLevels(detail.fullText);
    if (betterLevel.length < 3) entry.level = betterLevel;
  }
}

// Fetch detail pages concurrently (default 5 at a time) with checkpoint support.
async function enrichEntries(entries, { label = '', maxEntries = Infinity, concurrency = 5 } = {}) {
  // Load checkpoint — tracks which IDs have already been enriched
  let done = new Set();
  try { done = new Set(JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'))); } catch {}

  const toEnrich = entries
    .filter(e => e.url && e.url.startsWith('http'))
    .filter(e => !done.has(e.id) && needsEnrichment(e))
    .slice(0, maxEntries);

  console.log(`  [deep] ${toEnrich.length} entries need enrichment${label ? ' (' + label + ')' : ''} (${done.size} already done, skipping ${entries.length - toEnrich.length - done.size} already-rich)`);
  if (!toEnrich.length) return entries;

  let processed = 0;

  await withConcurrency(toEnrich, concurrency, async (entry) => {
    const detail = await scrapeDetailPage(entry.url);
    mergeDetail(entry, detail);
    done.add(entry.id);
    processed++;
    if (processed % 20 === 0 || processed === toEnrich.length) {
      fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify([...done]));
      console.log(`  [deep] ${processed}/${toEnrich.length} enriched`);
    }
  });

  // Clear checkpoint after full enrichment pass
  if (processed === toEnrich.length) {
    try { fs.unlinkSync(CHECKPOINT_PATH); } catch {}
  }

  return entries;
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

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function isExpired(deadline) {
  if (!deadline || deadline === 'Unknown') return false;
  const d = new Date(deadline);
  return !isNaN(d) && d < new Date();
}

async function loadExpiredIds() {
  if (!supabase) return new Set();
  const { data, error } = await supabase.from('scholarships_expired').select('id');
  if (error) { console.warn(`  [supabase] load expired ids failed: ${error.message}`); return new Set(); }
  return new Set((data || []).map(r => r.id));
}

async function runExpirePass(combined) {
  if (!supabase) return;

  const expired = combined.filter(e => isExpired(e.deadline));
  if (!expired.length) {
    console.log('Expiry pass: no newly expired entries.');
    return;
  }

  console.log(`Expiry pass: archiving ${expired.length} expired entries...`);

  const BATCH = 50;

  // 1. Copy into scholarships_expired archive
  for (let i = 0; i < expired.length; i += BATCH) {
    const batch = expired.slice(i, i + BATCH).map(entry => ({
      id: entry.id,
      title: entry.title,
      amount: entry.amount,
      deadline: entry.deadline,
      category: entry.category,
      level: entry.level,
      fields: entry.fields,
      nationality: entry.nationality,
      interests: entry.interests,
      need: entry.need,
      source: entry.source,
      url: entry.url,
      application_url: entry.applicationUrl || null,
      eligibility: entry.eligibility,
      documents: entry.documents,
      instructions: entry.instructions,
      requirement_keywords: entry.requirementKeywords,
      required_applicant_info: entry.requiredApplicantInfo,
      scrape_success: true,
      blocked: false,
      requires_login: false,
      expired: true,
      date_scraped: new Date().toISOString()
    }));
    const { error } = await supabase.from('scholarships_expired').upsert(batch, { onConflict: 'id' });
    if (error) console.warn(`  [supabase] archive batch failed: ${error.message}`);
  }

  // 2. Delete from scholarships_raw — they're archived, no longer active
  const expiredIds = expired.map(e => e.id);
  for (let i = 0; i < expiredIds.length; i += BATCH) {
    const batchIds = expiredIds.slice(i, i + BATCH);
    const { error } = await supabase.from('scholarships_raw').delete().in('id', batchIds);
    if (error) console.warn(`  [supabase] delete expired batch failed: ${error.message}`);
  }

  console.log(`Expiry pass done: ${expired.length} archived and removed from active table.`);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function upsertScholarship(entry, flags = {}) {
  if (!supabase) return true;
  const record = {
    id: entry.id,
    title: entry.title,
    amount: entry.amount,
    deadline: entry.deadline,
    category: entry.category,
    level: entry.level,
    fields: entry.fields,
    nationality: entry.nationality,
    interests: entry.interests,
    need: entry.need,
    source: entry.source,
    url: entry.url,
    application_url: entry.applicationUrl || null,
    eligibility: entry.eligibility,
    documents: entry.documents,
    instructions: entry.instructions,
    requirement_keywords: entry.requirementKeywords,
    required_applicant_info: entry.requiredApplicantInfo,
    scrape_success: flags.scrape_success ?? true,
    blocked: flags.blocked ?? false,
    requires_login: flags.requires_login ?? false,
    date_scraped: new Date().toISOString()
  };
  const { error } = await supabase.from('scholarships_raw').upsert(record, { onConflict: 'id' });
  if (error) {
    console.warn(`  [supabase] upsert failed for ${entry.id}: ${error.message}`);
    return false;
  }
  return true;
}

async function logRun(stats) {
  if (!supabase) return;
  const { error } = await supabase.from('scrape_logs').insert({
    timestamp: new Date().toISOString(),
    total_attempted: stats.attempted,
    success_count: stats.success,
    fail_count: stats.fail,
    blocked_count: stats.blocked
  });
  if (error) console.warn(`  [supabase] log run failed: ${error.message}`);
}

// ─── CLI modes ────────────────────────────────────────────────────────────────

async function scrapeUrl(url) {
  console.log(`Scraping single URL: ${url}\n`);
  const raw = await fetchPage(url);
  if (!raw) {
    console.log('Failed to fetch URL');
    return;
  }
  const html = raw.html();
  if (isLoginWall(html)) {
    console.log('Login wall detected — skipping');
    const placeholder = buildEntry({
      id: `custom-${slugify(url.slice(0, 60))}`,
      title: url,
      amount: null, deadline: null, fullText: '',
      source: new URL(url).hostname, url, eligibility: '', documents: '', instructions: ''
    });
    await upsertScholarship(placeholder, { scrape_success: false, requires_login: true });
    return;
  }
  const $ = raw;
  const results = [];
  $('h2, h3, h4').each((_, el) => {
    const title = $(el).text().trim();
    if (!title || title.length < 8 || title.length > 200) return;
    if (!/scholarship|grant|stipend|award|bursary|funding|fellowship/i.test(title)) return;
    const sibling = $(el).nextAll('p, ul, div').first();
    const fullText = title + ' ' + sibling.text();
    results.push(buildEntry({
      id: `custom-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline: parseDeadline(fullText),
      fullText,
      source: new URL(url).hostname,
      url,
      eligibility: sibling.find('p').first().text().trim() || sibling.text().trim().slice(0, 200),
      documents: '',
      instructions: 'See the scholarship page.'
    }));
  });
  console.log(`Found ${results.length} entries`);
  for (const entry of results) {
    const ok = await upsertScholarship(entry, { scrape_success: true });
    console.log(`  ${ok ? '✓' : '✗'} ${entry.title}`);
  }
}

async function scrapeList(filepath) {
  const urls = fs.readFileSync(filepath, 'utf8')
    .split('\n').map(u => u.trim()).filter(Boolean);
  console.log(`Scraping ${urls.length} URLs from ${filepath}\n`);
  for (const url of urls) {
    await scrapeUrl(url);
    await sleep(randomDelay());
  }
}

async function printStatus() {
  if (!supabase) {
    console.log('No Supabase connection — set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    return;
  }
  const r1 = await supabase.from('scholarships_raw').select('*', { count: 'exact', head: true });
  const r2 = await supabase.from('scholarships_raw').select('*', { count: 'exact', head: true }).eq('blocked', true);
  const r3 = await supabase.from('scholarships_raw').select('*', { count: 'exact', head: true }).eq('requires_login', true);
  const r6 = await supabase.from('scholarships_expired').select('*', { count: 'exact', head: true });
  const r4 = await supabase.from('scrape_logs').select('*').order('timestamp', { ascending: false }).limit(5);

  if (r1.error) console.error('  [supabase error]', r1.error.message);
  if (r4.error) console.error('  [supabase error]', r4.error.message);

  console.log('\n=== Supabase Status ===');
  console.log(`Active scholarships : ${r1.count ?? 0}`);
  console.log(`Archived (expired)  : ${r6.count ?? 0}`);
  console.log(`Blocked             : ${r2.count ?? 0}`);
  console.log(`Requires login     : ${r3.count ?? 0}`);
  console.log('\nRecent scrape logs:');
  (r4.data || []).forEach(l =>
    console.log(`  ${l.timestamp}  attempted=${l.total_attempted}  success=${l.success_count}  fail=${l.fail_count}  blocked=${l.blocked_count}`)
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Grantly Scholarship Scraper ===\n');

  // Load archived expired IDs upfront — these are permanently excluded
  const expiredIds = await loadExpiredIds();
  if (expiredIds.size) console.log(`Excluding ${expiredIds.size} previously expired scholarships\n`);

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
    scrapeKarolinska,
    scrapeSLU,
    scrapeLTU,
    scrapeBTH,
    scrapeMidSweden,
    scrapeHHS,
    scrapeHB,
    // Swedish funding agencies & foundations
    scrapeSwedishInstitute,
    scrapeStudyInSweden,
    scrapeUHR,
    scrapeNordplus,
    scrapeVetenskapsradet,
    scrapeFormas,
    scrapeVinnova,
    scrapeWallenberg,
    scrapeKKStiftelsen,
    // International aggregators (large volume)
    scrapeFulbright,
    scrapeScholarshipPositions,
    scrapeAfterSchoolAfrica,
    scrapeScholars4Dev,
    scrapeOpportunityDesk,
    // JS-rendered (Puppeteer)
    scrapeScholarshipPortalJS,
    scrapeErasmusJS,
    scrapeEuraxess,
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
    await sleep(randomDelay());
  }

  // Seed entries take priority (manually verified data)
  const seedIds = new Set(seed.map(s => s.id));
  const newEntries = scraped.filter(s => !seedIds.has(s.id));
  // Strip any entries that are already in the expired archive
  let combined = deduplicate([...seed, ...newEntries]).filter(e => !expiredIds.has(e.id));

  // --deep: follow every entry's URL and enrich with real page data
  if (args.includes('--deep')) {
    console.log('\nDeep scrape mode — following individual scholarship pages...');
    combined = await enrichEntries(combined, { label: 'all sources' });
  }

  console.log(`\nSeed: ${seed.length} | Scraped new: ${newEntries.length} | Total: ${combined.length}`);

  // Strip expired before writing JSON so they don't re-enter as seed next run
  const activeOnly = combined.filter(e => !isExpired(e.deadline)); // Unknown stays, expired goes
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(activeOnly, null, 2));
  console.log(`Saved ${activeOnly.length} active scholarships to ${OUTPUT_PATH}`);

  // Push to Supabase in batches of 50
  if (supabase) {
    console.log('\nPushing to Supabase...');
    runStats.attempted = combined.length;
    const BATCH = 50;
    for (let i = 0; i < combined.length; i += BATCH) {
      const batch = combined.slice(i, i + BATCH);
      const records = batch.map(entry => ({
        id: entry.id,
        title: entry.title,
        amount: entry.amount,
        deadline: entry.deadline,
        category: entry.category,
        level: entry.level,
        fields: entry.fields,
        nationality: entry.nationality,
        interests: entry.interests,
        need: entry.need,
        source: entry.source,
        url: entry.url,
        application_url: entry.applicationUrl || null,
        eligibility: entry.eligibility,
        documents: entry.documents,
        instructions: entry.instructions,
        requirement_keywords: entry.requirementKeywords,
        required_applicant_info: entry.requiredApplicantInfo,
        scrape_success: true,
        blocked: false,
        requires_login: false,
        date_scraped: new Date().toISOString()
      }));
      const { error } = await supabase.from('scholarships_raw').upsert(records, { onConflict: 'id' });
      if (error) {
        console.warn(`  [supabase] batch ${i / BATCH + 1} failed: ${error.message}`);
        runStats.fail += batch.length;
      } else {
        runStats.success += batch.length;
      }
    }
    await logRun(runStats);
    console.log(`Supabase: ${runStats.success} upserted, ${runStats.fail} failed, ${runStats.blocked} blocked URLs`);
    await runExpirePass(combined);
  } else {
    console.log('\nSupabase not configured — skipping push (set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env)');
  }
}

// ─── Entry point (CLI routing) ────────────────────────────────────────────────

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const listIdx = args.indexOf('--list');

if (args.includes('--status')) {
  printStatus().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else if (urlIdx !== -1 && args[urlIdx + 1]) {
  scrapeUrl(args[urlIdx + 1]).then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
} else if (listIdx !== -1 && args[listIdx + 1]) {
  scrapeList(args[listIdx + 1]).then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
} else {
  main().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
