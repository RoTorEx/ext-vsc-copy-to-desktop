# vsc-copy-to-desktop
TODO: one-paragraph project description.

## Quickstart

```bash
make install
make check
```

## Kernel sync (sanity check)

```bash
make vibe-kernel-set
make vibe-pull
```

`make vibe-kernel-set` prompts for the parent kernel path and updates `.vibe/KERNEL_SOURCE` (local-only; gitignored).

Confirm these exist after pulling:

- `.vibe/kernel/PRINCIPLES.md`
- `.vibe/kernel/SETUP.md`
- `.vibe/kernel/examples/GITHUB_RELEASES.md`
- `.vibe/kernel/examples/CLI_APPS.md`
- `.vibe/kernel/examples/DIST_ARTIFACTS.md`
- `.vibe/kernel/examples/RUST_PROJECTS.md`
- `.githooks/pre-commit`
- `TASK.md`
- `CHANGELOG.md`
- `AGENTS.md` contains the `VIBE:KERNEL_ROUTING` markers

## Docs map

- Keep the repo root minimal. Prefer putting project docs under `docs/` rather than adding many root markdown files.
- `AGENTS.md` — agent router.
- `TASK.md` — task queue (agents process and remove completed tasks).
- `CHANGELOG.md` — release progress.
- `.vibe/kernel/*.md` — local copies of Vibecoding Kernel instructions (do not edit).
- `.vibe/kernel/SETUP.md` — one-time bootstrap/standardization directive.
- `.vibe/kernel/examples/GITHUB_RELEASES.md` — GitHub Release CI/CD conventions (read only for release automation tasks).
- `.vibe/kernel/examples/CLI_APPS.md` — CLI install/update/runtime conventions (read only for CLI app tasks).
- `.vibe/kernel/examples/DIST_ARTIFACTS.md` — distribution artifact conventions (read only for `dist/`/package output tasks).
- `.vibe/kernel/examples/RUST_PROJECTS.md` — Rust/Cargo conventions (read only for Rust/Cargo tasks).
- `.githooks/` — optional git hooks managed by the kernel (lint gates).
- `docs/architecture/` — design truth (agents choose scope; keep schemas/diagrams/boundaries up to date).
- `docs/contracts/` — stable contracts.
- `docs/features/` — accepted feature notes.
- `docs/ideas/` — raw ideas, not roadmap.
- `docs/reports/` — reports and audits (read only when relevant).

## Commands

See `Makefile`.
