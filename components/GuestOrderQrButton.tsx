"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Rendered by the order ticket (components/OrderTicket.tsx), which both POS surfaces share. It
// holds no fetch/auth logic at all: given an orderId and the order's own guestAccessToken, it
// renders a button, a QR code, and a print button.
//
// The QR encodes {site origin}/order/{orderId}?t={guestAccessToken} - the same guest ordering
// page and token this app's own /order/[orderId] route reads (see GuestOrderClient.tsx). Printed
// via the browser's own window.print(), isolated from the rest of the page by the
// body.qr-print-mode rule in app/globals.css (toggled on/off with this modal, see the effect
// below) rather than a print:hidden/print:block pass over the whole ticket screen.
export default function GuestOrderQrButton({
  orderId,
  guestAccessToken,
  buttonClassName,
}: {
  orderId: string;
  guestAccessToken: string | null;
  buttonClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderUrl, setOrderUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("qr-print-mode");
    return () => document.body.classList.remove("qr-print-mode");
  }, [open]);

  // guestAccessToken is null only for an order created before this field existed (see
  // Order.guestAccessToken's own comment in lib/posTypes.ts) - there's no code to regenerate one
  // after the fact, so the button is simply hidden rather than opening a modal that can never
  // produce a working code.
  if (!guestAccessToken) return null;

  async function handleOpen() {
    setError(null);
    const url = `${window.location.origin}/order/${orderId}?t=${encodeURIComponent(guestAccessToken as string)}`;
    setOrderUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2 });
      setQrDataUrl(dataUrl);
      setOpen(true);
    } catch {
      setError("Could not generate the QR code — try again.");
    }
  }

  return (
    <div>
      <button type="button" onClick={handleOpen} className={buttonClassName}>
        Print QR
      </button>
      {error && <p className="mt-2 text-xs text-coral">{error}</p>}

      {open && qrDataUrl && orderUrl && (
        <div id="guest-qr-print-root" className="fixed inset-0 z-50 bg-cream text-ink flex flex-col items-center justify-center p-8 gap-6">
          <p className="print:hidden text-xs uppercase tracking-[0.28em] text-ink/50">Preview — this is what will print</p>
          <p className="font-display italic text-2xl">Scan to order</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not a resolvable next/image src */}
          <img src={qrDataUrl} alt="QR code to order from this table" width={320} height={320} />
          <p className="text-xs text-ink/50 break-all max-w-xs text-center">{orderUrl}</p>
          <div className="print:hidden flex gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-ink text-cream hover:bg-ink2 transition-colors px-6 py-2.5 text-sm font-medium"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-ink/25 hover:border-ink/50 transition-colors px-6 py-2.5 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
