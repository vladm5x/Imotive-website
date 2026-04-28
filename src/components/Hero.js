import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const miniScholarships = [
  { title: "Swedish Institute Scholarship for Global Professionals", amount: "130,000 kr", daysLeft: 28, progress: 25 },
  { title: "KTH Research Excellence Fellowship", amount: "60,000 kr", daysLeft: 9, progress: 82 },
  { title: "Chalmers Jubilee STEM Award", amount: "40,000 kr", daysLeft: 22, progress: 38 }
];

function MiniRow({ title, amount, daysLeft, progress }) {
  const urgent = daysLeft < 14;
  return e(
    "div",
    { className: "py-3 border-b border-[#E5E7EB] last:border-0" },
    e(
      "div",
      { className: "flex items-start justify-between gap-2 mb-2" },
      e("span", { className: "text-[13px] font-medium text-[#1A1A1A] leading-snug" }, title),
      e("span", { className: "text-[13px] font-bold text-[#1A1A1A] whitespace-nowrap ml-2" }, amount)
    ),
    e(
      "div",
      { className: "flex items-center gap-2" },
      e(
        "div",
        { className: "flex-1 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden" },
        e("div", {
          className: "h-full rounded-full",
          style: { width: `${progress}%`, background: urgent ? "#FACC15" : "#22C55E" }
        })
      ),
      e("span", {
        className: "text-[11px] font-medium whitespace-nowrap",
        style: { color: urgent ? "#B45309" : "#6B7280" }
      }, `${daysLeft}d left`)
    )
  );
}

export function Hero() {
  const [query, setQuery] = React.useState("");

  function handleSearch(ev) {
    ev.preventDefault();
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
    }
  }

  return e(
    "section",
    { id: "home", className: "bg-white px-4 py-16 sm:px-8 sm:py-24 lg:px-10" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px]" },
      e(
        "div",
        { className: "grid lg:grid-cols-[55fr_45fr] gap-12 lg:gap-16 items-center" },
        e(
          "div",
          null,
          e("p", { className: "text-[14px] font-medium text-[#3B82F6] mb-4" }, "hi there ✶"),
          e(
            "h1",
            { className: "text-[clamp(2.6rem,5.5vw,4rem)] font-bold text-[#1A1A1A] leading-[1.05] tracking-[-0.5px] mb-5" },
            "Scholarships that ",
            e("span", { className: "marker-highlight" }, "actually fit you.")
          ),
          e(
            "p",
            { className: "text-[17px] text-[#555555] leading-[1.65] mb-8 max-w-[520px]" },
            "We collect every scholarship for university students in one place — so you stop scrolling and start applying."
          ),
          e(
            "form",
            {
              onSubmit: handleSearch,
              className: "flex items-center bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden mb-4"
            },
            e("input", {
              type: "text",
              value: query,
              onChange: (ev) => setQuery(ev.target.value),
              placeholder: "Try “engineering, masters, Lund”",
              className: "flex-1 px-4 py-3.5 text-[15px] text-[#1A1A1A] outline-none bg-transparent placeholder:text-[#9CA3AF]"
            }),
            e(
              "button",
              {
                type: "submit",
                className: "bg-[#3B82F6] text-white px-5 py-3.5 text-[14px] font-semibold hover:bg-[#1E3A8A] transition-colors duration-150 shrink-0"
              },
              "Search"
            )
          ),
          e(
            "div",
            { className: "flex flex-wrap items-center gap-2 text-[14px] mb-10" },
            e("a", { href: "/scholarships", className: "font-semibold text-[#1A1A1A] hover:text-[#3B82F6] transition-colors duration-150" }, "Browse all 2,400+ →"),
            e("span", { className: "text-[#9CA3AF]" }, "or,"),
            e("a", { href: "/signup", className: "text-[#3B82F6] hover:underline" }, "sign up to get matches")
          ),
          e(
            "div",
            { className: "flex items-center gap-3" },
            e(
              "div",
              { className: "flex -space-x-2" },
              ["#3B82F6", "#22C55E", "#FACC15", "#F87171"].map((color, i) =>
                e("div", {
                  key: i,
                  className: "w-8 h-8 rounded-full border-2 border-white",
                  style: { background: color }
                })
              )
            ),
            e(
              "span",
              { className: "text-[13px] text-[#555555]" },
              "Joined this week by ",
              e("strong", { className: "text-[#1A1A1A]" }, "312 students")
            )
          )
        ),
        e(
          "div",
          { className: "hidden lg:block" },
          e(
            "div",
            { className: "bg-white border border-[#E5E7EB] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-5" },
            e("p", { className: "text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2" }, "Search results preview"),
            miniScholarships.map((s, i) => e(MiniRow, { key: i, ...s })),
            e(
              "div",
              { className: "mt-4 p-4 rounded-lg border-2 border-dashed border-[#3B82F6] bg-[#EFF6FF]" },
              e(
                "p",
                { className: "text-[13px] text-[#1A1A1A] text-center" },
                "🔒 ",
                e("a", { href: "/signup", className: "font-semibold text-[#3B82F6] hover:underline" }, "Sign up"),
                " to see your match score on every result."
              )
            )
          )
        )
      )
    )
  );
}
