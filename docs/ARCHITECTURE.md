# Architecture

> **In one line:** the game is a single frame loop in `src/main.ts` that asks a handful of small, data-driven systems (movement, interactions, transfers, automation, rendering) to do their part every frame, and saves plain JSON to the browser.

This document describes how the (private) source is organised. Player-facing
information lives in the [README](../README.md).

## Module map

| Module | Responsibility | Depends on |
|---|---|---|
| `config/gameConfig.ts` | Resource definitions, most tuning numbers, the pure bear-BBQ lifecycle model, BBQ safe-area geometry | nothing |
| `config/qualitySettings.ts` | LOW / MEDIUM / HIGH device tiers | nothing |
| `save/saveSystem.ts` | `SaveData` schema, defaults, legacy migration, `parseSave` / `loadSave` / `saveGame` | config, AutomationSystem (types and normalisation) |
| `simulation/GameState.ts` | Runtime state: the save plus transient values (player motion, in-flight counters) and derived stats (capacity, prices, process times) | config, save, AreaSystem |
| `systems/AreaSystem.ts` | Which zone the player is in (outdoor or the portal-isolated mine) and movement clamping | config |
| `systems/InteractionSystem.ts` | Proximity triggers with enter / stay / exit callbacks | three |
| `systems/InteractionRegistrar.ts` | Registers every static interaction (pads, counters, portals) from zone refs and action callbacks | InteractionSystem, GameState, strings |
| `systems/TransferSystem.ts` | Animated item hand-offs with per-item `onLaunch` / `onArrive` callbacks | ResourceVisualPool |
| `systems/AutomationSystem.ts` | Helper stage definitions (cost, interval, speed, capacity per level) and purchase state | config (types) |
| `render/*` | Materials, pooled item meshes, stack layout, building stages, sky and ambience | three, config |
| `world/InteractionLayout.ts` | World coordinates of every station and pad, grouped by production chain | nothing (types only) |
| `world/WorldBuilder.ts` | Outdoor sector layout and terrain / path mesh helpers | three |
| `ui/Hud.ts`, `ui/strings.ts` | DOM HUD (money, minimap, debug overlay) and all player-facing text | GameState, layout |
| `input/MoveInputController.ts` | Floating touch joystick and WASD / arrow keys, producing a normalised move vector | nothing |
| `main.ts` | `StackAndWrapGame`: builds the scene, owns the actors and helpers, wires the systems together and runs the loop | everything above |

Only `main.ts` touches all layers. The other modules are small, have no global state and, apart
from the render helpers, can be imported in plain Node, which is what the simulation checks do.

## Frame loop and data flow

`StackAndWrapGame.update(dt)` runs once per animation frame (`dt` is capped at 50 ms) in this order:

1. **Input and movement**: `MoveInputController` has already written `state.moveInput`; `GameState.updateMovement` integrates velocity and `AreaSystem` clamps the position (the north limit grows as zones unlock).
2. **Supply**: the box depot regenerates one unit per interval.
3. **Interactions**: `InteractionSystem.update` fires `onStay` for every pad the player stands on. Handlers check cooldowns and capacity, then call a `launch…Transfer` method.
4. **Processors**: the wrap bench and the bear grill advance their timers and emit finished items as animated transfers; the bone refinery, garden and mine refinery advance similar timers on their saved counters.
5. **Automation**: the box worker feeds the wrap bench one box per interval; the other purchased helpers run an `idle → toPickup → toDelivery → idle` state machine, walking between stations and updating the same counters the player's transfers use.
6. **World actors**: customers, bears, dinosaurs, dropped loot and the special mission update.
7. **Transfers**: `TransferSystem.update` launches queued items and advances flying ones.
8. **Presentation**: camera, player bars, building stages, distance culling, minimap; the HUD and world labels refresh every 0.12 s.
9. **Autosave** every 5 s, plus on tab hide and on unload.

### The transfer contract

Every item that changes hands follows the same rule, which keeps the economy exact while
hundreds of items are in the air:

- **At launch** the source is decremented and, where the destination has a capacity limit, a `pending…` counter is incremented (`pendingToPlayer`, `pendingToWrapBench`, …). Capacity checks include those in-flight items; destinations without a pending counter clamp to their capacity on arrival.
- **On arrival** (`onArrive`) the pending counter is decremented and the destination is incremented.
- Visual stacks (`StackRenderer.setAmount`) are always set *from* the logical counters, never the other way round.

The checks in `scripts/simulation-checks.mjs` assert this conservation for single, batched and 200-item transfers.

### Rendering budget

