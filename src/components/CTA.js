import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function CTA() {
  return e(
    "section",
    { className: "bg-[#3B82F6] px-4 py-16 sm:px-8 sm:py-20 text-center" },
    e(
      "div",
      { className: "mx-auto max-w-[640px]" },
      e("p", { className: "text-[14px] font-medium mb-3", style: { color: "rgba(255,255,255,0.75)" } }, "2 minutes. that’s all."),
      e("h2", { className: "text-[clamp(1.8rem,4vw,2.6rem)] font-bold text-white leading-tight mb-8" }, "Start finding your scholarships."),
      e(
        "div",
        { className: "flex flex-wrap items-center justify-center gap-3" },
        e(
          "a",
          { href: "/signup", className: "bg-[#22C55E] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#16A34A] transition-colors duration-150 text-[15px]" },
          "Start searching →"
        ),
        e(
          "a",
          { href: "/scholarships", className: "border border-white text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors duration-150 text-[15px]" },
          "Browse instead"
        )
      )
    )
  );
}
