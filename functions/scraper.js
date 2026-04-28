'use strict';

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');
const SEED_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');

// ─── Configuration ────────────────────────────────────────────────────────────

const CONCURRENCY_LIMIT = 6;          // Max sources running in parallel per batch
const ENRICH_CONCURRENCY = 5;         // Max detail-page fetches at once during enrichment
const SUPABASE_BATCH_SIZE = 50;       // Upsert batch size for Supabase

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
const failureStats = { reasons: {}, examples: [] };
const FAILURE_EXAMPLE_LIMIT = 80;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GrantlyScraper/1.0; educational research bot)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9,sv;q=0.8'
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

let sharedBrowserPromise = null;

// ─── URL helpers ──────────────────────────────────────────────────────────────

function resolveUrl(href, baseUrl) {
  if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

// ─── Retry / error helpers ────────────────────────────────────────────────────

function getRetryDelay(err, attempt, backoff) {
  const retryAfter = err.response?.headers?.['retry-after'];
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return backoff * (attempt + 1);
}

function isRedirectLimitError(err) {
  return /maximum number of redirects exceeded/i.test(err.message || '');
}

function classifyHttpFailure(status) {
  if (!status) return 'network_error';
  if (status === 401 || status === 403) return 'blocked';
  if (status === 404) return 'not_found';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return 'http_status';
}

function classifyError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  if (isRedirectLimitError(err || {})) return 'redirect_loop';
  if (message.includes('timeout') || err?.code === 'ETIMEDOUT') return 'timeout';
  if (message.includes('certificate') || message.includes('ssl') || err?.code === 'CERT_HAS_EXPIRED') return 'ssl_error';
  if (message.includes('dns') || err?.code === 'ENOTFOUND') return 'dns_error';
  if (message.includes('socket') || message.includes('econnreset') || err?.code === 'ECONNRESET') return 'connection_reset';
  if (message.includes('navigation') && message.includes('failed')) return 'browser_navigation_failed';
  return classifyHttpFailure(err?.response?.status);
}

function recordFailure(reason, context = {}) {
  const cleanReason = reason || 'unknown';
  failureStats.reasons[cleanReason] = (failureStats.reasons[cleanReason] || 0) + 1;
  if (cleanReason === 'blocked' || cleanReason === 'rate_limited') runStats.blocked++;

  if (failureStats.examples.length >= FAILURE_EXAMPLE_LIMIT) return;
  failureStats.examples.push({
    reason: cleanReason,
    source: context.source || null,
    url: context.url || null,
    status: context.status || null,
    message: String(context.message || '').slice(0, 500),
    phase: context.phase || null,
    timestamp: new Date().toISOString()
  });
}

function printFailureSummary() {
  const entries = Object.entries(failureStats.reasons).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    console.log('\nFailure summary: no scraper failures recorded.');
    return;
  }

  console.log('\n=== Failure summary ===');
  entries.forEach(([reason, count]) => console.log(`  ${reason}: ${count}`));
  console.log('\nFailure examples:');
  failureStats.examples.slice(0, 12).forEach(example => {
    const details = [
      example.source,
      example.status ? `status=${example.status}` : null,
      example.phase,
      example.url
    ].filter(Boolean).join(' | ');
    console.log(`  - ${example.reason}${details ? ` (${details})` : ''}${example.message ? `: ${example.message}` : ''}`);
  });
}

// ─── Shared Puppeteer browser ─────────────────────────────────────────────────

async function getSharedBrowser() {
  if (!sharedBrowserPromise) {
    const puppeteer = require('puppeteer');
    sharedBrowserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return sharedBrowserPromise;
}

async function closeSharedBrowser() {
  if (!sharedBrowserPromise) return;
  try {
    const browser = await sharedBrowserPromise;
    await browser.close();
  } catch {
    // Browser may already be gone; nothing to clean up.
  } finally {
    sharedBrowserPromise = null;
  }
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function fetchPage(url, { retries = 3, backoff = 2000, returnFailure = false } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
      if (isLoginWall(res.data)) {
        recordFailure('login_wall', { url, phase: 'fetch' });
        console.warn(`  [warn] Login wall detected at ${url}, skipping`);
        return returnFailure ? { failed: true, reason: 'login_wall' } : null;
      }
      return cheerio.load(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (isRedirectLimitError(err)) {
        recordFailure('redirect_loop', { url, status, message: err.message, phase: 'fetch' });
        console.warn(`  [warn] Redirect loop ${url}`);
        return returnFailure ? { failed: true, reason: 'redirect_loop' } : null;
      }
      if (status && [401, 403].includes(status)) {
        recordFailure('blocked', { url, status, message: err.message, phase: 'fetch' });
        console.warn(`  [warn] Blocked (${status}) ${url}`);
        return returnFailure ? { failed: true, reason: 'blocked', status } : null;
      }
      if (status && !RETRYABLE_STATUSES.has(status)) {
        const reason = classifyHttpFailure(status);
        recordFailure(reason, { url, status, message: err.message, phase: 'fetch' });
        console.warn(`  [warn] Failed (${status}) ${url}`);
        return returnFailure ? { failed: true, reason, status } : null;
      }
      if (attempt < retries - 1) {
        await sleep(getRetryDelay(err, attempt, backoff));
      } else {
        const reason = status === 429 ? 'rate_limited' : classifyError(err);
        recordFailure(reason, { url, status, message: err.message, phase: 'fetch' });
        console.warn(`  [warn] Failed after ${retries} attempts ${url}: ${err.message}`);
        return returnFailure ? { failed: true, reason, status } : null;
      }
    }
  }
  recordFailure('unknown', { url, phase: 'fetch' });
  return returnFailure ? { failed: true, reason: 'unknown' } : null;
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

// Puppeteer fetch for JS-rendered pages — uses the shared browser
async function fetchPageJS(url, waitSelector = null) {
  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    await acceptCookieBanners(page);
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
    }
    const html = await page.content();
    if (isLoginWall(html)) {
      recordFailure('login_wall', { url, phase: 'browser_fetch' });
      console.warn(`  [warn] Login wall detected at ${url}, skipping`);
      return null;
    }
    return cheerio.load(html);
  } catch (err) {
    recordFailure(classifyError(err), { url, message: err.message, phase: 'browser_fetch' });
    console.warn(`  [warn] Puppeteer failed for ${url}: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ─── Text-analysis helpers ────────────────────────────────────────────────────

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
  if (!text) return null;
  const months = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04',
    jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const monthPattern = Object.keys(months).join('|');

  const dmy = text.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\.?\\s+(\\d{4})`, 'i'));
  if (dmy) return `${dmy[3]}-${months[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, '0')}`;

  const mdy = text.match(new RegExp(`(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i'));
  if (mdy) return `${mdy[3]}-${months[mdy[1].toLowerCase()]}-${mdy[2].padStart(2, '0')}`;

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const ymdSlash = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ymdSlash) return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`;

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
function extractApplicationUrl($, baseUrl) {
  const applyText = /^(apply(\s+(now|here|online|today))?|start\s+application|submit\s+application|application\s+form|go\s+to\s+application|apply\s+for\s+this|apply\s+to\s+this)$/i;
  const applyHref = /[/=](apply|application|ansok|ans%C3%B6kan|ansökan|apply-now|applynow)/i;

  let found = null;

  // Pass 1: anchor text match (most reliable)
  $('a').each((_, el) => {
    if (found) return;
    const text = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (!applyText.test(text)) return;
    found = resolveUrl(href, baseUrl);
  });

  // Pass 2: href keyword match (apply/application in URL path)
  if (!found) {
    $('a').each((_, el) => {
      if (found) return;
      const href = $(el).attr('href') || '';
      if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (!applyHref.test(href)) return;
      const abs = resolveUrl(href, baseUrl);
      if (!abs || normalizeUrl(abs) === normalizeUrl(baseUrl)) return;
      found = abs;
    });
  }

  return found;
}

// ─── Entry builder ────────────────────────────────────────────────────────────

function buildEntry({ id, title, amount, deadline, fullText, source, url, eligibility, documents, instructions, applicationUrl = null }) {
  // Drop at scrape time if deadline is clearly in the past
  if (deadline && deadline !== 'Unknown') {
    const d = new Date(deadline);
    if (!isNaN(d) && d < new Date()) return null;
  }
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

// ─── Concurrency helper ───────────────────────────────────────────────────────

async function withConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ─── Generic university scraper ───────────────────────────────────────────────
// Used by most universities that share similar HTML patterns

async function scrapeUniversity({ name, prefix, pages, defaultInstructions, autoEnrich = true }) {
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
      const prevLen = results.length;

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
        const absUrl = resolveUrl(link, pageUrl) || pageUrl;

        const entry = buildEntry({
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
        });
        if (entry) results.push(entry);
      });

      if (results.length > prevLen) { scraped = true; break; }
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
        const absUrl = resolveUrl(link, pageUrl) || pageUrl;

        const entry = buildEntry({
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
        });
        if (entry) results.push(entry);
      });
    }

    console.log(`  ${name} (${pageUrl.split('/').pop() || 'root'}): ${results.length} so far`);
    await sleep(randomDelay());
  }

  // Auto-enrich small sources — visits each individual page for real data + applicationUrl
  if (autoEnrich && results.length > 0 && results.length <= 50) {
    await enrichEntries(results, { label: name, concurrency: 3 });
  }

  return results;
}

