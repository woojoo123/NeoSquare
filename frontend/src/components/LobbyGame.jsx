import { useEffect, useRef } from 'react';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

export default function LobbyGame({ playerLabel }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

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

      nextGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        scene: [new LobbyScene({ playerLabel })],
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
