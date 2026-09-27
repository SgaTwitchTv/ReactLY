# ReactLY

> **Don't comment. React.**

ReactLY is a mobile-first social reaction platform where the reaction is the
content. A creator chooses a photo, clip, score, post, or other source, records
a genuine front-camera reaction, and exports a recognizable vertical Rect.

This repository is the clean production starting point derived from the first
validated browser prototype.

## Start

```bash
npm install
npx expo install --fix
npm run start
```

Use Node.js LTS. The first `expo install --fix` intentionally aligns the
dependency versions with the selected Expo SDK.

## Read before building

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/CAPTURE_FLOW.md`
4. `docs/DESIGN_SYSTEM.md`
5. `docs/ARCHITECTURE.md`
6. `docs/ROADMAP.md`

The capture timeline in `docs/CAPTURE_FLOW.md` is normative.

## Current state

- Expo/React Native foundation for Android, iOS, and web
- Neon ReactLY visual direction
- Demo creator UI with local image/video selection and camera recording
- Product and engineering source-of-truth documents
- Recording/export behavior specified precisely

Local recording, preview, and export are implemented for web and native platforms.
Phase 1 remains unfinished: Android device acceptance is in progress and iOS
compilation/device verification is pending. The latest Android compositor fixes
still need visual confirmation on a newly exported Rect.

Launch the desktop browser demo with `npm run web` after installing dependencies.
Native export requires a custom development build (`npm run android`, or
`npm run ios` on macOS); it is not available in Expo Go.
