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
const PORTAL_SPAWN_OFFSET_Y = 112;
const AVATAR_HIT_AREA_WIDTH = 68;
const AVATAR_HIT_AREA_HEIGHT = 96;
const AVATAR_RING_Y = 16;
const AVATAR_NAME_OFFSET_Y = 42;
const AVATAR_WALK_FRAME_DURATION = 140;

const SPACE_PORTAL_LAYOUTS = {
  MAIN: [
    { targetType: 'STUDY', x: 312, y: 650 },
    { targetType: 'MENTORING', x: 968, y: 650 },
  ],
  STUDY: [
    { targetType: 'MAIN', x: 256, y: 650 },
    { targetType: 'MENTORING', x: 1024, y: 650 },
  ],
  MENTORING: [
    { targetType: 'MAIN', x: 1024, y: 650 },
    { targetType: 'STUDY', x: 256, y: 650 },
  ],
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
      title: '멘토링 존',
      subtitle: '아바타를 클릭해 바로 요청이나 예약 흐름으로 연결할 수 있습니다.',
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
        helperText: targetZone.helperText,
        accentColor: targetTheme.accentColor,
        borderColor: targetTheme.borderColor,
      };
    })
    .filter(Boolean);
}

export default class SpaceScene extends Phaser.Scene {
  constructor({
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
    this.remotePlayers = new Map();
    this.theme = getSpaceTheme(spaceType);
    this.portals = [];
    this.portalPrompt = null;
    this.activePortalTargetType = null;
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

    this.drawSpaceBackground();
    this.portals = this.drawPortals();

    const spawnPosition = this.resolveSpawnPosition();
    this.playerAvatar = this.createAvatar(
      spawnPosition.x,
      spawnPosition.y,
      this.playerLabel,
      this.avatarPresetId,
      { focusAlpha: 0.3 }
    );
    this.player = this.playerAvatar.container;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    ]);
    this.input.keyboard?.on('keydown-SPACE', this.handlePortalEnter, this);
    this.input.keyboard?.on('keydown-ENTER', this.handlePortalEnter, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-SPACE', this.handlePortalEnter, this);
      this.input.keyboard?.off('keydown-ENTER', this.handlePortalEnter, this);
    });
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.add
      .text(28, 24, this.theme.title, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '24px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.add
      .text(28, 56, this.theme.subtitle, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '15px',
        color: '#cbd5e1',
        wordWrap: { width: 420 },
      })
      .setScrollFactor(0);

    this.portalPrompt = this.add
      .text(28, 108, '', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '14px',
        color: '#fef3c7',
        wordWrap: { width: 520 },
      })
      .setScrollFactor(0);

    this.refreshPortalPrompt();
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
      this.refreshPortalPrompt();
    }
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

    return {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
    };
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

  refreshPortalPrompt() {
    const activePortal = this.resolveActivePortal();
    this.activePortalTargetType = activePortal?.targetType ?? null;

    this.portals.forEach((portal) => {
      const isActive = activePortal?.targetType === portal.targetType;
      portal.glow.setAlpha(isActive ? 0.52 : 0.26);
      portal.frame.setStrokeStyle(isActive ? 5 : 3, isActive ? 0xfef3c7 : portal.accentColor, 0.95);
      portal.door.setFillStyle(0x020617, isActive ? 0.98 : 0.88);
      portal.helper.setColor(isActive ? '#f8fafc' : '#cbd5e1');
    });

    if (!this.portalPrompt) {
      return;
    }

    if (!activePortal) {
      this.portalPrompt.setText('문 앞으로 이동한 뒤 Space 또는 Enter를 누르면 다음 공간으로 들어갑니다.');
      return;
    }

    this.portalPrompt.setText(
      `Space 또는 Enter로 ${activePortal.label} 입장\n${activePortal.helperText}`
    );
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

    avatar.add([shadow, focusRing, sprite, badge, nameLabel]);

    const avatarState = {
      container: avatar,
      shadow,
      focusRing,
      sprite,
      badge,
      nameLabel,
      avatarPresetId,
      direction: 'down',
      step: 0,
      animationElapsed: 0,
      isHovered: false,
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
    avatarState.focusRing.setAlpha(isHovered ? 0.92 : 0);
    avatarState.nameLabel.setColor(isHovered ? '#f8fafc' : '#e2e8f0');
  }

  drawPortals() {
    const portalDefinitions = getPortalDefinitions(this.spaceType, this.connectedSpaces);

    return portalDefinitions.map((portalDefinition) => {
      const glow = this.add.ellipse(
        portalDefinition.x,
        portalDefinition.y + 18,
        portalDefinition.width + 46,
        86,
        portalDefinition.accentColor,
        0.26
      );
      const frame = this.add
        .rectangle(
          portalDefinition.x,
          portalDefinition.y,
          portalDefinition.width,
          portalDefinition.height,
          portalDefinition.accentColor,
          0.18
        )
        .setStrokeStyle(3, portalDefinition.accentColor, 0.92);
      const door = this.add
        .rectangle(
          portalDefinition.x,
          portalDefinition.y - 2,
          portalDefinition.width - 24,
          portalDefinition.height - 18,
          0x020617,
          0.88
        )
        .setStrokeStyle(2, portalDefinition.borderColor, 0.82);
      const sign = this.add
        .text(portalDefinition.x, portalDefinition.y - 18, 'ENTER', {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '16px',
          color: Phaser.Display.Color.IntegerToColor(portalDefinition.borderColor).rgba,
        })
        .setOrigin(0.5)
        .setDepth(2);
      const label = this.add
        .text(portalDefinition.x, portalDefinition.y + 10, portalDefinition.label, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '13px',
          color: '#f8fafc',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(2);
      const helper = this.add
        .text(portalDefinition.x, portalDefinition.y + 62, portalDefinition.helperText, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '12px',
          color: '#cbd5e1',
          align: 'center',
          wordWrap: {
            width: portalDefinition.width + 26,
          },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2);

      glow.setDepth(1);
      frame.setDepth(1);
      door.setDepth(1);

      return {
        ...portalDefinition,
        glow,
        frame,
        door,
        sign,
        labelText: label,
        helper,
      };
    });
  }

  drawSpaceBackground() {
    const zone = getLobbyZoneDefinition(this.spaceType);
    const background = this.add.graphics();

    background.fillGradientStyle(0x0f172a, 0x0f172a, 0x020617, 0x020617, 1);
    background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    background.fillStyle(this.theme.surfaceColor, 1);
    background.fillRoundedRect(72, 72, WORLD_WIDTH - 144, WORLD_HEIGHT - 144, 36);
    background.lineStyle(4, this.theme.accentColor, 0.55);
    background.strokeRoundedRect(72, 72, WORLD_WIDTH - 144, WORLD_HEIGHT - 144, 36);

    background.fillStyle(this.theme.furnitureColor, 1);
    background.fillRoundedRect(170, 180, WORLD_WIDTH - 340, 120, 28);
    background.fillRoundedRect(170, 340, 220, 180, 24);
    background.fillRoundedRect(WORLD_WIDTH - 390, 340, 220, 180, 24);
    background.fillRoundedRect(150, WORLD_HEIGHT - 232, WORLD_WIDTH - 300, 128, 30);

    this.add
      .text(WORLD_WIDTH / 2, 132, zone.label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '26px',
        color: Phaser.Display.Color.IntegerToColor(zone.accentColor).rgba,
      })
      .setOrigin(0.5);

    this.add
      .text(WORLD_WIDTH / 2, 164, zone.helperText, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '15px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
