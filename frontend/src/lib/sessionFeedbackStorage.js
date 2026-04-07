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

export function getStoredSessionFeedback(requestId) {
  if (!requestId) {
    return null;
  }

  const feedbackMap = readFeedbackMap();
  return feedbackMap[String(requestId)] || null;
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
    counterpartName: feedbackInput.counterpartName || 'Session partner',
    role: feedbackInput.role || 'Participant',
    rating: Number(feedbackInput.rating) || 0,
    summary: feedbackInput.summary || '',
    feedback: feedbackInput.feedback || '',
    submittedAt: feedbackInput.submittedAt || new Date().toISOString(),
  };

  feedbackMap[requestId] = savedFeedback;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(feedbackMap));

  return savedFeedback;
}
