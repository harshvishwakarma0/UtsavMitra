import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { createEvent, seedFromTemplate } from "@/firebase/events";
import { ganpatiTemplate } from "@/templates/ganpati";
import type { EventDoc } from "@/types";

export default function Home() {
  const { profile, user, logout } = useAuth();
  const nav = useNavigate();
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState(0);
  const [kind, setKind] = useState<"ganpati" | "generic">("ganpati");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!profile) return;
    const out: EventDoc[] = [];
    const q = query(collection(db, "events"), where("members.uid", "array-contains", user!.uid));
    const snap = await getDocs(q);
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as EventDoc));
    setEvents(out);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function create() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    const member = { uid: user!.uid, name: profile.displayName, role: "owner" as const };
    const id = await createEvent({
      title: title.trim(),
      templateKind: kind,
      totalBudget: budget,
      createdBy: user!.uid,
      members: [member],
      description: "",
    });
    if (kind === "ganpati") {
      await seedFromTemplate(id, ganpatiTemplate);
    }
    setTitle("");
    setShowCreate(false);
    setBusy(false);
    nav(`/event/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Utsav Mitra</h1>
          <p className="text-sm text-text-dim">Namaste, {profile?.displayName}</p>
        </div>
        <button onClick={logout} className="text-sm text-text-dim">
          Logout
        </button>
      </header>

      <button
        onClick={() => setShowCreate((s) => !s)}
        className="mb-4 w-full rounded-xl bg-primary p-3 font-semibold text-black"
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
            {(["ganpati", "generic"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg border p-2 text-sm ${
                  kind === k ? "border-primary text-primary" : "border-border text-text-dim"
                }`}
              >
                {k === "ganpati" ? "🪔 Ganpati" : "📋 Generic"}
              </button>
            ))}
          </div>
          <input
            type="number"
            className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
            placeholder="Total budget"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <button
            onClick={create}
            disabled={busy}
            className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      <div className="space-y-3">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => nav(`/event/${e.id}`)}
            className="block w-full rounded-xl border border-border bg-surface p-4 text-left"
          >
            <div className="font-semibold">{e.title}</div>
            <div className="text-sm text-text-dim">
              {e.templateKind === "ganpati" ? "🪔 Ganpati" : "📋 Event"} · ₹{e.totalBudget}
            </div>
          </button>
        ))}
        {events.length === 0 && (
          <p className="text-center text-text-dim">No events yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
