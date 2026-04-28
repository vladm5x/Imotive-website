import React from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import { getSession, getUserProfile, isSupabaseConfigured, signOut } from "./lib/account.js";

const e = React.createElement;

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
        const profile = session ? await getUserProfile() : null;
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

  if (state.loading) return e(Layout, null, e("p", { className: "account-status" }, "Loading account..."));

  if (!isSupabaseConfigured()) {
    return e(
      Layout,
      null,
      e("section", { className: "account-card" },
        e("p", { className: "signup-eyebrow" }, "setup needed"),
        e("h1", null, "Connect Supabase to enable accounts."),
        e("p", null, "Add your public Supabase URL and anon key in src/lib/supabaseClient.js, then enable Google in Supabase Auth.")
      )
    );
  }

  if (!state.session) {
    return e(
      Layout,
      null,
      e("section", { className: "account-card" },
        e("p", { className: "signup-eyebrow" }, "signed out"),
        e("h1", null, "Sign in to view your account."),
        e("a", { href: "signup.html", className: "signup-primary account-link" }, "Sign in")
      )
    );
  }

  const user = state.session.user;
  const answers = state.profile?.answers || {};
  const displayName = state.profile?.full_name || user.user_metadata?.full_name || user.email;

  return e(
    Layout,
    null,
    e(
      "section",
      { className: "account-card" },
      state.error ? e("p", { className: "signup-error" }, state.error) : null,
      e("p", { className: "signup-eyebrow" }, "account"),
      e("div", { className: "account-heading" },
        state.profile?.avatar_url ? e("img", { src: state.profile.avatar_url, alt: "", className: "account-avatar" }) : e("span", { className: "account-avatar" }, initials(displayName)),
        e("div", null, e("h1", null, displayName), e("p", null, user.email))
      ),
      e(
        "div",
        { className: "account-grid" },
        accountItem("University", state.profile?.university || answers.university),
        accountItem("Field", state.profile?.field || answers.field),
        accountItem("Level", state.profile?.degree_level || answers.level),
        accountItem("Citizenship", state.profile?.citizenship || answers.citizenship),
        accountItem("Interests", Array.isArray(answers.interests) ? answers.interests.join(", ") : "")
      ),
      e("div", { className: "account-actions" },
        e("a", { href: "signup.html", className: "signup-primary account-link" }, "Update profile"),
        e("a", { href: "results.html", className: "ghost-btn account-link" }, "View matches"),
        e("button", { type: "button", className: "ghost-btn account-link", onClick: handleSignOut }, "Sign out")
      )
    )
  );
}

function Layout({ children }) {
  return e(
    "main",
    { className: "account-shell" },
    e("header", { className: "signup-topbar account-topbar" },
      e("a", { href: "index.html", className: "signup-logo", "aria-label": "iMotive home" }, e("span", { className: "signup-logo-dot" }), "iMotive"),
      e("a", { href: "index.html" }, "Home")
    ),
    children
  );
}

function accountItem(label, value) {
  return e("div", { className: "account-item" }, e("span", null, label), e("strong", null, value || "Not added yet"));
}

function initials(value = "") {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IM";
}

createRoot(document.getElementById("root")).render(e(AccountPage));
