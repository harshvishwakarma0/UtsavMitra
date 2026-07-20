import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { addTemplate, deleteTemplate, featureTemplate, getTemplates } from "@/firebase/events";
import type { EventTemplate, TemplateItem, TaskPriority } from "@/types";

export default function Templates() {
  const { profile, isSuperAdmin } = useAuth();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setTemplates(await getTemplates());
    } catch (e: any) {
      console.error("Failed to load templates:", e);
      setErr("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseNotes(): TemplateItem[] {
    const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const low = line.toLowerCase();
      if (low.startsWith("buy ") || low.startsWith("shop ")) {
        const name = line.replace(/^(buy|shop)\s*/i, "");
        return { shopping: { name, quantity: 1, estimatedCost: 0 } };
      }
      const priMatch = line.match(/\((!{1,3})\)$/);
      let priority: TaskPriority = "medium";
      if (priMatch) {
        const b = priMatch[1].length;
        priority = b >= 3 ? "high" : b === 2 ? "medium" : "low";
      }
      const taskTitle = line.replace(/\(!{1,3}\)$/, "").trim();
      return { task: { title: taskTitle, priority } };
    });
  }

  async function save() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const items = parseNotes();
      await addTemplate({
        title: title.trim(),
        kind: "custom",
        ownerUid: profile.uid,
        ownerName: profile.displayName,
        featured: false,
        items,
      });
      setTitle("");
      setNotes("");
      setShowEditor(false);
      await load();
    } catch (e: any) {
      console.error("Failed to save template:", e);
      setErr(e?.message ?? "Failed to save template.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplate(id);
      await load();
    } catch (e: any) {
      console.error("Failed to delete template:", e);
      setErr("Failed to delete template.");
    }
  }

  async function handleFeature(id: string, featured: boolean) {
    try {
      await featureTemplate(id, featured);
      await load();
    } catch (e: any) {
      console.error("Failed to feature template:", e);
      setErr("Failed to update template.");
    }
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Templates Library</h1>
        <button onClick={() => nav("/")} className="text-sm font-medium text-primary hover:underline">
          ← Back to Home
        </button>
      </div>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <button
        onClick={() => setShowEditor((s) => !s)}
        className="w-full rounded-xl bg-primary p-3 font-semibold text-black hover:opacity-90"
      >
        + New Template (Notepad)
      </button>

      {showEditor && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <input
            className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
            placeholder="Template title (e.g. Diwali Party Checklist)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="text-xs text-text-dim">
            One item per line. Prefix with "buy " for shopping, add (!, !!, !!!) for task priority.
          </p>
          <textarea
            className="h-44 w-full rounded-lg bg-surface-2 border border-border p-2 text-text font-mono text-sm"
            placeholder={"Murti order (!!!)\nbuy flowers 300\nSound system setup (!!)"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save Template"}
          </button>
        </div>
      )}

      {loading && templates.length === 0 ? (
        <p className="text-center text-sm text-text-dim">Loading templates…</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-surface p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text">{t.title}</span>
                  <span className="text-xs text-text-dim">
                    by {t.ownerName}
                    {t.featured ? " ⭐" : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-text-dim">
                  <span>{t.items.length} checklist items</span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className="text-primary hover:underline"
                  >
                    {isExpanded ? "Hide items ▲" : "Preview items ▼"}
                  </button>
                </div>

                {/* Items Preview */}
                {isExpanded && (
                  <div className="rounded-lg bg-surface-2 p-3 text-xs space-y-1 my-2 border border-border">
                    {t.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {item.shopping ? (
                          <span className="text-primary">🛒 Buy {item.shopping.name}</span>
                        ) : (
                          <span>☑️ {item.task?.title} ({item.task?.priority || "med"})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border/40">
                  <button
                    onClick={() => nav(`/?templateId=${t.id}`)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
                  >
                    Use Template
                  </button>
                  {(isSuperAdmin || t.ownerUid === profile?.uid) && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
                    >
                      Delete
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleFeature(t.id, !t.featured)}
                      className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-2/80"
                    >
                      {t.featured ? "Unfeature" : "Feature"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {templates.length === 0 && <p className="text-center text-text-dim">No templates saved yet.</p>}
        </div>
      )}
    </div>
  );
}