// ─── Generic blog/aggregator scraper ──────────────────────────────────────────
// Handles paginated WordPress-style blog listing sites (article > h2 > a pattern)

async function scrapeBlogAggregator({ name, prefix, baseUrl, source, maxPages, titleFilter = null, defaultInstructions = 'See the scholarship page for application instructions.', enrichAfter = false }) {
  console.log(`Scraping ${name}...`);
  const results = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = pageNum === 1 ? baseUrl : `${baseUrl}page/${pageNum}/`;
    const $ = await fetchPage(url);
    if (!$) break;

    let count = 0;
    $('article, .post').each((_, el) => {
      const titleEl = $(el).find('h2, h3, .entry-title, .post-title').first();
      const a = titleEl.find('a').first();
      const title = (a.text() || titleEl.text()).trim();
      if (!title || title.length < 8 || title.length > 200) return;

      // Optional title filter (e.g. ScholarshipPositions uses articles directly)
      if (titleFilter && !titleFilter(title)) return;

      const link = a.attr('href') || $(el).find('a').first().attr('href') || '';
      const fullText = $(el).text();
      const absUrl = resolveUrl(link, url) || url;

      const entry = buildEntry({
        id: `${prefix}-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + ' scholarship sweden',
        source,
        url: absUrl,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: defaultInstructions
      });
      if (entry) { results.push(entry); count++; }
    });

    console.log(`  ${name} page ${pageNum}: +${count} (total: ${results.length})`);
    if (count === 0) break;
    await sleep(randomDelay());
  }

  if (enrichAfter && results.length > 0) {
    await enrichEntries(results, { label: name });
  }

  return results;
}

// ─── Generic heading-based scraper ────────────────────────────────────────────
// For sites where content lives under h2/h3 headings (SI, UHR, Nordplus, etc.)

async function scrapeHeadingBased({ name, prefix, pages, source, defaultInstructions, containerSelectors = ['article', '.listing-item', '.card', '.programme-item', '.si-card', '.scholarship-card'], headingSelectors = ['h2', 'h3', 'h4', '.card__title', '.listing-item__title'], titleFilter = null, extraText = '' }) {
  console.log(`Scraping ${name}...`);
  const results = [];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    // Pass 1: container-based extraction
    $(containerSelectors.join(', ')).each((_, el) => {
      const title = $(el).find(headingSelectors.join(', ')).first().text().trim();
      if (!title || title.length < 8) return;
      if (titleFilter && !titleFilter(title)) return;

      const fullText = $(el).text() + (extraText ? ' ' + extraText : '');
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = resolveUrl(link, pageUrl) || pageUrl;

      const entry = buildEntry({
        id: `${prefix}-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText,
        source,
        url: absUrl,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: defaultInstructions
      });
      if (entry) results.push(entry);
    });

    // Pass 2 fallback: heading scan
    if (!results.length) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8) return;
        if (titleFilter && !titleFilter(title)) return;

        const fullText = title + ' ' + $(el).nextAll('p').first().text() + (extraText ? ' ' + extraText : '');
        const entry = buildEntry({
          id: `${prefix}-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline: parseDeadline(fullText),
          fullText,
          source,
          url: pageUrl,
          eligibility: $(el).nextAll('p').first().text().trim(),
          documents: '',
          instructions: defaultInstructions
        });
        if (entry) results.push(entry);
      });
    }

    console.log(`  ${name}: ${results.length} so far`);
    await sleep(randomDelay());
  }

  return results;
}

// ─── Generic Puppeteer scroll+paginate scraper ────────────────────────────────
// Used by MastersPortal, PhDPortal, ScholarshipDB, and similar JS-rendered sites

async function scrapePuppeteerPortal({ name, prefix, source, startUrl, maxScrolls = 10, maxPages = 1, itemSelectors, titleSelectors, defaultBaseUrl, extraText = '' }) {
  console.log(`Scraping ${name} (Puppeteer)...`);
  const results = [];
  const seenTitles = new Set();

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 40000 });
    await acceptCookieBanners(page);
    await sleep(2000);

    // Scroll and click "Load more" to get all items
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);
      const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button, a, [role="button"]')].find(el =>
          /load more|show more|next|meer/i.test(el.textContent.trim())
        );
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (!clicked) break;
      await sleep(2000);
    }

    const $ = cheerio.load(await page.content());
    $(itemSelectors.join(', ')).each((_, el) => {
      const tSels = titleSelectors || ['h2', 'h3', 'h4', '[class*="Title"]', '[class*="title"]'];
      const title = $(el).find(tSels.join(', ')).first().text().trim();
      if (!title || title.length < 8 || title.length > 200 || seenTitles.has(title)) return;
      seenTitles.add(title);

      const fullText = $(el).text();
      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : (defaultBaseUrl ? `${defaultBaseUrl}${link}` : resolveUrl(link, startUrl) || startUrl);

      const entry = buildEntry({
        id: `${prefix}-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + (extraText ? ' ' + extraText : ''),
        source,
        url: absUrl || startUrl,
        eligibility: $(el).find('p, [class*="desc"]').first().text().trim(),
        documents: '',
        instructions: 'Apply via the scholarship provider directly.'
      });
      if (entry) results.push(entry);
    });

    console.log(`  ${name}: ${results.length}`);
  } catch (err) {
    console.warn(`  [warn] ${name} failed: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }
  return results;
}

// ─── Link-follower helper ─────────────────────────────────────────────────────
// For sources where the listing page links to individual scholarship pages.

async function scrapeLinkFollower({ name, prefix, listPages, source, defaultInstructions, textFilter = null }) {
  console.log(`Scraping ${name} (link-follow)...`);
  const results = [];
  const seenUrls = new Set();

  for (const listUrl of listPages) {
    const $ = await fetchPage(listUrl);
    if (!$) continue;

    let origin;
    try { origin = new URL(listUrl).origin; } catch { continue; }

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const absUrl = resolveUrl(href, listUrl);
      if (!absUrl || !absUrl.startsWith(origin) || absUrl === listUrl || seenUrls.has(absUrl)) return;

      const passes = textFilter
        ? textFilter(absUrl, text)
        : text.length >= 6 && /scholarship|grant|fellow|award|stipend|program|programme|bursary/i.test(text);

      if (!passes) return;
      seenUrls.add(absUrl);

      const entry = buildEntry({
        id: `${prefix}-${slugify(text.slice(0, 80) || absUrl.split('/').filter(Boolean).pop())}`,
        title: text.slice(0, 120) || absUrl,
        amount: null,
        deadline: null,
        fullText: text + ' scholarship grant fellowship sweden',
        source,
        url: absUrl,
        eligibility: '',
        documents: '',
        instructions: defaultInstructions
      });
      if (entry) results.push(entry);
    });

    console.log(`  ${name}: ${results.length} individual pages found`);
    await sleep(randomDelay());
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE DEFINITIONS — Config-driven; no more copy-paste functions
// ═══════════════════════════════════════════════════════════════════════════════

// ─── University sources (all use scrapeUniversity) ────────────────────────────

const UNIVERSITY_SOURCES = [
  { name: 'Lund University', prefix: 'lund', pages: [
    'https://www.lunduniversity.lu.se/admissions/bachelors-and-masters-studies/scholarships-and-awards',
    'https://www.student.lth.se/english/masters-students/scholarships/',
    'https://www.medicine.lu.se/study-faculty-medicine/masters-programmes-and-advanced-courses/summer-scholarships'
  ], defaultInstructions: 'Apply via Lund University scholarship portal.' },
  { name: 'KTH Royal Institute of Technology', prefix: 'kth', pages: [
    'https://www.kth.se/en/studies/master/admissions/scholarships/kth-scholarship-1.72827'
  ], defaultInstructions: 'Apply through KTH scholarship system during application period.' },
  { name: 'Uppsala University', prefix: 'uu', pages: [
    'https://www.uu.se/en/study/masters-studies/scholarships'
  ], defaultInstructions: 'Apply through Uppsala University admissions portal.' },
  { name: 'Stockholm University', prefix: 'su', pages: [
    'https://www.su.se/english/education/how-to-apply/costs-fees-and-scholarships/scholarships'
  ], defaultInstructions: 'Apply via Stockholm University scholarship application.' },
  { name: 'Chalmers University of Technology', prefix: 'chalmers', pages: [
    'https://www.chalmers.se/en/education/application-and-admission/scholarships-for-fee-paying-students/'
  ], defaultInstructions: 'Apply through Chalmers University scholarship portal.' },
  { name: 'University of Gothenburg', prefix: 'gu', pages: [
    'https://www.gu.se/en/study-in-gothenburg/apply/scholarships-for-fee-paying-students'
  ], defaultInstructions: 'Apply through University of Gothenburg scholarship system.' },
  { name: 'Linköping University', prefix: 'liu', pages: [
    'https://liu.se/en/article/scholarships'
  ], defaultInstructions: 'Apply via Linköping University international office.' },
  { name: 'Umeå University', prefix: 'umu', pages: [
    'https://www.umu.se/en/education/application-and-admission/scholarships/'
  ], defaultInstructions: 'Apply through Umeå University scholarship portal.' },
  { name: 'Malmö University', prefix: 'mau', pages: [
    'https://mau.se/en/education/scholarships/'
  ], defaultInstructions: 'Apply via Malmö University scholarship programme.' },
  { name: 'Örebro University', prefix: 'oru', pages: [
    'https://www.oru.se/english/study/master-students/scholarships/oruscholarship/'
  ], defaultInstructions: 'Apply via Örebro University international office.' },
  { name: 'Jönköping University', prefix: 'ju', pages: [
    'https://ju.se/en/study-at-ju/application-and-admission/scholarships-and-funding.html'
  ], defaultInstructions: 'Apply through Jönköping University scholarship system.' },
  { name: 'Karlstad University', prefix: 'kau', pages: [
    'https://www.kau.se/en/education/explore-student-life/application-admission/scholarships'
  ], defaultInstructions: 'Apply through Karlstad University scholarship portal.' },
  { name: 'Södertörn University', prefix: 'sh', pages: [
    'https://www.sh.se/english/sodertorn-university/student/prospective-students/scholarships'
  ], defaultInstructions: 'Apply via Södertörn University international office.' },
  { name: 'Mälardalen University', prefix: 'mdu', pages: [
    'https://www.mdu.se/en/malardalen-university/education/international/application-and-admission/malardalen-university-scholarship-programme'
  ], defaultInstructions: 'Apply through Mälardalen University scholarship programme.' },
  { name: 'Halmstad University', prefix: 'hh', pages: [
    'https://www.hh.se/english/education/apply-to-halmstad-university/scholarships.html'
  ], defaultInstructions: 'Apply via Halmstad University scholarship portal.' },
  { name: 'Karolinska Institutet', prefix: 'ki', pages: [
    'https://education.ki.se/scholarships'
  ], defaultInstructions: 'Apply through Karolinska Institutet scholarship portal.' },
  { name: 'Swedish University of Agricultural Sciences', prefix: 'slu', pages: [
    'https://www.slu.se/en/study/application-and-admission/tuition-fees-and-scholarships/scholarships/'
  ], defaultInstructions: 'Apply through SLU scholarship portal.' },
  { name: 'Luleå University of Technology', prefix: 'ltu', pages: [
    'https://www.ltu.se/en/study/fees-and-scholarships'
  ], defaultInstructions: 'Apply through Luleå University scholarship portal.' },
  { name: 'Blekinge Institute of Technology', prefix: 'bth', pages: [
    'https://www.bth.se/english/education/application-and-admission/scholarships'
  ], defaultInstructions: 'Apply through BTH scholarship portal.' },
  { name: 'Mid Sweden University', prefix: 'miun', pages: [
    'https://www.miun.se/en/education/meet-mid-sweden-university/Fees-and-scholarships/Scholarship/Tuition-fee-Scholarship-Mid-Sweden-University-/'
  ], defaultInstructions: 'Apply through Mid Sweden University scholarship portal.' },
  { name: 'Stockholm School of Economics', prefix: 'hhs', pages: [
    'https://www.hhs.se/en/education/study-at-sse/tuition-and-fees/'
  ], defaultInstructions: 'Apply through Stockholm School of Economics scholarship portal.' },
  { name: 'University of Borås', prefix: 'hb', pages: [
    'https://www.hb.se/en/international-student/fees-and-scholarships/scholarships/'
  ], defaultInstructions: 'Apply through University of Borås scholarship portal.' },
  { name: 'Dalarna University', prefix: 'du', pages: [
    'https://www.du.se/en/study-at-du/scholarships/'
  ], defaultInstructions: 'Apply through Dalarna University scholarship portal.' },
  { name: 'Kristianstad University', prefix: 'hkr', pages: [
    'https://www.hkr.se/en/study-at-hkr/scholarships/'
  ], defaultInstructions: 'Apply through Kristianstad University scholarship portal.' },
  { name: 'Linnaeus University', prefix: 'lnu', pages: [
    'https://lnu.se/en/study-at-lnu/before-you-apply/scholarships-and-fees/scholarships/'
  ], defaultInstructions: 'Apply through Linnaeus University scholarship portal.' },
  { name: 'University of Gävle', prefix: 'hig', pages: [
    'https://www.hig.se/Ext/En/University-of-Gavle/About-us/Scholarships.html'
  ], defaultInstructions: 'Apply through University of Gävle scholarship portal.' },
  { name: 'University of Skövde', prefix: 'his', pages: [
    'https://www.his.se/en/study/scholarships/'
  ], defaultInstructions: 'Apply through University of Skövde scholarship portal.' },
  // Funding agencies & foundations (same HTML structure)
  { name: 'Swedish Research Council', prefix: 'vr', pages: [
    'https://www.vr.se/english/applying-for-funding/calls-and-decisions.html'
  ], defaultInstructions: 'Apply via the Swedish Research Council application portal PRISMA.' },
  { name: 'Formas', prefix: 'formas', pages: [
    'https://formas.se/en/start-page/apply-for-funding/all-calls.html'
  ], defaultInstructions: 'Apply via Formas e-application system.' },
  { name: 'Vinnova', prefix: 'vinnova', pages: [
    'https://www.vinnova.se/en/apply-for-funding/find-the-right-funding/'
  ], defaultInstructions: "Apply via Vinnova's online application system." },
  { name: 'Wallenberg Foundations', prefix: 'wallenberg', pages: [
    'https://kaw.wallenberg.org/en/grants'
  ], defaultInstructions: 'Apply through the Wallenberg foundation portal.' },
  { name: 'KK-stiftelsen', prefix: 'kk', pages: [
    'https://www.kks.se/en/funding-and-assessment/applying-for-funding/'
  ], defaultInstructions: "Apply through KK-stiftelsen's application portal." }
];

// ─── Blog aggregator sources (all use scrapeBlogAggregator) ───────────────────

const BLOG_SOURCES = [
  { name: 'Scholarship Positions', prefix: 'spos', baseUrl: 'https://scholarship-positions.com/category/sweden-scholarships/', source: 'Scholarship Positions', maxPages: 70 },
  { name: 'Scholars4Dev', prefix: 's4d', baseUrl: 'https://www.scholars4dev.com/category/country/europe-scholarships/sweden/', source: 'Scholars4Dev', maxPages: 25 },
  { name: 'Opportunity Desk', prefix: 'od', baseUrl: 'https://opportunitydesk.org/category/scholarships/page/1/?fwp_location=sweden', source: 'Opportunity Desk', maxPages: 20, customPagination: pageNum => `https://opportunitydesk.org/category/scholarships/page/${pageNum}/?fwp_location=sweden` },
  { name: 'World Scholarship Forum', prefix: 'wsf', baseUrl: 'https://worldscholarshipforum.com/scholarships-in-sweden/', source: 'World Scholarship Forum', maxPages: 20 },
  { name: 'Scholarship Desk', prefix: 'sd', baseUrl: 'https://www.scholarshipdesk.com/tag/sweden-scholarships/', source: 'Scholarship Desk', maxPages: 15 },
  { name: 'Scholarship Region', prefix: 'sr', baseUrl: 'https://www.scholarshipregion.com/category/sweden-scholarships/', source: 'Scholarship Region', maxPages: 15 }
];

// ─── Puppeteer portal sources (all use scrapePuppeteerPortal) ─────────────────

const PUPPETEER_PORTAL_SOURCES = [
  {
    name: 'MastersPortal', prefix: 'mp', source: 'MastersPortal',
    startUrl: 'https://www.mastersportal.eu/scholarships/?countries=se',
    maxScrolls: 15, defaultBaseUrl: 'https://www.mastersportal.eu',
    itemSelectors: ['article', '[class*="ScholarshipItem"]', '[class*="scholarship-item"]', '[class*="ResultItem"]', 'li[class*="item"]'],
    extraText: 'scholarship sweden masters'
  },
  {
    name: 'PhDPortal', prefix: 'phd', source: 'PhDPortal',
    startUrl: 'https://www.phdportal.eu/scholarships/?countries=se',
    maxScrolls: 10, defaultBaseUrl: 'https://www.phdportal.eu',
    itemSelectors: ['article', '[class*="ScholarshipItem"]', '[class*="scholarship-item"]', '[class*="ResultItem"]', 'li[class*="item"]'],
    extraText: 'scholarship sweden phd doctoral'
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM SOURCES — ones with unique scraping logic that can't be config-driven
// ═══════════════════════════════════════════════════════════════════════════════

async function scrapeSwedishInstitute() {
  return scrapeHeadingBased({
    name: 'Swedish Institute', prefix: 'si', source: 'Swedish Institute',
    pages: [
      'https://si.se/en/apply/scholarships/',
      'https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals-sisgp/',
      'https://si.se/en/apply/scholarships/swedish-institute-study-scholarships/'
    ],
    defaultInstructions: 'Apply through the Swedish Institute application portal.'
  });
}

async function scrapeStudyInSweden() {
  console.log('Scraping Study in Sweden...');
  const results = [];
  const pageUrl = 'https://studyinsweden.se/scholarships/';
  const $ = await fetchPage(pageUrl);
  if (!$) return results;

  $('li[class*="scholarship"], li[class*="Scholarship"]').each((_, el) => {
    const a = $(el).find('a').first();
    const title = a.text().replace('↗️', '').trim();
    if (!title || title.length < 8) return;

    const link = a.attr('href') || '';
    const absUrl = resolveUrl(link, pageUrl) || pageUrl;
    const category = $(el).find('span').first().text().trim();
    const fullText = category + ' ' + title + ' scholarship Sweden';

    const entry = buildEntry({
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
    });
    if (entry) results.push(entry);
  });

  console.log(`  study in sweden: ${results.length}`);
  return results;
}

async function scrapeUHR() {
  return scrapeHeadingBased({
    name: 'UHR', prefix: 'uhr', source: 'UHR – Swedish Council for Higher Education',
    pages: ['https://www.uhr.se/en/start/international-opportunities/'],
    defaultInstructions: 'Apply via UHR or the respective programme administrator.',
    titleFilter: title => /scholarship|grant|stipend|award|bursary/i.test(title)
  });
}

async function scrapeNordplus() {
  return scrapeHeadingBased({
    name: 'Nordplus', prefix: 'nordplus', source: 'Nordplus',
    pages: [
      'https://www.nordplusonline.org/programmes',
      'https://www.nordplusonline.org/programmes/nordplus-higher-education'
    ],
    containerSelectors: ['article', '.card', '.programme-card', '.listing-item', '.programme'],
    headingSelectors: ['h2', 'h3', 'h4', '.title', '.card-title'],
    defaultInstructions: "Apply through your home institution's international office.",
    extraText: 'exchange travel nordic international student'
  });
}

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
      const absUrl = resolveUrl(link, url) || url;
      const sibling = $(el).nextAll('p').first().text();
      const fullText = title + ' ' + sibling + ' scholarship sweden international';

      const entry = buildEntry({
        id: `asa-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText,
        source: 'AfterSchoolAfrica',
        url: absUrl,
        eligibility: sibling.slice(0, 200) || 'See scholarship page for eligibility.',
        documents: '',
        instructions: 'See the scholarship page for application instructions.'
      });
      if (entry) { results.push(entry); pageCount++; }
    });

    console.log(`  afterschoolafrica page ${pageNum}: +${pageCount} (total: ${results.length})`);
    if (pageCount === 0) break;
    await sleep(randomDelay());
  }

  // Always deep-scrape — detail pages have real data
  await enrichEntries(results, { label: 'AfterSchoolAfrica' });
  return results;
}

// ─── ScholarshipDB (Puppeteer — paginated via URL) ───────────────────────────

async function scrapeScholarshipDB() {
  console.log('Scraping ScholarshipDB (Puppeteer)...');
  const results = [];
  const seenTitles = new Set();

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
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

        const $ = cheerio.load(await page.content());
        let pageCount = 0;

        $('li.list-group-item, .scholarship-item, article, [class*="scholarship"]').each((_, el) => {
          const a = $(el).find('a').first();
          const title = a.text().trim() || $(el).find('h2,h3,h4,.title').first().text().trim();
          if (!title || title.length < 8 || title.length > 200 || seenTitles.has(title)) return;
          seenTitles.add(title);

          const fullText = $(el).text();
          const link = a.attr('href') || '';
          const absUrl = resolveUrl(link, url) || url;

          const entry = buildEntry({
            id: `sdb-${slugify(title)}`,
            title,
            amount: extractAmount(fullText),
            deadline: parseDeadline(fullText),
            fullText,
            source: 'ScholarshipDB',
            url: absUrl,
            eligibility: $(el).find('p, .description, small').first().text().trim(),
            documents: '',
            instructions: 'Apply via the scholarship provider directly.'
          });
          if (entry) { results.push(entry); pageCount++; }
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
    if (page) await page.close().catch(() => {});
  }

  console.log(`  scholarshipdb total: ${results.length}`);
  return results;
}

// ─── Scholarship Portal (Puppeteer — paginated via clicks) ────────────────────

function extractScholarshipPortalEntries($, seenTitles) {
  const entries = [];
  $('[class*="ScholarshipCard"], [class*="scholarship-card"], [class*="scholarshipCard"], article, [class*="ResultCard"], [class*="result-card"]').each((_, el) => {
    const title = $(el).find('h2, h3, h4, [class*="title"], [class*="Title"], [class*="name"], [class*="Name"]').first().text().trim();
    if (!title || title.length < 8 || title.length > 150 || seenTitles.has(title)) return;
    seenTitles.add(title);

    const fullText = $(el).text();
    const link = $(el).find('a').first().attr('href') || '';
    const absUrl = resolveUrl(link, 'https://www.scholarshipportal.com/scholarships/search?destinationCountry=se')
      || 'https://www.scholarshipportal.com/scholarships/search?destinationCountry=se';

    const entry = buildEntry({
      id: `sp-${slugify(title)}`,
      title,
      amount: extractAmount(fullText),
      deadline: parseDeadline(fullText),
      fullText,
      source: 'Scholarship Portal',
      url: absUrl,
      eligibility: $(el).find('p, [class*="description"], [class*="desc"]').first().text().trim(),
      documents: '',
      instructions: 'Apply via the scholarship provider directly.'
    });
    if (entry) entries.push(entry);
  });
  return entries;
}

async function scrapeScholarshipPortalJS() {
  console.log('Scraping Scholarship Portal (Puppeteer)...');
  const results = [];
  const seenTitles = new Set();
  const baseUrl = 'https://www.scholarshipportal.com/scholarships/search?destinationCountry=se';

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    await acceptCookieBanners(page);
    await sleep(2000);

    for (let pageNum = 1; pageNum <= 15; pageNum++) {
      try {
        await page.waitForSelector('[class*="ScholarshipCard"], [class*="scholarship-card"], [class*="ResultCard"], article', { timeout: 10000 }).catch(() => {});
        await sleep(1500);

        const $ = cheerio.load(await page.content());
        const pageEntries = extractScholarshipPortalEntries($, seenTitles);
        results.push(...pageEntries);

        console.log(`  scholarship portal page ${pageNum}: +${pageEntries.length} new (total: ${results.length})`);

        // Try to click Next page button
        const nextClicked = await page.evaluate(() => {
          const selectors = [
            '[aria-label="Next page"]', '[aria-label="next"]',
            'button[class*="next"]', 'a[class*="next"]',
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

        if (!nextClicked || pageEntries.length === 0) break;
        await sleep(randomDelay());
      } catch (err) {
        console.warn(`  [warn] ScholarshipPortal page ${pageNum}: ${err.message}`);
        break;
      }
    }
  } catch (err) {
    console.warn(`  [warn] Puppeteer not available for ScholarshipPortal: ${err.message}`);
    const $ = await fetchPage(baseUrl);
    if ($) results.push(...extractScholarshipPortalEntries($, seenTitles));
  } finally {
    if (page) await page.close().catch(() => {});
  }

  console.log(`  scholarship portal total: ${results.length}`);
  return results;
}

// ─── Erasmus+ (Puppeteer) ─────────────────────────────────────────────────────

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
      const absUrl = resolveUrl(link, pageUrl) || pageUrl;

      const entry = buildEntry({
        id: `erasmus-${slugify(title)}`,
        title,
        amount: extractAmount(fullText) || 'Monthly grant (varies by country pair)',
        deadline: parseDeadline(fullText),
        fullText: fullText + ' exchange travel international EU/EEA student',
        source: 'Erasmus+',
        url: absUrl,
        eligibility: $(el).find('p').first().text().trim() || 'EU/EEA students at participating institutions.',
        documents: 'Learning agreement, transcript, enrolment certificate.',
        instructions: "Apply through your home university's international office."
      });
      if (entry) results.push(entry);
    });

    // Fallback: heading scan
    if (!results.length) {
      $('h2, h3').each((_, el) => {
        const title = $(el).text().trim();
        if (!title || title.length < 8) return;
        const fullText = title + ' exchange travel international EU/EEA student ' + $(el).nextAll('p').first().text();
        const entry = buildEntry({
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
        });
        if (entry) results.push(entry);
      });
    }

    console.log(`  erasmus+: ${results.length} so far`);
    await sleep(randomDelay());
  }

  return results;
}

// ─── Euraxess (Puppeteer) ─────────────────────────────────────────────────────

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
      const absUrl = resolveUrl(link, pageUrl) || pageUrl;

      const entry = buildEntry({
        id: `euraxess-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + ' research grant fellowship sweden',
        source: 'Euraxess',
        url: absUrl,
        eligibility: $(el).find('p, .field-content').first().text().trim(),
        documents: '',
        instructions: 'Apply through Euraxess or the hosting institution.'
      });
      if (entry) results.push(entry);
    });

    console.log(`  euraxess: ${results.length} so far`);
    await sleep(randomDelay());
  }

  return results;
}

