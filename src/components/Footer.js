import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Footer() {
  return e(
    "footer",
    { className: "bg-[#1A1A1A] text-white px-4 py-12 sm:px-8 lg:px-10" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px] grid gap-8 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-12" },
      e(
        "div",
        null,
        e(
          "div",
          { className: "flex items-center gap-1.5 font-bold text-[20px] text-white mb-3" },
          "Stipendio",
          e("span", { className: "w-2 h-2 rounded-full bg-[#3B82F6] inline-block", style: { marginBottom: "2px" } })
        ),
        e("p", { className: "text-[14px] leading-relaxed max-w-[220px]", style: { color: "rgba(255,255,255,0.45)" } },
          "Scholarship discovery for university students in Sweden."
        )
      ),
      e(
        "div",
        null,
        e("p", { className: "text-[11px] font-semibold uppercase tracking-wide mb-3", style: { color: "rgba(255,255,255,0.35)" } }, "Product"),
        e(
          "div",
          { className: "flex flex-col gap-2 text-[14px]", style: { color: "rgba(255,255,255,0.65)" } },
          e("a", { href: "/scholarships", className: "hover:text-white transition-colors duration-150" }, "Browse scholarships"),
          e("a", { href: "#how-it-works", className: "hover:text-white transition-colors duration-150" }, "How it works"),
          e("a", { href: "/signup", className: "hover:text-white transition-colors duration-150" }, "Sign up")
        )
      ),
      e(
        "div",
        null,
        e("p", { className: "text-[11px] font-semibold uppercase tracking-wide mb-3", style: { color: "rgba(255,255,255,0.35)" } }, "Company"),
        e(
          "div",
          { className: "flex flex-col gap-2 text-[14px]", style: { color: "rgba(255,255,255,0.65)" } },
          e("a", { href: "/about", className: "hover:text-white transition-colors duration-150" }, "About"),
          e("a", { href: "#universities", className: "hover:text-white transition-colors duration-150" }, "For universities"),
          e("a", { href: "/contact", className: "hover:text-white transition-colors duration-150" }, "Contact")
        )
      ),
      e(
        "div",
        null,
        e("p", { className: "text-[11px] font-semibold uppercase tracking-wide mb-3", style: { color: "rgba(255,255,255,0.35)" } }, "Legal"),
        e(
          "div",
          { className: "flex flex-col gap-2 text-[14px]", style: { color: "rgba(255,255,255,0.65)" } },
          e("a", { href: "/privacy", className: "hover:text-white transition-colors duration-150" }, "Privacy"),
          e("a", { href: "/terms", className: "hover:text-white transition-colors duration-150" }, "Terms")
        )
      )
    ),
    e(
      "div",
      { className: "mx-auto max-w-[1280px] mt-10 pt-6 border-t text-[12px]", style: { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.28)" } },
      `© ${new Date().getFullYear()} Stipendio. All rights reserved.`
    )
  );
}
