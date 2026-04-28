const TODAY = new Date("2026-04-28T00:00:00");

const citizenshipMap = {
  Sweden: "Swedish",
  "EU / EEA": "EU/EEA",
  "Nordic (non-EU)": "EU/EEA",
  Other: "International non-EU"
};

const needMap = {
  Some: "Medium",
  No: "Low",
  "Prefer not to say": null
};

export function normalizeProfile(profile = {}) {
  return {
    ...profile,
    level: profile.level || profile.degree_level || null,
    field: normalizeField(profile.field),
    nationality: profile.nationality || citizenshipMap[profile.citizenship] || profile.citizenship || null,
    need: needMap[profile.need] || needMap[profile.financial_need] || profile.need || profile.financial_need || null,
    interests: normalizeInterests(profile.interests || profile.interest),
    tuitionSupport: profile.tuitionSupport || (profile.category === "Tuition" ? "Yes" : null)
  };
}

export function daysUntil(deadline, today = TODAY) {
  if (!deadline || deadline === "Unknown") return null;
  const date = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date - today) / 86400000);
}

export function isScholarshipOpen(item, today = TODAY) {
  const days = daysUntil(item.deadline, today);
  return days === null || days >= 0;
}

export function scoreScholarship(item, profileInput, options = {}) {
  const profile = normalizeProfile(profileInput);
  const reasons = [];
  const blockers = [];
  let score = 0;

  const levels = asArray(item.level);
  const fields = asArray(item.fields);
  const nationalities = asArray(item.nationality);
  const needs = asArray(item.need);
  const interests = asArray(item.interests);
  const deadlineDays = daysUntil(item.deadline, options.today || TODAY);

  if (!isScholarshipOpen(item, options.today || TODAY)) {
    blockers.push("Past deadline");
  }

  if (profile.level && levels.length && !matchesAny(levels, profile.level)) {
    blockers.push(`Requires ${levels.join(" / ")}`);
  } else if (profile.level && matchesAny(levels, profile.level)) {
    score += 24;
    reasons.push(profile.level);
  }

  if (profile.field && fields.length && !matchesAny(fields, profile.field) && !fields.includes("Any field")) {
    blockers.push(`Field: ${fields.slice(0, 2).join(" / ")}`);
  } else if (profile.field && (matchesAny(fields, profile.field) || fields.includes("Any field"))) {
    score += fields.includes("Any field") ? 16 : 22;
    reasons.push(fields.includes("Any field") ? "Any field eligible" : profile.field);
  }

  if (profile.nationality && nationalities.length && !matchesAny(nationalities, profile.nationality) && profile.nationality !== "Any nationality") {
    blockers.push(`Nationality: ${nationalities.join(" / ")}`);
  } else if (profile.nationality && matchesAny(nationalities, profile.nationality)) {
    score += 20;
    reasons.push(profile.nationality);
  }

  if (profile.need && matchesAny(needs, profile.need)) {
    score += 14;
    reasons.push(`${profile.need} funding need`);
  }

  const interestMatch = profile.interests.find((interest) => matchesAny(interests, interest));
  if (interestMatch || interests.includes("Any interest")) {
    score += interestMatch ? 10 : 5;
    reasons.push(interestMatch || "Broad interest fit");
  }

  if (profile.tuitionSupport === "Yes" && item.category === "Tuition") {
    score += 8;
    reasons.push("Tuition support");
  }

  if (deadlineDays !== null && deadlineDays >= 0) {
    score += deadlineDays <= 21 ? 4 : 6;
    reasons.push(deadlineDays <= 21 ? "Deadline soon" : "Open deadline");
  }

  const qualityScore = item.qualityScore ?? item.quality_score;
  if (typeof qualityScore === "number" && qualityScore < 55) {
    score -= 10;
    blockers.push("Needs review");
  }

  const eligible = blockers.length === 0;
  return {
    ...item,
    score: Math.max(0, Math.min(100, eligible ? score : Math.min(score, 49))),
    eligible,
    reasons: [...new Set(reasons)].slice(0, 6),
    blockers: [...new Set(blockers)].slice(0, 5),
    deadlineDays
  };
}

export function rankScholarships(items, profile, options = {}) {
  return items
    .map((item) => scoreScholarship(item, profile, options))
    .filter((item) => options.includeIneligible || item.eligible)
    .sort((a, b) => b.score - a.score || sortDeadline(a.deadlineDays, b.deadlineDays));
}

function normalizeField(field) {
  if (field === "Computer Science") return "IT";
  if (field === "Business") return "Economics";
  if (field === "Natural Sciences") return "Natural sciences";
  return field || null;
}

function normalizeInterests(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function matchesAny(values, target) {
  const cleanTarget = String(target || "").toLowerCase();
  return values.some((value) => String(value).toLowerCase() === cleanTarget);
}

function sortDeadline(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
