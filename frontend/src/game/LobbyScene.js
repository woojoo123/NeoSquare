import Phaser from 'phaser';

import {
  AVATAR_SPRITE_FRAME_SIZE,
  AVATAR_SPRITE_SHEET_KEY,
  AVATAR_SPRITE_SHEET_URL,
  getAvatarDirectionFromDelta,
  getAvatarPalette,
  getAvatarSpriteFrame,
} from '../lib/avatarPresets';
import {
  LOBBY_ZONE_DEFINITIONS,
  getLobbyZoneCenter,
  getLobbyZoneDefinition,
  getLobbyZoneEntry,
  getLobbyZoneForPosition,
} from '../lib/lobbyZones';

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const PLAYER_SPEED = 260;
const WORLD_PADDING = 40;
const PLAYER_CONTEXT_THRESHOLD = 18;
const SPACE_ENTRY_DISTANCE = 72;
const AVATAR_HIT_AREA_WIDTH = 68;
const AVATAR_HIT_AREA_HEIGHT = 96;
const AVATAR_RING_Y = 16;
const AVATAR_NAME_OFFSET_Y = 42;
const AVATAR_WALK_FRAME_DURATION = 140;

export default class LobbyScene extends Phaser.Scene {
  constructor({
    playerLabel = '나',
    avatarPresetId,
    onPlayerMove,
    onSceneReady,
    onZoneChange,
    onPlayerContextChange,
    onSpaceEnter,
    onRemotePlayerSelect,
    availableSpaceTypes = [],
  } = {}) {
    super('LobbyScene');
    this.playerLabel = playerLabel;
    this.avatarPresetId = avatarPresetId;
    this.onPlayerMove = onPlayerMove;
    this.onSceneReady = onSceneReady;
    this.onZoneChange = onZoneChange;
    this.onPlayerContextChange = onPlayerContextChange;
    this.onSpaceEnter = onSpaceEnter;
    this.onRemotePlayerSelect = onRemotePlayerSelect;
    this.availableSpaceTypes = new Set(availableSpaceTypes);
    this.player = null;
    this.playerAvatar = null;
    this.zoneHighlight = null;
    this.zoneStatusTitle = null;
    this.zoneStatusDescription = null;
    this.entryPrompt = null;
    this.cursors = null;
    this.remotePlayers = new Map();
    this.currentZoneId = 'MAIN';
    this.currentEntryZoneId = null;
    this.isEnteringSpace = false;
    this.lastReportedPosition = null;
    this.selectedRemoteUserId = null;
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

    this.drawLobbyBackground();
    this.zoneHighlight = this.add.graphics();

    const spawnPosition = getLobbyZoneCenter('MAIN');
    this.playerAvatar = this.createAvatar(
      spawnPosition.x,
      spawnPosition.y,
      this.playerLabel,
      this.avatarPresetId,
      { focusAlpha: 0.32 }
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
    this.input.keyboard?.on('keydown-SPACE', this.handleSpaceEnter, this);
    this.input.keyboard?.on('keydown-ENTER', this.handleSpaceEnter, this);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-SPACE', this.handleSpaceEnter, this);
      this.input.keyboard?.off('keydown-ENTER', this.handleSpaceEnter, this);
    });

    this.add
      .text(28, 24, 'NeoSquare 허브', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '24px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.add
      .text(28, 56, '방향키로 이동하고, 구역에 맞는 액션을 바로 실행해 보세요.', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '15px',
        color: '#cbd5e1',
      })
      .setScrollFactor(0);

    this.input.on('gameobjectdown', (_, gameObject) => {
      const selectedUserId = gameObject?.getData?.('remoteUserId');

      if (!selectedUserId) {
        return;
      }

      this.selectRemotePlayer(selectedUserId);
    });

    this.zoneStatusTitle = this.add
      .text(28, 92, '', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.zoneStatusDescription = this.add
      .text(28, 116, '', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '14px',
        color: '#cbd5e1',
        wordWrap: {
          width: 420,
        },
      })
      .setScrollFactor(0);

