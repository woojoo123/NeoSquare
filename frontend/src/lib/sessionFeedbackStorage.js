const STORAGE_KEY = 'neosquare-session-feedback';

function readFeedbackMap() {
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

function writeFeedbackMap(feedbackMap) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(feedbackMap));
}

export function getStoredSessionFeedback(requestId) {
  if (!requestId) {
    return null;
  }

  const feedbackMap = readFeedbackMap();
  return feedbackMap[String(requestId)] || null;
}

export function getStoredSessionFeedbacks(userId) {
  const feedbackMap = readFeedbackMap();
  const feedbackItems = Object.values(feedbackMap);

  return feedbackItems
    .filter((feedbackItem) => {
      if (!userId) {
        return true;
      }

      return (
        !feedbackItem.authorUserId ||
        String(feedbackItem.authorUserId) === String(userId)
      );
    })
    .sort((leftFeedback, rightFeedback) => {
      const leftTime = new Date(leftFeedback.submittedAt || 0).getTime();
      const rightTime = new Date(rightFeedback.submittedAt || 0).getTime();
      return rightTime - leftTime;
    });
}

export function saveSessionFeedback(feedbackInput) {
  if (typeof window === 'undefined') {
    throw new Error('Session feedback storage is unavailable.');
  }

  const requestId = String(feedbackInput.requestId);

  if (!requestId) {
    throw new Error('A request id is required to save feedback.');
  }

  const feedbackMap = readFeedbackMap();
  const savedFeedback = {
    requestId,
    sessionSource: feedbackInput.sessionSource || 'request',
    counterpartName: feedbackInput.counterpartName || 'Session partner',
    role: feedbackInput.role || 'Participant',
    rating: Number(feedbackInput.rating) || 0,
    summary: feedbackInput.summary || '',
    feedback: feedbackInput.feedback || '',
    reservedAt: feedbackInput.reservedAt || null,
    authorUserId: feedbackInput.authorUserId ?? null,
    submittedAt: feedbackInput.submittedAt || new Date().toISOString(),
  };

  feedbackMap[requestId] = savedFeedback;
  writeFeedbackMap(feedbackMap);

  return savedFeedback;
}
