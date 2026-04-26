export type TerrainType = "water" | "grass" | "tree" | "path" | "sand";
export type DockType = "sailBoatDock" | "houseBoatDock" | "canoeDock";
export type FacilityType =
  | "restroom"
  | "shower"
  | "firePit"
  | "playground"
  | "campStore";
export type StructureType = DockType | FacilityType;
export type BuildMode = StructureType | null;
export type GameSpeed = 0 | 1 | 2 | 5;
export type WeatherType = "sunny" | "windy" | "rainy" | "stormy";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  structureId: string | null;
}

export interface StructureDefinition {
  type: StructureType;
  name: string;
  category: "dock" | "facility";
  allowedTerrains: TerrainType[];
  buildCost: number;
  maintenanceCost: number;
  basePrice?: number;
  capacity?: number;
}

export interface Structure {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  price: number;
  maintenanceCost: number;
  occupiedBy: string[];
}

export interface BoaterPreferences {
  preferredDockTypes: DockType[];
  likedFacilities: FacilityType[];
  maxNightlyPrice: number;
  noiseTolerance: number;
}

export interface Boater {
  id: string;
  name: string;
  personality: string;
  budget: number;
  preferences: BoaterPreferences;
  satisfaction: number;
  dockId: string | null;
  status: "arriving" | "staying" | "departed";
  chatter: string[];
  stayHoursRemaining: number;
  reviewLeft: boolean;
}

export interface Review {
  id: string;
  boaterName: string;
  stars: number;
  text: string;
  day: number;
}

export interface ChatterEntry {
  id: string;
  boaterName: string;
  message: string;
  hour: number;
  day: number;
}

export interface DebugEvent {
  id: string;
  message: string;
  createdAt: string;
}

export interface EconomyLedger {
  cash: number;
  reputation: number;
  nightlyRevenue: number;
  dailyMaintenance: number;
  lifetimeRevenue: number;
}

export interface ClockState {
  day: number;
  hour: number;
  speed: GameSpeed;
  tickCount: number;
}

export interface WeatherState {
  today: WeatherType;
  forecast: WeatherType;
}

export interface GameSnapshot {
  version: number;
  tiles: Tile[];
  structures: Structure[];
  dockPricing: Record<DockType, number>;
  boaters: Boater[];
  departedBoaters: Boater[];
  reviews: Review[];
  chatterLog: ChatterEntry[];
  debugLog: DebugEvent[];
  buildMode: BuildMode;
  selectedTile: { x: number; y: number } | null;
  clock: ClockState;
  weather: WeatherState;
  economy: EconomyLedger;
}

export interface DockCandidate {
  structureId: string;
  type: DockType;
  price: number;
  nearbyFacilities: FacilityType[];
  occupancy: number;
}

export interface DockDecision {
  chosenStructureId: string | null;
  reason: string;
}

export interface BoaterDraft {
  name: string;
  personality: string;
  budget: number;
  preferences: BoaterPreferences;
}

export interface ReviewDraft {
  stars: number;
  text: string;
}

export interface ChatterDraft {
  message: string;
}

export interface StoredGameRecord {
  id: string;
  snapshot: GameSnapshot;
  savedAt: string;
}
