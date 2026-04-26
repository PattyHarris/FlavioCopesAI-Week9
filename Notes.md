# Build a Game with AI Characters

Build a simulation game where AI-driven characters make their own decisions, react to the world around them, and talk to each other. This is the week where the AI is not a tool you call. It is part of the world you build.

## Ollama

Installed via the online installer - after which you need to "run" the application in the Application folder - this puts in a background task, so to speak, that can be changed in settings. You can verify that it's running with ollama --version

From Google: The Ollama installation package does not include any models by default. You download a model using the pull command.

> ollama pull gemma4

Where in this case Flavio used gemma3 (4b) so the command is

> ollama pull gemma3:4b

## Starter Prompt

I've read that the agent's expect the starter prompt to be in Agent.md, so this is different than other projects where I've used initialPrompt.md.

See Agent.md as well for the Tech Stack which is what Flavio used. I installed the necessary components and local model ahead.

## Debugging Session

### Disappearing Elements

You were on the right track about the timing, but the underlying cause was slightly different: the async simulation tick was finishing with an older copy of state and overwriting newer player actions like placing a shower or selecting a tile.

I fixed that in [src/store/gameStore.ts](/Users/pattyharris/Documents/FlavioCopesBootcamp/AIBootcamp/Week9/src/store/gameStore.ts) by merging each completed tick back into the latest store state instead of blindly replacing it. That preserves:

- newly placed structures
- selected tile/build UI state
- dock pricing changes
- cash spent during the tick

while still applying the simulation updates for time, guests, chatter, reviews, weather, and economy.

I also kept the earlier map isolation improvements in place. `npm run build` succeeds.

Please try this again:

1. `New Game`
2. place a shower
3. wait for guest/chatter updates

What I’m expecting now is:

- the shower should stay on the grid
- the selected tile should stay selected unless you change it
- diagnostics should continue to show the placed structure

If anything still disappears, tell me whether `Recent structures` still lists it by coordinates after it vanishes visually.

### Resolving Further Issues

For the next test, I’d do:

- New Game
- place a few docks
- let guests arrive
- check whether:
  - Occupancy becomes non-zero
  - dock markers appear on occupied docks
  - Hours remaining decreases over time
  - nightly revenue becomes positive

If occupancy is still 0/7 while guests clearly show as staying, send me one guest’s name plus the exact diagnostics/revenue values at that moment and I’ll trace the remaining mismatch.

## Isometric Grid

Asked the agent for this: Replace the flat grid with an isometric diamond projection. Each tile should be 64x32 pixels, rendered with CSS transforms. Add click-and-drag panning and mouse wheel zoom (0.5x to 3x). Tiles render in row-major order with z-index based on position for correct depth sorting. Add terrain variation: grass, water (a lake in one corner), trees along the edges, and paths through the center. Clicking a tile selects it and shows a detail overlay.

From the agent: I’m going to replace the current row-stacked map with a true isometric board: absolute-positioned 64x32 diamond tiles, pan/zoom controls, richer terrain generation, and a selected-tile detail overlay. Then I’ll wire it back into the existing placement flow instead of bolting on a separate demo.

The map in src/App.tsx is now a true isometric board with 64x32 diamond tiles positioned absolutely, rendered in row-major order with position-based z-index. I also added:

- click-and-drag panning
- mouse wheel zoom from 0.5x to 3x
- a selected-tile detail overlay inside the map viewport
- richer terrain generation in src/game/map.ts with a corner lake, edge trees, and center paths

How it should work now:

Click and hold anywhere on the map, including directly on tiles
Move the mouse while still holding
The whole map should slide with your drag
Release the mouse to stop panning
A normal click without moving should still select/place on a tile.

What was wrong before:

dragging only started if you clicked empty background, not a tile
zoom was centered badly, so it felt like the map was “running away”
I fixed both in src/App.tsx:

panning now starts from tiles too
wheel zoom now zooms toward the mouse position
I also added a Reset View button so you can quickly recover if the map drifts somewhere awkward
npm run build still succeeds.

When you test:

if you hold and move even a little, it should pan
if you just click and release without moving, it should select/place
if the zoom/pan ever feels weird, click Reset View

Please test this flow:

left click a tile
click a build item like Shower
confirm it places
then try right-click drag to pan
use wheel zoom as before
If you want, I can also add small on-screen control hints like:

Left click: select/place
Right drag: pan
Wheel: zoom

## UI Tweaks

Updated the badges so each category now has a slightly different frame shape in src/App.tsx and src/index.css:

docks use a rounded dock-style frame
utilities like restroom/shower use a squarer frame
leisure items like fire pit/playground use a circular frame
the camp store uses a more storefront-style rounded shape
