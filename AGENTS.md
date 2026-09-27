# ReactLY agent guidance

Read every file under `docs/` before changing product behavior.

## Product invariants

- ReactLY's core format is a genuine front-camera reaction to source content.
- During recording, the creator sees the source full-screen and their camera in
  the bottom-right.
- In the exported video, that composition remains for the first 1000 ms.
- The export then animates into a reaction-first composition: camera full-screen,
  source in the lower-left.
- The black ReactLY brand layer and watermark appear only as the moving layers
  reveal them.
- The transition belongs to the exported video. Do not animate the creator's
  live recording view.
- Do not add feeds, accounts, chat, or backend persistence before Phase 1 capture
  and export work is reliable.

## Engineering expectations

- Use TypeScript in strict mode.
- Keep platform-specific capture implementations behind typed interfaces.
- Keep capture state separate from rendering/composition state.
- Prefer deterministic timeline functions that can be unit-tested without a
  camera or device.
- Never upload source or reaction media unless a later feature explicitly
  requires it and the user approves that architecture.
- Preserve Android, iOS, and web support. If functionality differs by platform,
  document the difference instead of silently degrading.
- Accessibility labels are required for interactive controls.
- Respect reduced-motion settings in UI animation. Exported video motion remains
  part of the selected format.

## Commands

```bash
npm install
npx expo install --fix
npm run start
npm run web
npm run typecheck
npm run lint
npm test
```

## Definition of done

A change is not complete until:

- TypeScript passes.
- Lint and relevant unit tests pass.
- The affected flow is manually checked on web.
- Native-sensitive changes are checked on at least Android or iOS.
- Product behavior still matches `docs/CAPTURE_FLOW.md`.
- New compromises or platform differences are recorded in `docs/ARCHITECTURE.md`.

## Working style

For multi-step features, plan first. State the goal, affected files, risks,
verification, and what remains out of scope. Prefer small reviewable commits.
