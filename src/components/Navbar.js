import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const links = [
  ["#features", "Features"],
  ["#integrations", "Integrations"],
  ["#analytics", "Analytics"],
  ["#about", "About us"],
  ["#contact", "Contact"]
];

export function Navbar() {
  return e(
    "header",
    {
      className:
        "fixed left-1/2 top-0 z-50 flex w-full max-w-[1480px] -translate-x-1/2 items-center justify-between px-6 py-7 text-[13px] sm:px-10 lg:px-20"
    },
    e(
      "a",
      { href: "#home", className: "logo-mark rounded-[14px] bg-yellow px-5 py-3 text-[27px] font-black tracking-[-0.08em] text-black shadow-[0_14px_28px_rgba(255,211,41,0.22)]" },
      "iMotive"
    ),
    e(
      "nav",
      {
        className:
          "hidden rounded-[8px] bg-white px-7 py-4 text-black shadow-[0_10px_35px_rgba(15,15,20,0.08)] ring-1 ring-black/5 md:flex md:gap-8"
      },
      links.map(([href, label]) => e("a", { key: href, href, className: "transition hover:text-purple" }, label))
    ),
    e(
      "div",
      { className: "flex items-center gap-5" },
      e("a", { href: "profile.html", className: "hidden transition hover:text-purple sm:inline" }, "Log in"),
      e(
        "a",
        {
          href: "profile.html",
          className:
            "rounded-[8px] bg-black px-6 py-4 font-medium text-white shadow-[0_14px_30px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-purple"
        },
        "Start Free Trial"
      )
    )
  );
}
