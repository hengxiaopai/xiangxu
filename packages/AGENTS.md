# Packages Governance

This directory contains the Stage 2 package graph skeleton.

- The future dependency direction is `domain <- application <- infrastructure`.
- Contracts remain transport schemas; UI remains semantic presentation.
- Package code must not depend on apps.
- Every cross-package dependency must be declared and pass automated boundary checks.
- Stage 2 creates no business, transport, UI, database, queue, or provider implementation.
