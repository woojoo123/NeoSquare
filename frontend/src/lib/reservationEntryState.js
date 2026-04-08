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
  if (!reservedAt) {
    return {
      status: 'unknown',
      canEnter: false,
      label: 'Reservation time unavailable',
    };
  }

  const reservedAtTimestamp = new Date(reservedAt).getTime();

  if (Number.isNaN(reservedAtTimestamp)) {
    return {
      status: 'unknown',
      canEnter: false,
      label: 'Reservation time unavailable',
    };
  }

  const entryOpenTimestamp = reservedAtTimestamp - ENTRY_OPEN_WINDOW_MINUTES * 60 * 1000;
  const entryExpireTimestamp = reservedAtTimestamp + ENTRY_EXPIRE_WINDOW_MINUTES * 60 * 1000;

  if (nowTimestamp < entryOpenTimestamp) {
    const minutesUntilEntry = Math.ceil((entryOpenTimestamp - nowTimestamp) / (60 * 1000));

    return {
      status: 'upcoming',
      canEnter: false,
      label: `Entry opens in ${formatRelativeMinutes(minutesUntilEntry)}`,
    };
  }

  if (nowTimestamp <= entryExpireTimestamp) {
    const minutesUntilStart = Math.ceil((reservedAtTimestamp - nowTimestamp) / (60 * 1000));

    if (minutesUntilStart > 0) {
      return {
        status: 'ready',
        canEnter: true,
        label: `Ready to enter · starts in ${formatRelativeMinutes(minutesUntilStart)}`,
      };
    }

    return {
      status: 'ready',
      canEnter: true,
      label: 'Ready to enter now',
    };
  }

  return {
    status: 'expired',
    canEnter: false,
    label: 'Reservation time passed',
  };
}
