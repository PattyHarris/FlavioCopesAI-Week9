# Dock and Stay

`Dock and Stay` is a harbor dock management simulation game set on an isometric grid. Players build docks and guest facilities, manage pricing, respond to weather and seasonal demand, and try to keep AI-powered boaters happy enough to stay, spend money, and leave strong reviews.

This README is the living project reference for the workspace. It summarizes the current game direction, the planned technical architecture, and relevant session notes as the project evolves.

## Game Vision

The game centers on running a small harbor that grows over time:

- Build and manage a `16x16` isometric map with water, grass, trees, sand, and paths
- Place docks for sail boats, house boats, and canoes
- Add supporting facilities like restrooms, showers, fire pits, playgrounds, and a camp store
- Simulate hourly time with pause, `1x`, `2x`, and `5x` speed controls
- Generate daily arriving boaters with names, budgets, personalities, and preferences
- Let boaters evaluate dock options based on price, amenities, and fit
- Track satisfaction, reviews, reputation, weather, seasons, revenue, and maintenance costs

## Planned Tech Stack

The intended stack from [Agent.md](/Users/pattyharris/Documents/FlavioCopesBootcamp/AIBootcamp/Week9/Agent.md) is:

- React 19 + TypeScript with Vite
- Zustand for global game state
- Tailwind CSS 4 for UI styling
- Dexie.js + IndexedDB for persistence and autosave
- Ollama or another local model runtime for AI features
- Template-based fallbacks for every AI-driven system

## Current Workspace Status

What is currently present in this workspace:

- A Vite + React 19 + TypeScript client app
- Zustand state management for the full simulation state
- Dexie-based IndexedDB persistence with autosave support
- Tailwind CSS 4 styling and a custom game-themed UI layer
- AI guest generation, dock selection, chatter, and review services with Ollama-first and template fallback behavior
- `Agent.md` contains the main project brief and target architecture
- `Notes.md` contains assignment notes and local model setup context

What still appears to be pending:

- deeper balancing and tuning across prices, maintenance, and guest behavior
- richer map interactions like bulldozing, pathing rules, and advanced placement constraints
- more visual polish for animations, sound, onboarding, and progression systems
- optional stronger schema validation for model responses

## Core System Requirements

The current project brief requires:

- A client-side SPA with no server
- A single Zustand store for the full game state
- IndexedDB persistence with autosave every `2` seconds
- Game speed cached in `localStorage` for fast restore
- Structured JSON responses from the local model
- Parsing the first JSON object from model responses
- A serial AI request queue to avoid overloading the local model
- Template fallbacks whenever the model is unavailable or malformed

## How To Run The Project

If you are new to Ollama, think of this project as having two separate parts:

- the game app
- the optional local AI model

### 1. Run the game app

Start the local development server with:

```bash
npm run dev
```

That starts the Vite app so you can open the local URL shown in the terminal and play the game in your browser.

### 2. Understand what Ollama is doing

The game can use a local AI model for:

- boater generation
- dock selection decisions
- guest chatter
- departing reviews

The app currently expects Ollama to be available at:

`http://127.0.0.1:11434/api/generate`

That means:

- `127.0.0.1` = your own computer
- `11434` = the default Ollama port
- `/api/generate` = the Ollama API route the game calls

The model currently referenced by the game is:

`gemma3:4b`

### 3. Check whether Ollama is installed

In your terminal, run:

```bash
ollama --version
```

If that works, Ollama is installed.

### 4. Check which models you already have

Run:

```bash
ollama list
```

If you do not see `gemma3:4b`, download it with:

```bash
ollama pull gemma3:4b
```

### 5. Make sure Ollama is running

On many machines, launching the Ollama app is enough to start the local service. Once it is running, the game can send AI requests to it.

### 6. What happens if Ollama is not running?

The game still works.

Every AI-driven feature also has a template fallback, so if Ollama is unavailable or returns invalid data, the simulation continues with local non-model logic instead of breaking.

## Beginner Run Checklist

Use this order if you want the simplest setup:

1. Open or start Ollama
2. Run `ollama list`
3. If needed, run `ollama pull gemma3:4b`
4. Run `npm run dev`
5. Open the browser URL shown by Vite

## Troubleshooting Ollama

If something is not working, these are the first things to check.

### `ollama: command not found`

Ollama is not installed or is not available in your terminal path yet.

Try:

- install Ollama
- restart the terminal
- run `ollama --version` again

### Ollama is installed, but the game still seems to use fallback behavior

The most common reasons are:

- Ollama is not currently running
- the `gemma3:4b` model is not installed
- Ollama is running on a different port or with a different setup

