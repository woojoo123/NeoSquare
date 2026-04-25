import Phaser from 'phaser';

import {
  AVATAR_SPRITE_FRAME_SIZE,
  AVATAR_SPRITE_SHEET_KEY,
  AVATAR_SPRITE_SHEET_URL,
  getAvatarDirectionFromDelta,
  getAvatarPalette,
  getAvatarSpriteFrame,
} from '../lib/avatarPresets';
import { getLobbyZoneDefinition } from '../lib/lobbyZones';
import { getSpaceWorldConfig } from '../lib/spaceWorlds';

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 840;
const PLAYER_SPEED = 250;
const WORLD_PADDING = 56;
const PORTAL_ENTRY_DISTANCE = 92;
const PARTICIPANT_INTERACTION_DISTANCE = 96;
const PORTAL_SPAWN_OFFSET_Y = 112;
const DEFAULT_CAMERA_ZOOM = 1;
const CAMERA_ZOOM_BY_SPACE_TYPE = {
  MAIN: 0.96,
};
const AVATAR_RENDER_SCALE = 0.88;
const AVATAR_HIT_AREA_WIDTH = 68;
const AVATAR_HIT_AREA_HEIGHT = 96;
const AVATAR_SHADOW_OFFSET_Y = 22 * AVATAR_RENDER_SCALE;
const AVATAR_SHADOW_WIDTH = 38 * AVATAR_RENDER_SCALE;
const AVATAR_SHADOW_HEIGHT = 16 * AVATAR_RENDER_SCALE;
const AVATAR_RING_Y = 16 * AVATAR_RENDER_SCALE;
const AVATAR_RING_WIDTH = 52 * AVATAR_RENDER_SCALE;
const AVATAR_RING_HEIGHT = 22 * AVATAR_RENDER_SCALE;
const AVATAR_NAME_OFFSET_Y = 40;
const AVATAR_BADGE_OFFSET_X = 21 * AVATAR_RENDER_SCALE;
const AVATAR_BADGE_OFFSET_Y = -16 * AVATAR_RENDER_SCALE;
const AVATAR_BADGE_RADIUS = 4 * AVATAR_RENDER_SCALE;
const AVATAR_WALK_FRAME_DURATION = 140;
const CHAT_BUBBLE_DURATION_MS = 3600;
const EMOJI_BUBBLE_DURATION_MS = 2200;
const CHAT_BUBBLE_TEXT_WRAP_WIDTH = 136;
const CHAT_BUBBLE_BASE_OFFSET_Y = -70 * AVATAR_RENDER_SCALE;
const CHAT_BUBBLE_TEXT_MAX_LENGTH = 40;
const CHAT_BUBBLE_MIN_WIDTH = 72;
const CHAT_BUBBLE_MIN_HEIGHT = 44;
const CHAT_BUBBLE_RADIUS = 14;
const CHAT_BUBBLE_TAIL_HEIGHT = 9;
const CHAT_BUBBLE_TAIL_HALF_WIDTH = 8;
const CHAT_BUBBLE_SHADOW_OFFSET_Y = 3;
const SCENE_DECOR_DEPTH = 8;
const AVATAR_DEPTH_BASE = 120;
const FOREGROUND_DEPTH = 980;
const PLAYER_COLLISION_RADIUS = 22;
const PERSONAL_SPAWN_OFFSETS = [
  { x: 0, y: 0 },
  { x: -48, y: 0 },
  { x: 48, y: 0 },
  { x: 0, y: -48 },
  { x: 0, y: 48 },
  { x: -36, y: -36 },
  { x: 36, y: -36 },
  { x: -36, y: 36 },
  { x: 36, y: 36 },
  { x: -72, y: 0 },
  { x: 72, y: 0 },
  { x: 0, y: -72 },
  { x: 0, y: 72 },
];

const SPACE_PORTAL_LAYOUTS = {
  MAIN: [],
  STUDY: [
    { targetType: 'MAIN', x: 256, y: 650 },
  ],
  MENTORING: [
    { targetType: 'MAIN', x: WORLD_WIDTH / 2, y: 650 },
  ],
};

const DEFAULT_SPAWN_POSITIONS = {
  MAIN: { x: WORLD_WIDTH / 2, y: 384 },
  STUDY: { x: WORLD_WIDTH / 2, y: 404 },
  MENTORING: { x: WORLD_WIDTH / 2, y: 404 },
};

function getSpaceTheme(spaceType) {
  if (spaceType === 'STUDY') {
    return {
      title: '스터디 라운지',
      subtitle: '같이 공부할 사람을 찾아 채팅과 상호작용을 시작해 보세요.',
      surfaceColor: 0x153327,
      accentColor: 0x22c55e,
      borderColor: 0xbbf7d0,
      furnitureColor: 0x14532d,
      highlightColor: 0xdcfce7,
    };
  }

  if (spaceType === 'MENTORING') {
    return {
      title: '멘토링 세션',
      subtitle: '허브에서 연결된 요청과 예약이 열리는 전용 세션 공간입니다.',
      surfaceColor: 0x31220d,
      accentColor: 0xf59e0b,
      borderColor: 0xfde68a,
      furnitureColor: 0x78350f,
      highlightColor: 0xfffbeb,
    };
  }

  return {
    title: '메인 광장',
    subtitle: '사람을 만나고 다음 행동을 선택하는 NeoSquare의 허브 공간입니다.',
    surfaceColor: 0x10203a,
    accentColor: 0x38bdf8,
    borderColor: 0xbae6fd,
    furnitureColor: 0x1e3a5f,
    highlightColor: 0xe0f2fe,
  };
}

function getCameraZoom(spaceType) {
  return CAMERA_ZOOM_BY_SPACE_TYPE[spaceType] || DEFAULT_CAMERA_ZOOM;
}

function getPortalDefinitions(spaceType, connectedSpaces) {
  const layouts = SPACE_PORTAL_LAYOUTS[spaceType] || [];

  return layouts
    .map((layout) => {
      const targetSpace = connectedSpaces.find(
        (connectedSpace) => connectedSpace?.type === layout.targetType
      );

      if (!targetSpace) {
        return null;
      }

      const targetZone = getLobbyZoneDefinition(layout.targetType);
      const targetTheme = getSpaceTheme(layout.targetType);

      return {
        ...layout,
        width: 188,
        height: 104,
        label: targetZone.label,
        accentColor: targetTheme.accentColor,
        borderColor: targetTheme.borderColor,
      };
    })
    .filter(Boolean);
}

function clampColorChannel(value) {
  return Phaser.Math.Clamp(Math.round(value), 0, 255);
}

function shadeColor(color, amount = 0) {
  const baseColor = Phaser.Display.Color.IntegerToColor(color);

  return Phaser.Display.Color.GetColor(
    clampColorChannel(baseColor.red + amount),
    clampColorChannel(baseColor.green + amount),
    clampColorChannel(baseColor.blue + amount)
  );
}

