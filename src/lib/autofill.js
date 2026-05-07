const DOC_KEYS = {
  cv: "CV / Résumé",
  "academic records": "Academic Transcripts",
  "personal statement": "Personal Statement",
  "reference letter": "Reference Letter",
  "research plan": "Research Proposal",
  "ethics note": "Financial Documents",
  budget: "Financial Documents",
  "financial documents": "Financial Documents"
};

const DOC_PATTERNS = {
  "CV / Résumé": /\bcv\b|resume|curriculum vitae/i,
  "Personal Statement": /personal statement|motivation letter|cover letter/i,
  "Academic Transcripts": /transcript|academic record|grade|gpa/i,
  "Reference Letter": /reference|recommendation|letter of support/i,
  "Research Proposal": /research plan|research proposal|project proposal|project plan/i,
  "Financial Documents": /financial|bank statement|income|budget|ethics/i
};

export function generateApplicationPack(scholarship, answers) {
  const name = (answers.name && typeof answers.name === "object") ? answers.name : {};
  const docs = Array.isArray(answers.docs) ? answers.docs : [];
  const docsText = `${scholarship.documents || ""} ${scholarship.eligibility || ""}`.toLowerCase();

  function docReady(docLabel) {
    return docs.includes(docLabel) ? "Ready to attach" : "Not yet prepared";
  }

  function docIsReady(docLabel) {
    return docs.includes(docLabel);
  }

  const fieldValues = {
    "first name": name.first || "",
    "last name": name.last || "",
    "email": answers.email || "",
    "faculty": answers.university || "",
    "subject": answers.field || "",
    "cv": docReady("CV / Résumé"),
    "personal statement": answers.goals || "",
    "academic records": docReady("Academic Transcripts"),
    "proof of enrolment": enrollmentLabel(answers.enrollmentStatus),
    "reference letter": docReady("Reference Letter"),
    "research plan": answers.researchArea || answers.goals || "",
    "research area": answers.researchArea || answers.field || "",
    "supervisor": "",
    "budget": docReady("Financial Documents"),
    "ethics note": "",
    "project title": answers.researchArea || ""
  };

  const fields = (scholarship.requiredApplicantInfo || []).map((label) => {
    const key = label.toLowerCase().trim();
    const value = fieldValues[key] !== undefined ? fieldValues[key] : "";
    const isDoc = Boolean(DOC_KEYS[key]);
    const docLabel = DOC_KEYS[key];
    return {
      label,
      value,
      ready: isDoc ? docIsReady(docLabel) : Boolean(value),
      isDoc,
      copyable: !isDoc || Boolean(value)
    };
  });

  const docChecklist = Object.entries(DOC_PATTERNS)
    .map(([name, pattern]) => ({
      name,
      needed: pattern.test(docsText) || fields.some((f) => DOC_KEYS[f.label.toLowerCase()] === name),
      ready: docs.includes(name)
    }))
    .filter((d) => d.needed);

  const readyFields = fields.filter((f) => f.ready).length;
  const readyDocs = docChecklist.filter((d) => d.ready).length;

  return {
    fields,
    docChecklist,
    fieldCompleteness: fields.length ? Math.round((readyFields / fields.length) * 100) : 100,
    docCompleteness: docChecklist.length ? Math.round((readyDocs / docChecklist.length) * 100) : 100
  };
}

function enrollmentLabel(status) {
  if (status === "Enrolled" || status === "Accepted") return "Confirmed — letter available on request";
  if (status === "Applying") return "Application in progress";
  if (status === "Alumni") return "Recently graduated";
  return "";
}
