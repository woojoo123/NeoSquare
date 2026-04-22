import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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

function getTimestampValue(value) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDateTime(value) {
  if (!value) {
    return '시간 정보 없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatThreadStatus(status) {
  if (status === 'PENDING') {
    return '대기 중';
  }

  if (status === 'ACCEPTED' || status === 'APPROVED') {
    return '진행 가능';
  }

  if (status === 'REJECTED') {
    return '반려됨';
  }

  if (status === 'CANCELED') {
    return '취소됨';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '상태 확인 필요';
}

function getThreadActionCopy(thread) {
  if (!thread) {
    return '왼쪽 목록에서 대화를 선택하면 관련 일정과 다음 행동을 볼 수 있습니다.';
  }

  if (thread.canEnter) {
    return '지금 바로 메타버스에 입장할 수 있습니다.';
  }

  if (thread.status === 'PENDING') {
    return '아직 답변을 기다리는 중입니다.';
  }

  if (thread.status === 'ACCEPTED' || thread.status === 'APPROVED') {
    return '승인된 상태입니다. 관련 일정에서 시간과 입장 가능 여부를 확인하세요.';
  }

  if (thread.status === 'REJECTED') {
    return '반려된 항목입니다.';
  }

  if (thread.status === 'CANCELED') {
    return '취소된 항목입니다.';
  }

  return '관련 일정 화면에서 현재 상태를 확인할 수 있습니다.';
}

function normalizeThreads(rawRequests, rawReservations, rawApplications) {
  const nowTimestamp = Date.now();
  const requestThreads = unwrapItems(rawRequests, ['requests']).map((request, index) => {
    const status = request.status || 'PENDING';

    return {
      id: `request-${request.id ?? index}`,
      itemId: `request-${request.id ?? index}`,
      title:
        request.mentorNickname ||
        request.mentorName ||
        request.receiverNickname ||
        request.targetNickname ||
        '멘토',
      message: request.message || request.content || '',
      type: '멘토링 요청',
      status,
      statusLabel: formatThreadStatus(status),
      createdAt: request.createdAt || request.timestamp || null,
      contextLine: status === 'ACCEPTED' ? '일정 조율 또는 입장 준비가 필요한 요청입니다.' : '멘토 응답을 기다리는 요청입니다.',
      canEnter: status === 'ACCEPTED',
      enterPath: status === 'ACCEPTED' ? `/mentoring/session/${request.id}` : null,
    };
  });

  const reservationThreads = unwrapItems(rawReservations, ['reservations']).map((reservation, index) => {
    const normalizedReservation = {
      status: reservation.status || 'PENDING',
      reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
      sessionEntryOpenAt: reservation.sessionEntryOpenAt || null,
      sessionEntryCloseAt: reservation.sessionEntryCloseAt || null,
    };
    const entryState = getReservationEntryState(normalizedReservation, nowTimestamp);
    const canEnter = normalizedReservation.status === 'ACCEPTED' && entryState.canEnter;

    return {
      id: `reservation-${reservation.id ?? index}`,
      itemId: `reservation-${reservation.id ?? index}`,
      title:
        reservation.mentorLabel ||
        reservation.mentorNickname ||
        reservation.mentorName ||
        reservation.receiverNickname ||
        reservation.targetNickname ||
        '멘토',
      message: reservation.message || reservation.content || '',
      type: '예약',
      status: normalizedReservation.status,
      statusLabel: formatThreadStatus(normalizedReservation.status),
      createdAt: normalizedReservation.reservedAt || reservation.createdAt || reservation.timestamp || null,
      contextLine: normalizedReservation.reservedAt
        ? `예약 시간 ${formatDateTime(normalizedReservation.reservedAt)}`
        : '예약 시간이 아직 확정되지 않았습니다.',
      canEnter,
      enterPath: canEnter ? `/mentoring/session/${reservation.id}` : null,
    };
  });

  const applicationThreads = unwrapItems(rawApplications, ['applications']).map((application, index) => {
    const normalizedApplication = {
      status: application.status || 'PENDING',
      assignedScheduleItemId: application.assignedScheduleItemId ?? null,
      sessionEntryOpenAt: application.sessionEntryOpenAt || null,
      sessionEntryCloseAt: application.sessionEntryCloseAt || null,
    };
    const entryState = getCourseSessionEntryState(normalizedApplication, nowTimestamp);
    const canEnter =
      normalizedApplication.status === 'APPROVED' &&
      normalizedApplication.assignedScheduleItemId &&
      entryState.canEnter;

    return {
      id: `course_application-${application.id ?? index}`,
      itemId: `course_application-${application.id ?? index}`,
      title: application.mentorNickname || '멘토',
      subtitle: application.courseTitle || '멘토링',
      message: application.message || '',
      type: '멘토링 신청',
      status: normalizedApplication.status,
      statusLabel: formatThreadStatus(normalizedApplication.status),
      createdAt: application.assignedScheduleStartsAt || application.createdAt || null,
      contextLine: application.assignedScheduleTitle
        ? `확정 회차 · ${application.assignedScheduleTitle}`
        : '회차 배정을 기다리는 중입니다.',
      canEnter,
      enterPath: canEnter ? `/mentoring/session/${application.id}?type=course_application` : null,
    };
  });

  return [...requestThreads, ...reservationThreads, ...applicationThreads].sort(
    (leftThread, rightThread) => getTimestampValue(rightThread.createdAt) - getTimestampValue(leftThread.createdAt)
  );
}

export default function MessagesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadThreads() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [requestsResponse, reservationsResponse, applicationsResponse] = await Promise.all([
          getSentMentoringRequests(),
          getMyReservations(),
          getMyMentorCourseApplications(),
        ]);

        if (!isMounted) {
          return;
        }

        const nextThreads = normalizeThreads(
          requestsResponse,
          reservationsResponse,
          applicationsResponse
        );

        setThreads(nextThreads);
        setSelectedThreadId(location.state?.selectedThreadId ?? nextThreads[0]?.id ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error?.response?.data?.message || error.message || '메시지 목록을 불러오지 못했습니다.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadThreads();

    return () => {
      isMounted = false;
    };
  }, [location.state?.selectedThreadId]);

  const selectedThread =
    useMemo(
      () => threads.find((thread) => thread.id === selectedThreadId) || threads[0] || null,
      [selectedThreadId, threads]
    );

  return (
    <AppLayout
      eyebrow="메시지"
      title="연결된 멘토와의 대화를 확인하세요"
      description="대화는 여기서 보고, 일정과 입장은 연결된 학습 화면에서 이어집니다."
      panelClassName="app-panel--wide"
    >
      <section className="workspace-page">
        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

        <div className="workspace-page__messages">
          <aside className="workspace-card workspace-card--sidebar">
            <h2>대화 목록</h2>
            {isLoading ? (
              <p>메시지를 불러오는 중입니다.</p>
            ) : threads.length ? (
              <div className="workspace-list">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    className={
                      selectedThread?.id === thread.id
                        ? 'workspace-list-item workspace-list-item--active'
                        : 'workspace-list-item'
                    }
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <strong>{thread.title}</strong>
                    <p>{thread.subtitle || thread.type}</p>
                    <small>{thread.contextLine}</small>
                    <div className="workspace-list-item__meta">
                      <span>{thread.statusLabel}</span>
                      <small>{formatDateTime(thread.createdAt)}</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-empty">
                <strong>아직 메시지가 없습니다.</strong>
                <p>연결된 멘토와 대화가 여기에 표시됩니다.</p>
              </div>
            )}
          </aside>

          <section className="workspace-card">
            <h2>{selectedThread?.title || '대화 선택'}</h2>
            {selectedThread ? (
              <>
                <div className="workspace-message">
                  <span>{selectedThread.type}</span>
                  {selectedThread.subtitle ? <strong>{selectedThread.subtitle}</strong> : null}
                  <p>{selectedThread.message || '남긴 메시지가 없습니다.'}</p>
                  <p>{selectedThread.contextLine}</p>
                  <small>현재 상태: {selectedThread.statusLabel}</small>
                  <small>{formatDateTime(selectedThread.createdAt)}</small>
                </div>
                <p className="workspace-helper-copy">{getThreadActionCopy(selectedThread)}</p>
                <div className="workspace-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate(`/my-learning/${selectedThread.itemId}`)}
                  >
                    관련 일정 보기
                  </button>
                  {selectedThread.canEnter && selectedThread.enterPath ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => navigate(selectedThread.enterPath, { state: { returnToItemId: selectedThread.itemId } })}
                    >
                      지금 입장하기
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="workspace-empty">
                <strong>대화를 선택해 주세요.</strong>
                <p>왼쪽 목록에서 요청이나 예약 대화를 고르면 상세 내용을 확인할 수 있습니다.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </AppLayout>
  );
}
