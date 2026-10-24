// The backend path a proxy route forwards to, built from Next's catch-all segments.
//
// Next hands the segments over already decoded, so `/api/guest-proxy/..%2F..%2Fbookings%2Fx%2Ffolio`
// arrives as one segment `../../bookings/x/folio`; joined into a URL as is, fetch() resolves the
// dots and the request leaves /guest/ (with the guest's token) or the public allowlist's path.
// A segment that is empty, a dot segment, or carries a slash or backslash is refused (null), and
// every other one is percent-encoded, so what the backend receives is exactly the segments the
// rule checked.
export function proxyPath(segments: string[]): string | null {
  for (const s of segments) {
    if (s === "" || s === "." || s === ".." || s.includes("/") || s.includes("\\")) return null;
  }
  return segments.map(encodeURIComponent).join("/");
}
