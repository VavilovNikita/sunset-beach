// The admin Menu screen's per-category tabs (~130 items in one list was unusable). Same grouping
// OrderMenuPicker already shows staff on the floor - one tab per distinct free-text `category`,
// sorted - kept here as a pure function so the "which tab is selected" fallback is testable.

export type MenuCategoryTab = { category: string; count: number };

export function menuCategoryTabs(items: { category: string }[]): MenuCategoryTab[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  return Array.from(counts, ([category, count]) => ({ category, count })).sort((a, b) =>
    a.category.localeCompare(b.category)
  );
}

// A requested category that no longer exists (renamed, last item deleted, a stale link) falls
// back to the first tab rather than rendering an empty list that reads as "this menu is empty".
export function resolveSelectedCategory(tabs: MenuCategoryTab[], requested: string | undefined): string | null {
  if (requested !== undefined && tabs.some((t) => t.category === requested)) return requested;
  return tabs[0]?.category ?? null;
}
