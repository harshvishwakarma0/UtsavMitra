import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { db, storage } from "@/firebase/config";
import { withTimeout } from "./timeout";
import type {
  EventDoc,
  EventTemplate,
  Expense,
  GalleryPhoto,
  Notice,
  ShoppingItem,
  Task,
  TemplateItem,
} from "@/types";

const ev = (id: string) => doc(db, "events", id);
const sub = (id: string, name: string) => collection(db, "events", id, name);

export async function createEvent(
  data: Omit<EventDoc, "id" | "createdAt" | "memberUids"> & { memberUids?: string[] }
): Promise<string> {
  const memberUids = data.memberUids ?? data.members.map((m) => m.uid);
  const ref = await withTimeout(addDoc(collection(db, "events"), {
    ...data,
    memberUids,
    createdAt: Date.now(),
  }), 30_000);
  return ref.id;
}

export async function updateEvent(id: string, patch: Partial<EventDoc>) {
  const updateData: Record<string, unknown> = { ...patch };
  if (patch.members) {
    updateData.memberUids = Array.from(new Set(patch.members.map((m) => m.uid)));
  }
  await withTimeout(updateDoc(ev(id), updateData), 10_000);
}

export async function deleteEvent(eventId: string) {
  const subNames = ["expenses", "tasks", "shopping", "notices", "gallery"];
  for (const name of subNames) {
    try {
      const snap = await withTimeout(getDocs(sub(eventId, name)), 10_000);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (snap.docs.length > 0) await withTimeout(batch.commit(), 15_000);
    } catch { /* subcollection may not exist */ }
  }
  // Clean up Storage files for this event
  try {
    const folderRef = ref(storage, `events/${eventId}`);
    const list = await listAll(folderRef);
    for (const item of list.items) {
      await deleteObject(item).catch(() => {});
    }
  } catch { /* folder may not exist */ }
  await withTimeout(deleteDoc(ev(eventId)), 10_000);
}

// ---- Expenses ----
export async function addExpense(eventId: string, e: Omit<Expense, "id">) {
  await withTimeout(addDoc(sub(eventId, "expenses"), e), 10_000);
}
export async function getExpenses(eventId: string): Promise<Expense[]> {
  const q = query(sub(eventId, "expenses"), orderBy("date", "desc"));
  const snap = await withTimeout(getDocs(q), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}
export async function deleteExpense(eventId: string, expenseId: string) {
  await withTimeout(deleteDoc(doc(db, "events", eventId, "expenses", expenseId)), 10_000);
}

// ---- Tasks ----
export async function addTask(eventId: string, t: Omit<Task, "id">) {
  await withTimeout(addDoc(sub(eventId, "tasks"), t), 10_000);
}
export async function updateTask(eventId: string, id: string, patch: Partial<Task>) {
  await withTimeout(updateDoc(doc(db, "events", eventId, "tasks", id), patch), 10_000);
}
export async function getTasks(eventId: string): Promise<Task[]> {
  const snap = await withTimeout(getDocs(sub(eventId, "tasks")), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
}
export async function deleteTask(eventId: string, taskId: string) {
  await withTimeout(deleteDoc(doc(db, "events", eventId, "tasks", taskId)), 10_000);
}

// ---- Shopping ----
export async function addShoppingItem(eventId: string, it: Omit<ShoppingItem, "id">) {
  await withTimeout(addDoc(sub(eventId, "shopping"), it), 10_000);
}
export async function updateShoppingItem(eventId: string, id: string, patch: Partial<ShoppingItem>) {
  await withTimeout(updateDoc(doc(db, "events", eventId, "shopping", id), patch), 10_000);
}
export async function getShopping(eventId: string): Promise<ShoppingItem[]> {
  const snap = await withTimeout(getDocs(sub(eventId, "shopping")), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingItem));
}
export async function deleteShoppingItem(eventId: string, itemId: string) {
  await withTimeout(deleteDoc(doc(db, "events", eventId, "shopping", itemId)), 10_000);
}

// ---- Notices ----
export async function addNotice(eventId: string, n: Omit<Notice, "id">) {
  await withTimeout(addDoc(sub(eventId, "notices"), n), 10_000);
}
export async function getNotices(eventId: string): Promise<Notice[]> {
  const q = query(sub(eventId, "notices"), orderBy("createdAt", "desc"));
  const snap = await withTimeout(getDocs(q), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
}
export async function deleteNotice(eventId: string, noticeId: string) {
  await withTimeout(deleteDoc(doc(db, "events", eventId, "notices", noticeId)), 10_000);
}

// ---- Gallery ----
export async function addPhoto(eventId: string, p: Omit<GalleryPhoto, "id">) {
  await withTimeout(addDoc(sub(eventId, "gallery"), p), 10_000);
}
export async function getGallery(eventId: string): Promise<GalleryPhoto[]> {
  const q = query(sub(eventId, "gallery"), orderBy("createdAt", "desc"));
  const snap = await withTimeout(getDocs(q), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto));
}
export async function deletePhoto(eventId: string, photoId: string) {
  // Try to delete the Storage file first
  try {
    const snap = await withTimeout(getDoc(doc(db, "events", eventId, "gallery", photoId)), 10_000);
    if (snap.exists()) {
      const data = snap.data() as { url?: string };
      if (data.url) {
        // Extract storage path from download URL
        const match = data.url.match(/\/o\/(.+?)\?/);
        if (match) {
          const path = decodeURIComponent(match[1]);
          await deleteObject(ref(storage, path)).catch(() => {});
        }
      }
    }
  } catch { /* best effort */ }
  await withTimeout(deleteDoc(doc(db, "events", eventId, "gallery", photoId)), 10_000);
}

// ---- Templates (shared library) ----
export async function addTemplate(t: Omit<EventTemplate, "id" | "createdAt">) {
  await withTimeout(addDoc(collection(db, "templates"), { ...t, createdAt: Date.now() }), 10_000);
}
export async function getTemplates(): Promise<EventTemplate[]> {
  const snap = await withTimeout(getDocs(collection(db, "templates")), 10_000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventTemplate);
}
export async function deleteTemplate(id: string) {
  await withTimeout(deleteDoc(doc(db, "templates", id)), 10_000);
}
export async function featureTemplate(id: string, featured: boolean) {
  await withTimeout(updateDoc(doc(db, "templates", id), { featured }), 10_000);
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
  await withTimeout(batch.commit(), 15_000);
}
