"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL, resolveImageUrl } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

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

    const res = await fetch(`${ADMIN_API_URL}/rooms/${roomId}/images`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Upload failed."));
      return;
    }
    router.refresh();
  }

  async function handleRemove(imagePath: string) {
    if (!window.confirm("Remove this photo from the room? This can't be undone.")) return;
    setRemoving(imagePath);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/rooms/${roomId}/images`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: imagePath }),
    });

    setRemoving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not remove photo."));
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <label className="eyebrow text-cream/60 block mb-2">Photos</label>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
        {images.map((src) => (
          <div key={src} className="relative aspect-[4/3] rounded-lg overflow-hidden">
            <Image
              src={resolveImageUrl(src)!}
              alt=""
              fill
              sizes="150px"
              className="object-cover"
              unoptimized={src.startsWith("/uploads/")}
            />
            {/* Always visible and corner-sized, never a hover-revealed overlay across the whole
                thumbnail: a touch screen has no hover, so an invisible full-size Remove button
                made the first tap anywhere on a photo delete it. The confirm in handleRemove is
                the second guard. */}
            <button
              type="button"
              onClick={() => handleRemove(src)}
              disabled={removing === src}
              aria-label="Remove photo"
              title="Remove photo"
              className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center rounded-full bg-ink/75 text-cream hover:bg-coral transition-colors disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {removing === src && (
              <div className="absolute inset-0 bg-ink/70 flex items-center justify-center text-xs text-cream pointer-events-none">
                Removing…
              </div>
            )}
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
