let unauthorizedHandler = null;

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

export function notifyUnauthorized(context = {}) {
  if (typeof unauthorizedHandler === 'function') {
    unauthorizedHandler(context);
  }
}
