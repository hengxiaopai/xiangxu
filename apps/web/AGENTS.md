# Web Workspace Rules

- Stage 7 keeps the product surface bounded to frozen `/login`, `/app/today`, and `/app/review` routes plus their already-frozen HTTP operations.
- Allowed dependency direction is toward application, contracts, and UI public entry points.
- Do not import database, Redis, queue, or provider clients directly.
- Keep route pages thin; client views consume validated DTOs through the single TanStack/SSE/Auth Epoch foundation. Consuming CSS must use centralized UI semantic tokens.
- Do not add additional product routes, direct persistence access, a second QueryClient/invalidation system, independent Web token definitions, fake business data, or Stage 8 browser evidence.
- Do not invent Domain rules or mutate Domain data outside Application commands.
