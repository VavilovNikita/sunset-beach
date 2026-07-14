export default function SunsetScene() {
  return (
    <svg
      viewBox="0 0 1200 640"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F262B" />
          <stop offset="55%" stopColor="#1C3D45" />
          <stop offset="78%" stopColor="#A83D1D" />
          <stop offset="100%" stopColor="#E2612F" />
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3ECDA" />
          <stop offset="100%" stopColor="#E2612F" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1D21" />
          <stop offset="100%" stopColor="#0F262B" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="460" fill="url(#sky)" />
      <circle cx="600" cy="440" r="130" fill="url(#sun)" opacity="0.92" />
      <rect x="0" y="460" width="1200" height="180" fill="url(#sea)" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={600 - 90 + i * 6}
          y={468 + i * 14}
          width={180 - i * 12}
          height="4"
          fill="#E2612F"
          opacity={0.5 - i * 0.07}
        />
      ))}
      <line x1="0" y1="460" x2="1200" y2="460" stroke="#F3ECDA" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}
