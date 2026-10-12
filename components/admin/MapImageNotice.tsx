import { mapImageNotice, type MapImageState } from "@/lib/mapImageFallback";

// The notice above a map screen's fallback grid - see lib/mapImageFallback.ts. A missing recorded
// plan is loud (it is a fault somebody has to fix by uploading again); "never uploaded" is calm.
export default function MapImageNotice({ state, canUpload, what }: { state: MapImageState; canUpload: boolean; what: string }) {
  const notice = mapImageNotice(state, canUpload, what);
  if (!notice) return null;
  return notice.tone === "error" ? (
    <p role="alert" className="text-sm text-coral bg-coral/10 border border-coral/40 rounded-xl px-4 py-3">
      {notice.text}
    </p>
  ) : (
    <p className="text-sm text-cream/60 border border-dashed border-cream/20 rounded-xl px-4 py-3">{notice.text}</p>
  );
}
