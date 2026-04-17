const ENTRY_OPEN_WINDOW_MINUTES = 10;
const ENTRY_EXPIRE_WINDOW_MINUTES = 30;

function formatRelativeMinutes(totalMinutes) {
  if (totalMinutes <= 1) {
    return 'under 1 min';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

export function getCourseSessionEntryState(application, nowTimestamp = Date.now()) {
  const assignedScheduleStartsAt =
    application?.assignedScheduleStartsAt || application?.reservedAt || null;
  const assignedScheduleEndsAt = application?.assignedScheduleEndsAt || assignedScheduleStartsAt;

  if (!assignedScheduleStartsAt) {
    return {
      status: 'unknown',
      canEnter: false,
      label: 'Course session unavailable',
      detail: 'Assigned schedule information is missing, so the session window could not be calculated.',
      reservedAt: null,
      entryOpenAt: null,
      entryCloseAt: null,
    };
  }

  const startsAtTimestamp = new Date(assignedScheduleStartsAt).getTime();
  const endsAtTimestamp = new Date(assignedScheduleEndsAt).getTime();
  const safeEndsAtTimestamp =
    Number.isNaN(endsAtTimestamp) || endsAtTimestamp < startsAtTimestamp
      ? startsAtTimestamp
      : endsAtTimestamp;

  const entryOpenTimestamp = application?.sessionEntryOpenAt
    ? new Date(application.sessionEntryOpenAt).getTime()
    : startsAtTimestamp - ENTRY_OPEN_WINDOW_MINUTES * 60 * 1000;
  const entryExpireTimestamp = application?.sessionEntryCloseAt
    ? new Date(application.sessionEntryCloseAt).getTime()
    : safeEndsAtTimestamp + ENTRY_EXPIRE_WINDOW_MINUTES * 60 * 1000;

  if (
    Number.isNaN(startsAtTimestamp) ||
    Number.isNaN(entryOpenTimestamp) ||
    Number.isNaN(entryExpireTimestamp)
  ) {
    return {
      status: 'unknown',
      canEnter: false,
      label: 'Course session unavailable',
      detail: 'Assigned schedule time is invalid, so the session window could not be calculated.',
      reservedAt: null,
      entryOpenAt: null,
      entryCloseAt: null,
    };
  }

  const sessionWindow = {
    reservedAt: new Date(startsAtTimestamp).toISOString(),
    entryOpenAt: new Date(entryOpenTimestamp).toISOString(),
    entryCloseAt: new Date(entryExpireTimestamp).toISOString(),
  };

  if (nowTimestamp < entryOpenTimestamp) {
    const minutesUntilEntry = Math.ceil((entryOpenTimestamp - nowTimestamp) / (60 * 1000));

    return {
      status: 'upcoming',
      canEnter: false,
      label: `Entry opens in ${formatRelativeMinutes(minutesUntilEntry)}`,
      detail: 'Participants can enter starting 10 minutes before the assigned class session.',
      ...sessionWindow,
    };
  }

  if (nowTimestamp <= entryExpireTimestamp) {
    const minutesUntilStart = Math.ceil((startsAtTimestamp - nowTimestamp) / (60 * 1000));

    if (minutesUntilStart > 0) {
      return {
        status: 'ready',
        canEnter: true,
        label: `Ready to enter · starts in ${formatRelativeMinutes(minutesUntilStart)}`,
        detail: 'The class session window is open. You can join now and prepare before it starts.',
        ...sessionWindow,
      };
    }

    return {
      status: 'ready',
      canEnter: true,
      label: 'Ready to enter now',
      detail: 'The class session is in progress. Participants can keep joining until the entry window closes.',
      ...sessionWindow,
    };
  }

  return {
    status: 'expired',
    canEnter: false,
    label: 'Course session closed',
    detail: 'The class session entry window has closed, so the session can no longer be joined.',
    ...sessionWindow,
  };
}
