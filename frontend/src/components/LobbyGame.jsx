import { useEffect, useRef } from 'react';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

export default function LobbyGame({ playerLabel, onPlayerMove, remoteEvent }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const pendingRemoteEventsRef = useRef([]);

  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);

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
        onSceneReady: (scene) => {
          sceneRef.current = scene;

          pendingRemoteEventsRef.current.forEach((queuedEvent) => {
            scene.applyRemoteEvent(queuedEvent);
          });
          pendingRemoteEventsRef.current = [];
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
      if (gameRef.current) {
        gameRef.current.destroy(true);
      } else {
        nextGame?.destroy(true);
      }
      gameRef.current = null;
    };
  }, [playerLabel]);

  return (
    <div className="lobby-game-shell">
      <div ref={containerRef} className="lobby-game-container" />
    </div>
  );
}
