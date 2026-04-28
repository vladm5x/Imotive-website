import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const cols = [
  {
    label: "Product",
    links: [
      ["signup.html", "Browse scholarships"],
      ["#how-it-works", "How it works"],
      ["signup.html", "Sign up free"]
    ]
  },
  {
    label: "Company",
    links: [
      ["/about", "About"],
      ["#universities", "For universities"],
      ["/contact", "Contact"]
    ]
  },
  {
    label: "Legal",
    links: [
      ["/privacy", "Privacy"],
      ["/terms", "Terms"]
    ]
  }
];

export function Footer() {
  return e(
    "footer",
    { className: "site-footer" },
    e(
      "div",
      { className: "footer-grid" },
      e(
        "div",
        { className: "footer-brand" },
        e(
          "div",
          { className: "footer-logo" },
          e("div", null),
          e("span", null, "iMotive")
        ),
        e("p", null, "Scholarship discovery for university students in Sweden.")
      ),
      ...cols.map((col) =>
        e(
          "div",
          { key: col.label, className: "footer-col" },
          e("p", null, col.label),
          e(
            "div",
            null,
            col.links.map(([href, label]) => e("a", { key: href, href }, label))
          )
        )
      )
    ),
    e("div", { className: "footer-bottom" }, `(c) ${new Date().getFullYear()} iMotive. All rights reserved.`)
  );
}
