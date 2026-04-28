import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const features = [
  ["01", "Create one profile", "Tell imotive your school, level, field, funding need, and interests once."],
  ["02", "Rank best-fit scholarships", "See why each opportunity fits, what it pays, and what it still requires."],
  ["03", "Move before deadlines", "Track application tasks, documents, source links, and urgent dates in one place."]
];

export function Features() {
  return e(
    "section",
    { id: "features", className: "grid gap-4 bg-[#f8f8f8] px-4 py-16 sm:px-10 sm:py-24 lg:grid-cols-3 lg:px-20" },
    features.map(([num, title, body]) =>
      e(
        "article",
        { key: num, className: "rounded-[8px] bg-white p-6 shadow-[0_18px_50px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.09)] sm:p-8" },
        e("span", { className: "text-sm font-black text-pink" }, num),
        e("h3", { className: "mt-6 text-2xl font-medium tracking-normal sm:mt-8 sm:text-3xl" }, title),
        e("p", { className: "mt-4 leading-7 text-black/55" }, body)
      )
    )
  );
}
