import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const scholarships = [
  {
    title: "Swedish Institute Scholarships for Global Professionals",
    amount: "SEK 130,000",
    daysLeft: 28,
    progressPercent: 25,
    effort: "Medium",
    eligibilityTag: "Masters · International",
    slug: "si-scholarships-global",
    description: "Full funding for master’s studies in Sweden. Covers tuition, living costs, and travel grants."
  },
  {
    title: "Chalmers Jubilee Scholarship",
    amount: "SEK 40,000",
    daysLeft: 9,
    progressPercent: 82,
    effort: "⏱ Easy apply",
    eligibilityTag: "Engineering · Masters",
    slug: "chalmers-jubilee",
    description: "For outstanding students admitted to Chalmers master’s programs in engineering or science."
  },
  {
    title: "Lund University Global Scholarship",
    amount: "SEK 80,000",
    daysLeft: 21,
    progressPercent: 40,
    effort: "Hard",
    eligibilityTag: "All fields · Masters",
    slug: "lund-global-scholarship",
    description: "Covers partial tuition fees for non-EU/EEA students admitted to selected master’s programs."
  }
];

function ScholarshipCard({ title, amount, daysLeft, progressPercent, effort, eligibilityTag, slug, description }) {
  const urgent = daysLeft < 14;

  return e(
    "article",
    {
      className: "bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-5 flex flex-col gap-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
      onClick: () => { window.location.href = `/scholarships/${slug}`; }
    },
    e(
      "div",
      { className: "flex items-start justify-between gap-3" },
      e("span", { className: "text-[12px] rounded-full px-2.5 py-1 bg-[#F3F4F6] text-[#555555] font-medium whitespace-nowrap" }, eligibilityTag),
      e("span", { className: "text-[14px] font-bold text-[#1A1A1A] whitespace-nowrap" }, amount)
    ),
    e("h3", { className: "text-[17px] font-semibold text-[#1A1A1A] leading-snug" }, title),
    e("p", { className: "text-[13px] text-[#555555] leading-relaxed flex-1" }, description),
    e(
      "div",
      null,
      e(
        "div",
        { className: "flex justify-between text-[12px] mb-1.5" },
        e("span", { className: "text-[#555555]" }, "Deadline"),
        e("span", {
          className: "font-medium",
          style: { color: urgent ? "#B45309" : "#555555" }
        }, `${daysLeft} days left`)
      ),
      e(
        "div",
        { className: "h-2 rounded-full bg-[#E5E7EB] overflow-hidden" },
        e("div", {
          className: "h-full rounded-full",
          style: { width: `${progressPercent}%`, background: urgent ? "#FACC15" : "#22C55E" }
        })
      )
    ),
    e("span", { className: "self-start text-[12px] rounded-full px-2.5 py-1 bg-[#F3F4F6] text-[#555555]" }, effort),
    e(
      "a",
      {
        href: `/scholarships/${slug}`,
        className: "block w-full text-center bg-[#22C55E] text-white text-[14px] font-semibold py-2.5 rounded-lg hover:bg-[#16A34A] transition-colors duration-150 mt-auto",
        onClick: (ev) => ev.stopPropagation()
      },
      "Apply →"
    )
  );
}

export function FeaturedScholarships() {
  return e(
    "section",
    { id: "scholarships", className: "bg-[#F3F4F6] px-4 py-16 sm:px-8 sm:py-20 lg:px-10" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px]" },
      e(
        "div",
        { className: "flex flex-wrap items-end justify-between gap-4 mb-10" },
        e(
          "div",
          null,
          e("p", { className: "text-[13px] font-medium text-[#555555] mb-2" }, "/ a peek at what’s inside"),
          e("h2", { className: "text-[clamp(1.8rem,4vw,2.4rem)] font-bold text-[#1A1A1A] leading-tight" }, "Featured scholarships this week."),
          e("p", { className: "text-[15px] text-[#555555] mt-1" }, "Sign up to see which ones fit you.")
        ),
        e("a", { href: "/scholarships", className: "text-[14px] font-semibold text-[#3B82F6] hover:underline whitespace-nowrap" }, "browse all 2,400+ →")
      ),
      e(
        "div",
        { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3" },
        scholarships.map((s) => e(ScholarshipCard, { key: s.slug, ...s }))
      )
    )
  );
}
