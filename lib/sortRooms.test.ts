import { describe, expect, it } from "vitest";
import { sortRoomsByName, sortUnitsByLabel } from "./sortRooms";

describe("sortUnitsByLabel", () => {
  it("compares the numbers in a label as numbers", () => {
    const labels = sortUnitsByLabel([{ label: "110" }, { label: "102" }, { label: "9" }, { label: "101" }]).map((u) => u.label);
    expect(labels).toEqual(["9", "101", "102", "110"]);
  });

  it("keeps a letter prefix together and numbers inside it in order", () => {
    const labels = sortUnitsByLabel([{ label: "B10" }, { label: "A2" }, { label: "B2" }, { label: "A10" }]).map((u) => u.label);
    expect(labels).toEqual(["A2", "A10", "B2", "B10"]);
  });

  it("does not change the list it is given", () => {
    const input = [{ label: "2" }, { label: "1" }];
    sortUnitsByLabel(input);
    expect(input.map((u) => u.label)).toEqual(["2", "1"]);
  });
});

describe("sortRoomsByName", () => {
  it("sorts room types by name, ignoring case", () => {
    expect(sortRoomsByName([{ name: "Suite" }, { name: "beach Villa" }, { name: "Garden" }]).map((r) => r.name)).toEqual([
      "beach Villa",
      "Garden",
      "Suite",
    ]);
  });
});
