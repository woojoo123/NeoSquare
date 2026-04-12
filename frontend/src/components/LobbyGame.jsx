import { useEffect, useRef } from 'react';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

export default function LobbyGame({
  playerLabel,
  avatarPresetId,
  onPlayerMove,
  onZoneChange,
  onPlayerContextChange,
  onSpaceEnter,
  onRemotePlayerSelect,
  remoteEvent,
  selectedRemoteUserId,
  zoneMoveRequest,
  availableSpaceTypes,
}) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const onZoneChangeRef = useRef(onZoneChange);
  const onPlayerContextChangeRef = useRef(onPlayerContextChange);
  const onSpaceEnterRef = useRef(onSpaceEnter);
  const onRemotePlayerSelectRef = useRef(onRemotePlayerSelect);
  const pendingRemoteEventsRef = useRef([]);
  const pendingZoneMoveRef = useRef(null);
  const availableSpaceTypesKey = Array.isArray(availableSpaceTypes)
    ? availableSpaceTypes.join('|')
    : '';

  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);

  useEffect(() => {
    onZoneChangeRef.current = onZoneChange;
  }, [onZoneChange]);

  useEffect(() => {
    onPlayerContextChangeRef.current = onPlayerContextChange;
  }, [onPlayerContextChange]);

  useEffect(() => {
    onSpaceEnterRef.current = onSpaceEnter;
  }, [onSpaceEnter]);

  useEffect(() => {
    onRemotePlayerSelectRef.current = onRemotePlayerSelect;
  }, [onRemotePlayerSelect]);

  useEffect(() => {
    if (!remoteEvent) {
      return;
    }

    if (!sceneRef.current) {
      pendingRemoteEventsRef.current.push(remoteEvent);
      return;
    }

    sceneRef.current.applyRemoteEvent(remoteEvent);
  }, [remoteEvent]);

  useEffect(() => {
    if (!zoneMoveRequest?.zoneId) {
      return;
    }

    if (!sceneRef.current) {
      pendingZoneMoveRef.current = zoneMoveRequest;
      return;
    }

    sceneRef.current.movePlayerToZone(zoneMoveRequest.zoneId);
  }, [zoneMoveRequest]);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    sceneRef.current.selectRemotePlayer(selectedRemoteUserId ?? null);
  }, [selectedRemoteUserId]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    let isDisposed = false;
    let nextGame = null;

    async function createGame() {
      const [{ default: Phaser }, { default: LobbyScene }] = await Promise.all([
        import('phaser'),
        import('../game/LobbyScene'),
      ]);

      if (isDisposed || !containerRef.current) {
        return;
      }

      const lobbyScene = new LobbyScene({
        playerLabel,
        avatarPresetId,
        onPlayerMove: (position) => {
          onPlayerMoveRef.current?.(position);
        },
        onZoneChange: (zoneId) => {
          onZoneChangeRef.current?.(zoneId);
        },
        onPlayerContextChange: (context) => {
          onPlayerContextChangeRef.current?.(context);
        },
        onSpaceEnter: (zoneId) => {
          onSpaceEnterRef.current?.(zoneId);
        },
        onRemotePlayerSelect: (userId) => {
          onRemotePlayerSelectRef.current?.(userId);
        },
        availableSpaceTypes,
        onSceneReady: (scene) => {
          sceneRef.current = scene;

          pendingRemoteEventsRef.current.forEach((queuedEvent) => {
            scene.applyRemoteEvent(queuedEvent);
          });
          pendingRemoteEventsRef.current = [];

          if (pendingZoneMoveRef.current?.zoneId) {
            scene.movePlayerToZone(pendingZoneMoveRef.current.zoneId);
            pendingZoneMoveRef.current = null;
          }

          scene.selectRemotePlayer(selectedRemoteUserId ?? null);
        },
      });

      nextGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        scene: [lobbyScene],
        backgroundColor: '#0f172a',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
        },
        render: {
          antialias: false,
          pixelArt: true,
        },
      });

      gameRef.current = nextGame;
    }

    createGame();

    return () => {
      isDisposed = true;
      sceneRef.current = null;
      pendingRemoteEventsRef.current = [];
      pendingZoneMoveRef.current = null;
      if (gameRef.current) {
        gameRef.current.destroy(true);
      } else {
        nextGame?.destroy(true);
      }
      gameRef.current = null;
    };
  }, [availableSpaceTypesKey, avatarPresetId, playerLabel]);

  return (
    <div className="lobby-game-shell">
      <div ref={containerRef} className="lobby-game-container" />
    </div>
  );
}
