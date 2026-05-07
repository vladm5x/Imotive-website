import React from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import { getSession, getUserProfile, isSupabaseConfigured, signOut } from "./lib/account.js";
import { fetchScholarships, saveScholarshipForUser, loadUserSavedFromSupabase, syncLocalSavedToSupabase } from "./lib/scholarships.js";
import { rankScholarships, daysUntil } from "./lib/matching.js";

const e = React.createElement;

const SIGNUP_KEY = "imotive_signup_answers";
const LEGACY_KEY = "grantlyProfile";
const SAVED_KEY = "imotive_saved";
const PAGE_SIZE = 30;

const FIELD_OPTIONS = ["All fields", "Engineering", "IT", "Computer Science", "Business", "Economics", "Medicine", "Natural sciences", "Humanities", "Social sciences", "Law", "Architecture", "Agriculture", "Arts", "Education"];
const LEVEL_OPTIONS = ["Any level", "Bachelor", "Master", "PhD"];

function getLocalProfile() {
  try {
    const raw = localStorage.getItem(SIGNUP_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalSavedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function persistSavedIds(ids) {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
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
  const [showSaved, setShowSaved] = React.useState(false);
  const [savedIds, setSavedIds] = React.useState(() => getLocalSavedIds());
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  React.useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterField, filterLevel, sortBy, showSaved]);

  React.useEffect(() => {
    let active = true;
    async function loadAuth() {
      try {
        if (isSupabaseConfigured()) {
          const session = await getSession();
          let profile = null;
          if (session) {
            try { profile = await getUserProfile(); } catch {}
            const localIds = getLocalSavedIds();
            try {
              await syncLocalSavedToSupabase(localIds);
              const remoteIds = await loadUserSavedFromSupabase();
              const merged = new Set([...localIds, ...remoteIds]);
              persistSavedIds(merged);
              if (active) setSavedIds(merged);
            } catch {
              // offline — local saved state is fine
            }
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
        const ranked = localProfile
          ? rankScholarships(data, localProfile, { includeIneligible: true })
          : data;
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

    if (showSaved) {
      items = items.filter((item) => savedIds.has(item.id));
    }

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
      items = items.filter((item) => (item.level || []).includes(filterLevel));
    }

    if (sortBy === "deadline") {
      items = [...items].sort((a, b) => {
        if (!a.deadline || a.deadline === "Unknown") return 1;
        if (!b.deadline || b.deadline === "Unknown") return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sortBy === "amount") {
      items = [...items].sort((a, b) => {
        const extract = (s) => {
          const m = String(s || "").match(/[\d,]+/);
          return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0;
        };
        return extract(b.amount) - extract(a.amount);
      });
    }

    return items;
  }, [allScholarships, search, filterField, filterLevel, sortBy, showSaved, savedIds]);

  async function handleSignOut() {
    try { await signOut(); } catch {}
    window.location.href = "index.html";
  }

  async function handleSave(id) {
    const next = new Set(savedIds);
    const wasSaved = next.has(id);
    if (wasSaved) {
      next.delete(id);
    } else {
      next.add(id);
    }
    persistSavedIds(next);
    setSavedIds(next);
    try {
      await saveScholarshipForUser(id, wasSaved ? "not_a_fit" : "saved");
    } catch {
      // offline — local state persists
    }
  }

  const localProfile = authState.profile?.answers || getLocalProfile();
  const name = authState.profile?.full_name ||
    (localProfile?.name ? `${localProfile.name.first || ""}`.trim() : `${localProfile?.firstName || ""}`.trim()) ||
    authState.session?.user?.email || "";
  const firstName = name.split(" ")[0];
  const university = authState.profile?.university || localProfile?.university || "";
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

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
        filterField, filterLevel, sortBy, showSaved,
        onFilterField: setFilterField,
        onFilterLevel: setFilterLevel,
        onSortBy: setSortBy,
        onToggleSaved: () => setShowSaved((v) => !v),
        count: filtered.length,
        savedCount: savedIds.size,
        loading: scholarLoading
      }),
      scholarLoading
        ? e("div", { className: "browse-loading" }, "Loading scholarships...")
        : filtered.length === 0
          ? e(
              "div",
              { className: "browse-empty-state" },
              e("h3", null, showSaved
                ? "No saved scholarships yet."
                : search || filterField !== "All fields" || filterLevel !== "Any level"
                  ? "No matches for these filters."
                  : "No scholarships available."),
              e("p", null, showSaved
                ? "Save scholarships from browse or your matches page."
                : "Try adjusting your search or filters.")
            )
          : e(
              React.Fragment,
              null,
              e(
                "section",
                { className: "browse-grid", "aria-label": "Scholarship results" },
                visible.map((item, i) =>
                  e(ScholarshipCard, { key: item.id || i, item, saved: savedIds.has(item.id), onSave: handleSave })
                )
              ),
              hasMore
                ? e(
                    "div",
                    { className: "browse-load-row" },
                    e(
                      "button",
                      {
                        type: "button",
                        className: "browse-load-btn",
                        onClick: () => setVisibleCount((n) => n + PAGE_SIZE)
                      },
                      `Load more — ${filtered.length - visibleCount} remaining`
                    )
                  )
                : filtered.length > PAGE_SIZE
                  ? e("p", { className: "browse-load-row browse-all-shown" }, `All ${filtered.length} results shown.`)
                  : null
            )
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

function FilterBar({ filterField, filterLevel, sortBy, showSaved, onFilterField, onFilterLevel, onSortBy, onToggleSaved, count, savedCount, loading }) {
  return e(
    "section",
    { className: "filter-zone" },
    e(
      "div",
      { className: "filter-row" },
      e(
        "div",
        { className: "filter-left" },
        e(
          "button",
          {
            type: "button",
            className: `filter-saved-btn${showSaved ? " is-active" : ""}`,
            onClick: onToggleSaved,
            "aria-pressed": showSaved
          },
          `Saved${savedCount ? ` (${savedCount})` : ""}`
        ),
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
      e(
        "div",
        { className: "filter-right" },
        loading ? null : e("span", { className: "filter-count" }, `${count} results`),
        e("span", { className: "filter-label" }, "Sort:"),
        e(
          "select",
          { className: "filter-pill", value: sortBy, onChange: (ev) => onSortBy(ev.target.value), "aria-label": "Sort results" },
          e("option", { value: "match" }, "Best match"),
          e("option", { value: "deadline" }, "Deadline"),
          e("option", { value: "amount" }, "Amount")
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
    e(
      "div",
      { className: "browse-card-top" },
      hasScore ? e("span", { className: "match-pill" }, `${item.score}% match`) : null,
      e("strong", { className: "hand-title" }, item.amount || "Amount TBD")
    ),
    e("h2", { className: "hand-title" }, item.title),
    e("p", { className: "card-desc" },
      item.eligibility
        ? (item.eligibility.length > 110 ? item.eligibility.slice(0, 110) + "..." : item.eligibility)
        : ""
    ),
    e(
      "div",
      { className: "deadline-row browse-deadline" },
      e("span", null, "Deadline"),
      e("strong", { style: { color: urgent ? "#B45309" : "#555555" } }, deadlineText)
    ),
    e(
      "div",
      { className: "pill-row" },
      level ? e("span", { className: "pill" }, level) : null,
      field ? e("span", { className: "pill" }, field) : null,
      item.category ? e("span", { className: "pill" }, item.category) : null
    ),
    e(
      "div",
      { className: "card-actions" },
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
