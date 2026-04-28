import React from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import { getSession, getUserProfile, isSupabaseConfigured, signOut } from "./lib/account.js";

const e = React.createElement;

const scholarships = [
  {
    title: "Wallenberg Engineering",
    amount: "50,000 kr",
    match: 94,
    description: "Open to all engineering masters.",
    daysLeft: 12,
    progress: 75,
    effort: "Easy apply"
  },
  {
    title: "Lund Sustainability Fund",
    amount: "40,000 kr",
    match: 91,
    description: "For students researching climate.",
    daysLeft: 9,
    progress: 82,
    effort: "Easy apply"
  },
  {
    title: "KTH Robotics Grant",
    amount: "60,000 kr",
    match: 88,
    description: "Robotics research projects.",
    daysLeft: 33,
    progress: 38,
    effort: "Medium apply"
  },
  {
    title: "Erasmus+ Mobility",
    amount: "EUR 3,200",
    match: 81,
    description: "Exchange semester EU-wide.",
    daysLeft: 64,
    progress: 18,
    effort: "Easy apply"
  },
  {
    title: "Women in STEM Fund",
    amount: "15,000 kr",
    match: 77,
    description: "Short essay, open eligibility.",
    daysLeft: 21,
    progress: 47,
    effort: "Easy apply"
  },
  {
    title: "Nordic Research Award",
    amount: "25,000 kr",
    match: 72,
    description: "For published research only.",
    daysLeft: 47,
    progress: 28,
    effort: "Hard apply"
  }
];

const filters = ["All fields", "Any level", "Any deadline", "Any amount", "Effort: any"];
const universities = ["Lund", "KTH", "Uppsala", "Chalmers", "Stockholm Univ.", "Goteborg"];

function AccountPage() {
  const [state, setState] = React.useState({ loading: true, session: null, profile: null, error: "" });

  React.useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!isSupabaseConfigured()) {
          setState({ loading: false, session: null, profile: null, error: "" });
          return;
        }
        const session = await getSession();
        let profile = null;
        if (session) {
          try {
            profile = await getUserProfile();
          } catch (error) {
            console.warn("Could not load profile:", error);
          }
        }
        if (active) setState({ loading: false, session, profile, error: "" });
      } catch (error) {
        if (active) setState({ loading: false, session: null, profile: null, error: error.message });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    window.location.href = "index.html";
  }

  if (state.loading) {
    return e(Layout, { onSignOut: handleSignOut, signedOut: true }, e("main", { className: "browse-loading" }, "Loading scholarships..."));
  }

  if (!isSupabaseConfigured()) {
    return e(
      Layout,
      { onSignOut: handleSignOut, signedOut: true },
      e("main", { className: "browse-empty" },
        e("p", { className: "signup-eyebrow" }, "setup needed"),
        e("h1", null, "Connect Supabase to enable accounts."),
        e("p", null, "Add your public Supabase URL and anon key in src/lib/supabaseClient.js, then enable Google in Supabase Auth.")
      )
    );
  }

  if (!state.session) {
    return e(
      Layout,
      { onSignOut: handleSignOut, signedOut: true },
      e("main", { className: "browse-empty" },
        e("p", { className: "signup-eyebrow" }, "signed out"),
        e("h1", null, "Sign in to browse your scholarship matches."),
        e("a", { href: "signup.html?mode=login", className: "browse-primary-link" }, "Log in")
      )
    );
  }

  return e(
    React.Fragment,
    null,
    e(Layout, { onSignOut: handleSignOut }),
    e(
      "main",
      { className: "browse-page" },
      state.error ? e("p", { className: "signup-error browse-error" }, state.error) : null,
      e(HeroSearch, { profile: state.profile, user: state.session.user }),
      e(FilterBar),
      e(
        "section",
        { className: "browse-grid", "aria-label": "Scholarship results" },
        scholarships.map((item) => e(ScholarshipCard, { key: item.title, item }))
      ),
      e("div", { className: "browse-load-row" }, e("button", { type: "button", className: "browse-load" }, "Load more (2,425 remaining) ->"))
    ),
    e(TrustedBand)
  );
}

