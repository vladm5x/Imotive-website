import React from "https://esm.sh/react@18.2.0";
import { Navbar } from "./Navbar.js";
import { Hero } from "./Hero.js";
import { SocialProof } from "./SocialProof.js";
import { FeaturedScholarships } from "./FeaturedScholarships.js";
import { HowItWorks } from "./HowItWorks.js";
import { Benefits } from "./Benefits.js";
import { CTA } from "./CTA.js";
import { Footer } from "./Footer.js";

const e = React.createElement;

export function App() {
  return e(
    "div",
    { className: "min-h-screen overflow-x-hidden bg-white" },
    e(Navbar),
    e(
      "main",
      null,
      e(Hero),
      e(SocialProof),
      e(FeaturedScholarships),
      e(HowItWorks),
      e(Benefits),
      e(CTA)
    ),
    e(Footer)
  );
}
