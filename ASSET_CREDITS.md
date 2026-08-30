# Asset Credits

## Character pack

The player and response characters now come from one visually matched character pack: **Quaternius Ultimate Modular Men Pack**.

- Creator: Quaternius
- License: CC0 1.0
- Player model: `hoodie.glb`
- Response model: `casual.glb`
- Runtime mirror: `nixocode/vietnam-65-lanes-of-war`

The player uses the adult-proportioned hoodie character from the same CC0 modular-men pack, with accessory nodes removed at runtime. The runtime applies dark modern clothing and concealed-face material treatment, and uses its imported idle, walk, and run animation clips.

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
