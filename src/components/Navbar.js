import React from "https://esm.sh/react@18.2.0";
import { getSession, isSupabaseConfigured } from "../lib/account.js";

const e = React.createElement;

const navLinks = [
  ["#scholarships", "Browse"],
  ["#how-it-works", "How it works"],
  ["#universities", "For universities"]
];

export function Navbar() {
  const [session, setSession] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured()) return undefined;
    getSession()
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
        session
          ? e("a", { href: "account.html" }, "Account")
          : e("a", { href: "signup.html" }, "Log in"),
        session
          ? e("a", { href: "results.html", className: "nav-signup" }, "My matches")
          : e("a", { href: "signup.html", className: "nav-signup" }, "Sign up")
      )
    )
  );
}
