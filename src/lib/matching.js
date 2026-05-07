const TODAY = new Date();

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

  const allNationalitiesOpen = nationalities.includes("Swedish") && nationalities.includes("EU/EEA") && nationalities.includes("International non-EU");
  if (allNationalitiesOpen) {
    score += 20;
    reasons.push("Open to all nationalities");
  } else if (profile.nationality && nationalities.length && !matchesAny(nationalities, profile.nationality) && profile.nationality !== "Any nationality") {
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
    if (deadlineDays <= 7) {
      score += 8;
      reasons.push("Closing this week");
    } else if (deadlineDays <= 30) {
      score += 6;
      reasons.push("Deadline soon");
    } else {
      score += 4;
      reasons.push("Open deadline");
    }
  }

  const meritTerms = ["academic merit", "academic excellence", "high academic", "top student", "outstanding", "merit-based", "merit based", "academic achievement"];
  const meritText = [item.eligibility, item.requirements, item.instructions, (item.requirementKeywords || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
  const hasMeritFocus = meritTerms.some((mt) => meritText.includes(mt));
  if (profile.gpa) {
    if (profile.gpa === "Top 10%") {
      score += hasMeritFocus ? 10 : 5;
      reasons.push("Strong academic record");
    } else if (profile.gpa === "Top 25%" && hasMeritFocus) {
      score += 4;
      reasons.push("Good academic fit");
    }
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
  const map = {
    "Computer Science": "IT",
    "Data Science": "IT",
    "Software Engineering": "IT",
    "Information Technology": "IT",
    "Cybersecurity": "IT",
    "Business": "Economics",
    "Business Administration": "Economics",
    "Finance": "Economics",
    "Accounting": "Economics",
    "Marketing": "Economics",
    "Management": "Economics",
    "Natural Sciences": "Natural sciences",
    "Biology": "Natural sciences",
    "Chemistry": "Natural sciences",
    "Physics": "Natural sciences",
    "Environmental Science": "Natural sciences",
    "Mathematics": "Natural sciences",
    "Psychology": "Social sciences",
    "Political Science": "Social sciences",
    "International Relations": "Social sciences",
    "Sociology": "Social sciences",
    "Anthropology": "Social sciences",
    "Communication": "Social sciences",
    "Journalism": "Humanities",
    "History": "Humanities",
    "Philosophy": "Humanities",
    "Linguistics": "Humanities",
    "Literature": "Humanities",
    "Languages": "Humanities",
    "Fine Arts": "Humanities",
    "Mechanical Engineering": "Engineering",
    "Electrical Engineering": "Engineering",
    "Civil Engineering": "Engineering",
    "Chemical Engineering": "Engineering",
    "Biomedical Engineering": "Engineering",
    "Nursing": "Medicine",
    "Public Health": "Medicine",
    "Dentistry": "Medicine",
    "Pharmacy": "Medicine",
    "Urban Planning": "Architecture",
    "Interior Design": "Architecture",
    "Graphic Design": "Architecture",
  };
  return map[field] || field || null;
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
