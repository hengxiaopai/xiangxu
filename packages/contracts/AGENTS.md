# Contracts Package Rules

- Gate 4.1 Stage 1 owns the authorized transport schemas, deterministic OpenAPI generation, drift detection, and versioned SSE union.
- Do not depend on app runtime, Domain implementation, database rows, infrastructure, React, or provider models.
- Do not add runtime handlers, persistence models, provider contracts, a second SSE envelope, or a second ETag implementation.
- Stage 6 must keep the frozen OpenAPI and SSE union unchanged. Internal `capture.triage.requested` is not a Contract/SSE topic; exporting existing inferred DTO types does not expand the wire schema.
- Stage 7 must keep the same byte-frozen OpenAPI and reuse the existing Today, Plan commit, Review create/read, mutation, Problem Details, and SSE schemas without route or DTO expansion.
- Zod is transport-only. Shared primitives require explicit SSOT support; do not invent Domain semantics.
