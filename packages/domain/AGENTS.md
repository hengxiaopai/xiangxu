# Domain Package Rules

- Keep this package pure TypeScript.
- Do not import application, infrastructure, apps, UI, frameworks, database/queue clients, or provider SDKs.
- Gate 3.8 permits only type-only contract primitives; do not import transport implementation.
- Do not invent Entities, Aggregates, Tasks, revisions, events, or other business semantics during Stage 2.
