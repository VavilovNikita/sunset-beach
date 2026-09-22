"use client";

import { useRouter } from "next/navigation";

export default function GuestSignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/guest-session/logout", { method: "POST" });
    router.push("/guest/login");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="text-sm text-cream/50 hover:text-cream transition-colors">
      Sign out
    </button>
  );
}
