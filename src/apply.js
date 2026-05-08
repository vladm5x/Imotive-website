import React from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0/client";
import { generateApplicationPack } from "./lib/autofill.js";
import { scoreScholarship } from "./lib/matching.js";
import { fetchScholarships } from "./lib/scholarships.js";

const e = React.createElement;
const STORAGE_KEY = "imotive_signup_answers";

function getProfile() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

async function loadScholarship(id) {
  const list = await fetchScholarships();
  return list.find((s) => s.id === id) || null;
}

function CopyButton({ text, isDoc }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  if (!text || text === "Not yet prepared" || text === "" || isDoc) return null;
  return e("button", { type: "button", className: "copy-btn", onClick: copy }, copied ? "Copied!" : "Copy");
}

function ReadinessBar({ pct, label }) {
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return e(
    "div",
    { className: "readiness-bar" },
    e("div", { className: "readiness-label" },
      e("span", null, label),
      e("strong", { style: { color } }, `${pct}%`)
    ),
    e("div", { className: "readiness-track" },
      e("div", { className: "readiness-fill", style: { width: `${pct}%`, background: color } })
    )
  );
}

function ApplyPage() {
  const [scholarship, setScholarship] = React.useState(null);
  const [profile] = React.useState(getProfile);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  React.useEffect(() => {
    if (!id) { setError("No scholarship ID in URL. Open this page from a scholarship card."); setLoading(false); return; }
    loadScholarship(id)
      .then((s) => { if (!s) setError(`Scholarship "${id}" not found.`); else setScholarship(s); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return e("main", { className: "apply-shell" }, e("p", { className: "apply-loading" }, "Loading..."));
  if (error) return e("main", { className: "apply-shell" }, e("p", { className: "apply-error" }, error));

  const pack = generateApplicationPack(scholarship, profile);
  const scored = scoreScholarship(scholarship, profile);
  const name = profile.name || {};
  const displayName = (name.first || name.last) ? `${name.first || ""} ${name.last || ""}`.trim() : null;
  const applyUrl = scholarship.applicationUrl || scholarship.url;
  const daysLeft = scored.deadlineDays;
  const deadlineStr = scholarship.deadline && scholarship.deadline !== "Unknown"
    ? new Date(scholarship.deadline).toLocaleDateString("en-SE", { day: "numeric", month: "short", year: "numeric" })
    : "Open / Unknown";

  return e(
    "main",
    { className: "apply-shell" },
    e(
      "header",
      { className: "apply-topbar" },
      e("a", { href: "index.html", className: "apply-logo" }, e("span", { className: "signup-logo-dot" }), "iMotive"),
      e("a", { href: "results.html", className: "apply-back" }, "← Back to results")
    ),
    e(
      "div",
      { className: "apply-layout" },
      e(
        "section",
        { className: "apply-main" },
        e(
          "div",
          { className: "apply-hero" },
          e("p", { className: "apply-source" }, scholarship.source),
          e("h1", { className: "apply-title" }, scholarship.title),
          e(
            "div",
            { className: "apply-meta-row" },
            scholarship.amount && scholarship.amount !== "See scholarship page"
              ? e("span", { className: "apply-chip amount" }, scholarship.amount)
              : null,
            e("span", { className: "apply-chip deadline" },
              daysLeft !== null && daysLeft >= 0
                ? `${daysLeft}d left — ${deadlineStr}`
                : deadlineStr
            ),
            e("span", { className: `apply-chip eligibility ${scored.eligible ? "eligible" : "ineligible"}` },
              scored.eligible ? "You're eligible" : `Check eligibility`
            )
          ),
          scored.blockers.length > 0
            ? e("p", { className: "apply-blocker" }, "Note: ", scored.blockers.join(", "))
            : null
        ),
        e(
          "div",
          { className: "apply-section" },
          e("h2", null, "Pre-filled Application Fields"),
          e("p", { className: "apply-hint" },
            displayName
              ? `Hi ${name.first || "there"} — here's what we know about you. Copy each field straight into the form.`
              : "Complete your profile quiz to pre-fill these fields automatically."
          ),
          e(
            "div",
            { className: "apply-fields" },
            pack.fields.length === 0
              ? e("p", { className: "apply-empty" }, "No specific field requirements listed for this scholarship.")
              : pack.fields.map((field) =>
                  e(
                    "div",
                    { key: field.label, className: `apply-field-row ${field.ready ? "is-ready" : "is-missing"}` },
                    e(
                      "div",
                      { className: "apply-field-label" },
                      e("span", { className: `apply-status-dot ${field.ready ? "ready" : "missing"}` }),
                      e("span", null, field.label)
                    ),
                    e(
                      "div",
                      { className: "apply-field-value" },
                      field.value
                        ? e("span", { className: field.isDoc ? "doc-status" : "field-value" }, field.value)
                        : e("span", { className: "field-empty" }, "Not in profile — add via quiz")
                    ),
                    e(CopyButton, { text: field.value, isDoc: field.isDoc })
                  )
                )
          ),
          e(ReadinessBar, { pct: pack.fieldCompleteness, label: "Profile completeness" })
        ),
        pack.docChecklist.length > 0
          ? e(
              "div",
              { className: "apply-section" },
              e("h2", null, "Documents Required"),
              e(
                "ul",
                { className: "doc-checklist" },
                pack.docChecklist.map((doc) =>
                  e(
                    "li",
                    { key: doc.name, className: doc.ready ? "doc-ready" : "doc-missing" },
                    e("span", { className: "doc-icon" }, doc.ready ? "✓" : "○"),
                    e("span", null, doc.name),
                    e("span", { className: "doc-badge" }, doc.ready ? "Ready" : "Prepare this")
                  )
                )
              ),
              e(ReadinessBar, { pct: pack.docCompleteness, label: "Documents ready" })
            )
          : null,
        e(
          "div",
          { className: "apply-actions" },
          e("a", { href: applyUrl, target: "_blank", rel: "noopener noreferrer", className: "apply-cta" }, "Apply Now →"),
          !displayName
            ? e("a", { href: "signup.html", className: "apply-secondary" }, "Complete quiz to pre-fill fields")
            : e("a", { href: "signup.html", className: "apply-secondary" }, "Update my profile")
        )
      ),
      e(
        "aside",
        { className: "apply-sidebar" },
        e("h3", null, "About this scholarship"),
        scholarship.eligibility
          ? e(
              "div",
              { className: "sidebar-block" },
              e("p", { className: "sidebar-label" }, "Eligibility"),
              e("p", null, scholarship.eligibility)
            )
          : null,
        scholarship.instructions
          ? e(
              "div",
              { className: "sidebar-block" },
              e("p", { className: "sidebar-label" }, "How to apply"),
              e("p", null, scholarship.instructions)
            )
          : null,
        scholarship.documents
          ? e(
              "div",
              { className: "sidebar-block" },
              e("p", { className: "sidebar-label" }, "Required documents"),
              e("p", null, scholarship.documents)
            )
          : null,
        e(
          "div",
          { className: "sidebar-block" },
          e("p", { className: "sidebar-label" }, "Match score"),
          e("p", null, `${scored.score} / 100`),
          scored.reasons.length > 0
            ? e("ul", { className: "sidebar-reasons" }, scored.reasons.map((r) => e("li", { key: r }, r)))
            : null
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(ApplyPage));
