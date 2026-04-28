import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Integrations() {
  return e(
    "section",
    { id: "integrations", className: "relative flex min-h-[260px] items-center justify-center overflow-hidden bg-white px-4 py-14 sm:min-h-[320px] sm:px-6 sm:py-16" },
    e(
      "div",
      { className: "mail-float absolute left-[8%] top-[18%] h-10 w-14 rotate-[-18deg] rounded-[6px] bg-purple shadow-[0_18px_40px_rgba(75,22,201,0.14)] sm:left-[13%] sm:top-[28%] sm:h-12 sm:w-16" },
      e("span", { className: "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow" })
    ),
    e(
      "div",
      { className: "relative flex w-full flex-wrap items-center justify-center gap-3 text-center sm:gap-5" },
      e("h2", { className: "w-full max-w-full text-[clamp(2.3rem,12vw,7.2rem)] font-medium leading-none tracking-normal sm:w-auto" }, "Scholarships"),
      e("div", { className: "rounded-[8px] bg-yellow px-4 py-2 text-[clamp(1.4rem,8vw,3rem)] font-black tracking-normal text-white/65 sm:px-5" }, "iMotive")
    )
  );
}
