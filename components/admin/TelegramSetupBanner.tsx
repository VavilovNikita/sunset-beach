import type { NotificationStatus } from "@/lib/types";

// Shown on the notification pages the moment they open (GET /notifications/status - the server's
// own configuration, no call to Telegram), so nobody finds out that nothing will arrive by waiting
// for a message. Same idea as LightingSetupBanner / GymSetupBanner. `status` null means the status
// itself could not be read, which is not the same as "not configured" and is said so.
export default function TelegramSetupBanner({ status, isAdmin }: { status: NotificationStatus | null; isAdmin: boolean }) {
  if (status === null) {
    return (
      <div role="status" className="mb-6 max-w-3xl rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
        <p className="font-medium">Could not read the notification status</p>
        <p className="mt-1 text-amber-400/90">Reload the page. Until it loads, nothing here says whether Telegram works.</p>
      </div>
    );
  }
  if (!status.telegramConfigured) {
    return (
      <div role="status" className="mb-6 max-w-3xl rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
        <p className="font-medium">Telegram is not configured</p>
        <p className="mt-1 text-amber-400/90">
          {isAdmin
            ? "The server has no bot token: put TELEGRAM_BOT_TOKEN into the backend settings and restart it (see DEPLOY.md, “Staff notifications”). Until then nothing is sent, chats can't be linked, and messages wait in the log."
            : "Ask an administrator to set it up. Until then nothing is sent and chats can't be linked."}
        </p>
      </div>
    );
  }
  if (!status.botUsername) {
    return (
      <div role="status" className="mb-6 max-w-3xl rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
        <p className="font-medium">The Telegram bot is not reachable yet</p>
        <p className="mt-1 text-amber-400/90">
          The server asks Telegram for the bot's name when it starts and keeps asking. Reload in a moment; if this stays,
          {isAdmin ? " check the token and that the server can reach api.telegram.org." : " tell an administrator."}
        </p>
      </div>
    );
  }
  return null;
}
