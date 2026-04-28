import { daysUntil, rankScholarships } from "./src/lib/matching.js";
import { fetchScholarships, saveScholarshipForUser } from "./src/lib/scholarships.js";

let scholarships = [];

const profileStorageKey = "grantlyProfile";
const feedbackStorageKey = "grantlyFeedback";
const state = {
  activeRank: 0
};

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
    return { ...defaultProfile, ...JSON.parse(localStorage.getItem(profileStorageKey) || "null") };
  } catch {
    return { ...defaultProfile };
  }
}

function saveProfile(profile) {
  localStorage.setItem(profileStorageKey, JSON.stringify(profile));
}

function getRankedScholarships(profile) {
  return rankScholarships(scholarships, profile, { includeIneligible: false });
}

function scholarshipCard(item, index, total) {
  const days = daysUntil(item.deadline);
  const deadlineText = days === null ? "Rolling deadline" : days < 0 ? "Past pilot date" : `${days} days left`;
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
        <button class="small-button" type="button" data-save="${item.id}">Save</button>
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

  detailContent.innerHTML = `
    <div class="detail-inner">
      <div class="detail-header">
        <div>
          <p class="eyebrow">${item.category}</p>
          <h2>${item.title}</h2>
          <p>${item.eligibility}</p>
        </div>
        <button class="small-button" type="button" data-close>Close</button>
      </div>
      <dl class="detail-list">
        <div><dt>Amount</dt><dd>${item.amount}</dd></div>
        <div><dt>Deadline</dt><dd>${formatDeadline(item.deadline)}</dd></div>
        <div><dt>Eligibility</dt><dd>${item.eligibility}</dd></div>
        <div><dt>Required documents</dt><dd>${item.documents}</dd></div>
        <div><dt>Source</dt><dd>${item.source}</dd></div>
        <div><dt>Application</dt><dd>${item.instructions}</dd></div>
        <div><dt>Requirement keywords</dt><dd>${item.requirementKeywords.join(", ")}</dd></div>
        <div><dt>Needed applicant info</dt><dd>${item.requiredApplicantInfo.join(", ")}</dd></div>
      </dl>
      <a class="button primary" href="${item.url}" target="_blank" rel="noreferrer">Open source</a>
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

  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
  });
}

async function saveScholarship(id) {
  const saved = JSON.parse(localStorage.getItem("grantlySaved") || "[]");
  if (!saved.includes(id)) {
    saved.push(id);
    localStorage.setItem("grantlySaved", JSON.stringify(saved));
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

  container.innerHTML = `
    <div class="summary-card">
      <span class="summary-title">Current profile</span>
      <div class="pill-row">
        <span class="pill">${profile.university}</span>
        <span class="pill">${profile.level}</span>
        <span class="pill">${profile.field}</span>
        <span class="pill">${profile.nationality}</span>
        <span class="pill">${profile.need} need</span>
        <span class="pill">${profile.interest}</span>
      </div>
    </div>
  `;
}

function renderResultsPage(profile) {
  const grid = document.querySelector("#scholarshipGrid");
  const resultCount = document.querySelector("#resultCount");
  if (!grid || !resultCount) return;

  const ranked = getRankedScholarships(profile);
  if (state.activeRank >= ranked.length) state.activeRank = 0;

  resultCount.textContent = ranked.length
    ? `${state.activeRank + 1} of ${ranked.length} ranked scholarships`
    : "0 ranked scholarships";

  grid.innerHTML = ranked.length
    ? scholarshipCard(ranked[state.activeRank], state.activeRank, ranked.length)
    : `<div class="empty-state"><h3>No scholarships available yet.</h3><p>Add scholarship data to start ranking results.</p></div>`;

  grid.onclick = (event) => {
    const detailButton = event.target.closest("[data-detail]");
    const saveButton = event.target.closest("[data-save]");
    const nextButton = event.target.closest("[data-rank-next]");
    const prevButton = event.target.closest("[data-rank-prev]");

    if (detailButton) openDetail(detailButton.dataset.detail);

    if (saveButton) {
      saveScholarship(saveButton.dataset.save);
      saveButton.textContent = "Saved";
    }

    if (nextButton && ranked.length) {
      state.activeRank = (state.activeRank + 1) % ranked.length;
      renderResultsPage(profile);
    }

    if (prevButton && ranked.length) {
      state.activeRank = (state.activeRank - 1 + ranked.length) % ranked.length;
      renderResultsPage(profile);
    }
  };
}

function initProfileForm() {
  const form = document.querySelector("#profileForm");
  if (!form) return;

  const profile = getStoredProfile();
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

  const profile = getStoredProfile();
  const hasMeaningfulProfile = Boolean(profile.firstName || profile.lastName || profile.email);

  if (!hasMeaningfulProfile) {
    window.location.href = "profile.html";
    return;
  }

  renderProfileSummary(profile);
  renderResultsPage(profile);
}

function initFeedbackForm() {
  const form = document.querySelector("#feedbackForm");
  const note = document.querySelector("#feedbackNote");
  if (!form || !note) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const entries = JSON.parse(localStorage.getItem(feedbackStorageKey) || "[]");
    entries.push({
      ...Object.fromEntries(new FormData(form).entries()),
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(feedbackStorageKey, JSON.stringify(entries));
    form.reset();
    note.textContent = "Feedback saved locally for this prototype.";
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
