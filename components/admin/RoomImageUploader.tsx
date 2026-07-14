"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function RoomImageUploader({
  roomId,
  images,
}: {
  roomId: string;
  images: string[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));

    const res = await fetch(`/api/rooms/${roomId}/images`, { method: "POST", body: formData });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Upload failed.");
      return;
    }
    router.refresh();
  }

  async function handleRemove(imagePath: string) {
    setRemoving(imagePath);
    setError(null);

    const res = await fetch(`/api/rooms/${roomId}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: imagePath }),
    });

    setRemoving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not remove photo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <label className="eyebrow text-cream/60 block mb-2">Photos</label>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
        {images.map((src) => (
          <div key={src} className="relative aspect-[4/3] rounded-lg overflow-hidden group">
            <Image src={src} alt="" fill sizes="150px" className="object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(src)}
              disabled={removing === src}
              className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-cream disabled:opacity-100"
            >
              {removing === src ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}
        {images.length === 0 && <p className="col-span-full text-sm text-cream/50">No photos yet.</p>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleUpload}
        disabled={uploading}
        className="text-sm text-cream/70 file:mr-3 file:rounded-full file:border-0 file:bg-coral file:text-cream file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-coraldeep file:cursor-pointer"
      />
      {uploading && <p className="text-sm text-cream/50 mt-2">Uploading…</p>}
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}
