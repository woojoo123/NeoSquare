import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getSpaces } from '../api/spaces';
import { getPrimarySpace, getPrimarySpacePathFromSpaces } from '../lib/primarySpaceNavigation';
import { useAuthStore } from '../store/authStore';

type SpaceSummary = {
  id: number;
  name: string;
  type: string;
  description: string;
  maxCapacity: number;
  isPublic: boolean;
};

type FeatureCard = {
  title: string;
  description: string;
  accentClassName: string;
  iconClassName: string;
};

type SupportCard = {
  eyebrow: string;
  title: string;
  items: string[];
};

const SPACE_ORDER = ['MAIN', 'STUDY', 'MENTORING'];

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
  const studySpace = useMemo(
    () => orderedSpaces.find((space) => space.type === 'STUDY') || null,
    [orderedSpaces]
  );
  const mentoringSpace = useMemo(
    () => orderedSpaces.find((space) => space.type === 'MENTORING') || null,
    [orderedSpaces]
  );
  const publicSpaceCount = useMemo(
    () => orderedSpaces.filter((space) => space.isPublic).length,
    [orderedSpaces]
  );
  const primarySpacePath = useMemo(
    () => getPrimarySpacePathFromSpaces(orderedSpaces),
    [orderedSpaces]
  );

  const primarySpaceName = primarySpace?.name || '메인광장';
  const studySpaceName = studySpace?.name || '스터디 라운지';
  const mentoringSpaceName = mentoringSpace?.name || '멘토링 존';
  const userLabel = currentUser?.nickname || '사용자';
  const publicSpaceLabel = isLoadingSpaces
    ? '공간 준비 중'
    : `${publicSpaceCount || 1}개의 공개 공간 흐름`;

  const featureCards = useMemo<FeatureCard[]>(
    () => [
      {
        title: '메타버스 공간에서 만나는 커뮤니티',
        description:
          '같은 공간 안에서 사람을 보고, 움직이고, 서로 마주치며 더 자연스럽게 소통할 수 있습니다.',
        accentClassName: 'landing-feature-card--community',
        iconClassName: 'landing-feature-icon--community',
      },
      {
        title: '실시간 대화로 참여하는 커뮤니티',
        description:
          '공개 채팅과 실시간 상호작용을 통해 지금 이 순간 함께 있는 느낌의 대화가 이어집니다.',
        accentClassName: 'landing-feature-card--chat',
        iconClassName: 'landing-feature-icon--chat',
      },
      {
        title: '대화에서 스터디와 멘토링까지',
        description: `${studySpaceName}에서 함께 배우고, ${mentoringSpaceName}에서 더 깊은 연결로 자연스럽게 확장할 수 있습니다.`,
        accentClassName: 'landing-feature-card--growth',
        iconClassName: 'landing-feature-icon--growth',
      },
    ],
    [studySpaceName, mentoringSpaceName]
  );

  const supportCards = useMemo<SupportCard[]>(
    () => [
      {
        eyebrow: '입장 후 이렇게 시작해요',
        title: 'NeoSquare에서 할 수 있는 것',
        items: [
          `${primarySpaceName} 둘러보기`,
          '사람들과 실시간 채팅 참여',
          `${studySpaceName}에서 함께 공부하기`,
          `${mentoringSpaceName}로 연결 이어가기`,
        ],
      },
      {
        eyebrow: '이런 사람에게 추천합니다',
        title: '가볍게 시작해도 자연스럽게 연결됩니다',
        items: [
          '새로운 사람과 부담 없이 대화하고 싶은 사람',
          '관심사 기반 스터디를 찾고 싶은 사람',
          '커뮤니티와 멘토링을 함께 경험하고 싶은 사람',
          '메타버스 공간에서 더 입체적으로 소통하고 싶은 사람',
        ],
      },
    ],
    [primarySpaceName, studySpaceName, mentoringSpaceName]
  );

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

  return (
    <main className="landing-page">
      <section className="landing-shell">
        <header className="landing-topbar">
          <Link className="landing-topbar__brand" to="/">
            <span className="landing-topbar__mark" aria-hidden="true">
              NS
            </span>
            <span className="landing-topbar__name">NeoSquare</span>
          </Link>

          <div className="landing-topbar__actions">
            {accessToken ? (
              <span className="landing-topbar__status">{userLabel}님 이용 중</span>
            ) : null}
            <Link className="landing-topbar__link" to={accessToken ? '/hub' : '/login'}>
              {accessToken ? '허브' : '로그인'}
            </Link>
            {!accessToken ? (
              <Link className="landing-topbar__button" to="/signup">
                회원가입
              </Link>
            ) : null}
          </div>
        </header>

        <section className="landing-hero" id="landing-home">
          <article className="landing-copy-card">
            <h1>NeoSquare</h1>
            <p>
              NeoSquare는 메타버스 공간 안에서 사람들이 자유롭게 만나고, 대화하고,
              스터디하고, 필요하면 멘토링까지 할 수 있는 가상 커뮤니티 공간입니다.
            </p>
            <p>
              단순한 채팅 서비스가 아니라, 같은 공간 안에서 다른 사람을 만나고 실시간으로
              소통하며 자연스럽게 관계를 만들 수 있습니다.
            </p>
            <p>
              관심사가 맞는 사람과 대화를 시작할 수도 있고, 스터디나 멘토링처럼 목적 있는
              만남으로 이어갈 수도 있습니다.
            </p>
            <p>지금 NeoSquare에 입장해서 새로운 연결을 시작해보세요.</p>
          </article>

          <div className="landing-preview-column">
            <section className="landing-preview-card" aria-label="NeoSquare 서비스 미리보기">
              <div className="landing-preview-card__toolbar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <div className="landing-preview-stage">
                <div className="landing-preview-map">
                  <div className="landing-preview-map__grid" />
                  <div className="landing-preview-map__track landing-preview-map__track--horizontal" />
                  <div className="landing-preview-map__track landing-preview-map__track--vertical" />
                  <div className="landing-preview-map__zone landing-preview-map__zone--main">
                    {primarySpaceName}
                  </div>
                  <div className="landing-preview-map__zone landing-preview-map__zone--study">
                    {studySpaceName}
                  </div>
                  <div className="landing-preview-map__zone landing-preview-map__zone--mentoring">
                    {mentoringSpaceName}
                  </div>
                  <span className="landing-preview-map__avatar landing-preview-map__avatar--one" />
                  <span className="landing-preview-map__avatar landing-preview-map__avatar--two" />
                  <span className="landing-preview-map__avatar landing-preview-map__avatar--three" />
                  <span className="landing-preview-map__avatar landing-preview-map__avatar--four" />
                </div>

                <aside className="landing-preview-sidebar">
                  <div className="landing-preview-sidebar__panel">
                    <span className="landing-preview-sidebar__label">현재 공간</span>
                    <strong>{primarySpaceName}</strong>
                    <small>{publicSpaceLabel}</small>
                  </div>

                  <div className="landing-preview-sidebar__panel">
                    <span className="landing-preview-sidebar__label">함께 있는 사람들</span>
                    <div className="landing-preview-people">
                      <div className="landing-preview-person">
                        <span className="landing-preview-person__avatar landing-preview-person__avatar--blue">
                          수
                        </span>
                        <div>
                          <strong>수연</strong>
                          <span>광장에서 대화 중</span>
                        </div>
                      </div>
                      <div className="landing-preview-person">
                        <span className="landing-preview-person__avatar landing-preview-person__avatar--orange">
                          현
                        </span>
                        <div>
                          <strong>현우</strong>
                          <span>{studySpaceName} 참여 준비</span>
                        </div>
                      </div>
                      <div className="landing-preview-person">
                        <span className="landing-preview-person__avatar landing-preview-person__avatar--green">
                          지
                        </span>
                        <div>
                          <strong>지민</strong>
                          <span>{mentoringSpaceName} 연결 가능</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="landing-preview-chat">
                  <div className="landing-preview-chat__header">
                    <strong>실시간 대화</strong>
                    <span>지금 함께 있는 커뮤니티</span>
                  </div>
                  <ul className="landing-preview-chat__messages">
                    <li>
                      <strong>민지</strong>
                      <span>방금 입장했어요. 같이 둘러보실 분 있나요?</span>
                    </li>
                    <li>
                      <strong>준호</strong>
                      <span>{studySpaceName}에서 같이 공부할 분을 찾고 있어요.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <button type="button" className="landing-primary-button" onClick={handlePrimaryAction}>
              메타버스 입장하기
            </button>

            <p className="landing-cta-note">
              {spaceLoadError
                ? spaceLoadError
                : accessToken
                  ? `${userLabel}님은 버튼을 누르면 ${primarySpaceName}으로 바로 이동합니다.`
                  : '로그인 후 메인광장으로 바로 입장할 수 있습니다.'}
            </p>
          </div>
        </section>

        <section className="landing-feature-section" id="landing-benefits">
          <h2>왜 NeoSquare를 사용해야 할까요?</h2>

          <div className="landing-feature-grid">
            {featureCards.map((feature) => (
              <article
                key={feature.title}
                className={`landing-feature-card ${feature.accentClassName}`}
              >
                <div className={`landing-feature-icon ${feature.iconClassName}`} aria-hidden="true">
                  <span />
                </div>
                <strong>{feature.title}</strong>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-support-section" aria-label="NeoSquare 추가 안내">
          <div className="landing-support-grid">
            {supportCards.map((card) => (
              <article key={card.title} className="landing-support-card">
                <span className="landing-support-card__eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <ul className="landing-support-card__list">
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
