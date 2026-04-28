import React from "https://esm.sh/react@18.2.0";

const e = React.createElement;

const miniScholarships = [
  { title: "Wallenberg Engineering Grant", amount: "50,000 kr", daysLeft: 5, progress: 88 },
  { title: "Lund Sustainability Fund", amount: "40,000 kr", daysLeft: 16, progress: 52 },
  { title: "KTH Robotics Grant", amount: "60,000 kr", daysLeft: 29, progress: 28 }
];

function MiniRow({ title, amount, daysLeft, progress }) {
  const urgent = daysLeft <= 14;
  return e(
    "div",
    { style: { padding: "14px 0", borderBottom: "1px solid #E5E7EB" } },
    e(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" } },
      e("span", { style: { fontSize: "13px", fontWeight: 500, color: "#1A1A1A", lineHeight: "1.35" } }, title),
      e("span", { style: { fontSize: "13px", fontWeight: 700, color: "#1A1A1A", whiteSpace: "nowrap", marginLeft: "8px" } }, amount)
    ),
    e(
      "div",
      { className: "progress-track" },
      e("div", {
        className: "progress-fill",
        style: { width: `${progress}%`, background: urgent ? "#FACC15" : "#22C55E" }
      })
    ),
    e("div", {
      style: { textAlign: "right", marginTop: "4px", fontSize: "11px", color: urgent ? "#B45309" : "#9CA3AF" }
    }, `${daysLeft}d left`)
  );
}

function SparkleIcon() {
  return e("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "#3B82F6", style: { display: "inline", verticalAlign: "middle" } },
    e("path", { d: "M12 1L14.39 8.26L22 9.27L16.5 14.64L17.96 22.18L12 18.77L6.04 22.18L7.5 14.64L2 9.27L9.61 8.26L12 1Z" })
  );
}

function SearchIcon() {
  return e("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "#9CA3AF", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
    e("circle", { cx: "11", cy: "11", r: "8" }),
    e("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
  );
}

function LockIcon() {
  return e("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "#3B82F6", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0 },
    e("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2" }),
    e("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
  );
}

export function Hero() {
  const [query, setQuery] = React.useState("");

  function handleSearch(ev) {
    ev.preventDefault();
    window.location.href = "signup.html";
  }

  return e(
    "section",
    { id: "home", style: { background: "#FAFAF7", padding: "72px 0 96px" } },
    e(
      "div",
      { style: { maxWidth: "1280px", margin: "0 auto", padding: "0 40px", display: "grid", gridTemplateColumns: "55fr 45fr", gap: "72px", alignItems: "center" } },

      // ── Left column ──
      e(
        "div",
        null,

        // Eyebrow
        e(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "7px", marginBottom: "22px" } },
          e("span", { style: { fontSize: "17px", fontWeight: 600, color: "#3B82F6" } }, "hi there"),
          e(SparkleIcon)
        ),

        // Headline
        e(
          "h1",
          { style: { fontSize: "clamp(2.8rem, 5.5vw, 4.5rem)", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-2px", color: "#1A1A1A", margin: "0 0 20px" } },
          "Scholarships that ",
          e("span", { className: "marker-wrap" },
            e("span", { className: "marker-highlight" }, "actually fit you.")
          )
        ),

        // Subhead
        e("p", { style: { fontSize: "17px", color: "#555555", lineHeight: "1.65", maxWidth: "480px", margin: "0 0 28px" } },
          "We collect every scholarship for university students in one place — so you stop scrolling and start applying."
        ),

        // Search bar
        e(
          "form",
          { onSubmit: handleSearch, className: "search-bar-hard", style: { marginBottom: "16px" } },
          e(
            "div",
            { style: { padding: "0 14px", display: "flex", alignItems: "center", color: "#9CA3AF" } },
            e(SearchIcon)
          ),
          e("input", {
            type: "text",
            value: query,
            onChange: (ev) => setQuery(ev.target.value),
            placeholder: "Try “engineering, masters, Lund”",
            style: { flex: 1, border: "none", outline: "none", fontSize: "15px", color: "#1A1A1A", background: "transparent", padding: "0" }
          }),
          e(
            "button",
            {
              type: "submit",
              style: { background: "#3B82F6", color: "white", border: "none", height: "100%", padding: "0 22px", fontSize: "15px", fontWeight: 700, cursor: "pointer", borderRadius: "0 8px 8px 0", transition: "background 150ms" },
              onMouseEnter: (ev) => { ev.currentTarget.style.background = "#1E3A8A"; },
              onMouseLeave: (ev) => { ev.currentTarget.style.background = "#3B82F6"; }
            },
            "Search"
          )
        ),

        // Browse CTA row
        e(
          "div",
          { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginBottom: "36px" } },
          e("a", { href: "signup.html", className: "pill-btn" }, "Browse all 2,400+ →"),
          e("span", { style: { fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" } }, "or,"),
          e("a", { href: "signup.html", style: { fontSize: "13px", color: "#3B82F6", fontStyle: "italic", textDecoration: "none" } }, "sign up to get matches")
        ),

        // Social proof
        e(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "12px" } },
          e(
            "div",
            { style: { display: "flex" } },
            ["#FACC15", "#22C55E", "#3B82F6", "#E5E7EB"].map((color, i) =>
              e("div", {
                key: i,
                style: { width: "32px", height: "32px", borderRadius: "50%", border: "2px solid white", background: color, marginLeft: i === 0 ? "0" : "-12px", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
              })
            )
          ),
          e("span", { style: { fontSize: "13px", color: "#555555" } },
            "Joined this week by ",
            e("strong", { style: { color: "#1A1A1A" } }, "312 students")
          )
        )
      ),

      // ── Right column — preview card ──
      e(
        "div",
        { className: "hero-right", style: { position: "relative" } },

        // "matching unlocks after sign-up" annotation
        e(
          "div",
          { style: { position: "absolute", top: "-44px", right: "8px", textAlign: "right", pointerEvents: "none" } },
          e("span", { style: { fontSize: "11px", color: "#9CA3AF", fontStyle: "italic", lineHeight: "1.6" } },
            "matching unlocks", e("br"), "after sign-up"
          )
        ),

        e(
          "div",
          {
            style: {
              background: "white",
              border: "2px solid #1A1A1A",
              borderRadius: "12px",
              boxShadow: "6px 6px 0 #1A1A1A",
              padding: "20px",
              transform: "rotate(1deg)"
            }
          },

          // Label
          e("p", {
            style: {
              fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#9CA3AF",
              margin: "0 0 8px"
            }
          }, "↳ search results preview"),

          // Rows
          miniScholarships.map((s, i) => e(MiniRow, { key: i, ...s })),

          // Locked CTA
          e(
            "div",
            {
              style: {
                marginTop: "16px", padding: "13px 15px",
                border: "2px dashed #3B82F6", borderRadius: "10px",
                background: "rgba(59,130,246,0.06)",
                display: "flex", alignItems: "center", gap: "10px"
              }
            },
            e(LockIcon),
            e("p", { style: { margin: 0, fontSize: "13px", color: "#1A1A1A" } },
              e("a", { href: "signup.html", style: { fontWeight: 700, color: "#3B82F6", textDecoration: "none" } }, "Sign up"),
              " to see your match score on every result."
            )
          )
        )
      )
    )
  );
}
