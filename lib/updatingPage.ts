// The standalone "we're updating" page: what middleware answers with while the backend is down,
// and - byte for byte, enforced by updatingPage.test.ts - nginx/updating.html, which the host's
// nginx serves when this whole app is down too (see nginx/conf.d/app.conf). Self-contained on
// purpose: no scripts, fonts or images that could themselves fail to load mid-deploy. The browser
// retries by itself every 5 seconds via the meta refresh.
export const UPDATING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>Updating - The Sunset Beach Resort &amp; Spa</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0F262B; color: #FBF6EC; font-family: system-ui, sans-serif; text-align: center; }
  main { padding: 24px; max-width: 28rem; }
  .spinner { width: 36px; height: 36px; margin: 0 auto 24px; border: 3px solid rgba(251, 246, 236, 0.25); border-top-color: #FBF6EC; border-radius: 50%; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 12px; }
  p { margin: 0; opacity: 0.7; line-height: 1.5; }
</style>
</head>
<body>
<main>
<div class="spinner" role="status" aria-label="Loading"></div>
<h1>Updating&hellip;</h1>
<p>We&rsquo;re installing an update. This page will reload automatically in a moment &mdash; usually under a minute.</p>
</main>
</body>
</html>
`;

export function updatingResponse(): Response {
  return new Response(UPDATING_HTML, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "5", "Cache-Control": "no-store" },
  });
}