Check:

```bash
ollama list
```

If `gemma3:4b` is missing:

```bash
ollama pull gemma3:4b
```

### The model download is slow

That is normal the first time. Local models can be several gigabytes, and download speed depends on your internet connection and machine.

### I started the game, but I cannot tell whether Ollama is being used

Right now the game is designed to fail gracefully and continue with template fallback logic. That means the app should keep working even if the model is unavailable.

If the simulation runs but the AI feels generic, fallback behavior may be active.

### The app runs, but the model requests still fail

The current code expects Ollama at:

`http://127.0.0.1:11434/api/generate`

If your Ollama setup is different, the app would need a small configuration update in the AI client code.

### `npm run dev` works, but Ollama does not

That is okay. These are separate pieces:

- `npm run dev` starts the web app
- Ollama powers the optional local AI features

You can keep building and testing the game even before Ollama is fully working.

## Suggested Initial Architecture

As the codebase is built out, this structure should fit the current brief well:

- `src/components` for UI panels, controls, overlays, and reusable pieces
- `src/game` for simulation logic, economy rules, satisfaction math, and time progression
- `src/map` for terrain, tile definitions, placement rules, and isometric rendering helpers
- `src/ai` for prompt builders, schema validation, queueing, parsing, and fallback generators
- `src/store` for Zustand state, actions, selectors, and persistence hooks
- `src/db` for Dexie schema and save/load helpers
- `src/types` for shared TypeScript models and JSON schemas

## Session Log

### 2026-04-24

- Created this `README.md` as the main living project reference
- Captured the game concept, target stack, and current repo status
- Noted that the workspace currently contains the project brief and `zustand`, but not yet the full app scaffold
- Installed the core app dependencies for a Vite + React + TypeScript implementation
- Built the first playable version of the game with an isometric harbor map, build placement, pricing controls, a tick-based simulation loop, AI guest systems with Ollama fallback logic, and IndexedDB autosave
- Added persistent dock-type pricing and protected the simulation clock from overlapping async AI ticks
- Verified the project with a successful production build via `npm run build`
- Added an in-game diagnostics panel with AI source status, structure consistency counts, and a debug event log to help trace placement/state issues
- Rebalanced the early game economy with more starting cash, cheaper early construction, stronger dock pricing, and more reliable morning arrivals
- Added a `New Game` reset flow that clears the saved harbor and starts a fresh session from the UI
- Fixed async tick/state merge issues that could leave ghost structures in diagnostics, expanded fallback guest variety, and lengthened guest stays so revenue feels more consistent
- Fixed repeated boater draft reuse, enforced dock capacity during guest selection, and made nightly revenue reflect occupied slips more accurately
- Synced dock occupancy directly from staying boaters so occupancy, boater markers, and nightly revenue stay consistent, and improved scroll behavior for diagnostics, chatter, and reviews
- Added a store-level time-advance guard and monotonic clock merge so late async ticks cannot rewind the visible in-game day/hour display
- Replaced the map with a true isometric 64x32 diamond projection, added click-and-drag panning, mouse-wheel zoom from `0.5x` to `3x`, richer terrain layout, and an in-map selected tile detail overlay
- Expanded the isometric lake footprint and shoreline sand so the harbor water area occupies more of the map and feels better proportioned against the buildable land
- Reshaped the enlarged lake into a more organic inlet with a less blocky shoreline so the harbor corner reads more naturally in the isometric view
- Swapped map labels for more playful icon-based structure and terrain markers so trees and facilities read visually without text clutter
- Refined map interaction so left click is reserved for select/place, right-drag pans the isometric board, wheel zoom anchors to the cursor, and a `Reset View` control plus on-screen interaction hints keep navigation understandable
- Replaced emoji markers with custom inline SVG-style badges and added category-specific frame shapes so docks, utilities, leisure buildings, and commerce read more clearly at a glance
- Fixed new game/session reset bugs where older async simulation work could restore stale day counts or state after reset by adding stronger session-token guards
- Fixed simulation/state reconciliation issues that caused phantom structures, duplicated diagnostics entries, inconsistent occupancy, stuck guest hour counters, and incorrect nightly revenue
- Improved fallback guest generation by widening budgets and names, reducing obvious repetition, and lengthening stays so the economy feels more believable during non-Ollama runs
- Generated a high-resolution Playwright screenshot asset at `show-and-tell.png` for Discord/show-and-tell use

## Working Agreement For This README

This file should be updated when relevant project information changes, especially:

- major architecture decisions
- new dependencies or tooling
- implemented systems
- AI/model integration details
- persistence changes
- milestone progress
- notable session decisions that affect future work
