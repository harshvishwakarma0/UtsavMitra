import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addNotice, deleteNotice, getNotices } from "@/firebase/events";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { EventDoc, Notice } from "@/types";

export default function Notices() {
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(contextEvent || null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(!contextEvent);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (contextEvent) setEvent(contextEvent);
  }, [contextEvent]);

  async function load() {
    try {
      setLoading(true);
      const [noticesData, eventSnap] = await Promise.all([
        getNotices(eventId),
        !contextEvent ? getDoc(doc(db, "events", eventId)) : Promise.resolve(null),
      ]);
      setNotices(noticesData);
      if (!contextEvent && eventSnap?.exists()) {
        setEvent({ id: eventSnap.id, ...eventSnap.data() } as EventDoc);
      }
    } catch (e: any) {
      console.error("Failed to load notices:", e);
      setErr("Failed to load notices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const members = event?.members ?? [];
  const getMemberName = (uid: string) => members.find((m) => m.uid === uid)?.name || "Team Member";

  async function post() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await addNotice(eventId, {
        title: title.trim(),
        content: content.trim(),
        createdBy: profile.uid,
        createdAt: Date.now(),
      });
      setTitle("");
      setContent("");
      await load();
    } catch (e: any) {
      console.error("Failed to post notice:", e);
      setErr(e?.message ?? "Failed to post notice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(noticeId: string) {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      await deleteNotice(eventId, noticeId);
      await load();
    } catch (e: any) {
      console.error("Failed to delete notice:", e);
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
        <p className="text-center text-sm text-text-dim">Loading notices…</p>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-surface p-4 space-y-2">
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
