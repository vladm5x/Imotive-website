import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function CTA() {
  return e(
    "section",
    { className: "cta-section" },
    e(
      "div",
      { className: "cta-inner" },
      e("p", null, "2 minutes. that's all."),
      e("h2", null, "Start finding your scholarships."),
      e(
        "div",
        { className: "cta-actions" },
        e("a", { href: "signup.html", className: "cta-primary" }, "Start searching ->"),
        e("a", { href: "signup.html", className: "cta-secondary" }, "Browse instead")
      )
    )
  );
}
