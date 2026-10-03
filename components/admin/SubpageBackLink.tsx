import Link from "next/link";

// The way back up from a section's sub-page (spa table map, treatments, tables) - always above the
// eyebrow, so it's in the same place on every one of them.
export default function SubpageBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-block text-sm text-cream/50 hover:text-coral transition-colors mb-3">
      ← {label}
    </Link>
  );
}
