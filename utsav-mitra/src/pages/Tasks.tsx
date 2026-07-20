import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addTask, deleteTask, getTasks, updateTask } from "@/firebase/events";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { EventDoc, Task, TaskStatus, TaskPriority } from "@/types";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "in-progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

const priColor: Record<TaskPriority, string> = {
  low: "bg-surface-2",
  medium: "bg-primary-dim",
  high: "bg-danger",
};

export default function Tasks() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeUid, setAssigneeUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      const e = await getDoc(doc(db, "events", eventId));
      if (e.exists()) setEvent({ id: e.id, ...e.data() } as EventDoc);
      setTasks(await getTasks(eventId));
    } catch (e: any) {
      console.error("Failed to load tasks:", e);
      setErr("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const members = event?.members ?? [];

  async function add() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await addTask(eventId, {
        title: title.trim(),
        status: "pending",
        priority,
        assignedTo: assigneeUid || profile.uid,
        createdAt: Date.now(),
      });
      setTitle("");
      setAssigneeUid("");
      await load();
    } catch (e: any) {
      console.error("Failed to add task:", e);
      setErr(e?.message ?? "Failed to add task.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(t: Task, status: TaskStatus) {
    try {
      await updateTask(eventId, t.id, { status });
      await load();
    } catch (e: any) {
      console.error("Failed to update task status:", e);
      setErr("Failed to update status.");
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask(eventId, taskId);
      await load();
    } catch (e: any) {
      console.error("Failed to delete task:", e);
      setErr("Failed to delete task.");
    }
  }

  const getAssigneeName = (uid?: string) =>
    members.find((m) => m.uid === uid)?.name || (uid === profile?.uid ? "You" : "Unassigned");

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Tasks</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-sm text-text"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Med Priority</option>
            <option value="high">High Priority</option>
          </select>
          <select
            className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-sm text-text"
            value={assigneeUid}
            onChange={(e) => setAssigneeUid(e.target.value)}
          >
            <option value="">Assign To...</option>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={add}
          disabled={busy}
          className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Adding..." : "+ Add Task"}
        </button>
      </div>

      {loading && tasks.length === 0 ? (
        <p className="text-center text-sm text-text-dim">Loading tasks…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between border-b border-border pb-2 text-sm font-semibold text-text-dim">
                  <span>{col.label}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{colTasks.length}</span>
                </div>

                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border border-border bg-surface-2 p-3.5 space-y-2 transition-all ${
                        t.status === "done" ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priColor[t.priority]}`}
                            title={`${t.priority} priority`}
                          />
                          <span
                            className={`text-sm font-medium leading-tight text-text break-words ${
                              t.status === "done" ? "line-through text-text-dim" : ""
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="shrink-0 p-1 text-xs text-text-dim hover:text-danger"
                          title="Delete Task"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-text-dim">
                        <span className="truncate">👤 {getAssigneeName(t.assignedTo)}</span>
                        <select
                          className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-text"
                          value={t.status}
                          onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                        >
                          {columns.map((c) => (
                            <option key={c.status} value={c.status}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <p className="py-2 text-center text-xs text-text-dim">No {col.label.toLowerCase()} tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
