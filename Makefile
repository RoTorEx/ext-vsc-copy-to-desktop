.PHONY: all build install clean icon lint check release release-push vibe-kernel-path vibe-kernel-set vibe-pull

EXTENSION_NAME := copy-to-desktop
PUBLISHER := alex
DIST_DIR := dist
PACKAGE_VERSION := $(shell python3 -c "import json; print(json.load(open('package.json'))['version'])")
VSIX := $(DIST_DIR)/$(EXTENSION_NAME)-$(PACKAGE_VERSION).vsix

all: build

lint:
	@echo "Running lint checks..."
	@node --check extension.js
	@python3 -m json.tool package.json >/dev/null
	@echo "Lint passed."

check: lint

icon:
	@echo "Rendering icon.svg to icon.png (128x128)..."
	@sed 's/width="24"/width="128"/; s/height="24"/height="128"/' icon.svg > icon-128.svg
	@sips -s format png icon-128.svg --out icon.png >/dev/null 2>&1
	@rm -f icon-128.svg
	@echo "Rendered icon.png"

build: icon
	@echo "Building $(VSIX)..."
	@rm -rf $(DIST_DIR)
	@mkdir -p $(DIST_DIR)/extension
	@cp package.json extension.js README.md icon.png $(DIST_DIR)/extension/
	@cd $(DIST_DIR) && zip -r $(notdir $(VSIX)) extension
	@echo "Built: $(VSIX)"

install: build
	@echo "Installing $(VSIX) to local VS Code..."
	@code --install-extension $(VSIX) --force
	@echo "Installed. Reload VS Code to activate."

release:
	@python3 tools/release

release-push:
	@set -eu; \
	branch="$$(git branch --show-current)"; \
	test "$$branch" = "main" || { echo "ERROR: releases must be pushed from main, not $$branch." >&2; exit 1; }; \
	version="$$(python3 -c "import json; print(json.load(open('package.json'))['version'])")"; \
	tag="v$$version"; \
	git rev-parse -q --verify "refs/tags/$$tag" >/dev/null || { echo "ERROR: missing $$tag. Run make release." >&2; exit 1; }; \
	git push origin main --follow-tags

clean:
	@rm -rf $(DIST_DIR)
	@rm -f *.vsix
	@echo "Cleaned build artifacts."

vibe-kernel-path:
	@test -f .vibe/KERNEL_SOURCE || { echo "Missing .vibe/KERNEL_SOURCE. Run: make vibe-kernel-set" >&2; exit 1; }
	@sed -n '1p' .vibe/KERNEL_SOURCE

vibe-kernel-set:
	@mkdir -p .vibe; \
	if [ -n "$(KERNEL)" ]; then kernel_root="$(KERNEL)"; else printf "Kernel path: "; read -r kernel_root; fi; \
	case "$$kernel_root" in /*) ;; *) echo "ERROR: kernel path must be absolute." >&2; exit 1;; esac; \
	test -f "$$kernel_root/tools/vibe-pull" || { echo "ERROR: invalid kernel path: $$kernel_root" >&2; exit 1; }; \
	printf "%s\n" "$$kernel_root" > .vibe/KERNEL_SOURCE

vibe-pull:
	@test -f .vibe/KERNEL_SOURCE || { echo "Missing .vibe/KERNEL_SOURCE. Run: make vibe-kernel-set" >&2; exit 1; }
	@kernel_root="$$(sed -n '1p' .vibe/KERNEL_SOURCE)"; \
	python3 "$$kernel_root/tools/vibe-pull" .

# VIBE:KERNEL_MAKE_START

.PHONY: vibe-propose

vibe-propose:
	@test -f .vibe/KERNEL_SOURCE || { echo "Missing .vibe/KERNEL_SOURCE. Run: make vibe-kernel-set" >&2; exit 1; }
	@kernel_root="$$(sed -n '1p' .vibe/KERNEL_SOURCE)"; \
	test -f "$$kernel_root/tools/vibe-propose" || { echo "Missing $$kernel_root/tools/vibe-propose. Update the kernel source first." >&2; exit 1; }; \
	python3 "$$kernel_root/tools/vibe-propose" .

# VIBE:KERNEL_MAKE_END
