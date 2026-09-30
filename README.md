# Stack & Wrap

**A mobile-first 3D gift-shop tycoon for the browser: stack boxes, wrap presents, serve the queue, and grow a tiny shop into a forest, a dinosaur valley and a crystal mine.**

![Status: in development](https://img.shields.io/badge/status-in%20development-orange) ![Three.js](https://img.shields.io/badge/Three.js-r185-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

> This repository is a **showcase** of a game in development: what it is, how it is built, and a few excerpts of
> the source. The full source and a playable build are not public yet.

## In plain words

Stack & Wrap is a small game for the web browser, on a phone or a computer. You run a gift shop: you pick up boxes,
take them to a table where they get wrapped, and hand the gifts to customers who pay you. With the money you hire
helpers and open new areas, such as a forest with bears and a hidden crystal mine. What makes it interesting to build
is that hundreds of items can fly around the screen at once while the game still keeps an exact count of every one,
and it stays smooth on an ordinary phone.

## Gameplay loop

1. **Collect**: walk to the box depot and pick up boxes. They pile onto a physical stack you carry.
2. **Wrap**: drop the boxes at the gift-wrapping bench, which turns each one into a wrapped gift over time.
3. **Sell**: carry the gifts to the counter, where a queue of customers is waiting.
4. **Cash in**: pick up the cash they leave and stand on upgrade pads to spend it.
5. **Automate and expand**: hire helpers, raise your stats and unlock new zones with new production chains.

## Features

- **Physical stacking and transfers**: items fly between you, stations and customers along arcs, while the logical
  counts stay exact however large a stack gets.
- **Upgrades**: backpack capacity, move speed, supply rate, sale prices, fast pay, storage and gift-wrap speed.
- **Automation helpers**: each stage of the economy has its own helper (a worker, a gift trolley, a BBQ ant, a waiter
  and a bone-fetching dog), each with its own levels.
- **Unlockable zones**: a forest with bears and a barbecue where meat can burn, a dinosaur valley whose bones become
  fertilizer, a plantation, and a crystal mine behind a portal with its own pickaxe tiers, minecart and refinery.
- **Combat progression**: weapon tiers, armor and timed special missions.
- **Mobile-first rendering**: device quality presets, scenery culling, shared geometries and materials, a minimap.
- **Persistent saves** in the browser, versioned and migrated so older saves keep loading.

## Under the hood

A walkthrough for developers (module map, frame loop, save format, how a production chain is added) is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Excerpts of the modules described below are in [`samples/`](samples).

**Transfers: logic moves once, visuals just follow.** Every item that changes hands goes through a transfer system
([`samples/TransferSystem.ts`](samples/TransferSystem.ts)). A request becomes a queue of single-item launches spaced by
an interval; each item flies on a cubic ease-out path with a sine arc and a spin, and the game's counters are updated
in per-item `onLaunch`/`onArrive` callbacks, so each hand-off is counted exactly once. Automated checks assert this
conservation for every pickup and delivery.

**Stacks: exact numbers, bounded meshes.** The stack renderer ([`samples/StackRenderer.ts`](samples/StackRenderer.ts))
keeps the *logical* amount separate from the *visual* one: it draws at most 24 objects and, past that cap, scales the
stack up progressively so a 300-box pile still *looks* heavier than a 30-box one. Four layouts (vertical, flat,
alternating, grid) come from per-resource profiles, which is how a player can carry hundreds of items on a mid-range
phone without the frame rate collapsing.

**No per-item allocations during play.** An object pool
([`samples/ResourceVisualPool.ts`](samples/ResourceVisualPool.ts)) pre-builds 180 item meshes and recycles them by
visual type, so flying and stacked items reuse objects instead of creating and garbage-collecting them. On mobile
browsers, garbage-collection pauses are a common cause of hitching in this kind of game; pooling keeps them out of the
hot path.

**Automation as data.** Each helper is a stage definition
([`samples/AutomationSystem.ts`](samples/AutomationSystem.ts)): which production chain it belongs to, what it carries,
a cost curve, its run interval, and per-level speed and capacity. At runtime helpers are small state machines (idle →
to pickup → to delivery, with a cooldown between runs), so retuning a helper or adding a level is a data change.

**Saves that survive refactors.** The save is plain JSON with a format version. Loading fills any missing field with
its default and maps identifiers renamed in later versions, and the automated checks load a legacy save to prove it.

**Quality tiers for phones.** LOW/MEDIUM/HIGH presets cap the device pixel ratio, switch shadows and their resolution,
and set how far away static scenery is culled; Android devices start on MEDIUM.

## Curiosities

- **The test runner has no test framework.** A plain Node script uses the TypeScript compiler API to transpile the
  game's own modules on the fly and runs 351 assertions against them: no Jest, Vitest or bundler step.
- **Everything you see is built from primitives.** Boxes, gifts, bears, dinosaur bones, the portal and the minecart
  are assembled from Three.js boxes, cylinders and spheres at runtime; the game uses no model or texture files.

## How it compares

Many open-source Three.js games and starters focus on rendering a scene or a single mechanic. Stack & Wrap goes further
on the *systems* side: a multi-chain economy with data-driven automation, conservation-checked item transfers, device
quality tiers and versioned saves, in about 7,600 lines of TypeScript with no runtime dependency besides Three.js.

## Tech

- **Three.js** for rendering: procedural meshes, pooled visuals and a stylized light rig
- **TypeScript** in strict mode, bundled with **Vite**
- **Automated simulation checks** covering transfers, interactions, automation, layout, stack caps, zones, saves and
  the barbecue chain
- **GitHub Actions** for tests and builds

## Status and roadmap

In active development. Next steps:

- Split the main game loop into per-zone controllers (shop, barbecue, dino valley, mine)
- A guided first minute for new players
- A cohesive low-poly art pass to replace the placeholder primitives
- Sound effects and haptics
- Economy balancing and an offline-earnings summary
- Localization (player-facing text is already centralized)

## Contents of this repository

```
docs/ARCHITECTURE.md   how the source is organised: modules, frame loop, save format, extension guide
samples/               excerpts of four core modules (not runnable on their own)
```

---

© 2026 Sterium AI. All rights reserved. The excerpts are published for portfolio purposes only.
