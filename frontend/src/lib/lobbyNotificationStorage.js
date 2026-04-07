function getStorageKey(userId) {
  return `neosquare-lobby-dismissed-notifications:${userId || 'anonymous'}`;
}

export function getDismissedLobbyNotificationIds(userId) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.sessionStorage.getItem(getStorageKey(userId));

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    return [];
  }
}

export function dismissLobbyNotification(userId, notificationId) {
  if (typeof window === 'undefined' || !notificationId) {
    return [];
  }

  const currentIds = getDismissedLobbyNotificationIds(userId);

  if (currentIds.includes(notificationId)) {
    return currentIds;
  }

  const nextIds = [...currentIds, notificationId];
  window.sessionStorage.setItem(getStorageKey(userId), JSON.stringify(nextIds));
  return nextIds;
}
