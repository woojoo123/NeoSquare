import { getDefaultAvatarPreset, getAvatarPreset } from './avatarPresets';

const STORAGE_KEY = 'neosquare-avatar-selection';

function readAvatarSelectionMap() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch (error) {
    console.warn('Failed to read avatar selection from local storage:', error);
    return {};
  }
}

function writeAvatarSelectionMap(nextValue) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  } catch (error) {
    console.warn('Failed to persist avatar selection to local storage:', error);
  }
}

export function getSelectedAvatarPresetId(userId) {
  if (!userId) {
    return getDefaultAvatarPreset().id;
  }

  const avatarSelectionMap = readAvatarSelectionMap();
  return getAvatarPreset(avatarSelectionMap[String(userId)]).id;
}

export function setSelectedAvatarPresetId(userId, presetId) {
  if (!userId) {
    return getDefaultAvatarPreset().id;
  }

  const avatarSelectionMap = readAvatarSelectionMap();
  const nextPresetId = getAvatarPreset(presetId).id;
  const nextAvatarSelectionMap = {
    ...avatarSelectionMap,
    [String(userId)]: nextPresetId,
  };

  writeAvatarSelectionMap(nextAvatarSelectionMap);
  return nextPresetId;
}
