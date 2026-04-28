import { getSupabase, isSupabaseConfigured } from "./supabaseClient.js";

export { isSupabaseConfigured };

const PROFILE_STORAGE_KEY = "imotive_signup_answers";

export async function getSession() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("signup.html", window.location.href).toString()
    }
  });
  if (error) throw error;
}

export async function signUpWithEmail(email, password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL("signup.html", window.location.href).toString()
    }
  });
  if (error) throw error;
  return data.session;
}

export async function signInWithEmail(email, password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserProfile() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveUserProfile(answers) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const session = await getSession();
  if (!session?.user) throw new Error("Please sign in before saving your profile.");

  const profile = profileFromAnswers(session.user, answers);
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(answers));
  return data;
}

function profileFromAnswers(user, answers) {
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || metadata.email || null,
    full_name: metadata.full_name || metadata.name || null,
    avatar_url: metadata.avatar_url || metadata.picture || null,
    university: answers.university || null,
    field: answers.field || null,
    degree_level: answers.level || null,
    study_year: answers.year || null,
    citizenship: answers.citizenship || null,
    date_of_birth: answers.dob || null,
    interests: Array.isArray(answers.interests) ? answers.interests : [],
    gpa: answers.gpa || null,
    financial_need: answers.need || null,
    goals: answers.goals || null,
    answers,
    onboarding_completed: true,
    updated_at: new Date().toISOString()
  };
}
