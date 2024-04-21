const config = {
  type: Phaser.AUTO, // AUTO versucht WebGL zu nutzen, wenn es nicht verfügbar ist, dann wird auf Canvas geschaltet
  width: 640, // 640px angepasst an das Handy, weil Doodle Jump ist ein mobile Game
  height: window.innerHeight, // Höhe des Browsers
  physics: {
    default: 'arcade', // Physik-Engine
    arcade: {
      gravity: { y: 300 },
      debug: false,
    },
  },
  scene: {
    // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Scenes.html
    // Sobald wir ein Objekt mit Funktionen in dem key "scene" übergeben, dann wird CreateSceneFromObjectConfig() intern aufgerufen, um eine Szene anhand des Objekts zu erstellen
    preload: preload,
    create: create,
    update: update,
  },
};

let player;
let platforms;
let aKey;
let dKey;
let spacebar;
let gameOverDistance = 0;
let enemies;
let gameOver = false;
let ball;
let scoreText;
let score = 0;
let jumpSpeed = -400;

const game = new Phaser.Game(config);

// Passt die Größe des Spiels an, sobald wir unser Browser "resizen"
window.addEventListener(
  'resize',
  function () {
    game.scale.resize(config.width, window.innerHeight);
  },
  false
);

// ============================================================
// ======================= PRELOAD ============================
// ============================================================

// preload() dient dazu Assets zu laden bevor das Spiel startet
// Bilder werden vom Ordner 'assets' geladen
function preload() {
  this.load.image('background_img', 'assets/background.png');
  this.load.image('playerSprite', 'assets/player.png');
  this.load.image('playerJumpSprite', 'assets/player_jump.png');
  this.load.image('platform', 'assets/game-tiles.png');
  this.load.image('enemy', 'assets/enemy_default.png');
  this.load.spritesheet('enemyAnims', 'assets/enemy.png', {
    frameWidth: 161,
    frameHeight: 95,
  });
  this.load.image('ball', 'assets/ball.png');
  this.load.image('playerShoot', 'assets/player_up.png');
}

// ================================================================
// ========================== CREATE ==============================
// ================================================================

// create() dient dazu die Elemente des Spiels zu erstellen/rendern
function create() {
  // 'background_img' Bild wird zum Spiel hinzugefügt/erstellt
  // Mit setOrigin(x, y) versetzten wir das Bild neu
  // setScrollFactor bestimmt wie stark ein Bild mit der Kamera scrollen soll
  this.add.image(0, 0, 'background_img').setOrigin(0, 0).setScrollFactor(0);

  scoreText = this.add
    .text(16, 16, 'Score: 0', {
      fontSize: '32px',
      fill: '#000000',
    })
    .setScrollFactor(0)
    .setDepth(5);

  // ====== ANIMATIONS =======

  // Sprunganimation erstellen, aber noch nicht abspielen
  this.anims.create({
    key: 'jump', // Name der Animation
    frames: [{ key: 'playerJumpSprite' }, { key: 'playerSprite' }],
    frameRate: 20,
    repeat: 0,
  });

  // Enemy Flug Animation
  this.anims.create({
    key: 'enemy_fly',
    frames: 'enemyAnims',
    frameRate: 10,
    repeat: -1, // -1 für Infinity
    yoyo: true, // Animation springt nicht mehr am Anfang sondern bewegt sich hin und her
  });

  // Schussanimation
  this.anims.create({
    key: 'shoot',
    frames: [{ key: 'playerShoot' }, { key: 'playerSprite' }],
    frameRate: 10,
    repeat: 0,
  });

  // ====== PHYSICS ======
  createPlayer(this.physics);
  createPlatforms(this.physics);
  createEnemies(this.physics);
  createBall(this.physics);

  // Fügen eine Kollision zwischen 'platforms' und 'player', sodass 'player' nicht mehr durch die Plattformen durchfällt
  this.physics.add.collider(player, platforms, (playerObj, platformObj) => {
    if (platformObj.body.touching.up && playerObj.body.touching.down) {
      player.anims.play('jump', true);
      player.setVelocityY(jumpSpeed);
    }
  });

  // Überprüfen ob die einzelnen Plattformen miteinander kollidieren
  this.physics.add.collider(platforms, platforms, (collidedPlatform) => {
    collidedPlatform.x = Phaser.Math.Between(0, 640);
    collidedPlatform.refreshBody();
  });

  // Berührt der Player einen Gegner, ist das Spiel vorbei
  this.physics.add.collider(player, enemies, (_, collidedEnemy) => {
    this.physics.pause();
    gameOver = true;
    collidedEnemy.anims.stop();
  });

  // Setzt den Gegner neu, wenn er eine Plattform berührt
  this.physics.add.collider(platforms, enemies, (collidedEnemy) => {
    collidedEnemy.x = Phaser.Math.Between(0, 640);
    collidedEnemy.refreshBody();
  });

  // Ball trifft einen Gegner
  this.physics.add.collider(enemies, ball, (enemy, ball) => {
    enemy.disableBody(true, true); // => disableBody(disableGameObject, hideGameObject)
    ball.disableBody(true, true); // => disableBody(disableGameObject, hideGameObject)
    score += 100;
    scoreText.setText('Score: ' + score);
  });

  // ====== CAMERA ======

  // Kamera hinzufügen mit this.cameras.main.startFollow(Game Object, Boolean um Pixels zu runden?, lerpX, lerpY)
  // lerpX und lerpY ist ein Wert zwischen 0 und 1 und bestimmt wie schnell die Kamera das Game Object verfolgt
  this.cameras.main.startFollow(player, false, 0, 1);

  // ====== KEYBOARD INPUT ======
  createKeys(this.input.keyboard);
}

