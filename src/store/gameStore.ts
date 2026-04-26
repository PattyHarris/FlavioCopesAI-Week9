import { create } from "zustand";
import { generateBoater, generateChatter, generateReview, chooseDock } from "../ai/client";
import { dockTypes, facilityTypes, MAP_SIZE, seasonalDemand, structureDefinitions, weatherSatisfaction } from "../game/config";
import { createInitialMap } from "../game/map";
import { clamp, randomFrom, randomInt } from "../game/utils";
import type {
  Boater,
  BoaterDraft,
  BuildMode,
  ChatterEntry,
  DebugEvent,
  DockCandidate,
  DockType,
  FacilityType,
  GameSnapshot,
  GameSpeed,
  Review,
  Season,
  Structure,
  Tile,
  WeatherType,
} from "../types/game";

const weatherTypes: WeatherType[] = ["sunny", "windy", "rainy", "stormy"];
let advanceTimeInFlight = false;
let gameSessionToken = 0;

function getSeason(day: number): Season {
  const cycle = Math.floor((day - 1) / 8) % 4;
  return ["spring", "summer", "autumn", "winter"][cycle] as Season;
}

function createInitialSnapshot(): GameSnapshot {
  return {
    version: 1,
    tiles: createInitialMap(),
    structures: [],
    dockPricing: {
      sailBoatDock: structureDefinitions.sailBoatDock.basePrice ?? 52,
      houseBoatDock: structureDefinitions.houseBoatDock.basePrice ?? 74,
      canoeDock: structureDefinitions.canoeDock.basePrice ?? 24,
    },
    boaters: [],
    departedBoaters: [],
    reviews: [],
    chatterLog: [],
    debugLog: [],
    buildMode: null,
    selectedTile: null,
    clock: {
      day: 1,
      hour: 6,
      speed: (Number(localStorage.getItem("dock-and-stay-speed")) || 1) as GameSpeed,
      tickCount: 0,
    },
    weather: {
      today: "sunny",
      forecast: "windy",
    },
    economy: {
      cash: 3200,
      reputation: 50,
      nightlyRevenue: 0,
      dailyMaintenance: 0,
      lifetimeRevenue: 0,
    },
  };
}

function cloneTiles(tiles: Tile[]) {
  return tiles.map((tile) => ({ ...tile }));
}

function getTile(tiles: Tile[], x: number, y: number) {
  return tiles.find((tile) => tile.x === x && tile.y === y) ?? null;
}

function nearbyFacilities(structure: Structure, structures: Structure[]) {
  return structures
    .filter((candidate) => {
      if (structure.id === candidate.id) {
        return false;
      }

      return Math.abs(candidate.x - structure.x) <= 2 && Math.abs(candidate.y - structure.y) <= 2;
    })
    .filter((candidate) => facilityTypes.includes(candidate.type as FacilityType))
    .map((candidate) => candidate.type as FacilityType);
}

function buildDockCandidates(structures: Structure[]): DockCandidate[] {
  return structures
    .filter((structure) => {
      if (!dockTypes.includes(structure.type as DockType)) {
        return false;
      }

      const capacity = structureDefinitions[structure.type].capacity ?? 1;
      return structure.occupiedBy.length < capacity;
    })
    .map((structure) => ({
      structureId: structure.id,
      type: structure.type as DockType,
      price: structure.price,
      nearbyFacilities: nearbyFacilities(structure, structures),
      occupancy: structure.occupiedBy.length,
    }));
}

function calculateSatisfaction(boater: Boater, structures: Structure[], weather: WeatherType) {
  const dock = structures.find((structure) => structure.id === boater.dockId);

  if (!dock) {
    return boater.satisfaction;
  }

  const facilities = nearbyFacilities(dock, structures);
  const facilityBonus = facilities.filter((facility) =>
    boater.preferences.likedFacilities.includes(facility),
  ).length * 4;
  const pricePenalty =
    dock.price > boater.preferences.maxNightlyPrice
      ? Math.min(18, dock.price - boater.preferences.maxNightlyPrice)
      : 5;
  const crowdPenalty = Math.max(0, dock.occupiedBy.length - 1) * (10 - boater.preferences.noiseTolerance);
  const preferredBonus = boater.preferences.preferredDockTypes.includes(dock.type as DockType) ? 8 : 0;
  const weatherBonus = weatherSatisfaction[weather];

  return clamp(
    boater.satisfaction + facilityBonus + preferredBonus + weatherBonus - pricePenalty - crowdPenalty,
    5,
    99,
  );
}

