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
    { className: "site-nav" },
    e(
      "div",
      { className: "home-shell nav-inner" },
      e(
        "a",
        { href: "#home", className: "brand-mark" },
        e("span", null),
        e("strong", null, "iMotive")
      ),
      e(
        "nav",
        { className: "nav-links" },
        navLinks.map(([href, label]) => e("a", { key: href, href }, label))
      ),
      e(
        "div",
        { className: "nav-actions" },
        e("a", { href: "signup.html" }, "Log in"),
        e("a", { href: "signup.html", className: "nav-signup" }, "Sign up")
      )
    )
  );
}
