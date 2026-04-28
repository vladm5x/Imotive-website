import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const steps = [
  ["1", "Search or build a profile", "Tell us your field, level, and a few interests."],
  ["2", "Filter by what matters", "Match score, amount, deadline, or effort."],
  ["3", "Apply and track", "Save drafts, set reminders, see status."]
];

export function HowItWorks() {
  return e(
    "section",
    { id: "how-it-works", className: "how-section" },
    e(
      "div",
      { className: "home-shell" },
      e(
        "div",
        { className: "how-heading" },
        e("h2", { className: "hand-title" }, "From confused to confident in 3 steps."),
        e("p", null, "No friction. No hidden steps.")
      ),
      e(
        "div",
        { className: "how-grid" },
        steps.map(([number, title, description]) =>
          e(
            "article",
            { key: number, className: "step-card" },
            e("span", null, number),
            e("h3", { className: "hand-title" }, title),
            e("p", null, description)
          )
        )
      )
    )
  );
}
