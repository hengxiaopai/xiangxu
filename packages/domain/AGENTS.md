# Domain Package Rules

- Keep this package pure TypeScript.
- Do not import application, infrastructure, apps, UI, frameworks, database/queue clients, or provider SDKs.
- Gate 4.1 Stage 1 owns the frozen values; Stage 7 may implement only the already-frozen pure PlanSnapshot, ExecutionRecord, and ReviewSnapshot invariants.
- Keep UUID generation, Zod schemas, transport parsing, persistence, repositories, handlers, and infrastructure outside this package.
- Do not add another Core Object or broaden Proposal patch taxonomy without a later explicit approval.
