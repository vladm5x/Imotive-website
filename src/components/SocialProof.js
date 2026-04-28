import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const universities = ["Lund University", "KTH", "Uppsala", "Chalmers", "Stockholm", "Göteborg"];

export function SocialProof() {
  return e(
    "div",
    { style: { background: "#F3F4F6", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", padding: "28px 0" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", padding: "0 40px" } },
      e(
        "p",
        { style: { textAlign: "center", fontSize: "12px", fontStyle: "italic", color: "#9CA3AF", marginBottom: "14px" } },
        "Trusted by students at"
      ),
      e(
        "div",
        { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0" } },
        universities.map((u, i) =>
          e(
            React.Fragment,
            { key: u },
            e("span", {
              style: {
                fontSize: "16px", fontWeight: 500, color: "#1A1A1A",
                padding: "0 24px",
                textDecoration: "underline",
                textDecorationColor: "rgba(0,0,0,0.2)",
                textUnderlineOffset: "3px"
              }
            }, u),
            i < universities.length - 1
              ? e("span", { style: { color: "#D1D5DB", fontSize: "16px", userSelect: "none" } }, "·")
              : null
          )
        )
      )
    )
  );
}