function Layout({ children, onSignOut, signedOut = false }) {
  return e(
    React.Fragment,
    null,
    e(
      "header",
      { className: "site-nav" },
      e(
        "div",
        { className: "home-shell nav-inner" },
        e(
          "a",
          { href: "index.html", className: "brand-mark", "aria-label": "iMotive home" },
          e("span", null),
          e("strong", null, "iMotive")
        ),
        e(
          "nav",
          { className: "nav-links" },
          e("a", { href: "account.html" }, "Browse"),
          e("a", { href: "index.html#how-it-works" }, "How it works"),
          e("a", { href: "index.html#universities" }, "For universities")
        ),
        e(
          "div",
          { className: "nav-actions" },
          signedOut ? e("a", { href: "signup.html?mode=login" }, "Log in") : e("button", { type: "button", className: "browse-nav-button", onClick: onSignOut }, "Log out"),
          e("a", { href: "signup.html", className: "nav-signup" }, "Sign up")
        )
      )
    ),
    children
  );
}

function HeroSearch({ profile, user }) {
  const answers = profile?.answers || {};
  const name = profile?.full_name || user.user_metadata?.full_name || user.email || "";
  const firstName = name.split(" ")[0];

  return e(
    "section",
    { className: "browse-hero" },
    e(
      "div",
      { className: "browse-hero-copy" },
      e("p", { className: "hand-note browse-kicker" }, e("span", { "aria-hidden": "true" }, "+"), " 2,431 scholarships, indexed weekly"),
      e("h1", { className: "hand-title" }, firstName ? `Find scholarships, ${firstName}.` : "Find scholarships in seconds."),
      e("p", { className: "browse-subhead" }, profile?.university || answers.university ? `Matches are tuned for ${profile?.university || answers.university}. Start scanning right away.` : "We collect and match scholarships for students in one place - start scanning right away.")
    ),
    e(
      "div",
      { className: "browse-search-panel" },
      e(
        "label",
        { className: "browse-search", "aria-label": "Search scholarships" },
        e("span", { "aria-hidden": "true" }, "Q"),
        e("input", { placeholder: "Search scholarships, fields, universities..." })
      ),
      e(
        "div",
        { className: "browse-actions-row" },
        e("button", { type: "button", className: "browse-primary" }, "Start searching"),
        e("button", { type: "button", className: "browse-secondary" }, "Browse all")
      ),
      e("p", { className: "hand-note browse-hint" }, "both equal weight, side by side")
    )
  );
}

function FilterBar() {
  return e(
    "section",
    { className: "filter-zone" },
    e(
      "div",
      { className: "filter-row" },
      e("div", { className: "filter-left" },
        e("span", { className: "hand-note filter-label" }, "Filter:"),
        filters.map((filter) => e("button", { key: filter, type: "button", className: "filter-pill" }, filter, " v"))
      ),
      e("p", { className: "sort-copy" }, "Sort by: ", e("a", { href: "#" }, "Best match"))
    ),
    e("p", { className: "hand-note landing-note" }, "results show on landing")
  );
}

function ScholarshipCard({ item }) {
  const urgent = item.daysLeft <= 14;
  return e(
    "article",
    { className: "browse-card" },
    e("div", { className: "browse-card-top" }, e("span", { className: "match-pill" }, `${item.match}% match`), e("strong", { className: "hand-title" }, item.amount)),
    e("h2", { className: "hand-title" }, item.title),
    e("p", { className: "card-desc" }, item.description),
    e("div", { className: "deadline-row browse-deadline" }, e("span", null, "Deadline"), e("strong", { style: { color: urgent ? "#B45309" : "#555555" } }, `${item.daysLeft} days left`)),
    e("div", { className: "progress-track" }, e("span", { className: "progress-fill", style: { width: `${item.progress}%`, background: urgent ? "#FACC15" : "#22C55E" } })),
    e("span", { className: "effort-pill" }, item.effort),
    e("a", { href: "#", className: "apply-btn" }, "Apply ->")
  );
}

function TrustedBand() {
  return e(
    "footer",
    { className: "browse-trusted" },
    e("p", { className: "hand-note" }, "Used by 12,000+ students at"),
    universities.map((university) => e("span", { key: university, className: "hand-note" }, university))
  );
}

createRoot(document.getElementById("root")).render(e(AccountPage));
