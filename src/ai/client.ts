import { dockTypes, facilityTypes, structureDefinitions } from "../game/config";
import { average, clamp, randomFrom, randomInt } from "../game/utils";
import type {
  Boater,
  BoaterDraft,
  ChatterDraft,
  DockCandidate,
  DockDecision,
  DockType,
  FacilityType,
  ReviewDraft,
  Structure,
  WeatherType,
} from "../types/game";

const DEFAULT_MODEL = "gemma3:4b";
const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";

export interface AiDebugSnapshot {
  lastFeature: string | null;
  lastSource: "ollama" | "fallback" | "idle";
  lastError: string | null;
  lastUpdatedAt: string | null;
  requests: number;
  fallbacks: number;
}

class SerialModelQueue {
  private tail = Promise.resolve();

  enqueue<T>(task: () => Promise<T>) {
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );

    return next;
  }
}

const modelQueue = new SerialModelQueue();
const aiListeners = new Set<() => void>();
const recentFallbackNames: string[] = [];
const recentGeneratedNames: string[] = [];

let aiDebugSnapshot: AiDebugSnapshot = {
  lastFeature: null,
  lastSource: "idle",
  lastError: null,
  lastUpdatedAt: null,
  requests: 0,
  fallbacks: 0,
};

function publishAiDebug(update: Partial<AiDebugSnapshot>) {
  aiDebugSnapshot = {
    ...aiDebugSnapshot,
    ...update,
    lastUpdatedAt: new Date().toISOString(),
  };

  for (const listener of aiListeners) {
    listener();
  }
}

export function getAiDebugSnapshot() {
  return aiDebugSnapshot;
}

export function subscribeToAiDebug(listener: () => void) {
  aiListeners.add(listener);
  return () => {
    aiListeners.delete(listener);
  };
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function requestStructuredJson<T>(
  feature: string,
  prompt: string,
  fallback: () => T,
) {
  return modelQueue.enqueue(async () => {
    publishAiDebug({
      lastFeature: feature,
      requests: aiDebugSnapshot.requests + 1,
      lastError: null,
    });

    try {
      const response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          stream: false,
          prompt,
          format: "json",
        }),
      });

      if (!response.ok) {
        throw new Error(`Model request failed with ${response.status}`);
      }

      const payload = (await response.json()) as { response?: string };
      const jsonText = extractFirstJsonObject(payload.response ?? "");

      if (!jsonText) {
        throw new Error("No JSON object returned");
      }

      publishAiDebug({
        lastFeature: feature,
        lastSource: "ollama",
        lastError: null,
      });

      return JSON.parse(jsonText) as T;
    } catch (error) {
      publishAiDebug({
        lastFeature: feature,
        lastSource: "fallback",
        lastError: error instanceof Error ? error.message : "Unknown AI error",
        fallbacks: aiDebugSnapshot.fallbacks + 1,
      });

      return fallback();
    }
  });
}

