import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addPhoto, getGallery } from "@/firebase/events";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/config";
import type { GalleryPhoto } from "@/types";

export default function Gallery() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setPhotos(await getGallery(eventId));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setBusy(true);
    const resized = await resizeImage(file, 1024);
    const path = `events/${eventId}/gallery/${Date.now()}_${file.name}`;
    await uploadBytes(ref(storage, path), resized);
    const url = await getDownloadURL(ref(storage, path));
    await addPhoto(eventId, { url, uploadedBy: profile.uid, createdAt: Date.now() });
    setBusy(false);
    load();
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Gallery</h1>
      <label className="block rounded-xl bg-primary p-3 text-center font-semibold text-black">
        {busy ? "Uploading…" : "+ Add Photo"}
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <img key={p.id} src={p.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
        ))}
        {photos.length === 0 && <p className="text-text-dim col-span-2 text-center">No photos yet.</p>}
      </div>
    </div>
  );
}

function resizeImage(file: File, max: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}