    this.entryPrompt = this.add
      .text(28, 168, '', {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '14px',
        color: '#fef3c7',
      })
      .setScrollFactor(0);

    this.refreshEntryPrompt();
    this.emitPlayerContext(true);
    this.onPlayerMove?.({
      x: this.player.x,
      y: this.player.y,
    });
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
      this.refreshEntryPrompt();
      this.emitPlayerContext();
    }
  }

  applyRemoteEvent(event) {
    if (!event?.type || !event.userId) {
      return;
    }

    const remoteUserId = String(event.userId);

    if (event.type === 'user_enter') {
      this.addRemotePlayer(remoteUserId, event.x, event.y, event.label, event.avatarPresetId);
      return;
    }

    if (event.type === 'user_move') {
      if (!this.remotePlayers.has(remoteUserId)) {
        this.addRemotePlayer(remoteUserId, event.x, event.y, event.label, event.avatarPresetId);
        return;
      }

      this.updateRemotePlayerLabel(this.remotePlayers.get(remoteUserId)?.nameLabel, event.label);
      this.updateRemotePlayerAvatar(remoteUserId, event.avatarPresetId);
      this.moveRemotePlayer(remoteUserId, event.x, event.y);
      return;
    }

    if (event.type === 'user_leave') {
      this.removeRemotePlayer(remoteUserId);
    }
  }

  movePlayerToZone(zoneId) {
    if (!this.player) {
      return;
    }

    const center = getLobbyZoneCenter(zoneId);

    this.tweens.killTweensOf(this.player);
    this.tweens.add({
      targets: this.player,
      x: center.x,
      y: center.y,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.onPlayerMove?.({
          x: this.player.x,
          y: this.player.y,
        });
        this.refreshEntryPrompt();
        this.emitPlayerContext(true);
      },
    });
  }

  handleSpaceEnter() {
    if (!this.currentEntryZoneId || this.isEnteringSpace) {
      return;
    }

    this.isEnteringSpace = true;
    this.onSpaceEnter?.(this.currentEntryZoneId);
    this.time.delayedCall(400, () => {
      this.isEnteringSpace = false;
    });
  }

  addRemotePlayer(userId, x, y, label = '게스트', avatarPresetId = null) {
    const remoteKey = String(userId);
    const existingRemotePlayer = this.remotePlayers.get(remoteKey);

    if (existingRemotePlayer) {
      this.updateRemotePlayerLabel(existingRemotePlayer.nameLabel, label);
      this.updateRemotePlayerAvatar(remoteKey, avatarPresetId);
      this.moveRemotePlayer(remoteKey, x, y);
      return;
    }

    const position = this.resolveRemotePosition(remoteKey, x, y);
    const remotePlayer = this.createAvatar(position.x, position.y, label, avatarPresetId, {
      focusAlpha: 0.18,
    });
    remotePlayer.container.setData('remoteUserId', remoteKey);
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
      remotePlayer.isHovered = true;
      this.refreshRemoteSelection(remoteKey);
    });
    remotePlayer.container.on('pointerout', () => {
      remotePlayer.isHovered = false;
      this.refreshRemoteSelection(remoteKey);
    });

    this.remotePlayers.set(remoteKey, remotePlayer);

    this.refreshRemoteSelection(remoteKey);
  }

  moveRemotePlayer(userId, x, y) {
    const remoteKey = String(userId);
    const remotePlayer = this.remotePlayers.get(remoteKey);

    if (!remotePlayer) {
      this.addRemotePlayer(remoteKey, x, y);
      return;
    }

    const position = this.resolveRemotePosition(
      remoteKey,
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
    const remoteKey = String(userId);
    const remotePlayer = this.remotePlayers.get(remoteKey);

    if (!remotePlayer) {
      return;
    }

    remotePlayer.container.destroy(true);
    this.remotePlayers.delete(remoteKey);

    if (String(this.selectedRemoteUserId) === remoteKey) {
      this.selectedRemoteUserId = null;
      this.onRemotePlayerSelect?.(null);
    }
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

    const remotePlayer = this.remotePlayers.get(String(userId));

    if (!remotePlayer?.sprite) {
      return;
    }

    remotePlayer.avatarPresetId = avatarPresetId;
    this.applyAvatarAppearance(remotePlayer);
    this.refreshRemoteSelection(String(userId));
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
      x: 140 + ((seed * 137) % (WORLD_WIDTH - 280)),
      y: 140 + ((seed * 89) % (WORLD_HEIGHT - 280)),
    };
  }

  selectRemotePlayer(userId) {
    const normalizedUserId = userId ? String(userId) : null;
    const nextSelectedUserId =
      normalizedUserId && this.remotePlayers.has(normalizedUserId) ? normalizedUserId : null;

    this.selectedRemoteUserId = nextSelectedUserId;
    this.remotePlayers.forEach((_, remoteUserId) => {
      this.refreshRemoteSelection(remoteUserId);
    });
    this.onRemotePlayerSelect?.(nextSelectedUserId);
  }

  refreshRemoteSelection(userId) {
    const remotePlayer = this.remotePlayers.get(userId);

    if (!remotePlayer?.focusRing || !remotePlayer?.nameLabel) {
      return;
    }

    const isSelected = String(this.selectedRemoteUserId) === String(userId);
    const palette = getAvatarPalette(remotePlayer.avatarPresetId);
    const ringColor = isSelected ? 0xfef3c7 : palette.accentColorValue;
    const fillAlpha = isSelected ? 0.28 : 0.16;
    const ringAlpha = isSelected ? 0.96 : remotePlayer.isHovered ? 0.62 : 0.18;

    remotePlayer.focusRing.setStrokeStyle(isSelected ? 4 : 3, ringColor, 0.96);
    remotePlayer.focusRing.setFillStyle(ringColor, fillAlpha);
    remotePlayer.focusRing.setAlpha(ringAlpha);
    remotePlayer.nameLabel.setColor(isSelected || remotePlayer.isHovered ? '#f8fafc' : '#e2e8f0');
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
    const badge = this.add.circle(21, -16, 4, palette.accentColorValue, 1);
    const nameLabel = this.add
      .text(0, AVATAR_NAME_OFFSET_Y, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);

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

  emitPlayerContext(force = false) {
    if (!this.player) {
      return;
    }

    const nextZone = getLobbyZoneForPosition(this.player.x, this.player.y);
    const previousPosition = this.lastReportedPosition;
    const movedDistance = previousPosition
      ? Phaser.Math.Distance.Between(
          previousPosition.x,
          previousPosition.y,
          this.player.x,
          this.player.y
        )
      : PLAYER_CONTEXT_THRESHOLD;
    const zoneChanged = nextZone.id !== this.currentZoneId;

    if (!force && !zoneChanged && movedDistance < PLAYER_CONTEXT_THRESHOLD) {
      return;
    }

    this.currentZoneId = nextZone.id;
    this.lastReportedPosition = {
      x: this.player.x,
      y: this.player.y,
    };

    this.refreshZoneOverlay(nextZone.id);
    this.refreshZoneStatus(nextZone.id);
    this.onZoneChange?.(nextZone.id);
    this.onPlayerContextChange?.({
      x: this.player.x,
      y: this.player.y,
      zoneId: nextZone.id,
    });
  }

  refreshZoneOverlay(zoneId) {
    if (!this.zoneHighlight) {
      return;
    }

    const zone = getLobbyZoneDefinition(zoneId);

    this.zoneHighlight.clear();
    this.zoneHighlight.lineStyle(5, zone.borderColor, 0.95);
    this.zoneHighlight.strokeRoundedRect(
      zone.x - 6,
      zone.y - 6,
      zone.width + 12,
      zone.height + 12,
      32
    );
  }

  refreshZoneStatus(zoneId) {
    const zone = getLobbyZoneDefinition(zoneId);

    this.zoneStatusTitle?.setText(`현재 구역: ${zone.label}`);
    this.zoneStatusDescription?.setText(zone.helperText);
  }

  refreshEntryPrompt() {
    const nextEntryZone = this.resolveActiveEntryZone();

    this.currentEntryZoneId = nextEntryZone?.id ?? null;

    if (!this.entryPrompt) {
      return;
    }

    if (!nextEntryZone) {
      this.entryPrompt.setText('입구 가까이 가면 Space 또는 Enter로 바로 입장할 수 있습니다.');
      return;
    }

    this.entryPrompt.setText(`Space 또는 Enter로 ${nextEntryZone.label} 입장`);
  }

  resolveActiveEntryZone() {
    if (!this.player) {
      return null;
    }

    const currentZone = getLobbyZoneForPosition(this.player.x, this.player.y);

    if (!this.availableSpaceTypes.has(currentZone.id)) {
      return null;
    }

    const entry = getLobbyZoneEntry(currentZone.id);

    if (!entry) {
      return null;
    }

    const distanceToEntry = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      entry.x,
      entry.y
    );

    if (distanceToEntry > SPACE_ENTRY_DISTANCE) {
      return null;
    }

    return currentZone;
  }

  drawLobbyBackground() {
    const background = this.add.graphics();

    background.fillGradientStyle(0x10203a, 0x10203a, 0x0f172a, 0x0f172a, 1);
    background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    background.fillStyle(0x132238, 1);
    background.fillRoundedRect(60, 60, WORLD_WIDTH - 120, WORLD_HEIGHT - 120, 32);
    background.lineStyle(4, 0x38bdf8, 0.35);
    background.strokeRoundedRect(60, 60, WORLD_WIDTH - 120, WORLD_HEIGHT - 120, 32);

    LOBBY_ZONE_DEFINITIONS.forEach((zone) => {
      background.fillStyle(zone.fillColor, 1);
      background.fillRoundedRect(zone.x, zone.y, zone.width, zone.height, 28);
      background.lineStyle(3, zone.borderColor, 0.82);
      background.strokeRoundedRect(zone.x, zone.y, zone.width, zone.height, 28);

      this.add
        .text(zone.x + 24, zone.y + 24, zone.label, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '22px',
          color: Phaser.Display.Color.IntegerToColor(zone.accentColor).rgba,
        })
        .setDepth(1);

      this.add
        .text(zone.x + 24, zone.y + 60, zone.description, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '14px',
          color: '#cbd5e1',
          wordWrap: {
            width: zone.width - 48,
          },
        })
        .setDepth(1);

      if (!this.availableSpaceTypes.has(zone.id) || !zone.entry) {
        return;
      }

      const portalGlow = this.add.ellipse(zone.entry.x, zone.entry.y + 10, 188, 72, 0x020617, 0.38);
      const portalFrame = this.add
        .rectangle(
          zone.entry.x,
          zone.entry.y,
          zone.entry.width,
          zone.entry.height,
          zone.borderColor,
          0.18
        )
        .setStrokeStyle(3, zone.borderColor, 0.95);
      const portalDoor = this.add
        .rectangle(
          zone.entry.x,
          zone.entry.y - 4,
          zone.entry.width - 26,
          zone.entry.height - 20,
          0x0f172a,
          0.92
        )
        .setStrokeStyle(2, zone.accentColor, 0.82);

      this.add
        .text(zone.entry.x, zone.entry.y - 14, 'ENTER', {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '16px',
          color: Phaser.Display.Color.IntegerToColor(zone.accentColor).rgba,
        })
        .setOrigin(0.5)
        .setDepth(2);

      this.add
        .text(zone.entry.x, zone.entry.y + 10, zone.entry.label, {
          fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
          fontSize: '12px',
          color: '#cbd5e1',
        })
        .setOrigin(0.5)
        .setDepth(2);

      portalGlow.setDepth(1);
      portalFrame.setDepth(1);
      portalDoor.setDepth(1);
    });
  }
}
