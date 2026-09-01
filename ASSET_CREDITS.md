# Asset Credits

## Player character

The player no longer uses the Quaternius or KayKit character families.

### Animated body

- Model: `Animated Character Base`
- Creator: J-Toastie
- License: CC-BY 3.0
- Source: https://poly.pizza/m/AZzoJo1FBm
- Runtime mirror: `discover3d/Danpav1__3DTestGame`
- Runtime file: `Assets/models/Unarmed/player.glb`

The body is loaded as one rigged animated character. There is no Quaternius/KayKit player fallback.

### Hood

- Model: `Generic Low-Poly Hood`
- Creator: KameoNi
- License: Creative Commons Attribution
- Source: https://sketchfab.com/3d-models/generic-low-poly-hood-f22bbda95e1f4ddd98b395cb5c4993bb
- Mirror used for the local copy: `NonoIceOff/Spy-Clans`
- Local file: `assets/models/robber-hood.glb`

The hood is a separate lightweight mesh attached to the new body's head bone.

Response characters still use the existing Quaternius response model; that model is not used for the player.

## Loot duffel

- Creator: accidentallyc
- Model: `Duffel Bag`
- Source: https://poly.pizza/m/rysPhwuIP4
- License: CC0 1.0
- Local file: `assets/models/duffel-bag.glb`
- Mesh inspection: 1,376 triangles, separate body, handle, handle straps, and zipper meshes

The imported bag uses only the dedicated `Bag Handle` mesh to define its grip origin. Its original model orientation is preserved, and the verified handle origin is positioned from the player's right-hand bone every frame.

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
