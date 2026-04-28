import { getSupabase } from "./lib/supabaseClient.js";

const signupUrl = "signup.html";

function sendToSignup(event) {
  event?.preventDefault();
  window.location.href = signupUrl;
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