- `ResourceVisualPool` pre-builds 180 item meshes and recycles them by visual key.
- `StackRenderer` draws at most `maxVisualItems` meshes per stack (24 by default) and scales the pile beyond that.
- Materials and customer geometries are shared (`render/materials.ts`).
- Static scenery outside the quality tier's `viewDistance` is hidden by a culling pass that runs every 0.35 s; the mine and the outdoor world are separate groups, and only one of them is visible at a time.

## Save format

Saves are one JSON object in `localStorage` under `stack-and-wrap-save-v1`. The schema is the
`SaveData` type in `src/save/saveSystem.ts`; the key names are part of the format.

- **Versioning.** `saveVersion` is the format version (currently `SAVE_VERSION = 4`). `parseSave` upgrades any older version in place and always writes the current one.
- **Forward compatibility.** Every field falls back to its `DEFAULT_SAVE` value, so a save written before a field existed still loads.
- **Renamed identifiers.** Version 4 renamed identifiers left over from an early prototype. `migrateLegacySaveFields` maps them on load and removes the old keys:

  | Old | New |
  |---|---|
  | `grillLevel`, `grillInput`, `grillOutput`, `grillTimer`, `grillUpgradeRemaining` | `wrapBench…` equivalents |
  | `grillUpgradeCost` (oldest saves) | `wrapBenchUpgradeRemaining` |
  | resource `raw_meat` / `cooked_meat` | `box` / `gift` |
  | automation stage `base.raw-to-grill` | `base.box-to-wrap` |
  | unlock tag `food` | removed |

- **Legacy automation.** `automationLevel` / `automationRemaining` predate per-stage automation and are kept in sync with the `base.box-to-wrap` stage.
- **Failure mode.** A save that cannot be parsed is ignored and a fresh game starts; the game never fails to boot because of storage.

The migration is covered by the "Saves" block of the simulation checks, including idempotence and round-tripping of a current save.

## Adding a production chain

A chain is *source → processor → sale*, optionally with a helper that automates one leg. Using
a hypothetical "honey" chain as the example:

1. **Resources** (`config/gameConfig.ts`): add `honeycomb` and `honey` to `ResourceId` and `RESOURCE_CONFIG` (`unitValue: 0` for the intermediate product). TypeScript will then list every table that must cover the new ids: labels in `ui/strings.ts`, visuals in `render/ResourceVisualDefinitions.ts`, and request-bubble colours in `main.ts`.
2. **Tuning**: add a config block (capacity, process time) next to `wrapBench` and `bearBarbecue`, and a price step in `GameState`'s `PRICE_STEP_PER_VALUE_LEVEL` if the product is sold.
3. **Layout** (`world/InteractionLayout.ts`): add a `HONEY_FLOW_LAYOUT` with input, output and sale points inside one outdoor sector, and add the sale resource to `SALE_REQUEST_RESOURCES` if customers should ask for it.
4. **Persistence** (`save/saveSystem.ts`): add the processor's input, output and timer fields to `SaveData` and `DEFAULT_SAVE`. Existing saves load with the defaults.
5. **Interactions** (`systems/InteractionRegistrar.ts`): add the static interaction ids and register the input, output and sale pads using the existing `PROCESSOR_INPUT` / `PROCESSOR_OUTPUT` / `DELIVERY` patterns.
6. **Gameplay** (`main.ts`): build the station meshes, create stacks and anchors, add `launch…Transfer` methods that follow the transfer contract above, and an `update…` step for the processor timer.
7. **Automation (optional)**: add a stage to `AUTOMATION_STAGE_DEFINITIONS` with its cost curve, `interval`, `speedByLevel` and `capacityByLevel`, a pad in `AUTOMATION_PAD_LAYOUT`, and a per-frame update in `main.ts` using `moveAgent` and the stage helpers.
8. **Checks**: extend `scripts/simulation-checks.mjs`. Several existing checks already iterate over every resource, stage and pad, so the new data is partly covered automatically.

## Testing

`npm test` runs `scripts/simulation-checks.mjs`, a plain Node script with no test framework. It
transpiles the TypeScript modules with the compiler API, rewrites their relative imports and
imports them directly, so the checks exercise the shipped code rather than copies. Covered
areas: transfer conservation, interaction lifecycle and registration, automation stages and pad
placement, layout invariants, minimap rebuild rules, request-bubble texture ownership, stack
rendering caps, `AreaSystem`, save migration, and the bear BBQ burn and safe-zone rules.

## Known limitations

- `main.ts` still holds most gameplay orchestration. The next refactor is to split it into per-chain controllers (shop, BBQ, dinosaur valley, mine) behind the same systems.
- The in-game bear grill applies the same rules as `advanceBearBarbecueLifecycle` but does not call it yet, because it also drives transfer animations; the pure function is what the checks verify.
- Balance numbers are first-pass values.
