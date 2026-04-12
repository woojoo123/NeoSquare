import characterSpriteSheetUrl from '../assets/avatars/sprites/Character64x64.png';

export const AVATAR_SPRITE_SHEET_KEY = 'neosquare-character-sheet';
export const AVATAR_SPRITE_SHEET_URL = characterSpriteSheetUrl;
export const AVATAR_SPRITE_FRAME_SIZE = 64;
export const AVATAR_SPRITE_SHEET_COLUMNS = 8;
export const AVATAR_SPRITE_SHEET_ROWS = 15;

const CHARACTER_BLOCK_COLUMNS = 4;
const CHARACTER_BLOCK_ROWS = 3;
const DIRECTION_COLUMN_OFFSET = {
  left: 0,
  down: 1,
  up: 2,
  right: 3,
};

const AVATAR_PRESET_DEFINITIONS = [
  { id: 'avatar-01', name: '아바타 1', accentColor: '#60a5fa', spriteBlockColumn: 0, spriteBlockRow: 0 },
  { id: 'avatar-02', name: '아바타 2', accentColor: '#818cf8', spriteBlockColumn: 1, spriteBlockRow: 0 },
  { id: 'avatar-03', name: '아바타 3', accentColor: '#f59e0b', spriteBlockColumn: 0, spriteBlockRow: 1 },
  { id: 'avatar-04', name: '아바타 4', accentColor: '#22c55e', spriteBlockColumn: 1, spriteBlockRow: 1 },
  { id: 'avatar-05', name: '아바타 5', accentColor: '#38bdf8', spriteBlockColumn: 0, spriteBlockRow: 2 },
  { id: 'avatar-06', name: '아바타 6', accentColor: '#a78bfa', spriteBlockColumn: 1, spriteBlockRow: 2 },
  { id: 'avatar-07', name: '아바타 7', accentColor: '#fb7185', spriteBlockColumn: 0, spriteBlockRow: 3 },
  { id: 'avatar-08', name: '아바타 8', accentColor: '#2dd4bf', spriteBlockColumn: 1, spriteBlockRow: 3 },
  { id: 'avatar-09', name: '아바타 9', accentColor: '#f97316', spriteBlockColumn: 0, spriteBlockRow: 4 },
  { id: 'avatar-10', name: '아바타 10', accentColor: '#e879f9', spriteBlockColumn: 1, spriteBlockRow: 4 },
];

export const AVATAR_PRESETS = AVATAR_PRESET_DEFINITIONS.map((preset) => ({
  ...preset,
  summary: '',
}));

const DEFAULT_PRESET = AVATAR_PRESETS[0];

function normalizePresetId(presetId) {
  return typeof presetId === 'string' ? presetId.trim() : '';
}

function normalizeDirection(direction) {
  return Object.prototype.hasOwnProperty.call(DIRECTION_COLUMN_OFFSET, direction)
    ? direction
    : 'down';
}

function toColorValue(color) {
  return Number.parseInt(String(color).replace('#', ''), 16);
}

export function getAvatarPreset(presetId) {
  const normalizedPresetId = normalizePresetId(presetId);

  return AVATAR_PRESETS.find((preset) => preset.id === normalizedPresetId) || DEFAULT_PRESET;
}

export function getDefaultAvatarPreset() {
  return DEFAULT_PRESET;
}

export function getAvatarPalette(presetId) {
  const preset = getAvatarPreset(presetId);

  return {
    ...preset,
    accentColorValue: toColorValue(preset.accentColor),
  };
}

export function getAvatarSpriteConfig(presetId) {
  const preset = getAvatarPreset(presetId);

  return {
    textureKey: AVATAR_SPRITE_SHEET_KEY,
    textureUrl: AVATAR_SPRITE_SHEET_URL,
    frameSize: AVATAR_SPRITE_FRAME_SIZE,
    sheetColumns: AVATAR_SPRITE_SHEET_COLUMNS,
    sheetRows: AVATAR_SPRITE_SHEET_ROWS,
    baseColumn: preset.spriteBlockColumn * CHARACTER_BLOCK_COLUMNS,
    baseRow: preset.spriteBlockRow * CHARACTER_BLOCK_ROWS,
  };
}

export function getAvatarSpriteFrame(presetId, direction = 'down', step = 0) {
  const spriteConfig = getAvatarSpriteConfig(presetId);
  const nextDirection = normalizeDirection(direction);
  const clampedStep = Math.max(0, Math.min(CHARACTER_BLOCK_ROWS - 1, Number(step) || 0));
  const column = spriteConfig.baseColumn + DIRECTION_COLUMN_OFFSET[nextDirection];
  const row = spriteConfig.baseRow + clampedStep;

  return {
    column,
    row,
    index: row * AVATAR_SPRITE_SHEET_COLUMNS + column,
  };
}

export function getAvatarPreviewFrame(presetId) {
  return getAvatarSpriteFrame(presetId, 'down', 0);
}

export function getAvatarDirectionFromDelta(deltaX, deltaY, fallbackDirection = 'down') {
  const nextFallbackDirection = normalizeDirection(fallbackDirection);

  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    return nextFallbackDirection;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX < 0) {
      return 'left';
    }

    if (deltaX > 0) {
      return 'right';
    }
  } else {
    if (deltaY < 0) {
      return 'up';
    }

    if (deltaY > 0) {
      return 'down';
    }
  }

  return nextFallbackDirection;
}
