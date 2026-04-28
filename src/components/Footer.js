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
    { style: { background: "#111111", borderTop: "2px solid #1A1A1A", padding: "56px 40px 40px" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "48px", alignItems: "start" } },

      // Logo + tagline
      e(
        "div",
        null,
        e(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" } },
          e("div", {
            style: { width: "26px", height: "26px", borderRadius: "50%", background: "#3B82F6", border: "2px solid #444", flexShrink: 0 }
          }),
          e("span", { style: { fontSize: "18px", fontWeight: 800, color: "white" } }, "iMotive")
        ),
        e("p", { style: { margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: "1.6", maxWidth: "200px" } },
          "Scholarship discovery for university students in Sweden."
        )
      ),

      ...cols.map((col) =>
        e(
          "div",
          { key: col.label },
          e("p", { style: { margin: "0 0 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" } }, col.label),
          e(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "10px" } },
            col.links.map(([href, label]) =>
              e("a", {
                key: href, href,
                style: { fontSize: "14px", color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "color 150ms" },
                onMouseEnter: (ev) => { ev.target.style.color = "white"; },
                onMouseLeave: (ev) => { ev.target.style.color = "rgba(255,255,255,0.6)"; }
              }, label)
            )
          )
        )
      )
    ),
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", paddingTop: "32px", marginTop: "32px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", color: "rgba(255,255,255,0.25)" } },
      `© ${new Date().getFullYear()} iMotive. All rights reserved.`
    )
  );
}
