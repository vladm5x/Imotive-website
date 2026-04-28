import React from "https://esm.sh/react@18.2.0";
import {
  getSession,
  isSupabaseConfigured,
  saveUserProfile,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail
} from "../lib/account.js";

const e = React.createElement;

const STORAGE_KEY = "imotive_signup_answers";

const questions = [
  {
    id: "university",
    required: true,
    type: "text",
    title: "Where do you study?",
    helper: "Pick or type your university.",
    placeholder: "e.g. Lund University",
    suggestions: ["Lund University", "KTH", "Uppsala", "Chalmers", "Stockholm University", "Goteborg"]
  },
  {
    id: "field",
    required: true,
    type: "text",
    title: "What are you studying?",
    helper: "Your field helps us sort scholarships by fit.",
    placeholder: "e.g. Engineering",
    suggestions: ["Engineering", "Computer Science", "Business", "Medicine", "Humanities", "Natural Sciences"]
  },
  {
    id: "level",
    required: true,
    type: "cards",
    title: "What's your degree level?",
    helper: "Tap the one that fits.",
    columns: "three",
    options: [
      ["Bachelor", "Undergraduate"],
      ["Master", "1-2 year postgrad"],
      ["PhD", "Doctoral / research"]
    ]
  },
  {
    id: "year",
    required: true,
    type: "cards",
    title: "What year are you in?",
    helper: "This helps us catch age and stage-specific awards.",
    columns: "four",
    options: [
      ["Year 1", "Just started"],
      ["Year 2", "Building momentum"],
      ["Year 3", "Almost there"],
      ["Year 4+", "Advanced studies"]
    ]
  },
  {
    id: "citizenship",
    required: true,
    type: "cards",
    title: "What's your citizenship status?",
    helper: "Some scholarships are limited by residency or nationality.",
    columns: "two",
    options: [
      ["Sweden", "Swedish citizen"],
      ["EU / EEA", "EU or EEA citizen"],
      ["Nordic (non-EU)", "Nordic, outside EU"],
      ["Other", "International student"]
    ]
  },
  {
    id: "dob",
    required: true,
    type: "text",
    title: "When were you born?",
    helper: "Some grants have age windows.",
    placeholder: "DD / MM / YYYY",
    suggestions: []
  },
  {
    id: "interests",
    required: false,
    type: "multi",
    title: "What are you into?",
    helper: "Choose any interests that sound like you.",
    options: ["Sustainability", "Robotics", "Research", "Entrepreneurship", "AI/ML", "Healthcare", "Climate", "Arts & Design", "Social Impact", "Sports", "Languages", "Engineering"]
  },
  {
    id: "gpa",
    required: false,
    type: "cards",
    title: "How are your grades?",
    helper: "A rough answer is enough.",
    columns: "two",
    options: [
      ["Top 10%", "Strong academic awards"],
      ["Top 25%", "Good merit fit"],
      ["Average", "Broader matches"],
      ["Prefer not to say", "Skip grade filters"]
    ]
  },
  {
    id: "need",
    required: false,
    type: "cards",
    title: "Do you need financial support?",
    helper: "This helps surface need-based funding.",
    columns: "two",
    options: [
      ["High", "Need-based awards first"],
      ["Some", "A mix of options"],
      ["No", "Merit and project awards"],
      ["Prefer not to say", "Keep it open"]
    ]
  },
  {
    id: "goals",
    required: false,
    type: "textarea",
    title: "What are you working toward?",
    helper: "A sentence gives us better project and essay matches.",
    placeholder: "Build sustainable robotics for agriculture in the EU."
  }
];

function getSavedAnswers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function Logo() {
  return e(
    "a",
    { href: "index.html", className: "signup-logo", "aria-label": "iMotive home" },
    e("span", { className: "signup-logo-dot" }),
    "iMotive"
  );
}

