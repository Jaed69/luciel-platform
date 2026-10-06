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
- [x] B1 — Pin `TZ=UTC` for vitest (route: inline, 1 config file).
      RED: traslados.test.tsx failed under local TZ (SA Pacific, UTC-5). GREEN: `test.env.TZ=UTC`,
      65/65 with local TZ. Commit 0feaa49.
- [x] B2 — Lint errors in `NewLiquidacionModal.tsx:61` and `VentaFormModal.tsx:173`; remove
      `continue-on-error` from the lint step (route: delegated writer, 2 non-trivial components).
      Evidence: characterization tests added to venta-form-precio.test.tsx (passed on old code, then new);
      `npx eslint .` exit 0; `pnpm --filter @luciel-platform/tours test` 15 files / 67 tests pass;
      `npx tsc --noEmit` exit 0. VentaFormModal: effect moved into cantidad onChange handler;
      NewLiquidacionModal: open-reset via prevOpen render-time adjustment. Commit f28100d.
      Parent check: auto prices are only set in resetForm/handleTourSelect (which already
      compute amounts) and the cantidad handler, so behavior matches the removed effect.
      Review (high, 4 lenses): approved. Follow-up: test for cantidad-before-tour order (passes
      on old and new code), invariant comment on handleCantidadChange, AGENTS.md says Node 26 is
      Current until 2026-10-28. 68/68 tests, eslint exit 0. Liquidacion reset: old effect deps
      were only [open], so the open-transition reset is equivalent.
- [x] B3 — AGENTS.md: Node 22 -> 26 (route: inline, mechanical doc edit).
      Runtime row + deploy line updated; compatibility rows (Astro/Next need >=22) kept. Commit 4fdc4bf.

## Checks
- `pnpm --filter @luciel-platform/tours test` passes with the machine's local TZ (not UTC).
- `npx eslint .` in apps/tours/web: 0 errors.
- `npx tsc --noEmit` exit 0.

## Next step
Done.
