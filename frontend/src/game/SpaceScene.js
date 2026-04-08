import Phaser from 'phaser';

import { getLobbyZoneDefinition } from '../lib/lobbyZones';

const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 840;
const PLAYER_SIZE = 34;
const PLAYER_SPEED = 250;
const WORLD_PADDING = 56;

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

export default class SpaceScene extends Phaser.Scene {
  constructor({
    playerLabel = '나',
    spaceType = 'MAIN',
    onPlayerMove,
    onSceneReady,
    onParticipantSelect,
  } = {}) {
    super(`SpaceScene-${spaceType}`);
    this.playerLabel = playerLabel;
    this.spaceType = spaceType;
    this.onPlayerMove = onPlayerMove;
    this.onSceneReady = onSceneReady;
    this.onParticipantSelect = onParticipantSelect;
    this.player = null;
    this.cursors = null;
    this.remotePlayers = new Map();
    this.theme = getSpaceTheme(spaceType);
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawSpaceBackground();

    this.player = this.createAvatar(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      this.playerLabel,
      0x38bdf8,
      0xe0f2fe
    );

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
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

    if (previousX !== this.player.x || previousY !== this.player.y) {
      this.onPlayerMove?.({
        x: this.player.x,
        y: this.player.y,
      });
    }
  }

  applyRemoteEvent(event) {
    if (!event?.type || !event.userId) {
      return;
    }

    if (event.type === 'user_enter') {
      this.addRemotePlayer(event.userId, event.x, event.y, event.label);
      return;
    }

    if (event.type === 'user_move') {
      if (!this.remotePlayers.has(event.userId)) {
        this.addRemotePlayer(event.userId, event.x, event.y, event.label);
        return;
      }

      this.updateRemotePlayerLabel(this.remotePlayers.get(event.userId)?.nameLabel, event.label);
      this.moveRemotePlayer(event.userId, event.x, event.y);
      return;
    }

    if (event.type === 'user_leave') {
      this.removeRemotePlayer(event.userId);
    }
  }

  addRemotePlayer(userId, x, y, label = '게스트') {
    const existingRemotePlayer = this.remotePlayers.get(userId);

    if (existingRemotePlayer) {
      this.updateRemotePlayerLabel(existingRemotePlayer.nameLabel, label);
      this.moveRemotePlayer(userId, x, y);
      return;
    }

    const position = this.resolveRemotePosition(userId, x, y);
    const remotePlayer = this.createAvatar(
      position.x,
      position.y,
      label,
      0x94a3b8,
      0xe2e8f0
    );
    remotePlayer.setInteractive(
      new Phaser.Geom.Rectangle(-30, -44, 60, 88),
      Phaser.Geom.Rectangle.Contains
    );
    remotePlayer.input.cursor = 'pointer';
    remotePlayer.on('pointerover', () => {
      remotePlayer.list[1]?.setStrokeStyle?.(4, this.theme.highlightColor, 1);
    });
    remotePlayer.on('pointerout', () => {
      remotePlayer.list[1]?.setStrokeStyle?.(3, 0xe2e8f0, 0.8);
    });
    remotePlayer.on('pointerdown', () => {
      const latestRemotePlayer = this.remotePlayers.get(userId);

      this.onParticipantSelect?.({
        userId,
        label: latestRemotePlayer?.nameLabel.text || label,
        x: latestRemotePlayer?.container.x ?? position.x,
        y: latestRemotePlayer?.container.y ?? position.y,
      });
    });

    this.remotePlayers.set(userId, {
      container: remotePlayer,
      nameLabel: remotePlayer.list[3],
    });
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
    remotePlayer.container.setPosition(position.x, position.y);
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

  createAvatar(x, y, label, bodyColor, outlineColor) {
    const avatar = this.add.container(x, y);
    const shadow = this.add.ellipse(0, 18, 34, 14, 0x020617, 0.22);
    const body = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, bodyColor);
    body.setStrokeStyle(3, outlineColor, 0.85);
    const head = this.add.circle(0, -26, 12, 0xf8fafc);
    const nameLabel = this.add
      .text(0, 34, label, {
        fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    avatar.add([shadow, body, head, nameLabel]);
    return avatar;
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
    background.fillRoundedRect(170, WORLD_HEIGHT - 300, WORLD_WIDTH - 340, 120, 28);
    background.fillRoundedRect(170, 340, 220, 180, 24);
    background.fillRoundedRect(WORLD_WIDTH - 390, 340, 220, 180, 24);

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
