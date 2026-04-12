# Avatar Assets Guide

NeoSquare avatar assets should be placed under this directory.

## Folder structure

- `previews/`
  - Small static preview images used in the avatar picker UI.
  - Recommended when you want a clean card thumbnail for each character.
- `sprites/`
  - In-game character images or sprite sheets used by Phaser scenes.
  - Use this for the actual avatar shown inside spaces.
- `portraits/`
  - Optional larger character images for profile cards, onboarding panels, or future character detail UI.

## Recommended file naming

Keep the file name aligned with the avatar preset id.

Examples:

- `previews/sky-runner.png`
- `previews/forest-maker.png`
- `sprites/sky-runner.png`
- `sprites/forest-maker.png`
- `portraits/sky-runner.png`

Current preset ids in the project:

- `sky-runner`
- `forest-maker`
- `sunset-guide`
- `rose-weaver`

## What to place in each folder

### 1. `previews/`

Put one transparent PNG per character.

Recommended:

- transparent background
- centered character
- square image
- around `256x256` or `512x512`

### 2. `sprites/`

Choose one of these two approaches:

- Single PNG per character
  - easiest to apply first
  - example: `sprites/sky-runner.png`
- Sprite sheet per character
  - better if you want walking animation later
  - example: `sprites/sky-runner-sheet.png`

If you use sprite sheets, keep all characters in the same frame size.

Recommended starting point:

- frame size: `64x64` or `96x96`
- transparent background
- same alignment for all characters

### 3. `portraits/`

Optional.

Use for bigger UI panels only.

Recommended:

- transparent background
- vertical portrait crop
- around `512x768`

## Fastest path

If you want the quickest implementation, place these first:

- `previews/<preset-id>.png`
- `sprites/<preset-id>.png`

That is enough to replace the current simple shape-based avatar system with character images in the selector and in the game scene.
