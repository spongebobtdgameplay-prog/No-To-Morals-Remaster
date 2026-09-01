# Asset Credits

## Character packs

The player uses **KayKit Adventurers Character Pack**.

- Creator: Kay Lousberg
- License: CC0 1.0
- Player model: `Rogue_Hooded.glb`
- Runtime mirror: `Malcolmnixon/godot-xr-dungeon-template`

The hooded rogue is used as the robber base instead of the previous SWAT character.

Response characters still use **Quaternius Ultimate Modular Men Pack**.

- Creator: Quaternius
- License: CC0 1.0
- Response model: `casual.glb`
- Runtime mirror: `nixocode/vietnam-65-lanes-of-war`

## Loot duffel

- Creator: accidentallyc
- Model: `Duffel Bag`
- Source: https://poly.pizza/m/rysPhwuIP4
- License: CC0 1.0
- Local file: `assets/models/duffel-bag.glb`
- Mesh inspection: 1,376 triangles, separate body, handle, handle straps, and zipper meshes

The imported bag now uses the dedicated `Bag Handle` mesh only for its grip point. The grip group is reparented directly to the robber's right-hand bone so the hand and handle share the same transform.

## Downtown City environment

The bank exterior, interior shell, sidewalk, road, and surrounding buildings use one coherent environment source: **Quaternius Downtown City MegaKit**.

- Creator: Quaternius
- License: CC0 1.0
- Runtime mirror: `AetherRadar/operation-steel-tide`
- Source folder: `assets/models/quaternius_downtown_city/`

Models used by the runtime:

- `Brick_Plain_1.gltf`
- `Brick_RedWhite_DoubleWindow.gltf`
- `Brick_Window_Trim.gltf`
- `DoorFrame_Trim.gltf`
- `Metal_FirstFloor_Window.gltf`
- `Floor_4x4.gltf`
- `Street_2Lane.gltf`
- `Street_4WayIntersection.gltf`
- `Building_Large_2.gltf`
- `Building_Medium_2_001.gltf`
- `Building_Small_1.gltf`
- `Stairs_Entrance_Concrete.gltf`
- `Prop_Bollard.gltf`
- `Prop_Planter_Single.gltf`
- `Prop_ManholeCover.gltf`

These modules are placed on their authored meter-scale grid instead of being stretched to arbitrary target sizes. Their original materials and texture sets are preserved.

## Loot crate

- Model: `dungeon_crate.glb`
- Creator: Kay Lousberg / KayKit
- Source pack: KayKit Dungeon Remastered
- License: CC0 1.0
- Runtime mirror: `sion-rgb/tactical-slash`

## Runtime systems

Three.js is used as the renderer and for lighting, animation playback, camera logic, raycasts, and invisible collision math. The visible bank shell, floors, street, city buildings, stairs, planters, bollards, manhole, character, gate panel, and loot are imported model assets rather than Three.js primitive geometry.
