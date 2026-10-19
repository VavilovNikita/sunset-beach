"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { settingsTabQuery, type SettingsTabId } from "@/lib/notificationSettingsTabs";

// A real link to a tab (`?tab=…`), so it works before JavaScript has loaded, can be opened in a new tab and copied.
// A plain click only changes the address (history.pushState, which Next 14 feeds into useSearchParams): the page
// keeps its state - the unsaved edits - and Back goes to the previous tab like any other page.
export default function SettingsTabLink({
  tab,
  className,
  current,
  children,
}: {
  tab: SettingsTabId;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  const href = `${usePathname()}${settingsTabQuery(tab)}`;
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, "", href);
  }
  return (
    <a href={href} onClick={onClick} aria-current={current ? "page" : undefined} className={className}>
      {children}
    </a>
  );
}
