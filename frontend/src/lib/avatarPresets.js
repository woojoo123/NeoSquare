export const AVATAR_PRESETS = [
  {
    id: 'sky-runner',
    name: '스카이 러너',
    summary: '밝고 빠른 첫 인상',
    bodyColor: '#33b3ff',
    bodyOutlineColor: '#e0f2fe',
    capeColor: '#0f3b68',
    headColor: '#f8e6d6',
    hairColor: '#172554',
    accentColor: '#e0f2fe',
  },
  {
    id: 'forest-maker',
    name: '포레스트 메이커',
    summary: '차분하게 연결을 여는 타입',
    bodyColor: '#22c55e',
    bodyOutlineColor: '#dcfce7',
    capeColor: '#14532d',
    headColor: '#f7dbc4',
    hairColor: '#3f2c22',
    accentColor: '#dcfce7',
  },
  {
    id: 'sunset-guide',
    name: '선셋 가이드',
    summary: '대화를 이끄는 따뜻한 무드',
    bodyColor: '#f59e0b',
    bodyOutlineColor: '#fef3c7',
    capeColor: '#7c2d12',
    headColor: '#f6dcc7',
    hairColor: '#6b2f1b',
    accentColor: '#fef3c7',
  },
  {
    id: 'rose-weaver',
    name: '로즈 위버',
    summary: '부드럽고 또렷한 존재감',
    bodyColor: '#f43f5e',
    bodyOutlineColor: '#ffe4e6',
    capeColor: '#881337',
    headColor: '#f7ddcf',
    hairColor: '#4c1d95',
    accentColor: '#ffe4e6',
  },
];

const DEFAULT_PRESET = AVATAR_PRESETS[0];

function normalizePresetId(presetId) {
  return typeof presetId === 'string' ? presetId.trim() : '';
}

function colorToNumber(color) {
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
    bodyColorValue: colorToNumber(preset.bodyColor),
    bodyOutlineColorValue: colorToNumber(preset.bodyOutlineColor),
    capeColorValue: colorToNumber(preset.capeColor),
    headColorValue: colorToNumber(preset.headColor),
    hairColorValue: colorToNumber(preset.hairColor),
    accentColorValue: colorToNumber(preset.accentColor),
  };
}
