import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { createEvent, deleteEvent, getTemplates, seedFromTemplate } from "@/firebase/events";
import { ganpatiTemplate } from "@/templates/ganpati";
import type { EventDoc, EventTemplate } from "@/types";

export default function Home() {
  const { profile, user, logout, isSuperAdmin } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const templateIdParam = searchParams.get("templateId");

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateIdParam || "");

  const [showCreate, setShowCreate] = useState(Boolean(templateIdParam));
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState(0);
  const [kind, setKind] = useState<"ganpati" | "generic" | "custom">(templateIdParam ? "custom" : "ganpati");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    if (!profile || !user) return;
    try {
      setLoading(true);
      const out: EventDoc[] = [];
      const q = query(collection(db, "events"), where("memberUids", "array-contains", user.uid));
      const snap = await getDocs(q);
      snap.forEach((d) => out.push({ id: d.id, ...d.data() } as EventDoc));
      setEvents(out);

      const tList = await getTemplates();
      setTemplates(tList);

      if (templateIdParam) {
        const found = tList.find((t) => t.id === templateIdParam);
        if (found) {
          setTitle(`${found.title} Event`);
          setKind("custom");
          setSelectedTemplateId(found.id);
        }
      }
    } catch (e: any) {
      console.error("Failed to load home data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user, templateIdParam]);

  async function create() {
    if (!profile || !user || !title.trim()) {
      setErr("Please provide an event title.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const member = { uid: user.uid, name: profile.displayName, role: "owner" as const };
      const id = await createEvent({
        title: title.trim(),
        templateKind: kind,
        totalBudget: Math.max(0, budget),
        createdBy: user.uid,
        members: [member],
        memberUids: [user.uid],
        description: "",
      });

      // Seed template items asynchronously in the background so UI navigation is instantaneous
      if (kind === "ganpati") {
        seedFromTemplate(id, ganpatiTemplate).catch((e) => console.error("Template seed error:", e));
      } else if (kind === "custom" && selectedTemplateId) {
        const chosen = templates.find((t) => t.id === selectedTemplateId);
        if (chosen?.items?.length) {
          seedFromTemplate(id, chosen.items).catch((e) => console.error("Template seed error:", e));
        }
      }

      setTitle("");
      setShowCreate(false);
      nav(`/event/${id}`);
    } catch (e: any) {
      console.error("Failed to create event:", e);
      setErr(e?.message ?? "Failed to create event. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEvent(eventId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this event? All subcollection data will be orphaned.")) return;
    try {
      await deleteEvent(eventId);
      await load();
    } catch (e: any) {
      console.error("Failed to delete event:", e);
      setErr("Failed to delete event.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Utsav Mitra</h1>
          <p className="text-sm text-text-dim">Namaste, {profile?.displayName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/templates")} className="text-sm font-medium text-primary hover:underline">
            📋 Templates
          </button>
          <button onClick={logout} className="text-sm text-text-dim hover:text-text">
            Logout
          </button>
        </div>
      </header>

      {err && <div className="mb-4 rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <button
        onClick={() => setShowCreate((s) => !s)}
        className="mb-4 w-full rounded-xl bg-primary p-3 font-semibold text-black hover:opacity-90"
      >
        + New Event
      </button>

      {showCreate && (
        <div className="mb-4 space-y-3 rounded-xl border border-border bg-surface p-4">
          <input
            className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
            placeholder="Event title (e.g. Ganesh Utsav 2026)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex gap-2">
            {(["ganpati", "generic", "custom"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg border p-2 text-sm capitalize ${
                  kind === k ? "border-primary text-primary font-semibold" : "border-border text-text-dim"
                }`}
              >
                {k === "ganpati" ? "🪔 Ganpati" : k === "generic" ? "📋 Generic" : "⭐ Saved Template"}
              </button>
            ))}
          </div>

          {kind === "custom" && templates.length > 0 && (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text text-sm"
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.items.length} items)
                </option>
              ))}
            </select>
          )}

          <input
            type="number"
            min="0"
            className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
            placeholder="Total budget (₹)"
            value={budget || ""}
            onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
          />

          <button
            onClick={create}
            disabled={busy}
            className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      )}

      {loading && events.length === 0 ? (
        <p className="text-center text-sm text-text-dim py-8">Loading your events…</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div
              key={e.id}
              onClick={() => nav(`/event/${e.id}`)}
              className="flex items-center justify-between cursor-pointer rounded-xl border border-border bg-surface p-4 text-left hover:border-primary/50 transition-colors"
            >
              <div>
                <div className="font-semibold text-text text-base">{e.title}</div>
                <div className="text-sm text-text-dim">
                  {e.templateKind === "ganpati" ? "🪔 Ganpati" : "📋 Event"} · ₹{e.totalBudget} · {e.members?.length || 1} members
                </div>
              </div>
              {(isSuperAdmin || e.createdBy === user?.uid) && (
                <button
                  onClick={(ev) => handleDeleteEvent(e.id, ev)}
                  className="rounded-lg p-2 text-text-dim hover:text-danger hover:bg-surface-2"
                  title="Delete event"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-center text-text-dim py-8">No events yet. Create one above.</p>
          )}
        </div>
      )}
    </div>
  );
}
