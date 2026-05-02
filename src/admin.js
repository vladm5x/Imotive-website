import React from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import { getSession, signOut } from "./lib/account.js";
import { getSupabase } from "./lib/supabaseClient.js";
import {
  PAGE_SIZE,
  getStats,
  getScholarships,
  getScholarshipDetail,
  approveScholarship,
  rejectScholarship,
  restoreScholarship,
  archiveScholarship,
  updateAdminNotes,
} from "./lib/adminScholarships.js";

const e = React.createElement;

// Add admin email addresses here to grant access.
const ADMIN_EMAILS = ["muresanvlad123@gmail.com"];

function isAdmin(user) {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
}

async function getFreshSession() {
  const session = await getSession();
  if (!session) return null;

  const supabase = getSupabase();
  if (!supabase) return session;

  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.warn("Could not refresh admin session:", error.message);
    return session;
  }
  return data.session || session;
}

function extractDomain(url) {
  if (!url) return "—";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = React.useState(null);
  const timerRef = React.useRef(null);

  const show = React.useCallback((message, type = "success") => {
    clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  return [toast, show];
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg =
    toast.type === "success"
      ? "bg-green-700"
      : toast.type === "error"
      ? "bg-red-700"
      : "bg-gray-800";
  return e(
    "div",
    {
      className: `fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium ${bg}`,
    },
    e("span", null, toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"),
    toast.message
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    pending_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
    needs_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
    publishable: "bg-blue-100 text-blue-800 border-blue-200",
    hide: "bg-gray-100 text-gray-500 border-gray-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    archived: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const labels = {
    pending_review: "Pending",
    needs_review: "Pending",
    publishable: "Publishable",
    hide: "Hidden",
    approved: "Approved",
    rejected: "Rejected",
    archived: "Archived",
  };
  const cls = styles[status] || "bg-gray-100 text-gray-500 border-gray-200";
  return e(
    "span",
    {
      className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`,
    },
    labels[status] || status
  );
}

function ScrapeFailedBadge({ success }) {
  if (success !== false) return null;
  return e(
    "span",
    {
      className:
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200 ml-1",
    },
    "Scrape failed"
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ view, setView, stats, onSignOut }) {
  const nav = [
    { key: "dashboard", label: "Dashboard", icon: "▦" },
    { key: "all", label: "All Collected", icon: "≡", count: stats?.total },
    { key: "pending", label: "Pending Review", icon: "○", count: stats?.pending },
    { key: "approved", label: "Approved", icon: "✓", count: stats?.approved },
    { key: "rejected", label: "Rejected", icon: "✕", count: stats?.rejected },
  ];

  return e(
    "aside",
    { className: "w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen" },
    // Brand
    e(
      "div",
      { className: "px-5 py-4 border-b border-gray-200 flex items-center gap-2" },
      e(
        "a",
        { href: "index.html", className: "text-lg font-extrabold text-gray-900 hover:text-gray-700 transition-colors" },
        "iMotive"
      ),
      e(
        "span",
        { className: "text-xs font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded" },
        "Admin"
      )
    ),
    // Nav items
    e(
      "nav",
      { className: "flex-1 px-3 py-4 space-y-0.5" },
      nav.map((item) =>
        e(
          "button",
          {
            key: item.key,
            type: "button",
            onClick: () => setView(item.key),
            className: `w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === item.key
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`,
          },
          e(
            "span",
            { className: "flex items-center gap-2.5" },
            e("span", { className: "text-base leading-none" }, item.icon),
            item.label
          ),
          item.count != null
            ? e(
                "span",
                {
                  className: `text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    view === item.key ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-500"
                  }`,
                },
                item.count
              )
            : null
        )
      )
    ),
    // Sign out
    e(
      "div",
      { className: "px-3 py-4 border-t border-gray-200" },
      e(
        "button",
        {
          type: "button",
          onClick: onSignOut,
          className:
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors",
        },
        e("span", null, "↩"),
        "Sign out"
      )
    )
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardView({ stats, onNavigate }) {
  if (!stats) {
    return e(
      "div",
      { className: "flex items-center justify-center h-64 text-gray-400 text-sm" },
      "Loading stats..."
    );
  }

  const cards = [
    { label: "Total in Database", value: stats.total, accent: "border-gray-300", nav: "all" },
    { label: "Pending Review", value: stats.pending, accent: "border-yellow-400", nav: "pending" },
    { label: "Approved", value: stats.approved, accent: "border-green-500", nav: "approved" },
    { label: "Rejected", value: stats.rejected, accent: "border-red-400", nav: "rejected" },
    { label: "Scrape Failed", value: stats.failed, accent: "border-gray-400" },
  ];

  return e(
    "div",
    { className: "p-8 max-w-5xl" },
    e("h1", { className: "text-2xl font-bold text-gray-900 mb-1" }, "Dashboard"),
    e("p", { className: "text-sm text-gray-500 mb-8" }, "Scholarship database overview"),
    e(
      "div",
      { className: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8" },
      cards.map((card) =>
        e(
          "div",
          {
            key: card.label,
            onClick: card.nav ? () => onNavigate(card.nav) : undefined,
            className: `bg-white rounded-xl border border-gray-200 border-l-4 ${card.accent} p-5 shadow-sm ${
              card.nav ? "cursor-pointer hover:shadow-md transition-shadow" : ""
            }`,
          },
          e("p", { className: "text-xs text-gray-500 mb-2 leading-tight" }, card.label),
          e("p", { className: "text-3xl font-bold text-gray-900" }, card.value.toLocaleString())
        )
      )
    ),
    stats.pending > 0 &&
      e(
        "div",
        { className: "bg-yellow-50 border border-yellow-200 rounded-xl p-6" },
        e(
          "h2",
          { className: "text-base font-semibold text-yellow-900 mb-1" },
          `${stats.pending} scholarship${stats.pending !== 1 ? "s" : ""} need review`
        ),
        e(
          "p",
          { className: "text-sm text-yellow-700 mb-4" },
          "Open the link, verify it's a real scholarship, then approve or reject."
        ),
        e(
          "button",
          {
            type: "button",
            onClick: () => onNavigate("pending"),
            className:
              "px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors",
          },
          "Start reviewing →"
        )
      ),
    stats.pending === 0 &&
      e(
        "div",
        { className: "bg-green-50 border border-green-200 rounded-xl p-6" },
        e("h2", { className: "text-base font-semibold text-green-900 mb-1" }, "Queue is clear"),
        e("p", { className: "text-sm text-green-700" }, "All scholarships have been reviewed.")
      )
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ filters, setFilters }) {
  const inputCls =
    "px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white";

  function update(patch) {
    setFilters((f) => ({ ...f, ...patch, page: 0 }));
  }

  return e(
    "div",
    { className: "flex flex-wrap items-center gap-2.5 px-6 py-3 bg-white border-b border-gray-200" },
    e("input", {
      type: "text",
      placeholder: "Search title or URL...",
      value: filters.search,
      onChange: (ev) => update({ search: ev.target.value }),
      className: `${inputCls} flex-1 min-w-44`,
    }),
    e("input", {
      type: "text",
      placeholder: "Source / domain...",
      value: filters.source,
      onChange: (ev) => update({ source: ev.target.value }),
      className: `${inputCls} w-40`,
    }),
    e(
      "select",
      {
        value: filters.deadlineExists === null ? "" : String(filters.deadlineExists),
        onChange: (ev) =>
          update({
            deadlineExists: ev.target.value === "" ? null : ev.target.value === "true",
          }),
        className: `${inputCls} pr-8`,
      },
      e("option", { value: "" }, "All deadlines"),
      e("option", { value: "true" }, "Has deadline"),
      e("option", { value: "false" }, "No deadline")
    ),
    e(
      "select",
      {
        value: filters.scrapeSuccess === null ? "" : String(filters.scrapeSuccess),
        onChange: (ev) =>
          update({
            scrapeSuccess: ev.target.value === "" ? null : ev.target.value === "true",
          }),
        className: `${inputCls} pr-8`,
      },
      e("option", { value: "" }, "All scrape status"),
      e("option", { value: "true" }, "Scraped OK"),
      e("option", { value: "false" }, "Scrape failed")
    ),
    e(
      "button",
      {
        type: "button",
        onClick: () =>
          setFilters({ search: "", source: "", deadlineExists: null, scrapeSuccess: null, page: 0 }),
        className: "px-3 py-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors",
      },
      "Clear"
    )
  );
}

// ── Reject modal ──────────────────────────────────────────────────────────────

function RejectModal({ scholarship, onConfirm, onCancel }) {
  const [reason, setReason] = React.useState("");
  const textareaRef = React.useRef(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return e(
    "div",
    {
      className:
        "fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4",
      onClick: (ev) => ev.target === ev.currentTarget && onCancel(),
    },
    e(
      "div",
      { className: "bg-white rounded-xl shadow-2xl w-full max-w-md p-6" },
      e(
        "h3",
        { className: "text-base font-semibold text-gray-900 mb-1" },
        "Reject scholarship"
      ),
      e(
        "p",
        { className: "text-sm text-gray-400 mb-4 truncate" },
        scholarship.title || scholarship.url
      ),
      e(
        "label",
        { className: "block text-sm font-medium text-gray-700 mb-1.5" },
        "Rejection reason",
        e("span", { className: "text-gray-400 font-normal" }, " (optional)")
      ),
      e("textarea", {
        ref: textareaRef,
        value: reason,
        onChange: (ev) => setReason(ev.target.value),
        onKeyDown: (ev) => ev.key === "Enter" && ev.ctrlKey && onConfirm(reason),
        placeholder: "e.g. Broken link, not a real scholarship, duplicate…",
        rows: 3,
        className:
          "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none mb-4",
      }),
      e(
        "div",
        { className: "flex gap-3 justify-end" },
        e(
          "button",
          {
            type: "button",
            onClick: onCancel,
            className:
              "px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors",
          },
          "Cancel"
        ),
        e(
          "button",
          {
            type: "button",
            onClick: () => onConfirm(reason),
            className:
              "px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors",
          },
          "Reject"
        )
      )
    )
  );
}

// ── Archive confirm modal ─────────────────────────────────────────────────────

function ArchiveModal({ onConfirm, onCancel }) {
  return e(
    "div",
    {
      className:
        "fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4",
      onClick: (ev) => ev.target === ev.currentTarget && onCancel(),
    },
    e(
      "div",
      { className: "bg-white rounded-xl shadow-2xl w-full max-w-md p-6" },
      e(
        "h3",
        { className: "text-base font-semibold text-gray-900 mb-2" },
        "Archive this URL?"
      ),
      e(
        "p",
        { className: "text-sm text-gray-500 mb-6" },
        "The URL will be marked as archived and hidden from the rejected view. The record is kept so the scraper won't re-import it."
      ),
      e(
        "div",
        { className: "flex gap-3 justify-end" },
        e(
          "button",
          {
            type: "button",
            onClick: onCancel,
            className:
              "px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors",
          },
          "Cancel"
        ),
        e(
          "button",
          {
            type: "button",
            onClick: onConfirm,
            className:
              "px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors",
          },
          "Archive permanently"
        )
      )
    )
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ id, adminEmail, onClose, onApprove, onRejectRequest, onRestore }) {
  const [detail, setDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);
  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [notesSaved, setNotesSaved] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getScholarshipDetail(id)
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setNotes(data?.admin_notes || "");
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function saveNotes() {
    if (!detail) return;
    setSavingNotes(true);
    try {
      await updateAdminNotes(detail.id, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      console.error("Save notes error:", err);
    } finally {
      setSavingNotes(false);
    }
  }

  const detailRows = detail
    ? [
        ["Title", detail.title],
        ["URL", detail.url, "link"],
        ["Application URL", detail.application_url, "link"],
        ["Source", detail.source],
        ["Amount", detail.amount],
        ["Deadline", detail.deadline],
        ["Category", detail.category],
        ["Eligibility", detail.eligibility],
        ["Level", Array.isArray(detail.level) ? detail.level.join(", ") : detail.level],
        ["Fields", Array.isArray(detail.fields) ? detail.fields.join(", ") : detail.fields],
        ["Nationality", Array.isArray(detail.nationality) ? detail.nationality.join(", ") : detail.nationality],
        ["Documents", detail.documents],
        ["Quality Score", detail.quality_score != null ? String(detail.quality_score) : null],
        ["Quality Flags", Array.isArray(detail.quality_flags) && detail.quality_flags.length ? detail.quality_flags.join(", ") : null],
        ["Scrape Success", detail.scrape_success != null ? (detail.scrape_success ? "Yes" : "No") : null],
        ["Blocked", detail.blocked ? "Yes" : null],
        ["Requires Login", detail.requires_login ? "Yes" : null],
        ["Review Status", detail.review_status],
        ["Reviewed By", detail.reviewed_by],
        ["Reviewed At", detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : null],
        ["Rejection Reason", detail.rejection_reason],
        ["Date Scraped", detail.date_scraped ? new Date(detail.date_scraped).toLocaleString() : null],
        ["Created At", detail.created_at ? new Date(detail.created_at).toLocaleString() : null],
      ].filter(([, v]) => v != null && v !== "")
    : [];

  return e(
    "div",
    {
      className:
        "fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto",
      onClick: (ev) => ev.target === ev.currentTarget && onClose(),
    },
    e(
      "div",
      { className: "bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" },
      // Header
      e(
        "div",
        {
          className:
            "flex items-center justify-between px-6 py-4 border-b border-gray-200",
        },
        e(
          "div",
          { className: "flex items-center gap-3" },
          e(
            "h2",
            { className: "text-base font-semibold text-gray-900" },
            "Scholarship Detail"
          ),
          detail && e(StatusBadge, { status: detail.review_status }),
          detail && e(ScrapeFailedBadge, { success: detail.scrape_success })
        ),
        e(
          "div",
          { className: "flex items-center gap-2" },
          detail?.url &&
            e(
              "a",
              {
                href: detail.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className:
                  "px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors",
              },
              "Open link ↗"
            ),
          e(
            "button",
            {
              type: "button",
              onClick: onClose,
              className:
                "text-gray-300 hover:text-gray-600 transition-colors text-2xl leading-none",
            },
            "×"
          )
        )
      ),
      // Body
      loading &&
        e(
          "div",
          { className: "flex items-center justify-center h-48 text-gray-400 text-sm" },
          "Loading..."
        ),
      loadError &&
        e(
          "div",
          { className: "flex items-center justify-center h-48 text-red-500 text-sm" },
          loadError
        ),
      !loading &&
        !loadError &&
        detail &&
        e(
          "div",
          { className: "p-6 space-y-6" },
          // Fields table
          e(
            "div",
            { className: "rounded-lg border border-gray-200 overflow-hidden" },
            e(
              "table",
              { className: "w-full text-sm" },
              e(
                "tbody",
                { className: "divide-y divide-gray-100" },
                detailRows.map(([key, val, type]) =>
                  e(
                    "tr",
                    { key },
                    e(
                      "td",
                      {
                        className:
                          "px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-36 align-top whitespace-nowrap",
                      },
                      key
                    ),
                    e(
                      "td",
                      { className: "px-4 py-2.5 text-gray-800 break-all" },
                      type === "link" && val
                        ? e(
                            "a",
                            {
                              href: val,
                              target: "_blank",
                              rel: "noopener noreferrer",
                              className:
                                "text-blue-600 hover:text-blue-800 underline underline-offset-2",
                            },
                            val
                          )
                        : String(val)
                    )
                  )
                )
              )
            )
          ),
          // Admin notes
          e(
            "div",
            null,
            e(
              "label",
              { className: "block text-sm font-semibold text-gray-700 mb-1.5" },
              "Admin notes"
            ),
            e("textarea", {
              value: notes,
              onChange: (ev) => setNotes(ev.target.value),
              placeholder: "Internal notes visible only to admins…",
              rows: 3,
              className:
                "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none",
            }),
            e(
              "button",
              {
                type: "button",
                onClick: saveNotes,
                disabled: savingNotes,
                className:
                  "mt-2 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50",
              },
              notesSaved ? "Saved ✓" : savingNotes ? "Saving…" : "Save notes"
            )
          ),
          // Action buttons
          e(
            "div",
            { className: "flex flex-wrap gap-3 pt-2 border-t border-gray-100" },
            detail.review_status !== "approved" &&
              e(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    onApprove(detail.id);
                    onClose();
                  },
                  className:
                    "px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors",
                },
                "✓ Approve"
              ),
            detail.review_status !== "rejected" &&
              e(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    onRejectRequest(detail);
                    onClose();
                  },
                  className:
                    "px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors",
                },
                "✕ Reject"
              ),
            detail.review_status !== "pending_review" &&
              detail.review_status !== "needs_review" &&
              e(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    onRestore(detail.id);
                    onClose();
                  },
                  className:
                    "px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 transition-colors",
                },
                "↺ Move to Pending"
              )
          )
        )
    )
  );
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({ scholarship, view, onApprove, onRejectRequest, onRestore, onArchiveRequest, onOpenDetail }) {
  const url = scholarship.url || scholarship.application_url;
  const btnCls = "px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap";

  return e(
    "div",
    { className: "flex items-center gap-1 flex-nowrap" },
    url &&
      e(
        "a",
        {
          href: url,
          target: "_blank",
          rel: "noopener noreferrer",
          className: `${btnCls} text-blue-600 border-blue-200 hover:bg-blue-50`,
          title: "Open link in new tab",
        },
        "Open ↗"
      ),
    e(
      "button",
      {
        type: "button",
        onClick: () => onOpenDetail(scholarship.id),
        className: `${btnCls} text-gray-500 border-gray-200 hover:bg-gray-50`,
        title: "View full details",
      },
      "Detail"
    ),
    (view === "all" || view === "pending" || view === "rejected") &&
      e(
        "button",
        {
          type: "button",
          onClick: () => onApprove(scholarship.id),
          className: `${btnCls} text-green-700 border-green-200 hover:bg-green-50`,
          title: "Approve",
        },
        "Approve"
      ),
    (view === "all" || view === "pending" || view === "approved") &&
      e(
        "button",
        {
          type: "button",
          onClick: () => onRejectRequest(scholarship),
          className: `${btnCls} text-red-600 border-red-200 hover:bg-red-50`,
          title: "Reject",
        },
        "Reject"
      ),
    (view === "rejected" || view === "approved") &&
      e(
        "button",
        {
          type: "button",
          onClick: () => onRestore(scholarship.id),
          className: `${btnCls} text-yellow-700 border-yellow-200 hover:bg-yellow-50`,
          title: "Move back to pending review",
        },
        "↺ Pending"
      ),
    view === "rejected" &&
      e(
        "button",
        {
          type: "button",
          onClick: () => onArchiveRequest(scholarship),
          className: `${btnCls} text-gray-400 border-gray-200 hover:bg-gray-100`,
          title: "Archive permanently",
        },
        "Archive"
      )
  );
}

// ── Scholarship table ─────────────────────────────────────────────────────────

function ScholarshipTable({
  scholarships,
  totalCount,
  page,
  onPageChange,
  view,
  loading,
  onApprove,
  onRejectRequest,
  onRestore,
  onArchiveRequest,
  onOpenDetail,
}) {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading) {
    return e(
      "div",
      { className: "flex items-center justify-center h-48 text-gray-400 text-sm" },
      "Loading…"
    );
  }

  if (scholarships.length === 0) {
    const emptyMsg = {
      pending: "Nothing pending — queue is clear.",
      approved: "No approved scholarships yet.",
      rejected: "No rejected scholarships.",
    };
    return e(
      "div",
      { className: "flex flex-col items-center justify-center h-48 text-gray-400" },
      e("p", { className: "text-base font-medium" }, emptyMsg[view] || "No results."),
      e("p", { className: "text-sm mt-1" }, "Try adjusting the filters.")
    );
  }

  const cols = ["Title / URL", "Source", "Deadline", "Amount", "Status", "Added", "Actions"];

  return e(
    "div",
    { className: "flex flex-col" },
    e(
      "div",
      { className: "overflow-x-auto" },
      e(
        "table",
        { className: "w-full text-sm" },
        e(
          "thead",
          null,
          e(
            "tr",
            { className: "border-b border-gray-200 bg-gray-50/80" },
            cols.map((col) =>
              e(
                "th",
                {
                  key: col,
                  className:
                    "px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                },
                col
              )
            )
          )
        ),
        e(
          "tbody",
          { className: "divide-y divide-gray-100" },
          scholarships.map((s) =>
            e(
              "tr",
              { key: s.id, className: "hover:bg-gray-50/60 transition-colors" },
              // Title / URL
              e(
                "td",
                { className: "px-4 py-3 max-w-xs" },
                e(
                  "p",
                  {
                    className:
                      "font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors",
                    title: s.title || s.url,
                    onClick: () => onOpenDetail(s.id),
                  },
                  s.title || e("span", { className: "text-gray-400 italic" }, "No title")
                ),
                e(
                  "p",
                  {
                    className: "text-xs text-gray-400 truncate mt-0.5",
                    title: s.url,
                  },
                  s.url || "—"
                )
              ),
              // Source
              e(
                "td",
                { className: "px-4 py-3 text-gray-500 whitespace-nowrap max-w-[120px] truncate" },
                extractDomain(s.source)
              ),
              // Deadline
              e(
                "td",
                { className: "px-4 py-3 whitespace-nowrap" },
                s.deadline
                  ? e("span", { className: "text-gray-700" }, s.deadline)
                  : e("span", { className: "text-gray-300" }, "—")
              ),
              // Amount
              e(
                "td",
                { className: "px-4 py-3 whitespace-nowrap" },
                s.amount
                  ? e("span", { className: "text-gray-700" }, s.amount)
                  : e("span", { className: "text-gray-300" }, "—")
              ),
              // Status badges
              e(
                "td",
                { className: "px-4 py-3 whitespace-nowrap" },
                e(StatusBadge, { status: s.review_status }),
                e(ScrapeFailedBadge, { success: s.scrape_success })
              ),
              // Date added
              e(
                "td",
                { className: "px-4 py-3 whitespace-nowrap text-xs text-gray-400" },
                formatDate(s.date_scraped)
              ),
              // Actions
              e(
                "td",
                { className: "px-4 py-3" },
                e(RowActions, {
                  scholarship: s,
                  view,
                  onApprove,
                  onRejectRequest,
                  onRestore,
                  onArchiveRequest,
                  onOpenDetail,
                })
              )
            )
          )
        )
      )
    ),
    // Pagination
    totalPages > 1 &&
      e(
        "div",
        {
          className:
            "flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white text-sm",
        },
        e(
          "span",
          { className: "text-gray-500" },
          `${(page * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
            (page + 1) * PAGE_SIZE,
            totalCount
          ).toLocaleString()} of ${totalCount.toLocaleString()}`
        ),
        e(
          "div",
          { className: "flex gap-2" },
          e(
            "button",
            {
              type: "button",
              disabled: page === 0,
              onClick: () => onPageChange(page - 1),
              className:
                "px-3 py-1.5 font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
            },
            "← Prev"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: page >= totalPages - 1,
              onClick: () => onPageChange(page + 1),
              className:
                "px-3 py-1.5 font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
            },
            "Next →"
          )
        )
      )
  );
}

// ── Scholarships view (wraps filters + table + modals) ────────────────────────

function ScholarshipsView({ view, adminEmail, showToast, refreshStats }) {
  const [scholarships, setScholarships] = React.useState([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState({
    search: "",
    source: "",
    deadlineExists: null,
    scrapeSuccess: null,
    page: 0,
  });

  // Modal state
  const [rejectTarget, setRejectTarget] = React.useState(null);
  const [archiveTarget, setArchiveTarget] = React.useState(null);
  const [detailId, setDetailId] = React.useState(null);

  const statusByView = { all: "all", pending: "pending_review", approved: "approved", rejected: "rejected" };
  const status = statusByView[view] || "all";

  const viewTitles = {
    all: "All Collected",
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
  };

  // Reload when view or filters change
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    getScholarships(status, filters)
      .then(({ data, count }) => {
        if (!active) return;
        setScholarships(data);
        setTotalCount(count);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch scholarships error:", err);
        if (active) {
          showToast(err.message, "error");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [status, filters]);

  function removeFromList(id) {
    setScholarships((list) => list.filter((s) => s.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));
    refreshStats();
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleApprove(id) {
    try {
      await approveScholarship(id, adminEmail);
      removeFromList(id);
      showToast("Scholarship approved.", "success");
    } catch (err) {
      showToast(err.message || "Approve failed.", "error");
    }
  }

  async function handleRejectConfirm(reason) {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setRejectTarget(null);
    try {
      await rejectScholarship(target.id, adminEmail, reason);
      removeFromList(target.id);
      showToast("Scholarship rejected.", "success");
    } catch (err) {
      showToast(err.message || "Reject failed.", "error");
    }
  }

  async function handleRestore(id) {
    try {
      await restoreScholarship(id);
      removeFromList(id);
      showToast("Moved back to pending review.", "success");
    } catch (err) {
      showToast(err.message || "Restore failed.", "error");
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    try {
      await archiveScholarship(target.id);
      removeFromList(target.id);
      showToast("Scholarship archived.", "success");
    } catch (err) {
      showToast(err.message || "Archive failed.", "error");
    }
  }

  return e(
    React.Fragment,
    null,
    // Page header
    e(
      "div",
      { className: "px-6 pt-6 pb-3" },
      e("h1", { className: "text-2xl font-bold text-gray-900" }, viewTitles[view]),
      e(
        "p",
        { className: "text-sm text-gray-500 mt-0.5" },
        loading ? "Loading…" : `${totalCount.toLocaleString()} scholarships`
      )
    ),
    e(FilterBar, { filters, setFilters }),
    e(
      "div",
      { className: "overflow-hidden" },
      e(ScholarshipTable, {
        scholarships,
        totalCount,
        page: filters.page,
        onPageChange: (p) => setFilters((f) => ({ ...f, page: p })),
        view,
        loading,
        onApprove: handleApprove,
        onRejectRequest: setRejectTarget,
        onRestore: handleRestore,
        onArchiveRequest: setArchiveTarget,
        onOpenDetail: setDetailId,
      })
    ),
    // ── Modals ──────────────────────────────────────────────────────────────
    rejectTarget &&
      e(RejectModal, {
        scholarship: rejectTarget,
        onConfirm: handleRejectConfirm,
        onCancel: () => setRejectTarget(null),
      }),
    archiveTarget &&
      e(ArchiveModal, {
        onConfirm: handleArchiveConfirm,
        onCancel: () => setArchiveTarget(null),
      }),
    detailId &&
      e(DetailModal, {
        id: detailId,
        adminEmail,
        onClose: () => setDetailId(null),
        onApprove: handleApprove,
        onRejectRequest: (s) => {
          setDetailId(null);
          setRejectTarget(s);
        },
        onRestore: handleRestore,
      })
  );
}

// ── Admin App root ────────────────────────────────────────────────────────────

function AdminApp() {
  const [authState, setAuthState] = React.useState({ loading: true, session: null });
  const [view, setView] = React.useState("dashboard");
  const [stats, setStats] = React.useState(null);
  const [toast, showToast] = useToast();

  // Load session once on mount
  React.useEffect(() => {
    getFreshSession()
      .then((session) => setAuthState({ loading: false, session }))
      .catch(() => setAuthState({ loading: false, session: null }));
  }, []);

  // Load stats when admin is confirmed
  React.useEffect(() => {
    if (authState.session && isAdmin(authState.session.user)) {
      loadStats();
    }
  }, [authState.session]);

  async function loadStats() {
    try {
      const s = await getStats();
      setStats(s);
    } catch (err) {
      console.error("Stats error:", err);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (_) {
      // ignore
    }
    window.location.href = "index.html";
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (authState.loading) {
    return e(
      "div",
      { className: "flex items-center justify-center min-h-screen text-gray-400 text-sm" },
      "Loading…"
    );
  }

  if (!authState.session) {
    return e(
      "div",
      { className: "flex items-center justify-center min-h-screen bg-gray-50" },
      e(
        "div",
        { className: "text-center max-w-sm px-6" },
        e("h1", { className: "text-2xl font-bold text-gray-900 mb-2" }, "Admin Access"),
        e(
          "p",
          { className: "text-gray-500 mb-8" },
          "Sign in with an admin account to continue."
        ),
        e(
          "a",
          {
            href: "signup.html?mode=login",
            className:
              "inline-flex px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors",
          },
          "Sign in →"
        )
      )
    );
  }

  if (!isAdmin(authState.session.user)) {
    return e(
      "div",
      { className: "flex items-center justify-center min-h-screen bg-gray-50" },
      e(
        "div",
        { className: "text-center max-w-sm px-6" },
        e("h1", { className: "text-2xl font-bold text-gray-900 mb-2" }, "Access Denied"),
        e(
          "p",
          { className: "text-gray-500 mb-1" },
          "Your account does not have admin access."
        ),
        e(
          "p",
          { className: "text-xs text-gray-400 mb-8" },
          `Signed in as: ${authState.session.user.email}`
        ),
        e(
          "a",
          { href: "index.html", className: "text-sm text-blue-600 hover:text-blue-800 transition-colors" },
          "← Back to site"
        )
      )
    );
  }

  const adminEmail = authState.session.user.email;

  return e(
    "div",
    { className: "flex min-h-screen bg-gray-50" },
    e(Sidebar, { view, setView, stats, onSignOut: handleSignOut }),
    e(
      "main",
      { className: "flex-1 overflow-auto min-w-0" },
      view === "dashboard"
        ? e(DashboardView, { stats, onNavigate: setView })
        : e(ScholarshipsView, {
            key: view, // remount on tab change to reset filters + scroll
            view,
            adminEmail,
            showToast,
            refreshStats: loadStats,
          })
    ),
    e(Toast, { toast })
  );
}

createRoot(document.getElementById("admin-root")).render(e(AdminApp));
