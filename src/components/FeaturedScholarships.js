import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const scholarships = [
  {
    title: "Sustainable Engineering Fund",
    amount: "40,000 kr",
    daysLeft: 9,
    progressPercent: 82,
    effort: "Easy apply",
    eligibilityTag: "Engineering - Masters",
    description: "For master's students researching sustainability."
  },
  {
    title: "Wallenberg Robotics Grant",
    amount: "60,000 kr",
    daysLeft: 33,
    progressPercent: 30,
    effort: "Medium apply",
    eligibilityTag: "Engineering - Masters",
    description: "Supports robotics research projects."
  },
  {
    title: "Lund Women in STEM",
    amount: "15,000 kr",
    daysLeft: 21,
    progressPercent: 48,
    effort: "Easy apply",
    eligibilityTag: "Engineering - Masters",
    description: "Open application, short essay required."
  }
];

function ScholarshipCard({ title, amount, daysLeft, progressPercent, effort, eligibilityTag, description }) {
  const urgent = daysLeft <= 14;

  return e(
    "article",
    { className: "scholarship-card", onClick: () => { window.location.href = "signup.html"; } },
    e(
      "div",
      { className: "scholarship-card-top" },
      e("span", { className: "tiny-pill" }, eligibilityTag),
      e("strong", null, amount)
    ),
    e("h3", { className: "hand-title" }, title),
    e("p", null, description),
    e(
      "div",
      { className: "deadline-row" },
      e("span", null, "Deadline"),
      e("strong", { style: { color: urgent ? "#B45309" : "#555555" } }, `${daysLeft} days left`)
    ),
    e(
      "div",
      { className: "sketch-progress" },
      e("span", { style: { width: `${progressPercent}%`, background: urgent ? "#FACC15" : "#22C55E" } })
    ),
    e("span", { className: "effort-pill" }, effort),
    e("a", { href: "signup.html", className: "apply-btn", onClick: (ev) => ev.stopPropagation() }, "Apply ->")
  );
}

export function FeaturedScholarships() {
  return e(
    "section",
    { id: "scholarships", className: "featured-section" },
    e(
      "div",
      { className: "home-shell" },
      e(
        "div",
        { className: "section-heading-row" },
        e(
          "div",
          null,
          e("p", { className: "hand-note slash-note" }, "/ a peek at what's inside"),
          e("h2", { className: "hand-title" }, "Featured scholarships this week."),
          e("p", { className: "muted-copy" }, "Sign up to see which ones fit you.")
        ),
        e("a", { href: "signup.html", className: "hand-note browse-link" }, "browse all 2,400+ ->")
      ),
      e(
        "div",
        { className: "scholarship-grid" },
        scholarships.map((item) => e(ScholarshipCard, { key: item.title, ...item }))
      )
    )
  );
}
