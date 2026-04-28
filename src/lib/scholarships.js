import { getSession } from "./account.js";
import { getSupabase } from "./supabaseClient.js";

export async function fetchScholarships() {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("scholarships_raw")
      .select("*")
      .eq("expired", false)
      .eq("blocked", false)
      .eq("requires_login", false)
      .gte("quality_score", 50)
      .order("quality_score", { ascending: false });

    if (!error && data?.length) return data.map(fromSupabaseScholarship);
    if (error) console.warn("Could not load scholarships from Supabase:", error.message);
  }

  const response = await fetch("data/scholarships.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function saveScholarshipForUser(scholarshipId, status = "saved") {
  const supabase = getSupabase();
  const session = await getSession();
  if (!supabase || !session?.user || !scholarshipId) return null;

  const { data, error } = await supabase
    .from("saved_scholarships")
    .upsert({
      user_id: session.user.id,
      scholarship_id: scholarshipId,
      status,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,scholarship_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateApplicationProgress(scholarshipId, patch) {
  const supabase = getSupabase();
  const session = await getSession();
  if (!supabase || !session?.user || !scholarshipId) return null;

  const { data, error } = await supabase
    .from("application_progress")
    .upsert({
      user_id: session.user.id,
      scholarship_id: scholarshipId,
      ...patch,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,scholarship_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function fromSupabaseScholarship(row) {
  return {
    id: row.id,
    title: row.title,
    amount: row.amount,
    deadline: row.deadline,
    category: row.category,
    level: row.level || [],
    fields: row.fields || [],
    nationality: row.nationality || [],
    interests: row.interests || [],
    need: row.need || [],
    source: row.source,
    url: row.url,
    applicationUrl: row.application_url,
    eligibility: row.eligibility,
    documents: row.documents,
    instructions: row.instructions,
    requirementKeywords: row.requirement_keywords || [],
    requiredApplicantInfo: row.required_applicant_info || [],
    qualityScore: row.quality_score,
    qualityFlags: row.quality_flags || [],
    scrapeSuccess: row.scrape_success,
    unreachable: row.blocked || row.requires_login,
    unreachableReason: row.blocked ? "blocked" : row.requires_login ? "login_wall" : null
  };
}
