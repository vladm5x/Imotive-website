import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Hero() {
  return e(
    "section",
    { id: "home", className: "intro-hero relative min-h-[82vh] overflow-hidden rounded-b-[18px] px-4 pb-16 pt-24 sm:min-h-[88vh] sm:px-10 sm:pb-24 sm:pt-28 lg:px-20" },
    e(
      "div",
      { className: "relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center" },
      e(
        "h1",
        { className: "max-w-4xl text-[clamp(2.55rem,14vw,5.9rem)] font-semibold leading-[0.98] tracking-normal text-white sm:text-[clamp(3rem,7vw,5.9rem)]" },
        "Find Scholarships Without Losing Your Life to Search"
      ),
      e(
        "p",
        { className: "mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-lg" },
        "Imotive matches students with high-fit scholarships, shows the missing requirements, and keeps every deadline visible."
      ),
      e(
        "div",
        { className: "mt-8 flex justify-center" },
        e(
          "a",
          { href: "profile.html", className: "rounded-[8px] bg-yellow px-10 py-4 text-sm font-black text-black shadow-[0_14px_28px_rgba(255,211,41,0.22)] transition hover:-translate-y-0.5 hover:bg-yellow/90" },
          "Find Scholarships!"
        )
      )
    )
  );
}
