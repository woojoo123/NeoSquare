import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AvatarPreview from '../components/AvatarPreview';
import { getMe } from '../api/auth';
import { getSpaces } from '../api/spaces';
import { AVATAR_PRESETS, getAvatarPreset } from '../lib/avatarPresets';
import {
  getSelectedAvatarPresetId,
  setSelectedAvatarPresetId,
} from '../lib/avatarSelectionStorage';
import { getLobbyZoneDefinition } from '../lib/lobbyZones';
import { useAuthStore } from '../store/authStore';

const SPACE_DISPLAY_ORDER = ['MAIN', 'STUDY', 'MENTORING'];

export default function LobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [spaces, setSpaces] = useState([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PRESETS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [isEntering, setIsEntering] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [entryNotice, setEntryNotice] = useState(location.state?.message || '');

  useEffect(() => {
    let isMounted = true;

    async function loadLobbyData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [meResponse, spacesResponse] = await Promise.all([getMe(), getSpaces()]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpaces(Array.isArray(spacesResponse) ? spacesResponse : []);
        setSelectedAvatarId(getSelectedAvatarPresetId(meResponse?.id));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error?.response?.status === 401) {
          clearAuth();
          navigate('/login', { replace: true });
          return;
        }

        setErrorMessage(
          error?.response?.data?.message || error.message || '입장 준비 화면을 불러오지 못했습니다.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLobbyData();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, navigate, setCurrentUser]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    setSelectedAvatarId(getSelectedAvatarPresetId(currentUser.id));
  }, [currentUser?.id]);

  const spacesByType = useMemo(
    () =>
      spaces.reduce((result, space) => {
        if (space?.type) {
          result[space.type] = space;
        }

        return result;
      }, {}),
    [spaces]
  );
  const selectedPreset = getAvatarPreset(selectedAvatarId);
  const mainSpace = spacesByType.MAIN || null;
  const hasHubRedirectState =
    Boolean(location.state?.sessionMessage) || Boolean(location.state?.feedbackPrompt);

  const handleAvatarSelect = (presetId) => {
    const nextPresetId = currentUser?.id
      ? setSelectedAvatarPresetId(currentUser.id, presetId)
      : getAvatarPreset(presetId).id;

    setSelectedAvatarId(nextPresetId);
    setEntryNotice(`${getAvatarPreset(nextPresetId).name} 캐릭터로 입장 준비를 마쳤습니다.`);
  };

  const handleEnterMetaverse = () => {
    if (!mainSpace?.id) {
      setErrorMessage('메인 광장 공간 정보를 찾지 못했습니다.');
      return;
    }

    if (currentUser?.id) {
      setSelectedAvatarPresetId(currentUser.id, selectedAvatarId);
    }

    setIsEntering(true);
    navigate(`/spaces/${mainSpace.id}`, {
      state: {
        space: mainSpace,
      },
    });
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <main className="entry-lobby-page">
      <section className="entry-lobby-shell">
        <div className="entry-lobby-hero">
          <article className="entry-lobby-intro">
            <span className="entry-lobby-intro__eyebrow">Entry Lobby</span>
            <h1>NeoSquare에 어떤 모습으로 들어갈지 먼저 정합니다</h1>
            <p>
              로비는 월드에 들어가기 전 아바타를 고르고 흐름을 확인하는 준비 화면입니다.
              실제 이동과 상호작용은 메인 광장에서 시작됩니다.
            </p>

            <div className="entry-lobby-status">
              <div className="entry-lobby-status__pill">
                <strong>{currentUser?.nickname || '사용자'}</strong>
                <span>{currentUser?.email || '계정 정보를 확인하는 중입니다.'}</span>
              </div>
              <div className="entry-lobby-status__pill">
                <strong>{spaces.length}개 공간</strong>
                <span>메인 광장, 스터디 라운지, 멘토링 존 준비 완료</span>
              </div>
            </div>

            <div className="entry-lobby-copy-block">
              <strong>이후 흐름</strong>
              <p>
                1. 캐릭터를 고릅니다. 2. 메타버스에 입장합니다. 3. 메인 광장에서 다른
                사람을 만나고 스터디 또는 멘토링 공간으로 이동합니다.
              </p>
            </div>

            {hasHubRedirectState ? (
              <div className="entry-lobby-callout">
                <div>
                  <strong>세션 후속 작업이 남아 있습니다</strong>
                  <span>피드백이나 세션 기록 확인은 허브에서 바로 이어서 처리할 수 있습니다.</span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => navigate('/hub', { state: location.state })}
                >
                  허브 열기
                </button>
              </div>
            ) : null}
          </article>

          <section className="entry-lobby-stage">
            <div className="entry-lobby-stage__header">
              <div>
                <span className="entry-lobby-stage__eyebrow">Avatar Select</span>
                <h2>{selectedPreset.name}</h2>
                <p>{selectedPreset.summary}</p>
              </div>
              <AvatarPreview presetId={selectedAvatarId} size="hero" highlighted />
            </div>

            <div className="entry-lobby-avatar-grid">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedAvatarId;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`entry-lobby-avatar-card ${
                      isSelected ? 'entry-lobby-avatar-card--selected' : ''
                    }`}
                    onClick={() => handleAvatarSelect(preset.id)}
                  >
                    <AvatarPreview presetId={preset.id} size="card" highlighted={isSelected} />
                    <strong>{preset.name}</strong>
                    <span>{preset.summary}</span>
                  </button>
                );
              })}
            </div>

            <div className="entry-lobby-actions">
              <button
                type="button"
                className="primary-button entry-lobby-actions__enter"
                disabled={isLoading || isEntering || !mainSpace}
                onClick={handleEnterMetaverse}
              >
                {isEntering ? '메인 광장으로 이동 중...' : '메타버스 입장하기'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate('/hub')}
              >
                활동 허브 보기
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          </section>
        </div>

        {entryNotice ? <p className="app-success">{entryNotice}</p> : null}
        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
        {isLoading ? <p className="app-note">입장 준비 정보를 불러오는 중입니다...</p> : null}

        <section className="entry-lobby-space-grid">
          {SPACE_DISPLAY_ORDER.map((spaceType) => {
            const space = spacesByType[spaceType];
            const zone = getLobbyZoneDefinition(spaceType);

            return (
              <article key={spaceType} className="entry-lobby-space-card">
                <span className="entry-lobby-space-card__eyebrow">{zone.label}</span>
                <strong>{space?.name || zone.label}</strong>
                <p>{zone.description}</p>
                <span>
                  {space ? `최대 ${space.maxCapacity}명` : '공간 정보 대기 중'} · {zone.helperText}
                </span>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
