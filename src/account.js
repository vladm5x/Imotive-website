import React from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import { getSession, getUserProfile, isSupabaseConfigured, signOut } from "./lib/account.js";
import { fetchScholarships } from "./lib/scholarships.js";
import { rankScholarships, daysUntil } from "./lib/matching.js";

const e = React.createElement;

const SIGNUP_KEY = "imotive_signup_answers";
const LEGACY_KEY = "grantlyProfile";
const SAVED_KEY = "imotive_saved";

const FIELD_OPTIONS = ["All fields", "Engineering", "IT", "Computer Science", "Business", "Economics", "Medicine", "Natural sciences", "Humanities", "Social sciences", "Law", "Architecture"];
const LEVEL_OPTIONS = ["Any level", "Bachelor", "Master", "PhD"];

function getLocalProfile() {
  try {
    const raw = localStorage.getItem(SIGNUP_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSavedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function AccountPage() {
  const [authState, setAuthState] = React.useState({ loading: true, session: null, profile: null });
  const [allScholarships, setAllScholarships] = React.useState([]);
  const [scholarLoading, setScholarLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [filterField, setFilterField] = React.useState("All fields");
  const [filterLevel, setFilterLevel] = React.useState("Any level");
  const [sortBy, setSortBy] = React.useState("match");
  const [savedIds, setSavedIds] = React.useState(() => getSavedIds());

  React.useEffect(() => {
    let active = true;
    async function loadAuth() {
      try {
        if (isSupabaseConfigured()) {
          const session = await getSession();
          let profile = null;
          if (session) {
            try { profile = await getUserProfile(); } catch {}
          }
          if (active) setAuthState({ loading: false, session, profile });
        } else {
          if (active) setAuthState({ loading: false, session: null, profile: null });
        }
      } catch {
        if (active) setAuthState({ loading: false, session: null, profile: null });
      }
    }
    loadAuth();
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (authState.loading) return;
    let active = true;
    async function loadScholarships() {
      setScholarLoading(true);
      try {
        const data = await fetchScholarships();
        if (!active) return;
        const localProfile = authState.profile?.answers || getLocalProfile();
        const ranked = localProfile ? rankScholarships(data, localProfile, { includeIneligible: true }) : data;
        setAllScholarships(ranked);
      } catch (err) {
        if (active) setLoadError("Could not load scholarships. Check your connection.");
      } finally {
        if (active) setScholarLoading(false);
      }
    }
    loadScholarships();
    return () => { active = false; };
  }, [authState.loading, authState.profile]);

  const filtered = React.useMemo(() => {
    let items = [...allScholarships];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) =>
        (item.title || "").toLowerCase().includes(q) ||
        (item.source || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q) ||
        (item.fields || []).join(" ").toLowerCase().includes(q) ||
        (item.eligibility || "").toLowerCase().includes(q)
      );
    }

    if (filterField !== "All fields") {
      items = items.filter((item) =>
        (item.fields || []).some((f) => f.toLowerCase() === filterField.toLowerCase() || f === "Any field")
      );
    }

    if (filterLevel !== "Any level") {
      items = items.filter((item) =>
        (item.level || []).includes(filterLevel)
      );
    }

    if (sortBy === "deadline") {
      items = [...items].sort((a, b) => {
        if (!a.deadline || a.deadline === "Unknown") return 1;
        if (!b.deadline || b.deadline === "Unknown") return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    }

    return items;
  }, [allScholarships, search, filterField, filterLevel, sortBy]);

  async function handleSignOut() {
    try { await signOut(); } catch {}
    window.location.href = "index.html";
  }

  function handleSave(id) {
    const next = new Set(savedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    const arr = [...next];
    localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
    setSavedIds(next);
  }

  const localProfile = authState.profile?.answers || getLocalProfile();
  const name = authState.profile?.full_name ||
    (localProfile?.name ? `${localProfile.name.first || ""}`.trim() : `${localProfile?.firstName || ""}`.trim()) ||
    authState.session?.user?.email || "";
  const firstName = name.split(" ")[0];
  const university = authState.profile?.university || localProfile?.university || "";

  return e(
    React.Fragment,
    null,
    e(NavHeader, { onSignOut: handleSignOut, signedOut: !authState.session }),
    e(
      "main",
      { className: "browse-page" },
      loadError ? e("p", { className: "signup-error browse-error" }, loadError) : null,
      e(HeroSearch, { firstName, university, search, onSearch: setSearch }),
      e(FilterBar, {
        filterField,
        filterLevel,
        sortBy,
        onFilterField: setFilterField,
        onFilterLevel: setFilterLevel,
        onSortBy: setSortBy,
        count: filtered.length,
        loading: scholarLoading
      }),
      scholarLoading
        ? e("div", { className: "browse-loading" }, "Loading scholarships...")
        : filtered.length === 0
          ? e("div", { className: "browse-empty-state" },
              e("h3", null, search || filterField !== "All fields" || filterLevel !== "Any level"
                ? "No matches for these filters."
                : "No scholarships available."),
              e("p", null, "Try adjusting your search or filters.")
            )
          : e(
              "section",
              { className: "browse-grid", "aria-label": "Scholarship results" },
              filtered.slice(0, 30).map((item, i) =>
                e(ScholarshipCard, { key: item.id || i, item, saved: savedIds.has(item.id), onSave: handleSave })
              )
            ),
      filtered.length > 30
        ? e("div", { className: "browse-load-row" },
            e("p", null, `Showing 30 of ${filtered.length} results`)
          )
        : null
    )
  );
}

function NavHeader({ onSignOut, signedOut = false }) {
  return e(
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
        e("a", { href: "results.html" }, "My matches"),
        e("a", { href: "index.html#how-it-works" }, "How it works")
      ),
      e(
        "div",
        { className: "nav-actions" },
        signedOut
          ? e("a", { href: "signup.html?mode=login" }, "Log in")
          : e("button", { type: "button", className: "browse-nav-button", onClick: onSignOut }, "Log out"),
        e("a", { href: "signup.html", className: "nav-signup" }, "Sign up")
      )
    )
  );
}

function HeroSearch({ firstName, university, search, onSearch }) {
  return e(
    "section",
    { className: "browse-hero" },
    e(
      "div",
      { className: "browse-hero-copy" },
      e("h1", { className: "hand-title" },
        firstName ? `Find scholarships, ${firstName}.` : "Find scholarships in seconds."
      ),
      e("p", { className: "browse-subhead" },
        university
          ? `Matches are tuned for ${university}.`
          : "We collect and match scholarships for students in one place."
      )
    ),
    e(
      "div",
      { className: "browse-search-panel" },
      e(
        "label",
        { className: "browse-search", "aria-label": "Search scholarships" },
        e("span", { "aria-hidden": "true" }, "Q"),
        e("input", {
          type: "search",
          placeholder: "Search by title, field, source...",
          value: search,
          onChange: (ev) => onSearch(ev.target.value)
        })
      )
    )
  );
}

function FilterBar({ filterField, filterLevel, sortBy, onFilterField, onFilterLevel, onSortBy, count, loading }) {
  return e(
    "section",
    { className: "filter-zone" },
    e(
      "div",
      { className: "filter-row" },
      e("div", { className: "filter-left" },
        e("span", { className: "filter-label" }, "Filter:"),
        e(
          "select",
          { className: "filter-pill", value: filterField, onChange: (ev) => onFilterField(ev.target.value), "aria-label": "Filter by field" },
          FIELD_OPTIONS.map((f) => e("option", { key: f, value: f }, f))
        ),
        e(
          "select",
          { className: "filter-pill", value: filterLevel, onChange: (ev) => onFilterLevel(ev.target.value), "aria-label": "Filter by level" },
          LEVEL_OPTIONS.map((l) => e("option", { key: l, value: l }, l))
        )
      ),
      e("div", { className: "filter-right" },
        loading ? null : e("span", { className: "filter-count" }, `${count} results`),
        e("span", { className: "filter-label" }, "Sort:"),
        e(
          "select",
          { className: "filter-pill", value: sortBy, onChange: (ev) => onSortBy(ev.target.value), "aria-label": "Sort results" },
          e("option", { value: "match" }, "Best match"),
          e("option", { value: "deadline" }, "Deadline")
        )
      )
    )
  );
}

function ScholarshipCard({ item, saved, onSave }) {
  const days = daysUntil(item.deadline);
  const deadlineText = days === null ? "Rolling" : days < 0 ? "Closed" : `${days}d left`;
  const urgent = days !== null && days >= 0 && days <= 14;
  const hasScore = typeof item.score === "number";
  const level = Array.isArray(item.level) ? item.level.join(" / ") : item.level || "";
  const field = Array.isArray(item.fields) ? item.fields[0] : item.fields || "";

  return e(
    "article",
    { className: `browse-card${saved ? " is-saved" : ""}` },
    e("div", { className: "browse-card-top" },
      hasScore ? e("span", { className: "match-pill" }, `${item.score}% match`) : null,
      e("strong", { className: "hand-title" }, item.amount || "Amount TBD")
    ),
    e("h2", { className: "hand-title" }, item.title),
    e("p", { className: "card-desc" },
      item.eligibility
        ? (item.eligibility.length > 110 ? item.eligibility.slice(0, 110) + "..." : item.eligibility)
        : ""
    ),
    e("div", { className: "deadline-row browse-deadline" },
      e("span", null, "Deadline"),
      e("strong", { style: { color: urgent ? "#B45309" : "#555555" } }, deadlineText)
    ),
    e("div", { className: "pill-row" },
      level ? e("span", { className: "pill" }, level) : null,
      field ? e("span", { className: "pill" }, field) : null,
      item.category ? e("span", { className: "pill" }, item.category) : null
    ),
    e("div", { className: "card-actions" },
      e("a", {
        href: item.applicationUrl || item.url || "#",
        target: "_blank",
        rel: "noreferrer",
        className: "apply-btn"
      }, "Apply ->"),
      e("button", {
        type: "button",
        className: `save-btn${saved ? " is-saved" : ""}`,
        onClick: () => onSave(item.id),
        "aria-label": saved ? "Unsave scholarship" : "Save scholarship"
      }, saved ? "Saved ✓" : "Save")
    )
  );
}

createRoot(document.getElementById("root")).render(e(AccountPage));
