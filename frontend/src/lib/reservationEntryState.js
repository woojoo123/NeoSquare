const ENTRY_OPEN_WINDOW_MINUTES = 10;
const ENTRY_EXPIRE_WINDOW_MINUTES = 120;

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

export function getReservationEntryState(reservedAt, nowTimestamp = Date.now()) {
  const reservation =
    reservedAt && typeof reservedAt === 'object' && !Array.isArray(reservedAt)
      ? reservedAt
      : null;
  const reservedAtValue = reservation?.reservedAt ?? reservedAt;

  if (!reservedAtValue) {
    return {
      status: 'unknown',
      canEnter: false,
      label: 'Reservation time unavailable',
      detail: 'Reservation time is missing, so the session window could not be calculated.',
      reservedAt: null,
      entryOpenAt: null,
      entryCloseAt: null,
    };
  }

  const reservedAtTimestamp = new Date(reservedAtValue).getTime();

  const entryOpenTimestamp = reservation?.sessionEntryOpenAt
    ? new Date(reservation.sessionEntryOpenAt).getTime()
    : reservedAtTimestamp - ENTRY_OPEN_WINDOW_MINUTES * 60 * 1000;
  const entryExpireTimestamp = reservation?.sessionEntryCloseAt
    ? new Date(reservation.sessionEntryCloseAt).getTime()
    : reservedAtTimestamp + ENTRY_EXPIRE_WINDOW_MINUTES * 60 * 1000;

  if (
    Number.isNaN(reservedAtTimestamp) ||
    Number.isNaN(entryOpenTimestamp) ||
    Number.isNaN(entryExpireTimestamp)
  ) {
    return {
      status: 'unknown',
      canEnter: false,
      label: 'Reservation time unavailable',
      detail: 'Reservation time is invalid, so the session window could not be calculated.',
      reservedAt: null,
      entryOpenAt: null,
      entryCloseAt: null,
    };
  }

  const reservationWindow = {
    reservedAt: new Date(reservedAtTimestamp).toISOString(),
    entryOpenAt: new Date(entryOpenTimestamp).toISOString(),
    entryCloseAt: new Date(entryExpireTimestamp).toISOString(),
  };

  if (nowTimestamp < entryOpenTimestamp) {
    const minutesUntilEntry = Math.ceil((entryOpenTimestamp - nowTimestamp) / (60 * 1000));

    return {
      status: 'upcoming',
      canEnter: false,
      label: `Entry opens in ${formatRelativeMinutes(minutesUntilEntry)}`,
      detail: 'Participants can enter starting 10 minutes before the reserved time.',
      ...reservationWindow,
    };
  }

  if (nowTimestamp <= entryExpireTimestamp) {
    const minutesUntilStart = Math.ceil((reservedAtTimestamp - nowTimestamp) / (60 * 1000));

    if (minutesUntilStart > 0) {
      return {
        status: 'ready',
        canEnter: true,
        label: `Ready to enter · starts in ${formatRelativeMinutes(minutesUntilStart)}`,
        detail: 'The session window is open. You can join now and prepare before the session starts.',
        ...reservationWindow,
      };
    }

    return {
      status: 'ready',
      canEnter: true,
      label: 'Ready to enter now',
      detail: 'The reserved session is in progress. Participants can keep joining until the entry window closes.',
      ...reservationWindow,
    };
  }

  return {
    status: 'expired',
    canEnter: false,
    label: 'Reservation time passed',
    detail: 'The reservation entry window has closed, so the session can no longer be joined.',
    ...reservationWindow,
  };
}
