# Application Package Rules

- Depend only inward on Domain and on reviewed Contracts public entry points.
- Do not import infrastructure, apps, UI, Next.js, React, database/queue clients, or provider SDKs.
- Gate 4.1 Stages 1–7 may implement only the approved command/query intents, policies, handlers, ports, and transaction orchestration for the active slice.
- Stage 6 permits the internal Capture triage dispatch input and deterministic Outbox-event idempotency mapping. Do not import SQL, database/queue clients, SSE runtime, IndexedDB, or runtime composition.
- Stage 7 permits frozen Daily Plan/Today/Review orchestration only. Keep snapshot derivation server-authoritative and ExecutionRecord write capability absent until actual timing is frozen.
- Cross-package imports must use public package entry points and declared workspace dependencies.
