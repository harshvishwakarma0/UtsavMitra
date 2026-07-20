import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { updateEvent } from "@/firebase/events";
import type { EventDoc, EventMember, EventMemberRole } from "@/types";

export default function Members() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      const e = await getDoc(doc(db, "events", eventId));
      if (e.exists()) {
        setEvent({ id: e.id, ...e.data() } as EventDoc);
      }
    } catch (e: any) {
      console.error("Failed to load event members:", e);
      setErr("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const myRole = event?.members.find((m) => m.uid === profile?.uid)?.role;
  const canManage = myRole === "owner" || isSuperAdmin;

  async function addByEmail() {
    const targetEmail = email.trim().toLowerCase();
    if (!event || !targetEmail) return;
    setBusy(true);
    setErr("");
    try {
      // Look up user in Firestore users collection
      const q = query(collection(db, "users"), where("email", "==", targetEmail));
      const snap = await getDocs(q);
      
      let memberUid = targetEmail;
      let memberName = targetEmail.split("@")[0];

      if (!snap.empty) {
        const userDoc = snap.docs[0].data();
        memberUid = userDoc.uid || targetEmail;
        memberName = userDoc.displayName || memberName;
      } else {
        setErr(`User with email "${targetEmail}" has not registered yet. Added by email.`);
      }

      // Avoid duplicates
      if (event.members.some((m) => m.uid === memberUid)) {
        setErr("Member is already in this event.");
        return;
      }

      const members: EventMember[] = [
        ...event.members,
        { uid: memberUid, name: memberName, role: "member" },
      ];
      await updateEvent(eventId, { members });
      setEmail("");
      await load();
    } catch (e: any) {
      console.error("Failed to add member:", e);
      setErr(e?.message ?? "Failed to add member.");
    } finally {
      setBusy(false);
    }
  }

  async function setRole(uid: string, role: EventMemberRole) {
    if (!event) return;
    try {
      const members = event.members.map((m) => (m.uid === uid ? { ...m, role } : m));
      await updateEvent(eventId, { members });
      await load();
    } catch (e: any) {
      console.error("Failed to update role:", e);
      setErr("Failed to update member role.");
    }
  }

  async function removeMember(uid: string) {
    if (!event || !confirm("Are you sure you want to remove this member?")) return;
    try {
      const members = event.members.filter((m) => m.uid !== uid);
      await updateEvent(eventId, { members });
      await load();
    } catch (e: any) {
      console.error("Failed to remove member:", e);
      setErr("Failed to remove member.");
    }
  }

  if (loading && !event) return <div className="p-4 text-text-dim">Loading team members…</div>;
  if (!event) return <div className="p-4 text-text-dim">Event not found.</div>;

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Team</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      {canManage && (
        <div className="flex gap-2 rounded-xl border border-border bg-surface p-2">
          <input
            className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-text"
            placeholder="member@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={addByEmail} disabled={busy} className="rounded-lg bg-primary px-3 font-semibold text-black disabled:opacity-50">
            {busy ? "..." : "Add"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {event.members.map((m) => (
          <div key={m.uid} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-text-dim">{m.uid}</div>
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => setRole(m.uid, e.target.value as EventMemberRole)}
                    className="rounded-lg bg-surface-2 border border-border p-1 text-sm text-text"
                  >
                    <option value="owner">Owner</option>
                    <option value="treasurer">Treasurer</option>
                    <option value="member">Member</option>
                  </select>
                  {m.uid !== profile?.uid && (
                    <button
                      onClick={() => removeMember(m.uid)}
                      className="rounded-lg bg-surface-2 border border-border p-1 text-xs text-danger hover:bg-danger/10"
                      title="Remove Member"
                    >
                      ✕
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm text-text-dim">{m.role}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
