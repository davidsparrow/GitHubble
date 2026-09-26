@AGENTS.md

# GitHubble

Visual discovery interface for GitHub repositories: each repository is a star in a navigable
galaxy. Phase 1 (sample data, no backend) is complete; see README.md for the roadmap.

## Commands

- `npm run dev`: dev server (append `?stress=10000` to the URL for a synthetic 10k universe)
- `npm run typecheck`, `npm run lint`, `npm test`: run all three before committing
- `npm run build`: production build

## Architecture rules

- `lib/` is pure TypeScript (no React, no three.js) and unit tested. Keep domain logic there.
- Never render a React component or DOM node per repository. Stars live in one `THREE.Points`;
  labels come from a fixed pool in `components/galaxy/SceneLabels.tsx`.
- Scene components mutate three.js objects inside `useFrame` and read per-frame state with
  `useGalaxyStore.getState()`; they subscribe to React state only for rare structural changes.
  (`react-hooks/immutability` is disabled for `components/galaxy/` for this reason.)
- Star sizing constants in `lib/starScale.ts` are interpolated into the GLSL
  (`components/galaxy/shaders.ts`) and used by CPU picking; change them in one place.
- The UI asks the camera to move by setting `cameraIntent` in the store. Only
  `GalaxyCamera.tsx` moves the camera.
- Shaders write sRGB colors directly (premultiplied additive blending); parse colors with
  `hexToRgb`, not `THREE.Color`, to avoid color-management conversion.
- Coordinates: `x`/`z` are the galactic plane, `y` is height above it.
