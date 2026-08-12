# UI Package Rules

- Stage 4 owns the centralized token registry, Light/Dark semantic themes, and the minimum server-safe semantic components.
- Gate 3.8 permits only type-safe Contract DTO input; never accept database rows or infrastructure implementation.
- Component APIs expose semantic props, not raw colors, spacing, radius, or inline styles.
- Keep components server-safe unless state, effects, browser APIs, or event-driven behavior genuinely require a client boundary.
- Do not define business, command implementation, authentication, access policy, database/provider UI, or later-stage components.
