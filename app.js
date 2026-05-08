import { daysUntil, rankScholarships } from "./src/lib/matching.js";
import { fetchScholarships, saveScholarshipForUser } from "./src/lib/scholarships.js";
import { getSupabase } from "./src/lib/supabaseClient.js";
import { getSession } from "./src/lib/account.js";

let scholarships = [];

const SIGNUP_KEY = "imotive_signup_answers";
const LEGACY_PROFILE_KEY = "grantlyProfile";
const SAVED_KEY = "imotive_saved";
const APP_STATUS_KEY = "imotive_app_status";
const PAGE_REVIEW_KEY = "imotive_page_reviews";
const feedbackStorageKey = "grantlyFeedback";
const state = {
  activeRank: 0,
  reviewSearch: "",
  reviewFilter: "all"
};

const pageReviewTypes = [
  {
    id: "usable",
    label: "Good usable page",
    shortLabel: "Good",
    description: "Specific scholarship/funding page with enough details to keep."
  },
  {
    id: "main_page",
    label: "Main page - dive deeper",
    shortLabel: "Dive deeper",
    description: "Relevant hub/listing page, but scraper should follow links or sections."
  },
  {
    id: "not_relevant",
    label: "Not relevant",
    shortLabel: "Reject",
    description: "Not a scholarship/funding opportunity for this product."
  },
  {
    id: "blocked",
    label: "Blocked/login/captcha",
    shortLabel: "Blocked",
    description: "Useful-looking page, but access prevents reliable scraping."
  },
  {
    id: "duplicate",
    label: "Duplicate",
    shortLabel: "Duplicate",
    description: "Same opportunity as a better existing source."
  },
  {
    id: "needs_manual",
    label: "Needs manual check",
    shortLabel: "Check",
    description: "Unclear page. Park it for a second pass."
  }
];

const fallbackScholarships = [
  {
    id: "lund-global-scholarship",
    title: "Lund University Global Scholarship",
    amount: "Partial tuition fee scholarship",
    deadline: "2027-02-15",
    category: "Tuition",
    level: ["Bachelor", "Master"],
    fields: ["Any field"],
    nationality: ["International non-EU"],
    interests: ["Leadership", "Any interest"],
    need: ["Medium", "High"],
    source: "Lund University",
    url: "https://www.lunduniversity.lu.se/international-admissions/fees-and-funding/scholarships-and-funding",
    eligibility: "High-achieving fee-paying applicants to Lund University bachelor's or master's programmes.",
    documents: "Programme application, scholarship motivation, academic records.",
    instructions: "Apply through Lund University's scholarship application during the admission period.",
    requirementKeywords: ["fee-paying", "academic merit", "admitted programme", "motivation"],
    requiredApplicantInfo: ["first name", "last name", "email", "programme", "study level", "nationality", "application number", "academic records"]
  },
  {
    id: "lund-travel-grant",
    title: "Lund Student Travel Grant",
    amount: "SEK 5,000-25,000",
    deadline: "2026-05-20",
    category: "Travel",
    level: ["Bachelor", "Master", "PhD"],
    fields: ["Any field"],
    nationality: ["Swedish", "EU/EEA", "International non-EU"],
    interests: ["Travel", "Research"],
    need: ["Low", "Medium", "High"],
    source: "Lund University",
    url: "https://www.lunduniversity.lu.se/international-admissions/fees-and-funding/scholarships-and-funding",
    eligibility: "Students planning exchange, fieldwork, conference travel, or thesis-related study abroad.",
    documents: "Budget, travel plan, transcript, supervisor or programme confirmation.",
    instructions: "Check the relevant faculty call and submit before the travel period begins.",
    requirementKeywords: ["travel", "exchange", "fieldwork", "conference", "thesis"],
    requiredApplicantInfo: ["first name", "last name", "school", "subject", "travel dates", "destination", "budget", "transcript"]
  },
  {
    id: "engineering-foundation-award",
    title: "Engineering Advancement Foundation Award",
    amount: "SEK 15,000",
    deadline: "2026-06-01",
    category: "Research",
    level: ["Master", "PhD"],
    fields: ["Engineering"],
    nationality: ["Swedish", "EU/EEA", "International non-EU"],
    interests: ["Research", "Sustainability"],
    need: ["Medium", "High"],
    source: "Lund University - LTH",
    url: "https://www.lth.se",
    eligibility: "LTH students with a research or thesis project connected to technology, energy, or sustainability.",
    documents: "Project summary, CV, budget, supervisor statement.",
    instructions: "Submit a project proposal and budget to the foundation contact listed by the faculty.",
    requirementKeywords: ["engineering", "research", "technology", "energy", "sustainability"],
    requiredApplicantInfo: ["first name", "last name", "faculty", "subject", "project title", "supervisor", "CV", "budget"]
  }
];

