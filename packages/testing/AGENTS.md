# Testing Package Rules

- This package is test-only; production packages and apps must never depend on it.
- Architecture fixtures stay under `fixtures/` and outside production TypeScript inputs.
- Helpers may observe public boundaries but must not become an architecture bypass.
- Do not add business fixtures, fake providers, or runtime test infrastructure during Stage 2.
