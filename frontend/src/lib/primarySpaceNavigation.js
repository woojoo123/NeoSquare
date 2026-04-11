import { getSpaces } from '../api/spaces';

const SPACE_PRIORITY = ['MAIN', 'STUDY', 'MENTORING'];
const LOBBY_FALLBACK_PATH = '/lobby';

function getSpacePriority(spaceType) {
  const priority = SPACE_PRIORITY.indexOf(spaceType);
  return priority === -1 ? SPACE_PRIORITY.length : priority;
}

export function getPrimarySpace(spaces) {
  if (!Array.isArray(spaces) || spaces.length === 0) {
    return null;
  }

  return [...spaces].sort((left, right) => getSpacePriority(left?.type) - getSpacePriority(right?.type))[0] || null;
}

export function getPrimarySpacePathFromSpaces(spaces) {
  const primarySpace = getPrimarySpace(spaces);

  if (!primarySpace?.id) {
    return LOBBY_FALLBACK_PATH;
  }

  return `/spaces/${primarySpace.id}`;
}

export async function resolvePrimarySpacePath() {
  try {
    const spaces = await getSpaces();
    return getPrimarySpacePathFromSpaces(spaces);
  } catch {
    return LOBBY_FALLBACK_PATH;
  }
}

export function getLobbyFallbackPath() {
  return LOBBY_FALLBACK_PATH;
}
