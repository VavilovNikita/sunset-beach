import { posRequest, type PosResult } from "@/lib/pos/posFetch";
import type { Table } from "@/lib/posTypes";

export function fetchTables(): Promise<PosResult<Table[]>> {
  return posRequest<Table[]>("/tables", undefined, "Could not load tables.");
}
