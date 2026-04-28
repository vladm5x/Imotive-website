'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeScholarshipEntry } = require('./scholarshipQuality');

const DATA_PATH = path.join(__dirname, '..', 'data', 'scholarships.json');

function main() {
  const entries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).map(normalizeScholarshipEntry);
  const buckets = {
    publishable: entries.filter(entry => entry.reviewStatus === 'publishable'),
    needs_review: entries.filter(entry => entry.reviewStatus === 'needs_review'),
    hide: entries.filter(entry => entry.reviewStatus === 'hide')
  };

  console.log(`Scholarships audited: ${entries.length}`);
  console.log(`  publishable : ${buckets.publishable.length}`);
  console.log(`  needs review: ${buckets.needs_review.length}`);
  console.log(`  hide        : ${buckets.hide.length}`);

  const flagCounts = new Map();
  entries.forEach(entry => {
    (entry.qualityFlags || []).forEach(flag => {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    });
  });

  console.log('\nTop quality flags:');
  [...flagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([flag, count]) => console.log(`  ${flag}: ${count}`));

  console.log('\nLowest quality examples:');
  entries
    .sort((a, b) => a.qualityScore - b.qualityScore)
    .slice(0, 12)
    .forEach(entry => {
      console.log(`  ${entry.qualityScore} [${entry.reviewStatus}] ${entry.title} (${entry.source || 'unknown source'})`);
      if (entry.qualityFlags?.length) console.log(`     flags: ${entry.qualityFlags.join(', ')}`);
    });
}

main();
