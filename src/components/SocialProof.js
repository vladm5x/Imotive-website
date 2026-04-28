import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const universities = ["Lund University", "KTH", "Uppsala", "Chalmers", "Stockholm", "Goteborg"];

export function SocialProof() {
  return e(
    "section",
    { className: "trusted-band" },
    e(
      "div",
      { className: "home-shell" },
      e("p", { className: "hand-note" }, "trusted by students at"),
      e(
        "div",
        { className: "trusted-list" },
        universities.map((name) => e("span", { key: name, className: "hand-note" }, name))
      )
    )
  );
}
