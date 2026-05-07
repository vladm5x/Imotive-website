'use strict';

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  ADMIN_REVIEW_STATUSES,
  assessScholarshipQuality,
  calculateSimilarity,
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
  shouldPublishEntry
} = require('./scholarshipQuality');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');
const SEED_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');
const APPROVED_JSON_PATH = path.join(__dirname, '..', 'data', 'approved_scholarships.json');
const APPROVED_CSV_PATH = path.join(__dirname, '..', 'data', 'approved_scholarships.csv');
const MANUAL_REVIEW_CSV_PATH = path.join(__dirname, '..', 'data', 'manual_review_scholarships.csv');
const REJECTED_CSV_PATH = path.join(__dirname, '..', 'data', 'rejected_scholarships.csv');
const APPROVED_RECHECK_CSV_PATH = path.join(__dirname, '..', 'data', 'approved_needs_recheck.csv');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const QUALITY_REPORT_PATH = path.join(REPORTS_DIR, 'scrape_quality_report.md');
const ERROR_SUMMARY_PATH = path.join(REPORTS_DIR, 'error_summary.json');
const BASELINE_REPORT_PATH = path.join(REPORTS_DIR, 'baseline_scrape_report.md');
const SAMPLE_CHECK_PATH = path.join(REPORTS_DIR, 'approved_sample_check.csv');
const RAW_SCRAPE_PATH = path.join(__dirname, '..', 'data', 'scraped_scholarships_raw.json');

const args = process.argv.slice(2);
const SUPABASE_DISABLED = args.includes('--no-supabase') || process.env.NO_SUPABASE === '1';

// ─── Configuration ────────────────────────────────────────────────────────────

const CONCURRENCY_LIMIT = 6;          // Max sources running in parallel per batch
const ENRICH_CONCURRENCY = 5;         // Max detail-page fetches at once during enrichment
const SUPABASE_BATCH_SIZE = 50;       // Upsert batch size for Supabase

// Random delay 1–3 s so every request waits a different amount of time
function randomDelay() {
  return Math.floor(1000 + Math.random() * 2000);
}

// Supabase client — null if env vars not set (scraper still runs without them)
const supabase = (!SUPABASE_DISABLED && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// Per-run counters for scrape_logs
const runStats = { attempted: 0, success: 0, fail: 0, blocked: 0 };
const failureStats = { reasons: {}, examples: [] };
const FAILURE_EXAMPLE_LIMIT = 80;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

let sharedBrowserPromise = null;

// ─── URL helpers ──────────────────────────────────────────────────────────────

function resolveUrl(href, baseUrl) {
  if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  try {
    const resolved = new URL(href, baseUrl);
    // Reject CMS anchor links that land on the root path — they're internal section markers
    if (resolved.hash && (resolved.pathname === '/' || resolved.pathname === '') && !resolved.search) return null;
    return resolved.href;
  } catch {
    return null;
  }
}

function normalizeUrl(url) {
  return canonicalizeUrl(url);
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

// Known member-portal domains that always require authentication
const AUTH_ONLY_DOMAINS = /\b(my\.rotary\.org|members\.|portal\.|account\.|login\.|auth\.)\b/i;

// Returns true if page content looks like a real login wall (not just a nav "Sign In" link)
function isLoginWall(url, html) {
  if (AUTH_ONLY_DOMAINS.test(url)) return true;
  const t = html.toLowerCase();
  // Must have an actual password input — nav-level "Sign In" links don't qualify
  const hasPasswordInput = /type=["']password["']/.test(t);
  if (!hasPasswordInput) return false;
  const hasLoginLanguage = t.includes('sign in') || t.includes('log in') || t.includes('login') || t.includes('please authenticate');
  // Real login wall: password form + auth language + no scholarship content visible
  return hasLoginLanguage && !t.includes('scholarship') && !t.includes('grant') && !t.includes('stipend') && !t.includes('fellowship');
}

async function fetchPage(url, { retries = 3, backoff = 2000, returnFailure = false } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
      if (isLoginWall(url, res.data)) {
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
    if (isLoginWall(url, html)) {
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
    jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    januari: '01', februari: '02', mars: '03', maj: '05',
    juni: '06', juli: '07', augusti: '08', oktober: '10'
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

  const dmyDotRange = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmyDotRange) return `${dmyDotRange[6]}-${dmyDotRange[5].padStart(2, '0')}-${dmyDotRange[4].padStart(2, '0')}`;

  const dmyDot = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmyDot) return `${dmyDot[3]}-${dmyDot[2].padStart(2, '0')}-${dmyDot[1].padStart(2, '0')}`;

  // "31 March 2026" / "closes 31 March" (no year — assume current or next year)
  const dmNoYear = text.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})(?:\\b|\\.)`, 'i'));
  if (dmNoYear) {
    const year = new Date().getFullYear();
    const mo = months[dmNoYear[2].toLowerCase()];
    const day = dmNoYear[1].padStart(2, '0');
    const candidate = new Date(`${year}-${mo}-${day}`);
    const finalYear = candidate < new Date() ? year + 1 : year;
    return `${finalYear}-${mo}-${day}`;
  }

  // "March 2026" / "April 2026" (month + year only — use last day of month)
  const myOnly = text.match(new RegExp(`(${monthPattern})\\s+(20\\d{2})`, 'i'));
  if (myOnly) {
    const mo = months[myOnly[1].toLowerCase()];
    const yr = myOnly[2];
    const lastDay = new Date(Number(yr), Number(mo), 0).getDate();
    return `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
  }

  return null;
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (t.includes('tuition') || t.includes('fee waiver') || t.includes('fee reduction')) return 'Tuition';
  if (t.includes('travel') || t.includes('exchange') || t.includes('abroad') || t.includes('conference') || t.includes('praktik') || t.includes('utbyte') || t.includes('resa')) return 'Travel';
  if (t.includes('research') || t.includes('thesis') || t.includes('dissertation') || t.includes('lab') || t.includes('forskning') || t.includes('doktorand')) return 'Research';
  return 'Living costs';
}

function inferLevels(text) {
  const t = text.toLowerCase();
  const levels = [];
  if (t.includes('bachelor') || t.includes('undergraduate') || t.includes('first cycle') || t.includes("bachelor's") || t.includes('kandidat')) levels.push('Bachelor');
  if (t.includes('master') || t.includes('postgraduate') || t.includes('second cycle') || t.includes("master's") || t.includes('magister')) levels.push('Master');
  if (t.includes('phd') || t.includes('doctoral') || t.includes('third cycle') || t.includes('doctorate') || t.includes('doktorand') || t.includes('doktor')) levels.push('PhD');
  if (!levels.length && (t.includes('högskola') || t.includes('universitet') || t.includes('studerande'))) levels.push('Bachelor', 'Master');
  return levels;
}

function inferNationality(text) {
  const t = text.toLowerCase();
  const nat = [];
  if (t.includes('swedish citizen') || t.includes('swedish national') || /\bswedish\b/.test(t)) nat.push('Swedish');
  if (t.includes('eu/eea') || t.includes('european union') || t.includes('eea student') || t.includes('eu student')) nat.push('EU/EEA');
  if (t.includes('international') || t.includes('non-eu') || t.includes('outside europe') || t.includes('fee-paying')) nat.push('International non-EU');
  if (t.includes('finsk medborgare') || t.includes('fast bosatt i finland') || t.includes('finland')) nat.push('EU/EEA');
  return nat;
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
  if (t.includes('research') || t.includes('academic') || t.includes('thesis') || t.includes('scientific') || t.includes('forskning') || t.includes('vetenskap')) interests.push('Research');
  if (t.includes('leadership') || t.includes('community') || t.includes('social impact') || t.includes('civil society')) interests.push('Leadership');
  if (t.includes('travel') || t.includes('exchange') || t.includes('international mobility')) interests.push('Travel');
  return interests.length ? interests : ['Any interest'];
}

function inferFields(text) {
  const t = text.toLowerCase();
  const fields = [];
  if (t.includes('engineering') || t.includes('lth') || t.includes('technology') || t.includes('computer science') || t.includes('teknik')) fields.push('Engineering');
  if (t.includes('medicine') || t.includes('medical') || t.includes('health') || t.includes('clinical') || t.includes('nursing') || t.includes('medicin')) fields.push('Medicine');
  if (t.includes('social science') || t.includes('sociology') || t.includes('political science') || t.includes('samhällsvetenskap')) fields.push('Social sciences');
  if (t.includes('law') || t.includes('legal') || t.includes('jurisprudence') || t.includes('juridik')) fields.push('Law');
  if (t.includes('humanities') || t.includes('arts') || t.includes('language') || t.includes('literature') || t.includes('history') || t.includes('humaniora') || t.includes('konst') || t.includes('kultur') || t.includes('språk')) fields.push('Humanities');
  if (t.includes('natural science') || t.includes('physics') || t.includes('chemistry') || t.includes('biology') || t.includes('naturvetenskap')) fields.push('Natural sciences');
  if (t.includes('economics') || t.includes('business') || t.includes('management') || t.includes('finance') || t.includes('ekonomi')) fields.push('Economics');
  if (t.includes('architecture') || t.includes('design') || t.includes('urban planning') || t.includes('arkitektur')) fields.push('Architecture');
  if (/\bit\b/.test(t) || t.includes('information technology') || t.includes('data science') || t.includes('software') || t.includes('digital')) fields.push('IT');
  if (t.includes('education') || t.includes('pedagogik')) fields.push('Education');
  return fields.length ? [...new Set(fields)] : ['Any field'];
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
  const m =
    // Symbol-prefixed: €10,000 / $5,000
    text.match(/[€$£]\s*[\d\s,.]+(?:k|,000)?/i) ||
    // Currency code before: SEK 50 000 / EUR 10,000
    text.match(/(?:SEK|EUR|USD|GBP|CHF)\s*[\d\s,.]+(?:k)?/i) ||
    // Currency code after: 50 000 SEK / 10,000 EUR
    text.match(/[\d\s,.]+\s*(?:SEK|EUR|USD|GBP|CHF|kr\.?)/i) ||
    // Swedish kr shorthand: 50 000 kr / 10 000kr
    text.match(/[\d\s]+kr\.?/i) ||
    // Spelled: 10,000 dollars/euros/kronor
    text.match(/[\d\s,.]+\s*(?:dollars?|euros?|euro|kronor|pounds?)/i) ||
    // Full waiver / stipend descriptor
    text.match(/(?:full(?:y)?\s*(?:funded|tuition\s*waiver|scholarship)|tuition\s*fee\s*waiver)/i);
  if (!m) return null;
  return m[0].trim().replace(/\s+/g, ' ').slice(0, 60);
}

const SOCIAL_DOMAINS = /\b(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|pinterest\.com|reddit\.com|t\.co|bit\.ly|sharer)\b/i;

