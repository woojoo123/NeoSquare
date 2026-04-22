import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

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
    type: 'request',
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      '멘토',
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
    createdAt: request.createdAt || request.timestamp || null,
  }));
}

function normalizeReservations(rawValue) {
  return unwrapItems(rawValue, ['reservations']).map((reservation, index) => ({
    id: reservation.id ?? `reservation-${index}`,
    type: 'reservation',
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
    sessionEntryOpenAt: reservation.sessionEntryOpenAt || null,
    sessionEntryCloseAt: reservation.sessionEntryCloseAt || null,
    createdAt: reservation.createdAt || reservation.timestamp || null,
  }));
}

function normalizeCourseApplications(rawValue) {
  return unwrapItems(rawValue, ['applications']).map((application, index) => ({
    id: application.id ?? `course-application-${index}`,
    type: 'course_application',
    mentorLabel: application.mentorNickname || '멘토',
    courseTitle: application.courseTitle || '멘토링',
    message: application.message || '',
    status: application.status || 'PENDING',
    createdAt: application.createdAt || null,
    assignedScheduleTitle: application.assignedScheduleTitle || '',
    assignedScheduleStartsAt: application.assignedScheduleStartsAt || null,
    assignedScheduleItemId: application.assignedScheduleItemId ?? null,
    sessionEntryOpenAt: application.sessionEntryOpenAt || null,
    sessionEntryCloseAt: application.sessionEntryCloseAt || null,
    reviewNote: application.reviewNote || '',
  }));
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
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatLearningStatusLabel(item) {
  if (item.type === 'request') {
    if (item.status === 'ACCEPTED') {
      return '멘토가 요청을 수락했습니다';
    }

    if (item.status === 'REJECTED') {
      return '요청이 거절되었습니다';
    }

    if (item.status === 'COMPLETED') {
      return '멘토링이 종료되었습니다';
    }

    return '멘토의 응답을 기다리는 중입니다';
  }

  if (item.type === 'reservation') {
    if (item.status === 'ACCEPTED') {
      return '예약이 승인되었습니다';
    }

    if (item.status === 'REJECTED') {
      return '예약이 반려되었습니다';
    }

    if (item.status === 'CANCELED') {
      return '예약이 취소되었습니다';
    }

    return '예약 검토를 기다리는 중입니다';
  }

  if (item.status === 'APPROVED') {
    return '멘토링 신청이 승인되었습니다';
  }

  if (item.status === 'REJECTED') {
    return '멘토링 신청이 반려되었습니다';
  }

  if (item.status === 'CANCELED') {
    return '멘토링 신청이 취소되었습니다';
  }

  return '멘토링 신청을 검토하는 중입니다';
}

function formatShortStatus(item) {
  if (item.type === 'request') {
    return item.status === 'ACCEPTED'
      ? '승인됨'
      : item.status === 'REJECTED'
        ? '거절됨'
        : item.status === 'COMPLETED'
          ? '종료됨'
          : '대기 중';
  }

  if (item.type === 'reservation') {
    return item.status === 'ACCEPTED'
      ? '예정됨'
      : item.status === 'REJECTED'
        ? '반려됨'
        : item.status === 'CANCELED'
          ? '취소됨'
          : '대기 중';
  }

  return item.status === 'APPROVED'
    ? '예정됨'
    : item.status === 'REJECTED'
      ? '반려됨'
      : item.status === 'CANCELED'
        ? '취소됨'
        : '대기 중';
}

function getPrimaryDateLabel(item) {
  if (item.type === 'reservation') {
    return '예약 시간';
  }

  if (item.type === 'course_application') {
    return '배정 일정';
  }

  return '요청 시각';
}

function getNextActionCopy(item, entrySummary, hasFeedbackPrompt) {
  if (hasFeedbackPrompt) {
    return '방금 종료한 멘토링의 후기를 남기면 진행 기록에 바로 저장됩니다.';
  }

  if (entrySummary.canEnter) {
    return '입장 가능 시간 안입니다. 지금 메타버스에 바로 입장할 수 있습니다.';
  }

  if (item.type === 'course_application' && item.status === 'APPROVED') {
    return '배정된 회차와 입장 가능 시간을 확인한 뒤 준비해 주세요.';
  }

  if (item.type === 'reservation' && item.status === 'ACCEPTED') {
    return '예약 시간이 다가오면 이 화면에서 바로 입장할 수 있습니다.';
  }

  if (item.status === 'PENDING') {
    return '응답을 기다리는 동안 메시지와 내 활동에서 상태를 계속 확인할 수 있습니다.';
  }

  if (item.status === 'REJECTED' || item.status === 'CANCELED') {
    return '다른 멘토를 둘러보거나 새 멘토링을 다시 신청할 수 있습니다.';
  }

  return '관련 메시지와 다음 일정을 이 화면에서 함께 관리할 수 있습니다.';
}

function getRetryActionCopy(item) {
  if (item.type === 'course_application') {
    return {
      label: '다른 멘토링 보기',
      path: '/courses',
    };
  }

  return {
    label: '다른 멘토 보기',
    path: '/mentors',
  };
}

function buildEntrySummary(item) {
  const nowTimestamp = Date.now();

  if (item.type === 'reservation') {
    const entryState = getReservationEntryState(item, nowTimestamp);
    return {
      canEnter: item.status === 'ACCEPTED' && entryState.canEnter,
      label:
        item.status !== 'ACCEPTED'
          ? '승인 후 입장 가능'
          : entryState.canEnter
            ? '지금 입장 가능'
            : '입장 시간이 아직 열리지 않았습니다.',
    };
  }

  if (item.type === 'course_application') {
    const entryState = getCourseSessionEntryState(item, nowTimestamp);
    return {
      canEnter: item.status === 'APPROVED' && entryState.canEnter,
      label:
        item.status !== 'APPROVED'
          ? '승인 후 입장 가능'
          : entryState.canEnter
            ? '지금 입장 가능'
            : '입장 시간이 아직 열리지 않았습니다.',
    };
  }

  return {
    canEnter: item.status === 'ACCEPTED',
    label: item.status === 'ACCEPTED' ? '멘토와 일정 조율 후 입장할 수 있습니다.' : '응답을 기다리는 중입니다.',
  };
}

export default function MyLearningDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { itemId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [learningItem, setLearningItem] = useState(null);
  const [pageNotice, setPageNotice] = useState('');
  const feedbackPrompt = location.state?.feedbackPrompt || null;

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [requestsResponse, reservationsResponse, courseApplicationsResponse] = await Promise.all([
          getSentMentoringRequests(),
          getMyReservations(),
          getMyMentorCourseApplications(),
        ]);

        if (!isMounted) {
          return;
        }

        const allItems = [
          ...normalizeSentRequests(requestsResponse),
          ...normalizeReservations(reservationsResponse),
          ...normalizeCourseApplications(courseApplicationsResponse),
        ];

        const nextItem =
          allItems.find((candidate) => `${candidate.type}-${candidate.id}` === itemId) || null;

        setLearningItem(nextItem);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error?.response?.data?.message || error.message || '학습 상세를 불러오지 못했습니다.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [itemId]);

  const entrySummary = useMemo(
    () => (learningItem ? buildEntrySummary(learningItem) : { canEnter: false, label: '' }),
    [learningItem]
  );
  const statusBannerTone = feedbackPrompt
    ? 'pending'
    : entrySummary.canEnter
      ? 'ready'
      : learningItem?.status === 'REJECTED' || learningItem?.status === 'CANCELED'
        ? 'muted'
        : 'info';
  const retryAction = useMemo(
    () => (learningItem ? getRetryActionCopy(learningItem) : { label: '멘토 보기', path: '/mentors' }),
    [learningItem]
  );

  useEffect(() => {
    const nextNotice = location.state?.sessionMessage || location.state?.message;

    if (!nextNotice) {
      return;
    }

    setPageNotice(nextNotice);
    navigate(location.pathname, {
      replace: true,
      state: {
        ...location.state,
        sessionMessage: null,
        message: null,
      },
    });
  }, [location.pathname, location.state, navigate]);

  function handleEnter() {
    if (!learningItem) {
      return;
    }

    if (learningItem.type === 'course_application') {
      navigate(`/mentoring/session/${learningItem.id}?type=course_application`, {
        state: { returnToItemId: itemId },
      });
      return;
    }

    navigate(`/mentoring/session/${learningItem.id}`, {
      state: { returnToItemId: itemId },
    });
  }

  function handleOpenFeedback() {
    if (!feedbackPrompt) {
      return;
    }

    navigate('/hub', {
      state: {
        sessionMessage: '피드백 입력 화면으로 이동했습니다.',
        feedbackPrompt,
      },
    });
  }

  return (
    <AppLayout
      eyebrow="내 학습 상세"
      title={learningItem?.courseTitle || learningItem?.mentorLabel || '멘토링 상세'}
      description="상태, 일정, 입장 가능 여부와 다음 행동을 이 화면에서 확인합니다."
      panelClassName="app-panel--wide"
    >
      <section className="workspace-page">
        {pageNotice ? <p className="app-success">{pageNotice}</p> : null}
        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

        {isLoading ? (
          <section className="workspace-card">
            <p>학습 상세를 불러오는 중입니다.</p>
          </section>
        ) : !learningItem ? (
          <section className="workspace-card workspace-empty">
            <strong>항목을 찾을 수 없습니다.</strong>
            <p>목록으로 돌아가 다른 예약이나 멘토링을 확인해 주세요.</p>
          </section>
        ) : (
          <>
            <section className={`workspace-status-banner workspace-status-banner--${statusBannerTone}`}>
              <div>
                <span className="workspace-status-banner__eyebrow">현재 상태</span>
                <strong>
                  {entrySummary.canEnter
                    ? '지금 바로 입장할 수 있습니다'
                    : formatLearningStatusLabel(learningItem)}
                </strong>
                <p>{getNextActionCopy(learningItem, entrySummary, Boolean(feedbackPrompt))}</p>
              </div>
              <div className="workspace-status-banner__actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleEnter}
                  disabled={!entrySummary.canEnter}
                >
                  메타버스 입장
                </button>
                {feedbackPrompt ? (
                  <button type="button" className="secondary-button" onClick={handleOpenFeedback}>
                    피드백 작성하기
                  </button>
                ) : null}
              </div>
            </section>

            <section className="workspace-detail-overview">
              <article className="workspace-detail-stat">
                <span>상태</span>
                <strong>{formatShortStatus(learningItem)}</strong>
                <small>{formatLearningStatusLabel(learningItem)}</small>
              </article>
              <article className="workspace-detail-stat">
                <span>{getPrimaryDateLabel(learningItem)}</span>
                <strong>
                  {formatDateTime(
                    learningItem.reservedAt || learningItem.assignedScheduleStartsAt || learningItem.createdAt
                  )}
                </strong>
                <small>{learningItem.assignedScheduleTitle || '세부 일정은 이 화면에서 계속 확인할 수 있습니다.'}</small>
              </article>
              <article className="workspace-detail-stat">
                <span>입장 상태</span>
                <strong>{entrySummary.canEnter ? '입장 가능' : '준비 중'}</strong>
                <small>{entrySummary.label}</small>
              </article>
            </section>

            <div className="workspace-page__detail-grid">
              <section className="workspace-card">
                <h2>일정 정보</h2>
                <div className="workspace-detail-list">
                  <div className="workspace-detail-row">
                    <span>멘토</span>
                    <strong>{learningItem.mentorLabel}</strong>
                  </div>
                  {learningItem.courseTitle ? (
                    <div className="workspace-detail-row">
                      <span>멘토링</span>
                      <strong>{learningItem.courseTitle}</strong>
                    </div>
                  ) : null}
                  <div className="workspace-detail-row">
                    <span>상태</span>
                    <strong>{formatLearningStatusLabel(learningItem)}</strong>
                  </div>
                  <div className="workspace-detail-row">
                    <span>{getPrimaryDateLabel(learningItem)}</span>
                    <strong>
                      {formatDateTime(
                        learningItem.reservedAt || learningItem.assignedScheduleStartsAt || learningItem.createdAt
                      )}
                    </strong>
                  </div>
                  {learningItem.assignedScheduleTitle ? (
                    <div className="workspace-detail-row">
                      <span>확정 회차</span>
                      <strong>{learningItem.assignedScheduleTitle}</strong>
                    </div>
                  ) : null}
                  {learningItem.sessionEntryOpenAt ? (
                    <div className="workspace-detail-row">
                      <span>입장 시작</span>
                      <strong>{formatDateTime(learningItem.sessionEntryOpenAt)}</strong>
                    </div>
                  ) : null}
                  {learningItem.sessionEntryCloseAt ? (
                    <div className="workspace-detail-row">
                      <span>입장 마감</span>
                      <strong>{formatDateTime(learningItem.sessionEntryCloseAt)}</strong>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="workspace-card">
                <h2>바로 할 일</h2>
                <div className="workspace-inline-notice">
                  <strong>
                    {feedbackPrompt
                      ? '후기를 남길 차례입니다.'
                      : entrySummary.canEnter
                        ? '지금 입장할 수 있습니다.'
                        : '다음 단계만 확인하면 됩니다.'}
                  </strong>
                  <p>{getNextActionCopy(learningItem, entrySummary, Boolean(feedbackPrompt))}</p>
                </div>

                <div className="workspace-action-stack">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleEnter}
                    disabled={!entrySummary.canEnter}
                  >
                    메타버스 입장
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate('/messages', { state: { selectedThreadId: itemId } })}
                  >
                    메시지 보기
                  </button>
                  {feedbackPrompt ? (
                    <button type="button" className="secondary-button" onClick={handleOpenFeedback}>
                      후기 작성하기
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate(retryAction.path)}
                  >
                    {retryAction.label}
                  </button>
                </div>
              </section>
            </div>

            <div className="workspace-page__detail-grid">
              <section className="workspace-card">
                <h2>남긴 메모</h2>
                <p>{learningItem.message || '저장된 메모가 없습니다.'}</p>
                {learningItem.reviewNote ? (
                  <div className="workspace-inline-notice">
                    <strong>멘토 메모</strong>
                    <p>{learningItem.reviewNote}</p>
                  </div>
                ) : null}
              </section>

              <section className="workspace-card">
                <h2>이후 흐름</h2>
                <div className="workspace-detail-list">
                  <div className="workspace-detail-row">
                    <span>1</span>
                    <strong>
                      {entrySummary.canEnter
                        ? '지금 입장해서 멘토링을 진행합니다.'
                        : '메시지와 알림에서 상태 변화를 확인합니다.'}
                    </strong>
                  </div>
                  <div className="workspace-detail-row">
                    <span>2</span>
                    <strong>
                      {feedbackPrompt
                        ? '후기를 남기면 진행 기록에 저장됩니다.'
                        : '종료 후 후기를 남기면 진행 기록이 쌓입니다.'}
                    </strong>
                  </div>
                  <div className="workspace-detail-row">
                    <span>3</span>
                    <strong>필요하면 같은 멘토나 다른 멘토링으로 다시 이어갈 수 있습니다.</strong>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </AppLayout>
  );
}
