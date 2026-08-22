# Copy to Desktop

A minimal VS Code extension that adds a **Copy to Desktop** option to the Explorer context menu and editor tab menu.

## How to use

1. Open a folder in VS Code.
2. Right-click any file or folder in the Explorer sidebar, or right-click an editor tab.
3. Select **Copy to Desktop**.
4. The file or folder is copied to your macOS Desktop. If an item with the same name already exists, a numbered suffix is appended automatically.

## Build and install locally

```bash
make install
```

Then reload VS Code.

## Release a new version

Prepare a release from a clean `main` branch:

```bash
make release
```

Enter the exact `MAJOR.MINOR.PATCH` version when prompted. The command runs
checks, updates `package.json` and `CHANGELOG.md`, creates a dedicated release
commit, and creates the matching annotated tag. Push only after review:

```bash
make release-push
```

## Kernel sync

```bash
make vibe-kernel-set
make vibe-pull
```

## Run locally for development

Open this folder in VS Code and press `F5` to launch a new Extension Development Host window.

## Credits

- Icon: [`monitor-down`](https://lucide.dev/icons/monitor-down) from [Lucide](https://lucide.dev), licensed under ISC.
