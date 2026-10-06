# Feature: backlog-cleanup

## Objective
Close three small follow-ups left by the infra and dependency work.

## Scope
- B1: tours-web tests are deterministic in any local timezone (CI runs UTC).
- B2: fix the 2 `react-hooks/set-state-in-effect` lint errors and make lint a real CI gate
  (drop `continue-on-error`).
- B3: AGENTS.md stack table reflects the Node 26 runtime.

## Constraints
- No behavior change in the forms (B2): same auto-fill of monto/costo from unit prices.
- TDD mode: enabled (global config). Runner: `pnpm --filter @luciel-platform/tours test` (vitest).

## Tasks
- [ ] B1 — Pin `TZ=UTC` for vitest (route: inline, 1 config file).
- [x] B2 — Lint errors in `NewLiquidacionModal.tsx:61` and `VentaFormModal.tsx:173`; remove
      `continue-on-error` from the lint step (route: delegated writer, 2 non-trivial components).
      Evidence: characterization tests added to venta-form-precio.test.tsx (passed on old code, then new);
      `npx eslint .` exit 0; `pnpm --filter @luciel-platform/tours test` 15 files / 67 tests pass;
      `npx tsc --noEmit` exit 0. VentaFormModal: effect moved into cantidad onChange handler;
      NewLiquidacionModal: open-reset via prevOpen render-time adjustment.
- [ ] B3 — AGENTS.md: Node 22 -> 26 (route: inline, mechanical doc edit).

## Checks
- `pnpm --filter @luciel-platform/tours test` passes with the machine's local TZ (not UTC).
- `npx eslint .` in apps/tours/web: 0 errors.
- `npx tsc --noEmit` exit 0.

## Next step
Done.
