import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Footer() {
  return e(
    "footer",
    { id: "contact", className: "flex flex-col gap-3 bg-black px-4 py-9 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:justify-between sm:px-10 lg:px-20" },
    e("span", null, "imotive prototype"),
    e("span", null, "Scholarship matching, ranked results, and application analytics.")
  );
}
