import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { deletePhoto } from "@/firebase/events";
import { collection, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase/config";
import { withTimeout } from "@/firebase/timeout";
import type { GalleryPhoto } from "@/types";

export default function Gallery() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<GalleryPhoto | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr("");
    return onSnapshot(
      query(collection(db, "events", eventId, "gallery"), orderBy("createdAt", "desc")),
      (snap) => {
        setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GalleryPhoto));
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load gallery:", error);
        setErr("Failed to load photos.");
        setLoading(false);
      }
    );
  }, [eventId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setBusy(true);
    setErr("");
    let uploadedRef: ReturnType<typeof ref> | undefined;
    let newPhoto: GalleryPhoto | undefined;
    try {
      const resized = await resizeImage(file, 1024);
      const path = `events/${eventId}/gallery/${Date.now()}_${file.name}`;
      uploadedRef = ref(storage, path);
      await uploadBytes(uploadedRef, resized);
      const url = await getDownloadURL(uploadedRef);
      const photoRef = doc(collection(db, "events", eventId, "gallery"));
      newPhoto = { id: photoRef.id, url, uploadedBy: profile.uid, createdAt: Date.now() };
      setPhotos((previous) => [newPhoto!, ...previous]);
      const { id: _id, ...photoData } = newPhoto;
      await withTimeout(setDoc(photoRef, photoData), 10_000);
    } catch (e: any) {
      console.error("Upload error:", e);
      if (newPhoto) setPhotos((previous) => previous.filter((photo) => photo.id !== newPhoto!.id));
      if (uploadedRef) await deleteObject(uploadedRef).catch(() => {});
      setErr(e?.message ?? "Failed to upload photo.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleDelete(photoId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this photo?")) return;
    const deletedIndex = photos.findIndex((photo) => photo.id === photoId);
    const deletedPhoto = photos[deletedIndex];
    if (!deletedPhoto) return;
    setPhotos((previous) => previous.filter((photo) => photo.id !== photoId));
    try {
      await deletePhoto(eventId, photoId);
      if (previewPhoto?.id === photoId) setPreviewPhoto(null);
    } catch (e: any) {
      console.error("Failed to delete photo:", e);
      setPhotos((previous) => {
        if (previous.some((photo) => photo.id === deletedPhoto.id)) return previous;
        const next = [...previous];
        next.splice(deletedIndex, 0, deletedPhoto);
        return next;
      });
      setErr("Failed to delete photo.");
    }
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Gallery</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <label className="block cursor-pointer rounded-xl bg-primary p-3 text-center font-semibold text-black hover:opacity-90">
        {busy ? "Uploading…" : "+ Add Photo"}
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={onFile} />
      </label>

      {loading && photos.length === 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="aspect-square" />
          <Skeleton className="aspect-square" />
          <Skeleton className="aspect-square" />
          <Skeleton className="aspect-square" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              onClick={() => setPreviewPhoto(p)}
              className="animate-fade-in group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface"
            >
              <img
                src={p.url}
                alt={p.caption || "Festival Photo"}
                className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
              />
              {profile?.uid === p.uploadedBy && (
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1.5 text-xs text-white hover:bg-danger"
                  title="Delete Photo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {photos.length === 0 && <p className="col-span-2 text-center text-text-dim">No photos yet.</p>}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewPhoto.url}
              alt="Photo preview"
              className="max-h-[80vh] rounded-xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 rounded-full bg-surface-2 p-2 text-text hover:bg-danger hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function resizeImage(file: File, max: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(img.width * scale));
      canvas.height = Math.max(1, Math.floor(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context creation failed"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => {
        if (!b) reject(new Error("Failed to process image blob"));
        else resolve(b);
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image file"));
    };
    img.src = objectUrl;
  });
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
