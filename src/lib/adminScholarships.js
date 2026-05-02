import { getSupabase } from "./supabaseClient.js";

export const PAGE_SIZE = 50;

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [total, pending, approved, rejected, failed] = await Promise.all([
    supabase.from("scholarships_raw").select("*", { count: "exact", head: true }),
    supabase
      .from("scholarships_raw")
      .select("*", { count: "exact", head: true })
      .in("review_status", ["pending_review", "needs_review", "publishable", "hide"]),
    supabase
      .from("scholarships_raw")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "approved"),
    supabase
      .from("scholarships_raw")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "rejected"),
    supabase
      .from("scholarships_raw")
      .select("*", { count: "exact", head: true })
      .eq("scrape_success", false),
  ]);

  return {
    total: total.count || 0,
    pending: pending.count || 0,
    approved: approved.count || 0,
    rejected: rejected.count || 0,
    failed: failed.count || 0,
  };
}

// ── List queries ──────────────────────────────────────────────────────────────

const LIST_COLUMNS = [
  "id", "title", "url", "source", "deadline", "amount",
  "eligibility", "scrape_success", "review_status", "date_scraped",
  "reviewed_at", "reviewed_by", "rejection_reason", "admin_notes",
  "quality_score", "application_url",
].join(",");

export async function getScholarships(status, filters = {}) {
  const supabase = getSupabase();
  if (!supabase) return { data: [], count: 0 };

  const { search = "", source = "", deadlineExists = null, scrapeSuccess = null, page = 0 } = filters;

  let query = supabase
    .from("scholarships_raw")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("date_scraped", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  // Pending maps to both old and new status value for smooth migration
  if (status === "pending_review") {
    query = query.in("review_status", ["pending_review", "needs_review", "publishable", "hide"]);
  } else if (status === "all") {
    // No status filter: show every collected active row for admin inspection.
  } else {
    query = query.eq("review_status", status);
  }

  if (search.trim()) {
    query = query.or(`title.ilike.%${search.trim()}%,url.ilike.%${search.trim()}%`);
  }
  if (source.trim()) {
    query = query.ilike("source", `%${source.trim()}%`);
  }
  if (deadlineExists === true) {
    query = query.not("deadline", "is", null);
  } else if (deadlineExists === false) {
    query = query.is("deadline", null);
  }
  if (scrapeSuccess !== null) {
    query = query.eq("scrape_success", scrapeSuccess);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ── Single record (full detail for modal) ────────────────────────────────────

export async function getScholarshipDetail(id) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("scholarships_raw")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// ── Review actions ────────────────────────────────────────────────────────────

export async function approveScholarship(id, adminEmail, notes) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured.");

  const updates = {
    review_status: "approved",
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminEmail,
    updated_at: new Date().toISOString(),
  };
  if (notes != null) updates.admin_notes = notes;

  const { error } = await supabase.from("scholarships_raw").update(updates).eq("id", id);
  if (error) throw error;
}

export async function rejectScholarship(id, adminEmail, reason, notes) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured.");

  const updates = {
    review_status: "rejected",
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminEmail,
    rejection_reason: reason || null,
    updated_at: new Date().toISOString(),
  };
  if (notes != null) updates.admin_notes = notes;

  const { error } = await supabase.from("scholarships_raw").update(updates).eq("id", id);
  if (error) throw error;
}

export async function restoreScholarship(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured.");

  const { error } = await supabase
    .from("scholarships_raw")
    .update({
      review_status: "pending_review",
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function archiveScholarship(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured.");

  const { error } = await supabase
    .from("scholarships_raw")
    .update({
      review_status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function updateAdminNotes(id, notes) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured.");

  const { error } = await supabase
    .from("scholarships_raw")
    .update({ admin_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
