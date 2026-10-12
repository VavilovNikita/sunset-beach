// What a map screen (property map, spa map, restaurant map) shows when its background image is
// not there. The database keeps the image's path, but the file itself lives on the server's disk,
// so the path can outlive the file (a lost upload volume, a restore from a dump only): the image
// request answers 404, and the screen used to draw an empty frame that hid every room or table
// placed on it. Pure, so the wording and the decision are tested (mapImageFallback.test.ts).

export type MapImageState =
  // The plan loads: draw it with the tiles on top.
  | "image"
  // Nobody has uploaded a plan yet.
  | "never-uploaded"
  // A plan is recorded but the file is missing or failed to load.
  | "failed";

export function mapImageState(hasImagePath: boolean, loadFailed: boolean): MapImageState {
  if (!hasImagePath) return "never-uploaded";
  return loadFailed ? "failed" : "image";
}

// The tiles are shown as a plain grid of buttons instead of on the plan in both non-image states:
// a room or table that has coordinates but no plan to place them on must still be reachable.
export function showsTileGrid(state: MapImageState): boolean {
  return state !== "image";
}

export type MapImageNotice = { tone: "error" | "info"; text: string };

// `what` is "floor plan" or "map" as the screen words it. Staff who can upload get the instruction;
// everyone else gets the fact, so a receptionist is not told to do something they cannot.
export function mapImageNotice(state: MapImageState, canUpload: boolean, what = "map"): MapImageNotice | null {
  if (state === "image") return null;
  if (state === "never-uploaded") {
    return {
      tone: "info",
      text: canUpload ? `No ${what} image has been uploaded yet - upload one above to place things on it.` : `No ${what} image has been uploaded yet.`,
    };
  }
  return {
    tone: "error",
    text: canUpload
      ? `The ${what} image was not found - upload it again (above). Until then everything is listed below.`
      : `The ${what} image could not be loaded. Everything is listed below; ask a manager to upload it again.`,
  };
}
