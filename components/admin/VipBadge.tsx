// Shown wherever a guest appears in a list or header, so staff scanning a screen see the flag
// without opening the guest card. Renders nothing for a non-VIP guest.
export default function VipBadge({ vip }: { vip: boolean }) {
  if (!vip) return null;
  return <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-coral/15 text-coral shrink-0">VIP</span>;
}
