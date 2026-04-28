import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Hero() {
  return e(
    "section",
    { id: "home", className: "relative min-h-[82vh] overflow-hidden rounded-b-[18px] bg-white px-4 pb-14 pt-24 sm:min-h-[88vh] sm:px-10 sm:pb-20 sm:pt-28 lg:px-20" },
    e(
      "div",
      { className: "mx-auto flex max-w-5xl flex-col items-center text-center" },
      e(
        "h1",
        { className: "max-w-4xl text-[clamp(2.55rem,14vw,5.9rem)] font-medium leading-[0.98] tracking-normal sm:text-[clamp(3rem,7vw,5.9rem)]" },
        "Find Scholarships Without Losing Your Life to Search"
      ),
      e(
        "p",
        { className: "mt-6 max-w-2xl text-base leading-7 text-black/55 sm:text-lg" },
        "Imotive matches students with high-fit scholarships, shows the missing requirements, and keeps every deadline visible."
      ),
      e(
        "div",
        { className: "mt-8 flex justify-center" },
        e(
          "a",
          { href: "profile.html", className: "rounded-[8px] bg-purple px-10 py-4 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(75,22,201,0.25)] transition hover:-translate-y-0.5" },
          "Find Scholarships!"
        )
      )
    ),
    e(
      "div",
      { className: "hero-image-frame pointer-events-none relative left-1/2 mt-10 w-[92vw] max-w-[1280px] -translate-x-1/2 sm:mt-16 sm:w-[94vw]" },
      e(
        "figure",
        { className: "m-0 overflow-hidden rounded-[8px] bg-white shadow-[0_24px_60px_rgba(26,18,55,0.14)] ring-1 ring-black/5 sm:shadow-[0_38px_95px_rgba(26,18,55,0.18)]" },
        e("img", {
          className: "block aspect-[4/3] w-full object-cover object-center sm:aspect-[3/2]",
          src: "assets/hero-scholarship-room.png",
          alt: "Purple scholarship study room illustration"
        })
      )
    )
  );
}
