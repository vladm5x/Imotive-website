import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const navLinks = [
  ["#scholarships", "Browse"],
  ["#how-it-works", "How it works"],
  ["#universities", "For universities"]
];

export function Navbar() {
  return e(
    "header",
    { style: { position: "sticky", top: 0, zIndex: 50, background: "#FAFAF7", borderBottom: "1px solid #E5E7EB" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" } },
      e(
        "a",
        { href: "#home", style: { display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "18px", color: "#1A1A1A", textDecoration: "none" } },
        e("div", {
          style: {
            width: "28px", height: "28px", borderRadius: "50%",
            background: "linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)",
            border: "2px solid #1a1a1a", flexShrink: 0
          }
        }),
        "iMotive"
      ),
      e(
        "nav",
        { style: { display: "flex", alignItems: "center", gap: "32px" } },
        navLinks.map(([href, label]) =>
          e("a", {
            key: href, href,
            style: { fontSize: "14px", color: "#555555", textDecoration: "none", transition: "color 150ms" },
            onMouseEnter: (ev) => { ev.target.style.color = "#1A1A1A"; },
            onMouseLeave: (ev) => { ev.target.style.color = "#555555"; }
          }, label)
        )
      ),
      e(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "20px" } },
        e("a", {
          href: "signup.html",
          style: { fontSize: "14px", color: "#555555", textDecoration: "none" },
          onMouseEnter: (ev) => { ev.target.style.color = "#1A1A1A"; },
          onMouseLeave: (ev) => { ev.target.style.color = "#555555"; }
        }, "Log in"),
        e("a", { href: "signup.html", className: "nav-signup" }, "Sign up")
      )
    )
  );
}
