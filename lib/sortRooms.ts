// Room units and room types come back from the API in whatever order the database returned them,
// so a dropdown listed "102, 101, 110, 103". These sort for display only: units by label with
// numbers compared as numbers ("2" before "10", "A2" before "A10"), room types by name.
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function sortUnitsByLabel<T extends { label: string }>(units: readonly T[]): T[] {
  return [...units].sort((a, b) => collator.compare(a.label, b.label));
}

export function sortRoomsByName<T extends { name: string }>(rooms: readonly T[]): T[] {
  return [...rooms].sort((a, b) => collator.compare(a.name, b.name));
}
