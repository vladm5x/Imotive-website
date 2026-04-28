import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const tags = [
  { label: "#Engineering", x: 4, y: 214, r: -10, delay: 0.05 },
  { label: "#Lund", x: 35, y: 224, r: 6, delay: 0.24 },
  { label: "#NeedAid", x: 60, y: 206, r: -7, delay: 0.14 },
  { label: "#Research", x: 8, y: 166, r: 13, delay: 0.42 },
  { label: "#Travel", x: 73, y: 224, r: 15, delay: 0.32 },
  { label: "#Merit", x: 42, y: 156, r: -12, delay: 0.58 },
  { label: "#Sustainability", x: 2, y: 190, r: -5, delay: 0.68 },
  { label: "#Tuition", x: 43, y: 195, r: 4, delay: 0.78 },
  { label: "#Essay", x: 76, y: 174, r: -15, delay: 0.9 },
  { label: "#STEM", x: 26, y: 181, r: 17, delay: 1.02 }
];

export function Analytics() {
  return e(
    "section",
    { id: "analytics", className: "relative bg-white px-4 pb-16 pt-16 sm:px-10 sm:pb-24 sm:pt-24 lg:px-20" },
    e(
      "div",
      { className: "mx-auto max-w-[1320px]" },
      e("h2", { className: "mx-auto max-w-2xl text-center text-[clamp(2.15rem,11vw,5rem)] font-medium leading-[1.04] tracking-normal sm:text-[clamp(2.6rem,5vw,5rem)]" }, "Advanced Matching and Reporting"),
      e(
        "div",
        { className: "mt-10 grid gap-5 sm:mt-16 sm:gap-6 lg:grid-cols-[0.85fr_1.15fr]" },
        e(
          "article",
          { className: "analytics-card" },
          e("h3", { className: "text-[clamp(1.45rem,6vw,2.25rem)] font-medium tracking-normal" }, "Scholarship Fit Signals"),
          e(
            "div",
            { className: "mt-5 rounded-[8px] bg-white p-4 shadow-inner sm:mt-7 sm:p-6" },
            e(
              "div",
              { className: "tag-cloud min-h-[285px]" },
              tags.map((tag, index) =>
                e(
                  "span",
                  {
                    key: tag.label,
                    style: {
                      "--i": index,
                      "--x": `${tag.x}%`,
                      "--land-y": `${tag.y}px`,
                      "--r": `${tag.r}deg`,
                      "--delay": `${tag.delay}s`
                    }
                  },
                  tag.label
                )
              )
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
          e("h3", { className: "text-[clamp(1.45rem,6vw,2.25rem)] font-medium tracking-normal" }, "Optimizing Applications"),
          e(
            "div",
            { className: "mt-5 grid gap-5 sm:mt-7 sm:gap-6 lg:grid-cols-[190px_1fr]" },
            e(
              "div",
              { className: "grid gap-5" },
              e("div", { className: "metric-tile bg-yellow" }, e("span", null, "Match Rate"), e("strong", null, "+61%")),
              e("div", { className: "metric-tile bg-pink text-white" }, e("span", null, "Completed Steps"), e("strong", null, "+73%"))
            ),
            e(
              "div",
              { className: "relative min-h-[250px] rounded-[8px] bg-white p-4 sm:min-h-[310px] sm:p-6" },
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
