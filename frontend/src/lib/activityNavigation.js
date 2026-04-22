const ACTIVITY_TAB_ALIASES = {
  notification: 'notifications',
  notifications: 'notifications',
  schedule: 'schedule',
  learning: 'schedule',
  'my-learning': 'schedule',
  message: 'messages',
  messages: 'messages',
  feedback: 'feedback',
  history: 'feedback',
  record: 'feedback',
  records: 'feedback',
  mentor_application: 'mentor_application',
  'mentor-application': 'mentor_application',
};

function normalizeLegacyType(value) {
  return String(value || '')
    .trim()
    .replace(/-/g, '_')
    .toLowerCase();
}

export function normalizeActivityTab(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  return ACTIVITY_TAB_ALIASES[normalizedValue] || 'notifications';
}

export function buildScheduleItemId(itemType, itemId) {
  const normalizedType = normalizeLegacyType(itemType);

  if (!itemId || !normalizedType) {
    return null;
  }

  if (normalizedType === 'course_application') {
    return `progress-course-application-${itemId}`;
  }

  return `progress-${normalizedType}-${itemId}`;
}

export function buildMessageItemId(itemType, itemId) {
  const normalizedType = normalizeLegacyType(itemType);

  if (!itemId || !normalizedType) {
    return null;
  }

  if (normalizedType === 'course_application') {
    return `message-course-application-${itemId}`;
  }

  return `message-${normalizedType}-${itemId}`;
}

export function buildScheduleItemIdFromLegacyItemId(legacyItemId) {
  const rawValue = String(legacyItemId || '').trim();

  if (!rawValue) {
    return null;
  }

  const match = rawValue.match(/^(request|reservation|course_application)-(.+)$/);

  if (!match) {
    return rawValue;
  }

  return buildScheduleItemId(match[1], match[2]);
}

export function buildMessageItemIdFromLegacyThreadId(legacyThreadId) {
  const rawValue = String(legacyThreadId || '').trim();

  if (!rawValue) {
    return null;
  }

  const match = rawValue.match(/^(request|reservation|course_application)-(.+)$/);

  if (!match) {
    return rawValue;
  }

  return buildMessageItemId(match[1], match[2]);
}

export function buildActivityPath(tab = 'notifications', itemId = null) {
  const searchParams = new URLSearchParams();

  searchParams.set('tab', normalizeActivityTab(tab));

  if (itemId) {
    searchParams.set('item', String(itemId));
  }

  return `/hub?${searchParams.toString()}`;
}
