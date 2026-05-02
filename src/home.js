import { getSupabase } from "./lib/supabaseClient.js";

const signupUrl = "signup.html";
const LAYOUT_STORAGE_KEY = "imotive-active-layout";
const layoutByPage = {
  "original.html": "original",
  "saas-landing.html": "saas-landing",
  "genz-landing.html": "genz-landing",
  "imotive-landing.html": "imotive-landing",
  "purple-landing.html": "purple-landing",
};

function currentLayoutId() {
  const page = window.location.pathname.split("/").pop();
  return localStorage.getItem(LAYOUT_STORAGE_KEY) || layoutByPage[page] || "";
}

function signupDestination(source) {
  const link = source?.closest?.('a[href*="signup.html"]') || source?.querySelector?.('a[href*="signup.html"]');
  if (link?.href) return link.href;

  const layout = currentLayoutId();
  if (!layout) return signupUrl;

  const url = new URL(signupUrl, window.location.href);
  url.searchParams.set("layout", layout);
  return url.toString();
}

function sendToSignup(event) {
  event?.preventDefault();
  window.location.href = signupDestination(event?.currentTarget);
}

function initSignupEntrypoints() {
  document.querySelectorAll("[data-signup-form]").forEach((form) => {
    form.addEventListener("submit", sendToSignup);
  });

  document.querySelectorAll("[data-signup-card]").forEach((card) => {
    card.addEventListener("click", sendToSignup);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        sendToSignup(event);
      }
    });
  });
}

async function updateNavForSession() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const login = document.querySelector("#nav-login");
    const signup = document.querySelector("#nav-signup");
    if (!login || !signup) return;

    login.href = "account.html";
    login.textContent = "Account";
    signup.href = "results.html";
    signup.textContent = "My matches";
  } catch {
    // Keep the public nav in place if auth is unavailable.
  }
}

initSignupEntrypoints();
updateNavForSession();
