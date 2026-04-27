import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const tags = ["#Engineering", "#Lund", "#NeedAid", "#Research", "#Travel", "#Merit", "#Sustainability", "#Tuition", "#Essay", "#STEM"];

export function Analytics() {
  return e(
    "section",
    { id: "analytics", className: "relative -mt-[32vh] rounded-t-[42px] bg-white px-6 pb-24 pt-28 sm:px-10 lg:px-20" },
    e(
      "div",
      { className: "mx-auto max-w-[1320px]" },
      e("h2", { className: "mx-auto max-w-2xl text-center text-[clamp(2.6rem,5vw,5rem)] font-medium leading-[1.02] tracking-[-0.06em]" }, "Advanced Matching and Reporting"),
      e(
        "div",
        { className: "mt-16 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" },
        e(
          "article",
          { className: "analytics-card" },
          e("h3", { className: "text-[clamp(1.6rem,2vw,2.25rem)] font-medium tracking-[-0.05em]" }, "Scholarship Fit Signals"),
          e(
            "div",
            { className: "mt-7 rounded-[26px] bg-white p-6 shadow-inner" },
            e(
              "div",
              { className: "tag-cloud min-h-[245px]" },
              tags.map((tag, index) => e("span", { key: tag, style: { "--i": index } }, tag))
            )
          ),
          e(
            "div",
            { className: "mt-5 grid grid-cols-3 gap-3" },
            e("span", { className: "h-2 rounded-full bg-purple" }),
            e("span", { className: "h-2 rounded-full bg-pink" }),
            e("span", { className: "h-2 rounded-full bg-yellow" })
          )
        ),
        e(
          "article",
          { className: "analytics-card" },
          e("h3", { className: "text-[clamp(1.6rem,2vw,2.25rem)] font-medium tracking-[-0.05em]" }, "Optimizing Applications"),
          e(
            "div",
            { className: "mt-7 grid gap-6 lg:grid-cols-[190px_1fr]" },
            e(
              "div",
              { className: "grid gap-5" },
              e("div", { className: "metric-tile bg-yellow" }, e("span", null, "Match Rate"), e("strong", null, "+61%")),
              e("div", { className: "metric-tile bg-pink text-white" }, e("span", null, "Completed Steps"), e("strong", null, "+73%"))
            ),
            e(
              "div",
              { className: "relative min-h-[310px] rounded-[26px] bg-white p-6" },
              e(
                "div",
                { className: "mb-7 flex flex-wrap justify-center gap-2 rounded-full border border-black/80 px-2 py-1 text-[11px]" },
                ["3 days", "1 week", "1 month", "3 months", "6 months", "1 year"].map((tab) =>
                  e("span", { key: tab, className: tab === "1 week" ? "rounded-full bg-black px-3 py-1 text-white" : "px-3 py-1" }, tab)
                )
              ),
              e(
                "svg",
                { viewBox: "0 0 580 260", className: "h-auto w-full overflow-visible" },
                e("path", { className: "chart-grid", d: "M0 52H580M0 116H580M0 180H580" }),
                e("path", { className: "chart-line chart-faint", d: "M26 210 C92 122 132 132 186 158 C254 192 286 218 346 176 C412 128 455 126 552 40" }),
                e("path", { className: "chart-line chart-hot", d: "M26 210 C92 122 132 132 186 158 C254 192 286 218 346 176 C412 128 455 126 552 40" }),
                e("line", { className: "chart-marker", x1: "186", x2: "186", y1: "158", y2: "236" }),
                e("line", { className: "chart-marker", x1: "430", x2: "430", y1: "138", y2: "236" }),
                e("circle", { className: "chart-dot", cx: "186", cy: "158", r: "8" }),
                e("circle", { className: "chart-dot", cx: "430", cy: "138", r: "8" }),
                e("text", { className: "chart-label", x: "128", y: "121" }, "+49%"),
                e("text", { className: "chart-label", x: "386", y: "102" }, "+70%")
              )
            )
          )
        )
      )
    )
  );
}
