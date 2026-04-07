const STORAGE_KEY = 'neosquare-mentoring-reservations';

function readReservationMap() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch (error) {
    return {};
  }
}

function writeReservationMap(reservationMap) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reservationMap));
}

function sortReservations(reservations) {
  return reservations.sort((leftReservation, rightReservation) => {
    const leftTime = new Date(leftReservation.reservedAt || 0).getTime();
    const rightTime = new Date(rightReservation.reservedAt || 0).getTime();
    return leftTime - rightTime;
  });
}

function updateStoredMentoringReservationStatus(reservationId, userId, nextStatus, roleKey) {
  if (typeof window === 'undefined') {
    throw new Error('Mentoring reservation storage is unavailable.');
  }

  const reservationMap = readReservationMap();
  const existingReservation = reservationMap[reservationId];

  if (!existingReservation) {
    throw new Error('Reservation not found.');
  }

  if (String(existingReservation[roleKey]) !== String(userId)) {
    throw new Error('You can only update reservations assigned to you.');
  }

  const updatedReservation = {
    ...existingReservation,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  reservationMap[reservationId] = updatedReservation;
  writeReservationMap(reservationMap);

  return updatedReservation;
}

export function getStoredMentoringReservations(userId) {
  if (!userId) {
    return [];
  }

  const reservationMap = readReservationMap();

  return sortReservations(
    Object.values(reservationMap).filter(
      (reservation) => String(reservation.requesterId) === String(userId)
    )
  );
}

export function getStoredReceivedMentoringReservations(userId) {
  if (!userId) {
    return [];
  }

  const reservationMap = readReservationMap();

  return sortReservations(
    Object.values(reservationMap).filter(
      (reservation) => String(reservation.mentorId) === String(userId)
    )
  );
}

export function saveMentoringReservation(reservationInput) {
  if (typeof window === 'undefined') {
    throw new Error('Mentoring reservation storage is unavailable.');
  }

  if (!reservationInput?.requesterId || !reservationInput?.mentorId || !reservationInput?.reservedAt) {
    throw new Error('Requester, mentor, and reservation time are required.');
  }

  const reservationMap = readReservationMap();
  const reservationId =
    reservationInput.id ||
    `reservation-${reservationInput.requesterId}-${Date.now()}`;

  const savedReservation = {
    id: reservationId,
    requesterId: reservationInput.requesterId,
    requesterLabel: reservationInput.requesterLabel || 'You',
    mentorId: reservationInput.mentorId,
    mentorLabel: reservationInput.mentorLabel || `User ${reservationInput.mentorId}`,
    reservedAt: reservationInput.reservedAt,
    message: reservationInput.message || '',
    status: reservationInput.status || 'PENDING',
    createdAt: reservationInput.createdAt || new Date().toISOString(),
  };

  reservationMap[reservationId] = savedReservation;
  writeReservationMap(reservationMap);

  return savedReservation;
}

export function cancelStoredMentoringReservation(reservationId, requesterId) {
  return updateStoredMentoringReservationStatus(
    reservationId,
    requesterId,
    'CANCELED',
    'requesterId'
  );
}

export function acceptStoredMentoringReservation(reservationId, mentorId) {
  return updateStoredMentoringReservationStatus(
    reservationId,
    mentorId,
    'ACCEPTED',
    'mentorId'
  );
}

export function rejectStoredMentoringReservation(reservationId, mentorId) {
  return updateStoredMentoringReservationStatus(
    reservationId,
    mentorId,
    'REJECTED',
    'mentorId'
  );
}
