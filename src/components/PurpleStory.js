import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function PurpleStory() {
  return e(
    "section",
    { className: "relative h-[230vh] bg-white" },
    e(
      "div",
      { className: "sticky top-0 h-screen overflow-hidden bg-purple" },
      e("div", { className: "purple-art h-full w-full" }),
      e("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,102,173,0.12),transparent_35%),linear-gradient(180deg,rgba(75,22,201,0)_45%,rgba(75,22,201,0.44)_100%)]" }),
      e("div", { className: "scroll-pill left-[7%] top-[28%]" }, "Eligibility scan"),
      e("div", { className: "scroll-pill right-[9%] top-[34%]" }, "Deadline synced"),
      e("div", { className: "scroll-pill bottom-[18%] left-[42%]" }, "Application ready")
    )
  );
}
