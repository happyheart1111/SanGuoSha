// Auto-split from game.js — 02-turn
  Game.prototype.toggleAutoPlay = function() {
    this.autoPlay = !this.autoPlay;
    if (this.autoPlay) {
      this.addLog('已开启托管，AI将代你出牌', 'auto');
      // 如果正在等待人类响应，用AI自动解决
      this.resolveAutoPlayPending();
    } else {
      this.addLog('已取消托管，恢复正常操作', 'auto');
    }
    this.render();
  }

  Game.prototype.resolveAutoPlayPending = function() {
    // 没有等待中的操作：回到人类回合时AI接管
    if (!this.waitingForTarget) {
      if (this.phase === 'play' && this.players[this.currentPlayerIdx]?.isHuman) {
        const player = this.players[this.currentPlayerIdx];
        setTimeout(() => this.aiPlayPhase(player), 500);
      }
      return;
    }
    const wt = this.waitingForTarget;
    this.waitingForTarget = null;

    switch (wt.type) {
      case 'guohe_discard': {
        const pick = wt.choices[Math.floor(Math.random() * wt.choices.length)];
        this.executeGuoheDiscard(wt.target, pick);
        this.addLog(`${wt.target.hero.name}的【${pick.card.name}】被过河拆桥弃置`, 'auto');
        this._resumeSourcePlay(wt.source);
        break;
      }
      case 'shunshou_steal': {
        const pick = wt.choices[Math.floor(Math.random() * wt.choices.length)];
        this.executeShunshouSteal(wt.source, wt.target, pick);
        const areaName = pick.type === 'hand' ? '手牌' : pick.type === 'equip' ? '装备' : '判定区';
        this.addLog(`${wt.source.hero.name}顺手牵羊从${wt.target.hero.name}${areaName}获得了【${pick.card.name}】`, 'auto');
        this._resumeSourcePlay(wt.source);
        break;
      }
      case 'shan_response': {
        this.aiRespondToSha(wt.target, wt.source, wt.card);
        this._resumeSourcePlay(wt.source);
        break;
      }
      case 'aoe_response': {
        const { source, target, requiredType, targets, aoeIdx } = wt;
        this.aiRespondToAOE(target, source, requiredType);
        this.render();
        setTimeout(() => this.processAOETargets(source, targets, requiredType, aoeIdx + 1), 400);
        return;
      }
      case 'dying': {
        const saved = this.aiHandleDying(wt.player);
        if (!saved) this.killPlayer(wt.player, wt.source);
        this.checkGameOver();
        if (!this.gameOver) this._resumeGameAfterDying(wt.player);
        break;
      }
      case 'juedou_defend':
      case 'juedou_defend_second': {
        const { challenger, defender } = wt;
        const lübuInvolved = challenger.hero.id === 'lübu' || defender.hero.id === 'lübu';
        this.aiRespondJuedou(defender, challenger, lübuInvolved);
        this._resumeSourcePlay(challenger);
        break;
      }
      case 'huogong_show': {
        const showCard = wt.target.hand[Math.floor(Math.random() * wt.target.hand.length)];
        this.addLog(`${wt.target.hero.name}展示了【${showCard.name}】(${showCard.suit})`, 'skill');
        this.doHuogongDiscard(wt.source, wt.target, showCard.suit);
        if (!this.waitingForTarget) this._resumeSourcePlay(wt.source);
        break;
      }
      case 'huogong_discard': {
        const matchCards = wt.source.hand.filter(c => c.suit === wt.suit);
        if (matchCards.length > 0) {
          const discard = matchCards[Math.floor(Math.random() * matchCards.length)];
          this.discardCard(wt.source, discard);
          this.addLog(`${wt.source.hero.name}弃置【${discard.name}】对${wt.target.hero.name}造成1点火焰伤害`, 'damage');
          this.dealDamage(wt.target, wt.source, 1);
        }
        this._resumeSourcePlay(wt.source);
        break;
      }
      case 'use_card': {
        const player = this.players[this.currentPlayerIdx];
        setTimeout(() => this.aiPlayPhase(player), 300);
        return;
      }
      case 'discard_phase': {
        const player = this.players[this.currentPlayerIdx];
        setTimeout(() => this.aiGoToDiscardPhase(player), 300);
        return;
      }
      case 'haoshi_select': {
        const t = wt.targets[Math.floor(Math.random() * wt.targets.length)];
        this._executeHaoshi(wt.player, t);
        this._resumeSourcePlay(wt.player);
        break;
      }
      case 'qingnang_select': {
        const t = wt.targets[Math.floor(Math.random() * wt.targets.length)];
        t.hp++;
        this.addLog(`${wt.player.hero.name}发动【青囊】令${t.hero.name}回复1点体力`, 'skill');
        this._resumeSourcePlay(wt.player);
        break;
      }
      default:
        // 未知等待类型：尝试恢复当前回合的玩家
        if (this.players[this.currentPlayerIdx]?.alive) {
          this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
        }
    }
    this.render();
  }

  Game.prototype._resumeSourcePlay = function(source) {
    if (!source || !source.alive) return;
    if (source.isHuman && this.autoPlay) {
      setTimeout(() => this.aiPlayCards(source), 200);
    } else if (!source.isHuman) {
      setTimeout(() => this.aiPlayCards(source), 200);
    }
  }

  Game.prototype._resumeGameAfterDying = function(player) {
    if (this.gameOver) return;
    // 继续当前回合或下一位玩家
    const current = this.players[this.currentPlayerIdx];
    if (!current.alive) { this.nextPlayer(); return; }
    if (this.phase === 'play') {
      if (current.isHuman && this.autoPlay) setTimeout(() => this.aiPlayCards(current), 300);
      else if (!current.isHuman) setTimeout(() => this.aiPlayCards(current), 300);
    } else if (this.phase === 'discard') {
      setTimeout(() => this.goToDiscardPhase(current), 300);
    }
  }

  Game.prototype._executeHaoshi = function(player, target) {
    const card = player.hand[0];
    if (!card) return;
    this.discardCard(player, card);
    target.hp++;
    this.haoshiUsedThisTurn = true;
    this.addLog(`${player.hero.name}发动【好施】，弃【${card.name}】令${target.hero.name}回复1点体力`, 'skill');
  }

  Game.prototype.startCurrentTurn = function() {
    if (this.gameOver) return;
    const player = this.players[this.currentPlayerIdx];
    if (!player.alive) { this.nextPlayer(); return; }
    this.shaUsedThisTurn = false;
    this.shaUsedCount = 0;
    this.jiuDamageBoost = false;
    this.tieSuoSelecting = null;
    this.zhihengUsedThisTurn = false;
    this.jieyinUsedThisTurn = false;
    this.qingnangUsedThisTurn = false;
    this.yeyanUsedThisTurn = false;
    this.gongxinUsedThisTurn = false;
    this.haoshiUsedThisTurn = false;
    this.kejiEligible = true;
    this.feiyangUsedThisTurn = false; // 飞扬每回合限一次
    this.extraShaChances = player.equipment.weapon && player.equipment.weapon.id === 'liannu' ? 999 : 0;

    // 斗地主·地主【跋扈】：准备阶段摸一张牌（锁定技）
    if (this.isDouDizhu && player.role === 'dizhu') {
      this.drawCard(player, 1);
      this.addLog(`${player.hero.name}发动【跋扈】，摸了一张牌`, 'skill');
    }

    // PvP 模式：判断是否需要等待远程玩家
    if (this._isPvP) {
      const isHost = pvpManager && pvpManager.isHost;
      const localPlayerId = isHost ? 0 : 1;
      const remotePlayerId = isHost ? 1 : 0;
      
      if (player.isHuman && player.id !== localPlayerId) {
        // 这是远程人类玩家的回合，等待对方行动
        this._pvpWaitingForRemote = true;
        this.addLog(`—— ${player.hero.name} 的回合开始 ——`, 'important');
        this.addLog(`等待对手行动...`, 'info');
        this.render();
        return;
      }
      
      this._pvpWaitingForRemote = false;
    }
    
    this.addLog(`—— ${player.hero.name} 的回合开始 ——`, 'important');

    // 判定阶段 — 处理判定区的延时锦囊
    this.resolveJudgePhase(player);
  }

  Game.prototype.resolveJudgePhase = function(player) {
    // 处理判定区的延时锦囊
    if (player.judgeArea.length === 0) {
      return this.goToDrawPhase(player);
    }
    // 斗地主·地主【飞扬】：判定阶段开始，可弃2手牌抵消1张判定
    if (this.isDouDizhu && player.role === 'dizhu' && !this.feiyangUsedThisTurn && player.judgeArea.length > 0 && player.hand.length >= 2) {
      this.maybeFeiyang(player);
      return;
    }
    const judgeCards = [...player.judgeArea];
    player.judgeArea = [];
    let skipPlay = false;
    let skipDraw = false;
    for (const jc of judgeCards) {
      const judgeCard = this.drawOne();
      if (!judgeCard) continue;
      this.addLog(`${player.hero.name}的【${jc.name}】判定：${judgeCard.suit}${judgeCard.number}【${judgeCard.name}】`);
      if (jc.type === 'lebu') {
        this.discardPile.push(judgeCard);
        if (judgeCard.suit !== '♥') {
          skipPlay = true;
          this.addLog(`乐不思蜀生效，${player.hero.name}跳过出牌阶段`, 'skill');
        } else { this.addLog('乐不思蜀失效'); }
      } else if (jc.type === 'bingliang') {
        this.discardPile.push(judgeCard);
        if (judgeCard.suit !== '♣') {
          skipDraw = true;
          this.addLog(`兵粮寸断生效，${player.hero.name}跳过摸牌阶段`, 'skill');
        } else { this.addLog('兵粮寸断失效'); }
      } else if (jc.type === 'shandian') {
        if (judgeCard.suit === '♠' && judgeCard.number >= 2 && judgeCard.number <= 9) {
          this.addLog(`闪电命中！${player.hero.name}受到3点雷电伤害！`, 'damage');
          this.dealDamage(player, null, 3, judgeCard);
          this.discardPile.push(judgeCard);
        } else {
          this.addLog('闪电未命中，移至下家判定区');
          this.discardPile.push(judgeCard);
          const nextP = this.getNextAlivePlayer(player);
          if (nextP) {
            nextP.judgeArea.push(jc);
            this.addLog(`闪电移至${nextP.hero.name}`);
          }
        }
        if (!player.alive) { this.checkGameOver(); this.render(); return; }
      }
    }
    if (skipDraw) { return this.goToPlayPhase(player, skipPlay); }
    this.goToDrawPhase(player, skipPlay);
  }

  Game.prototype.goToDrawPhase = function(player, skipPlay) {
    // PvP 客机：AI回合由主机同步，不自行推进
    if (this._isPvP && pvpManager && !pvpManager.isHost && !player.isHuman) {
      this._pvpWaitingForRemote = true;
      this.render();
      return;
    }
    if (player.isHuman && !this.autoPlay) {
      setTimeout(() => this.humanDrawPhase(skipPlay), 400);
    } else {
      setTimeout(() => this.aiDrawPhase(player, skipPlay), 600);
    }
  }

  Game.prototype.goToPlayPhase = function(player, skipPlay) {
    // PvP 客机：AI回合不自行推进
    if (this._isPvP && pvpManager && !pvpManager.isHost && !player.isHuman) {
      return;
    }
    if (skipPlay) {
      this.phase = 'play';
      this.addLog(`${player.hero.name}跳过出牌阶段`);
      this.render();
      setTimeout(() => this.goToDiscardPhase(player), 600);
      return;
    }
    this.phase = 'play';
    this.render();
    if (this.autoPlay && player.isHuman) {
      setTimeout(() => this.aiPlayPhase(player), 500);
    } else if (!player.isHuman) {
      setTimeout(() => this.aiPlayPhase(player), 500);
    }
  }

  Game.prototype.humanDrawPhase = function(skipPlay) {
    const player = this.players[this.currentPlayerIdx];
    // 张辽突袭 — 自动处理
    if (player.hero.id === 'zhangliao' && !this.tuxiUsedThisTurn) {
      this.tuxiUsedThisTurn = true;
      const others = this.players.filter(p => p.alive && p.id !== player.id && p.hand.length > 0);
      const targets = others.sort(() => Math.random() - 0.5).slice(0, 2);
      for (const t of targets) {
        const card = t.hand[Math.floor(Math.random() * t.hand.length)];
        this.transferCard(t, player, card);
        this.addLog(`${player.hero.name}发动【突袭】，获得了${t.hero.name}的一张【${card.name}】`, 'skill');
      }
      if (targets.length === 0) {
        this.drawCard(player, 2);
        this.addLog(`${player.hero.name} 没有可突袭的目标，改为摸2张牌`);
      }
    } else if (player.hero.id === 'shen-lusu') {
      // 神·鲁肃缔盟：摸4张
      this.drawCard(player, 4);
      this.addLog(`${player.hero.name}发动【缔盟】，摸了4张牌`, 'skill');
    } else {
      this.drawCard(player, 2);
      this.addLog(`${player.hero.name} 摸了2张牌`);
    }
    this.phase = 'play';
    this.render();
    this._pvpSyncState();
    this.goToPlayPhase(player, skipPlay);
  }

  Game.prototype.selectCard = function(idx) {
    if (this.phase !== 'play') return;
    const player = this.players[this.currentPlayerIdx];
    if (!player.isHuman || this.autoPlay) return;
    if (idx < 0 || idx >= player.hand.length) return;

    if (this.selectedCardIdx === idx) {
      this.selectedCardIdx = -1;
    } else {
      this.selectedCardIdx = idx;
    }
    this.render();
  }

  Game.prototype.playSelectedCard = function() {
    if (this.selectedCardIdx < 0) return;
    const player = this.players[this.currentPlayerIdx];
    const card = player.hand[this.selectedCardIdx];
    if (!card) return;

    const equipTypes = ['weapon', 'plusHorse', 'minusHorse', 'armor'];

    // 关羽武圣：红色牌当杀使用（装备牌优先装备）
    let effectiveType = card.type;
    if (!equipTypes.includes(card.type) && player.hero.id === 'guanyu' && card.type !== 'sha' && isRedSuit(card.suit)) {
      effectiveType = 'sha';
    }

    if (equipTypes.includes(card.type)) {
      const idx = player.hand.indexOf(card);
      if (idx >= 0) player.hand.splice(idx, 1);
      this.equipCard(player, card);
      this.selectedCardIdx = -1;
      this.render();
    } else if (effectiveType === 'sha') {
      // 非张飞且非武圣转换的杀，检查次数
      if (player.hero.id !== 'zhangfei' && this.shaUsedCount >= player.shaQuota && card.type === 'sha') {
        this.addLog(`本回合【杀】已用完（上限 ${player.shaQuota} 张）`);
        return;
      }
      const targets = this.getValidTargets({ ...card, type: 'sha' });
      const shaRange = this.getShaRange(player);
      if (targets.length === 0) { this.addLog(`没有可选目标（所有角色距离均大于${shaRange}）`); return; }
      if (targets.length === 1) {
        this.useCardOnTarget(card, targets[0], effectiveType);
        this.selectedCardIdx = -1;
      } else {
        this.showTargetSelection(card, targets, (target) => {
          this.useCardOnTarget(card, target, effectiveType);
          this.selectedCardIdx = -1;
        });
      }
    } else if (card.type === 'tao') {
      if (player.hp >= player.hero.maxHp) {
        this.addLog('体力值已满，不能使用【桃】');
        return;
      }
      this.useCardOnTarget(card, player, 'tao');
      this.selectedCardIdx = -1;
    } else if (card.type === 'jiu') {
      if (player.hp >= player.hero.maxHp && !this.jiuDamageBoost) {
        this.addLog('体力值已满且未出【杀】，使用【酒】无益');
        return;
      }
      this.useCardOnTarget(card, player, 'jiu');
      this.selectedCardIdx = -1;
    } else if (card.type === 'tiesuo') {
      this.showTiesuoSelect(player, card);
    } else if (card.type === 'shan') {
      this.addLog('【闪】不能在出牌阶段主动使用');
    } else if (['juedou', 'guohe', 'shunshou', 'lebu', 'bingliang', 'huogong'].includes(card.type)) {
      const targets = this.getValidTargets(card);
      if (targets.length === 0) { this.addLog('没有可选目标'); return; }
      this.showTargetSelection(card, targets, (target) => {
        this.useCardOnTarget(card, target, card.type);
        this.selectedCardIdx = -1;
      });
    } else if (['wuzhong', 'nanman', 'wanjian', 'taoyuan', 'wugu', 'shandian'].includes(card.type)) {
      // 斗地主：团队治疗锦囊会惠及敌人，农民AOE会误伤队友，禁止释放
      if (this.isDouDizhu && (card.type === 'taoyuan' || card.type === 'wugu'
          || ((card.type === 'nanman' || card.type === 'wanjian') && player.role === 'nongmin'))) {
        this.addLog('斗地主中该锦囊会惠及敌人/误伤队友，无法使用');
        return;
      }
      this.useCardOnTarget(card, null, card.type);
      this.selectedCardIdx = -1;
    }
  }

  Game.prototype.getValidTargets = function(card) {
    const player = this.players[this.currentPlayerIdx];
    const aliveOthers = this.players.filter(p => p.alive && p.id !== player.id);
    // 斗地主：只能选择敌方角色
    const teamOk = (t) => !this.isDouDizhu || this.getEnemies(player).some(e => e.id === t.id);
    switch (card.type) {
      case 'sha': {
        const shaRange = this.getShaRange(player);
        return aliveOthers.filter(t => this.calcDistance(player, t, true) <= shaRange && teamOk(t));
      }
      case 'juedou': return aliveOthers.filter(t => t.hero.id !== 'jiaxu' && teamOk(t));
      case 'huogong': return aliveOthers.filter(t => t.hand.length > 0 && teamOk(t));
      case 'shunshou': return aliveOthers.filter(t => t.hero.id !== 'jiaxu' && this.buildGuoheChoices(t).length > 0 && this.calcDistance(player, t) <= 1 && teamOk(t));
      case 'guohe': return aliveOthers.filter(t => t.hero.id !== 'jiaxu' && this.buildGuoheChoices(t).length > 0 && teamOk(t));
      case 'lebu': return aliveOthers.filter(t => t.judgeArea.length < 3 && teamOk(t));
      case 'bingliang': return aliveOthers.filter(t => t.judgeArea.length < 3 && this.calcDistance(player, t) <= 1 && teamOk(t));
      default: return [];
    }
  }

  Game.prototype.getShaRange = function(player) {
    return player.equipment.weapon ? player.equipment.weapon.range : 1;
  }

  Game.prototype.equipCard = function(player, card) {
    const slotMap = { weapon: 'weapon', plusHorse: 'plusHorse', minusHorse: 'minusHorse', armor: 'armor' };
    const slot = slotMap[card.type];
    if (!slot) return;
    // 卸下旧装备
    if (player.equipment[slot]) {
      const old = player.equipment[slot];
      this.addLog(`${player.hero.name}卸下了【${old.name}】`, 'equip');
      this.discardPile.push(old);
    }
    player.equipment[slot] = card;
    const typeNames = { weapon: `武器(范围${card.range})`, plusHorse: '防御坐骑', minusHorse: '进攻坐骑', armor: '防具' };
    this.addLog(`${player.hero.name}装备了【${card.name}】${typeNames[card.type]}`, 'equip');
  }

  Game.prototype.showTargetSelection = function(card, targets, callback) {
    this.waitingForTarget = { card, targets, callback };
    this.render();
    const overlay = document.getElementById('targetOverlay');
    const hint = document.getElementById('targetHint');
    const buttons = document.getElementById('targetButtons');
    hint.textContent = `使用【${card.name}】—— 选择目标`;
    buttons.innerHTML = targets.map(t => `
      <button class="target-btn" onclick="window._targetSelect('${t.id}')">
        ${t.hero.name} (${t.hp}/${t.hero.maxHp} HP)
      </button>
    `).join('') + `
      <button class="target-btn" style="border-color:#666;color:#888;" onclick="window._cancelTarget()">取消</button>
    `;
    overlay.classList.add('show');
    window._targetSelect = (id) => {
      overlay.classList.remove('show');
      const target = targets.find(t => t.id === id);
      if (target && this.waitingForTarget) this.waitingForTarget.callback(target);
      this.waitingForTarget = null;
      this.render();
    };
    window._cancelTarget = () => {
      overlay.classList.remove('show');
      this.waitingForTarget = null;
      this.selectedCardIdx = -1;
      this.render();
    };
  }

  Game.prototype.useCardOnTarget = function(card, target, effectiveTypeOverride) {
    const player = this.players[this.currentPlayerIdx];
    const effectiveType = effectiveTypeOverride || card.type;
    const cardIdx = player.hand.indexOf(card);
    this.discardCard(player, card);

    // PvP 广播
    if (this._isPvP && player.isHuman) {
      pvpBroadcast(this, 'playCard', {
        playerId: player.id,
        cardIdx: cardIdx,
        cardId: card.id,
        cardType: card.type,
        effectiveType: effectiveType,
        targetPlayerIdx: target ? target.id : -1,
      });
    }
    const isWushengSha = (player.hero.id === 'guanyu' && card.type !== 'sha' && effectiveType === 'sha');
    const desc = isWushengSha ? `将${card.suit}【${card.name}】当【杀】使用` : `使用了【${card.name}】`;
    this.addLog(`${player.hero.name}${desc}${target ? '，目标是' + target.hero.name : ''}`, isWushengSha ? 'skill' : '');

    if (effectiveType === 'sha') {
      if (player.hero.id !== 'zhangfei' && this.extraShaChances <= 0) this.shaUsedCount++;
      if (this.extraShaChances > 0) this.extraShaChances--;
      this.resolveSha(player, target, card);
    } else {
      switch (effectiveType) {
        case 'tao': this.resolveTao(player); break;
        case 'jiu': this.resolveJiu(player); break;
        case 'juedou': this.resolveJuedou(player, target); break;
        case 'guohe': this.resolveGuohe(target); break;
        case 'shunshou': this.resolveShunshou(player, target); break;
        case 'huogong': this.resolveHuogong(player, target); break;
        case 'tiesuo': this.resolveTiesuo(player); break;
        case 'wuzhong': this.resolveWuzhong(player); break;
        case 'nanman': this.resolveNanman(player); break;
        case 'wanjian': this.resolveWanjian(player); break;
        case 'taoyuan': this.resolveTaoyuan(player); break;
        case 'wugu': this.resolveWugu(player); break;
        case 'lebu': this.resolveLebu(target); break;
        case 'bingliang': this.resolveBingliang(target); break;
        case 'shandian': this.resolveShandian(player); break;
      }
    }
    // 吕蒙克己
    if (effectiveType === 'sha') this.kejiEligible = false;
    if (!this.gameOver) this.render();
    this._pvpSyncState();
  }

  Game.prototype.resolveSha = function(source, target, card) {
    if (!target.alive) return;
    // 仁王盾：黑色杀无效
    if (target.equipment.armor && target.equipment.armor.id === 'renwang' && !isRedSuit(card.suit)) {
      this.addLog(`${target.hero.name}的【仁王盾】使黑色【杀】无效`, 'skill');
      this.render();
      return;
    }
    // 吕布无双：需要2张闪
    const lübuWushuang = source.hero.id === 'lübu';
    const shaText = lübuWushuang ? '发动【无双】需要连续打出2张【闪】' : '需要打出【闪】';
    this.addLog(`${target.hero.name}${shaText}来响应【杀】`);
    const jiuBoost = this.jiuDamageBoost ? 1 : 0;
    if (this.jiuDamageBoost) { this.jiuDamageBoost = false; this.addLog('【酒】效果触发！此【杀】伤害+1', 'skill'); }
    this.pendingDamageCards[target.id] = { card, shanNeeded: lübuWushuang ? 2 : 1, jiuBoost };

    if (target.isHuman && !this.autoPlay) {
      this.render();
      this.waitForShanResponse(target, source, card);
    } else {
      setTimeout(() => this.aiRespondToSha(target, source, card), 500);
    }
  }

  Game.prototype.waitForShanResponse = function(target, source, card) {
    const hasShan = target.hand.some(c => c.type === 'shan');
    const hasRedCard = target.hero.id === 'guanyu' && target.hand.some(c => isRedSuit(c.suit));
    const hasBaguazhen = target.equipment.armor && target.equipment.armor.id === 'baguazhen';
    const canRespond = hasShan || hasRedCard || hasBaguazhen;
    const pd = this.pendingDamageCards[target.id];
    const shanNeeded = pd ? (pd.shanNeeded || 1) : 1;
    const shanCount = shanNeeded > 1 ? `(还需${shanNeeded}张)` : '';
    this.waitingForTarget = { type: 'shan_response', target, source, card, hasShan: hasShan || hasRedCard, hasBaguazhen, shanNeeded };
    this.render();
    if (!canRespond) {
      setTimeout(() => {
        this.waitingForTarget = null;
        this.dealDamage(target, source, 1, card);
        this.render();
      }, 500);
    }
  }

  Game.prototype.humanRespondShan = function(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shan_response') return;
    const { target, source, card } = this.waitingForTarget;
    if (withCard) {
      const isWusheng = target.hero.id === 'guanyu' && withCard.type !== 'shan';
      this.discardCard(target, withCard);
      const pd = this.pendingDamageCards[target.id];
      if (pd) pd.shanNeeded = (pd.shanNeeded || 1) - 1;
      if (pd && pd.shanNeeded <= 0) {
        this.waitingForTarget = null;
        delete this.pendingDamageCards[target.id];
        this.addLog(`${target.hero.name}${isWusheng ? '发动【武圣】' : ''}打出【闪】，成功闪避`, isWusheng ? 'skill' : '');
      } else if (pd) {
        this.addLog(`${target.hero.name}打出一张【闪】，还需${pd.shanNeeded}张`);
        this.waitingForTarget = null;
        setTimeout(() => this.waitForShanResponse(target, source, card), 200);
        return;
      } else {
        this.addLog(`${target.hero.name}打出【闪】，但伤害已消解，无需继续响应`);
        this.waitingForTarget = null;
      }
    } else {
      this.waitingForTarget = null;
      this.dealDamage(target, source, 1, card);
    }
    this.render();
    if (source && (!source.isHuman || (source.isHuman && this.autoPlay))) {
      setTimeout(() => this.aiPlayCards(source), 140);
    }
    this._pvpSyncState();
  }

  Game.prototype.humanUseBaguazhen = function() {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shan_response') return;
    const { target, source, card } = this.waitingForTarget;
    this.waitingForTarget = null;
    const judgeCard = this.drawOne();
    if (!judgeCard) {
      this.dealDamage(target, source, 1, card);
      this.render();
      if (source && (!source.isHuman || (source.isHuman && this.autoPlay))) {
        setTimeout(() => this.aiPlayCards(source), 140);
      }
      return;
    }
    const pd = this.pendingDamageCards[target.id];
    const totalNeeded = pd ? (pd.shanNeeded || 1) : 1;
    this.addLog(`${target.hero.name}发动【八卦阵】判定，判定牌：${judgeCard.suit}【${judgeCard.name}】`, 'skill');
    this.discardPile.push(judgeCard);
    if (isRedSuit(judgeCard.suit)) {
      if (pd) pd.shanNeeded = (pd.shanNeeded || 1) - 1;
      if (pd && pd.shanNeeded <= 0) {
        delete this.pendingDamageCards[target.id];
        this.addLog('判定为红色，视为打出了一张【闪】，成功闪避', 'skill');
      } else if (pd) {
        this.addLog(`判定为红色，视为打出一张【闪】，还需${pd.shanNeeded}张`);
        setTimeout(() => this.waitForShanResponse(target, source, card), 200);
        return;
      } else {
        this.addLog('判定为红色，但伤害已消解，无需继续响应');
      }
    } else {
      this.addLog('判定为黑色，【八卦阵】未触发，仍需要【闪】', 'skill');
      // 让玩家继续选择
      setTimeout(() => {
        this.waitForShanResponse(target, source, card);
      }, 100);
    }
    this.render();
    if (source && (!source.isHuman || (source.isHuman && this.autoPlay))) {
      setTimeout(() => this.aiPlayCards(source), 140);
    }
  }

  Game.prototype.resolveTao = function(player) {
    if (player.hp < player.hero.maxHp) {
      player.hp++;
      this.addLog(`${player.hero.name}回复了1点体力 (${player.hp}/${player.hero.maxHp})`, 'heal');
    } else {
      this.addLog(`${player.hero.name}体力已满，【桃】无法生效`);
    }
  }

  Game.prototype.resolveJiu = function(player) {
    this.jiuDamageBoost = true;
    this.addLog(`${player.hero.name}使用了【酒】，本回合下一张【杀】伤害+1`, 'skill');
    if (player.hp < player.hero.maxHp) this.addLog('（【酒】也可在回合外濒死时当【桃】使用）');
    this.render();
  }

