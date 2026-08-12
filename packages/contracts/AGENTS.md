# Contracts Package Rules

- Stage 4 owns transport schemas, deterministic OpenAPI generation, drift detection, and the generic SSE envelope foundation.
- Do not depend on app runtime, Domain implementation, database rows, infrastructure, React, or provider models.
- Do not define real Task, Calendar, Inbox, Proposal, authentication, AI, connector, or provider contracts in Stage 4.
- Zod is transport-only. Shared primitives require explicit SSOT support; do not invent Domain semantics.
