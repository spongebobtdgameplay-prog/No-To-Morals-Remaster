# Asset Credits

## Character models

The remaster uses two rigged Quaternius character bodies from the **Ultimate Modular Men Pack**.

- Player / robber body: `worker.glb`
- Police body: `casual-character.glb`
- Creator: Quaternius
- License: CC0 1.0
- Runtime mirror: `euuuuuuan/fatal-funnel-public`
- The mirror's `CREDITS.md` records both files as Quaternius Ultimate Modular Men Pack assets with redistribution allowed under CC0-1.0.

The deployed game loads the character files through `assets/models/manifest.json`. If either remote asset fails to load, the runtime creates a local geometric fallback character so the game remains playable.

No realistic weapon asset is included. The vault breaching interaction uses a fictional pulse tool built from simple game geometry.
