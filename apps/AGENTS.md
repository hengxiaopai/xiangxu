# Apps Governance

This directory contains application composition-root workspace skeletons.

- Stage 3 permits only the reviewed Web and Worker runtime shells.
- Apps may compose approved application and infrastructure adapters in their owning Stage.
- Apps must not define new Domain invariants or mutate Domain tables directly.
- Provider access must remain behind reviewed adapters and the active Gate scope.
- Contracts/UI foundation remains Stage 4; database/queue adapters remain Stage 5.
