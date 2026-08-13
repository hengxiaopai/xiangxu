# Domain Package Rules

- Keep this package pure TypeScript.
- Do not import application, infrastructure, apps, UI, frameworks, database/queue clients, or provider SDKs.
- Gate 4.2 Stage 1 may add only the pure Library support-entity invariant and Knowledge Overview value types frozen upstream.
- Keep UUID generation, Zod schemas, transport parsing, persistence, repositories, handlers, and infrastructure outside this package.
- Do not add a Resource/Knowledge/Note Core Object implementation or broaden Proposal patch taxonomy in Stage 1.
