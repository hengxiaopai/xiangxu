# Infrastructure Package Rules

- Implement reviewed Application ports and use Contracts only through public entry points.
- Do not define Domain meaning or become a dependency of Domain/Application.
- Stage 5 permits only the PostgreSQL/Drizzle bootstrap sentinel and Redis/BullMQ fake infrastructure smoke.
- Stage 5 is complete; do not expand the sentinel or fake queue into business persistence or workflow without an explicitly approved later Stage.
- Keep database and queue smoke free of Domain entities, business tables, real jobs, providers, and external side effects.
- Destructive operations must fail closed on the fixed `xiangxu-stage5` project, local endpoints, and project-owned volume/queue identities.
- Cross-package imports must be declared and boundary-checked.
