import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Integrations() {
  return e(
    "section",
    { id: "integrations", className: "relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-28" },
    e(
      "div",
      { className: "mail-float absolute left-[12%] top-[26%] h-20 w-28 rotate-[-18deg] rounded-[6px] bg-purple shadow-[0_18px_40px_rgba(75,22,201,0.2)]" },
      e("span", { className: "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow" })
    ),
    e("h2", { className: "text-[clamp(4.2rem,11vw,12.5rem)] font-medium tracking-[-0.08em]" }, "Integrations"),
    e("div", { className: "absolute right-[12%] top-1/2 hidden -translate-y-1/2 rounded-[18px] bg-yellow px-9 py-4 text-[clamp(2rem,5vw,5.3rem)] font-black tracking-[-0.08em] text-white/55 md:block" }, "imotive")
  );
}
