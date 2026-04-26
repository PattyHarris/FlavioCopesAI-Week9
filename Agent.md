# Harbor Dock Management Simulation Game

Build me a Harbor Dock Management simulation game called "Dock and Stay".

I manage a harbor on an isometric grid map. I build docks for sail boat, house boats, canoes and extra facilities (restrooms, showers, fire pits, playgrounds, a camp store). AI-powered boaters arrive every morning, evaluate the available dock spots, and decide whether to stay or leave.

The game needs:

- A 16x16 isometric grid map with terrain (grass, water, trees, paths, sand)
- A building system: click to place docks and facilities on empty tiles
- A tick-based game loop where each tick = 1 in-game hour, with speed controls (pause, 1x, 2x, 5x)
- AI-generated boaters that arrive each morning with a name, personality, budget, and preferences
- Dock selection: boaters evaluate available docks based on price, nearby facilities, and their preferences, then decide to stay or leave
- A satisfaction system that changes over time based on weather, facilities, neighbors, and pricing
- Reviews left by departing boaters (1-5 stars + text) that affect reputation
- Guest chatter: boaters comment on their experience throughout the day
- An economy: nightly revenue from occupied docs, daily maintenance costs for structures
- Weather that changes daily and affects satisfaction
- Seasons that affect boater demand
- Pricing controls per docks type

For AI, use Ollama, or any other local model tool currently running on this machine. Every AI feature (boater generation, dock selection, reviews, chatter) must have a template-based fallback for when the local model is unavailable.

All AI output must be structured JSON with a specific schema. Parse the first JSON object from the response.

Persist the full game state to IndexedDB so the game survives page refreshes. Autosave every few seconds.

Use React + TypeScript + Zustand for state management + Tailwind CSS for styling.

Make it feel like a real game, not a demo.

## Tech Stack

- React 19 + TypeScript with Vite. Functional components, hooks, strict types. The game is a client-side SPA with no server.

- Zustand for state management. A single store holds the entire game state. Actions for building, pricing, time, tourists, and everything else.

- Dexie.js (IndexedDB) for persistence. Autosaves every 2 seconds. Game speed also stored in localStorage for fast restore.

- A local model (via Ollama) for AI generation. A serial request queue sends one prompt at a time to avoid overloading the model. Every feature has a template fallback.

- Isometric CSS grid for the map. Diamond projection with CSS transforms, pan/zoom, and depth-sorted rendering.

- Tailwind CSS 4 with semantic color tokens for a consistent game UI.
