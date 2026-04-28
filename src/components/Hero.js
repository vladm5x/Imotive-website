import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const miniScholarships = [
  { title: "Wallenberg Engineering Grant", amount: "50,000 kr", progress: 88, color: "#FACC15" },
  { title: "Lund Sustainability Fund", amount: "40,000 kr", progress: 82, color: "#FACC15" },
  { title: "KTH Robotics Grant", amount: "60,000 kr", progress: 38, color: "#22C55E" }
];

function SparkleIcon() {
  return e(
    "svg",
    { width: "15", height: "15", viewBox: "0 0 24 24", fill: "#3B82F6", "aria-hidden": "true" },
    e("path", { d: "M12 1L14.39 8.26L22 9.27L16.5 14.64L17.96 22.18L12 18.77L6.04 22.18L7.5 14.64L2 9.27L9.61 8.26L12 1Z" })
  );
}

function SearchIcon() {
  return e(
    "svg",
    { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "#3B82F6", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
    e("circle", { cx: "11", cy: "11", r: "8" }),
    e("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
  );
}

function MiniRow({ title, amount, progress, color }) {
  return e(
    "div",
    { className: "preview-row" },
    e(
      "div",
      { className: "preview-row-top" },
      e("span", null, title),
      e("strong", null, amount)
    ),
    e(
      "div",
      { className: "sketch-progress" },
      e("span", { style: { width: `${progress}%`, background: color } })
    )
  );
}

export function Hero() {
  const [query, setQuery] = React.useState("");

  function goSignup(ev) {
    ev.preventDefault();
    window.location.href = "signup.html";
  }

  return e(
    "section",
    { id: "home", className: "home-hero" },
    e(
      "div",
      { className: "home-shell hero-grid" },
      e(
        "div",
        { className: "hero-copy" },
        e("p", { className: "hand-note hero-kicker" }, "hi there ", e(SparkleIcon)),
        e(
          "h1",
          { className: "hero-title hand-title" },
          e("span", { className: "hero-title-top" }, "Scholarships that"),
          e("span", { className: "hero-title-highlight" }, "actually fit you.")
        ),
        e(
          "p",
          { className: "hero-subhead" },
          "We collect every scholarship for university students in one place - so you stop scrolling and start applying."
        ),
        e(
          "form",
          { className: "sketch-search", onSubmit: goSignup },
          e(SearchIcon),
          e("input", {
            type: "text",
            value: query,
            onChange: (ev) => setQuery(ev.target.value),
            placeholder: 'Try "engineering, masters, Lund"'
          }),
          e("button", { type: "submit" }, "Search")
        ),
        e(
          "div",
          { className: "hero-cta-row" },
          e("a", { href: "signup.html", className: "pill-btn" }, "Browse all 2,400+ ->"),
          e("span", { className: "hand-note small-note" }, "or, sign up to get matches")
        ),
        e(
          "div",
          { className: "joined-row" },
          e(
            "div",
            { className: "joined-dots", "aria-hidden": "true" },
            ["#FACC15", "#3B82F6", "#22C55E", "#FAFAF7"].map((color) => e("span", { key: color, style: { background: color } }))
          ),
          e("p", null, "Joined this week by 312 students")
        )
      ),
      e(
        "div",
        { className: "hero-preview" },
        e("p", { className: "hand-note preview-note" }, "matching unlocks", e("br"), "after sign-up"),
        e(
          "div",
          { className: "preview-card" },
          e("p", { className: "hand-note preview-label" }, "search results preview"),
          miniScholarships.map((item) => e(MiniRow, { key: item.title, ...item })),
          e(
            "a",
            { href: "signup.html", className: "preview-lock" },
            e("span", null, "lock"),
            e("strong", null, "Sign up"),
            " to see your match score on every result."
          )
        )
      )
    )
  );
}
