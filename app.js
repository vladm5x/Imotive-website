const scholarships = [
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
    source: "Lund University source to verify",
    url: "https://www.lunduniversity.lu.se",
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
    source: "Prototype faculty/foundation record",
    url: "https://www.lunduniversity.lu.se",
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
    source: "Prototype external foundation record",
    url: "https://www.lth.se",
    eligibility: "LTH students with a research or thesis project connected to technology, energy, or sustainability.",
    documents: "Project summary, CV, budget, supervisor statement.",
    instructions: "Submit a project proposal and budget to the foundation contact listed by the faculty.",
    requirementKeywords: ["engineering", "research", "technology", "energy", "sustainability"],
    requiredApplicantInfo: ["first name", "last name", "faculty", "subject", "project title", "supervisor", "CV", "budget"]
  },
  {
    id: "social-impact-bursary",
    title: "Social Impact Student Bursary",
    amount: "SEK 8,000-18,000",
    deadline: "2026-04-30",
    category: "Living costs",
    level: ["Bachelor", "Master"],
    fields: ["Social sciences", "Law", "Humanities"],
    nationality: ["Swedish", "EU/EEA", "International non-EU"],
    interests: ["Leadership", "Sustainability"],
    need: ["High"],
    source: "Prototype donor fund record",
    url: "https://www.lunduniversity.lu.se",
    eligibility: "Students with demonstrated financial need and a project or study path connected to social impact.",
    documents: "Personal statement, proof of enrolment, budget, reference.",
    instructions: "Apply through the donor fund form and include a short statement about intended impact.",
    requirementKeywords: ["financial need", "social impact", "leadership", "personal statement"],
    requiredApplicantInfo: ["first name", "last name", "school", "field of study", "financial situation", "personal statement", "reference"]
  },
  {
    id: "medicine-research-stipend",
    title: "Medicine Research Stipend",
    amount: "SEK 20,000",
    deadline: "2026-09-10",
    category: "Research",
    level: ["Master", "PhD"],
    fields: ["Medicine"],
    nationality: ["Swedish", "EU/EEA", "International non-EU"],
    interests: ["Research"],
    need: ["Low", "Medium", "High"],
    source: "Prototype faculty record",
    url: "https://www.medicine.lu.se",
    eligibility: "Medicine faculty students conducting clinical, public health, or lab-based research.",
    documents: "Research plan, ethics note if applicable, CV, supervisor support.",
    instructions: "Send the application package to the faculty scholarship administrator.",
    requirementKeywords: ["medicine", "clinical research", "public health", "lab research", "supervisor"],
    requiredApplicantInfo: ["first name", "last name", "faculty", "research area", "research plan", "CV", "supervisor", "ethics note"]
  },
  {
    id: "international-student-emergency-grant",
    title: "International Student Emergency Grant",
    amount: "One-time support up to SEK 12,000",
    deadline: "2026-12-15",
    category: "Living costs",
    level: ["Bachelor", "Master", "PhD"],
    fields: ["Any field"],
    nationality: ["International non-EU", "EU/EEA"],
    interests: ["Any interest"],
    need: ["High"],
    source: "Prototype student support record",
    url: "https://www.lunduniversity.lu.se",
    eligibility: "Enrolled international students facing unexpected short-term financial difficulty.",
    documents: "Explanation of situation, proof of enrolment, basic budget, supporting documentation.",
    instructions: "Contact student support services and request the emergency funding application.",
    requirementKeywords: ["international student", "emergency", "financial difficulty", "enrolled student"],
    requiredApplicantInfo: ["first name", "last name", "email", "student ID", "nationality", "financial situation", "proof of enrolment", "supporting documents"]
  }
];

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

attachDialogHandlers();
initProfileForm();
initResultsPage();
initFeedbackForm();
