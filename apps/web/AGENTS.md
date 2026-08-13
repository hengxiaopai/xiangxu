# Web Workspace Rules

- Gate 4.2 Stage 1 expands the product surface only with `/app/knowledge`, `GET /api/v1/knowledge/overview`, and `GET/POST /api/v1/libraries`.
- Allowed dependency direction is toward application, contracts, and UI public entry points.
- Do not import database, Redis, queue, or provider clients directly.
- Keep route pages thin; client views consume validated DTOs through the single TanStack/SSE/Auth Epoch foundation. Consuming CSS must use centralized UI semantic tokens.
- Do not add other product routes, direct persistence access, a second QueryClient/invalidation system, independent Web token definitions, fake business data, direct Resource creation, or later Gate 4.2 behavior.
- Do not invent Domain rules or mutate Domain data outside Application commands.
