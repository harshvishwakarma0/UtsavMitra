import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { EventDoc, EventMember, EventMemberRole } from "@/types";

export default function Members() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [email, setEmail] = useState("");

  async function load() {
    const e = await getDoc(doc(db, "events", eventId));
    setEvent({ id: e.id, ...e.data() } as EventDoc);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const myRole = event?.members.find((m) => m.uid === profile?.uid)?.role;
  const canManage = myRole === "owner" || isSuperAdmin;

  async function addByEmail() {
    if (!event || !email.trim()) return;
    const members: EventMember[] = [
      ...event.members,
      { uid: email.trim().toLowerCase(), name: email.split("@")[0], role: "member" },
    ];
    await updateDoc(doc(db, "events", eventId), { members } as any);
    setEmail("");
    load();
  }

  async function setRole(uid: string, role: EventMemberRole) {
    if (!event) return;
    const members = event.members.map((m) => (m.uid === uid ? { ...m, role } : m));
    await updateDoc(doc(db, "events", eventId), { members } as any);
    load();
  }

  if (!event) return <div className="p-4">Loading…</div>;

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Team</h1>
      {canManage && (
        <div className="flex gap-2 rounded-xl border border-border bg-surface p-2">
          <input className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="member@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={addByEmail} className="rounded-lg bg-primary px-3 font-semibold text-black">Add</button>
        </div>
      )}
      <div className="space-y-2">
        {event.members.map((m) => (
          <div key={m.uid} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-text-dim">{m.uid}</div>
            </div>
            {canManage ? (
              <select value={m.role} onChange={(e) => setRole(m.uid, e.target.value as EventMemberRole)} className="rounded-lg bg-surface-2 border border-border p-1 text-sm text-text">
                <option value="owner">Owner</option>
                <option value="treasurer">Treasurer</option>
                <option value="member">Member</option>
              </select>
            ) : (
              <span className="text-sm text-text-dim">{m.role}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
