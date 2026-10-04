// The visitor's address, passed on to sunset so its per-address rate limits (staff and guest
// login, guest-account emails, the public quote and booking request) count each visitor
// separately. Every call from this Next.js server reaches sunset from the server's own address,
// so without this, every visitor shares one bucket: one password-guessing run, or one busy hour
// of booking requests, locks everyone else out.
//
// Only X-Real-IP is read, and only because the host nginx sets it - overwritten, never appended
// to - on every route into this app. Behind Cloudflare that must be
// `proxy_set_header X-Real-IP $http_cf_connecting_ip;`, not `$remote_addr` (the Cloudflare edge,
// which would put every visitor back in a handful of shared buckets) and never anything built from
// the incoming X-Forwarded-For (the visitor can write that header). Sent on as X-Forwarded-For,
// which is what sunset's ClientIpResolver reads. Absent (local dev, no nginx): nothing is
// forwarded and sunset falls back to the connection's own address.
export function forwardedIpHeaders(incoming: Pick<Headers, "get">): Record<string, string> {
  const ip = incoming.get("x-real-ip")?.trim();
  return ip ? { "X-Forwarded-For": ip } : {};
}
