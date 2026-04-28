import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const scholarships = [
  {
    title: "Sustainable Engineering Fund",
    amount: "40,000 kr",
    daysLeft: 9,
    progressPercent: 82,
    effort: "Easy apply",
    eligibilityTag: "Engineering · Masters",
    slug: "sustainable-engineering-fund",
    description: "For master's students researching sustainability."
  },
  {
    title: "Wallenberg Robotics Grant",
    amount: "60,000 kr",
    daysLeft: 33,
    progressPercent: 30,
    effort: "Medium apply",
    eligibilityTag: "Engineering · Masters",
    slug: "wallenberg-robotics",
    description: "Supports robotics research projects."
  },
  {
    title: "Lund Women in STEM",
    amount: "15,000 kr",
    daysLeft: 21,
    progressPercent: 48,
    effort: "Easy apply",
    eligibilityTag: "Engineering · Masters",
    slug: "lund-women-in-stem",
    description: "Open application, short essay required."
  }
];

function ClockIcon() {
  return e("svg", { width: "11", height: "11", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" },
    e("circle", { cx: "12", cy: "12", r: "10" }),
    e("polyline", { points: "12 6 12 12 16 14" })
  );
}

function ScholarshipCard({ title, amount, daysLeft, progressPercent, effort, eligibilityTag, slug, description }) {
  const urgent = daysLeft <= 14;

  return e(
    "article",
    {
      className: "card-hard",
      style: { background: "white", padding: "24px", display: "flex", flexDirection: "column", gap: "14px", cursor: "pointer" },
      onClick: () => { window.location.href = "signup.html"; }
    },

    // Top row: eligibility pill + amount
    e(
      "div",
      { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" } },
      e("span", {
        style: {
          fontSize: "11px", fontWeight: 500, color: "#555555",
          background: "#F3F4F6", borderRadius: "999px",
          padding: "4px 10px", textTransform: "uppercase",
          letterSpacing: "0.05em", whiteSpace: "nowrap"
        }
      }, eligibilityTag),
      e("span", { style: { fontSize: "18px", fontWeight: 700, color: "#1A1A1A", whiteSpace: "nowrap" } }, amount)
    ),

    // Title
    e("h3", { style: { margin: 0, fontSize: "19px", fontWeight: 700, color: "#1A1A1A", lineHeight: "1.25" } }, title),

    // Description
    e("p", { style: { margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" } }, description),

    // Deadline row
    e(
      "div",
      null,
      e(
        "div",
        { style: { display: "flex", justifyContent: "space-between", marginBottom: "6px" } },
        e("span", { style: { fontSize: "12px", fontWeight: 600, color: "#555555" } }, "Deadline"),
        e("span", {
          style: { fontSize: "12px", fontWeight: 600, color: urgent ? "#DC2626" : "#16A34A" }
        }, `${daysLeft} days left`)
      ),
      e(
        "div",
        { className: "progress-track" },
        e("div", { className: "progress-fill", style: { width: `${progressPercent}%`, background: urgent ? "#FACC15" : "#22C55E" } })
      )
    ),

    // Effort pill
    e("div", null,
      e("span", { className: "effort-pill" },
        e(ClockIcon),
        effort
      )
    ),

    // Apply button
    e("a", {
      href: "signup.html",
      className: "apply-btn",
      onClick: (ev) => ev.stopPropagation()
    }, "Apply →")
  );
}

export function FeaturedScholarships() {
  return e(
    "section",
    { id: "scholarships", style: { background: "#FAFAF7", padding: "80px 0" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", padding: "0 40px" } },

      // Header row
      e(
        "div",
        { style: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginBottom: "36px" } },
        e(
          "div",
          null,
          e("p", {
            style: {
              fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
              fontSize: "12px", color: "#9CA3AF", margin: "0 0 10px",
              textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.2)", textUnderlineOffset: "3px"
            }
          }, "/ a peek at what's inside"),
          e("h2", { style: { margin: "0 0 8px", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "#1A1A1A", lineHeight: "1.05", letterSpacing: "-0.5px" } },
            "Featured scholarships this week."
          ),
          e("p", { style: { margin: 0, fontSize: "15px", color: "#6B7280" } }, "Sign up to see which ones fit you.")
        ),
        e("a", { href: "signup.html", style: { fontSize: "14px", fontStyle: "italic", color: "#1A1A1A", textDecoration: "none", whiteSpace: "nowrap" } }, "browse all 2,400+ →")
      ),

      // Cards grid
      e(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" } },
        scholarships.map((s) => e(ScholarshipCard, { key: s.slug, ...s }))
      )
    )
  );
}
