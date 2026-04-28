import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const steps = [
  {
    number: "1",
    title: "Search or build a profile",
    description: "Tell us your field, level, and a few interests."
  },
  {
    number: "2",
    title: "Filter by what matters",
    description: "Match score, amount, deadline, or effort."
  },
  {
    number: "3",
    title: "Apply & track",
    description: "Save drafts, set reminders, see status."
  }
];

export function HowItWorks() {
  return e(
    "section",
    { id: "how-it-works", style: { background: "#F3F4F6", padding: "80px 0", borderTop: "1px solid #E5E7EB" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", padding: "0 40px" } },
      e(
        "div",
        { style: { textAlign: "center", marginBottom: "48px" } },
        e("h2", { style: { margin: "0 0 10px", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.5px" } },
          "From confused to confident in 3 steps."
        ),
        e("p", { style: { margin: 0, fontSize: "15px", color: "#6B7280" } }, "No friction. No hidden steps.")
      ),
      e(
        "div",
        { style: { display: "flex", alignItems: "stretch", gap: "0" } },
        steps.flatMap((step, i) => {
          const card = e(
            "div",
            {
              key: step.number,
              style: {
                flex: 1, background: "white", border: "2px solid #1A1A1A",
                borderRadius: "12px", padding: "28px 24px",
                display: "flex", flexDirection: "column", gap: "12px"
              }
            },
            e(
              "div",
              {
                style: {
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: "#3B82F6", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", fontWeight: 800, flexShrink: 0
                }
              },
              step.number
            ),
            e("h3", { style: { margin: 0, fontSize: "17px", fontWeight: 700, color: "#1A1A1A" } }, step.title),
            e("p", { style: { margin: 0, fontSize: "14px", color: "#6B7280", lineHeight: "1.6" } }, step.description)
          );

          if (i < steps.length - 1) {
            const arrow = e(
              "div",
              {
                key: `arrow-${i}`,
                style: { display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px", flexShrink: 0, color: "#3B82F6", fontSize: "20px", fontWeight: 300 }
              },
              "→"
            );
            return [card, arrow];
          }
          return [card];
        })
      )
    )
  );
}