function applyNightlyEconomy(snapshot: GameSnapshot) {
  const occupiedDocks = snapshot.structures.filter((structure) => structure.occupiedBy.length > 0);
  const nightlyRevenue = occupiedDocks.reduce(
    (sum, structure) => sum + structure.price * Math.max(1, structure.occupiedBy.length),
    0,
  );
  const dailyMaintenance = snapshot.structures.reduce(
    (sum, structure) => sum + structure.maintenanceCost,
    0,
  );
  const reputationBonus = Math.round(snapshot.economy.reputation / 12);
  snapshot.economy.cash += nightlyRevenue + reputationBonus - dailyMaintenance;
  snapshot.economy.nightlyRevenue = nightlyRevenue;
  snapshot.economy.dailyMaintenance = dailyMaintenance;
  snapshot.economy.lifetimeRevenue += nightlyRevenue;
}

function createBoaterFromDraft(draft: BoaterDraft): Boater {
  return {
    id: crypto.randomUUID(),
    name: draft.name,
    personality: draft.personality,
    budget: draft.budget,
    preferences: draft.preferences,
    satisfaction: 60,
    dockId: null,
    status: "arriving",
    chatter: [],
    stayHoursRemaining: randomInt(18, 42),
    reviewLeft: false,
  };
}

function syncStructureOccupancy(structures: Structure[], boaters: Boater[]) {
  const occupancyByDock = new Map<string, string[]>();

  for (const boater of boaters) {
    if (boater.status !== "staying" || !boater.dockId) {
      continue;
    }

    const current = occupancyByDock.get(boater.dockId) ?? [];
    current.push(boater.id);
    occupancyByDock.set(boater.dockId, current);
  }

  return structures.map((structure) => ({
    ...structure,
    occupiedBy: occupancyByDock.get(structure.id) ?? [],
  }));
}

function reconcileStructuresWithTiles(
  tiles: Tile[],
  simulated: Structure[],
  latest: Structure[],
) {
  const simulatedById = new Map(simulated.map((structure) => [structure.id, structure]));
  const latestById = new Map(latest.map((structure) => [structure.id, structure]));
  const merged: Structure[] = [];
  const seen = new Set<string>();

  for (const tile of tiles) {
    if (!tile.structureId || seen.has(tile.structureId)) {
      continue;
    }

    const latestMatch = latestById.get(tile.structureId);
    const simulatedMatch = simulatedById.get(tile.structureId);
    const chosen = latestMatch ?? simulatedMatch;

    if (chosen) {
      merged.push({
        ...chosen,
        occupiedBy: simulatedMatch?.occupiedBy ?? chosen.occupiedBy,
      });
      seen.add(tile.structureId);
    }
  }

  return merged;
}

