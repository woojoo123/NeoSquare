import { useEffect, useRef } from 'react';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

export default function LobbyGame({
  playerLabel,
  onPlayerMove,
  onZoneChange,
  onPlayerContextChange,
  onRemotePlayerSelect,
  remoteEvent,
  selectedRemoteUserId,
  zoneMoveRequest,
}) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const onZoneChangeRef = useRef(onZoneChange);
  const onPlayerContextChangeRef = useRef(onPlayerContextChange);
  const onRemotePlayerSelectRef = useRef(onRemotePlayerSelect);
  const pendingRemoteEventsRef = useRef([]);
  const pendingZoneMoveRef = useRef(null);

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
        onPlayerMove: (position) => {
          onPlayerMoveRef.current?.(position);
        },
        onZoneChange: (zoneId) => {
          onZoneChangeRef.current?.(zoneId);
        },
        onPlayerContextChange: (context) => {
          onPlayerContextChangeRef.current?.(context);
        },
        onRemotePlayerSelect: (userId) => {
          onRemotePlayerSelectRef.current?.(userId);
        },
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
          antialias: true,
          pixelArt: false,
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
  }, [playerLabel, selectedRemoteUserId]);

  return (
    <div className="lobby-game-shell">
      <div ref={containerRef} className="lobby-game-container" />
    </div>
  );
}
