import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const benefits = [
  {
    title: "Save 6+ hours a month",
    description: "No more bouncing between university pages."
  },
  {
    title: "Discover what you didn't know",
    description: "Niche & private grants surface automatically."
  },
  {
    title: "Personalized matches",
    description: "The more you tell us, the better it gets."
  }
];

export function Benefits() {
  return e(
    "section",
    { className: "benefits-section" },
    e(
      "div",
      { className: "home-shell benefits-grid" },
      e(
        "div",
        { className: "benefits-copy" },
        e("p", { className: "benefits-eyebrow" }, "/ why students like it"),
        e("h2", { className: "benefits-title" }, "Less time hunting, more time applying."),
        e(
          "div",
          { className: "benefits-list" },
          benefits.map((b) =>
            e(
              "div",
              { key: b.title, className: "benefit-item" },
              e("div", { className: "benefit-check" }, e("span", null, "OK")),
              e(
                "div",
                null,
                e("h3", null, b.title),
                e("p", null, b.description)
              )
            )
          )
        )
      ),
      e(
        "div",
        { className: "testimonial-card" },
        e("div", { className: "testimonial-quote" }, '"'),
        e(
          "blockquote",
          null,
          "I found 4 scholarships I qualified for in my first session. Got 2 of them. Paid my whole semester."
        ),
        e(
          "div",
          { className: "testimonial-person" },
          e("div", { className: "testimonial-avatar" }, "SL"),
          e(
            "div",
            null,
            e("p", null, "Sara L."),
            e("p", null, "MSc Engineering, Lund")
          )
        )
      )
    )
  );
}
