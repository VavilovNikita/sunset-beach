import Image from "next/image";

const icons: Record<string, JSX.Element> = {
  villa: (
    <path d="M6 26 L24 12 L42 26 M10 26 V38 H38 V26 M20 38 V28 H28 V38" />
  ),
  pool: (
    <path d="M4 30 Q10 26 16 30 T28 30 T40 30 T44 30 M8 22 H40 V10 H8 Z" />
  ),
  wave: (
    <path d="M2 20 Q9 12 16 20 T30 20 T44 20 M2 30 Q9 22 16 30 T30 30 T44 30" />
  ),
  leaf: (
    <path d="M24 4 C10 10 8 26 24 44 C40 26 38 10 24 4 Z M24 4 V44" />
  ),
  spa: (
    <path d="M24 4 C24 16 34 18 34 28 A10 10 0 1 1 14 28 C14 18 24 16 24 4 Z" />
  ),
  table: (
    <path d="M4 16 H44 M8 16 V40 M40 16 V40 M14 8 L18 16 M34 8 L30 16" />
  ),
};

export default function ArtBlock({
  variant = "wave",
  label,
  tone = "warm",
  className = "",
  src,
  alt = "",
  priority = false,
}: {
  variant?: keyof typeof icons;
  label?: string;
  tone?: "warm" | "deep" | "sand";
  className?: string;
  src?: string;
  alt?: string;
  priority?: boolean;
}) {
  const bg =
    tone === "warm"
      ? "from-coraldeep via-coral to-[#F0A26B]"
      : tone === "sand"
      ? "from-sand2 via-sand to-cream"
      : "from-ink via-ink3 to-sea";

  const iconColor = tone === "sand" ? "text-ink/50" : "text-cream/60";

  if (src) {
    return (
      <div className={`relative overflow-hidden rounded-xl aspect-[4/3] ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
          priority={priority}
        />
        {label && (
          <span className="absolute bottom-3 left-3 eyebrow text-cream/80 bg-ink/40 backdrop-blur-sm px-2 py-1 rounded">
            {label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${bg} aspect-[4/3] ${className}`}>
      <svg viewBox="0 0 48 48" className={`absolute inset-0 m-auto w-16 h-16 ${iconColor}`} fill="none" stroke="currentColor" strokeWidth="1.3">
        {icons[variant]}
      </svg>
      {label && (
        <span className="absolute bottom-3 left-3 eyebrow text-cream/80 bg-ink/30 backdrop-blur-sm px-2 py-1 rounded">
          {label}
        </span>
      )}
    </div>
  );
}
