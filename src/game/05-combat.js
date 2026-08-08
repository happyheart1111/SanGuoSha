// ==================== 战斗与死亡模块 ====================
// 伤害结算、濒死救助（桃/急救）、阵亡处理、奖惩机制（反贼奖励/主公杀忠惩罚/农民同心补偿）、
// 游戏结束判定等生死相关逻辑。
  Game.prototype.handleDying = function(player, source) {
    this.addLog(`${player.hero.name}处于濒死状态，需要打出【桃】`, 'damage');

    // 华佗急救：红色牌可当桃；酒也可在濒死时当桃
    const hasTao = player.hand.some(c => c.type === 'tao');
    const hasJiu = player.hand.some(c => c.type === 'jiu');
    const huatuoJijiu = player.hero.id === 'huatuo' && player.hand.some(c => isRedSuit(c.suit));

    if (player.isHuman && !this.autoPlay) {
      if (hasTao || hasJiu || huatuoJijiu) {
        this.waitingForTarget = { type: 'dying', player, huatuoJijiu, hasJiu, source };
        return;
      }
    } else {
      if (this.aiHandleDying(player)) return;
    }

    this.killPlayer(player, source);
    this.checkGameOver();
  }

  const KILL_LINES = ['一破！卧龙出山！', '双连！一战成名！', '三连！举世皆惊！', '四破！天下无双！'];

  Game.prototype.killPlayer = function(player, source) {
    player.alive = false;
    this.killCount = (this.killCount || 0) + 1;
    const line = this.killCount <= KILL_LINES.length ? KILL_LINES[this.killCount - 1] : `第${this.killCount}杀！`;
    const killerName = source ? source.hero.name : '天';
    this.addLog(`${line}  ${killerName} 斩杀了 ${player.hero.name}`, 'death');
    // VFX 死亡消散特效
    if (typeof VFX !== 'undefined') VFX.deathEffect(player);
    if (player.role && !this.rolesRevealed[player.id]) {
      this.rolesRevealed[player.id] = true;
      this.addLog(`${player.hero.name}的身份是：${getRoleDisplayName(player.role)}`, 'important');
    }

    // 杀死反贼奖励：摸3张牌
    if (player.role === 'fanzei' && source && source.alive) {
      this.drawCard(source, 3);
      this.addLog(`${source.hero.name}杀死反贼，摸3张牌奖励！`, 'reward');
    }
    // 斗地主：农民队友阵亡，存活农民触发【同心】补偿
    if (this.isDouDizhu && player.role === 'nongmin') {
      const mate = this.players.find(p => p.alive && p.role === 'nongmin' && p.id !== player.id);
      if (mate) this.triggerNongminBonus(mate, player);
    }
    // 主公杀死忠臣惩罚：弃掉所有手牌和装备
    if (player.role === 'zhongchen' && source && source.role === 'zhugong' && source.alive) {
      this.addLog(`主公误杀忠臣！${source.hero.name}弃掉所有手牌和装备`, 'penalty');
      const allCards = [...source.hand, ...Object.values(source.equipment).filter(Boolean)];
      for (const c of allCards) {
        this.discardPile.push(c);
      }
      source.hand = [];
      source.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };
    }

    // 阵亡角色手牌和装备进入弃牌堆
    const deadCards = [...player.hand, ...Object.values(player.equipment).filter(Boolean)];
    for (const c of deadCards) {
      this.discardPile.push(c);
    }
    player.hand = [];
    player.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };

    const caopi = this.players.find(p => p.hero.id === 'caopi' && p.alive);
    if (caopi) this.triggerXingshang(caopi);
  }

  Game.prototype.humanDyingUseTao = function(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'dying') return;
    const player = this.waitingForTarget.player;
    const source = this.waitingForTarget.source;
    this.waitingForTarget = null;
    if (withCard) {
      const isJijiu = player.hero.id === 'huatuo' && withCard.type !== 'tao';
      this.discardCard(player, withCard);
      player.hp = 1;
      this.addLog(`${player.hero.name}${isJijiu ? '发动【急救】将红色牌当【桃】' : '使用【桃】'}自救，回复至1点体力`, isJijiu ? 'skill' : 'heal');
      // VFX 治疗特效
      if (typeof VFX !== 'undefined') {
        VFX.healEffect(player, 1);
        if (isJijiu) VFX.skillActivate(player);
      }
      this._resumeSourcePlay(source || this.players[this.currentPlayerIdx]);
    } else {
      this.killPlayer(player, source);
      this.checkGameOver();
      // 如果游戏未结束，恢复当前回合
      if (!this.gameOver) {
        const current = this.players[this.currentPlayerIdx];
        if (current && current.alive && this.phase === 'play') {
          if (current.isHuman && this.autoPlay) setTimeout(() => this.aiPlayCards(current), 300);
          else if (!current.isHuman) setTimeout(() => this.aiPlayCards(current), 300);
        }
      }
    }
    this.render();
  }

