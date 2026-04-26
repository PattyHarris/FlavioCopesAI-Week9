import { MAP_SIZE } from "./config";
import type { TerrainType, Tile } from "../types/game";

export function createInitialMap(): Tile[] {
  const tiles: Tile[] = [];

  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      let terrain: TerrainType = "grass";
      const edgeTree =
        (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) &&
        !(x <= 4 && y <= 4);
      const lakeCorner = (x <= 4 && y <= 4) || (x <= 2 && y === 5) || (y <= 2 && x === 5);
      const shoreline =
        !lakeCorner &&
        ((x >= 0 && x <= 5 && y >= 0 && y <= 5 && (x === 5 || y === 5)) ||
          (x === 3 && y === 6) ||
          (x === 6 && y === 3));
      const centerPath = x === 7 || x === 8 || y === 7 || y === 8;
      const pathBranches = (x >= 5 && x <= 10 && y === 10) || (y >= 5 && y <= 10 && x === 10);

      if (lakeCorner) {
        terrain = "water";
      } else if (shoreline) {
        terrain = "sand";
      } else if (centerPath || pathBranches) {
        terrain = "path";
      } else if (edgeTree || ((x + y) % 9 === 0 && x > 2 && y > 2 && x < 14 && y < 14)) {
        terrain = "tree";
      }

      tiles.push({
        x,
        y,
        terrain,
        structureId: null,
      });
    }
  }

  return tiles;
}

export function tileKey(x: number, y: number) {
  return `${x}:${y}`;
}
