import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMySessionFeedbacks } from '../api/feedbacks';
import { getMyMentorCourseApplications } from '../api/mentorCourseApplications';
import { getSentMentoringRequests } from '../api/mentoring';
import { getMyReservations } from '../api/reservations';
import AppLayout from '../components/AppLayout';
import { getCourseSessionEntryState } from '../lib/courseSessionEntryState';
import { getReservationEntryState } from '../lib/reservationEntryState';

function unwrapItems(rawValue, keys = []) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  for (const key of keys) {
    if (Array.isArray(rawValue?.[key])) {
      return rawValue[key];
    }
  }

  return [];
}

function normalizeSentRequests(rawValue) {
  return unwrapItems(rawValue, ['requests']).map((request, index) => ({
    id: request.id ?? `request-${index}`,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      '멘토',
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
    createdAt: request.createdAt || request.timestamp || null,
    type: 'request',
  }));
}

function normalizeReservations(rawValue) {
  return unwrapItems(rawValue, ['reservations']).map((reservation, index) => ({
    id: reservation.id ?? `reservation-${index}`,
    mentorLabel:
      reservation.mentorLabel ||
      reservation.mentorNickname ||
      reservation.mentorName ||
      reservation.receiverNickname ||
      reservation.targetNickname ||
      '멘토',
    message: reservation.message || reservation.content || '',
    status: reservation.status || 'PENDING',
    reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
    createdAt: reservation.createdAt || reservation.timestamp || null,
    sessionEntryOpenAt: reservation.sessionEntryOpenAt || null,
    sessionEntryCloseAt: reservation.sessionEntryCloseAt || null,
    type: 'reservation',
  }));
}

function normalizeCourseApplications(rawValue) {
  return unwrapItems(rawValue, ['applications']).map((application, index) => ({
    id: application.id ?? `course-application-${index}`,
    courseTitle: application.courseTitle || '멘토링',
    mentorNickname: application.mentorNickname || '멘토',
    message: application.message || '',
    status: application.status || 'PENDING',
    createdAt: application.createdAt || null,
    reviewedAt: application.reviewedAt || null,
    assignedScheduleTitle: application.assignedScheduleTitle || '',
    assignedScheduleStartsAt: application.assignedScheduleStartsAt || null,
    assignedScheduleItemId: application.assignedScheduleItemId ?? null,
    sessionEntryOpenAt: application.sessionEntryOpenAt || null,
    sessionEntryCloseAt: application.sessionEntryCloseAt || null,
    type: 'course_application',
  }));
}

function normalizeFeedbacks(rawValue) {
  return unwrapItems(rawValue, ['feedbacks']).map((feedback, index) => ({
    id: feedback.id ?? `feedback-${index}`,
    counterpartName: feedback.counterpartName || feedback.counterpartLabel || '상대 사용자',
    summary: feedback.summary || '',
    submittedAt: feedback.submittedAt || feedback.createdAt || null,
  }));
}

