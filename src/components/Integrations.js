import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Integrations() {
  return e(
    "section",
    { id: "integrations", className: "relative flex min-h-[320px] items-center justify-center overflow-hidden bg-white px-6 py-16" },
    e(
      "div",
      { className: "mail-float absolute left-[13%] top-[28%] h-12 w-16 rotate-[-18deg] rounded-[6px] bg-purple shadow-[0_18px_40px_rgba(75,22,201,0.14)]" },
      e("span", { className: "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow" })
    ),
    e(
      "div",
      { className: "relative flex flex-wrap items-center justify-center gap-5 text-center" },
      e("h2", { className: "text-[clamp(3rem,8vw,7.2rem)] font-medium tracking-[-0.08em]" }, "Scholarships"),
      e("div", { className: "rounded-[16px] bg-yellow px-5 py-2 text-[clamp(1.5rem,3.2vw,3rem)] font-black tracking-[-0.08em] text-white/65" }, "iMotive")
    )
  );
}
