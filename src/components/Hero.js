import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Hero() {
  return e(
    "section",
    { id: "home", className: "relative min-h-[88vh] overflow-hidden rounded-b-[18px] bg-white px-6 pb-20 pt-28 sm:px-10 lg:px-20" },
    e(
      "div",
      { className: "mx-auto flex max-w-5xl flex-col items-center text-center" },
      e(
        "h1",
        { className: "max-w-4xl text-[clamp(3rem,7vw,5.9rem)] font-medium leading-[0.96] tracking-[-0.06em]" },
        "Find Scholarships Without Losing Your Life to Search"
      ),
      e(
        "p",
        { className: "mt-6 max-w-2xl text-base leading-7 text-black/55 sm:text-lg" },
        "Imotive matches students with high-fit scholarships, shows the missing requirements, and keeps every deadline visible."
      ),
      e(
        "div",
        { className: "mt-8 flex flex-wrap justify-center gap-4" },
        e(
          "a",
          { href: "profile.html", className: "rounded-[8px] bg-purple px-9 py-4 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(75,22,201,0.25)] transition hover:-translate-y-0.5" },
          "Start Matching"
        ),
        e(
          "a",
          { href: "results.html", className: "rounded-[8px] border border-black/10 bg-white px-9 py-4 text-sm font-semibold shadow-[0_10px_25px_rgba(20,20,30,0.06)] transition hover:-translate-y-0.5 hover:border-purple/40" },
          "View Rankings"
        )
      )
    ),
    e(
      "div",
      { className: "hero-image-frame pointer-events-none relative left-1/2 mt-16 w-[94vw] max-w-[1280px] -translate-x-1/2" },
      e(
        "figure",
        { className: "m-0 overflow-hidden rounded-[34px] bg-white shadow-[0_38px_95px_rgba(26,18,55,0.18)] ring-1 ring-black/5" },
        e("img", {
          className: "block aspect-[3/2] w-full object-cover object-center",
          src: "assets/hero-scholarship-room.png",
          alt: "Purple scholarship study room illustration"
        })
      )
    )
  );
}