function fallbackBoaterDraft(day: number): BoaterDraft {
  const firstNames = [
    "Maya", "Owen", "Jules", "Piper", "Rosa", "Theo", "Nina", "Avery", "Cal", "Iris",
    "Milo", "Sage", "Elena", "Brooks", "Lena", "Gavin", "Tessa", "Noah", "Marin", "Skye",
  ];
  const lastNames = [
    "Harbor", "Bennett", "Cove", "Marlow", "Pierce", "Reed", "Talbot", "Keene", "Rowan",
    "Sutton", "Mercer", "Hale", "Winslow", "Fletcher", "Briar", "Ellis",
  ];
  const personalities = [
    "frugal and chatty",
    "quiet and nature-loving",
    "family-focused and practical",
    "luxury-seeking and picky",
    "adventurous and easygoing",
  ];

  const preferredDockTypes = [...dockTypes].sort(() => Math.random() - 0.5).slice(0, 2);
  const likedFacilities = [...facilityTypes].sort(() => Math.random() - 0.5).slice(0, 2);
  const budget = randomInt(110, 320) + day * 5;
  let name = "";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${randomFrom(firstNames)} ${randomFrom(lastNames)}`;
    if (!recentFallbackNames.includes(candidate)) {
      name = candidate;
      break;
    }
  }

  if (!name) {
    name = `${randomFrom(firstNames)} ${randomFrom(lastNames)}`;
  }

  recentFallbackNames.unshift(name);
  recentFallbackNames.splice(12);

  return {
    name,
    personality: randomFrom(personalities),
    budget,
    preferences: {
      preferredDockTypes,
      likedFacilities,
      maxNightlyPrice: clamp(randomInt(38, 120) + day * 2, 30, budget),
      noiseTolerance: randomInt(1, 10),
    },
  };
}

function registerRecentGeneratedName(name: string) {
  recentGeneratedNames.unshift(name);
  recentGeneratedNames.splice(16);
}

function ensureUniqueBoaterName(name: string, fallbackName: string) {
  if (!recentGeneratedNames.includes(name)) {
    registerRecentGeneratedName(name);
    return name;
  }

  if (!recentGeneratedNames.includes(fallbackName)) {
    registerRecentGeneratedName(fallbackName);
    return fallbackName;
  }

  const suffix = randomInt(10, 99);
  const uniqueName = `${fallbackName.split(" ")[0]} ${suffix}`;
  registerRecentGeneratedName(uniqueName);
  return uniqueName;
}

export async function generateBoater(day: number) {
  const baseDraft = fallbackBoaterDraft(day);
  const fallback = () => baseDraft;
  const schema = {
    name: "string",
    personality: "string",
    budget: 220,
    preferences: {
      preferredDockTypes: dockTypes,
      likedFacilities: facilityTypes,
      maxNightlyPrice: 72,
      noiseTolerance: 5,
    },
  };

  const result = await requestStructuredJson<BoaterDraft>(
    "boater-generation",
    `You generate boaters for a harbor management game.
Return one JSON object only, matching this shape:
${JSON.stringify(schema)}
Preferred dock types must use these values only: ${dockTypes.join(", ")}.
Liked facilities must use these values only: ${facilityTypes.join(", ")}.
Make the boater plausible for day ${day}.`,
    fallback,
  );

  const merged: BoaterDraft = {
    ...baseDraft,
    ...result,
    preferences: {
      ...baseDraft.preferences,
      ...result.preferences,
    },
  };

  return {
    ...merged,
    name: ensureUniqueBoaterName(merged.name, baseDraft.name),
  } satisfies BoaterDraft;
}

function scoreDockFallback(boater: BoaterDraft, dock: DockCandidate) {
  const preferred = boater.preferences.preferredDockTypes.includes(dock.type) ? 18 : 0;
  const facilities =
    dock.nearbyFacilities.filter((facility) =>
      boater.preferences.likedFacilities.includes(facility),
    ).length * 8;
  const affordability =
    dock.price <= boater.preferences.maxNightlyPrice
      ? 18
      : Math.max(-30, boater.preferences.maxNightlyPrice - dock.price);
  const crowding = dock.occupancy > 0 ? -8 : 4;

  return preferred + facilities + affordability + crowding;
}

export async function chooseDock(
  boater: BoaterDraft,
  candidates: DockCandidate[],
) {
  const fallback = () => {
    const sorted = [...candidates].sort(
      (left, right) => scoreDockFallback(boater, right) - scoreDockFallback(boater, left),
    );
    const best = sorted[0];

    if (!best || scoreDockFallback(boater, best) < 10) {
      return {
        chosenStructureId: null,
        reason: "No dock fit the guest's budget and preferences well enough.",
      } satisfies DockDecision;
    }

    return {
      chosenStructureId: best.structureId,
      reason: `${best.type} matched the guest's comfort and price preferences.`,
    } satisfies DockDecision;
  };

  return requestStructuredJson<DockDecision>(
    "dock-selection",
    `Choose the best harbor dock for this guest.
Return one JSON object only with keys chosenStructureId and reason.
The guest: ${JSON.stringify(boater)}
Dock candidates: ${JSON.stringify(candidates)}`,
    fallback,
  );
}

export async function generateChatter(
  boater: Boater,
  nearbyFacilities: FacilityType[],
  weather: WeatherType,
) {
  const fallback = () => {
    const moods = [
      `The ${weather} weather is shaping today's mood.`,
      `I keep noticing ${nearbyFacilities[0] ?? "the shoreline"} around this slip.`,
      `This place feels ${boater.satisfaction >= 70 ? "worth the rate" : "a bit mixed"} so far.`,
    ];

    return {
      message: randomFrom(moods),
    } satisfies ChatterDraft;
  };

  return requestStructuredJson<ChatterDraft>(
    "guest-chatter",
    `Write one short line of guest chatter for a harbor sim.
Return one JSON object only with a message field.
Guest: ${JSON.stringify({
      name: boater.name,
      personality: boater.personality,
      satisfaction: boater.satisfaction,
    })}
Nearby facilities: ${JSON.stringify(nearbyFacilities)}
Weather: ${weather}`,
    fallback,
  );
}

export async function generateReview(
  boater: Boater,
  structures: Structure[],
) {
  const fallback = () => {
    const nearbyPrices = structures
      .filter((structure) => structure.type in structureDefinitions)
      .map((structure) => structure.price);

    const priceMood = average(nearbyPrices) > boater.preferences.maxNightlyPrice ? "pricey" : "fair";
    const stars = clamp(Math.round(boater.satisfaction / 20), 1, 5);

    return {
      stars,
      text: `${boater.name} found the harbor ${priceMood} but ${stars >= 4 ? "pleasant and scenic" : "uneven during the stay"}.`,
    } satisfies ReviewDraft;
  };

  return requestStructuredJson<ReviewDraft>(
    "guest-review",
    `Write a departing guest review for a harbor dock game.
Return one JSON object only with stars and text.
Stars must be an integer from 1 to 5.
Guest: ${JSON.stringify({
      name: boater.name,
      personality: boater.personality,
      satisfaction: boater.satisfaction,
      budget: boater.budget,
    })}`,
    fallback,
  );
}
