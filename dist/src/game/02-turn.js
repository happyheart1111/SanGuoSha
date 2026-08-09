// ==================== 回合控制模块 ====================
// 回合流转管理：新回合开始/结束、托管自动出牌、AOE 结算推进、濒死救人后恢复游戏流程。
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
      case 'poujun_discard': {
        // 托管：AI 随机选择破军弃置的牌
        const pick = wt.choices[Math.floor(Math.random() * wt.choices.length)];
        this.executeGuoheDiscard(wt.target, pick);
        this.addLog(`${wt.source.hero.name}发动【破军】，弃置${wt.target.hero.name}的【${pick.card.name}】`, 'auto');
        this._continueShaAfterPoujun(wt.source, wt.target, wt.card);
        break;
      }
      case 'guanxing': {
        // 托管：随机将一半观星牌放回牌堆底
        const { player, cards, done } = wt;
        const keepTop = Math.floor(Math.random() * (cards.length + 1));
        const top = cards.slice(0, keepTop);
        const bottom = cards.slice(keepTop);
        for (const c of bottom) this.deck.unshift(c);
        for (let i = top.length - 1; i >= 0; i--) this.deck.push(top[i]);
        if (bottom.length > 0) this.addLog(`${player.hero.name}将${bottom.length}张牌置于牌堆底`, 'auto');
        done();
        break;
      }
      case 'guicai': {
        // 托管：AI 司马懿随机替换判定牌
        const sima = wt.sima;
        if (sima.hand.length > 0 && Math.random() < 0.5) {
          const replace = sima.hand[Math.floor(Math.random() * sima.hand.length)];
          this.discardCard(sima, replace);
          this.discardPile.push(wt.judgeCard);
          this.addLog(`${sima.hero.name}发动【鬼才】，弃置${replace.suit}【${replace.name}】替换判定牌`, 'auto');
          wt.callback(replace);
        } else {
          wt.callback(wt.judgeCard);
        }
        break;
      }
      case 'ganglian_source': {
        // 托管：来源默认受1点伤害
        const { target, source } = wt;
        const prev = this._ganglianGuard;
        this._ganglianGuard = true;
        this.dealDamage(source, target, 1);
        this._ganglianGuard = prev;
        this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
        break;
      }
      case 'fankui_source': {
        // 托管：来源随机给一张手牌
        const { target, source } = wt;
        let card;
        if (source.hand.length > 0) {
          card = source.hand[Math.floor(Math.random() * source.hand.length)];
          const idx = source.hand.indexOf(card);
          if (idx >= 0) source.hand.splice(idx, 1);
        } else {
          const slot = ['weapon', 'armor', 'plusHorse', 'minusHorse'].find(s => source.equipment[s]);
          if (slot) { card = source.equipment[slot]; source.equipment[slot] = null; }
        }
        if (card) {
          card.ownerId = target.id;
          target.hand.push(card);
          this.addLog(`${target.hero.name}获得${source.hero.name}的【${card.name}】`, 'auto');
        }
        this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
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
        // 决斗结束后恢复当前出牌方的出牌阶段
        this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
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
        // VFX 治疗特效
        if (typeof VFX !== 'undefined') { VFX.healEffect(t, 1); VFX.skillActivate(wt.player); }
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
    // VFX 治疗特效
    if (typeof VFX !== 'undefined') { VFX.healEffect(target, 1); VFX.skillActivate(player); }
  }

  Game.prototype.startCurrentTurn = function() {
    if (this.gameOver) return;
    this.turnNumber++;
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
    this.jushouUsedThisTurn = false;
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

    // VFX 回合过渡横幅
    if (typeof VFX !== 'undefined') VFX.turnBanner(player.hero.name, player.isHuman);

    // 诸葛亮观星：准备阶段开始，观看牌堆顶牌
    if (player.hero.id === 'zhugeliang' && player.alive) {
      this.triggerGuanxing(player, () => this.resolveJudgePhase(player));
      return;
    }

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
    this._processJudgeCards(player, judgeCards, 0, false, false);
  }

  // 逐张处理判定区的延时锦囊（支持司马懿鬼才替换判定牌）
  Game.prototype._processJudgeCards = function(player, judgeCards, idx, skipPlay, skipDraw) {
    if (idx >= judgeCards.length) {
      if (skipDraw) { return this.goToPlayPhase(player, skipPlay); }
      return this.goToDrawPhase(player, skipPlay);
    }
    const jc = judgeCards[idx];
    const judgeCard = this.drawOne();
    if (!judgeCard) { this._processJudgeCards(player, judgeCards, idx + 1, skipPlay, skipDraw); return; }
    this.addLog(`${player.hero.name}的【${jc.name}】判定：${judgeCard.suit}${judgeCard.number}【${judgeCard.name}】`);
    this.maybeGuicai(player, judgeCard, (finalCard) => {
      if (jc.type === 'lebu') {
        this.discardPile.push(finalCard);
        if (finalCard.suit !== '♥') {
          skipPlay = true;
          this.addLog(`乐不思蜀生效，${player.hero.name}跳过出牌阶段`, 'skill');
        } else { this.addLog('乐不思蜀失效'); }
      } else if (jc.type === 'bingliang') {
        this.discardPile.push(finalCard);
        if (finalCard.suit !== '♣') {
          skipDraw = true;
          this.addLog(`兵粮寸断生效，${player.hero.name}跳过摸牌阶段`, 'skill');
        } else { this.addLog('兵粮寸断失效'); }
      } else if (jc.type === 'shandian') {
        if (finalCard.suit === '♠' && finalCard.number >= 2 && finalCard.number <= 9) {
          this.addLog(`闪电命中！${player.hero.name}受到3点雷电伤害！`, 'damage');
          this.dealDamage(player, null, 3, finalCard);
          this.discardPile.push(finalCard);
        } else {
          this.addLog('闪电未命中，移至下家判定区');
          this.discardPile.push(finalCard);
          const nextP = this.getNextAlivePlayer(player);
          if (nextP) {
            nextP.judgeArea.push(jc);
            this.addLog(`闪电移至${nextP.hero.name}`);
          }
        }
        if (!player.alive) { this.checkGameOver(); this.render(); return; }
      }
      this._processJudgeCards(player, judgeCards, idx + 1, skipPlay, skipDraw);
    });
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

    // 关羽武圣：红色牌当杀使用；赵云龙胆：闪当杀使用（装备牌优先装备）
    let effectiveType = card.type;
    if (!equipTypes.includes(card.type) && card.type !== 'sha') {
      if (player.hero.id === 'guanyu' && isRedSuit(card.suit)) effectiveType = 'sha';
      else if (player.hero.id === 'zhaoyun' && card.type === 'shan') effectiveType = 'sha';
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
    // 诸葛亮空城：无手牌时不能成为【杀】【决斗】目标
    const notKongcheng = (t) => !(t.hero.id === 'zhugeliang' && t.hand.length === 0);
    switch (card.type) {
      case 'sha': {
        const shaRange = this.getShaRange(player);
        return aliveOthers.filter(t => this.calcDistance(player, t, true) <= shaRange && teamOk(t) && notKongcheng(t));
      }
      case 'juedou': return aliveOthers.filter(t => t.hero.id !== 'jiaxu' && teamOk(t) && notKongcheng(t));
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

  // 选择目标：改为在场上玩家面板上直接点选（可选目标金色高亮，不可选目标置灰）
  Game.prototype.showTargetSelection = function(card, targets, callback) {
    this.waitingForTarget = { type: 'target_select', card, targets, callback };
    this.render();
    const overlay = document.getElementById('targetOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  // 点击场上玩家面板选择目标
  Game.prototype.pickTarget = function(pid) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'target_select') return;
    const { targets, callback } = this.waitingForTarget;
    const target = targets.find(t => t.id === pid);
    if (!target || !target.alive) return;
    this.waitingForTarget = null;
    this.selectedCardIdx = -1;
    if (callback) callback(target);
    this.render();
  }

  // 取消目标选择（不消耗手牌）
  Game.prototype.cancelTargetSelect = function() {
    if (this.waitingForTarget && this.waitingForTarget.type === 'target_select') {
      this.waitingForTarget = null;
      this.selectedCardIdx = -1;
      this.render();
    }
  }

  // 兼容旧的弹窗按钮（保留全局函数）
  window._targetSelect = (id) => {
    const g = window.game;
    if (g) g.pickTarget(parseInt(id));
  };
  window._cancelTarget = () => {
    const g = window.game;
    if (g) g.cancelTargetSelect();
  };

  // 判断目标选择状态下某个玩家的显示状态：'selectable' | 'blocked' | null
  Game.prototype.getTargetSelectState = function(player) {
    const wt = this.waitingForTarget;
    if (!wt || wt.type !== 'target_select' || !player) return null;
    if (wt.targets.some(t => t.id === player.id)) return 'selectable';
    return 'blocked';
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
    const isSkillSha = (card.type !== 'sha' && effectiveType === 'sha')
      && (player.hero.id === 'guanyu' || player.hero.id === 'zhaoyun');
    const skillShaName = player.hero.id === 'zhaoyun' ? '【龙胆】' : '【武圣】';
    const desc = isSkillSha ? `发动${skillShaName}将${card.suit}【${card.name}】当【杀】使用` : `使用了【${card.name}】`;
    this.addLog(`${player.hero.name}${desc}${target ? '，目标是' + target.hero.name : ''}`, isSkillSha ? 'skill' : '');

    // 谋黄忠【烈弓】记录花色：使用牌时或成为其他角色使用牌的目标后
    const recordMouSuit = (p, c) => {
      if (p && p.alive && p.hero.id === 'mouhuangzhong' && c && c.suit) {
        if (!p.mouLieGongSuits) p.mouLieGongSuits = [];
        if (!p.mouLieGongSuits.includes(c.suit)) p.mouLieGongSuits.push(c.suit);
      }
    };
    recordMouSuit(player, card);
    if (target) recordMouSuit(target, card);

    // VFX 卡牌飞行 & 技能激活
    if (typeof VFX !== 'undefined') {
      if (target) VFX.cardFly(player, target);
      if (isSkillSha) VFX.skillActivate(player);
    }

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
    // 谋黄忠【烈弓】(谋)：展示牌堆顶X张牌，X=已记录花色数-1，匹配花色数=伤害加成且不可响应
    if (source.hero.id === 'mouhuangzhong' && source.alive) {
      const rec = source.mouLieGongSuits || [];
      const X = Math.max(0, rec.length - 1);
      const shown = [];
      for (let i = 0; i < X; i++) {
        const c = this.drawOne();
        if (c) shown.push(c);
      }
      let boost = 0;
      for (const c of shown) { if (rec.includes(c.suit)) boost++; }
      for (const c of shown) this.discardPile.push(c);
      if (X > 0) {
        this.addLog(`${source.hero.name}发动【烈弓】，亮出牌堆顶${shown.length}张牌（${shown.map(c => `${c.suit}${c.number}`).join('、') || '无'}）`, 'skill');
      }
      source.mouLieGongSuits = [];
      if (boost > 0) {
        this.addLog(`【烈弓】伤害+${boost}，且${target.hero.name}无法使用【闪】响应`, 'skill');
        this._dealShaDamage(source, target, card, boost);
        this.render();
        return;
      }
    }
    // 界徐盛【破军】：出杀后可先弃置目标一张牌
    if (source.hero.id === 'jiexusheng' && source.alive) {
      const poujunChoices = this.buildGuoheChoices(target);
      if (poujunChoices.length > 0) {
        if (source.isHuman && !this.autoPlay) {
          this.waitingForTarget = { type: 'poujun_discard', target, source, card, choices: poujunChoices, blindPick: true };
          this.render();
          return;
        }
        // AI：优先弃置装备，其次随机手牌
        const equipPick = poujunChoices.find(c => c.type === 'equip');
        const pick = equipPick || poujunChoices[Math.floor(Math.random() * poujunChoices.length)];
        this.executeGuoheDiscard(target, pick);
        this.addLog(`${source.hero.name}发动【破军】，弃置${target.hero.name}的【${pick.card.name}】`, 'skill');
        this._continueShaAfterPoujun(source, target, card);
        return;
      }
    }
    this._beginShaResponse(source, target, card, 0);
  }

  // 破军弃牌后继续杀结算（若目标无手牌则伤害+1）
  Game.prototype._continueShaAfterPoujun = function(source, target, card) {
    const boost = target.hand.length === 0 ? 1 : 0;
    if (boost) this.addLog(`【破军】令此【杀】伤害+1`, 'skill');
    this._beginShaResponse(source, target, card, boost);
  }

  // 直接结算杀的伤害（烈弓/铁骑等"不可响应"路径），保证奸雄等受击技能可获取伤害牌
  Game.prototype._dealShaDamage = function(source, target, card, extraBoost = 0) {
    if (!this.pendingDamageCards[target.id]) {
      this.pendingDamageCards[target.id] = { card, shanNeeded: 0, jiuBoost: extraBoost };
    } else if (extraBoost) {
      this.pendingDamageCards[target.id].jiuBoost = (this.pendingDamageCards[target.id].jiuBoost || 0) + extraBoost;
    }
    this.dealDamage(target, source, 1, card);
    delete this.pendingDamageCards[target.id];
  }

  Game.prototype._beginShaResponse = function(source, target, card, poujunBoost = 0) {
    // 黄忠【烈弓】：目标手牌数≥你的体力值 或 你的手牌数≤目标手牌数 → 不可响应
    if (source.hero.id === 'huangzhong' && source.alive
        && (target.hand.length >= source.hp || source.hand.length <= target.hand.length)) {
      this.addLog(`${source.hero.name}发动【烈弓】，${target.hero.name}无法使用【闪】响应`, 'skill');
      this._dealShaDamage(source, target, card, poujunBoost);
      this.render();
      return;
    }
    // 马超【铁骑】：判定为红色则不可响应
    if (source.hero.id === 'machao' && source.alive) {
      const judgeCard = this.drawOne();
      if (judgeCard) {
        this.addLog(`${source.hero.name}发动【铁骑】判定：${judgeCard.suit}${judgeCard.number}【${judgeCard.name}】`, 'skill');
        this.maybeGuicai(source, judgeCard, (jc) => {
          this.discardPile.push(jc);
          if (isRedSuit(jc.suit)) {
            this.addLog(`【铁骑】判定为红色，${target.hero.name}无法使用【闪】响应`, 'skill');
            this._dealShaDamage(source, target, card, poujunBoost);
            this.render();
          } else {
            this.addLog(`【铁骑】判定为黑色，正常结算`, 'skill');
            this._beginShaResponseCore(source, target, card, poujunBoost);
          }
        });
        return;
      }
    }
    this._beginShaResponseCore(source, target, card, poujunBoost);
  }

  Game.prototype._beginShaResponseCore = function(source, target, card, poujunBoost = 0) {
    // 吕布无双：需要2张闪
    const lübuWushuang = source.hero.id === 'lübu';
    const shaText = lübuWushuang ? '发动【无双】需要连续打出2张【闪】' : '需要打出【闪】';
    this.addLog(`${target.hero.name}${shaText}来响应【杀】`);
    const jiuBoost = this.jiuDamageBoost ? 1 : 0;
    if (this.jiuDamageBoost) { this.jiuDamageBoost = false; this.addLog('【酒】效果触发！此【杀】伤害+1', 'skill'); }
    this.pendingDamageCards[target.id] = { card, shanNeeded: lübuWushuang ? 2 : 1, jiuBoost: jiuBoost + poujunBoost };

    if (target.isHuman && !this.autoPlay) {
      this.render();
      this.waitForShanResponse(target, source, card);
    } else {
      setTimeout(() => this.aiRespondToSha(target, source, card), 500);
    }
  }

  Game.prototype.waitForShanResponse = function(target, source, card) {
    // 赵云龙胆：杀可当闪打出
    const zhaoyunSha = target.hero.id === 'zhaoyun' && target.hand.some(c => c.type === 'sha');
    const hasShan = target.hand.some(c => c.type === 'shan') || zhaoyunSha;
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
      const isSkill = (target.hero.id === 'guanyu' || target.hero.id === 'zhaoyun') && withCard.type !== 'shan';
      const skillName = target.hero.id === 'zhaoyun' ? '【龙胆】' : '【武圣】';
      this.discardCard(target, withCard);
      const pd = this.pendingDamageCards[target.id];
      if (pd) pd.shanNeeded = (pd.shanNeeded || 1) - 1;
      if (pd && pd.shanNeeded <= 0) {
        this.waitingForTarget = null;
        delete this.pendingDamageCards[target.id];
        this.addLog(`${target.hero.name}${isSkill ? `发动${skillName}` : ''}打出【闪】，成功闪避`, isSkill ? 'skill' : '');
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
      // VFX 治疗特效
      if (typeof VFX !== 'undefined') VFX.healEffect(player, 1);
    } else {
      this.addLog(`${player.hero.name}体力已满，【桃】无法生效`);
    }
  }

  Game.prototype.resolveJiu = function(player) {
    this.jiuDamageBoost = true;
    this.addLog(`${player.hero.name}使用了【酒】，本回合下一张【杀】伤害+1`, 'skill');
    // VFX 技能激活
    if (typeof VFX !== 'undefined') VFX.skillActivate(player);
    if (player.hp < player.hero.maxHp) this.addLog('（【酒】也可在回合外濒死时当【桃】使用）');
    this.render();
  }