// ===================================================================
// ============================ UPDATE ===============================
// ===================================================================

// update() wird 60x pro Sekunde aufgerufen und aktualisiert das Spiel
function update() {
  if (gameOver) {
    return;
  }

  checkMovement();
  refactorPlatforms();
  refactorEnemies();
  checkBall();
  checkShoot();
  updateScore();
  checkGameOver(this.physics);
}

// ============== CREATE HELPER FUNCTIONS ==============

// Erstellen das Player Object (Dynamischer Game Object)
function createPlayer(physics) {
  player = physics.add.sprite(325, -100, 'playerSprite');

  player.setBounce(0, 1); // Wir fügen den Bounce bei der Kollision ein
  player.setVelocityY(jumpSpeed); // Hier bestimmen wir die Geschwindigkeit des Springens/Bouncen
  player.body.setSize(64, 90); // Setzten die Größe des lila Kastens vom Player
  player.body.setOffset(32, 30); // Verschieben den lila Kasten um den Player
  player.setDepth(10); // Z-Index vom Player, bringt dem Player vor den Plattformen
}

// Erstellen die Plattformen
function createPlatforms(physics) {
  // Statische Gruppe
  // Erstellt eine Gruppe von Platformen, statt jede Plattform neu zu erstellen
  platforms = physics.add.staticGroup();

  // Einzelne Plattform erstellen aus unserer statische Gruppe (Game Object)
  platforms.create(Phaser.Math.Between(0, 640), -200, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -400, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -600, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -800, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -1000, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -1200, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -1400, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -1600, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -1800, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -2000, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -2200, 'platform');
  platforms.create(Phaser.Math.Between(0, 640), -2400, 'platform');

  // Kollision von links, rechts und unten werden für alle Plattformen ausgeschaltet
  platforms.children.iterate(function (platform) {
    platform.body.checkCollision.left = false;
    platform.body.checkCollision.right = false;
    platform.body.checkCollision.down = false;
  });
}

// Erstellen die Gegner
function createEnemies(physics) {
  // Dynamische Gruppe
  enemies = physics.add.group();

  enemies.create(
    Phaser.Math.Between(0, 640),
    Phaser.Math.Between(-950, -1300),
    'enemy'
  );

  enemies.children.iterate(function (enemy) {
    enemy.body.setSize(60, 60);
    enemy.body.setOffset(50, 10);
    enemy.body.setAllowGravity(false);
    enemy.anims.play('enemy_fly');
  });
}

