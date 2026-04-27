import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Footer() {
  return e(
    "footer",
    { id: "contact", className: "flex flex-wrap justify-between gap-4 bg-black px-6 py-10 text-sm text-white/70 sm:px-10 lg:px-20" },
    e("span", null, "imotive prototype"),
    e("span", null, "Scholarship matching, ranked results, and application analytics.")
  );
}
