import React from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import { SignupFlow } from "./components/SignupFlow.js";
import {
  getSession,
  isSupabaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "./lib/account.js";
import { layoutRegistry } from "./homepage-layouts/layoutRegistry.js";

const LAYOUT_STORAGE_KEY = "imotive-active-layout";
const root = document.getElementById("root");

function activeLayoutEntry() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("layout");
  const activeId = requested || localStorage.getItem(LAYOUT_STORAGE_KEY) || "original";
  return layoutRegistry.find((layout) => layout.id === activeId) || layoutRegistry[0];
}

function renderDefaultFlow() {
  createRoot(root).render(React.createElement(SignupFlow));
}

async function shouldUseDefaultFlow(entry) {
  if (!entry?.signupPath) return true;
  if (!isSupabaseConfigured()) return false;
  try {
    return Boolean(await getSession());
  } catch {
    return false;
  }
}

function copyVariantHead(doc) {
  doc.head.querySelectorAll("link, style").forEach((node) => {
    const href = node.getAttribute("href");
    if (href && document.head.querySelector(`link[href="${href}"]`)) return;
    document.head.appendChild(node.cloneNode(true));
  });

  if (doc.title) document.title = doc.title;
}

function absolutizeVariantLinks(container, entry) {
  const variantBase = new URL(entry.signupPath, window.location.href);

  container.querySelectorAll("a[href]").forEach((link) => {
    const raw = link.getAttribute("href") || "";
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;

    const url = new URL(raw, variantBase);
    const filename = url.pathname.split("/").pop();

    if (filename?.endsWith("signup.html")) {
      const next = new URL("signup.html", window.location.href);
      if (url.hash === "#signup") next.hash = "signup";
      if (/sign\s*in|log\s*in/i.test(link.textContent || "")) next.searchParams.set("mode", "login");
      link.href = next.toString();
      return;
    }

    link.href = url.toString();
  });
}

function currentMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "login") return "signin";
  if (window.location.hash === "#login") return "signin";
  return "signup";
}

function setVariantMode(mode) {
  const isSignup = mode === "signup";
  const signin = document.getElementById("tab-signin");
  const signup = document.getElementById("tab-signup");
  const name = document.getElementById("field-name");
  const remember = document.getElementById("row-remember");
  const submit = document.getElementById("submit-btn");
  const title = document.querySelector(".form-title, #form-title");
  const sub = document.querySelector(".form-sub, #form-sub");
  const password = document.getElementById("password");

  signin?.classList.toggle("active", !isSignup);
  signup?.classList.toggle("active", isSignup);
  if (name) name.style.display = isSignup ? "block" : "none";
  if (remember) remember.style.display = isSignup ? "none" : "flex";
  if (submit) submit.textContent = isSignup ? "Create account" : "Sign in";
  if (password) password.autocomplete = isSignup ? "new-password" : "current-password";

  if (title) title.textContent = isSignup ? "Create your account" : "Welcome back";
  if (sub) {
    sub.innerHTML = isSignup
      ? 'Already have one? <a href="#" data-auth-mode="signin">Sign in</a>'
      : 'New here? <a href="#" data-auth-mode="signup">Create a free account</a>';
  }

  document.documentElement.dataset.signupMode = mode;
}

function showVariantMessage(message, type = "info") {
  let box = document.querySelector("[data-variant-auth-message]");
  if (!box) {
    box = document.createElement("p");
    box.setAttribute("data-variant-auth-message", "");
    const submit = document.getElementById("submit-btn");
    submit?.insertAdjacentElement("beforebegin", box);
  }

  box.textContent = message;
  box.style.margin = "0 0 14px";
  box.style.fontSize = "13px";
  box.style.fontWeight = "600";
  box.style.lineHeight = "1.4";
  box.style.color = type === "error" ? "#dc2626" : "#2563eb";
}

async function continueToWizard() {
  window.location.href = new URL("signup.html?continue=1", window.location.href).toString();
}

function wireVariantAuth() {
  window.switchTab = setVariantMode;

  document.addEventListener("click", (event) => {
    const modeLink = event.target.closest("[data-auth-mode]");
    if (!modeLink) return;
    event.preventDefault();
    setVariantMode(modeLink.dataset.authMode);
  });

  document.getElementById("tab-signin")?.addEventListener("click", () => setVariantMode("signin"));
  document.getElementById("tab-signup")?.addEventListener("click", () => setVariantMode("signup"));

  const socialButtons = Array.from(document.querySelectorAll(".social-btn"));
  socialButtons[0]?.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      showVariantMessage("Supabase is not configured yet.", "error");
      return;
    }
    try {
      showVariantMessage("Opening Google sign in...");
      await signInWithGoogle("signup.html?continue=1");
    } catch (error) {
      showVariantMessage(error.message || "Google sign in failed.", "error");
    }
  });
  socialButtons.slice(1).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showVariantMessage("GitHub sign in is not enabled yet. Use Google or email.", "error");
    });
  });

  const form = document.querySelector("form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email")?.value?.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const mode = document.documentElement.dataset.signupMode || currentMode();

    if (!email.includes("@") || password.length < 8) {
      showVariantMessage("Use a valid email and at least 8 password characters.", "error");
      return;
    }
    if (!isSupabaseConfigured()) {
      showVariantMessage("Supabase is not configured yet.", "error");
      return;
    }

    const submit = document.getElementById("submit-btn");
    const previousLabel = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Working...";
    }

    try {
      const session = mode === "signin"
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);

      if (!session && mode === "signup") {
        showVariantMessage("Check your email to confirm your account, then come back to continue.");
        return;
      }
      await continueToWizard();
    } catch (error) {
      showVariantMessage(error.message || "Authentication failed.", "error");
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = previousLabel;
      }
    }
  });

  setVariantMode(currentMode());
}

async function loadVariantSignup(entry) {
  try {
    const response = await fetch(entry.signupPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    copyVariantHead(doc);

    root.innerHTML = doc.body.innerHTML;
    absolutizeVariantLinks(root, entry);
    wireVariantAuth();
  } catch (error) {
    console.warn("[iMotive] Signup variant failed:", error);
    renderDefaultFlow();
  }
}

const entry = activeLayoutEntry();
if (await shouldUseDefaultFlow(entry)) {
  renderDefaultFlow();
} else {
  loadVariantSignup(entry);
}