// Erstellen die Schusskugel
function createBall(physics) {
  ball = physics.add.sprite(-50, 0, 'ball');
  ball.active = false;
  ball.body.setAllowGravity(false);
}

// Erstellen die Keyboard Keys
function createKeys(keyboard) {
  // addKey(key, enableCapture: Defaultverhalten von der Taste blockiert werden?, emitOnRepeat: Soll das Event weiter ausgeführt werden?)
  aKey = this.input.keyboard.addKey('A', true, true);

  dKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, true, true);

  spacebar = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, true, true);
}

// ============== UPDATE HELPER FUNCTIONS ==============

// Bewegung für den Player
function checkMovement() {
  if (aKey.isDown && !dKey.isDown) {
    player.setVelocityX(-300);
    player.flipX = true;

    if (player.x < 15) {
      player.x = 615;
    }
  }

  if (dKey.isDown && !aKey.isDown) {
    player.setVelocityX(300);
    player.flipX = false;

    if (player.x > 615) {
      player.x = 25;
    }
  }

  if (!aKey.isDown && !dKey.isDown) {
    player.setVelocityX(0);
  }
}

// Plattformen werden neu platziert
function refactorPlatforms() {
  let minY = 0;

  // Heir wird der Minimum Abstand zwischen zwei Plattformen angepasst
  platforms.children.iterate(function (platform) {
    if (platform.y < minY) {
      return (minY = platform.y);
    }
  });

  platforms.children.iterate(function (platform) {
    const playerToPlatformDist = player.body.center.distance(
      platform.body.center
    );

    // Überprüfen die Distanz zwischen player und platform
    if (platform.y > player.y && playerToPlatformDist > 700) {
      // Plattform neu platzieren
      platform.x = Phaser.Math.Between(0, 640);
      platform.y = minY - 200; // alte Zeile Code => platform.y - Phaser.Math.Between(1150, 1200);
      platform.refreshBody(); // Plattform soll neu geladen werden
    }
  });
}

// Gegner werden neu platziert
function refactorEnemies() {
  enemies.children.iterate(function (enemy) {
    const playerToEnemyDist = player.body.center.distance(enemy.body.center);

    // Überprüfen die Distanz zwischen player und enemy
    if (enemy.y > player.y && playerToEnemyDist > 700) {
      enemy.x = Phaser.Math.Between(0, 640);
      enemy.y = enemy.y - Phaser.Math.Between(1600, 2000); // Der Gegner wird 1600-2000px über seine jetztige Position platziert
      enemy.enableBody(true, enemy.x, enemy.y, true, true); // => enableBody(reset, x, y, enableGameObject, showGameObject)
    }
  });
}

// Hier wird überprüft ob die Schusskugel ('Ball') den Bildschirm verlassen
function checkBall() {
  if (ball.active && ball.startPosition - ball.y > config.height) {
    ball.disableBody(true, true); // => disableBody(disableGameObject, hideGameObject)
  }
}

// Kümmert sich um den Schuss des Balls
function checkShoot() {
  if (spacebar.isDown && !ball.active) {
    ball.x = player.x;
    ball.y = player.y - 45;

    player.anims.play('shoot');

    ball.enableBody(true, ball.x, ball.y, true, true);
    ball.startPosition = ball.y;
    ball.setVelocityY(-1000);
  }
}

// Erhöht den Score wenn der player sich nach oben bewegt
function updateScore() {
  if (player.y * -1 > score) {
    score += 10;
    scoreText.setText('Score: ' + score);
  }
}

// Game Over
function checkGameOver(physics) {
  // player.body.y === player.y
  if (player.y > gameOverDistance) {
    physics.pause();
    gameOver = true;
  } else if (player.y * -1 - gameOverDistance * -1 > 600) {
    // * -1 um eine positive Zahl zu erhalten, Ergebnis ist der Abstand zwischen player und gameOverDistance
    gameOverDistance = player.body.y + 600;
  }
}
