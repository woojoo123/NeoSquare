import Phaser from 'phaser';

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const PLAYER_SIZE = 34;
const PLAYER_SPEED = 260;
const WORLD_PADDING = 40;

export default class LobbyScene extends Phaser.Scene {
  constructor({ playerLabel = 'You', onPlayerMove, onSceneReady } = {}) {
    super('LobbyScene');
    this.playerLabel = playerLabel;
    this.onPlayerMove = onPlayerMove;
    this.onSceneReady = onSceneReady;
    this.player = null;
    this.playerBody = null;
    this.playerName = null;
    this.cursors = null;
    this.remotePlayers = new Map();
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawLobbyBackground();

    this.player = this.add.container(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    const shadow = this.add.ellipse(0, 18, 34, 14, 0x020617, 0.28);
    this.playerBody = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, 0x38bdf8);
    this.playerBody.setStrokeStyle(3, 0xe0f2fe, 0.85);

    const playerHead = this.add.circle(0, -26, 12, 0xf8fafc);
    this.playerName = this.add
      .text(0, 34, this.playerLabel, {
        fontFamily: 'Arial, sans-serif',
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
      .text(28, 24, 'NeoSquare Lobby', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#f8fafc',
      })
      .setScrollFactor(0);

    this.add
      .text(28, 56, 'Use arrow keys to move around the lobby.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#cbd5e1',
      })
      .setScrollFactor(0);

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

  addRemotePlayer(userId, x, y, label = 'Guest') {
    const existingRemotePlayer = this.remotePlayers.get(userId);

    if (existingRemotePlayer) {
      this.updateRemotePlayerLabel(existingRemotePlayer.nameLabel, label);
      this.moveRemotePlayer(userId, x, y);
      return;
    }

    const position = this.resolveRemotePosition(userId, x, y);
    const remotePlayer = this.add.container(position.x, position.y);
    const shadow = this.add.ellipse(0, 18, 34, 14, 0x020617, 0.22);
    const body = this.add.rectangle(0, 0, PLAYER_SIZE, PLAYER_SIZE, 0x94a3b8);
    body.setStrokeStyle(3, 0xe2e8f0, 0.8);
    const head = this.add.circle(0, -26, 12, 0xf8fafc);
    const nameLabel = this.add
      .text(0, 34, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    remotePlayer.add([shadow, body, head, nameLabel]);
    this.remotePlayers.set(userId, {
      container: remotePlayer,
      nameLabel,
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
      x: 140 + ((seed * 137) % (WORLD_WIDTH - 280)),
      y: 140 + ((seed * 89) % (WORLD_HEIGHT - 280)),
    };
  }

  drawLobbyBackground() {
    const background = this.add.graphics();

    background.fillGradientStyle(0x10203a, 0x10203a, 0x0f172a, 0x0f172a, 1);
    background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    background.fillStyle(0x132238, 1);
    background.fillRoundedRect(60, 60, WORLD_WIDTH - 120, WORLD_HEIGHT - 120, 32);

    background.lineStyle(2, 0x1e3a5f, 0.8);

    for (let x = 120; x < WORLD_WIDTH - 120; x += 80) {
      background.lineBetween(x, 100, x, WORLD_HEIGHT - 100);
    }

    for (let y = 100; y < WORLD_HEIGHT - 100; y += 80) {
      background.lineBetween(100, y, WORLD_WIDTH - 100, y);
    }

    background.lineStyle(4, 0x38bdf8, 0.35);
    background.strokeRoundedRect(60, 60, WORLD_WIDTH - 120, WORLD_HEIGHT - 120, 32);

    // The local player still drives the scene for now.
    // Remote player add/move/remove methods are prepared for the next realtime step.
  }
}
