// A small note icon for a booking that has staff notes; the notes themselves are in the title (hover / long-press).
// A shape, not a colour - the palette is full. Renders nothing when there are no notes.
export default function NotesBadge({ notes }: { notes: string | null | undefined }) {
  if (!notes || !notes.trim()) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md border border-cream/40 text-cream/80 w-6 h-6 shrink-0"
      title={`Notes: ${notes}`}
      aria-label={`Notes: ${notes}`}
      role="img"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M3 2.5h10v8.5H8.5L5.5 13.5V11H3z" strokeLinejoin="round" />
        <path d="M5.5 5.5h5M5.5 8h3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
