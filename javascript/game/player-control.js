function createPlayer() {
    // Draw player
    player = this.physics.add.sprite( /*screenWidth * 1.5*/ startOffset, screenHeight - platformHeight, 'mario').setOrigin(1).setBounce(0)
    .setCollideWorldBounds(true).setScale(screenHeight / 376);
    player.depth = 3;
    /*this.cameras.main.startFollow(player);
    playerState = 2;*/
}

function decreasePlayerState() {

    if (playerState <= 0) {
        gameOver = true;
        gameOverFunc.call(this);
        return;
    }
    
    playerBlocked = true;
    this.physics.pause();
    this.anims.pauseAll();
    this.powerDownSound.play();

    let anim1 = playerState == 2 ? 'fire-mario-idle' : 'grown-mario-idle';
    let anim2 = playerState == 2 ? 'grown-mario-idle' : 'idle';

    applyPlayerInvulnerability.call(this, 3000);
    player.anims.play(anim2);

    let i = 0;
    let interval = setInterval(() => {
        i++;
        player.anims.play(i % 2 === 0 ? anim2 : anim1);
        if (i > 5) {
            clearInterval(interval);
        }
    }, 100);

    playerState--;

    setTimeout(() => { 
        this.physics.resume();
        this.anims.resumeAll();
        playerBlocked = false;
        updateTimer.call(this);
    }, 1000);
}

function applyPlayerInvulnerability(time) {
    let blinkAnim = this.tweens.add({
        targets: player,
        duration: 100,
        alpha: { from: 1, to: 0.2 },
        ease: 'Linear',
        repeat: -1,
        yoyo: true
    });

    playerInvulnerable = true;
    setTimeout(() => {
        playerInvulnerable = false;
        blinkAnim.stop();
        player.alpha = 1;
    }, time);
}

function updatePlayer(delta) {

    // Win animation
    if (playerBlocked && flagRaised) {
        player.setVelocityX(screenWidth / 8.5);
        if (playerState == 0)
        player.anims.play('run', true).flipX = false;
        if (playerState == 1)
        player.anims.play('grown-mario-run', true).flipX = false;
        if (playerState == 2)
        player.anims.play('fire-mario-run', true);

        if(player.x >= worldWidth - (worldWidth / 75)) {
            this.tweens.add({
                targets: player,
                duration: 75,
                alpha: 0
            });
        }
        setTimeout(() => {
            gameWinned = true;
            player.destroy();
            winScreen.call(this);
        }, 5000);
        return;
    }

    if (player.body.blocked.up)
        player.setVelocityY(0);

    if (player.body.blocked.left || player.body.blocked.right)
        player.setVelocityX(0);

    // Check if player has fallen
    if (player.y > screenHeight - 10 || timeLeft <= 0) {
        gameOver = true;
        gameOverFunc.call(this);
        return;
    }

    if (playerBlocked)
        return;

    // > Vertical movement (重構：全螢幕觸控與二段跳)
    if (this.jumpCount === undefined) this.jumpCount = 0;
    if (this.jumpInputWasDown === undefined) this.jumpInputWasDown = false;

    let isPointerDown = this.input.activePointer.isDown;
    let isKeyDown = controlKeys.JUMP.isDown; 
    let isAnyJumpInputDown = isPointerDown || isKeyDown;

    let isJumpPressed = isAnyJumpInputDown && !this.jumpInputWasDown;
    this.jumpInputWasDown = isAnyJumpInputDown;

    if (player.body.touching.down) {
        this.jumpCount = 0;
    }

    if (isJumpPressed && this.jumpCount < 2) {
        this.jumpSound.play();
        player.setVelocityY(-velocityY); 
        this.jumpCount++;
    }

    // > Horizontal movement and animations (重構：強制自動跑酷模式)
    let oldVelocityX;
    let targetVelocityX;
    let newVelocityX;

    smoothedControls.moveRight(delta);
    
    if (!playerFiring) {
        if (playerState == 0)
            player.anims.play('run', true).flipX = false;
        if (playerState == 1)
            player.anims.play('grown-mario-run', true).flipX = false;
        if (playerState == 2)
            player.anims.play('fire-mario-run', true).flipX = false;
    }

    playerController.direction.positive = true;

    oldVelocityX = player.body.velocity.x;
    targetVelocityX = playerController.speed.run;
    newVelocityX = Phaser.Math.Linear(oldVelocityX, targetVelocityX, smoothedControls.value);

    player.setVelocityX(newVelocityX);

    if (!playerFiring) {
        if (playerState > 0 && controlKeys.DOWN.isDown) {
            if (playerState == 1)
            player.anims.play('grown-mario-crouch', true);

            if (playerState == 2)
            player.anims.play('fire-mario-crouch', true);

            // 移除原本的下蹲煞車邏輯，保持跑酷動能
            player.body.setSize(14, 22).setOffset(2, 10);

            return;
        } else {
            if (playerState > 0)
                player.body.setSize(14, 32).setOffset(2,0);

            if (playerState == 0)
                player.body.setSize(14, 16).setOffset(1.3, 0.5);
        }
    }

    if (player.body.touching.down && playerState == 2 && controlKeys.FIRE.isDown && !fireInCooldown) {
        throwFireball.call(this);
        return;
    }

    // Apply jump animation
    if (!player.body.touching.down) {
        if (!playerFiring) {
            if (playerState == 0)
            player.anims.play('jump', true);
    
            if (playerState == 1)
            player.anims.play('grown-mario-jump', true);
    
            if (playerState == 2)
            player.anims.play('fire-mario-jump', true);
        }
    }
}
