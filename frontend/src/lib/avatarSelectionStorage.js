import { getDefaultAvatarPreset, getAvatarPreset } from './avatarPresets';

const STORAGE_KEY = 'neosquare-avatar-selection';
const ONBOARDING_STORAGE_KEY = 'neosquare-avatar-onboarding';
const PENDING_STORAGE_KEY = 'neosquare-avatar-selection-pending';

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

function readAvatarOnboardingMap() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch (error) {
    console.warn('Failed to read avatar onboarding state from local storage:', error);
    return {};
  }
}

function writeAvatarOnboardingMap(nextValue) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextValue));
  } catch (error) {
    console.warn('Failed to persist avatar onboarding state:', error);
  }
}

function readPendingAvatarPresetIdValue() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(PENDING_STORAGE_KEY) || '';
  } catch (error) {
    console.warn('Failed to read pending avatar selection:', error);
    return '';
  }
}

function writePendingAvatarPresetIdValue(nextValue) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (nextValue) {
      window.localStorage.setItem(PENDING_STORAGE_KEY, nextValue);
      return;
    }

    window.localStorage.removeItem(PENDING_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to persist pending avatar selection:', error);
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

export function getPendingAvatarPresetId() {
  return getAvatarPreset(readPendingAvatarPresetIdValue()).id;
}

export function hasPendingAvatarPresetId() {
  return Boolean(readPendingAvatarPresetIdValue());
}

export function setPendingAvatarPresetId(presetId) {
  const nextPresetId = getAvatarPreset(presetId).id;
  writePendingAvatarPresetIdValue(nextPresetId);
  return nextPresetId;
}

export function clearPendingAvatarPresetId() {
  writePendingAvatarPresetIdValue('');
}

export function hasCompletedAvatarOnboarding(userId) {
  if (!userId) {
    return false;
  }

  const avatarOnboardingMap = readAvatarOnboardingMap();
  return avatarOnboardingMap[String(userId)] === true;
}

export function markAvatarOnboardingComplete(userId) {
  if (!userId) {
    return;
  }

  const avatarOnboardingMap = readAvatarOnboardingMap();
  writeAvatarOnboardingMap({
    ...avatarOnboardingMap,
    [String(userId)]: true,
  });
}
