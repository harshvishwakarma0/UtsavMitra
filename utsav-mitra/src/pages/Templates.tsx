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

  async function load() {
    setTemplates(await getTemplates());
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
    load();
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Templates</h1>
      <button onClick={() => setShowEditor((s) => !s)} className="w-full rounded-xl bg-primary p-3 font-semibold text-black">
        + New Template (notepad)
      </button>

      {showEditor && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <input className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Template title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <p className="text-xs text-text-dim">
            One item per line. Prefix with "buy " for shopping, add (!, !!, !!!) for priority.
          </p>
          <textarea
            className="h-48 w-full rounded-lg bg-surface-2 border border-border p-2 text-text font-mono text-sm"
            placeholder={"Murti order (!!!)\nbuy flowers 300\nSound system (!!)"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button onClick={save} className="w-full rounded-lg bg-primary p-2 font-semibold text-black">Save Template</button>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-text-dim">by {t.ownerName}{t.featured ? " ⭐" : ""}</span>
            </div>
            <div className="mt-1 text-xs text-text-dim">{t.items.length} items</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => nav("/")} className="rounded-lg bg-surface-2 border border-border px-2 py-1 text-xs">Use</button>
              {(isSuperAdmin || t.ownerUid === profile?.uid) && (
                <button onClick={() => deleteTemplate(t.id)} className="rounded-lg bg-surface-2 border border-border px-2 py-1 text-xs text-danger">Delete</button>
              )}
              {isSuperAdmin && (
                <button onClick={() => featureTemplate(t.id, !t.featured)} className="rounded-lg bg-surface-2 border border-border px-2 py-1 text-xs">
                  {t.featured ? "Unfeature" : "Feature"}
                </button>
              )}
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-text-dim">No templates yet.</p>}
      </div>
    </div>
  );
}
