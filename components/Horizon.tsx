export default function Horizon({ label }: { label?: string }) {
  return (
    <div className="relative py-10 flex items-center justify-center" aria-hidden={label ? undefined : true}>
      <div className="horizon-line h-px w-full absolute top-1/2 -translate-y-1/2" />
      {label ? (
        <span className="relative bg-ink px-6 eyebrow text-sea">{label}</span>
      ) : (
        <span className="relative w-2 h-2 rounded-full bg-coral shadow-[0_0_16px_4px_rgba(226,97,47,0.55)]" />
      )}
    </div>
  );
}
