# Project Changelog

Tracks real product and release progress.

## [Unreleased]

### Added

- Folder selections can now be copied recursively to the Desktop.
- Copy operations now show start, success, and failure feedback through VS Code
  notifications and the status bar.

### Changed

- Replaced version-in-command release and publish targets with interactive
  `make release` preparation and a separate `make release-push`.
- Added real `make check` and kernel-sync command targets.

## [0.1.0] - 2026-08-12

### Added

- Initial release of Copy to Desktop VS Code extension.
- Right-click any file in Explorer or editor tab to copy it to the Desktop.
- Auto-incrementing filename when a file with the same name already exists.
- Lucide `monitor-down` icon.
- Makefile with `build`, `install`, `clean`, and `icon` targets.
