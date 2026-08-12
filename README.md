# Copy to Desktop

A minimal VS Code extension that adds a **Copy to Desktop** option to the Explorer context menu and editor tab menu.

## How to use

1. Open a folder in VS Code.
2. Right-click any file in the Explorer sidebar, or right-click an editor tab.
3. Select **Copy to Desktop**.
4. The file is copied to your macOS Desktop. If a file with the same name already exists, a numbered suffix is appended automatically.

## Build and install locally

```bash
make install
```

Then reload VS Code.

## Release a new version

Bump `package.json`, build, install locally, commit, tag, and push:

```bash
make publish VERSION=0.2.0
```

To only bump and install without committing:

```bash
make release VERSION=0.2.0
```

## Run locally for development

Open this folder in VS Code and press `F5` to launch a new Extension Development Host window.

## Credits

- Icon: [`monitor-down`](https://lucide.dev/icons/monitor-down) from [Lucide](https://lucide.dev), licensed under ISC.
