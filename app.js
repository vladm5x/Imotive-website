let scholarships = [];

const profileStorageKey = "grantlyProfile";
const feedbackStorageKey = "grantlyFeedback";
const state = {
  activeRank: 0
};

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

function daysUntil(dateString) {
  const today = new Date("2026-04-27T00:00:00");
  const date = new Date(`${dateString}T00:00:00`);
  return Math.ceil((date - today) / 86400000);
}

function formatDeadline(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
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

function scoreScholarship(item, profile) {
  let score = 0;
  const reasons = [];

  if (item.level.includes(profile.level)) {
    score += 25;
    reasons.push(profile.level);
  }
  if (item.fields.includes(profile.field) || item.fields.includes("Any field")) {
    score += 22;
    reasons.push(item.fields.includes("Any field") ? "Any field eligible" : profile.field);
  }
  if (item.nationality.includes(profile.nationality) || profile.nationality === "Any nationality") {
    score += 20;
    reasons.push(profile.nationality);
  }
  if (item.need.includes(profile.need)) {
    score += 18;
    reasons.push(`${profile.need} funding need`);
  }
  if (item.interests.includes(profile.interest) || item.interests.includes("Any interest")) {
    score += 10;
    reasons.push(item.interests.includes("Any interest") ? "Broad interest fit" : profile.interest);
  }
  if (profile.tuitionSupport === "Yes" && item.category === "Tuition") {
    score += 8;
    reasons.push("Tuition support");
  }
  if (daysUntil(item.deadline) >= 0) {
    score += 5;
    reasons.push("Open deadline");
  }

  return { ...item, score, reasons };
}

function getRankedScholarships(profile) {
  return scholarships
    .map((item) => scoreScholarship(item, profile))
    .sort((a, b) => b.score - a.score);
}

function scholarshipCard(item, index, total) {
  const deadlineText = daysUntil(item.deadline) < 0 ? "Past pilot date" : `${daysUntil(item.deadline)} days left`;
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

function saveScholarship(id) {
  const saved = JSON.parse(localStorage.getItem("grantlySaved") || "[]");
  if (!saved.includes(id)) {
    saved.push(id);
    localStorage.setItem("grantlySaved", JSON.stringify(saved));
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
  try {
    const res = await fetch("data/scholarships.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    scholarships = await res.json();
  } catch (err) {
    console.error("Could not load scholarship data:", err);
    scholarships = [];
  }
}

async function init() {
  await loadScholarships();
  attachDialogHandlers();
  initProfileForm();
  initResultsPage();
  initFeedbackForm();
}

init();
