import Phaser from 'phaser';

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const PLAYER_SIZE = 34;
const PLAYER_SPEED = 260;
const WORLD_PADDING = 40;

export default class LobbyScene extends Phaser.Scene {
  constructor({ playerLabel = 'You' } = {}) {
    super('LobbyScene');
    this.playerLabel = playerLabel;
    this.player = null;
    this.playerBody = null;
    this.playerName = null;
    this.cursors = null;
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

    // Keep a single local player for now; future realtime events can add/remove
    // remote players through dedicated scene methods without changing React.
  }
}