export default class SpaceScene extends Phaser.Scene {
  constructor({
    currentUserId = null,
    playerLabel = '나',
    spaceType = 'MAIN',
    avatarPresetId,
    connectedSpaces = [],
    spawnFromSpaceType = null,
    onPlayerMove,
    onSceneReady,
    onSpaceEnter,
    onParticipantSelect,
  } = {}) {
    super(`SpaceScene-${spaceType}`);
    this.currentUserId = currentUserId;
    this.playerLabel = playerLabel;
    this.spaceType = spaceType;
    this.avatarPresetId = avatarPresetId;
    this.connectedSpaces = connectedSpaces;
    this.spawnFromSpaceType = spawnFromSpaceType;
    this.onPlayerMove = onPlayerMove;
    this.onSceneReady = onSceneReady;
    this.onSpaceEnter = onSpaceEnter;
    this.onParticipantSelect = onParticipantSelect;
    this.player = null;
    this.playerAvatar = null;
    this.cursors = null;
    this.interactionKey = null;
    this.remotePlayers = new Map();
    this.pendingChatMessages = new Map();
    this.theme = getSpaceTheme(spaceType);
    this.worldConfig = getSpaceWorldConfig(spaceType);
    this.portals = [];
    this.activePortalTargetType = null;
    this.activeParticipantUserId = null;
    this.isEnteringPortal = false;
    this.blockingZones = [];
    this.ambientLights = [];
  }

  preload() {
    if (!this.textures.exists(AVATAR_SPRITE_SHEET_KEY)) {
      this.load.spritesheet(AVATAR_SPRITE_SHEET_KEY, AVATAR_SPRITE_SHEET_URL, {
        frameWidth: AVATAR_SPRITE_FRAME_SIZE,
        frameHeight: AVATAR_SPRITE_FRAME_SIZE,
      });
    }

    if (!this.textures.exists(this.worldConfig.assetKey)) {
      this.load.image(this.worldConfig.assetKey, this.worldConfig.backgroundUrl);
    }

    if (this.worldConfig.portalAssetKey && this.worldConfig.portalAssetUrl) {
      if (!this.textures.exists(this.worldConfig.portalAssetKey)) {
        this.load.image(this.worldConfig.portalAssetKey, this.worldConfig.portalAssetUrl);
      }
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(getCameraZoom(this.spaceType));

    this.renderSpaceWorld();
    this.portals = this.drawPortals();

    const spawnPosition = this.resolveSpawnPosition();
    this.playerAvatar = this.createAvatar(
      spawnPosition.x,
      spawnPosition.y,
      this.playerLabel,
      this.avatarPresetId,
      { focusAlpha: 0.48 }
    );
    this.player = this.playerAvatar.container;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
    this.interactionKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) || null;
    this.cameras.main.centerOn(spawnPosition.x, spawnPosition.y);
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);

