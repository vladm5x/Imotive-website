import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

export function CTA() {
  return e(
    "section",
    { style: { background: "#3B82F6", padding: "80px 40px", textAlign: "center", borderTop: "2px solid #1E3A8A" } },
    e(
      "div",
      { style: { maxWidth: "600px", margin: "0 auto" } },
      e("p", { style: { margin: "0 0 12px", fontSize: "14px", fontWeight: 500, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" } },
        "2 minutes. that's all."
      ),
      e("h2", { style: { margin: "0 0 32px", fontSize: "clamp(1.9rem, 4vw, 2.8rem)", fontWeight: 800, color: "white", lineHeight: "1.05", letterSpacing: "-0.5px" } },
        "Start finding your scholarships."
      ),
      e(
        "div",
        { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "12px" } },
        e("a", {
          href: "/signup",
          style: {
            display: "inline-flex", alignItems: "center", height: "48px",
            padding: "0 28px", background: "#22C55E",
            border: "2px solid #1A1A1A", borderRadius: "10px",
            boxShadow: "3px 3px 0 #1A1A1A",
            fontSize: "15px", fontWeight: 700, color: "white", textDecoration: "none",
            transition: "transform 150ms, box-shadow 150ms"
          },
          onMouseEnter: (ev) => {
            ev.currentTarget.style.transform = "translateY(-2px)";
            ev.currentTarget.style.boxShadow = "4px 5px 0 #1A1A1A";
          },
          onMouseLeave: (ev) => {
            ev.currentTarget.style.transform = "translateY(0)";
            ev.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A";
          }
        }, "Start searching →"),
        e("a", {
          href: "/scholarships",
          style: {
            display: "inline-flex", alignItems: "center", height: "48px",
            padding: "0 28px", background: "transparent",
            border: "2px solid rgba(255,255,255,0.5)", borderRadius: "10px",
            fontSize: "15px", fontWeight: 600, color: "white", textDecoration: "none",
            transition: "border-color 150ms, background 150ms"
          },
          onMouseEnter: (ev) => { ev.currentTarget.style.background = "rgba(255,255,255,0.1)"; },
          onMouseLeave: (ev) => { ev.currentTarget.style.background = "transparent"; }
        }, "Browse instead")
      )
    )
  );
}
