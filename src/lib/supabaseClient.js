import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PLACEHOLDER_URL = "YOUR_SUPABASE_URL";
const PLACEHOLDER_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

let client;

function readMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
}

const runtimeConfig = window.IMOTIVE_SUPABASE || {};

export const supabaseConfig = {
  url: window.IMOTIVE_SUPABASE_URL || runtimeConfig.url || readMeta("imotive:supabase-url") || PLACEHOLDER_URL,
  anonKey: window.IMOTIVE_SUPABASE_ANON_KEY || runtimeConfig.anonKey || readMeta("imotive:supabase-anon-key") || PLACEHOLDER_ANON_KEY
};

export function isSupabaseConfigured() {
  return (
    supabaseConfig.url.startsWith("https://") &&
    supabaseConfig.url.includes(".supabase.co") &&
    supabaseConfig.anonKey.length > 40 &&
    supabaseConfig.url !== PLACEHOLDER_URL &&
    supabaseConfig.anonKey !== PLACEHOLDER_ANON_KEY
  );
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return client;
}
