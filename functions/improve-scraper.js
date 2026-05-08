'use strict';

/**
 * Iterative scraper improvement loop.
 *
 * Runs the scraper with --no-supabase, audits the results, reports quality
 * metrics, and repeats until quality plateaus or max iterations are reached.
 * Supabase writes are permanently forbidden in this mode.
 *
 * Usage:
 *   node functions/improve-scraper.js [--iterations N] [--limit N] [--source NAME] [--fetch-pages]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Safety constant exported so tests can assert it without running the loop
const SUPABASE_FORBIDDEN = true;

const { auditResults, summarizeAudit, writeAuditResults } = require('./resultAudit');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const DATA_DIR = path.join(__dirname, '..', 'data');
const APPROVED_JSON_PATH = path.join(DATA_DIR, 'approved_scholarships.json');
const RAW_SCRAPE_PATH = path.join(DATA_DIR, 'scraped_scholarships_raw.json');
const IMPROVEMENT_LOG_PATH = path.join(REPORTS_DIR, 'scraper_improvement_log.md');
const AUDIT_CSV_PATH = path.join(REPORTS_DIR, 'result_audit.csv');
const AUDIT_JSON_PATH = path.join(REPORTS_DIR, 'result_audit.json');

const args = process.argv.slice(2);

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] || null : null;
}

function hasArg(flag) {
  return args.includes(flag);
}

const MAX_ITERATIONS = Math.max(1, Math.min(10, Number(getArgValue('--iterations')) || 3));
const LIMIT = getArgValue('--limit') || null;
const FETCH_PAGES = hasArg('--fetch-pages');
const SOURCE_FILTER = getArgValue('--source') || null;

function ensureDirs() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function runTestSuite() {
  console.log('\n[tests] Running test suite...');
  const result = spawnSync('node', ['functions/scraper.test.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    timeout: 60000
  });
  if (result.status !== 0) {
    console.warn('[tests] Test suite had failures — continuing anyway');
    return false;
  }
  console.log('[tests] All tests passed');
  return true;
}

function runScraperSubprocess(iteration) {
  const scraperArgs = ['functions/scraper.js', '--no-supabase'];
  if (LIMIT) scraperArgs.push('--limit', LIMIT);
  if (SOURCE_FILTER) scraperArgs.push('--source', SOURCE_FILTER);

  // Defensive: ensure --no-supabase is always present
  if (!scraperArgs.includes('--no-supabase')) {
    throw new Error('FATAL: --no-supabase must be present in improve mode');
  }

  console.log(`\n[iter ${iteration}] node ${scraperArgs.join(' ')}`);

  const result = spawnSync('node', scraperArgs, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    // Pass NO_SUPABASE=1 in env as extra guard in case scraper reads env directly
    env: { ...process.env, NO_SUPABASE: '1', SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '' },
    timeout: 600000 // 10 min max per scraper run
  });

  if (result.error) {
    console.error(`[iter ${iteration}] Scraper process error: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.warn(`[iter ${iteration}] Scraper exited with code ${result.status}`);
    // Non-zero exit is often just a partial run — still try to audit whatever was written
  }
  return true;
}

async function runIteration(iteration, prevSummary) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  IMPROVEMENT ITERATION ${iteration}/${MAX_ITERATIONS}`);
  console.log(`${'═'.repeat(60)}`);

  runScraperSubprocess(iteration);

  const rawEntries = loadJsonSafe(RAW_SCRAPE_PATH);
  const approved = loadJsonSafe(APPROVED_JSON_PATH);

  const toAudit = rawEntries.length ? rawEntries : approved;
  console.log(`\n[iter ${iteration}] Auditing ${toAudit.length} entries (fetchPages=${FETCH_PAGES})...`);

  if (!toAudit.length) {
    console.warn(`[iter ${iteration}] No entries to audit — scraper may have failed or produced nothing`);
    return { summary: null, auditResultsList: [] };
  }

  let lastPct = 0;
  const auditResultsList = await auditResults(toAudit, {
    fetchPages: FETCH_PAGES,
    concurrency: FETCH_PAGES ? 3 : 8,
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 100);
      if (pct >= lastPct + 10 || done === total) {
        console.log(`  [audit] ${done}/${total} (${pct}%)`);
        lastPct = pct;
      }
    }
  });

  const summary = summarizeAudit(auditResultsList);
  writeAuditResults(auditResultsList, { csvPath: AUDIT_CSV_PATH, jsonPath: AUDIT_JSON_PATH });
  appendToLog(iteration, summary, auditResultsList, prevSummary);

  return { summary, auditResultsList };
}

function appendToLog(iteration, summary, auditResultsList, prevSummary) {
  const lines = [];

  if (iteration === 1) {
    lines.push('# Scraper Improvement Log');
    lines.push('');
    lines.push(`Started: ${new Date().toISOString()}`);
    lines.push(`Max iterations: ${MAX_ITERATIONS} | Limit: ${LIMIT || 'none'} | Source: ${SOURCE_FILTER || 'all'}`);
    lines.push('');
  }

  lines.push(`## Iteration ${iteration}`);
  lines.push(`Timestamp: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('### Quality Summary');
  lines.push(`- Total audited: ${summary.total}`);
  lines.push(`- Pass: ${summary.pass} (${Math.round(summary.pass_rate * 100)}%)`);
  lines.push(`- Manual review: ${summary.manual_review}`);
  lines.push(`- Reject: ${summary.reject}`);

  if (prevSummary) {
    const delta = summary.pass - prevSummary.pass;
    const deltaRate = ((summary.pass_rate - prevSummary.pass_rate) * 100).toFixed(1);
    lines.push('');
    lines.push('### Delta vs Previous Iteration');
    lines.push(`- Pass count: ${delta >= 0 ? '+' : ''}${delta}`);
    lines.push(`- Pass rate: ${deltaRate}%`);
  }

  if (Object.keys(summary.source_page_types).length) {
    lines.push('');
    lines.push('### Source Page Types');
    for (const [t, n] of Object.entries(summary.source_page_types).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${t}: ${n}`);
    }
  }

  if (summary.top_issues.length) {
    lines.push('');
    lines.push('### Top Issues');
    for (const [issue, count] of summary.top_issues) {
      lines.push(`- ${issue}: ${count}`);
    }
  }

  const needsFix = auditResultsList
    .filter(r => r.audit_status !== 'pass')
    .slice(0, 25);

  if (needsFix.length) {
    lines.push('');
    lines.push('### Entries Needing Attention');
    for (const r of needsFix) {
      lines.push(`- [${r.audit_status}] ${r.title || r.id} | ${r.source}`);
      lines.push(`  source: ${r.source_url || 'missing'}`);
      lines.push(`  issue: ${r.audit_reason}`);
      if (r.suggested_fix) lines.push(`  fix: ${r.suggested_fix}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  if (iteration === 1 || !fs.existsSync(IMPROVEMENT_LOG_PATH)) {
    fs.writeFileSync(IMPROVEMENT_LOG_PATH, lines.join('\n'));
  } else {
    fs.appendFileSync(IMPROVEMENT_LOG_PATH, lines.join('\n'));
  }
}

function hasImproved(current, previous, minGain = 1) {
  if (!previous) return true;
  return (current.pass - previous.pass) >= minGain;
}

async function run() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  Scraper Improvement Loop            ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Max iterations : ${MAX_ITERATIONS}`);
  console.log(`Limit          : ${LIMIT || 'none'}`);
  console.log(`Source filter  : ${SOURCE_FILTER || 'all'}`);
  console.log(`Fetch pages    : ${FETCH_PAGES}`);
  console.log(`Supabase       : DISABLED (safety guard active)`);

  // Refuse to write to Supabase — if someone passes env vars, block unless explicitly overridden
  if ((process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_KEY) && !hasArg('--allow-supabase')) {
    console.error('\n[error] SUPABASE_URL/SERVICE_KEY detected in environment.');
    console.error('        Improvement mode never writes to Supabase.');
    console.error('        Unset those env vars or pass --allow-supabase to override.\n');
    process.exitCode = 1;
    return;
  }

  ensureDirs();
  runTestSuite();

  let prevSummary = null;
  let lastSummary = null;

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    const { summary } = await runIteration(iter, prevSummary);

    if (!summary) {
      console.error(`[iter ${iter}] No summary produced — stopping`);
      break;
    }

    lastSummary = summary;
    console.log(`\n[iter ${iter}] Pass: ${summary.pass}/${summary.total} (${Math.round(summary.pass_rate * 100)}%) | Manual: ${summary.manual_review} | Reject: ${summary.reject}`);

    if (iter > 1 && !hasImproved(summary, prevSummary)) {
      console.log(`\n  Quality plateaued at iteration ${iter}. Stopping early.`);
      break;
    }

    prevSummary = summary;

    if (iter < MAX_ITERATIONS) {
      console.log(`\n  Inspect reports/scraper_improvement_log.md for suggested fixes, then re-run.`);
    }
  }

  if (lastSummary) {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║  Final                               ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`Pass rate : ${Math.round(lastSummary.pass_rate * 100)}% (${lastSummary.pass}/${lastSummary.total})`);
    console.log(`Manual    : ${lastSummary.manual_review}`);
    console.log(`Reject    : ${lastSummary.reject}`);
    console.log('\nReports:');
    console.log(`  ${IMPROVEMENT_LOG_PATH}`);
    console.log(`  ${AUDIT_CSV_PATH}`);
    console.log(`  ${AUDIT_JSON_PATH}`);
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal:', err);
    process.exitCode = 1;
  });
}

module.exports = { SUPABASE_FORBIDDEN, run };
