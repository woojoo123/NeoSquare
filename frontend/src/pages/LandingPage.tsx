import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getSpaces } from '../api/spaces';
import { useAuthStore } from '../store/authStore';
import {
  getPrimarySpace,
  getPrimarySpaceFallbackPath,
  getPrimarySpacePathFromSpaces,
} from '../lib/primarySpaceNavigation';

type SpaceSummary = {
  id: number;
  name: string;
  type: string;
  description: string;
  maxCapacity: number;
  isPublic: boolean;
};

const SPACE_ORDER = ['MAIN', 'STUDY', 'MENTORING'];

const SPACE_COPY: Record<
  string,
  {
    eyebrow: string;
    title: string;
    summary: string;
    accentClassName: string;
  }
> = {
  MAIN: {
    eyebrow: 'Main Plaza',
    title: '메인광장',
    summary: '처음 들어와 가장 먼저 사람을 만나고, 다음 활동을 고르는 중심 공간입니다.',
    accentClassName: 'landing-space-card--main',
  },
  STUDY: {
    eyebrow: 'Study Lounge',
    title: '스터디 라운지',
    summary: '학습 주제를 공유하고 스터디 세션에 합류하는 협업형 공간입니다.',
    accentClassName: 'landing-space-card--study',
  },
  MENTORING: {
    eyebrow: 'Mentoring Zone',
    title: '멘토링 존',
    summary: '실시간 대화와 예약 기반 멘토링 흐름이 연결되는 1:1 상호작용 공간입니다.',
    accentClassName: 'landing-space-card--mentoring',
  },
};

function getOrderedSpaces(spaces: SpaceSummary[]) {
  function getOrder(spaceType: string) {
    const order = SPACE_ORDER.indexOf(spaceType);
    return order === -1 ? SPACE_ORDER.length : order;
  }

  return [...spaces].sort((left, right) => getOrder(left.type) - getOrder(right.type));
}

