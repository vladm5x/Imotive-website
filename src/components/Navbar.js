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
      { href: "#home", className: "logo-mark text-[27px] font-black tracking-[-0.08em]" },
      "imotive"
    ),
    e(
      "nav",
      {
        className:
          "hidden rounded-[8px] bg-white/88 px-6 py-4 shadow-[0_10px_35px_rgba(15,15,20,0.06)] backdrop-blur-xl md:flex md:gap-8"
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
