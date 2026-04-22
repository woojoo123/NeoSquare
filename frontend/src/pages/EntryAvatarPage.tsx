import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getSpaces } from '../api/spaces';
import AvatarPreview from '../components/AvatarPreview';
import { AVATAR_PRESETS } from '../lib/avatarPresets';
import {
  clearPendingAvatarPresetId,
  getSelectedAvatarPresetId,
  markAvatarOnboardingComplete,
  setSelectedAvatarPresetId,
} from '../lib/avatarSelectionStorage';
import { getPrimarySpacePathFromSpaces } from '../lib/primarySpaceNavigation';
import { useAuthStore } from '../store/authStore';

type SpaceSummary = {
  id: number;
  name: string;
  type: string;
  description: string;
  maxCapacity: number;
  isPublic: boolean;
};

const SPACE_ORDER = ['MAIN', 'STUDY', 'MENTORING'];

function getOrderedSpaces(spaces: SpaceSummary[]) {
  function getOrder(spaceType: string) {
    const order = SPACE_ORDER.indexOf(spaceType);
    return order === -1 ? SPACE_ORDER.length : order;
  }

  return [...spaces].sort((left, right) => getOrder(left.type) - getOrder(right.type));
}

function getWrappedAvatarIndex(currentIndex: number, offset: number) {
  const total = AVATAR_PRESETS.length;

  if (total === 0) {
    return 0;
  }

  return (currentIndex + offset + total) % total;
}

export default function EntryAvatarPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [spaceLoadError, setSpaceLoadError] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PRESETS[0].id);

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
          error instanceof Error ? error.message : '입장할 공간 정보를 불러오는 중 문제가 발생했습니다.'
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
    if (!currentUser?.id) {
      return;
    }

    setSelectedAvatarId(getSelectedAvatarPresetId(currentUser.id));
  }, [currentUser?.id]);

  const orderedSpaces = useMemo(() => getOrderedSpaces(spaces), [spaces]);
  const primarySpacePath = useMemo(
    () => getPrimarySpacePathFromSpaces(orderedSpaces),
    [orderedSpaces]
  );
  const selectedAvatarIndex = useMemo(() => {
    const resolvedIndex = AVATAR_PRESETS.findIndex((preset) => preset.id === selectedAvatarId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }, [selectedAvatarId]);
  const previousAvatarId = useMemo(
    () => AVATAR_PRESETS[getWrappedAvatarIndex(selectedAvatarIndex, -1)].id,
    [selectedAvatarIndex]
  );
  const nextAvatarId = useMemo(
    () => AVATAR_PRESETS[getWrappedAvatarIndex(selectedAvatarIndex, 1)].id,
    [selectedAvatarIndex]
  );

  function handleRotateAvatar(offset: number) {
    setSelectedAvatarId(AVATAR_PRESETS[getWrappedAvatarIndex(selectedAvatarIndex, offset)].id);
  }

  function handleEnter() {
    if (!currentUser?.id) {
      return;
    }

    setSelectedAvatarPresetId(currentUser.id, selectedAvatarId);
    markAvatarOnboardingComplete(currentUser.id);
    clearPendingAvatarPresetId();
    navigate(primarySpacePath);
  }

  return (
    <main className="entry-avatar-page">
      <section className="entry-avatar-shell">
        <header className="entry-avatar-header">
          <h1>NeoSquare 메타버스에 오신 걸 환영합니다</h1>
          <p>메타버스에 입장하기 전에 사용할 캐릭터를 선택해 주세요.</p>
        </header>

        <div className="entry-avatar-layout">
          <section className="entry-avatar-stage" aria-label="캐릭터 선택">
            <div className="entry-avatar-stage__carousel">
              <button
                type="button"
                className="entry-avatar-stage__arrow"
                onClick={() => handleRotateAvatar(-1)}
                aria-label="이전 캐릭터 보기"
              >
                ‹
              </button>

              <div className="entry-avatar-stage__figure">
                <div className="entry-avatar-stage__ghost entry-avatar-stage__ghost--left" aria-hidden="true">
                  <AvatarPreview presetId={previousAvatarId} size="medium" />
                </div>

                <div className="entry-avatar-stage__hero">
                  <AvatarPreview presetId={selectedAvatarId} size="stage" highlighted />
                </div>

                <div className="entry-avatar-stage__ghost entry-avatar-stage__ghost--right" aria-hidden="true">
                  <AvatarPreview presetId={nextAvatarId} size="medium" />
                </div>
              </div>

              <button
                type="button"
                className="entry-avatar-stage__arrow"
                onClick={() => handleRotateAvatar(1)}
                aria-label="다음 캐릭터 보기"
              >
                ›
              </button>
            </div>

            <button
              type="button"
              className="entry-avatar-stage__enter"
              onClick={handleEnter}
              disabled={!currentUser?.id || isLoadingSpaces || Boolean(spaceLoadError)}
            >
              메타버스 입장하기
            </button>

            <button type="button" className="entry-avatar-stage__back" onClick={() => navigate('/')}>
              홈으로 돌아가기
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