function SignupScreen({ onAdvance, mode = "signup" }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const authReady = isSupabaseConfigured();

  async function submit(ev) {
    ev.preventDefault();
    if (!email.includes("@") || password.length < 8) {
      setError("Use a valid email and at least 8 password characters.");
      return;
    }
    if (!authReady) {
      setError("Supabase is not configured yet. Add your public URL and anon key first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = mode === "login" ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
      if (!session && mode === "signup") {
        setError("Check your email to confirm your account, then come back to continue.");
        return;
      }
      onAdvance();
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    if (!authReady) {
      setError("Supabase is not configured yet. Add your public URL and anon key first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return e(
    "main",
    { className: "signup-shell" },
    e(
      "section",
      { className: "signup-pane signup-form-pane" },
      e(
        "header",
        { className: "signup-topbar" },
        e(Logo),
        mode === "login"
          ? e("p", null, "New to iMotive? ", e("a", { href: "signup.html" }, "Sign up"))
          : e("p", null, "Already have an account? ", e("a", { href: "signup.html?mode=login" }, "Log in"))
      ),
      e(
        "div",
        { className: "signup-form-wrap" },
        e("p", { className: "signup-eyebrow" }, mode === "login" ? "welcome back" : "welcome +"),
        e("h1", null, mode === "login" ? "Log in to your account." : "Create your account."),
        e("p", { className: "signup-subhead" }, mode === "login" ? "Pick up where you left off." : "Free forever. We'll match you to scholarships next."),
        !authReady
          ? e("p", { className: "auth-setup-note" }, "Developer setup: add your public Supabase URL and anon key in src/lib/supabaseClient.js to activate login.")
          : null,
        e(
          "div",
          { className: "sso-stack" },
          e("button", { type: "button", className: "sso-btn", disabled: loading, onClick: continueWithGoogle }, e("span", null, "G"), "Continue with Google")
        ),
        e("div", { className: "signup-divider" }, e("span", null, "or with email")),
        e(
          "form",
          { onSubmit: submit, className: "email-form" },
          e("label", null, "Email", e("input", { type: "email", value: email, onChange: (ev) => setEmail(ev.target.value), placeholder: "you@university.se" })),
          e(
            "label",
            null,
            "Password",
            e(
              "div",
              { className: "password-field" },
              e("input", { type: showPassword ? "text" : "password", value: password, onChange: (ev) => setPassword(ev.target.value), placeholder: "8+ characters" }),
              e("button", { type: "button", onClick: () => setShowPassword(!showPassword) }, showPassword ? "Hide" : "Show")
            )
          ),
          error ? e("p", { className: "signup-error" }, error) : null,
          e("button", { type: "submit", className: "signup-primary", disabled: loading }, loading ? "Working..." : mode === "login" ? "Log in ->" : "Create account ->")
        ),
        e("p", { className: "fine-print" }, "By continuing you agree to our ", e("a", { href: "#" }, "Terms"), " and ", e("a", { href: "#" }, "Privacy Policy"), ". GDPR-compliant.")
      )
    ),
    e(
      "aside",
      { className: "signup-pane signup-info-pane" },
      e(
        "div",
        { className: "signup-info-inner" },
        e("p", { className: "info-eyebrow" }, "next up v"),
        e("h2", null, "After this, a 2-min form unlocks your matches."),
        e(
          "div",
          { className: "roadmap" },
          ["Create your account", "Tell us about you (10 quick questions)", "See your scholarship matches"].map((label, index) =>
            e(
              "div",
              { key: label, className: `roadmap-step ${index === 0 ? "is-current" : ""}` },
              e("span", null, index + 1),
              e("strong", null, label)
            )
          )
        ),
        e("p", { className: "info-foot" }, "avg. student finds 12 matches +")
      )
    )
  );
}

function Wizard({ onComplete }) {
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState(getSavedAnswers);
  const [selectedFlash, setSelectedFlash] = React.useState("");
  const question = questions[index];
  const value = answers[question.id];
  const requiredValid = !question.required || (Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim()));

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }, [answers]);

  function setAnswer(id, nextValue) {
    setAnswers((current) => ({ ...current, [id]: nextValue }));
  }

  function next() {
    if (!requiredValid) return;
    if (index === questions.length - 1) {
      onComplete(answers);
      return;
    }
    setIndex(index + 1);
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  function skip() {
    setAnswer(question.id, null);
    if (index === questions.length - 1) onComplete({ ...answers, [question.id]: null });
    else setIndex(index + 1);
  }

  function pickCard(option) {
    setAnswer(question.id, option);
    setSelectedFlash(option);
    window.setTimeout(() => {
      setSelectedFlash("");
      if (index === questions.length - 1) onComplete({ ...answers, [question.id]: option });
      else setIndex((current) => current + 1);
    }, 220);
  }

  return e(
    "main",
    { className: "wizard-shell" },
    e("header", { className: "wizard-logo-row" }, e(Logo)),
    e(
      "section",
      { key: question.id, className: "wizard-card" },
      e(
        "div",
        { className: "wizard-progress" },
        e(
          "div",
          { className: "progress-dots", "aria-label": `Question ${index + 1} of 10` },
          questions.map((_, dotIndex) => e("span", { key: dotIndex, className: dotIndex <= index ? "is-filled" : "" }))
        ),
        e("span", null, `${index + 1} / ${questions.length}`)
      ),
      e("p", { className: "question-eyebrow" }, `question ${index + 1}`, !question.required ? e("span", null, " - optional") : null),
      e("h1", null, question.title),
      e("p", { className: "question-helper" }, question.helper),
      e(Field, { question, value, setAnswer, pickCard, selectedFlash, onEnter: next }),
      e(
        "div",
        { className: "wizard-actions" },
        index > 0 ? e("button", { type: "button", className: "ghost-btn", onClick: back }, "<- Back") : e("span"),
        !question.required ? e("button", { type: "button", className: "skip-btn", onClick: skip }, "Skip") : e("span"),
        e("button", { type: "button", className: `next-btn ${index === questions.length - 1 ? "is-final" : ""}`, disabled: !requiredValid, onClick: next }, index === questions.length - 1 ? "Find my matches ->" : "Next ->")
      ),
      e("p", { className: "enter-hint" }, "press ", e("kbd", null, "Enter"), " to continue")
    )
  );
}

function Field({ question, value, setAnswer, pickCard, selectedFlash, onEnter }) {
  if (question.type === "text") {
    return e(
      "div",
      { className: "field-area" },
      e("input", {
        className: "wizard-input",
        autoFocus: true,
        value: value || "",
        placeholder: question.placeholder,
        onChange: (ev) => setAnswer(question.id, ev.target.value),
        onKeyDown: (ev) => {
          if (ev.key === "Enter") onEnter();
        }
      }),
      question.suggestions?.length
        ? e(
            "div",
            { className: "suggestion-chips" },
            question.suggestions.map((suggestion) =>
              e("button", { key: suggestion, type: "button", className: value === suggestion ? "is-selected" : "", onClick: () => setAnswer(question.id, suggestion) }, suggestion)
            )
          )
        : null
    );
  }

  if (question.type === "textarea") {
    return e(
      "div",
      { className: "field-area" },
      e("textarea", {
        className: "wizard-input wizard-textarea",
        autoFocus: true,
        value: value || "",
        placeholder: question.placeholder,
        onChange: (ev) => setAnswer(question.id, ev.target.value),
        onKeyDown: (ev) => {
          if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) onEnter();
        }
      })
    );
  }

  if (question.type === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return e(
      "div",
      { className: "field-area" },
      e(
        "div",
        { className: "multi-chips" },
        question.options.map((option) => {
          const active = selected.includes(option);
          return e(
            "button",
            {
              key: option,
              type: "button",
              className: active ? "is-selected" : "",
              onClick: () => setAnswer(question.id, active ? selected.filter((item) => item !== option) : [...selected, option])
            },
            option,
            active ? " +" : ""
          );
        })
      )
    );
  }

  return e(
    "div",
    { className: `option-grid ${question.columns || "two"}` },
    question.options.map(([title, description]) =>
      e(
        "button",
        {
          key: title,
          type: "button",
          className: value === title || selectedFlash === title ? "is-selected" : "",
          onClick: () => pickCard(title)
        },
        e("strong", null, title),
        e("span", null, description)
      )
    )
  );
}

function Reveal({ answers }) {
  const [phase, setPhase] = React.useState("loading");
  const [count, setCount] = React.useState(0);
  const target = 24;

  React.useEffect(() => {
    const loadingTimer = window.setTimeout(() => setPhase("reveal"), 2700);
    return () => window.clearTimeout(loadingTimer);
  }, []);

  React.useEffect(() => {
    if (phase !== "reveal") return;
    let current = 0;
    const timer = window.setInterval(() => {
      current += 1;
      setCount(current);
      if (current >= target) window.clearInterval(timer);
    }, 35);
    return () => window.clearInterval(timer);
  }, [phase]);

  return e(
    "main",
    { className: "reveal-shell" },
    e("header", { className: "wizard-logo-row" }, e(Logo)),
    phase === "loading"
      ? e(
          "section",
          { className: "loading-match" },
          e("div", { className: "bounce-dots" }, e("span"), e("span"), e("span")),
          e("p", null, "scanning 2,431 scholarships...")
        )
      : e(
          "section",
          { className: "match-reveal" },
          e(Confetti),
          e("p", { className: "question-eyebrow" }, "you have +"),
          e("div", { className: "match-number" }, e("strong", null, count), e("span", null, "matches!")),
          e("h1", null, "scholarships you qualify for."),
          e("p", null, `Your top 3 are worth 115,000 kr combined${answers.university ? ` for students like you at ${answers.university}` : ""}.`),
          e(
            "div",
            { className: "reveal-actions" },
            e("a", { href: "results.html", className: "green-btn" }, "See my matches ->"),
            e("a", { href: "index.html#scholarships", className: "ghost-btn" }, "Browse all")
          )
        )
  );
}

function Confetti() {
  const pieces = React.useMemo(() => {
    const colors = ["#3B82F6", "#22C55E", "#FACC15", "#1E3A8A", "#FFFFFF"];
    return Array.from({ length: 72 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      delay: `${(i % 9) * 0.045}s`,
      duration: `${1.4 + (i % 7) * 0.13}s`,
      color: colors[i % colors.length],
      rotate: `${(i % 2 ? 1 : -1) * (360 + i * 9)}deg`
    }));
  }, []);

  return e(
    "div",
    { className: "confetti", "aria-hidden": "true" },
    pieces.map((piece, index) => e("span", { key: index, style: { "--x": piece.left, "--delay": piece.delay, "--duration": piece.duration, "--color": piece.color, "--rotate": piece.rotate } }))
  );
}

export function SignupFlow() {
  const [stage, setStage] = React.useState("signup");
  const [answers, setAnswers] = React.useState(getSavedAnswers);
  const [mode] = React.useState(() => new URLSearchParams(window.location.search).get("mode") === "login" ? "login" : "signup");
  const [authChecked, setAuthChecked] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    async function hydrateSession() {
      if (!isSupabaseConfigured()) {
        setAuthChecked(true);
        return;
      }
      try {
        const session = await getSession();
        if (active && session) setStage("wizard");
      } catch {
        // The sign-in screen will show any actionable auth errors.
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    hydrateSession();
    return () => {
      active = false;
    };
  }, []);

  async function complete(nextAnswers) {
    const merged = { ...answers, ...nextAnswers };
    setAnswers(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    try {
      await saveUserProfile(merged);
    } catch {
      // Static preview keeps working until the profile API is connected.
    }
    setStage("reveal");
  }

  if (!authChecked) return e("main", { className: "signup-shell" }, e("p", { className: "account-status" }, "Loading sign in..."));
  if (stage === "wizard") return e(Wizard, { onComplete: complete });
  if (stage === "reveal") return e(Reveal, { answers });
  return e(SignupScreen, { mode, onAdvance: () => setStage("wizard") });
}
