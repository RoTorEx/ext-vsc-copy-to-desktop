.PHONY: all build install clean icon lint release publish

EXTENSION_NAME := copy-to-desktop
PUBLISHER := alex
DIST_DIR := dist
VERSION := $(shell python3 -c "import json; print(json.load(open('package.json'))['version'])")
VSIX := $(DIST_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix

all: build

lint:
	@echo "Running lint checks..."
	@node --check extension.js
	@python3 -m json.tool package.json >/dev/null
	@echo "Lint passed."

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
ifndef VERSION
	$(error VERSION is not set. Usage: make release VERSION=0.2.0)
endif
	@echo "Releasing $(EXTENSION_NAME) v$(VERSION)..."
	@python3 -c "import json; d=json.load(open('package.json')); d['version']='$(VERSION)'; json.dump(d, open('package.json','w'), indent=2); print('Updated package.json to $(VERSION)')"
	@make install

publish:
ifndef VERSION
	$(error VERSION is not set. Usage: make publish VERSION=0.2.0)
endif
	@echo "Publishing $(EXTENSION_NAME) v$(VERSION)..."
	@make release VERSION=$(VERSION)
	@git add -A
	@git commit -m "feat: release v$(VERSION)" || true
	@git tag -a v$(VERSION) -m "Release v$(VERSION)"
	@git push origin main
	@git push origin v$(VERSION)
	@echo "Published v$(VERSION)."

clean:
	@rm -rf $(DIST_DIR)
	@rm -f *.vsix
	@echo "Cleaned build artifacts."
