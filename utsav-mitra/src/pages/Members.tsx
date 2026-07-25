import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { updateEvent } from "@/firebase/events";
import { createInvite, getEventInvites, cancelInvite, repairOldInvite } from "@/firebase/invites";
import type { EventDoc, EventMemberRole } from "@/types";
import type { EventInvite } from "@/firebase/invites";

export default function Members() {
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(contextEvent || null);
  const [email, setEmail] = useState("");
  const [loading] = useState(!contextEvent);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [invites, setInvites] = useState<EventInvite[]>([]);

  // Real-time listener for event doc (keeps membership in sync)
  useEffect(() => {
    if (!eventId) return;
    const unsub = onSnapshot(doc(db, "events", eventId), (snap) => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...snap.data() } as EventDoc);
      }
    });
    return unsub;
  }, [eventId]);

  // Auto-sync: detect members whose UIDs are missing from memberUids and fix them
  useEffect(() => {
    if (!event || !eventId) return;
    const memberUids = event.memberUids || [];
    const missingUids = event.members
      .map((m) => m.uid)
      .filter((uid) => uid && !memberUids.includes(uid));
    if (missingUids.length > 0) {
      console.log(`[sync] Found ${missingUids.length} members missing from memberUids, fixing...`);
      updateDoc(doc(db, "events", eventId), {
        memberUids: arrayUnion(...missingUids),
      }).catch((e) => console.error("[sync] Failed to sync memberUids:", e));
    }
  }, [event, eventId]);

  // Load pending invites + auto-repair old-format invites
  useEffect(() => {
    if (!eventId) return;
    getEventInvites(eventId)
      .then(async (loaded) => {
        // Auto-repair old invites with non-deterministic IDs
        const deterministicId = (email: string) => `${eventId}_${email.toLowerCase().trim()}`;
        const oldInvites = loaded.filter((inv) => inv.id !== deterministicId(inv.email));
        if (oldInvites.length > 0 && profile?.uid) {
          for (const inv of oldInvites) {
            try {
              await repairOldInvite(eventId, inv.email, profile.uid);
            } catch (e) {
              console.error("Failed to repair invite:", e);
            }
          }
          // Re-fetch after repair
          const refreshed = await getEventInvites(eventId);
          setInvites(refreshed);
        } else {
          setInvites(loaded);
        }
      })
      .catch((e) => console.error("Failed to load invites:", e));
  }, [eventId, profile?.uid]);

  const myRole = event?.members.find((m) => m.uid === profile?.uid)?.role;
  const canManage = myRole === "owner" || isSuperAdmin;

  async function addByEmail() {
    const targetEmail = email.trim().toLowerCase();
    if (!event || !targetEmail) return;
    setBusy(true);
    setErr("");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      setErr("Please enter a valid email address (e.g. name@example.com).");
      setBusy(false);
      return;
    }

    if (event.members.some((m) => m.email === targetEmail)) {
      setErr("This person is already a member of this event.");
      setBusy(false);
      return;
    }

    // Deterministic invite ID: {eventId}_{email}
    const inviteId = `${eventId}_${targetEmail}`;
    const newInvite: EventInvite = {
      id: inviteId,
      eventId,
      email: targetEmail,
      invitedBy: profile?.uid ?? "",
      role: "member",
      status: "pending",
      createdAt: Date.now(),
    };
    setInvites((prev) => [...prev, newInvite]);
    setEmail("");
    setBusy(false);

    createInvite(eventId, targetEmail, profile?.uid ?? "").catch((e: any) => {
      console.error("Failed to add member:", e);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setErr(e?.message ?? "Failed to add member. Invite may not have been saved.");
    });
  }

  async function setRole(uid: string, role: EventMemberRole) {
    if (!event) return;
    try {
      const members = event.members.map((m) => (m.uid === uid ? { ...m, role } : m));
      await updateEvent(eventId, { members });
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
    } catch (e: any) {
      console.error("Failed to remove member:", e);
      setErr("Failed to remove member.");
    }
  }

  async function handleCancelInvite(inviteId: string, inviteEmail: string) {
    if (!confirm("Cancel this invite?")) return;
    try {
      await cancelInvite(inviteId, eventId, inviteEmail);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (e: any) {
      console.error("Failed to cancel invite:", e);
      setErr("Failed to cancel invite.");
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
        <div className="text-sm font-semibold text-text-dim">Active Members</div>
        {event.members.map((m) => (
          <div key={m.uid} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
            <div>
              <div className="font-medium">{m.name}</div>
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

      {invites.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-text-dim">Pending Invites</div>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-dashed border-border bg-surface-2 p-3 opacity-80">
              <div>
                <div className="font-medium">{inv.email}</div>
                <div className="text-xs text-text-dim">Waiting for signup…</div>
              </div>
              {canManage && (
                <button
                  onClick={() => handleCancelInvite(inv.id, inv.email)}
                  className="rounded-lg bg-surface-2 border border-border p-1 text-xs text-danger hover:bg-danger/10"
                  title="Cancel Invite"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
