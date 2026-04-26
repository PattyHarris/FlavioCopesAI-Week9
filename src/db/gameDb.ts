import Dexie, { type Table } from "dexie";
import { SAVE_SLOT_ID } from "../game/config";
import type { GameSnapshot, StoredGameRecord } from "../types/game";

class DockAndStayDatabase extends Dexie {
  saves!: Table<StoredGameRecord, string>;

  constructor() {
    super("dockAndStay");
    this.version(1).stores({
      saves: "id,savedAt",
    });
  }
}

export const db = new DockAndStayDatabase();

export async function saveSnapshot(snapshot: GameSnapshot) {
  await db.saves.put({
    id: SAVE_SLOT_ID,
    snapshot,
    savedAt: new Date().toISOString(),
  });
}

export async function loadSnapshot() {
  const record = await db.saves.get(SAVE_SLOT_ID);
  return record?.snapshot ?? null;
}

export async function clearSnapshot() {
  await db.saves.delete(SAVE_SLOT_ID);
}