function getTimestampValue(value) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDateTime(value) {
  if (!value) {
    return '일정 미정';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '일정 미정';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getLearningStatusLabel(item) {
  if (item.type === 'request') {
    return item.status === 'ACCEPTED' ? '승인됨' : item.status === 'REJECTED' ? '거절됨' : '대기 중';
  }

  if (item.type === 'reservation') {
    if (item.status === 'ACCEPTED') {
      return '예정됨';
    }

    if (item.status === 'CANCELED') {
      return '취소됨';
    }

    return item.status === 'REJECTED' ? '반려됨' : '대기 중';
  }

  if (item.status === 'APPROVED') {
    return '예정됨';
  }

  if (item.status === 'CANCELED') {
    return '취소됨';
  }

  return item.status === 'REJECTED' ? '반려됨' : '대기 중';
}

function getLearningTab(item, nowTimestamp) {
  if (item.type === 'reservation') {
    if (item.status === 'ACCEPTED') {
      const entryState = getReservationEntryState(item, nowTimestamp);
      return entryState.canEnter ? 'active' : 'upcoming';
    }

    return item.status === 'PENDING' ? 'pending' : item.status === 'REJECTED' || item.status === 'CANCELED' ? 'closed' : 'history';
  }

  if (item.type === 'course_application') {
    if (item.status === 'APPROVED') {
      const entryState = getCourseSessionEntryState(item, nowTimestamp);
      return entryState.canEnter ? 'active' : 'upcoming';
    }

    return item.status === 'PENDING' ? 'pending' : item.status === 'REJECTED' || item.status === 'CANCELED' ? 'closed' : 'history';
  }

  if (item.status === 'ACCEPTED') {
    return 'active';
  }

  return item.status === 'PENDING' ? 'pending' : item.status === 'REJECTED' ? 'closed' : 'history';
}

export default function MyLearningPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [learningItems, setLearningItems] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    let isMounted = true;

    async function loadLearningData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [requestsResponse, reservationsResponse, courseApplicationsResponse, feedbacksResponse] =
          await Promise.all([
            getSentMentoringRequests(),
            getMyReservations(),
            getMyMentorCourseApplications(),
            getMySessionFeedbacks(),
          ]);

        if (!isMounted) {
          return;
        }

        const nextLearningItems = [
          ...normalizeSentRequests(requestsResponse),
          ...normalizeReservations(reservationsResponse),
          ...normalizeCourseApplications(courseApplicationsResponse),
        ].sort((leftItem, rightItem) => {
          const leftTime = Math.max(
            getTimestampValue(leftItem.reservedAt),
            getTimestampValue(leftItem.assignedScheduleStartsAt),
            getTimestampValue(leftItem.reviewedAt),
            getTimestampValue(leftItem.createdAt)
          );
          const rightTime = Math.max(
            getTimestampValue(rightItem.reservedAt),
            getTimestampValue(rightItem.assignedScheduleStartsAt),
            getTimestampValue(rightItem.reviewedAt),
            getTimestampValue(rightItem.createdAt)
          );

          return rightTime - leftTime;
        });

        setLearningItems(nextLearningItems);
        setFeedbackItems(normalizeFeedbacks(feedbacksResponse));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error?.response?.data?.message || error.message || '내 학습 정보를 불러오지 못했습니다.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLearningData();

    return () => {
      isMounted = false;
    };
  }, []);

  const nowTimestamp = Date.now();
  const tabDefinitions = useMemo(
    () => [
      { id: 'upcoming', label: '예정됨' },
      { id: 'active', label: '입장 가능' },
      { id: 'pending', label: '대기 중' },
      { id: 'closed', label: '취소/반려' },
    ],
    []
  );
  const groupedItems = useMemo(() => {
    const nextGroups = {
      upcoming: [],
      active: [],
      pending: [],
      closed: [],
    };

    learningItems.forEach((item) => {
      const targetTab = getLearningTab(item, nowTimestamp);

      if (nextGroups[targetTab]) {
        nextGroups[targetTab].push(item);
      }
    });

    return nextGroups;
  }, [learningItems, nowTimestamp]);

  return (
    <AppLayout
      eyebrow="내 학습"
      title="요청, 예약, 멘토링 일정을 한곳에서 관리하세요"
      description="예정된 일정, 승인 상태, 입장 가능 시간과 최근 진행 기록을 이곳에서 이어서 확인합니다."
      panelClassName="app-panel--wide"
    >
      <section className="workspace-page">
        <header className="workspace-page__toolbar">
          <div className="workspace-page__tabs" role="tablist" aria-label="내 학습 상태">
            {tabDefinitions.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                <strong>{groupedItems[tab.id]?.length ?? 0}</strong>
              </button>
            ))}
          </div>
        </header>

        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

        <div className="workspace-page__grid">
          <section className="workspace-card">
            <h2>{tabDefinitions.find((tab) => tab.id === activeTab)?.label}</h2>
            {isLoading ? (
              <p>내 학습 정보를 불러오는 중입니다.</p>
            ) : groupedItems[activeTab]?.length ? (
              <div className="workspace-list">
                {groupedItems[activeTab].map((item) => {
                  const itemLabel =
                    item.type === 'course_application'
                      ? `${item.courseTitle} · ${item.mentorNickname}`
                      : item.mentorLabel;
                  const itemTime =
                    item.type === 'reservation'
                      ? formatDateTime(item.reservedAt)
                      : item.type === 'course_application'
                        ? formatDateTime(item.assignedScheduleStartsAt || item.createdAt)
                        : formatDateTime(item.createdAt);

                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      className="workspace-list-item"
                      onClick={() => navigate(`/my-learning/${item.type}-${item.id}`)}
                    >
                      <strong>{itemLabel}</strong>
                      <p>{item.message || '남긴 메모가 없습니다.'}</p>
                      <div className="workspace-list-item__meta">
                        <span>{getLearningStatusLabel(item)}</span>
                        <small>{itemTime}</small>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="workspace-empty">
                <strong>표시할 항목이 없습니다.</strong>
                <p>새 요청이나 예약이 생기면 이 목록에서 바로 상태를 확인할 수 있습니다.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => navigate('/mentors')}
                >
                  멘토 찾아보기
                </button>
              </div>
            )}
          </section>

          <section className="workspace-card">
            <h2>최근 진행 기록</h2>
            {feedbackItems.length ? (
              <div className="workspace-list">
                {feedbackItems.slice(0, 5).map((feedback) => (
                  <article key={feedback.id} className="workspace-history-item">
                    <strong>{feedback.counterpartName}</strong>
                    <p>{feedback.summary || '저장된 진행 요약이 없습니다.'}</p>
                    <small>{formatDateTime(feedback.submittedAt)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="workspace-empty">
                <strong>아직 진행 기록이 없습니다.</strong>
                <p>첫 멘토링을 마치고 후기를 남기면 이곳에 기록이 쌓입니다.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </AppLayout>
  );
}
