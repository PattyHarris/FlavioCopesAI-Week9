import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { getAiDebugSnapshot, subscribeToAiDebug } from "./ai/client";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "./db/gameDb";
import { dockTypes, facilityTypes, MAP_SIZE, structureDefinitions } from "./game/config";
import { useGameStore } from "./store/gameStore";
import type { DockType, GameSpeed, StructureType, Tile } from "./types/game";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function tileTerrainClass(tile: Tile) {
  return {
    water: "terrain-water",
    grass: "terrain-grass",
    sand: "terrain-sand",
    path: "terrain-path",
    tree: "terrain-tree",
  }[tile.terrain];
}

function BadgeIcon({ type }: { type: StructureType | "tree" }) {
  const common = {
    viewBox: "0 0 36 36",
    className: "badge-svg",
    "aria-hidden": true,
  } as const;

  switch (type) {
    case "tree":
      return (
        <svg {...common}>
          <circle cx="18" cy="12" r="8" fill="#77c46a" />
          <circle cx="12" cy="15" r="6" fill="#61aa57" />
          <circle cx="24" cy="15" r="6" fill="#61aa57" />
          <rect x="15.5" y="18" width="5" height="11" rx="2" fill="#7b5232" />
        </svg>
      );
    case "sailBoatDock":
      return (
        <svg {...common}>
          <path d="M8 24h20" stroke="#6b4c30" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 21h16l-3 5H13z" fill="#8b613a" />
          <path d="M18 8v13" stroke="#eef7ff" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 9l8 8h-8z" fill="#f9fafb" />
        </svg>
      );
    case "houseBoatDock":
      return (
        <svg {...common}>
          <path d="M9 24h18l-2 4H11z" fill="#8b613a" />
          <rect x="12" y="13" width="12" height="9" rx="2" fill="#f2d18b" />
          <path d="M11 15l7-5 7 5" fill="#d98657" />
          <rect x="15" y="16" width="3" height="6" fill="#7b5232" />
        </svg>
      );
    case "canoeDock":
      return (
        <svg {...common}>
          <path d="M8 23c3 3 17 3 20 0" fill="#b7723b" />
          <path d="M8 23c3 3 17 3 20 0" stroke="#7b5232" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 12l4 8" stroke="#e7eef6" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M16 18l8-4" stroke="#e7eef6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "restroom":
      return (
        <svg {...common}>
          <rect x="10" y="9" width="16" height="18" rx="4" fill="#70b8e8" />
          <circle cx="16" cy="14" r="2.5" fill="#e8f7ff" />
          <circle cx="22" cy="14" r="2.5" fill="#e8f7ff" />
          <path d="M16 17v6M22 17v6" stroke="#e8f7ff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "shower":
      return (
        <svg {...common}>
          <path d="M12 12c0-3 2-5 5-5s5 2 5 5" stroke="#85d4ff" strokeWidth="2.5" fill="none" />
          <path d="M17 12h6v4" stroke="#85d4ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M18 20l-1 4M22 20l-1 4M26 20l-1 4" stroke="#dff6ff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "firePit":
      return (
        <svg {...common}>
          <path d="M10 24h16" stroke="#7b5232" strokeWidth="3" strokeLinecap="round" />
          <path d="M15 24l3-4 3 4" fill="#8b613a" />
          <path d="M18 10c4 4 4 8 0 11-4-3-4-7 0-11z" fill="#ff8a3d" />
          <path d="M18 14c2 2 2 4 0 6-2-2-2-4 0-6z" fill="#ffd25f" />
        </svg>
      );
    case "playground":
      return (
        <svg {...common}>
          <path d="M10 24h16" stroke="#7b5232" strokeWidth="3" strokeLinecap="round" />
          <path d="M12 23V11h12v12" stroke="#ffcc5c" strokeWidth="2.5" fill="none" />
          <path d="M13 12l5-4 5 4" fill="#ff7f66" />
          <circle cx="18" cy="18" r="4" fill="#70b8e8" />
        </svg>
      );
    case "campStore":
      return (
        <svg {...common}>
          <rect x="10" y="13" width="16" height="13" rx="2" fill="#f2d18b" />
          <path d="M9 13l2-5h14l2 5" fill="#ff7f66" />
          <rect x="14" y="18" width="4" height="8" fill="#7b5232" />
          <rect x="20" y="17" width="4" height="4" fill="#8ed7ff" />
        </svg>
      );
  }
}

function buildOptions(): StructureType[] {
  return [
    "sailBoatDock",
    "houseBoatDock",
    "canoeDock",
    "restroom",
    "shower",
    "firePit",
    "playground",
    "campStore",
  ];
}

function tileDepth(x: number, y: number) {
  return (y + 1) * 100 + x;
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

function isoPosition(x: number, y: number) {
  return {
    left: (x - y) * (TILE_WIDTH / 2),
    top: (x + y) * (TILE_HEIGHT / 2),
  };
}

function structureBadgeClass(type: StructureType) {
  return {
    sailBoatDock: "structure-marker-dock",
    houseBoatDock: "structure-marker-dock",
    canoeDock: "structure-marker-dock",
    restroom: "structure-marker-utility",
    shower: "structure-marker-utility",
    firePit: "structure-marker-leisure",
    playground: "structure-marker-leisure",
    campStore: "structure-marker-commerce",
  }[type];
}

const MapPanel = memo(function MapPanel() {
  const tiles = useGameStore((state) => state.tiles);
  const structures = useGameStore((state) => state.structures);
  const selectedTile = useGameStore((state) => state.selectedTile);
  const forecast = useGameStore((state) => state.weather.forecast);
  const placeStructure = useGameStore((state) => state.placeStructure);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 140 });
  const pointerState = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sortedTiles = [...tiles].sort((left, right) => left.y - right.y || left.x - right.x);
  const boardWidth = MAP_SIZE * TILE_WIDTH;
  const boardHeight = MAP_SIZE * TILE_HEIGHT;
  const selectedStructure = selectedTile
    ? structures.find(
        (structure) => structure.x === selectedTile.x && structure.y === selectedTile.y,
      ) ?? null
    : null;
  const selectedTileDetails = selectedTile
    ? tiles.find((tile) => tile.x === selectedTile.x && tile.y === selectedTile.y) ?? null
    : null;

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".tile-overlay")) {
      return;
    }

    if (event.button !== 1 && event.button !== 2) {
      return;
    }

    pointerState.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleViewportPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (!state.moved && Math.hypot(deltaX, deltaY) > 4) {
      state.moved = true;
    }

    if (state.moved) {
      setPan({
        x: state.originX + deltaX,
        y: state.originY + deltaY,
      });
    }
  }

  function releasePointer(event: React.PointerEvent<HTMLDivElement>) {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerState.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: pan.x,
      originY: pan.y,
      moved: state.moved,
    };
  }

  function handleTileClick(x: number, y: number) {
    if (pointerState.current.moved) {
      pointerState.current.moved = false;
      return;
    }

    placeStructure(x, y);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - pan.x) / zoom;
    const worldY = (cursorY - pan.y) / zoom;
    const nextZoom = Math.min(3, Math.max(0.5, zoom + (event.deltaY < 0 ? 0.1 : -0.1)));

    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: cursorX - worldX * nextZoom,
      y: cursorY - worldY * nextZoom,
    });
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 140 });
  }

  return (
    <section className="panel overflow-hidden rounded-[32px] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Harbor Map</div>
          <div className="text-sm text-[var(--muted)]">
            Docks belong on water. Facilities belong on land, sand, or paths. Right-drag to pan, wheel to zoom.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Left click select/place · Right drag pan · Wheel zoom
          </div>
          <button
            type="button"
            onClick={resetView}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted)] transition hover:bg-white/10 hover:text-white"
          >
            Reset View
          </button>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted)]">
            Forecast: <span className="capitalize text-white">{forecast}</span>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted)]">
            Zoom: <span className="text-white">{zoom.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="iso-viewport rounded-[28px] border border-white/10 bg-black/10"
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onContextMenu={(event) => event.preventDefault()}
        onWheel={handleWheel}
      >
        <div
          className="map-board"
          style={{
            width: boardWidth,
            height: boardHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {sortedTiles.map((tile) => {
            const structure = structures.find((candidate) => candidate.id === tile.structureId);
            const position = isoPosition(tile.x, tile.y);

            return (
              <button
                key={`${tile.x}-${tile.y}`}
                type="button"
                onClick={() => handleTileClick(tile.x, tile.y)}
                className="iso-tile-wrap"
                title={`${tile.terrain} (${tile.x}, ${tile.y})`}
                style={{
                  left: position.left + boardWidth / 2 - TILE_WIDTH / 2,
                  top: position.top,
                  zIndex:
                    tileDepth(tile.x, tile.y) +
                    (selectedTile?.x === tile.x && selectedTile.y === tile.y ? 1000 : 0),
                }}
              >
                <div
                  className={clsx(
                    "tile-surface tile-diamond iso-tile-surface border border-white/15 shadow-lg shadow-black/20",
                    tileTerrainClass(tile),
                    selectedTile?.x === tile.x && selectedTile.y === tile.y && "ring-2 ring-amber-300/80",
                  )}
                />
                {tile.terrain === "tree" && (
                  <div className="tree-canopy">
                    <BadgeIcon type="tree" />
                  </div>
                )}
                {structure && (
                  <>
                    <div
                      className={clsx(
                        "structure-marker",
                        structureBadgeClass(structure.type),
                      )}
                    >
                      <BadgeIcon type={structure.type} />
                    </div>
                  </>
                )}
                {structure && structure.occupiedBy.length > 0 && <div className="boater-chip" />}
              </button>
            );
          })}
        </div>

        {selectedTileDetails && (
          <aside className="tile-overlay panel">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Selected Tile</div>
            <div className="mt-2 font-semibold">
              {selectedTileDetails.x}, {selectedTileDetails.y}
            </div>
            <div className="mt-1 text-sm capitalize text-[var(--muted)]">
              Terrain: {selectedTileDetails.terrain}
            </div>
            <div className="mt-2 text-sm">
              {selectedStructure
                ? structureDefinitions[selectedStructure.type].name
                : "No structure placed"}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
});

const DiagnosticsPanel = memo(function DiagnosticsPanel({
  diagnosticsOpen,
  setDiagnosticsOpen,
}: {
  diagnosticsOpen: boolean;
  setDiagnosticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const tiles = useGameStore((state) => state.tiles);
  const structures = useGameStore((state) => state.structures);
  const selectedTile = useGameStore((state) => state.selectedTile);
  const debugLog = useGameStore((state) => state.debugLog);
  const aiDebug = useSyncExternalStore(subscribeToAiDebug, getAiDebugSnapshot, getAiDebugSnapshot);
  const placedTileCount = tiles.filter((tile) => tile.structureId !== null).length;
  const selectedStructure = selectedTile
    ? structures.find(
        (structure) => structure.x === selectedTile.x && structure.y === selectedTile.y,
      ) ?? null
    : null;
  const selectedTileDetails = selectedTile
    ? tiles.find((tile) => tile.x === selectedTile.x && tile.y === selectedTile.y) ?? null
    : null;
  const referencedStructures = structures.filter((structure) =>
    tiles.some((tile) => tile.structureId === structure.id),
  );
  const recentStructures = referencedStructures.slice(-6).reverse();

  return (
    <section className="panel rounded-[28px] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Diagnostics</div>
          <div className="text-sm text-[var(--muted)]">
            AI status, structure consistency, and recent debug events.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDiagnosticsOpen((open) => !open)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
          aria-expanded={diagnosticsOpen}
          aria-controls="diagnostics-panel"
          title={diagnosticsOpen ? "Hide diagnostics" : "Show diagnostics"}
        >
          {diagnosticsOpen ? "▾ Hide" : "▸ Show"}
        </button>
      </div>

      {diagnosticsOpen && (
        <div id="diagnostics-panel" className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/4 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>AI source</span>
              <span className={clsx(
                "rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.18em]",
                aiDebug.lastSource === "ollama"
                  ? "bg-emerald-400/15 text-emerald-200"
                  : aiDebug.lastSource === "fallback"
                    ? "bg-amber-300/15 text-amber-100"
                    : "bg-white/10 text-[var(--muted)]",
              )}>
                {aiDebug.lastSource}
              </span>
            </div>
            <div className="mt-2 text-[var(--muted)]">
              Feature: {aiDebug.lastFeature ?? "none yet"}
            </div>
            <div className="text-[var(--muted)]">
              Requests: {aiDebug.requests}, fallbacks: {aiDebug.fallbacks}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {aiDebug.lastError ? `Last AI error: ${aiDebug.lastError}` : "No recent AI error."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/4 p-3 text-sm">
            <div>Structures in state: {referencedStructures.length}</div>
            <div>Tiles with structure refs: {placedTileCount}</div>
            <div>Selected terrain: {selectedTileDetails?.terrain ?? "none"}</div>
            <div>Selected structure: {selectedStructure ? structureDefinitions[selectedStructure.type].name : "none"}</div>
            <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Recent structures</div>
            <div className="soft-scroll mt-2 max-h-[140px] space-y-1 overflow-auto pr-1 text-sm">
              {recentStructures.length === 0 ? (
                <div className="text-[var(--muted)]">No structures placed yet.</div>
              ) : (
                recentStructures.map((structure) => (
                  <div key={structure.id}>
                    {structureDefinitions[structure.type].name} at {structure.x},{structure.y}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="soft-scroll max-h-[220px] overflow-auto rounded-2xl border border-white/10 bg-white/4 p-3 md:col-span-2">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Event Log</div>
            <div className="space-y-2 text-sm">
              {debugLog.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/8 bg-black/10 p-2.5">
                  <div className="text-xs text-[var(--muted)]">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </div>
                  <div>{entry.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

export default function App() {
  const initialized = useRef(false);
  const ticking = useRef(false);
  const resetting = useRef(false);
  const mismatchSignature = useRef<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(() => {
    return localStorage.getItem("dock-and-stay-diagnostics-open") === "true";
  });
  const {
    tiles,
    structures,
    dockPricing,
    boaters,
    reviews,
    chatterLog,
    buildMode,
    selectedTile,
    clock,
    weather,
    economy,
    debugLog,
    loading,
    logDebug,
    resetGame,
    setBuildMode,
    placeStructure,
    setDockPrice,
    setSpeed,
    advanceTime,
    loadSnapshotIntoStore,
    markLoaded,
  } = useGameStore();

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    void loadSnapshot()
      .then((snapshot) => {
        if (snapshot) {
          loadSnapshotIntoStore(snapshot);
        } else {
          markLoaded();
        }
      })
      .catch(() => {
        markLoaded();
      });
  }, [loadSnapshotIntoStore, markLoaded]);

  useEffect(() => {
    if (loading || clock.speed === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      if (ticking.current || resetting.current) {
        return;
      }

      ticking.current = true;
      void advanceTime(clock.speed).finally(() => {
        ticking.current = false;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [advanceTime, clock.speed, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const timer = window.setInterval(() => {
      if (resetting.current) {
        return;
      }

      const snapshot = useGameStore.getState();
      void saveSnapshot({
        version: snapshot.version,
        tiles: snapshot.tiles,
        structures: snapshot.structures,
        dockPricing: snapshot.dockPricing,
        boaters: snapshot.boaters,
        departedBoaters: snapshot.departedBoaters,
        reviews: snapshot.reviews,
        chatterLog: snapshot.chatterLog,
        debugLog: snapshot.debugLog,
        buildMode: snapshot.buildMode,
        selectedTile: snapshot.selectedTile,
        clock: snapshot.clock,
        weather: snapshot.weather,
        economy: snapshot.economy,
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    localStorage.setItem("dock-and-stay-diagnostics-open", String(diagnosticsOpen));
  }, [diagnosticsOpen]);

  useEffect(() => {
    const placedTileCount = tiles.filter((tile) => tile.structureId !== null).length;
    const missingTileRefs = structures.filter((structure) => {
      const tile = tiles.find((candidate) => candidate.x === structure.x && candidate.y === structure.y);
      return !tile || tile.structureId !== structure.id;
    }).length;
    const orphanTileRefs = tiles.filter(
      (tile) =>
        tile.structureId !== null &&
        !structures.some((structure) => structure.id === tile.structureId),
    ).length;

    const nextSignature = `${placedTileCount}:${structures.length}:${missingTileRefs}:${orphanTileRefs}`;

    if (mismatchSignature.current === nextSignature) {
      return;
    }

    mismatchSignature.current = nextSignature;

    if (missingTileRefs > 0 || orphanTileRefs > 0) {
      logDebug(
        `Consistency warning: ${structures.length} structures, ${placedTileCount} tile refs, ${missingTileRefs} missing refs, ${orphanTileRefs} orphan refs.`,
      );
    }
  }, [logDebug, structures, tiles]);

  const occupiedDocks = structures.filter((structure) => structure.occupiedBy.length > 0).length;
  const totalDocks = structures.filter((structure) => dockTypes.includes(structure.type as DockType)).length;
  const placedTileCount = tiles.filter((tile) => tile.structureId !== null).length;
  async function handleNewGame() {
    const confirmed = window.confirm(
      "Start a new game? This will clear the current saved harbor and begin fresh.",
    );

    if (!confirmed) {
      return;
    }

    resetting.current = true;
    ticking.current = false;
    mismatchSignature.current = null;

    try {
      await clearSnapshot();
      resetGame();

      const fresh = useGameStore.getState();
      await saveSnapshot({
        version: fresh.version,
        tiles: fresh.tiles,
        structures: fresh.structures,
        dockPricing: fresh.dockPricing,
        boaters: fresh.boaters,
        departedBoaters: fresh.departedBoaters,
        reviews: fresh.reviews,
        chatterLog: fresh.chatterLog,
        debugLog: fresh.debugLog,
        buildMode: fresh.buildMode,
        selectedTile: fresh.selectedTile,
        clock: fresh.clock,
        weather: fresh.weather,
        economy: fresh.economy,
      });
    } finally {
      resetting.current = false;
    }
  }

  if (loading) {
    return (
      <main className="game-shell flex min-h-screen items-center justify-center p-6">
        <div className="panel rounded-3xl px-8 py-6 text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Loading Harbor</div>
          <div className="mt-2 text-3xl font-semibold">Restoring Dock and Stay</div>
        </div>
      </main>
    );
  }

  return (
    <main className="game-shell min-h-screen p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="panel rounded-[28px] px-5 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Harbor Management Sim</div>
              <h1 className="text-3xl font-semibold">Dock and Stay</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                Build the waterfront, price each dock type, and keep your AI-powered guests happy enough to return glowing reviews.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleNewGame();
                  }}
                  className="rounded-full border border-white/15 bg-white/6 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  New Game
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="stat-card rounded-2xl px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">Cash</div>
                  <div className="text-xl font-semibold">{formatCurrency(economy.cash)}</div>
                </div>
                <div className="stat-card rounded-2xl px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">Reputation</div>
                  <div className="text-xl font-semibold">{economy.reputation}/100</div>
                </div>
                <div className="stat-card rounded-2xl px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">Occupancy</div>
                  <div className="text-xl font-semibold">{occupiedDocks}/{totalDocks}</div>
                </div>
                <div className="stat-card rounded-2xl px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">Weather</div>
                  <div className="text-xl font-semibold capitalize">{weather.today}</div>
                </div>
                <div className="stat-card rounded-2xl px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">Time</div>
                  <div className="text-xl font-semibold">Day {clock.day}, {String(clock.hour).padStart(2, "0")}:00</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="panel soft-scroll rounded-[28px] p-4">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Build Menu</div>
            <div className="mt-3 grid gap-2">
              {buildOptions().map((option) => {
                const definition = structureDefinitions[option];

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      const nextMode = buildMode === option ? null : option;
                      setBuildMode(nextMode);

                      if (nextMode && selectedTile) {
                        placeStructure(selectedTile.x, selectedTile.y);
                      }
                    }}
                    className={clsx(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      buildMode === option
                        ? "border-amber-300/60 bg-amber-300/15"
                        : "border-white/10 bg-white/4 hover:bg-white/8",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{definition.name}</span>
                      <span className="text-xs text-[var(--muted)]">{formatCurrency(definition.buildCost)}</span>
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {definition.category === "dock" ? "Dock" : "Facility"} on {definition.allowedTerrains.join(", ")}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Time Controls</div>
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setSpeed(speed as GameSpeed)}
                  className={clsx(
                    "rounded-full border px-4 py-2 text-sm",
                    clock.speed === speed
                      ? "border-amber-300/60 bg-amber-300/15"
                      : "border-white/10 bg-white/5",
                  )}
                >
                  {speed === 0 ? "Pause" : `${speed}x`}
                </button>
              ))}
            </div>

            <div className="mt-6 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Dock Pricing</div>
            <div className="mt-3 space-y-3">
              {dockTypes.map((dockType) => {
                const defaultValue = dockPricing[dockType];

                return (
                  <label key={dockType} className="block rounded-2xl border border-white/10 bg-white/4 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{structureDefinitions[dockType].name}</span>
                      <span className="text-[var(--muted)]">{formatCurrency(defaultValue)}</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={160}
                      step={1}
                      value={defaultValue}
                      onChange={(event) => setDockPrice(dockType, Number(event.target.value))}
                      className="mt-3 w-full accent-amber-300"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Selected Tile</div>
              {selectedTile ? (
                <div className="mt-2 space-y-1 text-sm">
                  <div>Coordinates: {selectedTile.x}, {selectedTile.y}</div>
                  <div>
                    Click a build option to place it on this tile, or click another tile to move selection.
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-[var(--muted)]">Pick a tile or start building.</div>
              )}
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            <MapPanel />
            <DiagnosticsPanel
              diagnosticsOpen={diagnosticsOpen}
              setDiagnosticsOpen={setDiagnosticsOpen}
            />
          </section>

          <aside className="grid gap-4">
            <section className="panel rounded-[28px] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Guests</div>
                  <div className="text-sm text-[var(--muted)]">{boaters.length} currently staying</div>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
                  Revenue tonight {formatCurrency(economy.nightlyRevenue)}
                </div>
              </div>
              <div className="soft-scroll mt-4 max-h-[250px] space-y-3 overflow-auto pr-1">
                {boaters.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-[var(--muted)]">
                    No current guests. Build more docks and let the morning arrivals begin.
                  </div>
                ) : (
                  boaters.map((boater) => (
                    <article key={boater.id} className="rounded-2xl border border-white/10 bg-white/4 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{boater.name}</div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            {boater.personality}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div>{boater.satisfaction}%</div>
                          <div className="text-xs text-[var(--muted)]">satisfaction</div>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-[var(--muted)]">
                        Budget {formatCurrency(boater.budget)}. {boater.stayHoursRemaining}h remaining.
                      </div>
                      <div className="mt-2 text-sm">
                        {boater.chatter[0] ?? "Settling into the harbor."}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="panel rounded-[28px] p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Guest Chatter</div>
              <div className="soft-scroll mt-4 max-h-[280px] space-y-2 overflow-auto pr-1">
                {chatterLog.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/4 p-3 text-sm break-words">
                    <div className="font-semibold">{entry.boaterName}</div>
                    <div className="mt-1 text-[var(--muted)]">
                      Day {entry.day} at {String(entry.hour).padStart(2, "0")}:00
                    </div>
                    <div className="mt-1">{entry.message}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel rounded-[28px] p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Reviews</div>
              <div className="soft-scroll mt-4 max-h-[320px] space-y-3 overflow-auto pr-1">
                {reviews.slice(0, 6).map((review) => (
                  <article key={review.id} className="rounded-2xl border border-white/10 bg-white/4 p-3 break-words">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{review.boaterName}</div>
                      <div className="text-sm">{Array.from({ length: review.stars }, () => "★").join("")}</div>
                    </div>
                    <div className="mt-2 text-sm">{review.text}</div>
                    <div className="mt-2 text-xs text-[var(--muted)]">Day {review.day}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel rounded-[28px] p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Facilities</div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                {facilityTypes.map((type) => {
                  const count = structures.filter((structure) => structure.type === type).length;

                  return (
                    <div key={type} className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5">
                      {structureDefinitions[type].name}: <span className="text-white">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