const defaultProfile = {
  firstName: "",
  lastName: "",
  email: "",
  university: "Lund University",
  level: "Master",
  field: "Engineering",
  nationality: "International non-EU",
  year: "1",
  need: "High",
  interest: "Sustainability",
  tuitionSupport: "Yes",
  notes: ""
};

function formatDeadline(dateString) {
  if (!dateString || dateString === "Unknown") return "Unknown";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getStoredProfile() {
  try {
    const signupRaw = localStorage.getItem(SIGNUP_KEY);
    if (signupRaw) return JSON.parse(signupRaw);
    const legacy = JSON.parse(localStorage.getItem(LEGACY_PROFILE_KEY) || "null");
    if (legacy) return { ...defaultProfile, ...legacy };
  } catch {
    // fall through
  }
  return { ...defaultProfile };
}

function hasAnyProfile() {
  return Boolean(localStorage.getItem(SIGNUP_KEY) || localStorage.getItem(LEGACY_PROFILE_KEY));
}

function saveProfile(profile) {
  localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(profile));
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem(SIGNUP_KEY) || "null"); } catch { return null; }
  })();
  if (existing) {
    const merged = {
      ...existing,
      university: profile.university || existing.university,
      level: profile.level || existing.level,
      field: profile.field || existing.field,
      nationality: profile.nationality || existing.nationality,
      need: profile.need || existing.need,
      interest: profile.interest || existing.interest
    };
    localStorage.setItem(SIGNUP_KEY, JSON.stringify(merged));
  } else {
    localStorage.setItem(SIGNUP_KEY, JSON.stringify(profile));
  }
}

function getSavedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function getAppStatuses() {
  try {
    return JSON.parse(localStorage.getItem(APP_STATUS_KEY) || "{}");
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function setAppStatus(id, status) {
  const statuses = getAppStatuses();
  if (status) {
    statuses[id] = status;
  } else {
    delete statuses[id];
  }
  localStorage.setItem(APP_STATUS_KEY, JSON.stringify(statuses));
  saveScholarshipForUser(id, status || "saved").catch(() => {});
}

function getRankedScholarships(profile) {
  return rankScholarships(scholarships, profile, { includeIneligible: false });
}

function getPageReviews() {
  try {
    return JSON.parse(localStorage.getItem(PAGE_REVIEW_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePageReviews(reviews) {
  localStorage.setItem(PAGE_REVIEW_KEY, JSON.stringify(reviews));
}

function setPageReview(id, patch) {
  const reviews = getPageReviews();
  reviews[id] = {
    ...(reviews[id] || {}),
    ...patch,
    updatedAt: new Date().toISOString()
  };
  savePageReviews(reviews);
}

function reviewTypeById(id) {
  return pageReviewTypes.find((type) => type.id === id) || null;
}

function reviewSearchText(item) {
  return [
    item.title,
    item.source,
    item.url,
    item.applicationUrl || item.application_url,
    item.eligibility,
    item.instructions,
    item.documents,
    asList(item.fields).join(" "),
    asList(item.level).join(" "),
    asList(item.qualityFlags || item.quality_flags).join(" ")
  ].filter(Boolean).join(" ").toLowerCase();
}

function getFilteredReviewItems() {
  const reviews = getPageReviews();
  const q = state.reviewSearch.trim().toLowerCase();
  return scholarships.filter((item) => {
    const review = reviews[item.id] || {};
    const type = review.type || "";

    if (state.reviewFilter === "unreviewed" && type) return false;
    if (state.reviewFilter !== "all" && state.reviewFilter !== "unreviewed" && type !== state.reviewFilter) return false;
    if (q && !reviewSearchText(item).includes(q)) return false;

    return true;
  });
}

function pageReviewStats() {
  const reviews = getPageReviews();
  const counts = Object.fromEntries(pageReviewTypes.map((type) => [type.id, 0]));
  let reviewed = 0;

  scholarships.forEach((item) => {
    const type = reviews[item.id]?.type;
    if (!type) return;
    reviewed += 1;
    if (counts[type] !== undefined) counts[type] += 1;
  });

  return { reviewed, total: scholarships.length, counts };
}

function pageReviewCard(item, index, total) {
  const reviews = getPageReviews();
  const review = reviews[item.id] || {};
  const currentType = reviewTypeById(review.type);
  const days = daysUntil(item.deadline);
  const deadlineText = days === null ? "Unknown / rolling" : days < 0 ? "Past deadline" : `${days} days left`;
  const sourceUrl = item.url || item.source_url || "";
  const applicationUrl = item.applicationUrl || item.application_url || "";
  const flags = asList(item.qualityFlags || item.quality_flags).slice(0, 6);
  const fields = asList(item.fields);
  const levels = asList(item.level);

  return `
    <article class="rank-card review-card">
      <div class="rank-kicker">
        <span>Page ${index + 1} of ${total}</span>
        <span class="deadline">${escapeHtml(deadlineText)}</span>
      </div>
      <span class="score-chip review-status-chip ${review.type ? "is-reviewed" : ""}">
        ${review.type ? escapeHtml(currentType?.shortLabel || "Reviewed") : "Unreviewed"}
      </span>
      <h2>${escapeHtml(item.title || "Untitled scholarship page")}</h2>
      <p class="rank-summary">${escapeHtml(item.eligibility || item.instructions || "No extracted summary yet.")}</p>
      <div class="pill-row">
        ${item.source ? `<span class="pill">${escapeHtml(item.source)}</span>` : ""}
        ${item.category ? `<span class="pill">${escapeHtml(item.category)}</span>` : ""}
        ${levels[0] ? `<span class="pill">${escapeHtml(levels.join(" / "))}</span>` : ""}
        ${fields[0] ? `<span class="pill">${escapeHtml(fields.slice(0, 2).join(" / "))}</span>` : ""}
      </div>
      <div class="rank-details review-page-details">
        <div>
          <span>Source page</span>
          ${sourceUrl
            ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceUrl)}</a>`
            : `<strong>No source URL</strong>`}
        </div>
        <div>
          <span>Application page</span>
          ${applicationUrl
            ? `<a href="${escapeHtml(applicationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(applicationUrl)}</a>`
            : `<strong>None found</strong>`}
        </div>
      </div>
      <div class="needed-info">
        <span>What the scraper extracted</span>
        <p>${escapeHtml(item.instructions || item.documents || item.amount || "No strong application details extracted yet.")}</p>
      </div>
      ${flags.length
        ? `<div class="keyword-block">${flags.map((flag) => `<span class="keyword">${escapeHtml(flag)}</span>`).join("")}</div>`
        : ""}
      <div class="review-classifier" aria-label="Classify this scholarship page">
        ${pageReviewTypes.map((type) => `
          <button class="review-choice ${review.type === type.id ? "is-active" : ""}" type="button" data-review-type="${type.id}" data-review-id="${escapeHtml(item.id)}">
            <strong>${escapeHtml(type.label)}</strong>
            <span>${escapeHtml(type.description)}</span>
          </button>
        `).join("")}
      </div>
      <label class="review-note-label">
        <span>Reviewer note</span>
        <textarea data-review-note="${escapeHtml(item.id)}" rows="3" placeholder="Why this classification? What should the scraper do next?">${escapeHtml(review.note || "")}</textarea>
      </label>
      <div class="rank-actions review-actions">
        <button class="small-button" type="button" data-rank-prev>Previous</button>
        <button class="button primary" type="button" data-detail="${escapeHtml(item.id)}">View extracted details</button>
        ${sourceUrl ? `<a class="button secondary apply-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Open source</a>` : ""}
        <button class="small-button" type="button" data-rank-next>Next</button>
      </div>
    </article>
  `;
}

function scholarshipCard(item, index, total, savedIds = new Set()) {
  const saved = savedIds.has(item.id);
  const days = daysUntil(item.deadline);
  const deadlineText = days === null ? "Rolling deadline" : days < 0 ? "Past deadline" : `${days} days left`;
  return `
    <article class="rank-card">
      <div class="rank-kicker">
        <span>Rank ${index + 1} of ${total}</span>
        <span class="deadline">${deadlineText}</span>
      </div>
      <span class="score-chip">${item.score}% match</span>
      <h2>${item.title}</h2>
      <p class="rank-summary">${item.eligibility}</p>
      <div class="pill-row">
        <span class="pill">${item.category}</span>
        <span class="pill">${item.level.join(" / ")}</span>
        <span class="pill">${item.fields[0]}</span>
      </div>
      <div class="rank-details">
        <div>
          <span>Amount</span>
          <strong>${item.amount}</strong>
        </div>
        <div>
          <span>Deadline</span>
          <strong>${formatDeadline(item.deadline)}</strong>
        </div>
      </div>
      <div class="keyword-block" aria-label="Requirement keywords">
        ${item.requirementKeywords.slice(0, 5).map((keyword) => `<span class="keyword">${keyword}</span>`).join("")}
      </div>
      <div class="needed-info">
        <span>Needed information</span>
        <p>${item.requiredApplicantInfo.slice(0, 6).join(", ")}</p>
      </div>
      <div class="reason-list">
        ${item.reasons.map((reason) => `<span class="pill soft-pill">${reason}</span>`).join("")}
      </div>
      <div class="rank-actions">
        <button class="small-button" type="button" data-rank-prev>Previous</button>
        <button class="button primary" type="button" data-detail="${item.id}">View details</button>
        <a class="button primary apply-link" href="apply.html?id=${item.id}">Apply →</a>
        <button class="small-button ${saved ? "is-saved" : ""}" type="button" data-save="${item.id}">${saved ? "Saved ✓" : "Save"}</button>
        <button class="small-button" type="button" data-rank-next>Next</button>
      </div>
    </article>
  `;
}

function landingProgress(index) {
  return [67, 45, 85, 52][index % 4];
}

function shortText(text, length = 92) {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function requirementRows(item, progress) {
  const requiredInfo = item.requiredApplicantInfo?.length
    ? item.requiredApplicantInfo
    : ["profile", "eligibility", "documents", "application review"];
  const completedCount = Math.max(1, Math.floor((progress / 100) * requiredInfo.length));

  return requiredInfo.slice(0, 5).map((requirement, index) => {
    const isDone = index < completedCount;
    const label = requirement
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace("Cv", "CV");
    const status = isDone ? "Done" : index === completedCount ? "Needed" : "Next";

    return `
      <li class="${isDone ? "is-done" : ""}">
        <span class="preview-check">${isDone ? "✓" : index + 1}</span>
        <span>${label}</span>
        <small>${status}</small>
      </li>
    `;
  }).join("");
}

function landingPreviewCard(item, index) {
  const progress = landingProgress(index);
  const days = daysUntil(item.deadline);
  const deadlineText = days === null ? "rolling" : days < 0 ? "past date" : `${days} days`;
  const initials = item.category.slice(0, 2).toUpperCase();

  return `
    <article class="preview-card ${index === 0 ? "is-open" : ""}">
      <button class="preview-toggle" type="button" aria-expanded="${index === 0 ? "true" : "false"}">
        <span class="preview-thumb">${initials}</span>
        <span class="preview-main">
          <span class="preview-title"><span>${item.title}</span>${index < 2 ? "<b>●</b>" : ""}</span>
          <p class="preview-desc">${shortText(item.eligibility)}</p>
          <span class="preview-chips">
            <span class="preview-chip">${item.amount}</span>
            <span class="preview-chip">${item.category}</span>
            <span class="preview-chip">${deadlineText}</span>
            <span class="preview-chip">${item.score}% match</span>
          </span>
        </span>
        <span class="preview-ring" style="--progress: ${progress}%"><span>${progress}%</span></span>
      </button>
      <div class="preview-requirements">
        <div class="preview-progress"><span style="width: ${progress}%"></span></div>
        <ul>${requirementRows(item, progress)}</ul>
        <div class="preview-apply">
          <a class="button primary" href="profile.html">Finish requirements</a>
        </div>
      </div>
    </article>
  `;
}

function initLandingScholarshipPreview() {
  const list = document.querySelector("#landingScholarshipList");
  if (!list) return;

  const ranked = getRankedScholarships(defaultProfile).slice(0, 3);
  list.innerHTML = ranked.length
    ? ranked.map((item, index) => landingPreviewCard(item, index)).join("")
    : `<p class="preview-loading">Add scholarship data to preview matches.</p>`;

  list.addEventListener("click", (event) => {
    const toggle = event.target.closest(".preview-toggle");
    if (!toggle) return;

    const card = toggle.closest(".preview-card");
    const isOpen = card.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function openDetail(id) {
  const dialog = document.querySelector("#detailDialog");
  const detailContent = document.querySelector("#detailContent");
  const item = scholarships.find((entry) => entry.id === id);
  if (!dialog || !detailContent || !item) return;

  const review = getPageReviews()[id] || {};
  const sourceUrl = item.url || item.source_url || "";
  const applicationUrl = item.applicationUrl || item.application_url || "";
  const requirementKeywords = asList(item.requirementKeywords || item.requirement_keywords).join(", ") || "None extracted";
  const requiredApplicantInfo = asList(item.requiredApplicantInfo || item.required_applicant_info).join(", ") || "None extracted";

  detailContent.innerHTML = `
    <div class="detail-inner">
      <div class="detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(item.category || "Scraped page")}</p>
          <h2>${escapeHtml(item.title || "Untitled scholarship page")}</h2>
          <p>${escapeHtml(item.eligibility || item.instructions || "No extracted summary yet.")}</p>
        </div>
        <button class="small-button" type="button" data-close>Close</button>
      </div>
      <div class="detail-status-row">
        <label class="status-label" for="detailStatus">Page classification</label>
        <select class="status-select" id="detailStatus" data-page-review-id="${escapeHtml(item.id)}">
          <option value="">Unreviewed</option>
          ${pageReviewTypes.map((type) =>
            `<option value="${type.id}"${review.type === type.id ? " selected" : ""}>${escapeHtml(type.label)}</option>`
          ).join("")}
        </select>
      </div>
      <dl class="detail-list">
        <div><dt>Amount</dt><dd>${escapeHtml(item.amount || "Unknown")}</dd></div>
        <div><dt>Deadline</dt><dd>${escapeHtml(formatDeadline(item.deadline))}</dd></div>
        <div><dt>Eligibility</dt><dd>${escapeHtml(item.eligibility || "None extracted")}</dd></div>
        <div><dt>Required documents</dt><dd>${escapeHtml(item.documents || "None extracted")}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(item.source || "Unknown")}</dd></div>
        <div><dt>Application</dt><dd>${escapeHtml(item.instructions || "None extracted")}</dd></div>
        <div><dt>Requirement keywords</dt><dd>${escapeHtml(requirementKeywords)}</dd></div>
        <div><dt>Needed applicant info</dt><dd>${escapeHtml(requiredApplicantInfo)}</dd></div>
      </dl>
      <div class="detail-link-row">
        ${applicationUrl && applicationUrl !== sourceUrl
          ? `<a class="button primary" href="${escapeHtml(applicationUrl)}" target="_blank" rel="noreferrer">Open application page</a>
             <a class="button" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Open source page</a>`
          : sourceUrl
            ? `<a class="button primary" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Open source</a>`
            : ""}
      </div>
    </div>
  `;
  dialog.showModal();
  document.body.classList.add("dialog-open");
}

function attachDialogHandlers() {
  const dialog = document.querySelector("#detailDialog");
  if (!dialog) return;

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedBackdrop || event.target.closest("[data-close]")) {
      dialog.close();
    }
  });

  dialog.addEventListener("change", (event) => {
    const select = event.target.closest("[data-status-id]");
    if (select) {
      setAppStatus(select.dataset.statusId, select.value);
    }
    const pageReviewSelect = event.target.closest("[data-page-review-id]");
    if (pageReviewSelect) {
      setPageReview(pageReviewSelect.dataset.pageReviewId, { type: pageReviewSelect.value });
      renderResultsPage();
    }
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
  });
}

async function saveScholarship(id) {
  const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  if (!saved.includes(id)) {
    saved.push(id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }
  try {
    await saveScholarshipForUser(id);
  } catch (error) {
    console.warn("Could not save scholarship to account:", error);
  }
}

function renderProfileSummary(profile) {
  const container = document.querySelector("#profileSummary");
  if (!container) return;

  const name = profile.name
    ? `${profile.name.first || ""} ${profile.name.last || ""}`.trim()
    : `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
  const university = profile.university || "";
  const level = profile.level || profile.degree_level || "";
  const field = profile.field || "";
  const citizenship = profile.citizenship || profile.nationality || "";
  const need = profile.need || profile.financial_need || "";

  const pills = [name, university, level, field, citizenship, need].filter(Boolean);

  container.innerHTML = `
    <div class="summary-card">
      <span class="summary-title">Current profile</span>
      <div class="pill-row">
        ${pills.map((p) => `<span class="pill">${p}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderReviewSummary() {
  const container = document.querySelector("#profileSummary");
  if (!container) return;

  const stats = pageReviewStats();
  const reviewPills = [
    `${stats.reviewed} reviewed`,
    `${Math.max(0, stats.total - stats.reviewed)} left`,
    `${stats.counts.usable || 0} good`,
    `${stats.counts.main_page || 0} dive deeper`,
    `${stats.counts.not_relevant || 0} rejected`,
    `${stats.counts.needs_manual || 0} manual check`
  ];

  container.innerHTML = `
    <div class="summary-card review-summary-card">
      <span class="summary-title">Human filter queue</span>
      <div class="pill-row">
        ${reviewPills.map((p) => `<span class="pill">${escapeHtml(p)}</span>`).join("")}
      </div>
      <p class="review-summary-copy">Classify each scraped page so the pipeline knows whether to keep it, reject it, or crawl deeper from a broader funding page.</p>
    </div>
  `;
}

function renderReviewControls() {
  const filterOptions = [
    ["all", "All pages"],
    ["unreviewed", "Unreviewed"],
    ...pageReviewTypes.map((type) => [type.id, type.shortLabel])
  ];

  return `
    <div class="review-toolbar">
      <label>
        <span>Search scraped pages</span>
        <input type="search" value="${escapeHtml(state.reviewSearch)}" placeholder="Title, source, URL, field, flag..." data-review-search>
      </label>
      <label>
        <span>Filter queue</span>
        <select data-review-filter>
          ${filterOptions.map(([value, label]) => `<option value="${value}"${state.reviewFilter === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      </label>
      <button class="small-button review-export" type="button" data-export-reviews>Export decisions</button>
    </div>
  `;
}

function exportReviewDecisions() {
  const reviews = getPageReviews();
  const rows = scholarships
    .filter((item) => reviews[item.id]?.type || reviews[item.id]?.note)
    .map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      url: item.url || item.source_url || "",
      applicationUrl: item.applicationUrl || item.application_url || "",
      pageType: reviews[item.id]?.type || "",
      pageTypeLabel: reviewTypeById(reviews[item.id]?.type)?.label || "",
      note: reviews[item.id]?.note || "",
      reviewedAt: reviews[item.id]?.updatedAt || ""
    }));
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `imotive-page-review-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderResultsPage() {
  const grid = document.querySelector("#scholarshipGrid");
  const resultCount = document.querySelector("#resultCount");
  if (!grid || !resultCount) return;

  renderReviewSummary();
  const items = getFilteredReviewItems();
  const stats = pageReviewStats();
  if (state.activeRank >= items.length) state.activeRank = 0;

  resultCount.textContent = `${stats.reviewed} of ${stats.total} pages reviewed - ${items.length} in current view`;

  grid.innerHTML = `
    ${renderReviewControls()}
    ${items.length
      ? pageReviewCard(items[state.activeRank], state.activeRank, items.length)
      : `<div class="empty-state"><h3>No pages in this queue.</h3><p>Change the filter or search term to keep reviewing scraped results.</p></div>`}
  `;

  grid.onclick = (event) => {
    const detailButton = event.target.closest("[data-detail]");
    const reviewButton = event.target.closest("[data-review-type]");
    const exportButton = event.target.closest("[data-export-reviews]");
    const nextButton = event.target.closest("[data-rank-next]");
    const prevButton = event.target.closest("[data-rank-prev]");

    if (detailButton) openDetail(detailButton.dataset.detail);

    if (exportButton) exportReviewDecisions();

    if (reviewButton) {
      setPageReview(reviewButton.dataset.reviewId, { type: reviewButton.dataset.reviewType });
      if (state.reviewFilter === "all" && items.length > 1 && state.activeRank < items.length - 1) {
        state.activeRank += 1;
      }
      renderResultsPage();
    }

    if (nextButton && items.length) {
      state.activeRank = (state.activeRank + 1) % items.length;
      renderResultsPage();
    }

    if (prevButton && items.length) {
      state.activeRank = (state.activeRank - 1 + items.length) % items.length;
      renderResultsPage();
    }
  };

  const search = grid.querySelector("[data-review-search]");
  const filter = grid.querySelector("[data-review-filter]");
  const note = grid.querySelector("[data-review-note]");

  search?.addEventListener("input", (event) => {
    state.reviewSearch = event.target.value;
    state.activeRank = 0;
    renderResultsPage();
    requestAnimationFrame(() => {
      const nextSearch = document.querySelector("[data-review-search]");
      nextSearch?.focus();
      nextSearch?.setSelectionRange(state.reviewSearch.length, state.reviewSearch.length);
    });
  });

  filter?.addEventListener("change", (event) => {
    state.reviewFilter = event.target.value;
    state.activeRank = 0;
    renderResultsPage();
  });

  note?.addEventListener("input", (event) => {
    setPageReview(event.target.dataset.reviewNote, { note: event.target.value });
  });
}

function profileToFormValues(profile) {
  if (profile.name || profile.citizenship) {
    const name = profile.name || {};
    const citizenshipMap = {
      Sweden: "Swedish",
      "EU / EEA": "EU/EEA",
      "Nordic (non-EU)": "EU/EEA",
      Other: "International non-EU"
    };
    const needMap = { High: "High", Some: "Medium", No: "Low" };
    return {
      firstName: name.first || "",
      lastName: name.last || "",
      email: "",
      university: profile.university || defaultProfile.university,
      level: profile.level || defaultProfile.level,
      field: profile.field || defaultProfile.field,
      nationality: citizenshipMap[profile.citizenship] || profile.citizenship || defaultProfile.nationality,
      year: (profile.year || "Year 1").replace("Year ", "") || defaultProfile.year,
      need: needMap[profile.need] || profile.need || defaultProfile.need,
      interest: Array.isArray(profile.interests) && profile.interests[0] ? profile.interests[0] : defaultProfile.interest,
      tuitionSupport: defaultProfile.tuitionSupport,
      notes: profile.goals || ""
    };
  }
  return profile;
}

function initProfileForm() {
  const form = document.querySelector("#profileForm");
  if (!form) return;

  const raw = getStoredProfile();
  const profile = profileToFormValues(raw);
  Object.entries(profile).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const submittedProfile = Object.fromEntries(new FormData(form).entries());
    saveProfile(submittedProfile);
    window.location.href = "results.html";
  });
}

function initResultsPage() {
  const grid = document.querySelector("#scholarshipGrid");
  if (!grid) return;

  renderResultsPage();
}

function initFeedbackForm() {
  const form = document.querySelector("#feedbackForm");
  const note = document.querySelector("#feedbackNote");
  if (!form || !note) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      ...Object.fromEntries(new FormData(form).entries()),
      createdAt: new Date().toISOString()
    };

    const entries = JSON.parse(localStorage.getItem(feedbackStorageKey) || "[]");
    entries.push(payload);
    localStorage.setItem(feedbackStorageKey, JSON.stringify(entries));

    try {
      const supabase = getSupabase();
      if (supabase) {
        const session = await getSession();
        await supabase.from("user_feedback").insert({
          user_id: session?.user?.id || null,
          rating: Number(payload.rating) || null,
          return_intent: payload.returnIntent || null,
          comment: payload.comment || null,
          created_at: payload.createdAt
        });
      }
    } catch {
      // local save already done above
    }

    form.reset();
    note.textContent = "Thank you for the feedback!";
  });
}

async function loadScholarships() {
  if (window.location.protocol === "file:") {
    scholarships = fallbackScholarships;
    return;
  }

  try {
    scholarships = await fetchScholarships();
  } catch (err) {
    console.error("Could not load scholarship data:", err);
    scholarships = fallbackScholarships;
  }
}

async function init() {
  await loadScholarships();
  attachDialogHandlers();
  initLandingScholarshipPreview();
  initProfileForm();
  initResultsPage();
  initFeedbackForm();
}

init();
