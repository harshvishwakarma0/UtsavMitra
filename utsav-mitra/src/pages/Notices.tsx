import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addNotice, getNotices } from "@/firebase/events";
import type { Notice } from "@/types";

export default function Notices() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function load() {
    setNotices(await getNotices(eventId));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function post() {
    if (!profile || !title.trim()) return;
    await addNotice(eventId, {
      title: title.trim(),
      content: content.trim(),
      createdBy: profile.uid,
      createdAt: Date.now(),
    });
    setTitle("");
    setContent("");
    load();
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Notices</h1>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Message" value={content} onChange={(e) => setContent(e.target.value)} />
        <button onClick={post} className="w-full rounded-lg bg-primary p-2 font-semibold text-black">Post Notice</button>
      </div>

      <div className="space-y-2">
        {notices.map((n) => (
          <div key={n.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="font-semibold">{n.title}</div>
            <div className="text-sm text-text-dim">{n.content}</div>
          </div>
        ))}
        {notices.length === 0 && <p className="text-text-dim">No notices yet.</p>}
      </div>
    </div>
  );
}
