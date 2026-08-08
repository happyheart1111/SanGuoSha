// Auto-split from game.js — 06-phase
  Game.prototype.goToDiscardPhase = function(player) {
    // PvP 客机：AI回合不自行推进
    if (this._isPvP && pvpManager && !pvpManager.isHost && !player.isHuman) {
      return;
    }
    this.phase = 'discard';
    // 吕蒙克己：没出过杀可跳过弃牌
    const kejiSkip = player.hero.id === 'lvmeng' && this.kejiEligible;
    if (kejiSkip) {
      this.addLog(`${player.hero.name}发动【克己】，跳过弃牌阶段`, 'skill');
    }
    if (player.isHuman && !this.autoPlay && !kejiSkip) {
      setTimeout(() => this.handleHumanDiscard(), 300);
    } else if (kejiSkip) {
      this.endTurn();
    } else {
      this.aiGoToDiscardPhase(player);
    }
  }

  Game.prototype.handleHumanDiscard = function() {
    const player = this.players[this.currentPlayerIdx];
    const maxKeep = player.hp;
    if (player.hand.length <= maxKeep) { this.endTurn(); return; }
    this.waitingForTarget = { type: 'human_discard', player, maxKeep };
    this.render();
  }

  Game.prototype.humanDiscardCard = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'human_discard') return;
    const { player, maxKeep } = this.waitingForTarget;
    const card = player.hand[cardIdx];
    this.discardCard(player, card);
    this.addLog(`${player.hero.name}弃置了【${card.name}】`);
    if (player.hand.length <= maxKeep) {
      this.waitingForTarget = null;
      this.endTurn();
    }
    this.render();
  }

  Game.prototype.endPlayPhase = function() {
    this.phase = 'discard';
    const player = this.players[this.currentPlayerIdx];
    
    // PvP 广播
    if (this._isPvP && player.isHuman) {
      pvpBroadcast(this, 'endPhase', { playerId: player.id, phase: 'discard' });
    }
    // 神·鲁肃缔盟：出牌阶段结束时，给1张手牌给手牌最少的角色
    if (player.hero.id === 'shen-lusu' && player.hand.length > 0) {
      this.triggerDimengGive(player);
    }
    // 吕蒙克己：没出过杀跳过弃牌
    const kejiSkip = player.hero.id === 'lvmeng' && this.kejiEligible;
    if (kejiSkip) {
      this.addLog(`${player.hero.name}发动【克己】，跳过弃牌阶段`, 'skill');
    } else if (player.hand.length > player.hp) {
      const discardCount = player.hand.length - player.hp;
      const toDiscard = player.hand.slice(0, discardCount);
      for (const c of toDiscard) this.discardCard(player, c);
      this.addLog(`${player.hero.name}弃置了${discardCount}张牌（手牌数超过体力值）`);
    }
    // 神周瑜琴音
    if (player.hero.id === 'shen-zhouyu') {
      this.triggerQinyin(player);
    }
    this.nextPlayer();
  }

  Game.prototype.humanEndPlayPhase = function() {
    if (this.phase !== 'play') return;
    this.phase = 'discard';
    const player = this.players[this.currentPlayerIdx];
    
    // PvP 广播
    if (this._isPvP && player.isHuman) {
      pvpBroadcast(this, 'endPhase', { playerId: player.id, phase: 'discard' });
    }
    // 神·鲁肃缔盟：出牌阶段结束时给牌
    if (player.hero.id === 'shen-lusu' && player.hand.length > 0) {
      this.triggerDimengGive(player);
    }
    // 神周瑜琴音：弃牌阶段结束时触发
    const qinyinPlayer = player.hero.id === 'shen-zhouyu' ? player : null;
    // 吕蒙克己
    if (player.hero.id === 'lvmeng' && this.kejiEligible) {
      this.addLog(`${player.hero.name}发动【克己】，跳过弃牌阶段`, 'skill');
      if (qinyinPlayer) this.triggerQinyin(player);
      setTimeout(() => this.nextPlayer(), 400);
      return;
    }
    if (player.hand.length > player.hp) {
      this.addLog(`你需要弃置 ${player.hand.length - player.hp} 张牌`);
      this.waitingForTarget = {
        type: 'discard_phase',
        player,
        needDiscard: player.hand.length - player.hp,
        selected: [],
        qinyinPlayer,
      };
      this.render();
    } else {
      if (qinyinPlayer) this.triggerQinyin(player);
      this.nextPlayer();
    }
  }

  Game.prototype.humanSelectDiscard = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'discard_phase') return;
    const wt = this.waitingForTarget;
    const idx = wt.selected.indexOf(cardIdx);
    if (idx >= 0) wt.selected.splice(idx, 1);
    else wt.selected.push(cardIdx);
    this.render();
  }

  Game.prototype.humanConfirmDiscard = function() {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'discard_phase') return;
    const { player, selected, needDiscard } = this.waitingForTarget;
    if (selected.length !== needDiscard) {
      this.addLog(`请弃置正好 ${needDiscard} 张牌`);
      return;
    }
    this.waitingForTarget = null;
    const cards = selected.sort((a,b) => b-a).map(i => player.hand[i]);
    for (const c of cards) this.discardCard(player, c);
    this.addLog(`${player.hero.name}弃置了${cards.length}张牌`);
    if (wt.qinyinPlayer) this.triggerQinyin(wt.qinyinPlayer);
    this.nextPlayer();
  }

  Game.prototype.endTurn = function() {
    this.nextPlayer();
  }

  Game.prototype.nextPlayer = function() {
    if (this.gameOver) return;
    this.currentPlayerIdx = (this.currentPlayerIdx + 1) % this.players.length;
    let loops = 0;
    while (!this.players[this.currentPlayerIdx].alive && loops < this.players.length) {
      this.currentPlayerIdx = (this.currentPlayerIdx + 1) % this.players.length;
      loops++;
    }
    this.phase = 'idle';
    this.selectedCardIdx = -1;
    this.shaUsedThisTurn = false;
    this.shaUsedCount = 0;
    this.zhihengUsedThisTurn = false;
    
    // PvP 状态同步
    this._pvpSyncState();
    this.jieyinUsedThisTurn = false;
    this.render();
    setTimeout(() => this.startCurrentTurn(), 800);
  }

  Game.prototype.checkGameOver = function() {
    if (this.gameOver) return;
    const alive = this.players.filter(p => p.alive);
    let result = null;
    if (this.gameMode >= 5) {
      // 身份局胜负判定
      const zhugong = this.players.find(p => p.role === 'zhugong');
      const aliveFanzei = alive.filter(p => p.role === 'fanzei');
      const aliveNeijian = alive.filter(p => p.role === 'neijian');
      const aliveZhongchen = alive.filter(p => p.role === 'zhongchen');

      if (zhugong && !zhugong.alive) {
        result = { team: 'fanzei', winners: alive.filter(p => p.role === 'fanzei'), msg: '主公已阵亡，反贼获胜！' };
      } else if (aliveFanzei.length === 0 && aliveNeijian.length === 0) {
        result = { team: 'zhugong', winners: alive.filter(p => p.role === 'zhugong' || p.role === 'zhongchen'), msg: '反贼与内奸已全部消灭，主公忠臣获胜！' };
      } else if (alive.length === 1 && alive[0].role === 'neijian') {
        result = { team: 'neijian', winners: [alive[0]], msg: '内奸成为最后的幸存者，内奸获胜！' };
      }
    } else if (this.isDouDizhu) {
      // 斗地主胜负：地主阵亡→农民胜；农民全灭→地主胜
      const landlord = this.players.find(p => p.role === 'dizhu');
      const peasants = this.players.filter(p => p.role === 'nongmin');
      const alivePeasants = peasants.filter(p => p.alive);
      if (landlord && !landlord.alive) {
        result = { team: 'nongmin', winners: alivePeasants, msg: '地主阵亡，农民获胜！' };
      } else if (alivePeasants.length === 0) {
        result = { team: 'dizhu', winners: [landlord], msg: '农民全部阵亡，地主获胜！' };
      }
    } else {
      if (alive.length <= 1) {
        result = { team: 'free', winners: alive, msg: `${alive[0] ? alive[0].hero.name : '无人'} 获得了胜利！` };
      }
    }

    if (result) {
      this.gameOver = true;
      this.phase = 'idle';
      this.winningTeam = result.team + '';
      this.addLog('====================================', 'important');
      this.addLog(result.msg, 'important');
      if (this._isPvP) {
        // PvP 模式：为双方显示不同消息
        const isHost = pvpManager && pvpManager.isHost;
        const myIdx = isHost ? 0 : 1;
        const myPlayer = this.players.find(p => p.id === myIdx);
        const myWin = result.winners.some(w => w.id === myPlayer.id);
        if (myWin) this.addLog('恭喜你赢得了比赛！', 'important');
        else this.addLog('你输了…再接再厉！', 'damage');
      } else {
        const humanP = this.players.find(p => p.isHuman);
        const humanWin = result.winners.some(w => w.id === humanP.id);
        if (humanWin) this.addLog('恭喜你赢得了比赛！', 'important');
        else this.addLog('你输了…再接再厉！', 'damage');
      }
      // 揭示所有身份
      this.players.forEach(p => { this.rolesRevealed[p.id] = true; });
      this.autoPlay = false;
      this.render();
      this._pvpSyncState();
    }
  }

