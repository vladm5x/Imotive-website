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

const state = {
  search: "",
  level: "all",
  category: "all",
  deadline: "all",
  activeRank: 0
};

const grid = document.querySelector("#scholarshipGrid");
const resultCount = document.querySelector("#resultCount");
const dialog = document.querySelector("#detailDialog");
const detailContent = document.querySelector("#detailContent");

document.querySelector("#stat-count").textContent = scholarships.length;

function daysUntil(dateString) {
  const today = new Date("2026-04-27T00:00:00");
  const date = new Date(`${dateString}T00:00:00`);
  return Math.ceil((date - today) / 86400000);
}

function formatDeadline(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function matchesFilters(item) {
  const haystack = [
    item.title,
    item.amount,
    item.category,
    item.source,
    item.eligibility,
    item.documents,
    item.instructions,
    ...item.requirementKeywords,
    ...item.requiredApplicantInfo,
    ...item.level,
    ...item.fields,
    ...item.nationality,
    ...item.interests
  ].join(" ").toLowerCase();

  const searchMatch = !state.search || haystack.includes(state.search.toLowerCase());
  const levelMatch = state.level === "all" || item.level.includes(state.level);
  const categoryMatch = state.category === "all" || item.category === state.category;
  const deadlineDays = daysUntil(item.deadline);
  const deadlineMatch =
    state.deadline === "all" ||
    (state.deadline === "soon" && deadlineDays >= 0 && deadlineDays <= 45) ||
    (state.deadline === "later" && deadlineDays > 45);

  return searchMatch && levelMatch && categoryMatch && deadlineMatch;
}

function scholarshipCard(item, index, total) {
  const days = daysUntil(item.deadline);
  const deadlineText = days < 0 ? "Past pilot date" : `${days} days left`;
  return `
    <article class="rank-card">
      <div class="rank-kicker">
        <span>Rank ${index + 1} of ${total}</span>
        <span class="deadline">${deadlineText}</span>
      </div>
      <h3>${item.title}</h3>
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
        <p>${item.requiredApplicantInfo.slice(0, 5).join(", ")}</p>
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

function renderScholarships() {
  const results = scholarships.filter(matchesFilters);
  if (state.activeRank >= results.length) state.activeRank = 0;
  resultCount.textContent = results.length
    ? `${state.activeRank + 1} of ${results.length} ranked scholarships`
    : "0 ranked scholarships";
  grid.innerHTML = results.length
    ? scholarshipCard(results[state.activeRank], state.activeRank, results.length)
    : `<div class="empty-state"><h3>No scholarships match those filters.</h3><p>Try resetting filters or widening your profile.</p></div>`;
}

function setFilter(id, key) {
  const element = document.querySelector(id);
  element.addEventListener("input", (event) => {
    state[key] = event.target.value;
    state.activeRank = 0;
    renderScholarships();
  });
}

setFilter("#searchInput", "search");
setFilter("#levelFilter", "level");
setFilter("#categoryFilter", "category");
setFilter("#deadlineFilter", "deadline");

document.querySelector("#resetFilters").addEventListener("click", () => {
  state.search = "";
  state.level = "all";
  state.category = "all";
  state.deadline = "all";
  state.activeRank = 0;
  document.querySelector("#searchInput").value = "";
  document.querySelector("#levelFilter").value = "all";
  document.querySelector("#categoryFilter").value = "all";
  document.querySelector("#deadlineFilter").value = "all";
  renderScholarships();
});

grid.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-detail]");
  const saveButton = event.target.closest("[data-save]");
  const nextButton = event.target.closest("[data-rank-next]");
  const prevButton = event.target.closest("[data-rank-prev]");
  const results = scholarships.filter(matchesFilters);

  if (detailButton) {
    openDetail(detailButton.dataset.detail);
  }

  if (saveButton) {
    saveScholarship(saveButton.dataset.save);
    saveButton.textContent = "Saved";
  }

  if (nextButton && results.length) {
    state.activeRank = (state.activeRank + 1) % results.length;
    renderScholarships();
  }

  if (prevButton && results.length) {
    state.activeRank = (state.activeRank - 1 + results.length) % results.length;
    renderScholarships();
  }
});

function openDetail(id) {
  const item = scholarships.find((entry) => entry.id === id);
  if (!item) return;

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

function saveScholarship(id) {
  const saved = JSON.parse(localStorage.getItem("grantlySaved") || "[]");
  if (!saved.includes(id)) {
    saved.push(id);
    localStorage.setItem("grantlySaved", JSON.stringify(saved));
  }
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
  if (daysUntil(item.deadline) >= 0) {
    score += 5;
    reasons.push("Open deadline");
  }

  return { ...item, score, reasons };
}

function renderMatches(profile) {
  const matches = scholarships
    .map((item) => scoreScholarship(item, profile))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  document.querySelector("#matchResults").innerHTML = matches.map((item) => `
    <article class="match-card">
      <span class="score">${item.score}% match</span>
      <h3>${item.title}</h3>
      <p>${item.eligibility}</p>
      <div class="reason-list">
        ${item.reasons.map((reason) => `<span class="pill">${reason}</span>`).join("")}
      </div>
      <button class="small-button" type="button" data-match-detail="${item.id}">View details</button>
    </article>
  `).join("");
}

document.querySelector("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  renderMatches(Object.fromEntries(formData.entries()));
});

document.querySelector("#matchResults").addEventListener("click", (event) => {
  const button = event.target.closest("[data-match-detail]");
  if (button) openDetail(button.dataset.matchDetail);
});

function storeFormSubmission(key, form, note, message) {
  const entries = JSON.parse(localStorage.getItem(key) || "[]");
  entries.push({
    ...Object.fromEntries(new FormData(form).entries()),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(key, JSON.stringify(entries));
  form.reset();
  note.textContent = message;
}

function renderDataTable() {
  document.querySelector("#dataTable").innerHTML = scholarships.map((item) => `
    <tr>
      <td>${item.title}</td>
      <td>${formatDeadline(item.deadline)}</td>
      <td><a href="${item.url}" target="_blank" rel="noreferrer">${item.source}</a></td>
      <td>${item.requirementKeywords.join(", ")}</td>
      <td>${item.requiredApplicantInfo.join(", ")}</td>
    </tr>
  `).join("");
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function exportScholarshipCsv() {
  const headers = [
    "title",
    "deadline",
    "amount",
    "category",
    "source",
    "source_url",
    "eligibility",
    "required_documents",
    "application_instructions",
    "requirement_keywords",
    "needed_applicant_info"
  ];
  const rows = scholarships.map((item) => [
    item.title,
    item.deadline,
    item.amount,
    item.category,
    item.source,
    item.url,
    item.eligibility,
    item.documents,
    item.instructions,
    item.requirementKeywords.join("; "),
    item.requiredApplicantInfo.join("; ")
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "grantly-scholarships-prototype.csv";
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelector("#submitForm").addEventListener("submit", (event) => {
  event.preventDefault();
  storeFormSubmission(
    "grantlySuggestions",
    event.currentTarget,
    document.querySelector("#submitNote"),
    "Suggestion saved locally for this prototype."
  );
});

document.querySelector("#feedbackForm").addEventListener("submit", (event) => {
  event.preventDefault();
  storeFormSubmission(
    "grantlyFeedback",
    event.currentTarget,
    document.querySelector("#feedbackNote"),
    "Feedback saved locally for this prototype."
  );
});

document.querySelector("#exportCsv").addEventListener("click", exportScholarshipCsv);

renderScholarships();
renderDataTable();
renderMatches({
  university: "Lund University",
  level: "Master",
  field: "Engineering",
  nationality: "International non-EU",
  need: "High",
  interest: "Sustainability"
});
