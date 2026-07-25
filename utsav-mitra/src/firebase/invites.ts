import {
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
import type { EventMember, EventMemberRole } from "@/types";
import { updateEvent } from "./events";

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

export async function createInvite(eventId: string, email: string, invitedBy: string, inviteId?: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const id = inviteId || crypto.randomUUID();
  await withTimeout(setDoc(doc(db, "eventInvites", id), {
    eventId,
    email: normalizedEmail,
    invitedBy,
    role: "member" as EventMemberRole,
    status: "pending",
    createdAt: Date.now(),
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

export async function cancelInvite(inviteId: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, "eventInvites", inviteId)), 10_000);
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
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const docSnap of snap.docs) {
    const invite = docSnap.data() as EventInvite;
    let eventSnap;
    try {
      eventSnap = await withTimeout(getDoc(doc(db, "events", invite.eventId)), 10_000);
    } catch {
      continue;
    }
    if (!eventSnap.exists()) continue;
    const existingMembers: EventMember[] = eventSnap.data().members ?? [];
    if (existingMembers.some((m) => m.uid === uid)) continue;
    await updateEvent(invite.eventId, { members: [...existingMembers, { uid, name: displayName, email: normalizedEmail, role: invite.role }] });
    await withTimeout(updateDoc(doc(db, "eventInvites", docSnap.id), { status: "claimed", claimedBy: uid, claimedAt: Date.now() }), 10_000);
    results.push(invite.eventId);
  }
  return results;
}
