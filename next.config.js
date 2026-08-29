// Content-Security-Policy: 'unsafe-inline' on script-src/style-src is a real gap, not an
// oversight - the App Router injects inline <script> tags for RSC streaming hydration
// (self.__next_f.push(...)) and next/font emits inline @font-face <style> blocks, and neither
// is nonce-tagged in this app. A strict script-src without 'unsafe-inline' would break every
// page's hydration. Closing that gap for real means adding per-request nonces (generated in
// middleware, threaded through to Next's <Script nonce=...> and the CSP header together) - a
// bigger change than adding headers, left as a follow-up. Everything else below is strict:
// no framing, no plugins/objects, no cross-origin form posts, images/connections same-origin only.
// 'unsafe-eval' is additionally needed in development only: next dev's webpack HMR loads
// module chunks via eval(), which a production build never does - verified by hand (Playwright
// against `next build` + `next start`: zero CSP console errors on / and /admin/login) that
// production does not need it. Restricting it to dev keeps the real deployment's policy strict
// without breaking `npm run dev` locally.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Belt-and-suspenders with frame-ancestors above for browsers that predate CSP3's
          // frame-ancestors support - this is what actually closes the clickjacking gap found
          // in the audit (the admin panel had no framing protection at all before this).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No-op until the deployment actually terminates TLS (see nginx/conf.d/app.conf,
          // currently plain HTTP on 8888) - browsers ignore HSTS on a plaintext response
          // entirely. Left in now so it takes effect the moment HTTPS is turned on, instead of
          // being one more thing to remember to add later.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
