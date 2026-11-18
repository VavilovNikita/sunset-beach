import { DEFAULT_CHART_BOX, axisTicks, barLayout, lineLayout, polylinePoints, type ChartBox } from "@/lib/bookingTracker";

// Plain SVG bars and lines for the booking tracker - the project has no chart library on purpose. Every number drawn is
// the server's; the geometry (scale, positions) is lib/bookingTracker.ts and tested there. One series per chart, in one
// neutral tone: the colour palette is full, so nothing here repurposes a status colour (bars are told apart by their
// labels and by the figure printed on top, lines by their dots).

type ChartProps = {
  title: string;
  // One entry per category: its label, its value (server number or decimal string) and the text to print for it.
  items: { label: string; value: number | string; text: string }[];
  // The axis unit, e.g. "Room nights" or "Baht", shown in the caption and read out to screen readers.
  unit: string;
  // How a tick is printed (the axis is a scale, not a figure from the server).
  tick?: (value: number) => string;
  box?: ChartBox;
};

const defaultTick = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function Axis({ box, top, tick }: { box: ChartBox; top: number; tick: (v: number) => string }) {
  const plotH = box.height - box.top - box.bottom;
  return (
    <g>
      {axisTicks(top).map((t) => {
        const y = box.top + plotH - (t / top) * plotH;
        return (
          <g key={t}>
            <line x1={box.left} x2={box.width - box.right} y1={y} y2={y} className="stroke-cream/10" strokeWidth={1} />
            <text x={box.left - 6} y={y + 3} textAnchor="end" className="fill-cream/50" fontSize={10}>
              {tick(t)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Frame({ title, unit, children, box }: { title: string; unit: string; children: React.ReactNode; box: ChartBox }) {
  return (
    <figure className="border border-cream/10 rounded-xl p-3 bg-ink2/30">
      <figcaption className="text-xs text-cream/60 mb-2">
        {title} <span className="text-cream/40">({unit})</span>
      </figcaption>
      <svg viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label={`${title}, ${unit}`} className="w-full h-auto">
        <title>{title}</title>
        {children}
      </svg>
    </figure>
  );
}

// Long labels are cut for the axis; the full one is the bar's tooltip and the table beside the chart has it too.
function shortLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 11)}…` : label;
}

export function BarChart({ title, items, unit, tick = defaultTick, box = DEFAULT_CHART_BOX }: ChartProps) {
  const { top, bars } = barLayout(items.map((i) => i.value), box);
  const slot = items.length > 0 ? (box.width - box.left - box.right) / items.length : 0;
  return (
    <Frame title={title} unit={unit} box={box}>
      <Axis box={box} top={top} tick={tick} />
      {items.map((item, i) => {
        const bar = bars[i];
        return (
          <g key={`${item.label}-${i}`}>
            <title>{`${item.label}: ${item.text}`}</title>
            <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} className="fill-cream/45" rx={2} />
            {bar.height > 0 && (
              <text x={bar.x + bar.width / 2} y={bar.y - 3} textAnchor="middle" className="fill-cream/70" fontSize={9}>
                {item.text}
              </text>
            )}
            <text x={box.left + slot * i + slot / 2} y={box.height - box.bottom + 14} textAnchor="middle" className="fill-cream/60" fontSize={10}>
              {shortLabel(item.label)}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

export function LineChart({ title, items, unit, tick = defaultTick, box = DEFAULT_CHART_BOX }: ChartProps) {
  const { top, points } = lineLayout(items.map((i) => i.value), box);
  // Print a label under every other point once there are many, so they don't run into each other.
  const every = items.length > 8 ? 2 : 1;
  return (
    <Frame title={title} unit={unit} box={box}>
      <Axis box={box} top={top} tick={tick} />
      <polyline points={polylinePoints(points)} fill="none" className="stroke-cream/70" strokeWidth={1.5} />
      {items.map((item, i) => (
        <g key={`${item.label}-${i}`}>
          <title>{`${item.label}: ${item.text}`}</title>
          <circle cx={points[i].x} cy={points[i].y} r={3} className="fill-ink stroke-cream/80" strokeWidth={1.5} />
          {i % every === 0 && (
            <text x={points[i].x} y={box.height - box.bottom + 14} textAnchor="middle" className="fill-cream/60" fontSize={10}>
              {shortLabel(item.label)}
            </text>
          )}
        </g>
      ))}
    </Frame>
  );
}