// ─── Academic Positions (Puppeteer — paginated) ───────────────────────────────

async function scrapeAcademicPositions() {
  console.log('Scraping AcademicPositions.eu...');
  const results = [];
  const seenUrls = new Set();

  const listUrls = [
    'https://academicpositions.eu/jobs/search?country%5B%5D=Sweden&type%5B%5D=phd',
    'https://academicpositions.eu/jobs/search?country%5B%5D=Sweden&type%5B%5D=scholarship',
    'https://academicpositions.eu/jobs/search?country%5B%5D=Sweden&type%5B%5D=postdoc'
  ];

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);

    for (const listUrl of listUrls) {
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 40000 });
      await acceptCookieBanners(page);
      await sleep(2000);

      for (let p = 1; p <= 10; p++) {
        const $ = cheerio.load(await page.content());
        let count = 0;

        $('article, .job-item, [class*="position"], [class*="JobCard"], li[class*="item"]').each((_, el) => {
          const title = $(el).find('h2, h3, h4, [class*="title"], [class*="Title"]').first().text().trim();
          if (!title || title.length < 8 || title.length > 200) return;

          const link = $(el).find('a').first().attr('href') || '';
          const absUrl = link.startsWith('http') ? link : `https://academicpositions.eu${link}`;
          if (seenUrls.has(absUrl)) return;
          seenUrls.add(absUrl);

          const fullText = $(el).text();
          const entry = buildEntry({
            id: `ap-${slugify(title)}`,
            title,
            amount: extractAmount(fullText) || 'Funded position (salary/stipend)',
            deadline: parseDeadline(fullText),
            fullText: fullText + ' scholarship fellowship sweden funded position',
            source: 'Academic Positions',
            url: absUrl,
            eligibility: $(el).find('p, [class*="desc"]').first().text().trim(),
            documents: '',
            instructions: 'Apply directly through the Academic Positions portal.'
          });
          if (entry) { results.push(entry); count++; }
        });

        console.log(`  academic positions (${listUrl.split('=').pop()}) page ${p}: +${count}`);
        if (count === 0) break;

        const nextClicked = await page.evaluate(() => {
          const btn = document.querySelector('[aria-label="Next"], [class*="next"], a[rel="next"]');
          if (btn && !btn.disabled) { btn.click(); return true; }
          return false;
        });
        if (!nextClicked) break;
        await sleep(2000);
      }
    }
  } catch (err) {
    console.warn(`  [warn] AcademicPositions failed: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  console.log(`  academic positions total: ${results.length}`);
  return results;
}

// ─── Fulbright (link-follower + enrichment) ───────────────────────────────────

async function scrapeFulbright() {
  const results = await scrapeLinkFollower({
    name: 'Fulbright Sweden',
    prefix: 'fulbright',
    listPages: ['https://www.fulbright.se/grants/'],
    source: 'Fulbright Sweden',
    defaultInstructions: 'Apply through the Fulbright Sweden application portal.'
  });
  await enrichEntries(results, { label: 'Fulbright', concurrency: 3 });
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEP SCRAPING — follow links to individual scholarship pages
// ═══════════════════════════════════════════════════════════════════════════════

async function scrapeDetailPage(url) {
  const $ = await fetchPage(url, { returnFailure: true });
  if (!$ || $.failed) return { unreachable: true, reason: $?.reason, status: $?.status };

  const fullText = $('body').text();

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
    GENERIC_PLACEHOLDERS.has(entry.instructions) ||
    !entry.applicationUrl
  );
}

function mergeDetail(entry, detail) {
  if (!detail) return;
  if (detail.unreachable) {
    entry.scrapeSuccess = false;
    entry.unreachable = true;
    entry.unreachableReason = detail.reason || 'fetch_failed';
    if (detail.status) entry.unreachableStatus = detail.status;
    return;
  }
  if (detail.amount && GENERIC_PLACEHOLDERS.has(entry.amount)) entry.amount = detail.amount;
  if (detail.deadline && (!entry.deadline || entry.deadline === 'Unknown')) entry.deadline = detail.deadline;
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

async function enrichEntries(entries, { label = '', maxEntries = Infinity, concurrency = ENRICH_CONCURRENCY, force = false } = {}) {
  let done = new Set();
  try { done = new Set(JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'))); } catch {}

  const toEnrich = entries
    .filter(Boolean)
    .filter(e => e.url && e.url.startsWith('http'))
    .filter(e => !done.has(e.id) && (force || needsEnrichment(e)))
    .slice(0, maxEntries);

  const skipped = Math.max(0, entries.length - toEnrich.length - done.size);
  console.log(`  [deep] ${toEnrich.length} entries need enrichment${label ? ' (' + label + ')' : ''} (${done.size} already done, skipping ${skipped} already-rich)`);
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

function mergeEntryFields(target, source) {
  const fields = [
    'amount', 'deadline', 'eligibility', 'documents', 'instructions',
    'applicationUrl', 'url'
  ];
  for (const field of fields) {
    const current = target[field];
    const next = source[field];
    const currentIsGeneric = !current || current === 'Unknown' || GENERIC_PLACEHOLDERS.has(current);
    if (next && currentIsGeneric) target[field] = next;
  }

  for (const field of ['requirementKeywords', 'requiredApplicantInfo']) {
    const merged = [...new Set([...(target[field] || []), ...(source[field] || [])])];
    if (merged.length) target[field] = merged.slice(0, 8);
  }

  if (source.unreachable) {
    target.unreachable = true;
    target.unreachableReason = source.unreachableReason;
    target.unreachableStatus = source.unreachableStatus;
    target.scrapeSuccess = false;
  }
}

function deduplicate(entries) {
  const seen = new Map();
  const aliases = new Map();

  for (const entry of entries.filter(Boolean)) {
    const keys = [entry.id, normalizeUrl(entry.url)].filter(Boolean);
    const existingKey = keys.map(key => aliases.get(key) || key).find(key => seen.has(key));

    if (existingKey) {
      mergeEntryFields(seen.get(existingKey), entry);
      keys.forEach(key => aliases.set(key, existingKey));
      continue;
    }

    const primaryKey = keys[0];
    seen.set(primaryKey, entry);
    keys.forEach(key => aliases.set(key, primaryKey));
  }

  return Array.from(seen.values());
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function isExpired(deadline) {
  if (!deadline || deadline === 'Unknown') return false;
  const d = new Date(`${deadline}T23:59:59`);
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

  // 1. Copy into scholarships_expired archive
  for (let i = 0; i < expired.length; i += SUPABASE_BATCH_SIZE) {
    const batch = expired.slice(i, i + SUPABASE_BATCH_SIZE).map(entry => toSupabaseRecord(entry, { expired: true }));
    const { error } = await supabase.from('scholarships_expired').upsert(batch, { onConflict: 'id' });
    if (error) console.warn(`  [supabase] archive batch failed: ${error.message}`);
  }

  // 2. Delete from scholarships_raw
  const expiredIds = expired.map(e => e.id);
  for (let i = 0; i < expiredIds.length; i += SUPABASE_BATCH_SIZE) {
    const batchIds = expiredIds.slice(i, i + SUPABASE_BATCH_SIZE);
    const { error } = await supabase.from('scholarships_raw').delete().in('id', batchIds);
    if (error) console.warn(`  [supabase] delete expired batch failed: ${error.message}`);
  }

  console.log(`Expiry pass done: ${expired.length} archived and removed from active table.`);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function toSupabaseRecord(entry, flags = {}) {
  return {
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
    application_url: entry.applicationUrl || entry.application_url || null,
    eligibility: entry.eligibility,
    documents: entry.documents,
    instructions: entry.instructions,
    requirement_keywords: entry.requirementKeywords || entry.requirement_keywords || [],
    required_applicant_info: entry.requiredApplicantInfo || entry.required_applicant_info || [],
    scrape_success: flags.scrape_success ?? entry.scrapeSuccess ?? entry.scrape_success ?? true,
    blocked: flags.blocked ?? entry.blocked ?? entry.unreachableReason === 'blocked',
    requires_login: flags.requires_login ?? entry.requires_login ?? entry.unreachableReason === 'login_wall',
    expired: flags.expired ?? entry.expired ?? false,
    date_scraped: new Date().toISOString()
  };
}

async function pushEntriesToSupabase(entries, { table = 'scholarships_raw', label = 'entries', stats = null, flags = {} } = {}) {
  if (!supabase) {
    console.log(`\nSupabase not configured - skipping ${label} push (set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env)`);
    return { success: 0, fail: entries.length };
  }

  const validEntries = entries.filter(entry => entry && entry.id && entry.title);
  const skipped = entries.length - validEntries.length;
  if (skipped) console.warn(`  [supabase] skipped ${skipped} ${label} with missing id/title`);

  console.log(`\nPushing ${validEntries.length} ${label} to ${table}...`);
  let success = 0;
  let fail = 0;

  for (let i = 0; i < validEntries.length; i += SUPABASE_BATCH_SIZE) {
    const batch = validEntries.slice(i, i + SUPABASE_BATCH_SIZE);
    const records = batch.map(entry => toSupabaseRecord(entry, flags));
    const { error } = await supabase.from(table).upsert(records, { onConflict: 'id' });

    if (error) {
      recordFailure('supabase_upsert_failed', {
        source: table,
        message: error.message,
        phase: 'supabase_upsert'
      });
      console.warn(`  [supabase] ${table} batch ${i / SUPABASE_BATCH_SIZE + 1} failed: ${error.message}`);
      fail += batch.length;
    } else {
      success += batch.length;
    }
  }

  if (stats) {
    stats.attempted += validEntries.length;
    stats.success += success;
    stats.fail += fail + skipped;
  }

  console.log(`Supabase ${table}: ${success} upserted, ${fail + skipped} failed/skipped`);
  return { success, fail: fail + skipped };
}

async function logRun(stats) {
  if (!supabase) return;
  const { error } = await supabase.from('scrape_logs').insert({
    timestamp: new Date().toISOString(),
    total_attempted: stats.attempted,
    success_count: stats.success,
    fail_count: stats.fail,
    blocked_count: stats.blocked,
    failure_reasons: failureStats.reasons,
    failure_examples: failureStats.examples.slice(0, 20)
  });
  if (error) console.warn(`  [supabase] log run failed: ${error.message}`);

  if (!failureStats.examples.length) return;
  const { error: failureError } = await supabase.from('scrape_failures').insert(
    failureStats.examples.map(example => ({
      reason: example.reason,
      source: example.source,
      url: example.url,
      status: example.status,
      message: example.message,
      phase: example.phase,
      created_at: example.timestamp
    }))
  );
  if (failureError) console.warn(`  [supabase] failure detail log failed: ${failureError.message}`);
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
    if (placeholder && supabase) {
      await pushEntriesToSupabase([placeholder], { label: 'login-wall entry', flags: { scrape_success: false, requires_login: true } });
    }
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
    const entry = buildEntry({
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
    });
    if (entry) results.push(entry);
  });
  console.log(`Found ${results.length} entries`);
  if (results.length && supabase) {
    await pushEntriesToSupabase(results, { label: 'custom URL entries', flags: { scrape_success: true } });
  }
  results.forEach(e => console.log(`  ✓ ${e.title}`));
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
  const [r1, r2, r3, r6, r4] = await Promise.all([
    supabase.from('scholarships_raw').select('*', { count: 'exact', head: true }),
    supabase.from('scholarships_raw').select('*', { count: 'exact', head: true }).eq('blocked', true),
    supabase.from('scholarships_raw').select('*', { count: 'exact', head: true }).eq('requires_login', true),
    supabase.from('scholarships_expired').select('*', { count: 'exact', head: true }),
    supabase.from('scrape_logs').select('*').order('timestamp', { ascending: false }).limit(5)
  ]);

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
  const latestWithReasons = (r4.data || []).find(l => l.failure_reasons);
  if (latestWithReasons?.failure_reasons) {
    console.log('\nLatest failure reason counts:');
    Object.entries(latestWithReasons.failure_reasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => console.log(`  ${reason}: ${count}`));
  }
}

async function pushJsonToSupabase() {
  const entries = loadSeed();
  const activeOnly = entries.filter(e => !isExpired(e.deadline));
  const expired = entries.filter(e => isExpired(e.deadline));

  console.log(`Loaded ${entries.length} scholarships from ${SEED_PATH}`);
  const activeResult = await pushEntriesToSupabase(activeOnly, { label: 'JSON active scholarships' });
  let expiredResult = { success: 0, fail: 0 };

  if (expired.length) {
    expiredResult = await pushEntriesToSupabase(expired, {
      table: 'scholarships_expired',
      label: 'JSON expired scholarships',
      flags: { expired: true }
    });
  }

  await logRun({
    attempted: entries.length,
    success: activeResult.success + expiredResult.success,
    fail: activeResult.fail + expiredResult.fail,
    blocked: 0
  });
  printFailureSummary();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Grantly Scholarship Scraper ===\n');

  const expiredIds = await loadExpiredIds();
  if (expiredIds.size) console.log(`Excluding ${expiredIds.size} previously expired scholarships\n`);

  const seed = loadSeed();
  console.log(`Loaded ${seed.length} seed scholarships\n`);

  // ── Build source list ─────────────────────────────────────────────────────
  // Config-driven university sources
  const universityFns = UNIVERSITY_SOURCES.map(cfg => () => scrapeUniversity(cfg));

  // Config-driven blog aggregators
  const blogFns = BLOG_SOURCES.map(cfg => () => {
    // Support custom pagination URL patterns (e.g. Opportunity Desk with query params)
    if (cfg.customPagination) {
      return scrapeBlogAggregatorCustomUrl(cfg);
    }
    return scrapeBlogAggregator(cfg);
  });

  // Config-driven Puppeteer portals
  const portalFns = PUPPETEER_PORTAL_SOURCES.map(cfg => () => scrapePuppeteerPortal(cfg));

  // Custom sources with unique logic
  const customFns = [
    scrapeSwedishInstitute,
    scrapeStudyInSweden,
    scrapeUHR,
    scrapeNordplus,
    scrapeFulbright,
    scrapeAfterSchoolAfrica,
    scrapeScholarshipDB,
    scrapeScholarshipPortalJS,
    scrapeErasmusJS,
    scrapeEuraxess,
    scrapeAcademicPositions
  ];

  const allSourceFns = [...universityFns, ...blogFns, ...portalFns, ...customFns];

  // ── Run sources in parallel batches ───────────────────────────────────────
  const scraped = [];
  console.log(`Running ${allSourceFns.length} sources in batches of ${CONCURRENCY_LIMIT}...\n`);

  for (let i = 0; i < allSourceFns.length; i += CONCURRENCY_LIMIT) {
    const batch = allSourceFns.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.allSettled(batch.map(fn => fn()));

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const entries = (result.value || []).filter(Boolean);
        console.log(`  -> ${entries.length} scholarships\n`);
        scraped.push(...entries);
      } else {
        recordFailure(classifyError(result.reason), {
          message: result.reason?.message || result.reason,
          phase: 'source'
        });
        console.error(`  [error] ${result.reason?.message || result.reason}\n`);
      }
    }

    // Brief pause between batches to be polite
    if (i + CONCURRENCY_LIMIT < allSourceFns.length) {
      await sleep(randomDelay());
    }
  }

  // Seed entries take priority (manually verified data)
  const seedIds = new Set(seed.map(s => s.id));
  const newEntries = scraped.filter(s => !seedIds.has(s.id));
  let combined = deduplicate([...seed, ...newEntries]).filter(e => !expiredIds.has(e.id));

  // --deep: follow every entry's URL and enrich with real page data
  if (args.includes('--deep')) {
    console.log('\nDeep scrape mode — following individual scholarship pages...');
    combined = await enrichEntries(combined, { label: 'all sources', force: true });
  }

  console.log(`\nSeed: ${seed.length} | Scraped new: ${newEntries.length} | Total: ${combined.length}`);

  // Strip expired before writing JSON
  const activeOnly = combined.filter(e => !isExpired(e.deadline));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(activeOnly, null, 2));
  console.log(`Saved ${activeOnly.length} active scholarships to ${OUTPUT_PATH}`);

  // Push to Supabase — reuse the existing helper instead of duplicating logic
  if (supabase) {
    console.log('\nPushing to Supabase...');
    const result = await pushEntriesToSupabase(combined, { label: 'all scholarships', stats: runStats });
    await logRun(runStats);
    console.log(`Supabase: ${result.success} upserted, ${result.fail} failed, ${runStats.blocked} blocked URLs`);
    await runExpirePass(combined);
  } else {
    console.log('\nSupabase not configured — skipping push (set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env)');
  }

  printFailureSummary();
  await closeSharedBrowser();
}

// Helper for blog aggregators with custom pagination URL patterns
async function scrapeBlogAggregatorCustomUrl(cfg) {
  console.log(`Scraping ${cfg.name}...`);
  const results = [];

  for (let pageNum = 1; pageNum <= cfg.maxPages; pageNum++) {
    const url = pageNum === 1 ? cfg.baseUrl : cfg.customPagination(pageNum);
    const $ = await fetchPage(url);
    if (!$) break;

    let count = 0;
    $('article, .post').each((_, el) => {
      const titleEl = $(el).find('h2, h3, .entry-title, .post-title').first();
      const a = titleEl.find('a').first();
      const title = (a.text() || titleEl.text()).trim();
      if (!title || title.length < 8 || title.length > 200) return;
      if (cfg.titleFilter && !cfg.titleFilter(title)) return;

      const link = a.attr('href') || $(el).find('a').first().attr('href') || '';
      const fullText = $(el).text();
      const absUrl = resolveUrl(link, url) || url;

      const entry = buildEntry({
        id: `${cfg.prefix}-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText: fullText + ' scholarship sweden',
        source: cfg.source,
        url: absUrl,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: cfg.defaultInstructions || 'See the scholarship page for application instructions.'
      });
      if (entry) { results.push(entry); count++; }
    });

    console.log(`  ${cfg.name} page ${pageNum}: +${count} (total: ${results.length})`);
    if (count === 0) break;
    await sleep(randomDelay());
  }

  return results;
}

// ─── Entry point (CLI routing) ────────────────────────────────────────────────

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const listIdx = args.indexOf('--list');

if (args.includes('--status')) {
  printStatus().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else if (args.includes('--push-json')) {
  pushJsonToSupabase().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
} else if (urlIdx !== -1 && args[urlIdx + 1]) {
  scrapeUrl(args[urlIdx + 1])
    .then(() => process.exit(0))
    .catch(err => { console.error('Fatal:', err); process.exit(1); })
    .finally(() => closeSharedBrowser());
} else if (listIdx !== -1 && args[listIdx + 1]) {
  scrapeList(args[listIdx + 1])
    .then(() => process.exit(0))
    .catch(err => { console.error('Fatal:', err); process.exit(1); })
    .finally(() => closeSharedBrowser());
} else {
  main()
    .catch(err => { console.error('Fatal:', err); process.exitCode = 1; });
    // closeSharedBrowser is already called at the end of main()
}