export default function LandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.currentUser);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [spaceLoadError, setSpaceLoadError] = useState('');

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
          error instanceof Error ? error.message : '공간 정보를 준비하는 중 문제가 발생했습니다.'
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

  const orderedSpaces = useMemo(() => getOrderedSpaces(spaces), [spaces]);
  const primarySpace = useMemo(() => getPrimarySpace(orderedSpaces), [orderedSpaces]);
  const primarySpacePath = useMemo(
    () => getPrimarySpacePathFromSpaces(orderedSpaces),
    [orderedSpaces]
  );
  const publicSpaceCount = useMemo(
    () => orderedSpaces.filter((space) => space.isPublic).length,
    [orderedSpaces]
  );
  const totalCapacity = useMemo(
    () => orderedSpaces.reduce((sum, space) => sum + (Number.isFinite(space.maxCapacity) ? space.maxCapacity : 0), 0),
    [orderedSpaces]
  );
  const studySpace = useMemo(
    () => orderedSpaces.find((space) => space.type === 'STUDY') || null,
    [orderedSpaces]
  );
  const mentoringSpace = useMemo(
    () => orderedSpaces.find((space) => space.type === 'MENTORING') || null,
    [orderedSpaces]
  );
  const primaryCtaLabel = accessToken ? '메인광장으로 입장하기' : '로그인하고 바로 입장하기';
  const secondaryCtaLabel = accessToken ? '활동 허브 열기' : '회원가입';

  function handlePrimaryAction() {
    if (accessToken) {
      navigate(primarySpacePath);
      return;
    }

    navigate('/login', {
      state: {
        from: primarySpacePath,
        message: '로그인하면 메인광장으로 바로 입장할 수 있습니다.',
      },
    });
  }

  function handleSecondaryAction() {
    if (accessToken) {
      navigate('/hub');
      return;
    }

    navigate('/signup');
  }

  return (
    <main className="landing-page">
      <section className="landing-shell">
        <header className="landing-header">
          <Link className="landing-brand" to="/">
            <span className="landing-brand__mark" aria-hidden="true">
              NS
            </span>
            <span className="landing-brand__text">
              <strong>NeoSquare</strong>
              <small>Social learning metaverse</small>
            </span>
          </Link>

          <nav className="landing-nav" aria-label="랜딩 페이지 탐색">
            <a href="#landing-spaces">공간 소개</a>
            <a href="#landing-flow">참여 흐름</a>
            <a href="#landing-faq">이용 안내</a>
          </nav>

          <div className="landing-header__actions">
            {accessToken ? (
              <span className="landing-header__status">
                {currentUser?.nickname || '사용자'} 계정으로 이용 중
              </span>
            ) : null}
            <Link className="landing-link-button" to={accessToken ? '/hub' : '/login'}>
              {accessToken ? '허브' : '로그인'}
            </Link>
            {!accessToken ? (
              <Link className="landing-pill-button" to="/signup">
                회원가입
              </Link>
            ) : null}
          </div>
        </header>

        <section className="landing-hero">
          <article className="landing-story-card">
            <span className="landing-section-eyebrow">Launch Into Conversation</span>
            <h1>NeoSquare는 설명보다 입장이 먼저인 학습형 메타버스입니다.</h1>
            <p>
              가입 후 곧바로 메인광장으로 들어가 사람을 만나고, 스터디 라운지와 멘토링
              존으로 이어지는 흐름을 자연스럽게 시작할 수 있습니다.
            </p>

            <div className="landing-story-card__metrics">
              <div>
                <strong>{orderedSpaces.length || 3}개 코어 공간</strong>
                <span>광장, 스터디, 멘토링 흐름을 한 경로로 연결</span>
              </div>
              <div>
                <strong>{primarySpace?.name || '메인광장 준비 중'}</strong>
                <span>첫 입장 시 가장 먼저 도착하는 중심 허브</span>
              </div>
            </div>

            <div className="landing-cta-row">
              <button type="button" className="landing-primary-button" onClick={handlePrimaryAction}>
                {primaryCtaLabel}
              </button>
              <button type="button" className="landing-secondary-button" onClick={handleSecondaryAction}>
                {secondaryCtaLabel}
              </button>
            </div>

            <p className="landing-inline-note">
              {accessToken
                ? '현재 로그인된 상태라 메인광장이나 허브로 바로 이동할 수 있습니다.'
                : '회원가입 후 로그인하면 메인광장으로 바로 입장하도록 연결됩니다.'}
            </p>
          </article>

          <div className="landing-preview-stack">
            <section className="landing-preview-card" aria-label="메인광장 미리보기">
              <div className="landing-preview-card__frame">
                <div className="landing-preview-card__topbar">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="landing-preview-card__viewport">
                  <div className="landing-preview-card__map">
                    <div className="landing-preview-card__label">MAIN PLAZA</div>
                    <div className="landing-preview-card__path landing-preview-card__path--one" />
                    <div className="landing-preview-card__path landing-preview-card__path--two" />
                    <div className="landing-preview-card__zone landing-preview-card__zone--main">광장</div>
                    <div className="landing-preview-card__zone landing-preview-card__zone--study">스터디</div>
                    <div className="landing-preview-card__zone landing-preview-card__zone--mentoring">
                      멘토링
                    </div>
                    <div className="landing-preview-card__avatar landing-preview-card__avatar--one" />
                    <div className="landing-preview-card__avatar landing-preview-card__avatar--two" />
                    <div className="landing-preview-card__avatar landing-preview-card__avatar--three" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="landing-preview-card__cta"
                onClick={handlePrimaryAction}
              >
                {accessToken ? '바로 메인광장 열기' : '로그인 후 메인광장으로 입장'}
              </button>
            </section>

            <aside className="landing-note-card">
              <span className="landing-note-card__badge">NOTE</span>
              <strong>현재 설계 방향</strong>
              <p>
                공개 랜딩에서 서비스 가치를 설명하고, 로그인 후에는 별도 로비를 거치지
                않고 메인광장으로 바로 들어가도록 진입 흐름을 단순화합니다.
              </p>
              <ul>
                <li>실시간 광장에서 바로 상호작용 시작</li>
                <li>스터디 라운지와 멘토링 존으로 자연스럽게 이동</li>
                <li>허브는 활동 관리 화면으로 분리 유지</li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="landing-section landing-section--grid" id="landing-flow">
          <div className="landing-section__heading">
            <span className="landing-section-eyebrow">How It Works</span>
            <h2>진입 흐름은 짧고, 실제 경험은 바로 시작됩니다.</h2>
            <p>가입과 로그인 뒤에는 설명 화면이 아니라 공간 경험으로 곧장 연결됩니다.</p>
          </div>

          <div className="landing-flow-grid">
            <article className="landing-flow-card">
              <span>01</span>
              <strong>가입 또는 로그인</strong>
              <p>이메일 인증 흐름을 마치면 메인광장 진입 준비가 완료됩니다.</p>
            </article>
            <article className="landing-flow-card">
              <span>02</span>
              <strong>메인광장 입장</strong>
              <p>처음 만나는 사람들과 대화하고 다음 활동으로 이동할 수 있습니다.</p>
            </article>
            <article className="landing-flow-card">
              <span>03</span>
              <strong>스터디/멘토링 참여</strong>
              <p>공간 이동, 세션 참여, 허브 기반 후속 활동 관리까지 하나로 이어집니다.</p>
            </article>
          </div>
        </section>

        <section className="landing-section landing-section--capabilities">
          <div className="landing-section__heading">
            <span className="landing-section-eyebrow">What You Can Do</span>
            <h2>랜딩에서 끝나지 않고, 로그인 직후 실제 행동으로 이어지는 기능만 앞에 둡니다.</h2>
            <p>
              현재 NeoSquare에서 바로 체감할 수 있는 핵심 액션은 메인광장 진입, 실시간 대화,
              스터디 참여, 멘토링 요청, 허브 기반 후속 관리입니다.
            </p>
          </div>

          <div className="landing-capability-grid">
            <article className="landing-capability-card">
              <span>01</span>
              <strong>메인광장 진입</strong>
              <p>
                로그인 직후 {primarySpace?.name || '메인광장'}으로 바로 들어가 중간 화면 없이
                활동을 시작합니다.
              </p>
            </article>
            <article className="landing-capability-card">
              <span>02</span>
              <strong>실시간 대화와 참가자 선택</strong>
              <p>
                공간 안에서 사용자를 직접 선택하고, 채팅이나 상호작용으로 자연스럽게 연결됩니다.
              </p>
            </article>
            <article className="landing-capability-card">
              <span>03</span>
              <strong>스터디 생성과 합류</strong>
              <p>
                {studySpace?.name || '스터디 라운지'}에서 세션을 만들거나, 현재 열린 세션에 바로
                참여할 수 있습니다.
              </p>
            </article>
            <article className="landing-capability-card">
              <span>04</span>
              <strong>멘토링 요청과 예약</strong>
              <p>
                {mentoringSpace?.name || '멘토링 존'}에서 빠른 요청과 예약 제안으로 1:1 흐름을
                바로 시작할 수 있습니다.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="landing-spaces">
          <div className="landing-section__heading">
            <span className="landing-section-eyebrow">Core Spaces</span>
            <h2>NeoSquare는 세 공간을 하나의 사용자 여정으로 묶습니다.</h2>
            <p>각 공간은 분리된 메뉴가 아니라, 메인광장을 중심으로 이어지는 기능 단계입니다.</p>
          </div>

          <div className="landing-space-grid">
            {orderedSpaces.length > 0
              ? orderedSpaces.map((space) => {
                  const copy = SPACE_COPY[space.type] || SPACE_COPY.MAIN;

                  return (
                    <article
                      key={space.id}
                      className={`landing-space-card ${copy.accentClassName}`}
                    >
                      <span className="landing-space-card__eyebrow">{copy.eyebrow}</span>
                      <strong>{space.name || copy.title}</strong>
                      <p>{space.description || copy.summary}</p>
                      <div className="landing-space-card__meta">
                        <span>최대 {space.maxCapacity}명</span>
                        <span>{space.isPublic ? '공개 공간' : '제한 공간'}</span>
                      </div>
                    </article>
                  );
                })
              : SPACE_ORDER.map((spaceType) => {
                  const copy = SPACE_COPY[spaceType];

                  return (
                    <article
                      key={spaceType}
                      className={`landing-space-card ${copy.accentClassName}`}
                    >
                      <span className="landing-space-card__eyebrow">{copy.eyebrow}</span>
                      <strong>{copy.title}</strong>
                      <p>{copy.summary}</p>
                      <div className="landing-space-card__meta">
                        <span>공간 정보 로딩 중</span>
                        <span>공개 흐름 설계</span>
                      </div>
                    </article>
                  );
                })}
          </div>

          {isLoadingSpaces ? <p className="landing-data-status">공간 정보를 불러오는 중입니다...</p> : null}
          {spaceLoadError ? <p className="landing-data-status landing-data-status--error">{spaceLoadError}</p> : null}
        </section>

        <section className="landing-section landing-section--signals">
          <div className="landing-section__heading">
            <span className="landing-section-eyebrow">Service Snapshot</span>
            <h2>현재 서비스 상태를 한눈에 보여주고, 과장 대신 실제 구조를 드러냅니다.</h2>
            <p>
              공개 랜딩에서도 현재 열려 있는 공간 수와 기본 수용 규모, 진입 구조를 그대로
              보여주는 편이 신뢰에 더 도움이 됩니다.
            </p>
          </div>

          <div className="landing-signal-panel">
            <div className="landing-signal-list">
              <article className="landing-signal-card">
                <strong>{orderedSpaces.length || 3}개</strong>
                <span>현재 연결된 코어 공간 수</span>
              </article>
              <article className="landing-signal-card">
                <strong>{publicSpaceCount || orderedSpaces.length || 3}개</strong>
                <span>즉시 접근 가능한 공개 공간</span>
              </article>
              <article className="landing-signal-card">
                <strong>{totalCapacity || 0}명</strong>
                <span>공간 설정 기준 총 수용 인원</span>
              </article>
            </div>

            <div className="landing-signal-story">
              <strong>진입 원칙</strong>
              <p>
                랜딩은 소개, 메인광장은 경험, 허브는 관리라는 역할 분리를 유지합니다. 그래서
                로그인 이후에는 {primarySpace?.name || '메인광장'}으로 바로 연결되고, 공간
                정보가 준비되지 않은 경우에만 {getPrimarySpaceFallbackPath()}로 폴백됩니다.
              </p>
              <div className="landing-signal-story__tags">
                <span>설명보다 입장</span>
                <span>공간 기반 이동</span>
                <span>허브 기반 후속 관리</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--faq" id="landing-faq">
          <div className="landing-section__heading">
            <span className="landing-section-eyebrow">Usage Notes</span>
            <h2>랜딩은 소개만, 실제 행동은 앱 안에서 시작되게 설계합니다.</h2>
          </div>

          <div className="landing-faq-grid">
            <article>
              <strong>왜 별도 로비를 줄이려 하나요?</strong>
              <p>
                로그인 후 다시 한 번 중간 화면을 거치면 진입 마찰이 생깁니다. 메인광장으로
                바로 들어가는 편이 제품 경험이 더 선명합니다.
              </p>
            </article>
            <article>
              <strong>아바타 선택은 어디서 하나요?</strong>
              <p>
                다음 단계에서 메인광장 첫 진입 모달 또는 패널로 이동시키는 방향이 가장
                자연스럽습니다.
              </p>
            </article>
            <article>
              <strong>허브는 어떤 역할을 맡나요?</strong>
              <p>
                예약, 피드백, 세션 기록 같은 관리성 작업은 허브에서 유지하고, 실시간 경험은
                공간 안에서 시작하도록 분리합니다.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-bottom-cta">
          <div>
            <span className="landing-section-eyebrow">Ready To Enter</span>
            <h2>설명은 여기까지, 이제 메인광장에서 시작하면 됩니다.</h2>
            <p>
              기본 진입 경로는 {primarySpace?.name || '메인광장'}입니다. 공간 정보가 없으면{' '}
              {getPrimarySpaceFallbackPath()} 경로로 안전하게 폴백됩니다.
            </p>
          </div>
          <button type="button" className="landing-primary-button" onClick={handlePrimaryAction}>
            {primaryCtaLabel}
          </button>
        </section>
      </section>
    </main>
  );
}
