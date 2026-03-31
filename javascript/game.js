const loadingGif = document.querySelectorAll('.loading-gif');

const mobileDevice = isMobileDevice();

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight * 1.1;

const velocityX = screenWidth / 4.5;
const velocityY = screenHeight / 1.15;

const levelGravity = velocityY * 2;

var config = {
    type: Phaser.AUTO,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 0x8585FF,
    parent: 'game',
    preserveDrawingBuffer: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: levelGravity },
            debug: false
        }
    },
    scene: {
        key: 'level-1',
        preload: preload,
        create: create,
        update: update
    },
    version: '0.7.3'
};

const worldWidth = screenWidth * 11;
const platformHeight = screenHeight / 5;

const startOffset = screenWidth / 2.5;

// Hole with is calculated dividing the world width in x holes of the same size.
const platformPieces = 100;
const platformPiecesWidth = (worldWidth - screenWidth) / platformPieces;

var isLevelOverworld;

// Create empty holes array, every hole will have their object with the hole start and end
var worldHolesCoords = [];

var emptyBlocksList = [];

var player;
var playerController;
var playerState = 0;
var playerInvulnerable = false;
var playerBlocked = false;
var playerFiring = false;
var fireInCooldown = false;
var furthestPlayerPos = 0;

var flagRaised = false;

var controlKeys = {
    JUMP: null,
    DOWN: null,
    LEFT: null,
    RIGHT: null,
    FIRE: null,
    PAUSE: null
};

var score = 0;
var timeLeft = 300;

var levelStarted = false;
var reachedLevelEnd = false;

var smoothedControls;
var gameOver = false;
var gameWinned = false;

var game = new Phaser.Game(config);

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

var SmoothedHorionztalControl = new Phaser.Class({
    initialize:
    function SmoothedHorionztalControl(speed) {
            this.msSpeed = speed;
            this.value = 0;
    },

    moveLeft: function(delta) {
        if (this.value > 0) { this.reset(); }
        this.value -= this.msSpeed * 3.5;
        if (this.value < -1) { this.value = -1; }
        playerController.time.rightDown += delta;
    },

    moveRight: function(delta) {
        if (this.value < 0) { this.reset(); }
        this.value += this.msSpeed * 3.5;
        if (this.value > 1) { this.value = 1; }
        playerController.time.leftDown += delta;
    },

    reset: function() {
        this.value = 0;
    }
});

