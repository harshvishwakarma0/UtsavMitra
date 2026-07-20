import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import type {
  EventDoc,
  EventMember,
  EventTemplate,
  Expense,
  GalleryPhoto,
  Notice,
  ShoppingItem,
  Task,
  TemplateItem,
} from "@/types";
import { ganpatiTemplate } from "@/templates/ganpati";

const ev = (id: string) => doc(db, "events", id);
const sub = (id: string, name: string) => collection(db, "events", id, name);

export async function createEvent(
  data: Omit<EventDoc, "id" | "createdAt" | "memberUids"> & { memberUids?: string[] }
): Promise<string> {
  const memberUids = data.memberUids ?? data.members.map((m) => m.uid);
  const ref = await addDoc(collection(db, "events"), {
    ...data,
    memberUids,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function getEvent(id: string): Promise<EventDoc | null> {
  const snap = await getDoc(ev(id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as EventDoc) : null;
}

export async function updateEvent(id: string, patch: Partial<EventDoc>) {
  const updateData: any = { ...patch };
  if (patch.members) {
    updateData.memberUids = Array.from(new Set(patch.members.map((m) => m.uid)));
  }
  await updateDoc(ev(id), updateData);
}

export async function deleteEvent(eventId: string) {
  await deleteDoc(ev(eventId));
}

export async function addMemberToEvent(eventId: string, members: EventMember[]) {
  const e = await getEvent(eventId);
  if (!e) return;
  const memberUids = Array.from(new Set(members.map((m) => m.uid)));
  await updateDoc(ev(eventId), { members, memberUids } as any);
}

// ---- Expenses ----
export async function addExpense(eventId: string, e: Omit<Expense, "id">) {
  await addDoc(sub(eventId, "expenses"), e);
}
export async function getExpenses(eventId: string): Promise<Expense[]> {
  const q = query(sub(eventId, "expenses"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}
export async function deleteExpense(eventId: string, expenseId: string) {
  await deleteDoc(doc(db, "events", eventId, "expenses", expenseId));
}

// ---- Tasks ----
export async function addTask(eventId: string, t: Omit<Task, "id">) {
  await addDoc(sub(eventId, "tasks"), t);
}
export async function updateTask(eventId: string, id: string, patch: Partial<Task>) {
  await updateDoc(doc(db, "events", eventId, "tasks", id), patch as any);
}
export async function getTasks(eventId: string): Promise<Task[]> {
  const snap = await getDocs(sub(eventId, "tasks"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
}
export async function deleteTask(eventId: string, taskId: string) {
  await deleteDoc(doc(db, "events", eventId, "tasks", taskId));
}

// ---- Shopping ----
export async function addShoppingItem(eventId: string, it: Omit<ShoppingItem, "id">) {
  await addDoc(sub(eventId, "shopping"), it);
}
export async function updateShoppingItem(eventId: string, id: string, patch: Partial<ShoppingItem>) {
  await updateDoc(doc(db, "events", eventId, "shopping", id), patch as any);
}
export async function getShopping(eventId: string): Promise<ShoppingItem[]> {
  const snap = await getDocs(sub(eventId, "shopping"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingItem));
}
export async function deleteShoppingItem(eventId: string, itemId: string) {
  await deleteDoc(doc(db, "events", eventId, "shopping", itemId));
}

// ---- Notices ----
export async function addNotice(eventId: string, n: Omit<Notice, "id">) {
  await addDoc(sub(eventId, "notices"), n);
}
export async function getNotices(eventId: string): Promise<Notice[]> {
  const q = query(sub(eventId, "notices"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
}
export async function deleteNotice(eventId: string, noticeId: string) {
  await deleteDoc(doc(db, "events", eventId, "notices", noticeId));
}

// ---- Gallery ----
export async function addPhoto(eventId: string, p: Omit<GalleryPhoto, "id">) {
  await addDoc(sub(eventId, "gallery"), p);
}
export async function getGallery(eventId: string): Promise<GalleryPhoto[]> {
  const q = query(sub(eventId, "gallery"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto));
}
export async function deletePhoto(eventId: string, photoId: string) {
  await deleteDoc(doc(db, "events", eventId, "gallery", photoId));
}

// ---- Templates (shared library) ----
export async function addTemplate(t: Omit<EventTemplate, "id" | "createdAt">) {
  await addDoc(collection(db, "templates"), { ...t, createdAt: Date.now() });
}
export async function getTemplates(): Promise<EventTemplate[]> {
  const snap = await getDocs(collection(db, "templates"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventTemplate));
}
export async function deleteTemplate(id: string) {
  await deleteDoc(doc(db, "templates", id));
}
export async function featureTemplate(id: string, featured: boolean) {
  await updateDoc(doc(db, "templates", id), { featured } as any);
}

// Seed event from template items with batched writes for speed and atomicity
export async function seedFromTemplate(eventId: string, items: TemplateItem[]) {
  const batch = writeBatch(db);
  for (const it of items) {
    if (it.task) {
      const taskRef = doc(collection(db, "events", eventId, "tasks"));
      batch.set(taskRef, {
        title: it.task.title,
        description: it.task.description ?? "",
        status: "pending",
        priority: it.task.priority ?? "medium",
        createdAt: Date.now(),
      });
    }
    if (it.shopping) {
      const shopRef = doc(collection(db, "events", eventId, "shopping"));
      batch.set(shopRef, {
        name: it.shopping.name,
        quantity: it.shopping.quantity,
        estimatedCost: it.shopping.estimatedCost,
        bought: false,
      });
    }
  }
  await batch.commit();
}

export { ganpatiTemplate };
