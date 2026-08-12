# Application Package Rules

- Depend only inward on Domain and on reviewed Contracts public entry points.
- Do not import infrastructure, apps, UI, Next.js, React, database/queue clients, or provider SDKs.
- Do not create Commands, Queries, Use Cases, ports, Unit of Work, or business policies during Stage 2.
- Cross-package imports must use public package entry points and declared workspace dependencies.
