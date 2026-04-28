import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const steps = [
  {
    number: "1",
    title: "Create Your Profile",
    description: "Tell us your field of study, level, nationality and preferences",
    image: "assets/how-step-1.png"
  },
  {
    number: "2",
    title: "Get Matched",
    description: "We rank the best scholarships based on your profile",
    image: "assets/how-step-2.png"
  },
  {
    number: "3",
    title: "Track & Apply",
    description: "See exactly what's missing and complete your application",
    image: "assets/how-step-3.png"
  }
];

export function HowItWorks() {
  return e(
    "section",
    { className: "how-it-works bg-white px-4 py-16 sm:px-10 sm:py-24 lg:px-20", id: "how-it-works" },
    e(
      "div",
      { className: "mx-auto max-w-[1180px]" },
      e(
        "div",
        { className: "mx-auto max-w-2xl text-center" },
        e("p", { className: "text-sm font-black uppercase text-purple" }, "How it works"),
        e("h2", { className: "mt-3 text-[clamp(2.2rem,7vw,4.6rem)] font-medium leading-[1.04] tracking-normal" }, "From profile to application")
      ),
      e(
        "div",
        { className: "how-steps mt-14 grid gap-12 md:grid-cols-3 md:gap-7 lg:gap-12" },
        steps.map((step) =>
          e(
            "article",
            { key: step.number, className: "how-step relative flex flex-col items-center text-center" },
            e(
              "div",
              { className: "step-art-shell relative w-[min(82vw,320px)] md:w-full md:max-w-[340px]" },
              e("span", { className: "step-badge" }, step.number),
              e(
                "div",
                { className: "step-art-frame" },
              e("img", {
                className: "step-art",
                src: step.image,
                alt: ""
              })
              )
            ),
            e("h3", { className: "mt-8 text-xl font-black uppercase tracking-normal text-black" }, step.title),
            e("p", { className: "mt-3 max-w-[280px] text-[15px] leading-7 text-black/55" }, step.description)
          )
        )
      )
    )
  );
}
