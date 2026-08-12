# Worker Workspace Rules

- Stage 3 permits only built-in Node HTTP health, a deterministic fake-job smoke, and graceful shutdown.
- Allowed dependency direction is toward application, infrastructure, and contracts public entry points.
- Do not update Domain tables directly; future work must enter through Application commands and reviewed adapters.
- Do not create a scheduler, queue processor, Redis/BullMQ integration, database access, or provider integration.
- Do not invent Domain behavior.
