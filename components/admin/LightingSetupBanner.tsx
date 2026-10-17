// Shown on both Lighting pages the moment they open when the server has no LIGHTING_ALLOWED_CIDRS
// (GET /lighting/status - the server's own configuration, no call to a controller), so nobody finds
// out by pressing a switch. The admin version says what to set.
export default function LightingSetupBanner({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div role="status" className="mb-6 max-w-3xl rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
      <p className="font-medium">Lighting is not configured on the server</p>
      <p className="mt-1 text-amber-400/90">
        {isAdmin
          ? "The server's allowed subnet must be set: put the hotel network the controllers are on into LIGHTING_ALLOWED_CIDRS in the backend settings and restart it (see DEPLOY.md, “Lighting”). Until then controllers can't be added, checked or controlled; the ones already saved can still be renamed, hidden, reordered and deleted."
          : "Ask an administrator to set it up. Until then the lights can't be read or controlled."}
      </p>
    </div>
  );
}
