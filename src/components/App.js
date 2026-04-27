import React, { useEffect } from "https://esm.sh/react@18.2.0";
import { Navbar } from "./Navbar.js";
import { Hero } from "./Hero.js";
import { PurpleStory } from "./PurpleStory.js";
import { Analytics } from "./Analytics.js";
import { Integrations } from "./Integrations.js";
import { Features } from "./Features.js";
import { Footer } from "./Footer.js";

const e = React.createElement;

export function App() {
  useEffect(() => {
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      const artOffset = -Math.min(Math.max(window.scrollY - 780, 0), 1850);
      document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(4));
      document.documentElement.style.setProperty("--scroll-y", `${window.scrollY.toFixed(0)}px`);
      document.documentElement.style.setProperty("--art-y", `${artOffset.toFixed(0)}px`);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return e(
    "div",
    { className: "min-h-screen overflow-x-hidden bg-[#dfe1e7] text-ink antialiased" },
    e(
      "div",
      { className: "site-frame mx-auto min-h-screen max-w-[1480px] bg-white shadow-[0_24px_80px_rgba(18,18,30,0.12)]" },
      e(Navbar),
      e("main", null, e(Hero), e(PurpleStory), e(Analytics), e(Integrations), e(Features)),
      e(Footer)
    )
  );
}
