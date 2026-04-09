import Phaser from 'phaser';

import {
  LOBBY_ZONE_DEFINITIONS,
  getLobbyZoneCenter,
  getLobbyZoneDefinition,
  getLobbyZoneForPosition,
} from '../lib/lobbyZones';

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const PLAYER_SIZE = 34;
const PLAYER_SPEED = 260;
const WORLD_PADDING = 40;
const PLAYER_CONTEXT_THRESHOLD = 18;

export default class LobbyScene extends Phaser.Scene {
  constructor({
    playerLabel = '나',
    onPlayerMove,
    onSceneReady,
    onZoneChange,
    onPlayerContextChange,
    onRemotePlayerSelect,
  } = {}) {
    super('LobbyScene');
    this.playerLabel = playerLabel;
    this.onPlayerMove = onPlayerMove;
    this.onSceneReady = onSceneReady;
    this.onZoneChange = onZoneChange;
    this.onPlayerContextChange = onPlayerContextChange;
    this.onRemotePlayerSelect = onRemotePlayerSelect;
    this.player = null;
    this.playerBody = null;
    this.playerName = null;
    this.zoneHighlight = null;
    this.zoneStatusTitle = null;
    this.zoneStatusDescription = null;
    this.cursors = null;
    this.remotePlayers = new Map();
    this.currentZoneId = 'MAIN';
    this.lastReportedPosition = null;
    this.selectedRemoteUserId = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawLobbyBackground();
    this.zoneHighlight = this.add.graphics();

    const spawnPosition = getLobbyZoneCenter('MAIN');
    this.player = this.add.container(spawnPosition.x, spawnPosition.y);

    const shadow = this.add.ellipse(0, 18, 34, 14, 0x020617, 0.28);
    this.playerBody = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, 0x38bdf8);
    this.playerBody.setStrokeStyle(3, 0xe0f2fe, 0.85);

    const playerHead = this.add.circle(0, -26, 12, 0xf8fafc);
    this.playerName = this.add
      .text(0, 34, this.playerLabel, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    this.player.add([shadow, this.playerBody, playerHead, this.playerName]);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.add
      .text(28, 24, 'NeoSquare 로비', {
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

    if (previousX !== this.player.x || previousY !== this.player.y) {
      this.onPlayerMove?.({
        x: this.player.x,
        y: this.player.y,
      });
      this.emitPlayerContext();
    }
  }

  applyRemoteEvent(event) {
    if (!event?.type || !event.userId) {
      return;
    }

    const remoteUserId = String(event.userId);

    if (event.type === 'user_enter') {
      this.addRemotePlayer(remoteUserId, event.x, event.y, event.label);
      return;
    }

    if (event.type === 'user_move') {
      if (!this.remotePlayers.has(remoteUserId)) {
        this.addRemotePlayer(remoteUserId, event.x, event.y, event.label);
        return;
      }

      this.updateRemotePlayerLabel(this.remotePlayers.get(remoteUserId)?.nameLabel, event.label);
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
        this.emitPlayerContext(true);
      },
    });
  }

  addRemotePlayer(userId, x, y, label = '게스트') {
    const remoteKey = String(userId);
    const existingRemotePlayer = this.remotePlayers.get(remoteKey);

    if (existingRemotePlayer) {
      this.updateRemotePlayerLabel(existingRemotePlayer.nameLabel, label);
      this.moveRemotePlayer(remoteKey, x, y);
      return;
    }

    const position = this.resolveRemotePosition(remoteKey, x, y);
    const remotePlayer = this.add.container(position.x, position.y);
    const shadow = this.add.ellipse(0, 18, 34, 14, 0x020617, 0.22);
    const body = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, 0x94a3b8);
    body.setStrokeStyle(3, 0xe2e8f0, 0.8);
    body.setData('remoteUserId', remoteKey);
    body.setInteractive({ useHandCursor: true });
    const head = this.add.circle(0, -26, 12, 0xf8fafc);
    const nameLabel = this.add
      .text(0, 34, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    remotePlayer.add([shadow, body, head, nameLabel]);
    this.remotePlayers.set(remoteKey, {
      container: remotePlayer,
      body,
      nameLabel,
    });

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
    remotePlayer.container.setPosition(position.x, position.y);
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

    if (!remotePlayer?.body) {
      return;
    }

    const isSelected = String(this.selectedRemoteUserId) === String(userId);
    remotePlayer.body.setFillStyle(isSelected ? 0x60a5fa : 0x94a3b8);
    remotePlayer.body.setStrokeStyle(isSelected ? 4 : 3, isSelected ? 0xfef3c7 : 0xe2e8f0, 0.9);
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
    });
  }
}
