import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const benefits = [
  {
    title: "Save 6+ hours a month",
    description: "No more bouncing between university pages."
  },
  {
    title: "Discover what you didn’t know",
    description: "Niche & private grants surface automatically."
  },
  {
    title: "Personalized matches",
    description: "The more you tell us, the better it gets."
  }
];

export function Benefits() {
  return e(
    "section",
    { className: "bg-white px-4 py-16 sm:px-8 sm:py-20 lg:px-10" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px] grid gap-12 lg:grid-cols-2 lg:gap-16 items-center" },
      e(
        "div",
        null,
        e("p", { className: "text-[13px] font-medium text-[#555555] mb-3" }, "/ why students like it"),
        e("h2", { className: "text-[clamp(1.8rem,4vw,2.4rem)] font-bold text-[#1A1A1A] leading-tight mb-8" }, "Less time hunting, more time applying."),
        e(
          "div",
          { className: "flex flex-col gap-7" },
          benefits.map((b) =>
            e(
              "div",
              { key: b.title, className: "flex gap-4" },
              e(
                "div",
                { className: "w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0 mt-0.5" },
                e("span", { className: "text-white text-[11px] font-black" }, "✓")
              ),
              e(
                "div",
                null,
                e("h3", { className: "text-[16px] font-semibold text-[#1A1A1A]" }, b.title),
                e("p", { className: "text-[14px] text-[#555555] mt-1 leading-relaxed" }, b.description)
              )
            )
          )
        )
      ),
      e(
        "div",
        { className: "bg-[#F3F4F6] rounded-xl p-8" },
        e("div", {
          className: "text-[#3B82F6] font-serif leading-none mb-4",
          style: { fontSize: "72px", lineHeight: 1 }
        }, "“"),
        e(
          "blockquote",
          { className: "text-[17px] text-[#1A1A1A] leading-relaxed mb-6" },
          "I found 4 scholarships I qualified for in my first session. Got 2 of them. Paid my whole semester."
        ),
        e(
          "div",
          { className: "flex items-center gap-3" },
          e(
            "div",
            { className: "w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-bold text-[13px] shrink-0" },
            "SL"
          ),
          e(
            "div",
            null,
            e("p", { className: "text-[14px] font-semibold text-[#1A1A1A]" }, "Sara L."),
            e("p", { className: "text-[13px] text-[#555555]" }, "MSc Engineering, Lund")
          )
        )
      )
    )
  );
}
