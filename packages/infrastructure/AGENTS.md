# Infrastructure Package Rules

- Implement reviewed Application ports and use Contracts only through public entry points.
- Do not define Domain meaning or become a dependency of Domain/Application.
- Gate 4.1 Stages 2–7 own only the reviewed persistence adapters, transaction-bound repositories, additive migrations, durable dispatcher/BullMQ adapter, and actor-scoped PostgreSQL SSE adapter for the active slice.
- Stage 6 permits `capture.triage.requested`, migration 0004, claim/lease/retry dispatch, and SSE-eligible event reads. Do not implement Application business policy, API routes, providers, Redis Pub/Sub, Review tables, or direct Worker business mutation.
- Stage 7 permits migration 0005 and append/read repositories for PlanSnapshot/ReviewSnapshot plus read-only ExecutionRecord access. Do not add snapshot updates/deletes, ExecutionRecord writers, dashboard/today tables, new event topics, or Stage 8 browser infrastructure.
- Gate 4.2 Stage 1 permits additive migration 0006, `knowledge.libraries`, its PostgreSQL repository, and actor-scoped SSE eligibility. Resource/membership/queue tables and writes are not yet permitted.
- Destructive operations must fail closed on the fixed `xiangxu-stage5` project, local endpoints, and project-owned volume/queue identities.
- Cross-package imports must be declared and boundary-checked.
