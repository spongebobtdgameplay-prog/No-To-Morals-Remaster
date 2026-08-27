# Asset Credits

## Character models

The remaster uses two rigged Quaternius character bodies from the **Ultimate Modular Men Pack**.

- Player / robber body: `casual-character.glb`
- Police response body: `swat.glb`
- Creator: Quaternius
- License: CC0 1.0
- Runtime mirror: `euuuuuuan/fatal-funnel-public`

The mirror's `CREDITS.md` records both exact files as Quaternius Ultimate Modular Men Pack assets under CC0-1.0 with redistribution allowed.

The deployed game loads the character files through `assets/models/manifest.json`. If a remote character fails to load, the runtime creates a local geometric fallback so the game remains playable.

## Breach gear

The vault breach device is fictional runtime geometry created by `src/breach-tool.js`. It is not a real weapon model and does not reproduce a real-world weapon mechanism.
