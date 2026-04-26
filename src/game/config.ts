import type {
  DockType,
  FacilityType,
  Season,
  StructureDefinition,
  StructureType,
  WeatherType,
} from "../types/game";

export const MAP_SIZE = 16;
export const SAVE_SLOT_ID = "dock-and-stay-save";

export const structureDefinitions: Record<StructureType, StructureDefinition> = {
  sailBoatDock: {
    type: "sailBoatDock",
    name: "Sail Dock",
    category: "dock",
    allowedTerrains: ["water"],
    buildCost: 150,
    maintenanceCost: 10,
    basePrice: 58,
    capacity: 1,
  },
  houseBoatDock: {
    type: "houseBoatDock",
    name: "House Dock",
    category: "dock",
    allowedTerrains: ["water"],
    buildCost: 220,
    maintenanceCost: 14,
    basePrice: 82,
    capacity: 1,
  },
  canoeDock: {
    type: "canoeDock",
    name: "Canoe Dock",
    category: "dock",
    allowedTerrains: ["water"],
    buildCost: 90,
    maintenanceCost: 5,
    basePrice: 30,
    capacity: 1,
  },
  restroom: {
    type: "restroom",
    name: "Restroom",
    category: "facility",
    allowedTerrains: ["grass", "sand", "path"],
    buildCost: 140,
    maintenanceCost: 7,
  },
  shower: {
    type: "shower",
    name: "Shower",
    category: "facility",
    allowedTerrains: ["grass", "sand", "path"],
    buildCost: 185,
    maintenanceCost: 8,
  },
  firePit: {
    type: "firePit",
    name: "Fire Pit",
    category: "facility",
    allowedTerrains: ["grass", "sand"],
    buildCost: 80,
    maintenanceCost: 3,
  },
  playground: {
    type: "playground",
    name: "Playground",
    category: "facility",
    allowedTerrains: ["grass", "sand"],
    buildCost: 175,
    maintenanceCost: 8,
  },
  campStore: {
    type: "campStore",
    name: "Camp Store",
    category: "facility",
    allowedTerrains: ["grass", "sand", "path"],
    buildCost: 280,
    maintenanceCost: 14,
  },
};

export const dockTypes: DockType[] = [
  "sailBoatDock",
  "houseBoatDock",
  "canoeDock",
];

export const facilityTypes: FacilityType[] = [
  "restroom",
  "shower",
  "firePit",
  "playground",
  "campStore",
];

export const weatherSatisfaction: Record<WeatherType, number> = {
  sunny: 3,
  windy: 1,
  rainy: -2,
  stormy: -5,
};

export const seasonalDemand: Record<Season, number> = {
  spring: 4,
  summer: 6,
  autumn: 3,
  winter: 2,
};
