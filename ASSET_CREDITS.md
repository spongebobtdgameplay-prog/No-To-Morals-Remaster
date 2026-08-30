# Asset Credits

## Player robber

The player now uses the rigged `Rogue_Hooded.glb` model from **KayKit Adventurers**.

- Creator: Kay Lousberg
- License: CC0 1.0
- Runtime mirror: `Noisemaker111/jgengine`
- Runtime path: `apps/dev/public/models/kaykit-adventurers/Rogue_Hooded.glb`
- Embedded movement clips used by the game: `Idle`, `Walking_A`, `Running_A`

The game removes fantasy weapon/accessory nodes when present and applies only a restrained dark material treatment. The embedded rig animations drive the player instead of leaving the model in a T-pose.

## Police

Police use the Quaternius SWAT model from the **Ultimate Modular Men Pack**.

- Creator: Quaternius
- License: CC0 1.0
- Runtime mirror: `euuuuuuan/fatal-funnel-public`

Backpack-style accessory nodes are removed by the runtime character loader.

## Imported bank architecture

The visible bank shell is no longer built from Three.js box or plane primitives.

The runtime uses these CC0 modular models mirrored by `Noisemaker111/jgengine`:

- `Wall_Plaster_Straight.glb` — Quaternius
- `Wall_Plaster_Door_Flat.glb` — Quaternius
- `Wall_Plaster_Window_Wide_Flat.glb` — Quaternius
- `Floor_Brick.glb` — Quaternius
- `Door_DarkMetal.glb` — Quaternius, used as the vault door

The wall and floor models are instantiated as authored GLB geometry. Player collision is still handled by the project's mesh-aware collision system.

## Imported street and city dressing

The outside street uses the **KayKit City Builder** pack by Kay Lousberg, CC0 1.0, mirrored by `Noisemaker111/jgengine`.

Models currently used:

- `road_straight.glb`
- `road_straight_crossing.glb`
- `building_A_withoutBase.glb`
- `building_B_withoutBase.glb`
- `building_C_withoutBase.glb`
- `streetlight.glb`
- `dumpster.glb`
- `firehydrant.glb`

The previous small getaway car asset has been removed from the runtime.

## Bank office models

The lobby keeps a mixed imported office set.

### CC0 models

- `desk_alt.glb` — CreativeTrio — CC0 1.0
- `chair_blue.glb` — Quaternius — CC0 1.0
- `bookcase.glb` — Quaternius — CC0 1.0
- `plant_monstera.glb` — Quaternius — CC0 1.0
- `trash.glb` — Quaternius — CC0 1.0
- `couch.glb` — Quaternius — CC0 1.0
- `armchair.glb` — Quaternius — CC0 1.0
- `floor_lamp.glb` — CreativeTrio — CC0 1.0

Runtime mirror: `sorryhumans/roost`, under `web/public/models/office/`.

### CC BY 3.0 models

- `monitor.glb` — Zsky — CC BY 3.0
- `laptop.glb` — J-Toastie — CC BY 3.0

Runtime mirror: `sorryhumans/roost`, under `web/public/models/office/`.

## Loot and breach gear

- Loot crate: `dungeon_crate.glb` — KayKit Dungeon Remastered — Kay Lousberg — CC0 1.0 — mirror `sion-rgb/tactical-slash`
- Breach gear visual: `smokebomb.glb` — KayKit Adventurers — Kay Lousberg — CC0 1.0 — mirror `Noisemaker111/jgengine`

## Runtime-only systems

Three.js still provides rendering, lighting, animation playback, raycasts, camera logic, and invisible collision math. Persistent bank walls, floors, street pieces, city buildings, the player character, the vault door, furniture, loot, and held gear are imported models rather than generated primitive meshes.
