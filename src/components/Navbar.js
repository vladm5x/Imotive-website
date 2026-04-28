import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function Navbar() {
  return e(
    "header",
    { className: "sticky top-0 z-50 bg-white border-b border-[#E5E7EB]" },
    e(
      "div",
      { className: "mx-auto max-w-[1280px] flex items-center justify-between h-16 px-4 sm:px-8 lg:px-10" },
      e(
        "a",
        { href: "#home", className: "flex items-center gap-1.5 font-bold text-[20px] text-[#1A1A1A] no-underline" },
        "Stipendio",
        e("span", {
          className: "w-2 h-2 rounded-full bg-[#3B82F6] inline-block",
          style: { marginBottom: "2px" }
        })
      ),
      e(
        "nav",
        { className: "hidden md:flex items-center gap-8 text-[15px] text-[#555555]" },
        e("a", { href: "#scholarships", className: "hover:text-[#1A1A1A] transition-colors duration-150" }, "Browse"),
        e("a", { href: "#how-it-works", className: "hover:text-[#1A1A1A] transition-colors duration-150" }, "How it works"),
        e("a", { href: "#universities", className: "hover:text-[#1A1A1A] transition-colors duration-150" }, "For universities")
      ),
      e(
        "div",
        { className: "flex items-center gap-4" },
        e(
          "a",
          { href: "/login", className: "hidden sm:inline text-[15px] text-[#555555] hover:text-[#1A1A1A] transition-colors duration-150" },
          "Log in"
        ),
        e(
          "a",
          { href: "/signup", className: "bg-[#3B82F6] text-white text-[14px] font-semibold px-4 py-2 rounded-lg hover:bg-[#1E3A8A] transition-colors duration-150" },
          "Sign up"
        )
      )
    )
  );
}