// Find the actual application form/portal URL on a detail page.
function extractApplicationUrl($, baseUrl) {
  const applyText = /^(apply(\s+(now|here|online|today))?|start\s+application|submit\s+application|application\s+form|go\s+to\s+application|apply\s+for\s+this|apply\s+to\s+this)$/i;
  const applyHref = /[/=](apply|application|ansok|ans%C3%B6kan|ansökan|apply-now|applynow)/i;

  function isUsable(abs) {
    return abs && !SOCIAL_DOMAINS.test(abs) && normalizeUrl(abs) !== normalizeUrl(baseUrl);
  }

  let found = null;

  // Pass 1: anchor text match (most reliable)
  $('a').each((_, el) => {
    if (found) return;
    const text = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (!applyText.test(text)) return;
    const abs = resolveUrl(href, baseUrl);
    if (isUsable(abs)) found = abs;
  });

  // Pass 2: href keyword match (apply/application in URL path)
  if (!found) {
    $('a').each((_, el) => {
      if (found) return;
      const href = $(el).attr('href') || '';
      if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (!applyHref.test(href)) return;
      const abs = resolveUrl(href, baseUrl);
      if (isUsable(abs)) found = abs;
    });
  }

  return found;
}

function extractApplicationUrlStrict($, baseUrl) {
  const applyText = /\b(apply|apply now|apply here|apply online|start application|submit application|application form|go to application|ansok|ansokan|ansokningsformular|ansök|ansökan|ansökningsformulär|nominate|nomination|register|portal|prisma|e-application|application system|universityadmissions\.se)\b/i;
  const applyHref = /[/=.-](apply|application|ansok|ansokan|ansök|ansökan|apply-now|applynow|nomination|register|portal|prisma|universityadmissions)/i;
  const badHref = /\b(mailto:|tel:|share|facebook|twitter|linkedin|instagram|youtube|login|signin|sign-in|search|payment|affiliate|utm_|#)\b/i;

  function isUsable(abs) {
    if (!abs || isSocialOrShareUrl(abs) || isSuspiciousDomain(abs)) return false;
    if (normalizeUrl(abs) === normalizeUrl(baseUrl)) return false;
    try {
      const parsed = new URL(abs);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      if (/^\/?$/.test(parsed.pathname) && !parsed.search) return false;
      return true;
    } catch {
      return false;
    }
  }

  const candidates = [];
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (!href || badHref.test(href)) return;
    const abs = resolveUrl(href, baseUrl);
    if (!isUsable(abs)) return;
    if (applyText.test(text)) candidates.push({ url: abs, score: 3 });
    else if (applyHref.test(href)) candidates.push({ url: abs, score: 2 });
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url || null;
}

// ─── Entry builder ────────────────────────────────────────────────────────────

function buildEntry({ id, title, amount, deadline, fullText, source, url, eligibility, documents, instructions, applicationUrl = null }) {
  // Drop at scrape time if deadline is clearly in the past
  if (deadline && deadline !== 'Unknown') {
    const d = new Date(deadline);
    if (!isNaN(d) && d < new Date() && !/\b(annual|yearly|every year|next application round|application period|recurring|rolling|löpande|årligen|varje år|ansökningsperiod)\b/i.test(fullText || '')) return null;
  }
  return normalizeScholarshipEntry({
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
  });
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

async function scrapeUniversity({ name, prefix, pages, defaultInstructions, autoEnrich = true, usePuppeteer = false }) {
  console.log(`Scraping ${name}...`);
  const results = [];

  for (const pageUrl of pages) {
    const $ = usePuppeteer
      ? await fetchPageJS(pageUrl, 'article, .card, h2, h3, h4')
      : await fetchPage(pageUrl);
    if (!$) continue;

    const containerSelectors = [
      '.accordion__item', '.expandable-block', '.scholarship-item', '.funding-item',
      '.card', 'article', '.grant-item', '.stipend-item', 'li.item', '.list-item',
      '.entry', '.content-block', '.panel', '.block', 'section',
      '.sol-call-wrapper', '[class*="sol-call"]', '.sol-article-item'  // SiteVision CMS (Formas, Vinnova)
    ];

    let scraped = false;

    for (const sel of containerSelectors) {
      if ($(sel).length < 2) continue;
      const prevLen = results.length;

      $(sel).each((_, el) => {
        const headingEl = $(el).find('h2, h3, h4, h5, .accordion__heading, .card__title, .title, strong').first();
        const title = headingEl.text().trim();
        if (!title || title.length < 8 || title.length > 150) return;
        if (!/scholarship|grant|stipend|award|bursary|funding|fellowship|prize|stöd|bidrag|anslag/i.test(title)) return;

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
        if (!/scholarship|grant|stipend|award|bursary|funding|fellowship|prize|stöd|bidrag|anslag/i.test(title)) return;

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
  if (autoEnrich && results.length > 0) {
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

      const fullText = $(el).text();
      let rawLink = a.attr('href') || '';
      if (!rawLink || SOCIAL_DOMAINS.test(rawLink)) {
        rawLink = $(el).find('a').filter((_, a) => !SOCIAL_DOMAINS.test($(a).attr('href') || '')).first().attr('href') || '';
      }
      const absUrl = resolveUrl(rawLink, url) || url;

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
  { name: 'Blekinge Institute of Technology', prefix: 'bth', pages: [
    'https://www.bth.se/english/education/application-and-admission/scholarships'
  ], defaultInstructions: 'Apply through BTH scholarship portal.' },
  { name: 'Mid Sweden University', prefix: 'miun', pages: [
    'https://www.miun.se/en/education/meet-mid-sweden-university/Fees-and-scholarships/Scholarship/Tuition-fee-Scholarship-Mid-Sweden-University-/'
  ], defaultInstructions: 'Apply through Mid Sweden University scholarship portal.' },
  { name: 'Stockholm School of Economics', prefix: 'hhs', pages: [
    'https://www.hhs.se/en/education/study-at-sse/tuition-and-fees/'
  ], defaultInstructions: 'Apply through Stockholm School of Economics scholarship portal.',
    titleFilter: title => /scholarship|grant|stipend|award|fellowship|bursary|funding/i.test(title) && title.length > 12 && !title.endsWith(':') },
  { name: 'University of Borås', prefix: 'hb', pages: [
    'https://www.hb.se/en/international-student/fees-and-scholarships/scholarships/'
  ], defaultInstructions: 'Apply through University of Borås scholarship portal.' },
  // Funding agencies & foundations (same HTML structure)
  { name: 'Swedish Research Council', prefix: 'vr', pages: [
    'https://www.vr.se/english/applying-for-funding/calls-and-decisions.html'
  ], defaultInstructions: 'Apply via the Swedish Research Council application portal PRISMA.', usePuppeteer: true },
  { name: 'Formas', prefix: 'formas', pages: [
    'https://formas.se/en/start-page/apply-for-funding/all-calls.html'
  ], defaultInstructions: 'Apply via Formas e-application system.', usePuppeteer: true },
  { name: 'Vinnova', prefix: 'vinnova', pages: [
    'https://www.vinnova.se/en/apply-for-funding/find-the-right-funding/'
  ], defaultInstructions: "Apply via Vinnova's online application system.", usePuppeteer: true },
  { name: 'Wallenberg Foundations', prefix: 'wallenberg', pages: [
    'https://kaw.wallenberg.org/en/grants'
  ], defaultInstructions: 'Apply through the Wallenberg foundation portal.' },
  { name: 'KK-stiftelsen', prefix: 'kk', pages: [
    'https://www.kks.se/en/funding-and-assessment/applying-for-funding/'
  ], defaultInstructions: "Apply through KK-stiftelsen's application portal." },

  // ── Additional Swedish foundations & research councils ────────────────────
  { name: 'Forte', prefix: 'forte2', pages: [
    'https://forte.se/en/funding/'
  ], defaultInstructions: 'Apply through Forte online application portal.' },
  { name: 'STINT', prefix: 'stint', pages: [
    'https://www.stint.se/en/grants/'
  ], defaultInstructions: 'Apply through STINT application portal.' },
  { name: 'Riksbankens Jubileumsfond', prefix: 'rj', pages: [
    'https://rj.se/en/grant-listning/',
    'https://rj.se/en/grants/'
  ], defaultInstructions: 'Apply through RJ online application system.' },
  // Kempe Foundations: kempestiftelserna.se domain unreachable (ECONNREFUSED as of 2026-05)
  // { name: 'Kempe Foundations', prefix: 'kempe', pages: ['https://www.kempestiftelserna.se/en/grants/'] },
  // Lars Hiertas Minne: uses ul>li>a list structure, not headings — handled by scrapeLarsHiertas() custom fn below
  { name: 'Fulbright Sweden', prefix: 'fulbright2', pages: [
    'https://www.fulbright.se/grants/'
  ], defaultInstructions: 'Apply through the Fulbright Commission.' },

  // ── Additional Swedish universities ─────────────────────────────────────────
  { name: 'Luleå University of Technology', prefix: 'ltu', pages: [
    'https://www.ltu.se/en/education/be-a-student/application-and-admission/'
  ], defaultInstructions: 'Apply via the LTU scholarship portal.' },
  { name: 'Linnaeus University', prefix: 'lnu', pages: [
    'https://lnu.se/en/study-at-lnu/application-and-admission/fees-and-scholarships/'
  ], defaultInstructions: 'Apply through Linnaeus University scholarship system.' },
  { name: 'Södertörn University', prefix: 'sh', pages: [
    'https://www.sh.se/english/study-at-sodertorn/apply.html'
  ], defaultInstructions: 'Apply through Södertörn University scholarship portal.' },
  { name: 'Dalarna University', prefix: 'du', pages: [
    'https://www.du.se/en/study/'
  ], defaultInstructions: 'Apply through Dalarna University scholarship portal.' },
  { name: 'Kristianstad University', prefix: 'hkr', pages: [
    'https://www.hkr.se/en/study-at-hkr/'
  ], defaultInstructions: 'Apply through Kristianstad University scholarship portal.' },
  { name: 'University of Skövde', prefix: 'his', pages: [
    'https://www.his.se/en/prospective-student/apply/'
  ], defaultInstructions: 'Apply through University of Skövde scholarship portal.' },
  { name: 'University of Gävle', prefix: 'hig', pages: [
    'https://www.hig.se/en/educational/apply/'
  ], defaultInstructions: 'Apply through University of Gävle scholarship portal.' },

  // ── Swedish foundations (HTTP-fetchable) ─────────────────────────────────────
  { name: 'Swedish Cancer Society', prefix: 'cancer', pages: [
    'https://www.cancerfonden.se/forskning'
  ], defaultInstructions: 'Apply through Cancerfonden grant portal.', titleFilter: title => /stipend|anslag|grant|award|scholarship/i.test(title) },
  { name: 'Swedish Heart-Lung Foundation', prefix: 'hjart', pages: [
    'https://www.hjart-lungfonden.se/forskning/'
  ], defaultInstructions: 'Apply through the Swedish Heart-Lung Foundation portal.', titleFilter: title => /stipend|anslag|grant|award|scholarship/i.test(title) },
  { name: 'SSF Strategic Research Foundation', prefix: 'ssf', pages: [
    'https://strategiska.se/en/apply/'
  ], defaultInstructions: 'Apply via the SSF grant portal.' },
  { name: 'NordForsk', prefix: 'nordforsk', pages: [
    'https://www.nordforsk.org/calls'
  ], defaultInstructions: 'Apply via NordForsk open call portal.' },

  // Trusted official international scholarship providers
  { name: 'Chevening Scholarships', prefix: 'chevening', pages: [
    'https://www.chevening.org/scholarships/'
  ], defaultInstructions: 'Apply through the official Chevening online application system.' },
  { name: 'Gates Cambridge Trust', prefix: 'gatescambridge', pages: [
    'https://www.gatescambridge.org/programme/the-scholarship/'
  ], defaultInstructions: 'Apply through the University of Cambridge graduate application and Gates Cambridge process.' },
  { name: 'Rhodes Trust', prefix: 'rhodes', pages: [
    'https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/'
  ], defaultInstructions: 'Apply through the official Rhodes Scholarship application process for your constituency.' },
  { name: 'Commonwealth Scholarship Commission', prefix: 'cscuk', pages: [
    'https://cscuk.fcdo.gov.uk/scholarships/'
  ], defaultInstructions: 'Apply through the Commonwealth Scholarship Commission application process.' },
  { name: 'DAAD Scholarships', prefix: 'daad', pages: [
    'https://www.daad.de/en/studying-in-germany/scholarships/daad-scholarships/'
  ], defaultInstructions: 'Apply through the official DAAD scholarship database and application portal.' },
  { name: 'Vanier Canada Graduate Scholarships', prefix: 'vanier', pages: [
    'https://vanier.gc.ca/en/home-accueil.html'
  ], defaultInstructions: 'Apply through the official Vanier Canada Graduate Scholarships nomination process.' },
  { name: 'Erasmus Mundus Joint Masters', prefix: 'emjm', pages: [
    'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters'
  ], defaultInstructions: 'Apply directly to the Erasmus Mundus Joint Masters consortium.' },
  { name: 'Marie Sklodowska-Curie Actions', prefix: 'msca', pages: [
    'https://marie-sklodowska-curie-actions.ec.europa.eu/actions/doctoral-networks'
  ], defaultInstructions: 'Apply through the host doctoral network or the official EU Funding and Tenders portal.' },
];

// ─── Blog aggregator sources (all use scrapeBlogAggregator) ───────────────────

const BLOG_SOURCES = [
  // Only scrape recent pages (older posts get 403 on enrichment)
  { name: 'Scholarship Positions', prefix: 'spos', baseUrl: 'https://scholarship-positions.com/category/sweden-scholarships/', source: 'Scholarship Positions', maxPages: 8, enrichAfter: true },
  { name: 'AfterSchoolAfrica Blog', prefix: 'asa2', baseUrl: 'https://www.afterschoolafrica.com/category/scholarships/europe/sweden/', source: 'AfterSchoolAfrica', maxPages: 10, enrichAfter: true },
  { name: 'Opportunity Desk Sweden', prefix: 'od', baseUrl: 'https://opportunitydesk.org/category/scholarships/europe/sweden/', source: 'Opportunity Desk', maxPages: 6, enrichAfter: true },
  { name: 'Scholarship Positions EU', prefix: 'speu2', baseUrl: 'https://scholarship-positions.com/category/europe-scholarships/', source: 'Scholarship Positions', maxPages: 4, enrichAfter: true, titleFilter: title => /sweden|nordic|scandinavian/i.test(title) },
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
  },
  {
    name: 'DistanceLearningPortal', prefix: 'dlp', source: 'DistanceLearningPortal',
    startUrl: 'https://www.distancelearningportal.eu/scholarships/?countries=se',
    maxScrolls: 8, defaultBaseUrl: 'https://www.distancelearningportal.eu',
    itemSelectors: ['article', '[class*="ScholarshipItem"]', '[class*="scholarship-item"]', '[class*="ResultItem"]', 'li[class*="item"]'],
    extraText: 'scholarship sweden distance online'
  },
  {
    name: 'FindAPhD Sweden', prefix: 'faphd', source: 'FindAPhD',
    startUrl: 'https://www.findaphd.com/phds/sweden/?PreviousFunding100=1',
    maxScrolls: 15, defaultBaseUrl: 'https://www.findaphd.com',
    itemSelectors: ['div.phd-result__details', '.resultsHolder article', 'article', '[class*="result"]', 'div[class*="phd-result"]'],
    titleSelectors: ['h3', 'h4', 'a[class*="title"]', '.phd-result__title'],
    extraText: 'phd scholarship funding stipend sweden'
  },
  {
    name: 'Scholarship Portal EU', prefix: 'speu', source: 'ScholarshipPortal.eu',
    startUrl: 'https://www.scholarshipportal.com/scholarships/bachelors,masters,phd?country=se',
    maxScrolls: 12, defaultBaseUrl: 'https://www.scholarshipportal.com',
    itemSelectors: ['article', '[class*="scholarship"]', '[class*="Scholarship"]', 'li[class*="item"]', 'div[class*="result"]'],
    extraText: 'scholarship sweden funding grant'
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
      'https://si.se/en/apply/scholarships/swedish-institute-study-scholarships/'
    ],
    defaultInstructions: 'Apply through the Swedish Institute application portal.'
  });
}

async function scrapeStudyInSweden() {
  console.log('Scraping Study in Sweden...');
  const results = [];
  const pageUrl = 'https://studyinsweden.se/scholarships/';

  // Site returns 403 on static fetch — use Puppeteer
  const $ = await fetchPageJS(pageUrl, 'li, article, .card');
  if (!$) return results;

  // Try specific scholarship list items; fall back to broader li/article selectors
  const scholarshipEls = $('li[class*="scholarship"], li[class*="Scholarship"], article[class*="scholarship"]');
  const targetEls = scholarshipEls.length ? scholarshipEls : $('main li, .content li, ul li, article');

  targetEls.each((_, el) => {
    const a = $(el).find('a').first();
    const title = (a.text() || $(el).find('h2, h3, h4').first().text()).replace('↗️', '').trim();
    if (!title || title.length < 8 || title.length > 200) return;

    const link = a.attr('href') || '';
    const absUrl = resolveUrl(link, pageUrl) || pageUrl;
    if (absUrl === pageUrl && !link) return;

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

  // Fallback: scan all links with scholarship-related text
  if (!results.length) {
    $('a').each((_, el) => {
      const title = $(el).text().replace('↗️', '').trim();
      if (!title || title.length < 8 || title.length > 150) return;
      if (!/scholarship|grant|fellowship|award|bursary|stipend/i.test(title)) return;
      const href = $(el).attr('href') || '';
      const absUrl = resolveUrl(href, pageUrl);
      if (!absUrl || absUrl === pageUrl) return;

      const entry = buildEntry({
        id: `sis-${slugify(title)}`,
        title,
        amount: null,
        deadline: null,
        fullText: title + ' scholarship Sweden',
        source: 'Study in Sweden',
        url: absUrl,
        eligibility: 'See scholarship page for eligibility.',
        documents: '',
        instructions: 'See the scholarship page for application instructions.'
      });
      if (entry) results.push(entry);
    });
  }

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
  // nordplusonline.org is currently being rebuilt — all programme URLs redirect to an empty homepage.
  // Try root and a direct fallback; gracefully returns 0 if site has no content.
  return scrapeHeadingBased({
    name: 'Nordplus', prefix: 'nordplus', source: 'Nordplus',
    pages: [
      'https://www.nordplusonline.org/'
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

      let asaLink = a.attr('href') || '';
      if (!asaLink || SOCIAL_DOMAINS.test(asaLink)) {
        asaLink = $(el).find('a').filter((_, a2) => !SOCIAL_DOMAINS.test($(a2).attr('href') || '')).first().attr('href') || '';
      }
      const absUrl = resolveUrl(asaLink, url) || url;
      if (SOCIAL_DOMAINS.test(absUrl)) return;
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
  return scrapeHeadingBased({
    name: 'Fulbright Sweden',
    prefix: 'fulbright',
    source: 'Fulbright Sweden',
    pages: ['https://www.fulbright.se/grants/'],
    defaultInstructions: 'Apply through the Fulbright Sweden application portal.',
    titleFilter: title => /scholarship|grant|fellowship|award|program/i.test(title)
  });
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
    applicationUrl: extractApplicationUrlStrict($, url) || extractApplicationUrl($, url),
    pageType: /\.pdf($|\?)/i.test(url) ? 'pdf' : 'official_page',
    scholarshipDetected: isProbablyScholarshipPage({ url }, '', fullText),
    requiresLogin: detectLoginWall(url, $.html()),
    captcha: detectCaptchaOrBotWall($.html()),
    soft404: detectSoft404($.html(), url),
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
  if (detail.pageType) entry.page_type = detail.pageType;
  if (detail.requiresLogin) entry.requiresLogin = true;
  if (detail.captcha) entry.captcha = true;
  if (detail.soft404) entry.soft404 = true;
  if (detail.scholarshipDetected === false) entry.scholarshipDetected = false;
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

  // Skip old scholarship-positions posts (pre-2024) that redirect-loop
  const OLD_SPOS_RE = /scholarship-positions\.com\/.*\/20(1[0-9]|2[0-3])\//;
  const toEnrich = entries
    .filter(Boolean)
    .filter(e => e.url && e.url.startsWith('http'))
    .filter(e => !SOCIAL_DOMAINS.test(e.url))
    .filter(e => !OLD_SPOS_RE.test(e.url))
    .filter(e => !(e.qualityFlags || []).includes('generic_or_error_title'))
    .filter(e => !done.has(e.id) && (force || needsEnrichment(e)))
    .slice(0, maxEntries);

  const skipped = Math.max(0, entries.length - toEnrich.length - done.size);
  console.log(`  [deep] ${toEnrich.length} entries need enrichment${label ? ' (' + label + ')' : ''} (${done.size} already done, skipping ${skipped} already-rich)`);
  if (!toEnrich.length) return entries;

  let processed = 0;

  await withConcurrency(toEnrich, concurrency, async (entry) => {
    await sleep(500 + Math.random() * 500); // polite inter-request delay
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
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')).map(normalizeScholarshipEntry);
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
  const groups = [];

  for (const raw of entries.filter(Boolean).map(normalizeScholarshipEntry)) {
    // Index-page children (e.g. 20 scholarships from one Kulturfonden listing page) share the
    // same provider portal / nav URL as their applicationUrl — do NOT use it as a dedup key or
    // they will all collapse into one group.  For all other entries, only use applicationUrl if
    // it has a non-trivial path (not a bare root like https://ansokan.kulturfonden.fi/).
    const rawAppUrl = raw.application_final_url || raw.application_url || raw.applicationUrl;
    const isIndexChild = !!raw.index_child;
    let appUrlKey = null;
    if (!isIndexChild && rawAppUrl) {
      try {
        const parsed = new URL(rawAppUrl);
        if (parsed.pathname && parsed.pathname.replace(/\/$/, '').length > 1) {
          appUrlKey = normalizeUrl(rawAppUrl);
        }
      } catch { /* ignore invalid URLs */ }
    }

    const keys = [
      raw.id,
      normalizeUrl(raw.final_url || raw.url || raw.source_url),
      normalizeUrl(raw.source_url),
      appUrlKey,
      `${normalizeTitleForDedup(raw.scholarship_name || raw.title)}::${cleanText(raw.provider_name || raw.source).toLowerCase()}`
    ].filter(Boolean);

    let group = groups.find(candidate => keys.some(key => candidate.keys.has(key)));
    if (!group) {
      group = { keys: new Set(), entries: [] };
      groups.push(group);
    }
    keys.forEach(key => group.keys.add(key));
    group.entries.push(raw);
  }

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i].entries[0];
      const b = groups[j].entries[0];
      if (!a || !b) continue;
      const sameProvider = cleanText(a.provider_name || a.source).toLowerCase() === cleanText(b.provider_name || b.source).toLowerCase();
      const similarity = calculateSimilarity(a.title, b.title);
      const aggregatorPair = isAggregatorDomain(a.final_url || a.url || a.source_url) || isAggregatorDomain(b.final_url || b.url || b.source_url);
      if ((sameProvider && similarity >= 0.86) || (aggregatorPair && similarity >= 0.95)) {
        groups[i].entries.push(...groups[j].entries);
        for (const key of groups[j].keys) groups[i].keys.add(key);
        groups.splice(j, 1);
        j--;
      }
    }
  }

  return groups.map(group => chooseBestDuplicate(group.entries));
}

function entryCompletenessScore(entry) {
  const fields = ['amount', 'deadline', 'eligibility', 'documents', 'instructions', 'application_url', 'applicationUrl'];
  return fields.reduce((score, field) => score + (entry[field] && !GENERIC_PLACEHOLDERS.has(entry[field]) ? 1 : 0), 0);
}

function chooseBestDuplicate(entries) {
  if (entries.length === 1) return entries[0];
  const ranked = entries.slice().sort((a, b) => {
    const aAdmin = ADMIN_REVIEW_STATUSES.has(a.reviewStatus || a.review_status) ? 1 : 0;
    const bAdmin = ADMIN_REVIEW_STATUSES.has(b.reviewStatus || b.review_status) ? 1 : 0;
    if (aAdmin !== bAdmin) return bAdmin - aAdmin;
    const aOfficial = isOfficialProviderDomain(a.final_url || a.url || a.source_url) ? 1 : 0;
    const bOfficial = isOfficialProviderDomain(b.final_url || b.url || b.source_url) ? 1 : 0;
    if (aOfficial !== bOfficial) return bOfficial - aOfficial;
    const aAggregator = isAggregatorDomain(a.final_url || a.url || a.source_url) ? 1 : 0;
    const bAggregator = isAggregatorDomain(b.final_url || b.url || b.source_url) ? 1 : 0;
    if (aAggregator !== bAggregator) return aAggregator - bAggregator;
    return entryCompletenessScore(b) - entryCompletenessScore(a);
  });

  const best = ranked[0];
  for (const duplicate of ranked.slice(1)) {
    mergeEntryFields(best, duplicate);
  }
  best.duplicateCount = ranked.length - 1;
  return best;
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function isExpired(deadline) {
  return isExpiredEntry({ deadline });
}

async function loadExpiredIds() {
  if (!supabase) return new Set();
  const { data, error } = await supabase.from('scholarships_expired').select('id');
  if (error) { console.warn(`  [supabase] load expired ids failed: ${error.message}`); return new Set(); }
  return new Set((data || []).map(r => r.id));
}

async function runExpirePass(combined) {
  if (!supabase) return;

  // Archive: expired-deadline entries + permanently-unreachable entries with no useful data
  const expired = combined.filter(e =>
    isExpired(e.deadline) ||
    (e.unreachable && (!e.deadline || e.deadline === 'Unknown') && (e.qualityScore || 0) < 50)
  );
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
    scholarship_name: entry.scholarship_name || entry.title,
    title: entry.title,
    provider_name: entry.provider_name || entry.source,
    provider_type: entry.provider_type || null,
    amount: entry.amount,
    deadline: entry.deadline,
    deadline_type: entry.deadline_type || 'unknown',
    is_recurring: entry.is_recurring ?? null,
    category: entry.category,
    level: entry.level,
    fields: entry.fields,
    nationality: entry.nationality,
    interests: entry.interests,
    need: entry.need,
    source: entry.source,
    url: entry.url,
    source_url: entry.source_url || entry.url,
    final_url: entry.final_url || null,
    application_url: entry.applicationUrl || entry.application_url || null,
    application_final_url: entry.application_final_url || null,
    source_url_status: entry.source_url_status || null,
    application_url_status: entry.application_url_status || null,
    url_verified_at: entry.url_verified_at || null,
    last_verified_at: entry.lastVerifiedAt || entry.last_verified_at || null,
    eligibility: entry.eligibility,
    documents: entry.documents,
    instructions: entry.instructions,
    requirement_keywords: entry.requirementKeywords || entry.requirement_keywords || [],
    required_applicant_info: entry.requiredApplicantInfo || entry.required_applicant_info || [],
    scrape_success: flags.scrape_success ?? entry.scrapeSuccess ?? entry.scrape_success ?? true,
    blocked: flags.blocked ?? entry.blocked ?? entry.unreachableReason === 'blocked',
    requires_login: flags.requires_login ?? entry.requires_login ?? entry.unreachableReason === 'login_wall',
    expired: flags.expired ?? entry.expired ?? false,
    duplicate_of: entry.duplicateOf || entry.duplicate_of || null,
    page_type: entry.page_type || null,
    quality_score: entry.qualityScore ?? entry.quality_score ?? 50,
    trust_score: entry.trustScore ?? entry.trust_score ?? 0,
    quality_flags: entry.qualityFlags || entry.quality_flags || [],
    validation_status: entry.validationStatus || entry.validation_status || null,
    validation_notes: entry.validationNotes || entry.validation_notes || null,
    review_status: entry.reviewStatus || entry.review_status || 'needs_review',
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

  // Fetch IDs already admin-reviewed so re-scraping never overwrites their statuses
  let adminReviewed = new Map();
  if (table === 'scholarships_raw') {
    const { data: reviewed, error: reviewErr } = await supabase
      .from(table)
      .select('id, review_status')
      .in('review_status', ['approved', 'rejected', 'archived']);
    if (reviewErr) {
      console.warn(`  [supabase] could not fetch admin-reviewed ids: ${reviewErr.message}`);
    } else {
      adminReviewed = new Map((reviewed || []).map(r => [r.id, r.review_status]));
      if (adminReviewed.size) {
        console.log(`  [supabase] preserving review_status for ${adminReviewed.size} admin-reviewed entries`);
      }
    }
  }

  console.log(`\nPushing ${validEntries.length} ${label} to ${table}...`);
  let success = 0;
  let fail = 0;

  for (let i = 0; i < validEntries.length; i += SUPABASE_BATCH_SIZE) {
    const batch = validEntries.slice(i, i + SUPABASE_BATCH_SIZE);
    const records = batch.map(entry => {
      const record = toSupabaseRecord(entry, flags);
      const previousStatus = adminReviewed.get(entry.id);
      if (previousStatus === 'approved' && !isPublishableScholarship(finalizeEntry(entry))) {
        record.review_status = isExpiredEntry(entry) ? 'archived_candidate' : 'needs_review_stale';
      } else if (previousStatus === 'approved') {
        delete record.review_status;
      } else if (previousStatus === 'rejected' || previousStatus === 'archived') {
        delete record.review_status;
      }
      return record;
    });
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

// Review, validation, and export helpers

function ensureOutputDirs() {
  fs.mkdirSync(path.dirname(APPROVED_JSON_PATH), { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx === -1 ? null : args[idx + 1] || null;
}

function getLimitArg() {
  const raw = getArgValue('--limit');
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Infinity;
}

function csvEscape(value) {
  if (Array.isArray(value)) value = value.join('; ');
  const text = cleanText(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filepath, rows, columns) {
  const header = columns.join(',');
  const body = rows.map(row => columns.map(column => csvEscape(row[column])).join(','));
  fs.writeFileSync(filepath, [header, ...body].join('\n'));
}

function statusFromValidation(result) {
  if (!result) return '';
  if (result.ok) return `ok:${result.status}`;
  return result.status ? `${result.reason}:${result.status}` : result.reason;
}

async function validateUrl(url, phase = 'validate') {
  if (!url) return { ok: false, reason: 'missing_url', status: null, finalUrl: '' };
  if (isSocialOrShareUrl(url)) return { ok: false, reason: 'social_or_share_url', status: null, finalUrl: url };
  if (isSuspiciousDomain(url)) return { ok: false, reason: 'suspicious_domain', status: null, finalUrl: url };

  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: () => true
    });
    const finalUrl = response.request?.res?.responseUrl || url;
    const html = String(response.data || '');
    let reason = '';
    if (response.status >= 400) reason = classifyHttpFailure(response.status);
    else if (detectCaptchaOrBotWall(html)) reason = 'captcha';
    else if (detectLoginWall(finalUrl, html)) reason = 'login_wall';
    else if (detectSoft404(html, finalUrl)) reason = 'soft_404';
    const ok = !reason && response.status >= 200 && response.status < 400;
    if (!ok) recordFailure(reason || 'url_validation_failed', { url, status: response.status, phase });
    return { ok, reason: reason || 'ok', status: response.status, finalUrl, html: html.slice(0, 12000) };
  } catch (err) {
    const reason = classifyError(err);
    recordFailure(reason, { url, status: err.response?.status, message: err.message, phase });
    return { ok: false, reason, status: err.response?.status || null, finalUrl: '' };
  }
}

async function validateSourceUrl(entry) {
  const sourceUrl = entry.source_url || entry.url;
  const result = await validateUrl(sourceUrl, 'source_url_validation');
  entry.source_url = sourceUrl;
  entry.final_url = result.finalUrl || entry.final_url || sourceUrl;
  entry.source_url_status = statusFromValidation(result);
  entry.url_verified_at = new Date().toISOString();
  entry.lastVerifiedAt = entry.url_verified_at;
  entry.last_verified_at = entry.url_verified_at;
  entry.blocked = ['blocked', 'rate_limited'].includes(result.reason);
  entry.requiresLogin = result.reason === 'login_wall';
  if (result.reason === 'captcha') entry.captcha = true;
  if (result.html) {
    entry.scholarshipDetected = isProbablyScholarshipPage(entry, result.html, '');
    if (!entry.fullText) entry.fullText = result.html.replace(/<[^>]+>/g, ' ').slice(0, 8000);
    if (!entry.applicationUrl && !entry.application_url) {
      const $ = cheerio.load(result.html);
      const appUrl = extractApplicationUrlStrict($, result.finalUrl || sourceUrl) || extractApplicationUrl($, result.finalUrl || sourceUrl);
      if (appUrl) {
        entry.applicationUrl = appUrl;
        entry.application_url = appUrl;
      }
    }
  }
  return entry;
}

async function validateApplicationUrl(entry) {
  const applicationUrl = entry.application_url || entry.applicationUrl;
  if (!applicationUrl) {
    entry.application_url_status = hasUsableApplicationPath(entry) ? 'instructions_only' : 'missing_url';
    return entry;
  }
  const result = await validateUrl(applicationUrl, 'application_url_validation');
  entry.application_url = applicationUrl;
  entry.applicationUrl = applicationUrl;
  entry.application_final_url = result.finalUrl || entry.application_final_url || applicationUrl;
  entry.application_url_status = statusFromValidation(result);
  if (result.reason === 'login_wall') entry.requiresLogin = true;
  return entry;
}

async function validateEntries(entries, { sampleOnly = false } = {}) {
  const limit = sampleOnly ? Math.min(entries.length, 50) : entries.length;
  const targets = entries.slice(0, limit);
  let processed = 0;
  await withConcurrency(targets, 4, async (entry) => {
    await sleep(250 + Math.random() * 450);
    await validateSourceUrl(entry);
    await sleep(150 + Math.random() * 300);
    await validateApplicationUrl(entry);
    processed++;
    if (processed % 25 === 0 || processed === targets.length) {
      console.log(`  [validate] ${processed}/${targets.length} URL sets checked`);
    }
  });
  return entries;
}

function missingFields(entry) {
  const missing = [];
  for (const field of ['deadline', 'amount', 'eligibility', 'documents']) {
    if (!entry[field] || GENERIC_PLACEHOLDERS.has(entry[field])) missing.push(field);
  }
  if (!entry.application_url && !entry.applicationUrl && !hasUsableApplicationPath(entry)) missing.push('application_path');
  return missing;
}

function finalizeEntry(entry) {
  const normalized = normalizeScholarshipEntry(entry);
  const quality = assessScholarshipQuality(normalized);
  normalized.qualityScore = quality.score;
  normalized.trustScore = quality.trustScore;
  normalized.qualityFlags = quality.flags;
  normalized.reviewStatus = quality.reviewStatus;
  normalized.review_status = quality.reviewStatus;
  const publishable = isPublishableScholarship(normalized);
  normalized.validationStatus = publishable ? 'publishable' : normalized.reviewStatus;
  normalized.validationNotes = publishable ? 'passes final publishability gate' : reasonNeedsReview(normalized);
  normalized.validation_notes = normalized.validationNotes;
  normalized.application_url = normalized.application_url || normalized.applicationUrl || '';
  return normalized;
}

function partitionReviewedEntries(entries) {
  const reviewed = entries.map(finalizeEntry);
  const approved = reviewed.filter(isPublishableScholarship);
  const approvedNeedsRecheck = reviewed.filter(entry =>
    (entry.reviewStatus === 'approved' || entry.review_status === 'approved') &&
    !isPublishableScholarship(entry)
  );
  const manual = reviewed.filter(entry =>
    !approved.includes(entry) &&
    !approvedNeedsRecheck.includes(entry) &&
    ['needs_review', 'needs_review_stale'].includes(entry.reviewStatus)
  );
  const rejected = reviewed.filter(entry =>
    !approved.includes(entry) &&
    !approvedNeedsRecheck.includes(entry) &&
    !manual.includes(entry)
  );
  return { reviewed, approved, manual, rejected, approvedNeedsRecheck };
}

function approvedPublicShape(entry) {
  const copy = { ...entry };
  delete copy.fullText;
  delete copy.scholarshipDetected;
  return copy;
}

function exportReviewedOutputs(entries, context = {}) {
  ensureOutputDirs();
  const { reviewed, approved, manual, rejected, approvedNeedsRecheck } = partitionReviewedEntries(entries);
  const approvedPublic = approved.map(approvedPublicShape);

  fs.writeFileSync(APPROVED_JSON_PATH, JSON.stringify(approvedPublic, null, 2));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(approvedPublic, null, 2));
  fs.writeFileSync(RAW_SCRAPE_PATH, JSON.stringify(reviewed.map(approvedPublicShape), null, 2));

  const approvedColumns = [
    'id', 'title', 'provider_name', 'provider_type', 'source', 'source_url', 'final_url',
    'application_url', 'application_final_url', 'source_url_status', 'application_url_status',
    'deadline', 'deadline_type', 'amount', 'qualityScore', 'trustScore', 'reviewStatus',
    'lastVerifiedAt'
  ];
  writeCsv(APPROVED_CSV_PATH, approvedPublic, approvedColumns);

  const reviewRows = manual.map(entry => ({
    id: entry.id,
    title: entry.title,
    source: entry.source,
    provider_guess: entry.provider_name,
    provider_type: entry.provider_type,
    source_url: entry.source_url || entry.url,
    final_url: entry.final_url,
    application_url: entry.application_url || entry.applicationUrl,
    application_final_url: entry.application_final_url,
    source_url_status: entry.source_url_status,
    application_url_status: entry.application_url_status,
    qualityScore: entry.qualityScore,
    trustScore: entry.trustScore,
    reviewStatus: entry.reviewStatus,
    reason_needs_review: reasonNeedsReview(entry),
    validation_notes: entry.validationNotes,
    missing_fields: missingFields(entry),
    qualityFlags: entry.qualityFlags,
    suggested_action: suggestedAction(entry)
  }));
  writeCsv(MANUAL_REVIEW_CSV_PATH, reviewRows, [
    'id', 'title', 'source', 'provider_guess', 'provider_type', 'source_url', 'final_url',
    'application_url', 'application_final_url', 'source_url_status', 'application_url_status',
    'qualityScore', 'trustScore', 'reviewStatus', 'reason_needs_review', 'validation_notes',
    'missing_fields', 'qualityFlags', 'suggested_action'
  ]);

  const rejectedRows = rejected.map(entry => ({
    id: entry.id,
    title: entry.title,
    source: entry.source,
    source_url: entry.source_url || entry.url,
    application_url: entry.application_url || entry.applicationUrl,
    source_url_status: entry.source_url_status,
    application_url_status: entry.application_url_status,
    qualityScore: entry.qualityScore,
    trustScore: entry.trustScore,
    reviewStatus: entry.reviewStatus,
    rejection_reason: rejectionReason(entry),
    qualityFlags: entry.qualityFlags
  }));
  writeCsv(REJECTED_CSV_PATH, rejectedRows, [
    'id', 'title', 'source', 'source_url', 'application_url', 'source_url_status',
    'application_url_status', 'qualityScore', 'trustScore', 'reviewStatus',
    'rejection_reason', 'qualityFlags'
  ]);

  const recheckRows = approvedNeedsRecheck.map(entry => ({
    id: entry.id,
    title: entry.title,
    source_url: entry.source_url || entry.url,
    application_url: entry.application_url || entry.applicationUrl,
    source_url_status: entry.source_url_status,
    application_url_status: entry.application_url_status,
    reason: recheckReason(entry),
    qualityFlags: entry.qualityFlags
  }));
  writeCsv(APPROVED_RECHECK_CSV_PATH, recheckRows, [
    'id', 'title', 'source_url', 'application_url', 'source_url_status',
    'application_url_status', 'reason', 'qualityFlags'
  ]);

  writeQualityReport({ reviewed, approved, manual, rejected, approvedNeedsRecheck, context });
  writeErrorSummary({ reviewed, approved, manual, rejected, approvedNeedsRecheck, context });
  return { reviewed, approved, manual, rejected, approvedNeedsRecheck };
}

function suggestedAction(entry) {
  const flags = new Set(entry.qualityFlags || []);
  if (flags.has('aggregator_source')) return 'find official provider/application URL';
  if (flags.has('missing_application_url')) return 'confirm application path or instructions';
  if (flags.has('missing_deadline') || flags.has('recurring_deadline')) return 'check current application round';
  if (flags.has('needs_manual_pdf_review')) return 'inspect PDF manually';
  return 'manual review';
}

function rejectionReason(entry) {
  const flags = new Set(entry.qualityFlags || []);
  if (entry.reviewStatus === 'duplicate') return 'duplicate';
  if (entry.reviewStatus === 'expired' || flags.has('expired')) return 'expired';
  if (entry.reviewStatus === 'broken_link' || flags.has('broken_source_url')) return 'source URL broken';
  if (entry.reviewStatus === 'no_application_path' || flags.has('no_application_path')) return 'no usable application path';
  if (flags.has('weak_content')) return 'no scholarship detected';
  if (flags.has('suspicious_domain')) return 'suspicious domain';
  if (flags.has('login_wall')) return 'login wall';
  return entry.reviewStatus || 'low trust';
}

function recheckReason(entry) {
  const flags = new Set(entry.qualityFlags || []);
  if (flags.has('broken_source_url')) return 'source broken';
  if (flags.has('broken_application_url')) return 'application broken';
  if (flags.has('expired')) return 'deadline expired';
  if (flags.has('weak_content')) return 'content changed';
  if (flags.has('login_wall')) return 'login wall appeared';
  if (flags.has('no_application_path')) return 'application path removed';
  return 'approved record no longer passes publishability gate';
}

function countBy(items, fn) {
  const counts = {};
  for (const item of items) {
    const key = fn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function writeQualityReport({ reviewed, approved, manual, rejected, approvedNeedsRecheck, context }) {
  const verifiedSources = reviewed.filter(e => isStatusOk(e.source_url_status)).length;
  const verifiedApps = reviewed.filter(e => isStatusOk(e.application_url_status)).length;
  const duplicateCount = reviewed.reduce((sum, e) => sum + (e.duplicateCount || 0), 0);
  const expiredCount = reviewed.filter(e => e.reviewStatus === 'expired' || (e.qualityFlags || []).includes('expired')).length;
  const lowTrustCount = reviewed.filter(e => e.reviewStatus === 'low_trust').length;
  const brokenApproved = approvedNeedsRecheck.filter(e => (e.qualityFlags || []).includes('broken_source_url') || (e.qualityFlags || []).includes('broken_application_url')).length;
  const topManual = countBy(manual, reasonNeedsReview).slice(0, 10);
  const topRejected = countBy(rejected, rejectionReason).slice(0, 10);
  const domainApproved = countBy(approved, e => {
    try { return new URL(e.final_url || e.source_url || e.url).hostname.replace(/^www\./, ''); } catch { return 'unknown'; }
  }).slice(0, 12);
  const sourceSuccess = countBy(reviewed.filter(e => isStatusOk(e.source_url_status)), e => e.source).slice(0, 12);
  const sourceFailures = countBy(reviewed.filter(e => !isStatusOk(e.source_url_status)), e => e.source).slice(0, 12);

  const lines = [
    '# Scrape Quality Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Totals',
    `- Total URLs discovered: ${context.totalDiscovered ?? reviewed.length}`,
    `- Total URLs successfully fetched: ${verifiedSources}`,
    `- Total failed: ${reviewed.length - verifiedSources}`,
    `- Approved count: ${approved.length}`,
    `- Manual review count: ${manual.length}`,
    `- Rejected count: ${rejected.length}`,
    `- Stale approved count: ${approvedNeedsRecheck.length}`,
    `- Broken approved count: ${brokenApproved}`,
    `- Expired count: ${expiredCount}`,
    `- Duplicate count: ${duplicateCount}`,
    `- Low trust count: ${lowTrustCount}`,
    `- Source URLs verified: ${verifiedSources}`,
    `- Application URLs verified: ${verifiedApps}`,
    `- Duplicates removed: ${duplicateCount}`,
    '',
    '## Top Manual Review Reasons',
    ...topManual.map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    '## Top Rejection Reasons',
    ...topRejected.map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    '## Sources With Highest Success Count',
    ...sourceSuccess.map(([source, count]) => `- ${source}: ${count}`),
    '',
    '## Sources With Most Failures',
    ...sourceFailures.map(([source, count]) => `- ${source}: ${count}`),
    '',
    '## Domains With Most Approved Scholarships',
    ...domainApproved.map(([domain, count]) => `- ${domain}: ${count}`),
    '',
    '## Precision Estimate',
    `- Latest sample precision: ${context.samplePrecision ?? 'not run yet'}`,
    '',
    '## Recommendations',
    '- Review aggregator rows first and replace them with official provider URLs where possible.',
    '- Add custom scrapers for official portals that currently return broad listing pages.',
    '- Re-run with --sample-check after every approval-rule change.'
  ];
  fs.writeFileSync(QUALITY_REPORT_PATH, lines.join('\n'));
}

function writeErrorSummary(summary) {
  fs.writeFileSync(ERROR_SUMMARY_PATH, JSON.stringify({
    generated_at: new Date().toISOString(),
    failure_reasons: failureStats.reasons,
    failure_examples: failureStats.examples,
    counts: {
      reviewed: summary.reviewed.length,
      approved: summary.approved.length,
      manual_review: summary.manual.length,
      rejected: summary.rejected.length,
      approved_needs_recheck: summary.approvedNeedsRecheck.length
    }
  }, null, 2));
}

async function runReviewExport({ validate = false, sampleOnly = false } = {}) {
  const entries = loadSeed();
  const limited = entries.slice(0, getLimitArg());
  console.log(`Loaded ${limited.length} existing scholarships for review export`);
  if (validate) await validateEntries(limited, { sampleOnly });
  const result = exportReviewedOutputs(limited, { totalDiscovered: limited.length });
  console.log(`Exported approved=${result.approved.length}, review=${result.manual.length}, rejected=${result.rejected.length}`);
  return result;
}

async function runSampleCheck() {
  ensureOutputDirs();
  const approved = JSON.parse(fs.readFileSync(APPROVED_JSON_PATH, 'utf8'));
  const sample = approved.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(50, approved.length));
  console.log(`Sample-checking ${sample.length} approved scholarships`);
  await validateEntries(sample);
  const checked = sample.map(finalizeEntry);
  const rows = checked.map(entry => ({
    id: entry.id,
    title: entry.title,
    source_url: entry.source_url || entry.url,
    application_url: entry.application_url || entry.applicationUrl,
    source_url_status: entry.source_url_status,
    application_url_status: entry.application_url_status,
    provider_legitimate: isOfficialProviderDomain(entry.final_url || entry.source_url || entry.url) || !isSuspiciousDomain(entry.final_url || entry.source_url || entry.url),
    scholarship_related: isProbablyScholarshipPage(entry, '', `${entry.title} ${entry.eligibility} ${entry.instructions}`),
    not_expired: !isExpiredEntry(entry),
    has_application_path: hasUsableApplicationPath(entry),
    pass: isPublishableScholarship(entry),
    notes: isPublishableScholarship(entry) ? 'pass' : rejectionReason(entry)
  }));
  writeCsv(SAMPLE_CHECK_PATH, rows, [
    'id', 'title', 'source_url', 'application_url', 'source_url_status',
    'application_url_status', 'provider_legitimate', 'scholarship_related',
    'not_expired', 'has_application_path', 'pass', 'notes'
  ]);
  const passCount = rows.filter(row => row.pass).length;
  const precision = rows.length ? passCount / rows.length : 0;
  if (fs.existsSync(QUALITY_REPORT_PATH)) {
    const report = fs.readFileSync(QUALITY_REPORT_PATH, 'utf8')
      .replace(/- Latest sample precision: .*/, `- Latest sample precision: ${passCount}/${rows.length} (${Math.round(precision * 100)}%)`);
    fs.writeFileSync(QUALITY_REPORT_PATH, report);
  }
  console.log(`Sample precision: ${passCount}/${rows.length} (${Math.round(precision * 100)}%)`);
  return { passCount, total: rows.length, precision };
}

function writeBaselineReportFromLog() {
  ensureOutputDirs();
  let log = '';
  try { log = fs.readFileSync(path.join(__dirname, '..', 'baseline_normal.log'), 'utf8'); } catch {}
  const seed = (log.match(/Loaded (\d+) seed scholarships/) || [])[1] || 'unknown';
  const totals = (log.match(/Seed: (\d+) \| Scraped new: (\d+) \| Total: (\d+)/) || []);
  const saved = (log.match(/Saved (\d+) active scholarships/) || [])[1] || 'unknown';
  const pushed = (log.match(/Supabase: (\d+) upserted/) || [])[1] || 'not pushed';
  const hidden = (log.match(/Quality gate: hiding (\d+)/) || [])[1] || '0';
  const sourceCounts = [...log.matchAll(/-> (\d+) scholarships/g)].map(m => Number(m[1]));
  const zeroSources = sourceCounts.filter(count => count === 0).length;
  const failureLines = [...log.matchAll(/  ([a-z_]+): (\d+)/g)].map(m => `- ${m[1]}: ${m[2]}`);
  const report = [
    '# Baseline Scrape Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Baseline Commands',
    '- Normal scrape: `node functions/scraper.js`',
    '- Supabase status: `node functions/scraper.js --status`',
    '- Deep scrape was deferred until the new `--no-supabase` guard was added, because the baseline run proved the old CLI would push automatically.',
    '',
    '## Counts From Baseline Normal Run',
    `- Total seed scholarships loaded: ${seed}`,
    `- Total scraped scholarships: ${totals[2] || 'unknown'}`,
    `- Total combined scholarships: ${totals[3] || 'unknown'}`,
    `- Total active after expiry filtering/current gate: ${saved}`,
    `- Total passing current quality gate: ${saved} (${hidden} hidden before write)`,
    `- Total pushed to Supabase: ${pushed}`,
    `- Sources with zero result batches: ${zeroSources}`,
    '',
    '## Most Common Failures',
    ...(failureLines.length ? failureLines : ['- none captured']),
    '',
    '## Obvious Weaknesses',
    '- `data/scholarships.json` mixed seed, scraped, and merely quality-gated records as if they were public data.',
    '- The old quality gate allowed weak rows with missing application URLs or generic instructions.',
    '- Aggregator sources were treated too similarly to official provider sources.',
    '- URL validation existed only as fetch-time behavior, not as a final publishability gate.',
    '- The CLI had no real `--no-supabase` protection, so normal scrape could mutate Supabase during local testing.'
  ];
  fs.writeFileSync(BASELINE_REPORT_PATH, report.join('\n'));
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
  if (isLoginWall(url, html)) {
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
  const activeOnly = entries.filter(e => !isExpired(e.deadline) && shouldPublishEntry(e));
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

// ─── Stipendier.se (Swedish scholarship aggregator) ──────────────────────────

async function scrapeStipendier() {
  console.log('Scraping Stipendier.se...');
  const results = [];
  const pages = [
    'https://www.stipendier.se/',
    'https://www.stipendier.se/stipendier-for-studenter/',
    'https://www.stipendier.se/stipendier-for-doktorander/',
    'https://www.stipendier.se/resestipendier/',
    'https://www.stipendier.se/internationella-stipendier/'
  ];

  for (const pageUrl of pages) {
    const $ = await fetchPage(pageUrl);
    if (!$) continue;

    // Try structured listing elements first
    $('article, .stipendium, .scholarship-item, [class*="stipend"], li[class*="item"]').each((_, el) => {
      const titleEl = $(el).find('h2, h3, h4, a').first();
      const title = titleEl.text().trim();
      if (!title || title.length < 6 || title.length > 200) return;

      const link = $(el).find('a').first().attr('href') || titleEl.attr('href') || '';
      const absUrl = resolveUrl(link, pageUrl) || pageUrl;
      const fullText = $(el).text() + ' stipend scholarship grant sweden student';

      const entry = buildEntry({
        id: `stip-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText,
        source: 'Stipendier.se',
        url: absUrl,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: 'See stipendier.se for application instructions.'
      });
      if (entry) results.push(entry);
    });

    // Fallback: heading scan with Swedish keywords
    if (!results.length) {
      $('h2, h3, h4').each((_, el) => {
        const a = $(el).find('a').first();
        const title = (a.text() || $(el).text()).trim();
        if (!title || title.length < 6 || title.length > 200) return;
        if (!/stipend|scholarship|grant|bursary|award|anslag|bidrag/i.test(title + ' ' + $(el).parent().text())) return;

        const link = a.attr('href') || '';
        const absUrl = resolveUrl(link, pageUrl) || pageUrl;
        const sibling = $(el).nextAll('p').first().text();
        const fullText = title + ' ' + sibling + ' scholarship sweden student funding';

        const entry = buildEntry({
          id: `stip-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline: parseDeadline(fullText),
          fullText,
          source: 'Stipendier.se',
          url: absUrl,
          eligibility: sibling.slice(0, 200) || 'See scholarship page for eligibility.',
          documents: '',
          instructions: 'See stipendier.se for application instructions.'
        });
        if (entry) results.push(entry);
      });
    }

    console.log(`  stipendier.se ${pageUrl.split('/').filter(Boolean).pop()}: ${results.length} so far`);
    await sleep(randomDelay());
  }

  console.log(`  stipendier.se total: ${results.length}`);
  return results;
}

// ─── FindAMasters Sweden ───────────────────────────────────────────────────────

async function scrapeFindAMasters() {
  console.log('Scraping FindAMasters Sweden...');
  const results = [];
  const seenTitles = new Set();

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);

    const baseUrl = 'https://www.findamasters.com/masters-degrees/sweden/?PreviousFunding100=1';
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    await acceptCookieBanners(page);
    await sleep(2000);

    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      if (pageNum > 1) {
        const url = `https://www.findamasters.com/masters-degrees/sweden/?PreviousFunding100=1&Page=${pageNum}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(1500);
        } catch { break; }
      }

      const $ = cheerio.load(await page.content());
      let count = 0;

      $('article, div[class*="result"], div[class*="course"]').each((_, el) => {
        const titleEl = $(el).find('h3, h4, a[class*="title"]').first();
        const title = titleEl.text().trim();
        if (!title || title.length < 8 || title.length > 200 || seenTitles.has(title)) return;
        seenTitles.add(title);

        const link = $(el).find('a').first().attr('href') || '';
        const absUrl = link.startsWith('http') ? link : `https://www.findamasters.com${link}`;
        const fullText = $(el).text() + ' masters scholarship funding sweden';

        const entry = buildEntry({
          id: `fam-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline: parseDeadline(fullText),
          fullText,
          source: 'FindAMasters',
          url: absUrl,
          eligibility: $(el).find('p').first().text().trim(),
          documents: '',
          instructions: 'Apply through the institution directly.'
        });
        if (entry) { results.push(entry); count++; }
      });

      console.log(`  findamasters page ${pageNum}: +${count} (total: ${results.length})`);
      if (count === 0) break;
      await sleep(randomDelay());
    }
  } catch (err) {
    console.warn(`  [warn] FindAMasters failed: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return results;
}

// ─── Inomics Sweden (economics/social-science scholarships, Puppeteer) ────────

async function scrapeInomics() {
  console.log('Scraping Inomics Sweden...');
  const results = [];
  const seenTitles = new Set();

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);

    await page.goto('https://inomics.com/type/scholarship?country=SE', { waitUntil: 'networkidle2', timeout: 35000 });
    await acceptCookieBanners(page);
    await sleep(2000);

    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      if (pageNum > 1) {
        try {
          await page.goto(`https://inomics.com/type/scholarship?country=SE&page=${pageNum}`, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(1500);
        } catch { break; }
      }

      const $ = cheerio.load(await page.content());
      let count = 0;

      $('article, [class*="listing"], [class*="result"], [class*="card"]').each((_, el) => {
        const title = $(el).find('h2, h3, h4, [class*="title"]').first().text().trim();
        if (!title || title.length < 8 || seenTitles.has(title)) return;
        seenTitles.add(title);

        const link = $(el).find('a').first().attr('href') || '';
        const absUrl = link.startsWith('http') ? link : `https://inomics.com${link}`;
        const fullText = $(el).text() + ' scholarship economics sweden';

        const entry = buildEntry({
          id: `inomics-${slugify(title)}`,
          title,
          amount: extractAmount(fullText),
          deadline: parseDeadline(fullText),
          fullText,
          source: 'Inomics',
          url: absUrl,
          eligibility: $(el).find('p').first().text().trim(),
          documents: '',
          instructions: 'Apply via the scholarship provider.'
        });
        if (entry) { results.push(entry); count++; }
      });

      console.log(`  inomics page ${pageNum}: +${count} (total: ${results.length})`);
      if (count === 0) break;
      await sleep(randomDelay());
    }
  } catch (err) {
    console.warn(`  [warn] Inomics failed: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return results;
}

// ─── Academic Positions Sweden ────────────────────────────────────────────────

async function scrapeAcademicPositionsSE() {
  console.log('Scraping Academic Positions Sweden...');
  const results = [];
  const seenTitles = new Set();

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);

    const url = 'https://academicpositions.com/jobs?academic_level=phd&country=SE&employment_type=scholarship';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    await acceptCookieBanners(page);
    await sleep(2000);

    // Scroll to load more
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);
    }

    const $ = cheerio.load(await page.content());

    $('article, [class*="job-card"], [class*="listing"], [class*="position"]').each((_, el) => {
      const title = $(el).find('h2, h3, h4, [class*="title"]').first().text().trim();
      if (!title || title.length < 8 || seenTitles.has(title)) return;
      if (!/scholarship|grant|fellowship|stipend|funded|funding/i.test($(el).text())) return;
      seenTitles.add(title);

      const link = $(el).find('a').first().attr('href') || '';
      const absUrl = link.startsWith('http') ? link : `https://academicpositions.com${link}`;
      const fullText = $(el).text() + ' scholarship sweden research';

      const entry = buildEntry({
        id: `acpos-${slugify(title)}`,
        title,
        amount: extractAmount(fullText),
        deadline: parseDeadline(fullText),
        fullText,
        source: 'Academic Positions',
        url: absUrl,
        eligibility: $(el).find('p').first().text().trim(),
        documents: '',
        instructions: 'Apply through the institution directly.'
      });
      if (entry) results.push(entry);
    });

    console.log(`  academic positions sweden: ${results.length}`);
  } catch (err) {
    console.warn(`  [warn] Academic Positions SE failed: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return results;
}

// ─── Lars Hiertas Minne ───────────────────────────────────────────────────────
// Page uses ul>li>a list — no headings with scholarship keywords, so scrapeUniversity fails.
// scrapeLinkFollower follows each /anslag/ sub-link directly.

async function scrapeLarsHiertas() {
  return scrapeLinkFollower({
    name: 'Lars Hiertas Minne',
    prefix: 'lhm',
    source: 'Lars Hiertas Minne',
    listPages: ['https://www.larshiertasminne.se/anslag/'],
    defaultInstructions: 'Apply through Lars Hiertas Minne foundation portal.',
    textFilter: (url, text) =>
      text.length >= 5 && url.includes('larshiertasminne.se/anslag/') && !url.endsWith('/anslag/')
  });
}

// ─── Scholarship index page — generic deep extractor ─────────────────────────
// For foundation/university/government pages where one landing page lists many
// scholarships as cards, links, or sections. Use scrapeScholarshipIndexPage().

const INDEX_OPPORTUNITY_RE = /scholarship|scholarships|grant|grants|bursary|award|fellowship|funding|funded|stipend|studentship|stipendium|stipendier|bidrag|anslag|understöd|forskningsbidrag|resestipendium|doktorandstipendium|praktik|studiefond|fond|apuraha|apurahat|avustus|stipendi|säätiö/i;

const INDEX_NAV_REJECT_RE = /^(aktuellt|om\s.{2,40}|kontakt|contact|about|publications?|publikationer|pris\s*[&och]+\s*tävlingar|beviljade bidrag|när du ansöker|vad händer med ansökan|när du har beviljats bidrag|suomeksi|eng|lättläst|svenska|english|deutsch|norsk|suomi|start|home|hem|search|sitemap|privacy policy|cookie policy|terms|follow us|rss|share|print|läs mer|read more|visa alla|see all|fler|more)$/i;

const INDEX_SOCIAL_RE = /\b(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|pinterest\.com|reddit\.com|t\.co|bit\.ly|sharer|google\.com\/maps)\b/i;

function isBadIndexLink(url, text) {
  if (!url) return true;
  if (INDEX_SOCIAL_RE.test(url)) return true;
  if (/^(mailto:|tel:|javascript:)/.test(url)) return true;
  if (text && INDEX_NAV_REJECT_RE.test(text.trim())) return true;
  if (text && text.trim().length <= 2) return true;
  return false;
}

function isScholarshipIndexPage($, pageUrl) {
  let opportunityLinkCount = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!href || href === '#' || /^(mailto:|tel:|javascript:)/.test(href)) return;
    if (isBadIndexLink(href, text)) return;
    if (INDEX_OPPORTUNITY_RE.test(text) && text.length > 5 && text.length < 150) opportunityLinkCount++;
  });
  const repeatedContainers = Math.max(
    $('[class*="application-zebra"]').length,
    $('article').length,
    $('[class*="card"]').length,
    $('[class*="grant"]').length,
    $('[class*="stipend"]').length
  );
  const bodyText = $('body').text().toLowerCase();
  const bodyKeywords = (bodyText.match(INDEX_OPPORTUNITY_RE) || []).length;
  return opportunityLinkCount >= 5 || (repeatedContainers >= 3 && bodyKeywords >= 5);
}

function extractScholarshipChildLinks($, pageUrl, options = {}) {
  const { allowedInternalOnly = true, maxChildLinks = 100, childLinkFilter = null } = options;
  let origin;
  try { origin = new URL(pageUrl).origin; } catch { return []; }

  const candidates = [];
  const seenUrls = new Set();

  const containerSelectors = [
    '.application-zebra-header', '.application-zebra', '.inner-wrap',
    'article', '[class*="card"]', '[class*="grant-item"]',
    '[class*="stipend-item"]', 'li[class*="item"]',
    '[class*="listing-item"]', '[class*="opportunity"]'
  ];

  let foundViaContainers = false;

  for (const sel of containerSelectors) {
    let elements;
    try { elements = $(sel); } catch { continue; }
    if (elements.length < 2) continue;
    const prevCount = candidates.length;

    elements.each((_, el) => {
      if (candidates.length >= maxChildLinks) return;
      const $el = $(el);
      const links = $el.find('a[href]');
      let primaryLink = null;
      let primaryText = '';

      links.each((_, a) => {
        const href = $(a).attr('href') || '';
        const text = $(a).text().trim();
        if (!href || href === '#') return;
        const abs = resolveUrl(href, pageUrl);
        if (!abs) return;
        if (allowedInternalOnly && !abs.startsWith(origin)) return;
        if (isBadIndexLink(abs, text)) return;
        if (text.length > 3 && (!primaryLink || text.length > primaryText.length)) {
          primaryLink = abs;
          primaryText = text;
        }
      });

      if (!primaryLink || seenUrls.has(primaryLink) || primaryLink === pageUrl) return;
      if (childLinkFilter && !childLinkFilter(primaryLink, primaryText, $el.text())) return;
      seenUrls.add(primaryLink);

      const contextText = cleanText($el.text()).slice(0, 600);
      const description = $el.find('p').first().text().trim().slice(0, 300);

      const deadlineMatch = contextText.match(/(?:nästa ansökningstid|deadline|sista ansökningsdag|ansökningstid)\s*:?\s*([^\n.]{5,60})/i);
      const deadline = parseDeadline((deadlineMatch || [])[1] || contextText);

      const audienceTags = [];
      $el.find('span, [class*="tag"], [class*="badge"]').each((_, tag) => {
        const t = $(tag).text().trim();
        if (/^(studerande|doktorand|forskare|journalist|lärling|pedagog|konstnär|privatperson|organisation)$/i.test(t)) {
          audienceTags.push(t);
        }
      });

      let applicationUrlCandidate = null;
      links.each((_, a) => {
        const href = $(a).attr('href') || '';
        const text = $(a).text().trim();
        if (/till ansökan|ansök nu|apply now|application form/i.test(text)) {
          const abs = resolveUrl(href, pageUrl);
          if (abs && abs !== primaryLink) applicationUrlCandidate = abs;
        }
      });

      candidates.push({ title: primaryText, url: primaryLink, description, contextText, deadline, audienceTags, applicationUrlCandidate, pageUrl });
    });

    if (candidates.length > prevCount + 1) { foundViaContainers = true; break; }
  }

  // Fallback: scan all links on page for opportunity-keyword text
  if (!foundViaContainers) {
    $('a[href]').each((_, el) => {
      if (candidates.length >= maxChildLinks) return;
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || href === '#' || !text || text.length < 5 || text.length > 150) return;
      const absUrl = resolveUrl(href, pageUrl);
      if (!absUrl || absUrl === pageUrl) return;
      if (allowedInternalOnly && !absUrl.startsWith(origin)) return;
      if (seenUrls.has(absUrl)) return;
      if (isBadIndexLink(absUrl, text)) return;
      if (!INDEX_OPPORTUNITY_RE.test(text)) return;
      if (childLinkFilter && !childLinkFilter(absUrl, text, text)) return;
      seenUrls.add(absUrl);
      const $parent = $(el).closest('li, div, section').first();
      const contextText = cleanText($parent.text()).slice(0, 300);
      candidates.push({ title: text, url: absUrl, description: '', contextText, deadline: parseDeadline(contextText), audienceTags: [], applicationUrlCandidate: null, pageUrl });
    });
  }

  return candidates.slice(0, maxChildLinks);
}

async function scrapeScholarshipIndexPage({
  name,
  prefix,
  pageUrl,
  source,
  providerName,
  providerType = 'foundation',
  defaultInstructions,
  defaultApplicationUrl = null,
  usePuppeteer = false,
  allowedInternalOnly = true,
  maxChildLinks = 100,
  childLinkFilter = null
}) {
  console.log(`Scraping ${name} (index deep extraction)...`);
  const $ = usePuppeteer
    ? await fetchPageJS(pageUrl, 'article, .card, h2, h3, h4')
    : await fetchPage(pageUrl);
  if (!$) return [];

  if (isScholarshipIndexPage($, pageUrl)) {
    console.log(`  [index] Detected scholarship index page: ${pageUrl}`);
  }

  const rawChildren = extractScholarshipChildLinks($, pageUrl, { allowedInternalOnly, maxChildLinks, childLinkFilter });

  let rejectedCount = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!href || href === '#') return;
    const absUrl = resolveUrl(href, pageUrl);
    if (absUrl && isBadIndexLink(absUrl, text)) rejectedCount++;
  });

  console.log(`  [index] Extracted ${rawChildren.length} child opportunities from ${name}`);
  console.log(`  [index] Rejected ~${rejectedCount} navigation/social/application links`);
  if (!rawChildren.length) return [];

  const childEntries = rawChildren.map(child => {
    const fullText = [child.title, child.description, child.contextText, child.audienceTags.join(' '), 'scholarship grant stipend foundation'].filter(Boolean).join(' ');
    const rawAmount = extractAmount(child.contextText);
    const entry = buildEntry({
      id: `${prefix}-${slugify(child.title)}`,
      title: child.title,
      amount: rawAmount && /\d/.test(rawAmount) ? rawAmount : null,
      deadline: child.deadline,
      fullText,
      source: source || name,
      url: child.url,
      applicationUrl: child.applicationUrlCandidate || defaultApplicationUrl || null,
      eligibility: child.description || 'See scholarship page for eligibility.',
      documents: 'See scholarship page for required documents.',
      instructions: defaultInstructions || 'Apply via the scholarship provider.'
    });
    if (!entry) return null;
    entry.provider_name = providerName || name;
    entry.provider_type = providerType;
    entry.index_page_url = child.pageUrl; // parent index page — do NOT use as source_url (causes dedup collision)
    entry.index_child = true; // survives normalizeScholarshipEntry — used by deduplicate to skip appUrl key
    entry.qualityFlags = [...(entry.qualityFlags || []), 'index_child_extracted', 'parent_index_page_verified', 'needs_detail_enrichment'];
    entry.reviewStatus = 'needs_review';
    entry.review_status = 'needs_review';
    return entry;
  }).filter(Boolean);

  console.log(`  [index] Created ${childEntries.length} child entries from ${name}`);

  if (childEntries.length > 0) {
    await enrichEntries(childEntries, { label: name, concurrency: 3 });

    let enrichedCount = 0;
    for (const entry of childEntries) {
      const flags = new Set(entry.qualityFlags || []);
      flags.delete('needs_detail_enrichment');
      if (!entry.unreachable && entry.scrapeSuccess !== false) {
        flags.add('child_detail_verified');
        enrichedCount++;
      } else {
        flags.add('weak_child_detail');
      }
      entry.qualityFlags = [...flags];
    }
    console.log(`  [index] Enriched ${enrichedCount} child opportunities from ${name}`);
  }

  return childEntries;
}

// ─── Bidragsguiden (Swedish grants guide) ────────────────────────────────────

// Svenska kulturfonden
// The listing page exposes each grant as an .application-zebra-header link, with
// deadlines and eligibility in the surrounding .inner-wrap block.

function isKulturfondenStudentRelevant(title, text) {
  const t = `${title} ${text}`.toLowerCase();
  const personOrStudy =
    /studerande|doktorand|forskare|högskola|universitet|studier|praktik|praktikanter|stipendi|akademisk|vetenskaplig|journalistik|konstnär|kulturarbetare|pedagog/.test(t);
  const organizationOnly =
    /föreningshus|vårdinrättning|föreningar och organisationer|utbildningsanordnare|läroinrättningar|skola, småbarnsfostran|bibliotek/.test(t);
  return personOrStudy && (!organizationOnly || /studerande|doktorand|forskare|privatperson/.test(t));
}

async function scrapeKulturfonden() {
  const PORTAL = 'https://ansokan.kulturfonden.fi';
  const NAV_TEXTS = new Set([
    'aktuellt', 'om svenska kulturfonden', 'kontakt', 'publikationer',
    'pris & tävlingar', 'beviljade bidrag', 'när du ansöker',
    'vad händer med ansökan?', 'när du har beviljats bidrag',
    'suomeksi', 'eng', 'lättläst', 'till ansökan'
  ]);

  return scrapeScholarshipIndexPage({
    name: 'Svenska kulturfonden',
    prefix: 'skf',
    pageUrl: 'https://www.kulturfonden.fi/stipendierobidrag/',
    source: 'Svenska kulturfonden',
    providerName: 'Svenska kulturfonden',
    providerType: 'foundation',
    defaultInstructions: "Apply through Svenska kulturfonden's application system at ansokan.kulturfonden.fi.",
    defaultApplicationUrl: 'https://ansokan.kulturfonden.fi/',
    usePuppeteer: false,
    allowedInternalOnly: true,
    maxChildLinks: 100,
    childLinkFilter: (url, text, contextText) => {
      const lowerText = text.toLowerCase().trim();
      if (NAV_TEXTS.has(lowerText)) return false;
      if (url.includes('ansokan.kulturfonden')) return false;
      if (url === 'https://www.kulturfonden.fi/stipendierobidrag/' || url === 'https://www.kulturfonden.fi/') return false;
      return isKulturfondenStudentRelevant(text, contextText);
    }
  });
}

async function scrapeBidragsguiden() {
  // /stipendier/ sub-paths return 404 as of 2026-05; use root domain which loads correctly
  return scrapeLinkFollower({
    name: 'Bidragsguiden',
    prefix: 'bg',
    source: 'Bidragsguiden',
    listPages: [
      'https://bidragsguiden.se/'
    ],
    defaultInstructions: 'See Bidragsguiden for application instructions.',
    textFilter: (url, text) =>
      text.length >= 6 && /stipend|scholarship|grant|anslag|bidrag|award|bursary/i.test(text)
  });
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
  const universityFns = UNIVERSITY_SOURCES.map(cfg => ({ name: cfg.name, fn: () => scrapeUniversity(cfg) }));

  // Config-driven blog aggregators
  const blogFns = BLOG_SOURCES.map(cfg => ({ name: cfg.name, fn: () => {
    // Support custom pagination URL patterns (e.g. Opportunity Desk with query params)
    if (cfg.customPagination) {
      return scrapeBlogAggregatorCustomUrl(cfg);
    }
    return scrapeBlogAggregator(cfg);
  } }));

  // Config-driven Puppeteer portals
  const portalFns = PUPPETEER_PORTAL_SOURCES.map(cfg => ({ name: cfg.name, fn: () => scrapePuppeteerPortal(cfg) }));

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
    scrapeAcademicPositions,
    scrapeFindAMasters,
    scrapeInomics,
    scrapeAcademicPositionsSE,
    scrapeKulturfonden,
    scrapeBidragsguiden,
    scrapeLarsHiertas,
    scrapeStipendier,  // stipendier.se — gracefully returns 0 if site is down
  ];

  const namedCustomFns = customFns.map(fn => ({
    name: fn.name.replace(/^scrape/, '').replace(/([A-Z])/g, ' $1').trim() || 'Custom source',
    fn
  }));
  let allSourceFns = [...universityFns, ...blogFns, ...portalFns, ...namedCustomFns];
  const sourceFilter = cleanText(getArgValue('--source')).toLowerCase();
  if (sourceFilter) {
    allSourceFns = allSourceFns.filter(source => source.name.toLowerCase().includes(sourceFilter));
    console.log(`Source filter "${sourceFilter}" matched ${allSourceFns.length} sources\n`);
  }

  // ── Run sources in parallel batches ───────────────────────────────────────
  const scraped = [];
  console.log(`Running ${allSourceFns.length} sources in batches of ${CONCURRENCY_LIMIT}...\n`);

  for (let i = 0; i < allSourceFns.length; i += CONCURRENCY_LIMIT) {
    const batch = allSourceFns.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.allSettled(batch.map(source => source.fn()));

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
  // Only exclude entries that are STILL expired (not re-scraped with fresh data this run).
  // Annual scholarships share the same ID across years — re-scraped entries must pass through.
  const scrapedIds = new Set(scraped.map(s => s.id));
  let combined = deduplicate([...seed, ...newEntries]).filter(e => !expiredIds.has(e.id) || scrapedIds.has(e.id));

  // Force-expire old scholarship-positions posts (pre-2024) that redirect-loop to homepage
  const OLD_SPOS_RE2 = /scholarship-positions\.com\/.*\/20(1[0-9]|2[0-3])\//;
  for (const e of combined) {
    if (OLD_SPOS_RE2.test(e.url || '')) {
      e.unreachable = true;
      e.scrapeSuccess = false;
      e.deadline = '2020-01-01'; // force expiry so runExpirePass archives them
    }
  }

  // --deep: follow every entry's URL and enrich with real page data
  if (args.includes('--deep')) {
    console.log('\nDeep scrape mode — following individual scholarship pages...');
    combined = await enrichEntries(combined, { label: 'all sources', force: true });
  }

  const limit = getLimitArg();
  if (Number.isFinite(limit)) {
    combined = combined.slice(0, limit);
    console.log(`Limit applied: ${combined.length} combined entries`);
  }

  console.log(`\nSeed: ${seed.length} | Scraped new: ${newEntries.length} | Total: ${combined.length}`);

  // Strip expired before writing JSON — approved entries always pass; scraped need score >= 50
  console.log('\nValidating source and application URLs before export...');
  await validateEntries(combined);
  const output = exportReviewedOutputs(combined, {
    totalDiscovered: seed.length + scraped.length,
    totalScraped: scraped.length,
    totalCombined: combined.length
  });
  console.log(`Final gate: approved=${output.approved.length}, manual_review=${output.manual.length}, rejected=${output.rejected.length}`);
  console.log(`Saved approved scholarships to ${APPROVED_JSON_PATH}`);

  // Push to Supabase — reuse the existing helper instead of duplicating logic
  if (supabase) {
    console.log('\nPushing to Supabase...');
    const supabaseEntries = args.includes('--approved-only') ? output.approved : output.reviewed;
    const result = await pushEntriesToSupabase(supabaseEntries, { label: 'review-gated scholarships', stats: runStats });
    await logRun(runStats);
    console.log(`Supabase: ${result.success} upserted, ${result.fail} failed, ${runStats.blocked} blocked URLs`);
    await runExpirePass(output.reviewed);
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

      const fullText = $(el).text();
      let rawLink2 = a.attr('href') || '';
      if (!rawLink2 || SOCIAL_DOMAINS.test(rawLink2)) {
        rawLink2 = $(el).find('a').filter((_, a) => !SOCIAL_DOMAINS.test($(a).attr('href') || '')).first().attr('href') || '';
      }
      const absUrl = resolveUrl(rawLink2, url) || url;

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

  if (cfg.enrichAfter && results.length > 0) {
    await enrichEntries(results, { label: cfg.name });
  }

  return results;
}

// ─── Entry point (CLI routing) ────────────────────────────────────────────────

const urlIdx = args.indexOf('--url');
const listIdx = args.indexOf('--list');

async function routeCli() {
  if (args.includes('--status')) return printStatus();
  if (args.includes('--push-json')) return pushJsonToSupabase();
  if (args.includes('--validate-only')) return runReviewExport({ validate: true });
  if (args.includes('--review-export')) return runReviewExport({ validate: false });
  if (args.includes('--sample-check')) return runSampleCheck();
  if (args.includes('--write-baseline-report')) {
    writeBaselineReportFromLog();
    console.log(`Baseline report written to ${BASELINE_REPORT_PATH}`);
    return;
  }
  if (urlIdx !== -1 && args[urlIdx + 1]) return scrapeUrl(args[urlIdx + 1]);
  if (listIdx !== -1 && args[listIdx + 1]) return scrapeList(args[listIdx + 1]);
  return main();
}

if (require.main === module) {
  routeCli()
    .catch(err => { console.error('Fatal:', err); process.exitCode = 1; })
    .finally(() => closeSharedBrowser());
}

module.exports = {
  canonicalizeUrl,
  calculateSimilarity,
  deduplicate,
  detectCaptchaOrBotWall,
  detectLoginWall,
  detectSoft404,
  extractAmount,
  extractApplicationUrl,
  extractApplicationUrlStrict,
  hasUsableApplicationPath,
  isExpired,
  isProbablyScholarshipPage,
  isPublishableScholarship,
  isSuspiciousDomain,
  normalizeUrl,
  parseDeadline,
  routeCli,
  scrapeKulturfonden,
  scrapeScholarshipIndexPage,
  isScholarshipIndexPage,
  extractScholarshipChildLinks,
  isBadIndexLink
};
