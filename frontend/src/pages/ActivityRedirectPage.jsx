import { Navigate, useLocation, useParams } from 'react-router-dom';

import {
  buildActivityPath,
  buildMessageItemIdFromLegacyThreadId,
  buildScheduleItemIdFromLegacyItemId,
} from '../lib/activityNavigation';

export default function ActivityRedirectPage({ mode }) {
  const location = useLocation();
  const { itemId } = useParams();

  if (mode === 'messages') {
    const nextItemId = buildMessageItemIdFromLegacyThreadId(location.state?.selectedThreadId);
    return <Navigate to={buildActivityPath('messages', nextItemId)} replace state={location.state || null} />;
  }

  const nextItemId = itemId ? buildScheduleItemIdFromLegacyItemId(itemId) : null;
  return <Navigate to={buildActivityPath('schedule', nextItemId)} replace state={location.state || null} />;
}
