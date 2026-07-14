export default function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <p className="eyebrow text-cream/50">{label}</p>
      <p className="mt-2 font-display italic text-3xl text-coral">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-cream/40">{sublabel}</p>}
    </div>
  );
}
