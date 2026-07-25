import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { withTimeout } from "@/firebase/timeout";
import type { EventDoc, Notice } from "@/types";

export default function Notices() {
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setErr("");
    return onSnapshot(
      query(collection(db, "events", eventId, "notices"), orderBy("createdAt", "desc")),
      (snap) => {
        setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notice));
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load notices:", error);
        setErr("Failed to load notices.");
        setLoading(false);
      }
    );
  }, [eventId]);

  const members = contextEvent?.members ?? [];
  const getMemberName = (uid: string) => members.find((m) => m.uid === uid)?.name || "Team Member";

  async function post() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    setErr("");
    const noticeRef = doc(collection(db, "events", eventId, "notices"));
    const newNotice: Notice = {
      id: noticeRef.id,
      title: title.trim(),
      content: content.trim(),
      createdBy: profile.uid,
      createdAt: Date.now(),
    };
    setNotices((previous) => [newNotice, ...previous]);
    try {
      const { id: _id, ...noticeData } = newNotice;
      await withTimeout(setDoc(noticeRef, noticeData), 10_000);
      setTitle("");
      setContent("");
    } catch (e: any) {
      console.error("Failed to post notice:", e);
      setNotices((previous) => previous.filter((notice) => notice.id !== newNotice.id));
      setErr(e?.message ?? "Failed to post notice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(noticeId: string) {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    const deletedIndex = notices.findIndex((notice) => notice.id === noticeId);
    const deletedNotice = notices[deletedIndex];
    if (!deletedNotice) return;
    setNotices((previous) => previous.filter((notice) => notice.id !== noticeId));
    try {
      await withTimeout(deleteDoc(doc(db, "events", eventId, "notices", noticeId)), 10_000);
    } catch (e: any) {
      console.error("Failed to delete notice:", e);
      setNotices((previous) => {
        if (previous.some((notice) => notice.id === deletedNotice.id)) return previous;
        const next = [...previous];
        next.splice(deletedIndex, 0, deletedNotice);
        return next;
      });
      setErr("Failed to delete notice.");
    }
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Notices</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="Notice title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text min-h-[80px]"
          placeholder="Notice message details..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          onClick={post}
          disabled={busy}
          className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Posting..." : "Post Notice"}
        </button>
      </div>

      {loading && notices.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="animate-fade-in rounded-xl border border-border bg-surface p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-text text-base">{n.title}</h2>
                {profile?.uid === n.createdBy && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-1 text-xs text-text-dim hover:text-danger"
                    title="Delete Notice"
                  >
                    ✕
                  </button>
                )}
              </div>
              {n.content && <p className="text-sm text-text-dim whitespace-pre-wrap">{n.content}</p>}
              <div className="text-xs text-text-dim border-t border-border/50 pt-2 flex items-center justify-between">
                <span>📢 {getMemberName(n.createdBy)}</span>
                <span>{new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))}
          {notices.length === 0 && <p className="text-center text-text-dim">No notices posted yet.</p>}
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
