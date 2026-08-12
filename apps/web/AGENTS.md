# Web Workspace Rules

- Stage 4 keeps the Next.js App Router shell limited to `/login` and `/app/today`, with only minimal `@xiangxu/ui` integration.
- Allowed dependency direction is toward application, contracts, and UI public entry points.
- Do not import database, Redis, queue, or provider clients directly.
- Keep pages as Server Components with semantic HTML; consuming CSS must use the centralized UI semantic tokens.
- Do not add authentication, business data/models, API handlers, additional product routes, or independent Web token definitions.
- Do not invent Domain rules or mutate Domain data outside Application commands.
