// Paths on this domain that nginx serves itself, outside the Next.js app (the staff manual,
// /manual/, from the sunset-manual repo). The client router can't navigate to them - a soft
// navigation would ask Next.js for a page that doesn't exist - so they need a full page load.
const STATIC_PREFIXES = ["/manual"];

export function isOutsideApp(path: string): boolean {
  return STATIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`) || path.startsWith(`${p}#`));
}

export const STAFF_MANUAL_HREF = "/manual/";
