import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { cn } from "@/lib/utils";
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
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeUid, setAssigneeUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setErr("");
    return onSnapshot(
      query(collection(db, "events", eventId, "tasks"), orderBy("createdAt", "desc")),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task));
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load tasks:", error);
        setErr("Failed to load tasks.");
        setLoading(false);
      }
    );
  }, [eventId]);

  const members = contextEvent?.members ?? [];

  async function add() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    setErr("");
    const taskRef = doc(collection(db, "events", eventId, "tasks"));
    const newTask: Task = {
      id: taskRef.id,
      title: title.trim(),
      status: "pending",
      priority,
      assignedTo: assigneeUid || profile.uid,
      createdAt: Date.now(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(deadline.trim() ? { deadline: deadline.trim() } : {}),
    };
    setTasks((previous) => [newTask, ...previous]);
    try {
      const { id: _id, ...taskData } = newTask;
      await setDoc(taskRef, taskData);
      setTitle("");
      setDescription("");
      setDeadline("");
      setAssigneeUid("");
    } catch (e: any) {
      console.error("Failed to add task:", e);
      setTasks((previous) => previous.filter((task) => task.id !== newTask.id));
      setErr(e?.message ?? "Failed to add task.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(t: Task, status: TaskStatus) {
    const previousStatus = t.status;
    setTasks((previous) => previous.map((task) => (task.id === t.id ? { ...task, status } : task)));
    try {
      await updateDoc(doc(db, "events", eventId, "tasks", t.id), { status });
    } catch (e: any) {
      console.error("Failed to update task status:", e);
      setTasks((previous) =>
        previous.map((task) => (task.id === t.id ? { ...task, status: previousStatus } : task))
      );
      setErr("Failed to update status.");
    }
  }

  async function handleDrop(e: React.DragEvent, colStatus: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== colStatus) {
      await setStatus(task, colStatus);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Delete this task?")) return;
    const deletedIndex = tasks.findIndex((task) => task.id === taskId);
    const deletedTask = tasks[deletedIndex];
    if (!deletedTask) return;
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    try {
      await deleteDoc(doc(db, "events", eventId, "tasks", taskId));
    } catch (e: any) {
      console.error("Failed to delete task:", e);
      setTasks((previous) => {
        if (previous.some((task) => task.id === deletedTask.id)) return previous;
        const next = [...previous];
        next.splice(deletedIndex, 0, deletedTask);
        return next;
      });
      setErr("Failed to delete task.");
    }
  }

  const getAssigneeName = (uid?: string) =>
    members.find((m) => m.uid === uid)?.name || (uid === profile?.uid ? "You" : "Unassigned");

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Task Kanban Board</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text text-sm min-h-[60px]"
          placeholder="Task details/description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <input
            type="date"
            className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-sm text-text"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((column) => (
            <div key={column.status} className="space-y-3 rounded-xl border border-border bg-surface p-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-28" />
              <Skeleton className="h-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.status)}
                className="space-y-2 rounded-xl border border-border bg-surface p-3 min-h-[200px]"
              >
                <div className="flex items-center justify-between border-b border-border pb-2 text-sm font-semibold text-text-dim">
                  <span>{col.label}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{colTasks.length}</span>
                </div>

                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                      className={cn(
                        "animate-fade-in cursor-grab active:cursor-grabbing rounded-lg border border-border bg-surface-2 p-3.5 space-y-2 transition-all hover:border-primary/40",
                        t.status === "done" && "opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priColor[t.priority]}`}
                            title={`${t.priority} priority`}
                          />
                          <div className="space-y-1 flex-1">
                            <span
                              className={`text-sm font-medium leading-tight text-text break-words block ${
                                t.status === "done" ? "line-through text-text-dim" : ""
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.description && (
                              <p className="text-xs text-text-dim line-clamp-2">{t.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="shrink-0 p-1 text-xs text-text-dim hover:text-danger"
                          title="Delete Task"
                        >
                          ✕
                        </button>
                      </div>

                      {t.deadline && (
                        <div className="text-[11px] text-primary bg-primary/10 rounded px-1.5 py-0.5 inline-block font-mono">
                          📅 {new Date(t.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 text-xs text-text-dim pt-1 border-t border-border/40">
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
                    <p className="py-6 text-center text-xs text-text-dim border border-dashed border-border/50 rounded-lg">
                      Drag or move tasks here
                    </p>
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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
