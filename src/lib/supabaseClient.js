import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PLACEHOLDER_URL = "YOUR_SUPABASE_URL";
const PLACEHOLDER_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const FALLBACK_URL = "https://yltxrmvxqnptffsmrpyt.supabase.co";
const FALLBACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsdHhybXZ4cW5wdGZmc21ycHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTIxMzMsImV4cCI6MjA5Mjg4ODEzM30.Dvb9Y4nuoDMxEyWm-4p1nbpjhyuAJzZ0cVSMoJXyZcM";

let client;

export const supabaseConfig = {
  url: window.IMOTIVE_SUPABASE_URL || FALLBACK_URL,
  anonKey: window.IMOTIVE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY
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
