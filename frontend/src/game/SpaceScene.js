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

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 840;
const PLAYER_SPEED = 250;
const WORLD_PADDING = 56;
const PORTAL_ENTRY_DISTANCE = 92;
const PARTICIPANT_INTERACTION_DISTANCE = 96;
const PORTAL_SPAWN_OFFSET_Y = 112;
const CAMERA_ZOOM = 1.02;
const AVATAR_HIT_AREA_WIDTH = 68;
const AVATAR_HIT_AREA_HEIGHT = 96;
const AVATAR_RING_Y = 16;
const AVATAR_NAME_OFFSET_Y = 42;
const AVATAR_WALK_FRAME_DURATION = 140;
const CHAT_BUBBLE_DURATION_MS = 3600;
const EMOJI_BUBBLE_DURATION_MS = 2200;

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
    this.theme = getSpaceTheme(spaceType);
    this.portals = [];
    this.activePortalTargetType = null;
    this.activeParticipantUserId = null;
    this.isEnteringPortal = false;
  }

  preload() {
    if (this.textures.exists(AVATAR_SPRITE_SHEET_KEY)) {
      return;
    }

    this.load.spritesheet(AVATAR_SPRITE_SHEET_KEY, AVATAR_SPRITE_SHEET_URL, {
      frameWidth: AVATAR_SPRITE_FRAME_SIZE,
      frameHeight: AVATAR_SPRITE_FRAME_SIZE,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(CAMERA_ZOOM);

    this.drawSpaceBackground();
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

    this.player.x = Phaser.Math.Clamp(
      this.player.x + direction.x * distance,
      WORLD_PADDING,
      WORLD_WIDTH - WORLD_PADDING
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + direction.y * distance,
      WORLD_PADDING,
      WORLD_HEIGHT - WORLD_PADDING
    );

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
      if (!this.remotePlayers.has(event.userId)) {
        this.addRemotePlayer(event.userId, event.x, event.y, event.label, event.avatarPresetId);
        return;
      }

      this.updateRemotePlayerLabel(this.remotePlayers.get(event.userId)?.nameLabel, event.label);
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
      chatMessage.senderId === this.currentUserId
        ? this.playerAvatar
        : this.remotePlayers.get(chatMessage.senderId) || null;

    if (!targetAvatar) {
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

    const remotePlayer = this.remotePlayers.get(this.activeParticipantUserId);

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

    return DEFAULT_SPAWN_POSITIONS[this.spaceType] || DEFAULT_SPAWN_POSITIONS.MAIN;
  }

  addRemotePlayer(userId, x, y, label = '게스트', avatarPresetId = null) {
    const existingRemotePlayer = this.remotePlayers.get(userId);

    if (existingRemotePlayer) {
      this.updateRemotePlayerLabel(existingRemotePlayer.nameLabel, label);
      this.updateRemotePlayerAvatar(userId, avatarPresetId);
      this.moveRemotePlayer(userId, x, y);
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
      const latestRemotePlayer = this.remotePlayers.get(userId);

      this.onParticipantSelect?.({
        userId,
        label: latestRemotePlayer?.nameLabel.text || label,
        x: latestRemotePlayer?.container.x ?? position.x,
        y: latestRemotePlayer?.container.y ?? position.y,
      });
    });

    this.remotePlayers.set(userId, remotePlayer);
  }

  moveRemotePlayer(userId, x, y) {
    const remotePlayer = this.remotePlayers.get(userId);

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
    const remotePlayer = this.remotePlayers.get(userId);

    if (!remotePlayer) {
      return;
    }

    remotePlayer.container.destroy(true);
    this.remotePlayers.delete(userId);
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

    const remotePlayer = this.remotePlayers.get(userId);

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

    return {
      x: Phaser.Math.Clamp(nextX, WORLD_PADDING, WORLD_WIDTH - WORLD_PADDING),
      y: Phaser.Math.Clamp(nextY, WORLD_PADDING, WORLD_HEIGHT - WORLD_PADDING),
    };
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

  createAvatar(x, y, label, avatarPresetId, { focusAlpha = 0 } = {}) {
    const palette = getAvatarPalette(avatarPresetId);
    const avatar = this.add.container(x, y);
    const shadow = this.add.ellipse(0, 22, 38, 16, 0x020617, 0.24);
    const focusRing = this.add.ellipse(0, AVATAR_RING_Y, 52, 22);
    const sprite = this.add.sprite(
      0,
      0,
      AVATAR_SPRITE_SHEET_KEY,
      getAvatarSpriteFrame(avatarPresetId, 'down', 0).index
    );
    const nameLabel = this.add
      .text(0, AVATAR_NAME_OFFSET_Y, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const badge = this.add.circle(21, -16, 4, palette.accentColorValue, 1);
    const chatBubbleContainer = this.add.container(0, -72).setVisible(false);
    const chatBubbleBackground = this.add.graphics();
    const chatBubbleText = this.add
      .text(0, 0, '', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '13px',
        color: '#0f172a',
        align: 'center',
        wordWrap: { width: 168 },
      })
      .setOrigin(0.5);

    chatBubbleContainer.add([chatBubbleBackground, chatBubbleText]);

    avatar.add([shadow, focusRing, sprite, badge, chatBubbleContainer, nameLabel]);

    const avatarState = {
      container: avatar,
      shadow,
      focusRing,
      sprite,
      badge,
      nameLabel,
      chatBubbleContainer,
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
    if (!avatarState?.chatBubbleContainer || !avatarState.chatBubbleBackground || !avatarState.chatBubbleText) {
      return;
    }

    const isEmoji = chatMessage.variant === 'EMOJI';
    const isWhisper = chatMessage.scope === 'WHISPER';
    const bubbleText = isEmoji
      ? chatMessage.content
      : chatMessage.content.length > 52
        ? `${chatMessage.content.slice(0, 52)}...`
        : chatMessage.content;

    avatarState.chatBubbleText.setText(bubbleText);
    avatarState.chatBubbleText.setStyle({
      fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
      fontSize: isEmoji ? '28px' : '13px',
      color: isWhisper ? '#f8fafc' : '#0f172a',
      align: 'center',
      wordWrap: { width: isEmoji ? 72 : 168 },
    });

    const textBounds = avatarState.chatBubbleText.getBounds();
    const paddingX = isEmoji ? 16 : 14;
    const paddingY = isEmoji ? 12 : 10;
    const bubbleWidth = textBounds.width + paddingX * 2;
    const bubbleHeight = textBounds.height + paddingY * 2;
    const bubbleBackground = avatarState.chatBubbleBackground;

    bubbleBackground.clear();
    bubbleBackground.fillStyle(isWhisper ? 0x4338ca : 0xf8fafc, 0.96);
    bubbleBackground.lineStyle(2, isWhisper ? 0xc4b5fd : 0xe2e8f0, 0.92);
    bubbleBackground.fillRoundedRect(
      -bubbleWidth / 2,
      -bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      16
    );
    bubbleBackground.strokeRoundedRect(
      -bubbleWidth / 2,
      -bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      16
    );
    bubbleBackground.fillTriangle(
      0,
      bubbleHeight / 2 + 8,
      -10,
      bubbleHeight / 2 - 2,
      10,
      bubbleHeight / 2 - 2
    );

    avatarState.chatBubbleContainer.y = isEmoji ? -82 : -96;
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
      const glow = this.add.ellipse(
        portalDefinition.x,
        portalDefinition.y + 18,
        portalDefinition.width + 72,
        104,
        portalDefinition.accentColor,
        0.34
      );
      const frame = this.add
        .rectangle(
          portalDefinition.x,
          portalDefinition.y,
          portalDefinition.width,
          portalDefinition.height,
          portalDefinition.accentColor,
          0.24
        )
        .setStrokeStyle(4, portalDefinition.accentColor, 0.92);
      const door = this.add
        .rectangle(
          portalDefinition.x,
          portalDefinition.y - 2,
          portalDefinition.width - 24,
          portalDefinition.height - 18,
          0x020617,
          0.92
        )
        .setStrokeStyle(3, portalDefinition.borderColor, 0.88);
      const label = this.add
        .text(portalDefinition.x, portalDefinition.y + 8, portalDefinition.label, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '15px',
          color: '#f8fafc',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(2);

      glow.setDepth(1);
      frame.setDepth(1);
      door.setDepth(1);

      return {
        ...portalDefinition,
        glow,
        frame,
        door,
        labelText: label,
      };
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
    const background = this.add.graphics();
    const plazaX = 86;
    const plazaY = 106;
    const plazaWidth = WORLD_WIDTH - 172;
    const plazaHeight = 550;
    const roadY = 680;

    background.fillGradientStyle(0x0f172a, 0x0f172a, 0x020617, 0x020617, 1);
    background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    background.fillStyle(this.theme.surfaceColor, 1);
    background.fillRoundedRect(plazaX, plazaY, plazaWidth, plazaHeight, 32);
    background.lineStyle(4, this.theme.accentColor, 0.34);
    background.strokeRoundedRect(plazaX, plazaY, plazaWidth, plazaHeight, 32);

    for (let row = 0; row < 12; row += 1) {
      for (let column = 0; column < 25; column += 1) {
        const tileX = plazaX + 14 + column * 42;
        const tileY = plazaY + 14 + row * 42;
        const tileColor = (row + column) % 2 === 0 ? 0x708094 : 0x64748b;
        background.fillStyle(tileColor, 0.9);
        background.fillRoundedRect(tileX, tileY, 34, 34, 8);
      }
    }

    background.fillStyle(0x1f2937, 1);
    background.fillRect(0, roadY, WORLD_WIDTH, WORLD_HEIGHT - roadY);

    for (let x = 0; x < WORLD_WIDTH; x += 74) {
      background.fillStyle(0xf8fafc, 0.34);
      background.fillRect(x + 8, roadY + 74, 42, 4);
    }

    for (let stripeIndex = 0; stripeIndex < 7; stripeIndex += 1) {
      background.fillStyle(0xf8fafc, 0.82);
      background.fillRect(WORLD_WIDTH / 2 - 54 + stripeIndex * 16, roadY - 2, 10, 84);
    }

    this.drawBuildingBlock(background, 126, 132, 214, 148, {
      bodyColor: 0x6d5f7d,
      roofColor: 0x433252,
      trimColor: this.theme.accentColor,
    });
    this.drawBuildingBlock(background, WORLD_WIDTH - 340, 132, 214, 148, {
      bodyColor: 0x5d7084,
      roofColor: 0x26384d,
      trimColor: this.theme.accentColor,
    });
    this.drawBuildingBlock(background, 112, 360, 176, 166, {
      bodyColor: 0x7b6047,
      roofColor: 0x5b3b28,
      trimColor: this.theme.accentColor,
    });
    this.drawBuildingBlock(background, WORLD_WIDTH - 288, 360, 176, 166, {
      bodyColor: 0x506d69,
      roofColor: 0x2b4541,
      trimColor: this.theme.accentColor,
    });

    background.fillStyle(0xe2d3a0, 0.9);
    background.fillRoundedRect(WORLD_WIDTH / 2 - 210, plazaY + 238, 420, 18, 9);
    background.fillRoundedRect(WORLD_WIDTH / 2 - 9, plazaY + 118, 18, 228, 9);

    this.drawBench(background, WORLD_WIDTH / 2 + 196, roadY - 58);
    this.drawBench(background, WORLD_WIDTH / 2 - 228, roadY - 58);
    this.drawLamp(background, WORLD_WIDTH / 2 - 164, plazaY + 148);
    this.drawLamp(background, WORLD_WIDTH / 2 + 164, plazaY + 148);
    this.drawTree(background, 170, roadY - 24);
    this.drawTree(background, 298, roadY - 24);
    this.drawTree(background, WORLD_WIDTH - 170, roadY - 24);
    this.drawTree(background, WORLD_WIDTH - 298, roadY - 24);

    this.add
      .text(WORLD_WIDTH / 2, 392, zone.label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '44px',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setAlpha(0.28);
  }
}
