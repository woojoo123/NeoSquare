import { useEffect, useRef } from 'react';

const GAME_WIDTH = 1100;
const GAME_HEIGHT = 720;

export default function SpaceGame({
  currentUserId,
  playerLabel,
  spaceType,
  avatarPresetId,
  connectedSpaces,
  spawnFromSpaceType,
  onPlayerMove,
  onSpaceEnter,
  onParticipantSelect,
  remoteEvent,
  chatMessageEvent,
}) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const onPlayerMoveRef = useRef(onPlayerMove);
  const onSpaceEnterRef = useRef(onSpaceEnter);
  const onParticipantSelectRef = useRef(onParticipantSelect);
  const pendingRemoteEventsRef = useRef([]);
  const pendingChatEventsRef = useRef([]);
  const connectedSpacesKey = Array.isArray(connectedSpaces)
    ? connectedSpaces.map((space) => `${space.id}:${space.type}`).join('|')
    : '';

  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove;
  }, [onPlayerMove]);

  useEffect(() => {
    onSpaceEnterRef.current = onSpaceEnter;
  }, [onSpaceEnter]);

  useEffect(() => {
    onParticipantSelectRef.current = onParticipantSelect;
  }, [onParticipantSelect]);

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
    if (!chatMessageEvent) {
      return;
    }

    if (!sceneRef.current) {
      pendingChatEventsRef.current.push(chatMessageEvent);
      return;
    }

    sceneRef.current.applyChatMessage(chatMessageEvent);
  }, [chatMessageEvent]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    let isDisposed = false;
    let nextGame = null;

    async function createGame() {
      const [{ default: Phaser }, { default: SpaceScene }] = await Promise.all([
        import('phaser'),
        import('../game/SpaceScene'),
      ]);

      if (isDisposed || !containerRef.current) {
        return;
      }

      const spaceScene = new SpaceScene({
        currentUserId,
        playerLabel,
        spaceType,
        avatarPresetId,
        connectedSpaces,
        spawnFromSpaceType,
        onPlayerMove: (position) => {
          onPlayerMoveRef.current?.(position);
        },
        onSpaceEnter: (targetSpaceType) => {
          onSpaceEnterRef.current?.(targetSpaceType);
        },
        onParticipantSelect: (participant) => {
          onParticipantSelectRef.current?.(participant);
        },
        onSceneReady: (scene) => {
          sceneRef.current = scene;

          pendingRemoteEventsRef.current.forEach((queuedEvent) => {
            scene.applyRemoteEvent(queuedEvent);
          });
          pendingRemoteEventsRef.current = [];
          pendingChatEventsRef.current.forEach((queuedEvent) => {
            scene.applyChatMessage(queuedEvent);
          });
          pendingChatEventsRef.current = [];
        },
      });

      nextGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        scene: [spaceScene],
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
      pendingChatEventsRef.current = [];
      if (gameRef.current) {
        gameRef.current.destroy(true);
      } else {
        nextGame?.destroy(true);
      }
      gameRef.current = null;
    };
  }, [avatarPresetId, connectedSpacesKey, currentUserId, playerLabel, spaceType, spawnFromSpaceType]);

  return (
    <div className="space-game-shell">
      <div ref={containerRef} className="space-game-container" />
    </div>
  );
}