function mergeDebugLogAfterTick(
  simulated: DebugEvent[],
  latest: DebugEvent[],
) {
  const seen = new Set<string>();
  const merged: DebugEvent[] = [];

  for (const entry of [...latest, ...simulated]) {
    if (seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    merged.push(entry);
  }

  return merged.slice(0, 40);
}

function isClockAhead(
  candidate: GameSnapshot["clock"],
  baseline: GameSnapshot["clock"],
) {
  if (candidate.tickCount !== baseline.tickCount) {
    return candidate.tickCount > baseline.tickCount;
  }

  if (candidate.day !== baseline.day) {
    return candidate.day > baseline.day;
  }

  return candidate.hour > baseline.hour;
}

function mergeSnapshotAfterTick(
  base: GameSnapshot,
  simulated: GameSnapshot,
  latest: GameStore,
): GameSnapshot {
  const cashDelta = simulated.economy.cash - base.economy.cash;
  const reputationDelta = simulated.economy.reputation - base.economy.reputation;
  const lifetimeRevenueDelta =
    simulated.economy.lifetimeRevenue - base.economy.lifetimeRevenue;
  const shouldApplySimulatedClock = isClockAhead(simulated.clock, latest.clock);

  return {
    version: simulated.version,
    tiles: latest.tiles,
    structures: syncStructureOccupancy(
      reconcileStructuresWithTiles(latest.tiles, simulated.structures, latest.structures),
      simulated.boaters,
    ),
    dockPricing: latest.dockPricing,
    boaters: simulated.boaters,
    departedBoaters: simulated.departedBoaters,
    reviews: simulated.reviews,
    chatterLog: simulated.chatterLog,
    debugLog: mergeDebugLogAfterTick(simulated.debugLog, latest.debugLog),
    buildMode: latest.buildMode,
    selectedTile: latest.selectedTile,
    clock: shouldApplySimulatedClock ? simulated.clock : latest.clock,
    weather: shouldApplySimulatedClock ? simulated.weather : latest.weather,
    economy: {
      cash: latest.economy.cash + cashDelta,
      reputation: clamp(latest.economy.reputation + reputationDelta, 0, 100),
      nightlyRevenue: simulated.economy.nightlyRevenue,
      dailyMaintenance: simulated.economy.dailyMaintenance,
      lifetimeRevenue: latest.economy.lifetimeRevenue + lifetimeRevenueDelta,
    },
  };
}

interface GameStore extends GameSnapshot {
  loading: boolean;
  logDebug: (message: string) => void;
  resetGame: () => void;
  setBuildMode: (mode: BuildMode) => void;
  selectTile: (x: number, y: number) => void;
  placeStructure: (x: number, y: number) => void;
  setDockPrice: (type: DockType, price: number) => void;
  setSpeed: (speed: GameSpeed) => void;
  advanceTime: (hours?: number) => Promise<void>;
  loadSnapshotIntoStore: (snapshot: GameSnapshot) => void;
  markLoaded: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialSnapshot(),
  loading: true,
  logDebug: (message) =>
    set((state) => ({
      debugLog: [
        {
          id: crypto.randomUUID(),
          message,
          createdAt: new Date().toISOString(),
        },
        ...state.debugLog,
      ].slice(0, 40),
    })),
  resetGame: () => {
    gameSessionToken += 1;
    const fresh = createInitialSnapshot();
    set({
      ...fresh,
      loading: false,
      debugLog: [
        {
          id: crypto.randomUUID(),
          message: "Started a new harbor session from the New Game button.",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  },
  setBuildMode: (mode) => set({ buildMode: mode }),
  selectTile: (x, y) => set({ selectedTile: { x, y } }),
  placeStructure: (x, y) => {
    const state = get();
    const buildMode = state.buildMode;

    if (!buildMode) {
      set({ selectedTile: { x, y } });
      return;
    }

    const definition = structureDefinitions[buildMode];
    const tile = getTile(state.tiles, x, y);

    if (!tile) {
      get().logDebug(`Placement failed at ${x},${y}: tile not found.`);
      return;
    }

    if (tile.structureId) {
      get().logDebug(`Placement failed at ${x},${y}: tile is already occupied.`);
      return;
    }

    if (!definition.allowedTerrains.includes(tile.terrain)) {
      get().logDebug(
        `Placement failed at ${x},${y}: ${definition.name} cannot be built on ${tile.terrain}.`,
      );
      return;
    }

    if (state.economy.cash < definition.buildCost) {
      get().logDebug(
        `Placement failed at ${x},${y}: not enough cash for ${definition.name}.`,
      );
      return;
    }

    const structure: Structure = {
      id: crypto.randomUUID(),
      type: buildMode,
      x,
      y,
      price:
        definition.category === "dock"
          ? state.dockPricing[buildMode as DockType]
          : definition.basePrice ?? 0,
      maintenanceCost: definition.maintenanceCost,
      occupiedBy: [],
    };

    set({
      tiles: state.tiles.map((candidate) =>
        candidate.x === x && candidate.y === y
          ? { ...candidate, structureId: structure.id }
          : candidate,
      ),
      structures: [...state.structures, structure],
      economy: {
        ...state.economy,
        cash: state.economy.cash - definition.buildCost,
      },
      selectedTile: { x, y },
      debugLog: [
        {
          id: crypto.randomUUID(),
          message: `Placed ${definition.name} at ${x},${y}. Structures now: ${state.structures.length + 1}.`,
          createdAt: new Date().toISOString(),
        },
        ...state.debugLog,
      ].slice(0, 40),
    });
  },
  setDockPrice: (type, price) => {
    const nextPrice = clamp(Math.round(price), 5, 300);
    set((state) => ({
      dockPricing: {
        ...state.dockPricing,
        [type]: nextPrice,
      },
      structures: state.structures.map((structure) =>
        structure.type === type
          ? { ...structure, price: nextPrice }
          : structure,
      ),
    }));
  },
  setSpeed: (speed) => {
    localStorage.setItem("dock-and-stay-speed", String(speed));
    set((state) => ({
      clock: {
        ...state.clock,
        speed,
      },
    }));
  },
  advanceTime: async (hours = 1) => {
    if (advanceTimeInFlight) {
      return;
    }

    advanceTimeInFlight = true;
    const sessionTokenAtStart = gameSessionToken;

    try {
    for (let step = 0; step < hours; step += 1) {
      if (sessionTokenAtStart !== gameSessionToken) {
        return;
      }

      const stateAtTickStart = get();
      const snapshot: GameSnapshot = {
        version: stateAtTickStart.version,
        tiles: cloneTiles(stateAtTickStart.tiles),
        structures: stateAtTickStart.structures.map((structure) => ({ ...structure, occupiedBy: [...structure.occupiedBy] })),
        dockPricing: { ...stateAtTickStart.dockPricing },
        boaters: stateAtTickStart.boaters.map((boater) => ({ ...boater, chatter: [...boater.chatter] })),
        departedBoaters: stateAtTickStart.departedBoaters.map((boater) => ({ ...boater, chatter: [...boater.chatter] })),
        reviews: [...stateAtTickStart.reviews],
        chatterLog: [...stateAtTickStart.chatterLog],
        debugLog: [...stateAtTickStart.debugLog],
        buildMode: stateAtTickStart.buildMode,
        selectedTile: stateAtTickStart.selectedTile,
        clock: { ...stateAtTickStart.clock },
        weather: { ...stateAtTickStart.weather },
        economy: { ...stateAtTickStart.economy },
      };

      snapshot.clock.tickCount += 1;
      snapshot.clock.hour += 1;

      for (const boater of snapshot.boaters) {
        if (boater.status === "staying") {
          boater.stayHoursRemaining -= 1;
          boater.satisfaction = calculateSatisfaction(boater, snapshot.structures, snapshot.weather.today);
        }
      }

      if (snapshot.clock.hour === 7) {
        const totalDocks = snapshot.structures.filter((structure) =>
          dockTypes.includes(structure.type as DockType),
        ).length;
        const openDocks = snapshot.structures.filter(
          (structure) =>
            dockTypes.includes(structure.type as DockType) && structure.occupiedBy.length === 0,
        ).length;
        const arrivals =
          Math.max(2, seasonalDemand[getSeason(snapshot.clock.day)] + Math.min(3, totalDocks)) +
          randomInt(0, 2);
        get().logDebug(
          `Morning arrivals: ${arrivals} boaters generated for ${openDocks}/${totalDocks} open docks.`,
        );

        for (let index = 0; index < arrivals; index += 1) {
          if (sessionTokenAtStart !== gameSessionToken) {
            return;
          }

          const draft = await generateBoater(snapshot.clock.day);
          const boater = createBoaterFromDraft(draft);
          const decision = await chooseDock(draft, buildDockCandidates(snapshot.structures));

          if (!decision.chosenStructureId) {
            const disappointed = {
              ...boater,
              status: "departed" as const,
              satisfaction: 35,
              reviewLeft: true,
              chatter: [`Left the harbor: ${decision.reason}`],
            };
            snapshot.departedBoaters.unshift(disappointed);
            continue;
          }

          const selectedDock = snapshot.structures.find(
            (structure) => structure.id === decision.chosenStructureId,
          );

          if (!selectedDock) {
            continue;
          }

          const dockCapacity = structureDefinitions[selectedDock.type].capacity ?? 1;
          if (selectedDock.occupiedBy.length >= dockCapacity) {
            snapshot.departedBoaters.unshift({
              ...boater,
              status: "departed",
              satisfaction: 34,
              reviewLeft: true,
              chatter: ["Left the harbor: the chosen dock was already full."],
            });
            continue;
          }

          selectedDock.occupiedBy.push(boater.id);
          boater.dockId = selectedDock.id;
          boater.status = "staying";
          boater.chatter.push(decision.reason);
          snapshot.boaters.unshift(boater);
        }
      }

      if (snapshot.clock.hour > 0 && snapshot.clock.hour % 4 === 0) {
        const staying = snapshot.boaters.filter((boater) => boater.status === "staying").slice(0, 4);
        for (const boater of staying) {
          if (sessionTokenAtStart !== gameSessionToken) {
            return;
          }

          const dock = snapshot.structures.find((structure) => structure.id === boater.dockId);
          if (!dock) {
            continue;
          }

          const chatter = await generateChatter(
            boater,
            nearbyFacilities(dock, snapshot.structures),
            snapshot.weather.today,
          );
          const entry: ChatterEntry = {
            id: crypto.randomUUID(),
            boaterName: boater.name,
            message: chatter.message,
            hour: snapshot.clock.hour,
            day: snapshot.clock.day,
          };
          boater.chatter.unshift(chatter.message);
          snapshot.chatterLog.unshift(entry);
        }
      }

      const departing: Boater[] = [];
      snapshot.boaters = snapshot.boaters.filter((boater) => {
        if (boater.stayHoursRemaining <= 0) {
          departing.push(boater);
          return false;
        }

        return true;
      });

      for (const boater of departing) {
        if (sessionTokenAtStart !== gameSessionToken) {
          return;
        }

        const dock = snapshot.structures.find((structure) => structure.id === boater.dockId);
        if (dock) {
          dock.occupiedBy = dock.occupiedBy.filter((id) => id !== boater.id);
        }

        const reviewDraft = await generateReview(boater, snapshot.structures);
        const review: Review = {
          id: crypto.randomUUID(),
          boaterName: boater.name,
          stars: clamp(reviewDraft.stars, 1, 5),
          text: reviewDraft.text,
          day: snapshot.clock.day,
        };
        boater.reviewLeft = true;
        boater.status = "departed";
        snapshot.reviews.unshift(review);
        snapshot.departedBoaters.unshift(boater);
        snapshot.economy.reputation = clamp(
          snapshot.economy.reputation + (review.stars >= 4 ? 2 : review.stars <= 2 ? -3 : 0),
          0,
          100,
        );
      }

      snapshot.structures = syncStructureOccupancy(snapshot.structures, snapshot.boaters);

      if (snapshot.clock.hour === 21) {
        applyNightlyEconomy(snapshot);
        get().logDebug(
          `Nightly settlement: revenue ${snapshot.economy.nightlyRevenue}, maintenance ${snapshot.economy.dailyMaintenance}, cash now ${snapshot.economy.cash}.`,
        );
      }

      if (snapshot.clock.hour >= 24) {
        snapshot.clock.hour = 0;
        snapshot.clock.day += 1;
        snapshot.weather.today = snapshot.weather.forecast;
        snapshot.weather.forecast = randomFrom(weatherTypes);
      }

      const latestState = get();
      if (sessionTokenAtStart !== gameSessionToken) {
        return;
      }
      const mergedSnapshot = mergeSnapshotAfterTick(
        {
          version: stateAtTickStart.version,
          tiles: stateAtTickStart.tiles,
          structures: stateAtTickStart.structures,
          dockPricing: stateAtTickStart.dockPricing,
          boaters: stateAtTickStart.boaters,
          departedBoaters: stateAtTickStart.departedBoaters,
          reviews: stateAtTickStart.reviews,
          chatterLog: stateAtTickStart.chatterLog,
          debugLog: stateAtTickStart.debugLog,
          buildMode: stateAtTickStart.buildMode,
          selectedTile: stateAtTickStart.selectedTile,
          clock: stateAtTickStart.clock,
          weather: stateAtTickStart.weather,
          economy: stateAtTickStart.economy,
        },
        snapshot,
        latestState,
      );

      set({
        ...mergedSnapshot,
      });
    }
    } finally {
      advanceTimeInFlight = false;
    }
  },
  loadSnapshotIntoStore: (snapshot) =>
    (() => {
      gameSessionToken += 1;
      set({
        ...snapshot,
        structures: syncStructureOccupancy(
          snapshot.structures,
          snapshot.boaters,
        ),
        dockPricing: snapshot.dockPricing ?? {
          sailBoatDock: structureDefinitions.sailBoatDock.basePrice ?? 52,
          houseBoatDock: structureDefinitions.houseBoatDock.basePrice ?? 74,
          canoeDock: structureDefinitions.canoeDock.basePrice ?? 24,
        },
        debugLog: [
          {
            id: crypto.randomUUID(),
            message: `Loaded saved game with ${snapshot.structures.length} structures and ${snapshot.boaters.length} active guests.`,
            createdAt: new Date().toISOString(),
          },
          ...(snapshot.debugLog ?? []),
        ].slice(0, 40),
        loading: false,
      });
    })(),
  markLoaded: () =>
    (() => {
      gameSessionToken += 1;
      set((state) => ({
        loading: false,
        debugLog: [
          {
            id: crypto.randomUUID(),
            message: "Started a new harbor session.",
            createdAt: new Date().toISOString(),
          },
          ...state.debugLog,
        ].slice(0, 40),
      }));
    })(),
}));
