import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { logout } from '../api/auth';
import { getReceivedMentoringRequests } from '../api/mentoring';
import { getNotifications } from '../api/notifications';
import { getMyReservations } from '../api/reservations';
import { getSpaces } from '../api/spaces';
import AvatarPreview from '../components/AvatarPreview';
import {
  getSelectedAvatarPresetId,
  hasCompletedAvatarOnboarding,
} from '../lib/avatarSelectionStorage';
import { getPrimarySpace } from '../lib/primarySpaceNavigation';
import { useAuthStore } from '../store/authStore';

type SpaceSummary = {
  id: number;
  name: string;
  type: string;
  description: string;
  maxCapacity: number;
  isPublic: boolean;
};

type LobbyActivitySummary = {
  unreadNotificationCount: number;
  pendingRequestCount: number;
  scheduledReservationCount: number;
};

const SPACE_ORDER = ['MAIN', 'STUDY', 'MENTORING'];

function getOrderedSpaces(spaces: SpaceSummary[]) {
  function getOrder(spaceType: string) {
    const order = SPACE_ORDER.indexOf(spaceType);
    return order === -1 ? SPACE_ORDER.length : order;
  }

  return [...spaces].sort((left, right) => getOrder(left.type) - getOrder(right.type));
}

function getMentoringRequestItems(rawValue: unknown) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray((rawValue as { items?: unknown[] })?.items)) {
    return (rawValue as { items: unknown[] }).items;
  }

  if (Array.isArray((rawValue as { requests?: unknown[] })?.requests)) {
    return (rawValue as { requests: unknown[] }).requests;
  }

  return [];
}

function getReservationItems(rawValue: unknown) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray((rawValue as { items?: unknown[] })?.items)) {
    return (rawValue as { items: unknown[] }).items;
  }

  if (Array.isArray((rawValue as { reservations?: unknown[] })?.reservations)) {
    return (rawValue as { reservations: unknown[] }).reservations;
  }

  return [];
}

function getNotificationItems(rawValue: unknown) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray((rawValue as { items?: unknown[] })?.items)) {
    return (rawValue as { items: unknown[] }).items;
  }

  if (Array.isArray((rawValue as { notifications?: unknown[] })?.notifications)) {
    return (rawValue as { notifications: unknown[] }).notifications;
  }

  return [];
}

