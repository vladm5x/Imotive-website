import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Hero() {
  return e(
    "section",
    { id: "home", className: "relative min-h-[101vh] overflow-hidden rounded-b-[18px] bg-white px-6 pb-0 pt-28 sm:px-10 lg:px-20" },
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
      { className: "hero-video-stack pointer-events-none absolute left-1/2 top-[62%] h-[54vw] min-h-[430px] w-[92vw] max-w-[1240px] -translate-x-1/2" },
      e("div", { className: "absolute inset-x-8 top-10 h-[74%] rotate-[-2deg] rounded-[56px] bg-yellow" }),
      e("div", { className: "absolute inset-x-4 top-16 h-[74%] rotate-[-5deg] rounded-[56px] bg-pink" }),
      e(
        "div",
        { className: "absolute inset-0 overflow-hidden rounded-[56px] bg-purple shadow-[0_40px_90px_rgba(50,17,120,0.28)]" },
        e("video", {
          className: "h-full w-full scale-[1.18] object-cover",
          autoPlay: true,
          muted: true,
          loop: true,
          playsInline: true,
          src: "assets/website-idea.mp4"
        })
      )
    )
  );
}
