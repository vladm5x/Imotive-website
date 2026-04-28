import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const universities = ["Lund University", "KTH", "Uppsala", "Chalmers", "Stockholm", "Göteborg"];

export function SocialProof() {
  return e(
    "div",
    { className: "bg-[#F3F4F6] border-y border-[#E5E7EB] py-5 px-4 sm:px-8" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px] flex flex-wrap items-center justify-center gap-x-8 gap-y-2" },
      e("span", { className: "text-[13px] font-medium text-[#555555] whitespace-nowrap" }, "trusted by students at"),
      universities.map((u) =>
        e("span", { key: u, className: "text-[14px] font-semibold text-[#1A1A1A] whitespace-nowrap" }, u)
      )
    )
  );
}
