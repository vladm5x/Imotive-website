import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const steps = [
  {
    number: "1",
    title: "Search or build a profile",
    description: "Tell us your field, level, and a few interests."
  },
  {
    number: "2",
    title: "Filter by what matters",
    description: "Match score, amount, deadline, or effort."
  },
  {
    number: "3",
    title: "Apply & track",
    description: "Save drafts, set reminders, see status."
  }
];

export function HowItWorks() {
  return e(
    "section",
    { id: "how-it-works", className: "bg-white px-4 py-16 sm:px-8 sm:py-20 lg:px-10" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px]" },
      e(
        "div",
        { className: "text-center mb-12" },
        e("h2", { className: "text-[clamp(1.8rem,4vw,2.4rem)] font-bold text-[#1A1A1A]" }, "From confused to confident in 3 steps."),
        e("p", { className: "text-[15px] text-[#555555] mt-2" }, "No friction. No hidden steps.")
      ),
      e(
        "div",
        { className: "flex flex-col sm:flex-row items-stretch gap-0" },
        steps.flatMap((step, i) => {
          const card = e(
            "div",
            { key: step.number, className: "flex-1 bg-[#F3F4F6] rounded-xl p-7 flex flex-col gap-4" },
            e(
              "div",
              { className: "w-9 h-9 rounded-full bg-[#3B82F6] text-white flex items-center justify-center text-[15px] font-bold shrink-0" },
              step.number
            ),
            e("h3", { className: "text-[17px] font-semibold text-[#1A1A1A]" }, step.title),
            e("p", { className: "text-[14px] text-[#555555] leading-relaxed" }, step.description)
          );

          if (i < steps.length - 1) {
            const arrow = e(
              "div",
              {
                key: `arrow-${i}`,
                className: "hidden sm:flex items-center justify-center text-[#3B82F6] text-xl font-light px-2 shrink-0"
              },
              "→"
            );
            return [card, arrow];
          }
          return [card];
        })
      )
    )
  );
}
