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
        "fixed left-1/2 top-0 z-50 flex w-full max-w-[1480px] -translate-x-1/2 items-center justify-between gap-3 px-4 py-4 text-[13px] sm:px-8 sm:py-6 lg:px-20"
    },
    e(
      "a",
      {
        href: "#home",
        className:
          "logo-mark shrink-0 rounded-[8px] bg-yellow px-4 py-3 text-[23px] font-black tracking-normal text-black shadow-[0_14px_28px_rgba(255,211,41,0.18)] sm:text-[27px]"
      },
      "iMotive"
    ),
    e(
      "nav",
      {
        className:
          "hidden rounded-[8px] bg-white px-7 py-4 text-black shadow-[0_10px_35px_rgba(15,15,20,0.08)] ring-1 ring-black/5 lg:flex lg:gap-8"
      },
      links.map(([href, label]) => e("a", { key: href, href, className: "transition hover:text-purple" }, label))
    ),
    e(
      "div",
      { className: "flex min-w-0 shrink-0 items-center justify-end gap-3 sm:min-w-[210px] sm:gap-5" },
      e("a", { href: "profile.html", className: "hidden transition hover:text-purple sm:inline" }, "Log in"),
      e(
        "a",
        {
          href: "profile.html",
          className:
            "flex min-h-[44px] items-center justify-center rounded-[8px] bg-yellow px-4 text-[15px] font-black tracking-normal text-black shadow-[0_14px_28px_rgba(255,211,41,0.22)] transition hover:-translate-y-0.5 hover:bg-yellow/90 sm:min-h-[52px] sm:min-w-[140px] sm:px-5 sm:text-[18px]"
        },
        "Start Free Trial"
      )
    )
  );
}