function preload() {
    var progressBox = this.add.graphics();
    var progressBar = this.add.graphics();
    progressBox.fillStyle(0x222222, 1);
    progressBox.fillRoundedRect(screenWidth / 2.48, screenHeight / 2 * 1.05, screenWidth / 5.3, screenHeight / 20.7, 10);
    
    var width = this.cameras.main.width;
    var height = this.cameras.main.height;
    
    var percentText = this.make.text({
        x: width / 2,
        y: height / 2 * 1.25,
        text: '0%',
        style: {
            font: screenWidth / 96 + 'px pixel_nums',
            fill: '#ffffff'
        }
    });
    percentText.setOrigin(0.5, 0.5);
    
    this.load.on('progress', function (value) {
        percentText.setText(value * 99 >= 99 ? 'Generating world...' : 'Loading... ' + parseInt(value * 99) + '%');
        progressBar.clear();
        progressBar.fillStyle(0xffffff, 1);
        progressBar.fillRoundedRect(screenWidth / 2.45, screenHeight / 2 * 1.07, screenWidth / 5.6 * value, screenHeight / 34.5, 5);
    });
    
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        percentText.destroy();
        loadingGif.forEach(gif => {gif.style.display = 'none';});
    });

    // Load Fonts
    this.load.bitmapFont('carrier_command', 'assets/fonts/carrier_command.png', 'assets/fonts/carrier_command.xml');

    // Load plugins
    this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
    this.load.plugin('rexcheckboxplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexcheckboxplugin.min.js', true);
    this.load.plugin('rexsliderplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexsliderplugin.min.js', true);
    this.load.plugin('rexkawaseblurpipelineplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexkawaseblurpipelineplugin.min.js', true);

    isLevelOverworld = Phaser.Math.Between(0, 100) <= 84;
    let levelStyle = isLevelOverworld ? 'overworld' : 'underground';

    // Load entities sprites
    this.load.spritesheet('mario', 'assets/entities/mario.png', { frameWidth: 18, frameHeight: 16 });
    this.load.spritesheet('mario-grown', 'assets/entities/mario-grown.png', { frameWidth: 18, frameHeight: 32 });
    this.load.spritesheet('mario-fire', 'assets/entities/mario-fire.png', { frameWidth: 18, frameHeight: 32 });
    this.load.spritesheet('goomba', 'assets/entities/' + levelStyle + '/goomba.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('koopa', 'assets/entities/koopa.png', { frameWidth: 16, frameHeight: 24 });
    this.load.spritesheet('shell', 'assets/entities/shell.png', { frameWidth: 16, frameHeight: 15 });

    // Load objects sprites
    this.load.spritesheet('fireball', 'assets/entities/fireball.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('fireball-explosion', 'assets/entities/fireball-explosion.png', { frameWidth: 16, frameHeight: 16 });

    // Load props
    this.load.image('cloud1', 'assets/scenery/overworld/cloud1.png');
    this.load.image('cloud2', 'assets/scenery/overworld/cloud2.png');
    this.load.image('mountain1', 'assets/scenery/overworld/mountain1.png');
    this.load.image('mountain2', 'assets/scenery/overworld/mountain2.png');
    this.load.image('fence', 'assets/scenery/overworld/fence.png');
    this.load.image('bush1', 'assets/scenery/overworld/bush1.png');
    this.load.image('bush2', 'assets/scenery/overworld/bush2.png');
    this.load.image('castle', 'assets/scenery/castle.png');
    this.load.image('flag-mast', 'assets/scenery/flag-mast.png');
    this.load.image('final-flag', 'assets/scenery/final-flag.png');
    this.load.image('sign', 'assets/scenery/sign.png');

    // Load tubes
    this.load.image('horizontal-tube', 'assets/scenery/horizontal-tube.png');
    this.load.image('horizontal-final-tube', 'assets/scenery/horizontal-final-tube.png');
    this.load.image('vertical-extralarge-tube', 'assets/scenery/vertical-large-tube.png');
    this.load.image('vertical-small-tube', 'assets/scenery/vertical-small-tube.png');
    this.load.image('vertical-medium-tube', 'assets/scenery/vertical-medium-tube.png');
    this.load.image('vertical-large-tube', 'assets/scenery/vertical-large-tube.png');
    
    // Load HUD images
    this.load.image('gear', 'assets/hud/gear.png');
    this.load.image('settings-bubble', 'assets/hud/settings-bubble.png');
    this.load.spritesheet('npc', 'assets/hud/npc.png', { frameWidth: 16, frameHeight: 24 });

    // Load platform bricks and structures
    this.load.image('floorbricks', 'assets/scenery/' + levelStyle + '/floorbricks.png');
    this.load.image('start-floorbricks', 'assets/scenery/overworld/floorbricks.png');
    this.load.image('block', 'assets/blocks/' + levelStyle + '/block.png');
    this.load.image('block2', 'assets/blocks/underground/block2.png');
    this.load.image('emptyBlock', 'assets/blocks/' + levelStyle + '/emptyBlock.png');
    this.load.image('immovableBlock', 'assets/blocks/' + levelStyle + '/immovableBlock.png');
    this.load.spritesheet('brick-debris', 'assets/blocks/' + levelStyle + '/brick-debris.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('mistery-block', 'assets/blocks/' + levelStyle + '/misteryBlock.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('custom-block', 'assets/blocks/overworld/customBlock.png', { frameWidth: 16, frameHeight: 16 });

    // Load collectibles
    this.load.spritesheet('coin', 'assets/collectibles/coin.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('ground-coin', 'assets/collectibles/underground/ground-coin.png', { frameWidth: 10, frameHeight: 14 });
    this.load.spritesheet('fire-flower', 'assets/collectibles/' + levelStyle + '/fire-flower.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('live-mushroom', 'assets/collectibles/live-mushroom.png');
    this.load.image('super-mushroom', 'assets/collectibles/super-mushroom.png');

    // Load sounds and music
    this.load.audio('music', 'assets/sound/music/overworld/theme.mp3');
    this.load.audio('underground-music', 'assets/sound/music/underground/theme.mp3');
    this.load.audio('hurry-up-music', 'assets/sound/music/' + levelStyle +'/hurry-up-theme.mp3');
    this.load.audio('gameoversong', 'assets/sound/music/gameover.mp3');
    this.load.audio('win', 'assets/sound/music/win.wav');
    this.load.audio('jumpsound', 'assets/sound/effects/jump.mp3');
    this.load.audio('coin', 'assets/sound/effects/coin.mp3');
    this.load.audio('powerup-appears', 'assets/sound/effects/powerup-appears.mp3');
    this.load.audio('consume-powerup', 'assets/sound/effects/consume-powerup.mp3');
    this.load.audio('powerdown', 'assets/sound/effects/powerdown.mp3');
    this.load.audio('goomba-stomp', 'assets/sound/effects/goomba-stomp.wav');
    this.load.audio('flagpole', 'assets/sound/effects/flagpole.mp3');
    this.load.audio('fireball', 'assets/sound/effects/fireball.mp3');
    this.load.audio('kick', 'assets/sound/effects/kick.mp3');
    this.load.audio('time-warning', 'assets/sound/effects/time-warning.mp3');
    this.load.audio('here-we-go', Phaser.Math.Between(0, 100) < 98 ? 'assets/sound/effects/here-we-go.mp3' : 'assets/sound/effects/cursed-here-we-go.mp3');
    this.load.audio('pauseSound', 'assets/sound/effects/pause.wav');
    this.load.audio('block-bump', 'assets/sound/effects/block-bump.wav');
    this.load.audio('break-block', 'assets/sound/effects/break-block.wav');
}

function initSounds() {
    this.musicGroup = this.add.group();
    this.effectsGroup = this.add.group();

    this.musicTheme = this.sound.add('music', { volume: 0.15 });
    this.musicTheme.play({ loop: -1 });
    this.musicGroup.add(this.musicTheme);

    this.undergroundMusicTheme = this.sound.add('underground-music', { volume: 0.15 });
    this.musicGroup.add(this.undergroundMusicTheme);

    this.hurryMusicTheme = this.sound.add('hurry-up-music', { volume: 0.15 });
    this.musicGroup.add(this.hurryMusicTheme);

    this.gameOverSong = this.sound.add('gameoversong', { volume: 0.3 });
    this.musicGroup.add(this.gameOverSong);
        
    this.winSound = this.sound.add('win', { volume: 0.3 });
    this.musicGroup.add(this.winSound);

    this.jumpSound = this.sound.add('jumpsound', { volume: 0.10 });
    this.effectsGroup.add(this.jumpSound);

    this.coinSound = this.sound.add('coin', { volume: 0.2 });
    this.effectsGroup.add(this.coinSound);

    this.powerUpAppearsSound = this.sound.add('powerup-appears', { volume: 0.2 });
    this.effectsGroup.add(this.powerUpAppearsSound);

    this.consumePowerUpSound = this.sound.add('consume-powerup', { volume: 0.2 });
    this.effectsGroup.add(this.consumePowerUpSound);

    this.powerDownSound = this.sound.add('powerdown', { volume: 0.3 });
    this.effectsGroup.add(this.powerDownSound);

    this.goombaStompSound = this.sound.add('goomba-stomp', { volume: 1 });
    this.effectsGroup.add(this.goombaStompSound);

    this.flagPoleSound = this.sound.add('flagpole', { volume: 0.3 });
    this.effectsGroup.add(this.flagPoleSound);

    this.fireballSound = this.sound.add('fireball', { volume: 0.3 });
    this.effectsGroup.add(this.fireballSound);

    this.kickSound = this.sound.add('kick', { volume: 0.3 });
    this.effectsGroup.add(this.kickSound);

    this.timeWarningSound = this.sound.add('time-warning', { volume: 0.2 });
    this.effectsGroup.add(this.timeWarningSound);

    this.hereWeGoSound = this.sound.add('here-we-go', { volume: 0.17 });
    this.effectsGroup.add(this.hereWeGoSound);

    this.pauseSound = this.sound.add('pauseSound', { volume: 0.17 });
    this.effectsGroup.add(this.pauseSound);

    this.blockBumpSound = this.sound.add('block-bump', { volume: 0.3 });
    this.effectsGroup.add(this.blockBumpSound);

    this.breakBlockSound = this.sound.add('break-block', { volume: 0.5 });
    this.effectsGroup.add(this.breakBlockSound);
}

// ==========================================
// 重構：強制跳過開始畫面，直接啟動跑酷模式
// ==========================================
function create() {
    playerController = {
        time: { leftDown: 0, rightDown: 0 },
        direction: { positive: true },
        speed: { run: velocityX }
    };

    // 1. 縮小世界邊界，直接從真正的關卡起點開始
    this.physics.world.setBounds(screenWidth, 0, worldWidth, screenHeight);

    // 2. 攝影機直接對準起點，不從 0 開始
    this.cameras.main.setBounds(screenWidth, 0, worldWidth, screenHeight);
    this.cameras.main.isFollowing = false;
    this.cameras.main.scrollX = screenWidth; 

    initSounds.call(this);
    createAnimations.call(this);
    createPlayer.call(this);

    // 3. 將瑪利歐直接傳送到真正的起跑線 (跳過展示間)
    player.x = screenWidth * 1.1;

    generateLevel.call(this);
    drawWorld.call(this);
    
    // 4. 徹底刪除展示間 (註解掉 drawStartScreen)
    // drawStartScreen.call(this); 

    createGoombas.call(this);
    createControls.call(this);
    applySettings.call(this);
    
    smoothedControls = new SmoothedHorionztalControl(0.001);

    // 5. 強制觸發關卡開始狀態，解鎖攝影機與瑪利歐
    createHUD.call(this);       // 補上儀表板 UI
    updateTimer.call(this);     // 補上倒數計時器
    
    levelStarted = true;
    playerBlocked = false;
    
    // 播放經典的 Here We Go 語音
    this.hereWeGoSound.play(); 

    // 修正地下關卡的音樂邏輯
    if (!isLevelOverworld) {
        this.musicTheme.stop();
        this.undergroundMusicTheme.play({ loop: -1 });
    }
}

function createControls() {
    this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
        x: screenWidth * 0.118,
        y: screenHeight / 1.68,
        radius: mobileDevice ? 100 : 0,
        base: this.add.circle(0, 0, mobileDevice ? 75 : 0, 0x0000000, 0.05),
        thumb: this.add.circle(0, 0, mobileDevice ? 25 : 0, 0xcccccc, 0.2),
    });

    const keyNames = ['JUMP', 'DOWN', 'LEFT', 'RIGHT', 'FIRE', 'PAUSE'];
    const defaultCodes = [Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.D, Phaser.Input.Keyboard.KeyCodes.Q, Phaser.Input.Keyboard.KeyCodes.ESC];
    
    keyNames.forEach((keyName, i) => {
      const keyCode = localStorage.getItem(keyName) ? Number(localStorage.getItem(keyName)) : defaultCodes[i];
      controlKeys[keyName] = this.input.keyboard.addKey(keyCode);
    });
}


function generateRandomCoordinate(entitie = false, ground = true) {
    const startPos = entitie ? screenWidth * 1.5 : screenWidth;
    const endPos = entitie ? worldWidth - screenWidth * 3 : worldWidth;
  
    let coordinate = Phaser.Math.Between(startPos, endPos);
  
    if (!ground) return coordinate;
  
    for (let hole of worldHolesCoords) {
      if (coordinate >= hole.start - platformPiecesWidth * 1.5 && coordinate <= hole.end) {
        return generateRandomCoordinate.call(this, entitie, ground);
      }
    }
  
    return coordinate;
  }
  
// World generation
function drawWorld() {
    this.add.rectangle(screenWidth, 0,worldWidth, screenHeight, isLevelOverworld ? 0x8585FF : 0x000000).setOrigin(0).depth = -1;

    let propsY = screenHeight - platformHeight;

    if (isLevelOverworld) {
        for (i = 0; i < Phaser.Math.Between(Math.trunc(worldWidth / 760), Math.trunc(worldWidth / 380)); i++) {
            let x = generateRandomCoordinate(false, false);
            let y = Phaser.Math.Between(screenHeight / 80, screenHeight / 2.2);
            if (Phaser.Math.Between(0, 10) < 5) {
                this.add.image(x, y, 'cloud1').setOrigin(0).setScale(screenHeight / 1725);
            } else {
                this.add.image(x, y, 'cloud2').setOrigin(0).setScale(screenHeight / 1725);
            }
        }

        for (i = 0; i < Phaser.Math.Between(worldWidth / 6400, worldWidth / 3800); i++) {
            let x = generateRandomCoordinate();

            if (Phaser.Math.Between(0, 10) < 5) {
                this.add.image(x, propsY, 'mountain1').setOrigin(0, 1).setScale(screenHeight / 517);
            } else {
                this.add.image(x, propsY, 'mountain2').setOrigin(0, 1).setScale(screenHeight / 517);
            }
        }
        
        for (i = 0; i < Phaser.Math.Between(Math.trunc(worldWidth / 960), Math.trunc(worldWidth / 760)); i++) {
            let x = generateRandomCoordinate();

            if (Phaser.Math.Between(0, 10) < 5) {
                this.add.image(x, propsY, 'bush1').setOrigin(0, 1).setScale(screenHeight / 609);
            } else {
                this.add.image(x, propsY, 'bush2').setOrigin(0, 1).setScale(screenHeight / 609);
            }
        }

        for (i = 0; i < Phaser.Math.Between(Math.trunc(worldWidth / 4000), Math.trunc(worldWidth / 2000)); i++) {
            let x = generateRandomCoordinate();

            this.add.tileSprite(x, propsY, Phaser.Math.Between(100, 250), 35, 'fence').setOrigin(0, 1).setScale(screenHeight / 863);
        }
    }

    this.finalFlagMast = this.add.tileSprite(worldWidth - (worldWidth / 30), propsY, 16, 167, 'flag-mast').setOrigin(0, 1).setScale(screenHeight / 400);
    this.physics.add.existing(this.finalFlagMast);
    this.finalFlagMast.immovable = true;
    this.finalFlagMast.allowGravity = false;
    this.finalFlagMast.body.setSize(3, 167);
    this.physics.add.overlap(player, this.finalFlagMast, null, raiseFlag, this);
    this.physics.add.collider(this.platformGroup.getChildren(), this.finalFlagMast);

    this.finalFlag = this.add.image(worldWidth - (worldWidth / 30), propsY * 0.93, 'final-flag').setOrigin(0.5, 1);
    this.finalFlag.setScale(screenHeight / 400);

    this.add.image(worldWidth - (worldWidth / 75), propsY, 'castle').setOrigin(0.5, 1).setScale(screenHeight / 300);
}

function generateLevel() {
    let pieceStart = screenWidth;
    let lastWasHole = 0;
    let lastWasStructure = 0;

    this.platformGroup = this.add.group();
    this.fallProtectionGroup = this.add.group();
    this.blocksGroup = this.add.group();
    this.constructionBlocksGroup = this.add.group();
    this.misteryBlocksGroup = this.add.group();
    this.immovableBlocksGroup = this.add.group();
    this.groundCoinsGroup = this.add.group();

    if (!isLevelOverworld) {
        this.blocksGroup.add(this.add.tileSprite(screenWidth, screenHeight - platformHeight / 1.2, 16, screenHeight - platformHeight, 'block2').setScale(screenHeight / 345).setOrigin(0, 1));
        this.undergroundRoof = this.add.tileSprite(screenWidth * 1.2, screenHeight / 13, worldWidth / 2.68, 16, 'block2').setScale(screenHeight / 345).setOrigin(0);
        this.blocksGroup.add(this.undergroundRoof);
    }

    for (i=0; i <= platformPieces; i++) {
        let number = Phaser.Math.Between(0, 100);

        if (pieceStart >= (lastWasHole > 0 || lastWasStructure > 0 || worldWidth - platformPiecesWidth * 4) || number <= 0 || pieceStart <= screenWidth * 2 || pieceStart >= worldWidth - screenWidth * 2) {
            lastWasHole--;

            let Npiece = this.add.tileSprite(pieceStart, screenHeight, platformPiecesWidth, platformHeight, 'floorbricks').setScale(2).setOrigin(0, 0.5);
            this.physics.add.existing(Npiece);
            Npiece.body.immovable = true;
            Npiece.body.allowGravity = false;
            Npiece.isPlatform = true;
            Npiece.depth = 2;
            this.platformGroup.add(Npiece);
            this.physics.add.collider(player, Npiece);

            if (!(pieceStart >= (worldWidth - screenWidth * (isLevelOverworld ? 1 : 1.5))) && pieceStart > (screenWidth + platformPiecesWidth * 2) && lastWasHole < 1 && lastWasStructure < 1) {
                lastWasStructure = generateStructure.call(this, pieceStart);
            }
            else {
                lastWasStructure--;
            }
        } else {
            worldHolesCoords.push({ start: pieceStart, end: pieceStart + platformPiecesWidth * 2});
            lastWasHole = 2;
            this.fallProtectionGroup.add(this.add.rectangle(pieceStart + platformPiecesWidth * 2, screenHeight - platformHeight, 5, 5).setOrigin(0, 1));
            this.fallProtectionGroup.add(this.add.rectangle(pieceStart, screenHeight - platformHeight, 5, 5).setOrigin(1, 1));
        }
        pieceStart += platformPiecesWidth * 2;
    }

    this.startScreenTrigger = this.add.tileSprite(screenWidth, screenHeight - platformHeight, 32, 28, 'horizontal-tube').setScale(screenHeight / 345).setOrigin(1, 1);
    this.startScreenTrigger.depth = 4;
    this.physics.add.existing(this.startScreenTrigger);
    this.startScreenTrigger.body.allowGravity = false;
    this.startScreenTrigger.body.immovable = true;
    this.physics.add.collider(player, this.startScreenTrigger, startLevel, null, this);

    let invisibleWall2 = this.add.rectangle(screenWidth, screenHeight - platformHeight, 1, screenHeight).setOrigin(0.5, 1);
    this.physics.add.existing(invisibleWall2);
    invisibleWall2.body.allowGravity = false;
    invisibleWall2.body.immovable = true;
    this.physics.add.collider(player, invisibleWall2);
    this.fallProtectionGroup.add(invisibleWall2);

    if (!isLevelOverworld) {
        this.verticalTube = this.add.tileSprite(worldWidth - screenWidth, screenHeight - platformHeight, 32, screenHeight, 'vertical-extralarge-tube').setScale(screenHeight / 345).setOrigin(1, 1);
        this.verticalTube.depth = 2;
        this.physics.add.existing(this.verticalTube);
        this.verticalTube.body.allowGravity = false;
        this.verticalTube.body.immovable = true;
        this.physics.add.collider(player, this.verticalTube);

        this.finalTrigger = this.add.tileSprite(worldWidth - screenWidth * 1.03, screenHeight - platformHeight, 40, 31, 'horizontal-final-tube').setScale(screenHeight / 345).setOrigin(1, 1);
        this.finalTrigger.depth = 2;
        this.physics.add.existing(this.finalTrigger);
        this.finalTrigger.body.allowGravity = false;
        this.finalTrigger.body.immovable = true;
        this.physics.add.collider(player, this.finalTrigger, teleportToLevelEnd, null, this);

        let invisibleWall1 = this.add.rectangle(worldWidth - screenWidth, screenHeight - platformHeight, 1, screenHeight).setOrigin(0.5, 1);
        this.physics.add.existing(invisibleWall1);
        invisibleWall1.body.allowGravity = false;
        invisibleWall1.body.immovable = true;
        this.physics.add.collider(player, invisibleWall1);
        this.fallProtectionGroup.add(invisibleWall1);
    }

    let fallProtections = this.fallProtectionGroup.getChildren();
    for (let i = 0; i < fallProtections.length; i++) {
        this.physics.add.existing(fallProtections[i]);
        fallProtections[i].body.allowGravity = false;
        fallProtections[i].body.immovable = true;
    }

    let misteryBlocks = this.misteryBlocksGroup.getChildren();
    for (let i = 0; i < misteryBlocks.length; i++) {
        this.physics.add.existing(misteryBlocks[i]);
        misteryBlocks[i].body.allowGravity = false;
        misteryBlocks[i].body.immovable = true;
        misteryBlocks[i].depth = 2;
        misteryBlocks[i].anims.play('mistery-block-default', true);
        this.physics.add.collider(player, misteryBlocks[i], revealHiddenBlock, null, this);
    }
    
    let blocks = this.blocksGroup.getChildren();
    for (let i = 0; i < blocks.length; i++) {
        this.physics.add.existing(blocks[i]);
        blocks[i].body.allowGravity = false;
        blocks[i].body.immovable = true;
        blocks[i].depth = 2;
        this.physics.add.collider(player, blocks[i], destroyBlock, null, this);
    }

    let constructionBlocks = this.constructionBlocksGroup.getChildren();
    for (let i = 0; i < constructionBlocks.length; i++) {
        this.physics.add.existing(constructionBlocks[i]);
        constructionBlocks[i].isImmovable = true;
        constructionBlocks[i].body.allowGravity = false;
        constructionBlocks[i].body.immovable = true;
        constructionBlocks[i].depth = 2;
        this.physics.add.collider(player, constructionBlocks[i], destroyBlock, null, this);
    }

    let immovableBlocks = this.immovableBlocksGroup.getChildren();
    for (let i = 0; i < immovableBlocks.length; i++) {
        this.physics.add.existing(immovableBlocks[i]);
        immovableBlocks[i].body.allowGravity = false;
        immovableBlocks[i].body.immovable = true;
        immovableBlocks[i].depth = 2;
        this.physics.add.collider(player, immovableBlocks[i]);
    }

    let groundCoins = this.groundCoinsGroup.getChildren();
    for (let i = 0; i < groundCoins.length; i++) {
        this.physics.add.existing(groundCoins[i]);
        groundCoins[i].anims.play('ground-coin-default', true);
        groundCoins[i].body.allowGravity = false;
        groundCoins[i].body.immovable = true;
        groundCoins[i].depth = 2;
        this.physics.add.overlap(player, groundCoins[i], collectCoin, null, this);
    }
}

function startLevel(player, trigger) {
    if (!player.body.blocked.right && !trigger.body.blocked.left) return;
    this.powerDownSound.play();
    this.physics.world.setBounds(screenWidth, 0, worldWidth, screenHeight);
    applyPlayerInvulnerability.call(this, 4000);
    playerBlocked = true;
    player.setVelocityX(5);
    player.anims.play('run', true).flipX = false;
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.hereWeGoSound.play();

    setTimeout(() => {
        if (!isLevelOverworld) {
            player.y = screenHeight / 5;
            this.musicTheme.stop();
            this.undergroundMusicTheme.play({ loop: -1 });
        }
        player.x = screenWidth * 1.1;
        this.cameras.main.pan(screenWidth * 1.5, 0, 0);
        playerBlocked = false;
        this.cameras.main.fadeIn(500, 0, 0, 0);
        createHUD.call(this);
        updateTimer.call(this);
        this.startScreenTrigger.destroy();
        levelStarted = true;
        if (this.settingsMenuOpen)hideSettings.call(this);
    }, 1100);
}

function teleportToLevelEnd(player, trigger) {
    if (!player.body.blocked.right && !trigger.body.blocked.left) return;
    playerBlocked = true;
    this.cameras.main.stopFollow();
    this.powerDownSound.play();
    this.tweens.add({ targets: player, duration: 75, alpha: 0 });
    this.cameras.main.fadeOut(450, 0, 0, 0);
    player.anims.play(playerState > 0 ? playerState == 1 ? 'grown-mario-run'  : 'fire-mario-run' : 'run', true).flipX = false;
    this.undergroundRoof.destroy();

    setTimeout(() => {
        this.physics.world.setBounds(worldWidth - screenWidth, 0, worldWidth, screenHeight);
        this.tpTube = this.add.tileSprite(worldWidth - screenWidth / 1.089, screenHeight - platformHeight, 32, 32, 'vertical-medium-tube').setScale(screenHeight / 345).setOrigin(1);
        this.tpTube.depth = 4;
        this.physics.add.existing(this.tpTube);
        this.tpTube.body.allowGravity = false;
        this.tpTube.body.immovable = true;
        this.physics.add.collider(player, this.tpTube);
        this.add.rectangle(worldWidth - screenWidth, 0, worldWidth, screenHeight,0x8585FF).setOrigin(0).depth = -1;
        this.add.tileSprite(worldWidth - screenWidth, screenHeight, screenWidth, platformHeight, 'start-floorbricks').setScale(2).setOrigin(0, 0.5).depth = 2;
    }, 500);

    setTimeout(() => {
        player.alpha = 1;
        player.x = worldWidth - screenWidth / 1.08;
        this.cameras.main.pan(worldWidth - screenWidth / 2, 0, 0);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.powerDownSound.play();
        this.finalTrigger.destroy();
        this.tweens.add({ targets: player, duration: 500, y: this.tpTube.getBounds().y });
        setTimeout(() => { playerBlocked = false; }, 500);
    }, 1100);
}

// 已經不用的展示間，但保留函式宣告以免其他地方報錯
function drawStartScreen() { }

function raiseFlag() {
    if (flagRaised) return false;
    this.cameras.main.stopFollow();
    this.timeLeftText.stopped = true;
    this.musicTheme.stop();
    this.undergroundMusicTheme.stop();
    this.hurryMusicTheme.stop();
    this.flagPoleSound.play();

    this.tweens.add({ targets: this.finalFlag, duration: 1000, y: screenHeight / 2.2 });
    setTimeout(() => { this.winSound.play(); }, 1000);
    flagRaised = true;
    playerBlocked = true;
    addToScore.call(this, 2000, player);
    return false;
}

function consumeMushroom(player, mushroom) {
    if (gameOver || gameWinned) return;
    this.consumePowerUpSound.play();
    addToScore.call(this, 1000, mushroom);
    mushroom.destroy();

    if (playerState > 0 ) return;

    playerBlocked = true;
    this.anims.pauseAll();
    this.physics.pause();
    player.setTint(0xfefefe).anims.play('grown-mario-idle');
    let i = 0;
    let interval = setInterval(() => {
        i++;
        player.anims.play(i % 2 === 0 ? 'grown-mario-idle' : 'idle');
        if (i > 5) {
            clearInterval(interval);
            player.clearTint();
        }
    }, 100);

    setTimeout(() => { 
        this.physics.resume();
        this.anims.resumeAll();
        playerBlocked = false;
        playerState = 1;
        updateTimer.call(this);
    }, 1000);
}

function consumeFireflower(player, fireFlower) {
    if (gameOver || gameWinned) return;
    this.consumePowerUpSound.play();
    addToScore.call(this, 1000, fireFlower);
    fireFlower.destroy();

    if (playerState > 1 ) return;

    let anim = playerState > 0 ? 'grown-mario-idle' : 'idle';
    playerBlocked = true;
    this.anims.pauseAll();
    this.physics.pause();
    player.setTint(0xfefefe).anims.play('fire-mario-idle');
    let i = 0;
    let interval = setInterval(() => {
        i++;
        player.anims.play(i % 2 === 0 ? 'fire-mario-idle' : anim);
        if (i > 5) {
            clearInterval(interval);
            player.clearTint();
        }
    }, 100);

    setTimeout(() => { 
        this.physics.resume();
        this.anims.resumeAll();
        playerBlocked = false;
        playerState = 2;
        updateTimer.call(this);
    }, 1000);
}

function collectCoin(player, coin) {
    this.coinSound.play();
    addToScore.call(this, 200);
    coin.destroy();
}

// ==========================================
// 重構：強制畫面推進與左側死亡邊界
// ==========================================
function update(delta) {
    if (gameOver || gameWinned) return;

    updatePlayer.call(this, delta);

    const camera = this.cameras.main;

    if (levelStarted && !reachedLevelEnd) {
        if (camera.isFollowing) {
            camera.stopFollow();
            camera.isFollowing = false;
        }

        if (!playerBlocked) {
            const scrollSpeed = (velocityX * 0.75 * delta) / 1000;
            camera.scrollX += scrollSpeed;

            if (player.x < camera.scrollX - 5) {
                gameOver = true;
                gameOverFunc.call(this);
                return;
            }

            if (player.x > camera.scrollX + (screenWidth * 0.6)) {
                camera.scrollX = player.x - (screenWidth * 0.6);
            }
        }

        if (!isLevelOverworld && player.x >= worldWidth - screenWidth * 1.5) {
            reachedLevelEnd = true;
        }
    }
}
