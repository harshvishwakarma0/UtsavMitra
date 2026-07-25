import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import type { EventMember, EventMemberRole } from "@/types";
import { updateEvent } from "@/firebase/events";

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
  const q = query(
    collection(db, "eventInvites"),
    where("eventId", "==", eventId),
    where("email", "==", normalizedEmail),
    where("status", "==", "pending"),
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error("An invite for this email is already pending.");
  }
  const docRef = await addDoc(collection(db, "eventInvites"), {
    eventId,
    email: normalizedEmail,
    invitedBy,
    role: "member" as EventMemberRole,
    status: "pending",
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function getEventInvites(eventId: string): Promise<EventInvite[]> {
  const q = query(
    collection(db, "eventInvites"),
    where("eventId", "==", eventId),
    where("status", "==", "pending"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventInvite);
}

export async function cancelInvite(inviteId: string): Promise<void> {
  await deleteDoc(doc(db, "eventInvites", inviteId));
}

export async function claimPendingInvites(uid: string, email: string, displayName: string): Promise<string[]> {
  const normalizedEmail = email.toLowerCase().trim();
  const q = query(
    collection(db, "eventInvites"),
    where("email", "==", normalizedEmail),
    where("status", "==", "pending"),
  );
  const snap = await getDocs(q);
  const results: string[] = [];
  for (const docSnap of snap.docs) {
    const invite = docSnap.data() as EventInvite;
    const eventSnap = await getDoc(doc(db, "events", invite.eventId));
    if (!eventSnap.exists()) continue;
    const existingMembers: EventMember[] = eventSnap.data().members ?? [];
    if (existingMembers.some((m) => m.uid === uid)) continue;
    await updateEvent(invite.eventId, { members: [...existingMembers, { uid, name: displayName, role: invite.role }] });
    await updateDoc(doc(db, "eventInvites", docSnap.id), { status: "claimed", claimedBy: uid, claimedAt: Date.now() });
    results.push(invite.eventId);
  }
  return results;
}