function buildLobbyActivitySummary({
  receivedRequests,
  myReservations,
  notifications,
}: {
  receivedRequests: unknown;
  myReservations: unknown;
  notifications: unknown;
}): LobbyActivitySummary {
  const pendingRequestCount = getMentoringRequestItems(receivedRequests).filter(
    (request) => (request as { status?: string })?.status === 'PENDING'
  ).length;

  const scheduledReservationCount = getReservationItems(myReservations).filter((reservation) =>
    ['PENDING', 'ACCEPTED'].includes((reservation as { status?: string })?.status || '')
  ).length;

  const unreadNotificationCount = getNotificationItems(notifications).filter(
    (notification) => !Boolean((notification as { isRead?: boolean; read?: boolean })?.isRead ?? (notification as { read?: boolean })?.read)
  ).length;

  return {
    unreadNotificationCount,
    pendingRequestCount,
    scheduledReservationCount,
  };
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [spaceLoadError, setSpaceLoadError] = useState('');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [activitySummary, setActivitySummary] = useState<LobbyActivitySummary>({
    unreadNotificationCount: 0,
    pendingRequestCount: 0,
    scheduledReservationCount: 0,
  });
  const [activityLoadError, setActivityLoadError] = useState('');

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    setSelectedAvatarId(getSelectedAvatarPresetId(currentUser.id));
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadSpaces() {
      setIsLoadingSpaces(true);
      setSpaceLoadError('');

      try {
        const response = await getSpaces();

        if (!isMounted) {
          return;
        }

        setSpaces(Array.isArray(response) ? response : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSpaceLoadError(
          error instanceof Error ? error.message : '공간 정보를 불러오는 중 문제가 발생했습니다.'
        );
      } finally {
        if (isMounted) {
          setIsLoadingSpaces(false);
        }
      }
    }

    loadSpaces();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadActivitySummary() {
      setActivityLoadError('');

      try {
        const [receivedRequestsResponse, myReservationsResponse, notificationsResponse] =
          await Promise.all([
            getReceivedMentoringRequests(),
            getMyReservations(),
            getNotifications(),
          ]);

        if (!isMounted) {
          return;
        }

        setActivitySummary(
          buildLobbyActivitySummary({
            receivedRequests: receivedRequestsResponse,
            myReservations: myReservationsResponse,
            notifications: notificationsResponse,
          })
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setActivityLoadError(
          error instanceof Error ? error.message : '활동 요약을 불러오는 중 문제가 발생했습니다.'
        );
      }
    }

    loadActivitySummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const orderedSpaces = useMemo(() => getOrderedSpaces(spaces), [spaces]);
  const primarySpace = useMemo(() => getPrimarySpace(orderedSpaces), [orderedSpaces]);
  const hasAvatarReady = Boolean(currentUser?.id && hasCompletedAvatarOnboarding(currentUser.id));
  const heroTitle = currentUser?.nickname
    ? `${currentUser.nickname}님, 오늘은 어떤 연결을 시작할까요?`
    : 'NeoSquare 로비';
  const primarySpaceName = primarySpace?.name || '메인 광장';

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      // 토큰 기반 세션이라 서버 요청이 실패해도 로컬 상태는 정리한다.
    } finally {
      clearAuth();
      navigate('/', { replace: true });
    }
  }

  function handleGoToEntry() {
    navigate('/enter');
  }

  return (
    <main className="lobby-page">
      <section className="lobby-shell">
        <header className="lobby-header">
          <div>
            <span className="lobby-header__eyebrow">NeoSquare 로비</span>
            <h1>{heroTitle}</h1>
            <p>
              캐릭터를 고른 뒤 {primarySpaceName}으로 들어가 보세요. 요청과 예약, 알림은
              내 활동에서 이어서 관리할 수 있습니다.
            </p>
          </div>

          <div className="lobby-header__actions">
            <Link className="lobby-header__link" to="/hub">
              내 활동
            </Link>
            <button
              type="button"
              className="lobby-header__button"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        </header>

        <section className="lobby-hero">
          <article className="lobby-hero-card lobby-hero-card--primary">
            <span className="lobby-hero-card__eyebrow">입장 준비</span>
            <h2>{hasAvatarReady ? '바로 메타버스에 들어갈 수 있습니다.' : '캐릭터를 고른 뒤 메타버스에 입장하세요.'}</h2>
            <p>
              NeoSquare는 {primarySpaceName}에서 시작합니다. 메타버스 안에서는 사람을
              만나 대화를 시작하고, 스터디와 멘토링 일정은 내 활동에서 이어서 확인할 수 있습니다.
            </p>
            {spaceLoadError ? <p className="app-note">{spaceLoadError}</p> : null}
            {isLoadingSpaces ? <p className="app-note">입장할 공간 정보를 준비하고 있습니다.</p> : null}

            <div className="lobby-hero-card__actions">
              <button type="button" className="lobby-primary-button" onClick={handleGoToEntry}>
                {hasAvatarReady ? '다시 캐릭터 고르고 입장하기' : '캐릭터 고르고 입장하기'}
              </button>
              <Link className="lobby-secondary-button" to="/hub">
                내 활동 보기
              </Link>
            </div>

            <ol className="lobby-flow-list" aria-label="입장 흐름">
              <li>캐릭터를 선택합니다.</li>
              <li>{primarySpaceName}에 입장해 사람들과 대화를 시작합니다.</li>
              <li>스터디와 멘토링 일정은 내 활동에서 이어서 확인합니다.</li>
            </ol>
          </article>

          <aside className="lobby-hero-card lobby-hero-card--side">
            <div className="lobby-avatar-card">
              <div className="lobby-avatar-card__preview">
                <AvatarPreview presetId={selectedAvatarId || undefined} size="hero" highlighted />
              </div>
              <div className="lobby-avatar-card__copy">
                <span className="lobby-avatar-card__eyebrow">현재 아바타</span>
                <strong>
                  {hasAvatarReady ? '바로 입장 가능한 상태입니다.' : '입장 전에 캐릭터를 골라 주세요.'}
                </strong>
                <p>
                  캐릭터 선택 화면에서 마음에 드는 아바타를 고른 뒤 바로 메인 광장으로
                  입장할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="lobby-summary-card">
              <span className="lobby-summary-card__eyebrow">내 활동 요약</span>
              <div className="lobby-metric-grid">
                <article className="lobby-metric-card">
                  <strong>{activitySummary.unreadNotificationCount}</strong>
                  <span>읽지 않은 알림</span>
                </article>
                <article className="lobby-metric-card">
                  <strong>{activitySummary.pendingRequestCount}</strong>
                  <span>대기 중 멘토링 요청</span>
                </article>
                <article className="lobby-metric-card">
                  <strong>{activitySummary.scheduledReservationCount}</strong>
                  <span>예정된 예약</span>
                </article>
              </div>
              <p className="lobby-summary-card__description">
                {activityLoadError
                  ? activityLoadError
                  : '세부 내역은 내 활동에서 바로 이어서 확인할 수 있습니다.'}
              </p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