    this.refreshInteractionState();
    this.onPlayerMove?.({ x: this.player.x, y: this.player.y });
    this.onSceneReady?.(this);
  }

  normalizeRemotePlayerKey(userId) {
    if (userId == null) {
      return null;
    }

    return String(userId);
  }

  getRemotePlayer(userId) {
    const remotePlayerKey = this.normalizeRemotePlayerKey(userId);

    if (!remotePlayerKey) {
      return null;
    }

    return this.remotePlayers.get(remotePlayerKey) || null;
  }

  setRemotePlayer(userId, remotePlayer) {
    const remotePlayerKey = this.normalizeRemotePlayerKey(userId);

    if (!remotePlayerKey) {
      return;
    }

    this.remotePlayers.set(remotePlayerKey, remotePlayer);
  }

  removeRemotePlayerEntry(userId) {
    const remotePlayerKey = this.normalizeRemotePlayerKey(userId);

    if (!remotePlayerKey) {
      return;
    }

    this.remotePlayers.delete(remotePlayerKey);
    this.pendingChatMessages.delete(remotePlayerKey);
  }

  queuePendingChatMessage(chatMessage) {
    const remotePlayerKey = this.normalizeRemotePlayerKey(chatMessage?.senderId);

    if (!remotePlayerKey) {
      return;
    }

    this.pendingChatMessages.set(remotePlayerKey, chatMessage);
  }

  flushPendingChatMessage(userId, remotePlayer) {
    const remotePlayerKey = this.normalizeRemotePlayerKey(userId);

    if (!remotePlayerKey || !remotePlayer) {
      return;
    }

    const pendingChatMessage = this.pendingChatMessages.get(remotePlayerKey);

    if (!pendingChatMessage) {
      return;
    }

    this.pendingChatMessages.delete(remotePlayerKey);
    this.showChatBubble(remotePlayer, pendingChatMessage);
  }

  update(_, delta) {
    if (!this.player || !this.cursors) {
      return;
    }

    const direction = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left?.isDown) {
      direction.x -= 1;
    }

    if (this.cursors.right?.isDown) {
      direction.x += 1;
    }

    if (this.cursors.up?.isDown) {
      direction.y -= 1;
    }

    if (this.cursors.down?.isDown) {
      direction.y += 1;
    }

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    const distance = (PLAYER_SPEED * delta) / 1000;
    const previousX = this.player.x;
    const previousY = this.player.y;

    const nextPosition = this.resolveMovement(
      this.player.x + direction.x * distance,
      this.player.y + direction.y * distance,
      this.player.x,
      this.player.y
    );

    this.player.x = nextPosition.x;
    this.player.y = nextPosition.y;

    this.updateAvatarMotion(
      this.playerAvatar,
      this.player.x - previousX,
      this.player.y - previousY,
      delta
    );

    if (previousX !== this.player.x || previousY !== this.player.y) {
      this.onPlayerMove?.({
        x: this.player.x,
        y: this.player.y,
      });
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.handlePortalEnter();
    }

    if (this.interactionKey && Phaser.Input.Keyboard.JustDown(this.interactionKey)) {
      this.handleParticipantInteract();
    }

    this.refreshInteractionState();

    this.refreshChatBubble(this.playerAvatar);
    this.remotePlayers.forEach((remotePlayer) => {
      this.refreshChatBubble(remotePlayer);
    });
  }

  applyRemoteEvent(event) {
    if (!event?.type || !event.userId) {
      return;
    }

    if (event.type === 'user_enter') {
      this.addRemotePlayer(event.userId, event.x, event.y, event.label, event.avatarPresetId);
      return;
    }

    if (event.type === 'user_move') {
      if (!this.getRemotePlayer(event.userId)) {
        this.addRemotePlayer(event.userId, event.x, event.y, event.label, event.avatarPresetId);
        return;
      }

      this.updateRemotePlayerLabel(this.getRemotePlayer(event.userId)?.nameLabel, event.label);
      this.updateRemotePlayerAvatar(event.userId, event.avatarPresetId);
      this.moveRemotePlayer(event.userId, event.x, event.y);
      return;
    }

    if (event.type === 'user_leave') {
      this.removeRemotePlayer(event.userId);
    }
  }

  applyChatMessage(chatMessage) {
    if (!chatMessage?.senderId || !chatMessage?.content) {
      return;
    }

    const targetAvatar =
      String(chatMessage.senderId) === String(this.currentUserId)
        ? this.playerAvatar
        : this.getRemotePlayer(chatMessage.senderId);

    if (!targetAvatar) {
      this.queuePendingChatMessage(chatMessage);
      return;
    }

    this.showChatBubble(targetAvatar, chatMessage);
  }

  handlePortalEnter() {
    if (!this.activePortalTargetType || this.isEnteringPortal) {
      return;
    }

    this.isEnteringPortal = true;
    this.onSpaceEnter?.(this.activePortalTargetType);
    this.time.delayedCall(450, () => {
      this.isEnteringPortal = false;
    });
  }

  handleParticipantInteract() {
    if (this.isTypingContextActive() || !this.activeParticipantUserId) {
      return;
    }

    const remotePlayer = this.getRemotePlayer(this.activeParticipantUserId);

    if (!remotePlayer) {
      return;
    }

    this.onParticipantSelect?.({
      userId: this.activeParticipantUserId,
      label: remotePlayer.nameLabel?.text || '참가자',
      x: remotePlayer.container.x,
      y: remotePlayer.container.y,
    });
  }

  resolveSpawnPosition() {
    if (this.spawnFromSpaceType) {
      const entryPortal = this.portals.find(
        (portal) => portal.targetType === this.spawnFromSpaceType
      );

      if (entryPortal) {
        return {
          x: entryPortal.x,
          y: Phaser.Math.Clamp(
            entryPortal.y - PORTAL_SPAWN_OFFSET_Y,
            WORLD_PADDING,
            WORLD_HEIGHT - WORLD_PADDING
          ),
        };
      }
    }

    const baseSpawn =
      this.worldConfig.spawn || DEFAULT_SPAWN_POSITIONS[this.spaceType] || DEFAULT_SPAWN_POSITIONS.MAIN;

    return this.resolvePersonalSpawnPosition(baseSpawn);
  }

  resolvePersonalSpawnPosition(baseSpawn) {
    if (!baseSpawn) {
      return DEFAULT_SPAWN_POSITIONS.MAIN;
    }

    const numericUserId = Number(this.currentUserId);

    if (!Number.isFinite(numericUserId)) {
      return baseSpawn;
    }

    const normalizedSeed = Math.abs(Math.trunc(numericUserId));
    const startOffsetIndex = normalizedSeed % PERSONAL_SPAWN_OFFSETS.length;

    for (let step = 0; step < PERSONAL_SPAWN_OFFSETS.length; step += 1) {
      const offset = PERSONAL_SPAWN_OFFSETS[(startOffsetIndex + step) % PERSONAL_SPAWN_OFFSETS.length];
      const candidateX = baseSpawn.x + offset.x;
      const candidateY = baseSpawn.y + offset.y;

      if (!this.isPositionBlocked(candidateX, candidateY)) {
        return {
          x: Phaser.Math.Clamp(candidateX, WORLD_PADDING, WORLD_WIDTH - WORLD_PADDING),
          y: Phaser.Math.Clamp(candidateY, WORLD_PADDING, WORLD_HEIGHT - WORLD_PADDING),
        };
      }
    }

    return baseSpawn;
  }

  addRemotePlayer(userId, x, y, label = '게스트', avatarPresetId = null) {
    const existingRemotePlayer = this.getRemotePlayer(userId);

    if (existingRemotePlayer) {
      this.updateRemotePlayerLabel(existingRemotePlayer.nameLabel, label);
      this.updateRemotePlayerAvatar(userId, avatarPresetId);
      this.moveRemotePlayer(userId, x, y);
      this.flushPendingChatMessage(userId, existingRemotePlayer);
      return;
    }

    const position = this.resolveRemotePosition(userId, x, y);
    const remotePlayer = this.createAvatar(position.x, position.y, label, avatarPresetId);
    remotePlayer.container.setData('remoteUserId', userId);
    remotePlayer.container.setInteractive(
      new Phaser.Geom.Rectangle(
        -AVATAR_HIT_AREA_WIDTH / 2,
        -AVATAR_HIT_AREA_HEIGHT / 2,
        AVATAR_HIT_AREA_WIDTH,
        AVATAR_HIT_AREA_HEIGHT
      ),
      Phaser.Geom.Rectangle.Contains
    );
    remotePlayer.container.input.cursor = 'pointer';
    remotePlayer.container.on('pointerover', () => {
      this.setAvatarHoverState(remotePlayer, true);
    });
    remotePlayer.container.on('pointerout', () => {
      this.setAvatarHoverState(remotePlayer, false);
    });
    remotePlayer.container.on('pointerdown', () => {
      const latestRemotePlayer = this.getRemotePlayer(userId);

      this.onParticipantSelect?.({
        userId,
        label: latestRemotePlayer?.nameLabel.text || label,
        x: latestRemotePlayer?.container.x ?? position.x,
        y: latestRemotePlayer?.container.y ?? position.y,
      });
    });

    this.setRemotePlayer(userId, remotePlayer);
    this.flushPendingChatMessage(userId, remotePlayer);
  }

  moveRemotePlayer(userId, x, y) {
    const remotePlayer = this.getRemotePlayer(userId);

    if (!remotePlayer) {
      this.addRemotePlayer(userId, x, y);
      return;
    }

    const position = this.resolveRemotePosition(
      userId,
      x,
      y,
      remotePlayer.container.x,
      remotePlayer.container.y
    );

    const previousX = remotePlayer.container.x;
    const previousY = remotePlayer.container.y;
    remotePlayer.container.setPosition(position.x, position.y);
    this.updateAvatarMotion(
      remotePlayer,
      position.x - previousX,
      position.y - previousY,
      AVATAR_WALK_FRAME_DURATION
    );
  }

  removeRemotePlayer(userId) {
    const remotePlayer = this.getRemotePlayer(userId);

    if (!remotePlayer) {
      return;
    }

    remotePlayer.container.destroy(true);
    this.removeRemotePlayerEntry(userId);
  }

  updateRemotePlayerLabel(nameLabel, label) {
    if (!nameLabel || !label) {
      return;
    }

    nameLabel.setText(label);
  }

  updateRemotePlayerAvatar(userId, avatarPresetId) {
    if (!avatarPresetId) {
      return;
    }

    const remotePlayer = this.getRemotePlayer(userId);

    if (!remotePlayer?.sprite) {
      return;
    }

    remotePlayer.avatarPresetId = avatarPresetId;
    this.applyAvatarAppearance(remotePlayer);
  }

  resolveRemotePosition(userId, x, y, fallbackX, fallbackY) {
    const fallbackPosition = this.getRemoteSpawnPosition(userId, fallbackX, fallbackY);
    const nextX = Number.isFinite(x) ? x : fallbackPosition.x;
    const nextY = Number.isFinite(y) ? y : fallbackPosition.y;
    const resolvedPosition = this.resolveMovement(
      nextX,
      nextY,
      Number.isFinite(fallbackX) ? fallbackX : fallbackPosition.x,
      Number.isFinite(fallbackY) ? fallbackY : fallbackPosition.y
    );

    return resolvedPosition;
  }

  getRemoteSpawnPosition(userId, fallbackX, fallbackY) {
    if (Number.isFinite(fallbackX) && Number.isFinite(fallbackY)) {
      return {
        x: fallbackX,
        y: fallbackY,
      };
    }

    const seed = Number(userId) || 1;

    return {
      x: 140 + ((seed * 127) % (WORLD_WIDTH - 280)),
      y: 140 + ((seed * 101) % (WORLD_HEIGHT - 280)),
    };
  }

  resolveMovement(nextX, nextY, previousX, previousY) {
    const clampedPosition = {
      x: Phaser.Math.Clamp(nextX, WORLD_PADDING, WORLD_WIDTH - WORLD_PADDING),
      y: Phaser.Math.Clamp(nextY, WORLD_PADDING, WORLD_HEIGHT - WORLD_PADDING),
    };

    if (!this.isPositionBlocked(clampedPosition.x, clampedPosition.y)) {
      return clampedPosition;
    }

    const xOnly = {
      x: Phaser.Math.Clamp(nextX, WORLD_PADDING, WORLD_WIDTH - WORLD_PADDING),
      y: Phaser.Math.Clamp(previousY, WORLD_PADDING, WORLD_HEIGHT - WORLD_PADDING),
    };

    if (!this.isPositionBlocked(xOnly.x, xOnly.y)) {
      return xOnly;
    }

    const yOnly = {
      x: Phaser.Math.Clamp(previousX, WORLD_PADDING, WORLD_WIDTH - WORLD_PADDING),
      y: Phaser.Math.Clamp(nextY, WORLD_PADDING, WORLD_HEIGHT - WORLD_PADDING),
    };

    if (!this.isPositionBlocked(yOnly.x, yOnly.y)) {
      return yOnly;
    }

    return {
      x: Phaser.Math.Clamp(previousX, WORLD_PADDING, WORLD_WIDTH - WORLD_PADDING),
      y: Phaser.Math.Clamp(previousY, WORLD_PADDING, WORLD_HEIGHT - WORLD_PADDING),
    };
  }

  isPositionBlocked(x, y) {
    const footprint = new Phaser.Geom.Rectangle(
      x - PLAYER_COLLISION_RADIUS,
      y - PLAYER_COLLISION_RADIUS * 0.68,
      PLAYER_COLLISION_RADIUS * 2,
      PLAYER_COLLISION_RADIUS * 1.36
    );

    return this.blockingZones.some((zone) => Phaser.Geom.Intersects.RectangleToRectangle(footprint, zone));
  }

  resolveActivePortal() {
    if (!this.player) {
      return null;
    }

    return (
      this.portals.find((portal) => {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y);
        return distance <= PORTAL_ENTRY_DISTANCE;
      }) || null
    );
  }

  resolveActiveParticipant() {
    if (!this.player) {
      return null;
    }

    let nearestParticipant = null;

    this.remotePlayers.forEach((remotePlayer, userId) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        remotePlayer.container.x,
        remotePlayer.container.y
      );

      if (distance > PARTICIPANT_INTERACTION_DISTANCE) {
        return;
      }

      if (!nearestParticipant || distance < nearestParticipant.distance) {
        nearestParticipant = {
          userId,
          label: remotePlayer.nameLabel?.text || '참가자',
          distance,
        };
      }
    });

    return nearestParticipant;
  }

  refreshInteractionState() {
    const activePortal = this.resolveActivePortal();
    const activeParticipant = this.resolveActiveParticipant();

    this.activePortalTargetType = activePortal?.targetType ?? null;
    this.activeParticipantUserId = activeParticipant?.userId ?? null;

    this.portals.forEach((portal) => {
      const isActive = activePortal?.targetType === portal.targetType;
      portal.glow.setAlpha(isActive ? 0.68 : 0.34);
      portal.frame.setStrokeStyle(isActive ? 5 : 4, isActive ? 0xfef3c7 : portal.accentColor, 0.95);
      portal.door.setFillStyle(0x020617, isActive ? 0.98 : 0.88);
      portal.labelText.setScale(isActive ? 1.04 : 1);
    });

    this.remotePlayers.forEach((remotePlayer, userId) => {
      this.setAvatarInteractableState(
        remotePlayer,
        String(userId) === String(this.activeParticipantUserId)
      );
    });
  }

  syncAvatarDepth(avatarState) {
    if (!avatarState?.container) {
      return;
    }

    avatarState.container.setDepth(AVATAR_DEPTH_BASE + Math.round(avatarState.container.y));
  }

  createAvatar(x, y, label, avatarPresetId, { focusAlpha = 0 } = {}) {
    const palette = getAvatarPalette(avatarPresetId);
    const avatar = this.add.container(x, y);
    const shadow = this.add.ellipse(
      0,
      AVATAR_SHADOW_OFFSET_Y,
      AVATAR_SHADOW_WIDTH,
      AVATAR_SHADOW_HEIGHT,
      0x020617,
      0.24
    );
    const focusRing = this.add.ellipse(0, AVATAR_RING_Y, AVATAR_RING_WIDTH, AVATAR_RING_HEIGHT);
    const sprite = this.add.sprite(
      0,
      0,
      AVATAR_SPRITE_SHEET_KEY,
      getAvatarSpriteFrame(avatarPresetId, 'down', 0).index
    );
    sprite.setScale(AVATAR_RENDER_SCALE);
    const nameLabel = this.add
      .text(0, AVATAR_NAME_OFFSET_Y, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const badge = this.add.circle(
      AVATAR_BADGE_OFFSET_X,
      AVATAR_BADGE_OFFSET_Y,
      AVATAR_BADGE_RADIUS,
      palette.accentColorValue,
      1
    );
    const chatBubbleContainer = this.add.container(0, CHAT_BUBBLE_BASE_OFFSET_Y).setVisible(false);
    const chatBubbleShadow = this.add.graphics();
    const chatBubbleBackground = this.add.graphics();
    const chatBubbleText = this.add
      .text(0, 0, '', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '12px',
        color: '#0f172a',
        align: 'center',
        wordWrap: { width: CHAT_BUBBLE_TEXT_WRAP_WIDTH },
      })
      .setOrigin(0.5);

    chatBubbleContainer.add([chatBubbleShadow, chatBubbleBackground, chatBubbleText]);

    avatar.add([shadow, focusRing, sprite, badge, chatBubbleContainer, nameLabel]);

    const avatarState = {
      container: avatar,
      shadow,
      focusRing,
      sprite,
      badge,
      nameLabel,
      chatBubbleContainer,
      chatBubbleShadow,
      chatBubbleBackground,
      chatBubbleText,
      chatBubbleExpiresAt: 0,
      avatarPresetId,
      direction: 'down',
      step: 0,
      animationElapsed: 0,
      isHovered: false,
      isInteractable: false,
    };

    focusRing.setAlpha(focusAlpha);
    this.applyAvatarAppearance(avatarState);
    this.syncAvatarDepth(avatarState);

    return avatarState;
  }

  applyAvatarAppearance(avatarState) {
    if (!avatarState?.sprite || !avatarState?.focusRing || !avatarState?.badge) {
      return;
    }

    const palette = getAvatarPalette(avatarState.avatarPresetId);
    const frame = getAvatarSpriteFrame(
      avatarState.avatarPresetId,
      avatarState.direction,
      avatarState.step
    );

    avatarState.sprite.setFrame(frame.index);
    avatarState.focusRing.setStrokeStyle(3, palette.accentColorValue, 0.95);
    avatarState.focusRing.setFillStyle(palette.accentColorValue, 0.16);
    avatarState.badge.setFillStyle(palette.accentColorValue, 1);
  }

  updateAvatarMotion(avatarState, deltaX, deltaY, delta = 0) {
    if (!avatarState?.sprite) {
      return;
    }

    const hasMoved = Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001;
    avatarState.direction = getAvatarDirectionFromDelta(deltaX, deltaY, avatarState.direction);

    if (hasMoved) {
      avatarState.animationElapsed += delta > 0 ? delta : AVATAR_WALK_FRAME_DURATION;
      avatarState.step =
        Math.floor(avatarState.animationElapsed / AVATAR_WALK_FRAME_DURATION) % 3;
    } else {
      avatarState.animationElapsed = 0;
      avatarState.step = 0;
    }

    this.applyAvatarAppearance(avatarState);
    this.syncAvatarDepth(avatarState);
  }

  setAvatarHoverState(avatarState, isHovered) {
    if (!avatarState?.focusRing || !avatarState?.nameLabel) {
      return;
    }

    avatarState.isHovered = isHovered;
    this.syncAvatarHighlightState(avatarState);
  }

  setAvatarInteractableState(avatarState, isInteractable) {
    if (!avatarState?.focusRing || !avatarState?.nameLabel) {
      return;
    }

    avatarState.isInteractable = isInteractable;
    this.syncAvatarHighlightState(avatarState);
  }

  syncAvatarHighlightState(avatarState) {
    if (!avatarState?.focusRing || !avatarState?.nameLabel) {
      return;
    }

    const focusAlpha = avatarState.isHovered ? 0.92 : avatarState.isInteractable ? 0.56 : 0;
    avatarState.focusRing.setAlpha(focusAlpha);
    avatarState.nameLabel.setColor(
      avatarState.isHovered || avatarState.isInteractable ? '#f8fafc' : '#e2e8f0'
    );
  }

  isTypingContextActive() {
    if (typeof document === 'undefined') {
      return false;
    }

    const activeElement = document.activeElement;

    if (!activeElement) {
      return false;
    }

    const tagName = activeElement.tagName?.toLowerCase();

    return (
      activeElement.isContentEditable ||
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select'
    );
  }

  showChatBubble(avatarState, chatMessage) {
    if (
      !avatarState?.chatBubbleContainer ||
      !avatarState.chatBubbleShadow ||
      !avatarState.chatBubbleBackground ||
      !avatarState.chatBubbleText
    ) {
      return;
    }

    const isEmoji = chatMessage.variant === 'EMOJI';
    const isWhisper = chatMessage.scope === 'WHISPER';
    const bubbleText = isEmoji
      ? chatMessage.content
      : chatMessage.content.length > CHAT_BUBBLE_TEXT_MAX_LENGTH
        ? `${chatMessage.content.slice(0, CHAT_BUBBLE_TEXT_MAX_LENGTH)}...`
        : chatMessage.content;

    avatarState.chatBubbleText.setText(bubbleText);
    avatarState.chatBubbleText.setStyle({
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: isEmoji ? '24px' : '12px',
      color: isWhisper ? '#f8fafc' : '#0f172a',
      align: 'center',
      wordWrap: { width: isEmoji ? 72 : CHAT_BUBBLE_TEXT_WRAP_WIDTH },
    });

    const textBounds = avatarState.chatBubbleText.getBounds();
    const paddingX = isEmoji ? 16 : 12;
    const paddingY = isEmoji ? 10 : 8;
    const bubbleWidth = Math.max(
      textBounds.width + paddingX * 2,
      isEmoji ? CHAT_BUBBLE_MIN_HEIGHT + 8 : CHAT_BUBBLE_MIN_WIDTH
    );
    const bubbleHeight = Math.max(textBounds.height + paddingY * 2, CHAT_BUBBLE_MIN_HEIGHT);
    const bubbleLeft = -bubbleWidth / 2;
    const bubbleTop = -bubbleHeight / 2;
    const bubbleBottom = bubbleHeight / 2;
    const bubbleShadow = avatarState.chatBubbleShadow;
    const bubbleBackground = avatarState.chatBubbleBackground;

    bubbleShadow.clear();
    bubbleShadow.fillStyle(0x0f172a, 0.16);
    bubbleShadow.fillRoundedRect(
      bubbleLeft,
      bubbleTop + CHAT_BUBBLE_SHADOW_OFFSET_Y,
      bubbleWidth,
      bubbleHeight,
      CHAT_BUBBLE_RADIUS
    );
    bubbleShadow.fillTriangle(
      0,
      bubbleBottom + CHAT_BUBBLE_TAIL_HEIGHT + CHAT_BUBBLE_SHADOW_OFFSET_Y,
      -CHAT_BUBBLE_TAIL_HALF_WIDTH,
      bubbleBottom - 1 + CHAT_BUBBLE_SHADOW_OFFSET_Y,
      CHAT_BUBBLE_TAIL_HALF_WIDTH,
      bubbleBottom - 1 + CHAT_BUBBLE_SHADOW_OFFSET_Y
    );

    bubbleBackground.clear();
    bubbleBackground.fillStyle(isWhisper ? 0x4338ca : 0xf8fafc, 0.96);
    bubbleBackground.lineStyle(2, isWhisper ? 0xc4b5fd : 0xe2e8f0, 0.92);
    bubbleBackground.fillRoundedRect(
      bubbleLeft,
      bubbleTop,
      bubbleWidth,
      bubbleHeight,
      CHAT_BUBBLE_RADIUS
    );
    bubbleBackground.strokeRoundedRect(
      bubbleLeft,
      bubbleTop,
      bubbleWidth,
      bubbleHeight,
      CHAT_BUBBLE_RADIUS
    );
    bubbleBackground.fillTriangle(
      0,
      bubbleBottom + CHAT_BUBBLE_TAIL_HEIGHT,
      -CHAT_BUBBLE_TAIL_HALF_WIDTH,
      bubbleBottom - 1,
      CHAT_BUBBLE_TAIL_HALF_WIDTH,
      bubbleBottom - 1
    );

    avatarState.chatBubbleContainer.y = CHAT_BUBBLE_BASE_OFFSET_Y;
    avatarState.chatBubbleContainer.setVisible(true);
    avatarState.chatBubbleExpiresAt =
      this.time.now + (isEmoji ? EMOJI_BUBBLE_DURATION_MS : CHAT_BUBBLE_DURATION_MS);
  }

  refreshChatBubble(avatarState) {
    if (!avatarState?.chatBubbleContainer) {
      return;
    }

    if (avatarState.chatBubbleExpiresAt && avatarState.chatBubbleExpiresAt <= this.time.now) {
      avatarState.chatBubbleContainer.setVisible(false);
      avatarState.chatBubbleExpiresAt = 0;
    }
  }

  drawPortals() {
    const portalDefinitions = getPortalDefinitions(this.spaceType, this.connectedSpaces);

    return portalDefinitions.map((portalDefinition) => {
      const accentSoft = shadeColor(portalDefinition.accentColor, -18);
      const accentBright = shadeColor(portalDefinition.accentColor, 42);
      const glow = this.add.ellipse(
        portalDefinition.x,
        portalDefinition.y + 24,
        portalDefinition.width + 120,
        136,
        portalDefinition.accentColor,
        0.26
      );
      const portalImage = this.worldConfig.portalAssetKey
        ? this.add
            .image(portalDefinition.x, portalDefinition.y + 2, this.worldConfig.portalAssetKey)
            .setDisplaySize(portalDefinition.width + 72, portalDefinition.height + 122)
        : null;
      const frame = portalImage
        ? this.add
            .rectangle(
              portalDefinition.x,
              portalDefinition.y + 2,
              portalDefinition.width + 12,
              portalDefinition.height + 12,
              accentSoft,
              0
            )
            .setStrokeStyle(5, accentBright, 0.52)
        : this.add
            .rectangle(
              portalDefinition.x,
              portalDefinition.y + 2,
              portalDefinition.width + 12,
              portalDefinition.height + 12,
              accentSoft,
              0.22
            )
            .setStrokeStyle(5, accentBright, 0.84);
      const door = portalImage
        ? this.add
            .rectangle(
              portalDefinition.x,
              portalDefinition.y + 2,
              portalDefinition.width - 24,
              portalDefinition.height - 4,
              0x020617,
              0.18
            )
            .setStrokeStyle(2, portalDefinition.borderColor, 0.3)
        : this.add
            .rectangle(
              portalDefinition.x,
              portalDefinition.y + 2,
              portalDefinition.width - 16,
              portalDefinition.height + 8,
              0x020617,
              0.92
            )
            .setStrokeStyle(3, portalDefinition.borderColor, 0.88);
      const label = this.add
        .text(portalDefinition.x, portalDefinition.y - 84, portalDefinition.label, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '13px',
          color: '#f8fafc',
          align: 'center',
          backgroundColor: Phaser.Display.Color.IntegerToColor(shadeColor(this.theme.surfaceColor, 24)).rgba,
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(SCENE_DECOR_DEPTH + 2);

      glow.setDepth(SCENE_DECOR_DEPTH - 1);
      portalImage?.setDepth(SCENE_DECOR_DEPTH);
      frame.setDepth(SCENE_DECOR_DEPTH + 1);
      door.setDepth(SCENE_DECOR_DEPTH + 1);

      return {
        ...portalDefinition,
        glow,
        portalImage,
        frame,
        door,
        labelText: label,
      };
    });
  }

  renderSpaceWorld() {
    this.blockingZones = (this.worldConfig.blockingZones || []).map(
      (zone) => new Phaser.Geom.Rectangle(zone.x, zone.y, zone.width, zone.height)
    );

    this.add
      .image(0, 0, this.worldConfig.assetKey)
      .setOrigin(0)
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setDepth(0);

    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x020617, 0x020617, 0);
    vignette.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    vignette.fillStyle(0x020617, 0.16);
    vignette.fillRect(0, 0, WORLD_WIDTH, 92);
    vignette.fillStyle(0x020617, 0.18);
    vignette.fillRect(0, WORLD_HEIGHT - 128, WORLD_WIDTH, 128);
    vignette.setDepth(1);

    this.createAmbientLights();
  }

  createAmbientLights() {
    this.ambientLights = (this.worldConfig.ambienceLights || []).map((lightConfig, index) => {
      const light = this.add
        .ellipse(
          lightConfig.x,
          lightConfig.y,
          lightConfig.radius * 1.6,
          lightConfig.radius,
          lightConfig.color,
          lightConfig.intensity
        )
        .setDepth(2);

      this.tweens.add({
        targets: light,
        alpha: { from: light.alpha, to: Math.max(0.06, light.alpha * 0.58) },
        scaleX: { from: 1, to: 1.08 + (index % 2) * 0.04 },
        scaleY: { from: 1, to: 1.08 + (index % 3) * 0.03 },
        duration: 2200 + index * 280,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      return light;
    });
  }

  drawBuildingBlock(
    graphics,
    x,
    y,
    width,
    height,
    {
      bodyColor = 0x516072,
      roofColor = 0x253244,
      trimColor = this.theme.accentColor,
      doorColor = 0x0f172a,
      windowColor = 0xe2e8f0,
    } = {}
  ) {
    graphics.fillStyle(bodyColor, 1);
    graphics.fillRoundedRect(x, y, width, height, 22);
    graphics.fillStyle(roofColor, 1);
    graphics.fillRoundedRect(x - 12, y - 20, width + 24, 34, 20);
    graphics.lineStyle(3, trimColor, 0.45);
    graphics.strokeRoundedRect(x, y, width, height, 22);

    const windowWidth = 34;
    const windowHeight = 26;
    const columnGap = (width - windowWidth * 3) / 4;
    const windowStartX = x + columnGap;

    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const windowX = windowStartX + column * (windowWidth + columnGap);
        const windowY = y + 28 + row * 44;
        graphics.fillStyle(windowColor, row === 0 ? 0.8 : 0.64);
        graphics.fillRoundedRect(windowX, windowY, windowWidth, windowHeight, 8);
      }
    }

    graphics.fillStyle(doorColor, 0.94);
    graphics.fillRoundedRect(x + width / 2 - 26, y + height - 72, 52, 72, 16);
    graphics.lineStyle(2, trimColor, 0.42);
    graphics.strokeRoundedRect(x + width / 2 - 26, y + height - 72, 52, 72, 16);
  }

  drawBench(graphics, x, y) {
    graphics.fillStyle(0x7c4a21, 1);
    graphics.fillRoundedRect(x - 30, y, 60, 10, 4);
    graphics.fillRoundedRect(x - 24, y + 12, 48, 8, 4);
    graphics.fillRoundedRect(x - 22, y + 20, 6, 14, 3);
    graphics.fillRoundedRect(x + 16, y + 20, 6, 14, 3);
  }

  drawTree(graphics, x, y) {
    graphics.fillStyle(0x6b4f2d, 1);
    graphics.fillRoundedRect(x - 6, y + 18, 12, 24, 4);
    graphics.fillStyle(0x16a34a, 1);
    graphics.fillCircle(x, y + 4, 22);
    graphics.fillCircle(x - 16, y + 12, 16);
    graphics.fillCircle(x + 16, y + 12, 16);
  }

  drawPlanter(graphics, x, y, width, height, accentColor) {
    graphics.fillStyle(0x1e293b, 0.92);
    graphics.fillRoundedRect(x, y, width, height, 12);
    graphics.lineStyle(2, shadeColor(accentColor, 26), 0.42);
    graphics.strokeRoundedRect(x, y, width, height, 12);
    graphics.fillStyle(0x15803d, 0.94);
    graphics.fillCircle(x + width * 0.28, y + height * 0.3, 16);
    graphics.fillCircle(x + width * 0.5, y + height * 0.18, 20);
    graphics.fillCircle(x + width * 0.72, y + height * 0.32, 15);
  }

  drawBannerStand(graphics, x, y, accentColor, label) {
    graphics.fillStyle(0x475569, 0.98);
    graphics.fillRoundedRect(x - 4, y - 14, 8, 82, 4);
    graphics.fillStyle(0x0f172a, 0.92);
    graphics.fillRoundedRect(x - 34, y - 8, 68, 22, 10);
    graphics.lineStyle(2, accentColor, 0.62);
    graphics.strokeRoundedRect(x - 34, y - 8, 68, 22, 10);
    graphics.fillStyle(accentColor, 0.16);
    graphics.fillRoundedRect(x - 28, y + 16, 56, 34, 10);
    graphics.lineStyle(2, accentColor, 0.38);
    graphics.strokeRoundedRect(x - 28, y + 16, 56, 34, 10);
    this.add
      .text(x, y + 33, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '11px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(SCENE_DECOR_DEPTH + 1);
  }

  drawCanopyLounge(graphics, x, y, accentColor) {
    graphics.fillStyle(0x334155, 0.95);
    graphics.fillRoundedRect(x - 92, y - 6, 184, 12, 6);
    graphics.fillRoundedRect(x - 78, y + 6, 8, 54, 4);
    graphics.fillRoundedRect(x + 70, y + 6, 8, 54, 4);
    graphics.fillStyle(accentColor, 0.22);
    graphics.fillRoundedRect(x - 98, y - 34, 196, 34, 12);
    graphics.lineStyle(3, accentColor, 0.46);
    graphics.strokeRoundedRect(x - 98, y - 34, 196, 34, 12);
    graphics.fillStyle(0x64748b, 0.94);
    graphics.fillRoundedRect(x - 64, y + 22, 128, 18, 8);
    graphics.fillRoundedRect(x - 52, y + 50, 104, 14, 7);
    graphics.fillStyle(0x7c2d12, 0.96);
    graphics.fillRoundedRect(x - 62, y + 74, 124, 14, 7);
  }

  drawForegroundRailing(graphics, y, accentColor) {
    graphics.fillStyle(0x111827, 0.92);
    graphics.fillRoundedRect(0, y, WORLD_WIDTH, 18, 0);
    for (let x = 18; x < WORLD_WIDTH; x += 42) {
      graphics.fillStyle(0x475569, 0.9);
      graphics.fillRoundedRect(x, y - 46, 8, 46, 3);
      graphics.fillStyle(accentColor, x % 84 === 0 ? 0.28 : 0.12);
      graphics.fillRoundedRect(x - 2, y - 22, 12, 4, 2);
    }
  }

  drawLamp(graphics, x, y) {
    graphics.fillStyle(0x334155, 1);
    graphics.fillRoundedRect(x - 3, y, 6, 48, 3);
    graphics.fillStyle(0xfbbf24, 1);
    graphics.fillCircle(x, y - 10, 8);
    graphics.fillStyle(0xfef3c7, 0.18);
    graphics.fillCircle(x, y - 10, 24);
  }

  drawSpaceBackground() {
    const zone = getLobbyZoneDefinition(this.spaceType);
    const sky = this.add.graphics();
    const skyline = this.add.graphics();
    const ground = this.add.graphics();
    const decor = this.add.graphics();
    const foreground = this.add.graphics();
    const plazaX = 92;
    const plazaY = 126;
    const plazaWidth = WORLD_WIDTH - 184;
    const plazaHeight = 472;
    const boulevardY = 646;
    const boulevardHeight = 148;
    const accentShadow = shadeColor(this.theme.accentColor, -48);
    const accentGlow = shadeColor(this.theme.accentColor, 34);

    sky.fillGradientStyle(
      shadeColor(this.theme.surfaceColor, -18),
      shadeColor(this.theme.surfaceColor, -18),
      0x020617,
      0x020617,
      1
    );
    sky.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    for (let index = 0; index < 22; index += 1) {
      const starX = 48 + ((index * 57) % (WORLD_WIDTH - 96));
      const starY = 42 + ((index * 37) % 172);
      sky.fillStyle(this.theme.highlightColor, index % 4 === 0 ? 0.42 : 0.18);
      sky.fillCircle(starX, starY, index % 5 === 0 ? 2.4 : 1.4);
    }

    skyline.fillStyle(0x09111f, 0.88);
    skyline.fillRect(0, 178, WORLD_WIDTH, 190);
    for (let block = 0; block < 9; block += 1) {
      const width = 92 + (block % 3) * 28;
      const x = 12 + block * 142;
      const height = 106 + (block % 4) * 24;
      const y = 216 - (block % 2) * 22;
      skyline.fillStyle(block % 2 === 0 ? 0x142238 : 0x101c2f, 0.96);
      skyline.fillRect(x, y, width, height);
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          skyline.fillStyle(this.theme.highlightColor, row === 0 ? 0.1 : 0.06);
          skyline.fillRect(x + 12 + column * 24, y + 14 + row * 22, 10, 10);
        }
      }
    }

    ground.fillStyle(shadeColor(this.theme.surfaceColor, -16), 0.98);
    ground.fillRoundedRect(44, 92, WORLD_WIDTH - 88, 556, 36);
    ground.lineStyle(4, this.theme.accentColor, 0.22);
    ground.strokeRoundedRect(44, 92, WORLD_WIDTH - 88, 556, 36);

    ground.fillStyle(shadeColor(this.theme.surfaceColor, 8), 0.98);
    ground.fillRoundedRect(plazaX, plazaY, plazaWidth, plazaHeight, 34);
    ground.lineStyle(4, this.theme.accentColor, 0.22);
    ground.strokeRoundedRect(plazaX, plazaY, plazaWidth, plazaHeight, 34);

    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 20; column += 1) {
        const tileX = plazaX + 20 + column * 53;
        const tileY = plazaY + 18 + row * 44;
        const tileColor = (row + column) % 2 === 0 ? 0x7c8b9c : 0x6b7b8f;
        ground.fillStyle(tileColor, row % 3 === 0 ? 0.7 : 0.58);
        ground.fillRoundedRect(tileX, tileY, 42, 32, 7);
      }
    }

    ground.fillStyle(0xd6c59a, 0.78);
    ground.fillRoundedRect(WORLD_WIDTH / 2 - 228, plazaY + 206, 456, 22, 11);
    ground.fillRoundedRect(WORLD_WIDTH / 2 - 11, plazaY + 86, 22, 264, 11);
    ground.lineStyle(2, 0xf8fafc, 0.08);
    ground.strokeCircle(WORLD_WIDTH / 2, plazaY + 226, 104);

    ground.fillStyle(0x1f2937, 1);
    ground.fillRoundedRect(0, boulevardY, WORLD_WIDTH, boulevardHeight, 0);
    ground.fillStyle(0x111827, 0.84);
    ground.fillRoundedRect(0, boulevardY + 18, WORLD_WIDTH, 22, 0);
    ground.fillStyle(0xf8fafc, 0.24);
    for (let x = 26; x < WORLD_WIDTH; x += 86) {
      ground.fillRect(x, boulevardY + 92, 48, 5);
    }
    for (let stripeIndex = 0; stripeIndex < 8; stripeIndex += 1) {
      ground.fillStyle(0xf8fafc, 0.82);
      ground.fillRoundedRect(WORLD_WIDTH / 2 - 72 + stripeIndex * 20, boulevardY - 2, 12, 86, 4);
    }
    ground.fillStyle(0x0f172a, 0.78);
    ground.fillRoundedRect(0, boulevardY - 20, WORLD_WIDTH, 20, 0);

    this.drawBuildingBlock(ground, 104, 124, 238, 156, {
      bodyColor: 0x6c627e,
      roofColor: 0x40324f,
      trimColor: accentGlow,
      windowColor: 0xdbeafe,
    });
    this.drawBuildingBlock(ground, WORLD_WIDTH - 342, 124, 238, 156, {
      bodyColor: 0x5e7189,
      roofColor: 0x24354a,
      trimColor: accentGlow,
      windowColor: 0xe0f2fe,
    });
    this.drawBuildingBlock(ground, 92, 338, 192, 180, {
      bodyColor: this.spaceType === 'MENTORING' ? 0x7b6047 : 0x4b6a63,
      roofColor: this.spaceType === 'MENTORING' ? 0x5c3927 : 0x213d3a,
      trimColor: accentGlow,
      windowColor: 0xfef3c7,
    });
    this.drawBuildingBlock(ground, WORLD_WIDTH - 286, 338, 192, 180, {
      bodyColor: this.spaceType === 'STUDY' ? 0x436c55 : 0x736255,
      roofColor: this.spaceType === 'STUDY' ? 0x1f4938 : 0x4b3525,
      trimColor: accentGlow,
      windowColor: 0xf1f5f9,
    });

    this.drawPlanter(decor, 170, boulevardY - 56, 86, 34, this.theme.accentColor);
    this.drawPlanter(decor, 280, boulevardY - 56, 86, 34, this.theme.accentColor);
    this.drawPlanter(decor, WORLD_WIDTH - 366, boulevardY - 56, 86, 34, this.theme.accentColor);
    this.drawPlanter(decor, WORLD_WIDTH - 256, boulevardY - 56, 86, 34, this.theme.accentColor);
    this.drawBench(decor, WORLD_WIDTH / 2 - 242, boulevardY - 54);
    this.drawBench(decor, WORLD_WIDTH / 2 + 242, boulevardY - 54);
    this.drawLamp(decor, WORLD_WIDTH / 2 - 236, plazaY + 154);
    this.drawLamp(decor, WORLD_WIDTH / 2 + 236, plazaY + 154);
    this.drawLamp(decor, 174, boulevardY - 34);
    this.drawLamp(decor, WORLD_WIDTH - 174, boulevardY - 34);
    this.drawTree(decor, 162, boulevardY - 22);
    this.drawTree(decor, 298, boulevardY - 24);
    this.drawTree(decor, WORLD_WIDTH - 162, boulevardY - 22);
    this.drawTree(decor, WORLD_WIDTH - 298, boulevardY - 24);
    this.drawBannerStand(decor, 430, plazaY + 102, this.theme.accentColor, 'COMMUNITY');
    this.drawBannerStand(decor, WORLD_WIDTH - 430, plazaY + 102, this.theme.accentColor, 'LIVE');

    if (this.spaceType === 'STUDY') {
      this.drawCanopyLounge(decor, WORLD_WIDTH / 2, plazaY + 306, this.theme.accentColor);
      this.drawBannerStand(decor, WORLD_WIDTH / 2 - 128, plazaY + 264, this.theme.accentColor, 'STUDY');
      this.drawBannerStand(decor, WORLD_WIDTH / 2 + 128, plazaY + 264, this.theme.accentColor, 'FOCUS');
    }

    if (this.spaceType === 'MENTORING') {
      decor.fillStyle(0x24150c, 0.58);
      decor.fillRoundedRect(WORLD_WIDTH / 2 - 176, plazaY + 252, 352, 102, 28);
      decor.lineStyle(3, this.theme.accentColor, 0.34);
      decor.strokeRoundedRect(WORLD_WIDTH / 2 - 176, plazaY + 252, 352, 102, 28);
      decor.fillStyle(0xf8fafc, 0.92);
      decor.fillRoundedRect(WORLD_WIDTH / 2 - 102, plazaY + 280, 204, 14, 7);
      decor.fillRoundedRect(WORLD_WIDTH / 2 - 82, plazaY + 308, 164, 14, 7);
      this.drawBannerStand(decor, WORLD_WIDTH / 2 - 186, plazaY + 274, this.theme.accentColor, 'MENTOR');
      this.drawBannerStand(decor, WORLD_WIDTH / 2 + 186, plazaY + 274, this.theme.accentColor, 'ROOM');
    }

    if (this.spaceType === 'MAIN') {
      decor.fillStyle(this.theme.accentColor, 0.1);
      decor.fillCircle(WORLD_WIDTH / 2, plazaY + 226, 92);
      decor.lineStyle(3, this.theme.accentColor, 0.28);
      decor.strokeCircle(WORLD_WIDTH / 2, plazaY + 226, 92);
      decor.fillStyle(accentShadow, 0.24);
      decor.fillRoundedRect(WORLD_WIDTH / 2 - 116, plazaY + 308, 232, 22, 11);
      this.drawBannerStand(decor, WORLD_WIDTH / 2 - 208, plazaY + 248, this.theme.accentColor, 'LOUNGE');
      this.drawBannerStand(decor, WORLD_WIDTH / 2 + 208, plazaY + 248, this.theme.accentColor, 'EVENT');
    }

    foreground.fillGradientStyle(0x000000, 0x000000, 0x020617, 0x020617, 0);
    this.drawForegroundRailing(foreground, 792, this.theme.accentColor);
    foreground.setDepth(FOREGROUND_DEPTH);

    this.add
      .text(WORLD_WIDTH / 2, 104, zone.label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '44px',
        color: '#f8fafc',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0.18)
      .setDepth(SCENE_DECOR_DEPTH + 1);
  }
}
