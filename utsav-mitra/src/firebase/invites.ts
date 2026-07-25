import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { withTimeout } from "./timeout";
import type { EventMemberRole } from "@/types";

export interface EventInvite {
  id: string;
  eventId: string;
  email: string;
  invitedBy: string;
  role: EventMemberRole;
  status: "pending" | "claimed";
  createdAt: number;
  claimedBy?: string;
  claimedAt?: number;
}

export async function createInvite(eventId: string, email: string, invitedBy: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const id = `${eventId}_${normalizedEmail}`;
  await withTimeout(setDoc(doc(db, "eventInvites", id), {
    eventId,
    email: normalizedEmail,
    invitedBy,
    role: "member" as EventMemberRole,
    status: "pending",
    createdAt: Date.now(),
  }), 10_000);
  // Also add email to event's pendingMemberEmails so Firestore rules allow the claim
  await withTimeout(updateDoc(doc(db, "events", eventId), {
    pendingMemberEmails: arrayUnion(normalizedEmail),
  }), 10_000);
  return id;
}

export async function getEventInvites(eventId: string): Promise<EventInvite[]> {
  const q = query(
    collection(db, "eventInvites"),
    where("eventId", "==", eventId),
    where("status", "==", "pending"),
  );
  const snap = await withTimeout(getDocs(q), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventInvite);
}

export async function cancelInvite(inviteId: string, eventId: string, email: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, "eventInvites", inviteId)), 10_000);
  // Also remove from event's pendingMemberEmails
  try {
    await withTimeout(updateDoc(doc(db, "events", eventId), {
      pendingMemberEmails: arrayRemove(email.toLowerCase().trim()),
    }), 10_000);
  } catch { /* best effort */ }
}

// Fix old invites that were created before pendingMemberEmails was added.
// Re-creates the invite with deterministic ID and adds email to pendingMemberEmails.
export async function repairOldInvite(eventId: string, email: string, invitedBy: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const oldQ = query(
    collection(db, "eventInvites"),
    where("eventId", "==", eventId),
    where("email", "==", normalizedEmail),
    where("status", "==", "pending"),
  );
  const snap = await withTimeout(getDocs(oldQ), 10_000);
  for (const d of snap.docs) {
    const deterministicId = `${eventId}_${normalizedEmail}`;
    if (d.id !== deterministicId) {
      // Old format — delete and re-create with deterministic ID + pendingMemberEmails
      await withTimeout(deleteDoc(d.ref), 10_000);
      await createInvite(eventId, normalizedEmail, invitedBy);
    }
  }
}

// Repair memberUids by syncing from the members array.
// Fixes old events where members were added but memberUids wasn't updated.
export async function repairMemberUids(eventId: string): Promise<boolean> {
  try {
    const snap = await withTimeout(getDoc(doc(db, "events", eventId)), 10_000);
    if (!snap.exists()) return false;
    const data = snap.data();
    const members: { uid: string }[] = data.members || [];
    const memberUids: string[] = data.memberUids || [];
    const missing = members.map((m) => m.uid).filter((uid) => uid && !memberUids.includes(uid));
    if (missing.length === 0) return false;
    console.log(`[repair] Adding ${missing.length} UIDs to memberUids for event ${eventId}`);
    await withTimeout(updateDoc(doc(db, "events", eventId), {
      memberUids: arrayUnion(...missing),
    }), 10_000);
    return true;
  } catch (e: any) {
    console.error(`[repair] Failed to repair memberUids for ${eventId}:`, e?.code, e?.message);
    return false;
  }
}

export async function claimPendingInvites(uid: string, email: string, displayName: string): Promise<string[]> {
  const normalizedEmail = email.toLowerCase().trim();
  const q = query(
    collection(db, "eventInvites"),
    where("email", "==", normalizedEmail),
    where("status", "==", "pending"),
  );
  let snap;
  try {
    snap = await withTimeout(getDocs(q), 10_000);
    console.log(`[claim] Query found ${snap.docs.length} pending invites for ${normalizedEmail}`);
  } catch (e: any) {
    console.error(`[claim] Query failed for ${normalizedEmail}:`, e?.code, e?.message);
    return [];
  }
  const results: string[] = [];
  for (const docSnap of snap.docs) {
    const invite = docSnap.data() as EventInvite;
    const inviteId = docSnap.id;
    try {
      console.log(`[claim] Attempting to claim invite ${inviteId} for event ${invite.eventId} as ${uid}`);
      await withTimeout(updateDoc(doc(db, "events", invite.eventId), {
        members: arrayUnion({ uid, name: displayName, email: normalizedEmail, role: invite.role }),
        memberUids: arrayUnion(uid),
        pendingMemberEmails: arrayRemove(normalizedEmail),
      }), 10_000);
      console.log(`[claim] Event updated successfully for ${inviteId}`);
      await withTimeout(updateDoc(doc(db, "eventInvites", inviteId), {
        status: "claimed",
        claimedBy: uid,
        claimedAt: Date.now(),
      }), 10_000);
      console.log(`[claim] Invite marked as claimed: ${inviteId}`);
      results.push(invite.eventId);
    } catch (e: any) {
      console.error(`[claim] FAILED for invite ${inviteId} event ${invite.eventId}:`, e?.code, e?.message);
    }
  }
  return results;
}
