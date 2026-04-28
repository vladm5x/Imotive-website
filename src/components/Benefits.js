import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const benefits = [
  {
    title: "Save 6+ hours a month",
    description: "No more bouncing between university pages."
  },
  {
    title: "Discover what you didn't know",
    description: "Niche & private grants surface automatically."
  },
  {
    title: "Personalized matches",
    description: "The more you tell us, the better it gets."
  }
];

export function Benefits() {
  return e(
    "section",
    { style: { background: "#FAFAF7", padding: "80px 0", borderTop: "1px solid #E5E7EB" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", padding: "0 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" } },

      // Left — benefits list
      e(
        "div",
        null,
        e("p", { style: { fontSize: "12px", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", marginBottom: "12px" } }, "/ why students like it"),
        e("h2", { style: { margin: "0 0 40px", fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#1A1A1A", lineHeight: "1.1", letterSpacing: "-0.5px" } },
          "Less time hunting, more time applying."
        ),
        e(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "28px" } },
          benefits.map((b) =>
            e(
              "div",
              { key: b.title, style: { display: "flex", gap: "16px" } },
              e(
                "div",
                {
                  style: {
                    width: "24px", height: "24px", borderRadius: "50%",
                    background: "#22C55E", border: "2px solid #1A1A1A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: "2px"
                  }
                },
                e("span", { style: { color: "white", fontSize: "11px", fontWeight: 900 } }, "✓")
              ),
              e(
                "div",
                null,
                e("h3", { style: { margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#1A1A1A" } }, b.title),
                e("p", { style: { margin: 0, fontSize: "14px", color: "#6B7280", lineHeight: "1.55" } }, b.description)
              )
            )
          )
        )
      ),

      // Right — testimonial card
      e(
        "div",
        {
          style: {
            background: "white", border: "2px solid #1A1A1A",
            borderRadius: "16px", boxShadow: "5px 5px 0 #1A1A1A",
            padding: "36px 32px"
          }
        },
        e("div", { style: { fontSize: "72px", lineHeight: "1", color: "#3B82F6", marginBottom: "16px", fontFamily: "Georgia, serif" } }, "“"),
        e(
          "blockquote",
          { style: { margin: "0 0 28px", fontSize: "17px", color: "#1A1A1A", lineHeight: "1.6", fontStyle: "italic" } },
          "I found 4 scholarships I qualified for in my first session. Got 2 of them. Paid my whole semester."
        ),
        e(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "12px" } },
          e(
            "div",
            {
              style: {
                width: "42px", height: "42px", borderRadius: "50%",
                background: "#3B82F6", border: "2px solid #1A1A1A",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 800, fontSize: "13px", flexShrink: 0
              }
            },
            "SL"
          ),
          e(
            "div",
            null,
            e("p", { style: { margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: "#1A1A1A" } }, "Sara L."),
            e("p", { style: { margin: 0, fontSize: "13px", color: "#6B7280" } }, "MSc Engineering, Lund")
          )
        )
      )
    )
  );
}
