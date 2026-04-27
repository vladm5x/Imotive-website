import React from "https://esm.sh/react@18.2.0";
import { Navbar } from "./Navbar.js";
import { Hero } from "./Hero.js";
import { Analytics } from "./Analytics.js";
import { Integrations } from "./Integrations.js";
import { Features } from "./Features.js";
import { Footer } from "./Footer.js";

const e = React.createElement;

export function App() {
  return e(
    "div",
    { className: "min-h-screen overflow-x-hidden bg-[#dfe1e7] text-ink antialiased" },
    e(
      "div",
      { className: "site-frame mx-auto min-h-screen max-w-[1480px] bg-white shadow-[0_24px_80px_rgba(18,18,30,0.12)]" },
      e(Navbar),
      e("main", null, e(Hero), e(Analytics), e(Integrations), e(Features)),
      e(Footer)
    )
  );
}
