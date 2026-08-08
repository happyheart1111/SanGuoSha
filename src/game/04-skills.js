// ==================== 武将技能模块 ====================
// 所有武将技能的触发、交互与结算：奸雄、天妒、行殇、放逐、苦肉、结姻、武圣、咆哮、
// 仁德、制衡、突袭、雷击、鬼道、恃勇、无双、急救、火计、八阵、克己、英姿、奇袭等。
  Game.prototype.triggerJianxiong = function(target, card) {
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'jianxiong', target, card };
    } else {
      card.ownerId = target.id;
      target.hand.push(card);
      this.addLog(`${target.hero.name}发动【奸雄】，获得了【${card.name}】`, 'skill');
    }
  }

  Game.prototype.humanJianxiong = function(take) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'jianxiong') return;
    const { target, card } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (take) {
      card.ownerId = target.id;
      target.hand.push(card);
      this.addLog(`${target.hero.name}发动【奸雄】，获得了【${card.name}】`, 'skill');
    } else {
      this.discardPile.push(card);
      this.addLog(`${target.hero.name}放弃发动【奸雄】`);
    }
    this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
    this.render();
  }

  Game.prototype.triggerTiandu = function(target) {
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'tiandu', target };
    } else {
      this.drawCard(target, 1);
      this.addLog(`${target.hero.name}发动【天妒】，摸了一张牌`, 'skill');
    }
  }

  Game.prototype.humanTiandu = function(take) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'tiandu') return;
    const { target } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (take) {
      this.drawCard(target, 1);
      this.addLog(`${target.hero.name}发动【天妒】，摸了一张牌`, 'skill');
    } else {
      this.addLog(`${target.hero.name}放弃发动【天妒】`);
    }
    this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
    this.render();
  }

  Game.prototype.triggerFangzhu = function(target, source) {
    if (target.isHuman && !this.autoPlay) {
      // 人类是曹丕，让伤害来源选择
      this.waitingForTarget = { type: 'fangzhu_target', target, source };
      this.render();
    } else if (source.isHuman && !this.autoPlay) {
      // 人类是伤害来源，需要选择
      this.waitingForTarget = { type: 'fangzhu_source', target, source };
      this.render();
    } else {
      // 纯AI处理
      this.doFangzhuAI(source, target);
    }
  }

  Game.prototype.humanFangzhuChoice = function(choice) {
    if (!this.waitingForTarget || !['fangzhu_source', 'fangzhu_target'].includes(this.waitingForTarget.type)) return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (choice === 'discard') {
      if (source.hand.length === 0) { this.addLog('没有手牌可弃，曹丕摸1张牌'); this.drawCard(target, 1); this._resumeSourcePlay(this.players[this.currentPlayerIdx]); }
      else {
        // 进入弃牌选择
        this.waitingForTarget = { type: 'fangzhu_discard', target, source };
        this.render();
        return;
      }
    } else {
      if (choice === 'skip') {
        this.addLog(`${source.hero.name}放弃发动【放逐】`, 'skill');
      } else {
        this.drawCard(target, 1);
        this.addLog(`${target.hero.name}发动【放逐】摸了1张牌`, 'skill');
      }
      this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
    }
    this.render();
  }

  Game.prototype.humanFangzhuDiscard = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'fangzhu_discard') return;
    const { source } = this.waitingForTarget;
    this.waitingForTarget = null;
    const card = source.hand[cardIdx];
    this.discardCard(source, card);
    this.addLog(`${source.hero.name}弃置了【${card.name}】（曹丕【放逐】）`, 'skill');
    this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
    this.render();
  }

  Game.prototype.triggerLeiji = function(target, source) {
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'leiji', target, source };
    } else {
      this.doLeiji(target, source);
    }
  }

  Game.prototype.doLeiji = function(target, source) {
    if (!source.alive) return;
    if (this.deck.length === 0) this.reshuffleDiscard();
    if (this.deck.length === 0) return;
    const judgeCard = this.deck.pop();
    this.addLog(`${target.hero.name}发动【雷击】，判定牌为${judgeCard.suit}【${judgeCard.name}】`, 'skill');
    this.discardPile.push(judgeCard);
    if (judgeCard.suit === '♠' && source.alive) {
      this.addLog(`判定结果为♠，${source.hero.name}受到1点雷电伤害！`, 'damage');
      source.hp--;
      this.addLog(`${source.hero.name}受到1点雷电伤害 (剩余HP: ${source.hp}/${source.hero.maxHp})`, 'damage');
      if (source.hp <= 0) this.handleDying(source);
      this.checkGameOver();
    } else {
      this.addLog(`判定结果不是♠，雷击未触发`, 'skill');
    }
  }

  Game.prototype.humanLeiji = function(take) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'leiji') return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (take) {
      this.doLeiji(target, source);
    } else {
      this.addLog(`${target.hero.name}放弃发动【雷击】`);
    }
    if (!this.gameOver) {
      this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
      this.render();
    }
  }

  Game.prototype.triggerShiyong = function(target, card) {
    this.addLog(`${target.hero.name}发动【恃勇】，获得【${card.name}】并摸一张牌`, 'skill');
    card.ownerId = target.id;
    target.hand.push(card);
    this.drawCard(target, 1);
  }

  Game.prototype.triggerXingshang = function(caopiPlayer) {
    if (!caopiPlayer || !caopiPlayer.alive) return;
    if (this.discardPile.length === 0) return;
    const count = Math.min(2, this.discardPile.length);
    const cards = this.discardPile.splice(-count);
    for (const c of cards) {
      c.ownerId = caopiPlayer.id;
      caopiPlayer.hand.push(c);
    }
    this.addLog(`${caopiPlayer.hero.name}发动【行殇】，从弃牌堆获得${count}张牌`, 'skill');
  }

  Game.prototype.useSkill = function(skillId) {
    const player = this.players[this.currentPlayerIdx];
    if (!player.isHuman || this.phase !== 'play' || this.autoPlay) return;

    switch (skillId) {
      case 'rende': {
        if (player.hand.length === 0) { this.addLog('没有手牌可以给出'); return; }
        const targets = this.players.filter(p => p.alive && p.id !== player.id).filter(this.ddzTargetFilter(player, 'ally'));
        if (targets.length === 0) { this.addLog('没有可给牌的队友'); return; }
        this.showTargetSelection({ name: '仁德', type: 'skill' }, targets, (target) => this.doRende(player, target));
        break;
      }
      case 'zhiheng': {
        if (this.zhihengUsedThisTurn) { this.addLog('本回合已经使用过【制衡】了'); return; }
        if (player.hand.length === 0) { this.addLog('没有手牌可制衡'); return; }
        const count = player.hand.length;
        const cards = [...player.hand];
        for (const c of cards) this.discardCard(player, c);
        this.drawCard(player, count);
        this.zhihengUsedThisTurn = true;
        this.addLog(`${player.hero.name}发动【制衡】，弃置${count}张牌并摸了${count}张牌`, 'skill');
        this.render();
        break;
      }
      case 'kurou': {
        if (player.hp <= 1) { this.addLog('体力不足，无法发动【苦肉】'); return; }
        player.hp--;
        this.drawCard(player, 2);
        this.addLog(`${player.hero.name}发动【苦肉】，失去1点体力并摸2张牌 (HP: ${player.hp}/${player.hero.maxHp})`, 'skill');
        this.render();
        break;
      }
      case 'jieyin': {
        if (this.jieyinUsedThisTurn) { this.addLog('本回合已经使用过【结姻】了'); return; }
        if (player.hand.length < 2) { this.addLog('手牌不足2张，无法发动【结姻】'); return; }
        const targets = this.players.filter(p => p.alive && p.id !== player.id).filter(this.ddzTargetFilter(player, 'ally'));
        if (targets.length === 0) { this.addLog('没有可结姻的队友'); return; }
        this.waitingForTarget = {
          type: 'jieyin_discard',
          player,
          targets: targets,
          selected: [],
        };
        this.render();
        break;
      }
      case 'qingnang': {
        if (this.qingnangUsedThisTurn) { this.addLog('本回合已经使用过【青囊】了'); return; }
        if (player.hand.length === 0) { this.addLog('没有手牌可弃置'); return; }
        const targets = this.players.filter(p => p.alive && p.hp < p.hero.maxHp).filter(this.ddzTargetFilter(player, 'ally'));
        if (targets.length === 0) { this.addLog('没有需要治疗的受伤队友'); return; }
        this.waitingForTarget = { type: 'qingnang_select', player, targets };
        this.render();
        break;
      }
      case 'yeyan': {
        if (this.yeyanUsedThisTurn) { this.addLog('本回合已经使用过【业炎】了'); return; }
        if (player.hand.length < 3) { this.addLog('手牌不足3张，无法发动【业炎】'); return; }
        const yetargets = this.players.filter(p => p.alive && p.id !== player.id).filter(this.ddzTargetFilter(player, 'enemy'));
        if (yetargets.length === 0) { this.addLog('没有可发动【业炎】的敌方目标'); return; }
        this.waitingForTarget = { type: 'yeyan_discard', player, targets: yetargets, selected: [] };
        this.render();
        break;
      }
      case 'gongxin': {
        if (this.gongxinUsedThisTurn) { this.addLog('本回合已经使用过【攻心】了'); return; }
        const gotargets = this.players.filter(p => p.alive && p.id !== player.id && p.hand.length > 0).filter(this.ddzTargetFilter(player, 'enemy'));
        if (gotargets.length === 0) { this.addLog('没有有手牌的敌方目标'); return; }
        if (gotargets.length === 1) { this.doGongxin(player, gotargets[0]); }
        else { this.showTargetSelection({ name: '攻心', type: 'skill' }, gotargets, (t) => this.doGongxin(player, t)); }
        break;
      }
      case 'haoshi': {
        if (this.haoshiUsedThisTurn) { this.addLog('本回合已经使用过【好施】了'); return; }
        if (player.hand.length === 0) { this.addLog('没有手牌可弃置'); return; }
        const hatargets = this.players.filter(p => p.alive && p.hp < p.hero.maxHp).filter(this.ddzTargetFilter(player, 'ally'));
        if (hatargets.length === 0) { this.addLog('没有需要治疗的受伤队友'); return; }
        this.waitingForTarget = { type: 'haoshi_select', player, targets: hatargets };
        this.render();
        break;
      }
    }
  }

  Game.prototype.doRende = function(player, target) {
    const count = player.hand.length;
    const cards = [...player.hand];
    for (const c of cards) {
      const idx = player.hand.indexOf(c);
      if (idx >= 0) player.hand.splice(idx, 1);
      c.ownerId = target.id;
      target.hand.push(c);
    }
    this.addLog(`${player.hero.name}发动【仁德】，将${count}张手牌交给${target.hero.name}`, 'skill');
    if (count >= 2 && player.hp < player.hero.maxHp) {
      player.hp++;
      this.addLog(`${player.hero.name}因【仁德】给出2张以上牌，回复1点体力`, 'heal');
    }
    this.render();
  }

  Game.prototype.humanSelectQingnangTarget = function(target) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'qingnang_select') return;
    const { player } = this.waitingForTarget;
    this.waitingForTarget = null;
    // 自动弃置第一张手牌
    const discardCard = player.hand[0];
    this.discardCard(player, discardCard);
    target.hp++;
    this.qingnangUsedThisTurn = true;
    this.addLog(`${player.hero.name}发动【青囊】，弃置【${discardCard.name}】令${target.hero.name}回复1点体力`, 'skill');
    this.render();
  }

  Game.prototype.humanSelectHaoshiTarget = function(target) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'haoshi_select') return;
    const { player } = this.waitingForTarget;
    this.waitingForTarget = null;
    // 弃置一张手牌
    const discardCard = player.hand[0];
    this.discardCard(player, discardCard);
    target.hp++;
    this.haoshiUsedThisTurn = true;
    this.addLog(`${player.hero.name}发动【好施】，弃置【${discardCard.name}】令${target.hero.name}回复1点体力`, 'skill');
    this.render();
  }

  Game.prototype.humanSelectYeyanDiscard = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'yeyan_discard') return;
    const wt = this.waitingForTarget;
    const idx = wt.selected.indexOf(cardIdx);
    if (idx >= 0) wt.selected.splice(idx, 1);
    else if (wt.selected.length < 3) wt.selected.push(cardIdx);
    if (wt.selected.length >= 3) {
      const player = wt.player;
      const cards = [...wt.selected].sort((a, b) => b - a).map(i => player.hand[i]);
      for (const c of cards) this.discardCard(player, c);
      this.waitingForTarget = null;
      if (wt.targets.length === 1) {
        this.doYeyanDamage(player, wt.targets[0]);
      } else {
        this.showTargetSelection({ name: '业炎', type: 'skill' }, wt.targets, (t) => this.doYeyanDamage(player, t));
      }
    }
    this.render();
  }

  Game.prototype.doYeyanDamage = function(player, target) {
    this.yeyanUsedThisTurn = true;
    this.addLog(`${player.hero.name}发动【业炎】，对${target.hero.name}造成2点火焰伤害！`, 'skill');
    this.dealDamage(target, player, 2, { name: '业炎' });
    this.render();
  }

  Game.prototype.doGongxin = function(player, target) {
    this.gongxinUsedThisTurn = true;
    const heartCard = target.hand.find(c => c.suit === '♥');
    if (heartCard) {
      this.discardCard(target, heartCard);
      this.addLog(`${player.hero.name}发动【攻心】，观看了${target.hero.name}的手牌并弃置♥【${heartCard.name}】`, 'skill');
    } else {
      this.addLog(`${player.hero.name}发动【攻心】，观看了${target.hero.name}的手牌（无♥牌可弃）`, 'skill');
    }
    this.render();
  }

  Game.prototype.transferCard = function(from, to, card) {
    const idx = from.hand.indexOf(card);
    if (idx >= 0) from.hand.splice(idx, 1);
    card.ownerId = to.id;
    to.hand.push(card);
  }

  Game.prototype.resolveShelie = function(player) {
    const revealed = [];
    for (let i = 0; i < 5; i++) {
      const c = this.drawOne();
      if (c) revealed.push(c);
    }
    if (revealed.length === 0) { this.drawCard(player, 2); return; }
    this.addLog(`${player.hero.name}发动【涉猎】，亮出：${revealed.map(c => `${c.suit}【${c.name}】`).join('、')}`, 'skill');
    // 每种花色取1张
    const suits = {};
    for (const c of revealed) {
      if (!c || !c.suit) continue; // 防御：跳过异常牌，避免抽牌堆耗尽/重洗竞态导致的崩溃
      const s = c.suit[0];
      if (!suits[s]) suits[s] = c;
    }
    const keep = Object.values(suits);
    const discard = revealed.filter(c => !keep.includes(c));
    for (const c of keep) { c.ownerId = player.id; player.hand.push(c); }
    for (const c of discard) this.discardPile.push(c);
    this.addLog(`${player.hero.name}获得：${keep.map(c => `【${c.name}】`).join('、')}（共${keep.length}张）`, 'skill');
  }

  Game.prototype.triggerDimengGive = function(player) {
    let others = this.players.filter(p => p.alive && p.id !== player.id);
    if (this.isDouDizhu) others = others.filter(p => this.getAllies(player).some(a => a.id === p.id));
    if (others.length === 0) return;
    let target = others[0];
    for (const o of others) {
      if (o.hand.length < target.hand.length) target = o;
    }
    const card = player.hand[Math.floor(Math.random() * player.hand.length)];
    this.transferCard(player, target, card);
    this.addLog(`${player.hero.name}发动【缔盟】，将【${card.name}】交给了${target.hero.name}`, 'skill');
  }

  Game.prototype.humanSelectJieyinDiscard = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'jieyin_discard') return;
    const wt = this.waitingForTarget;
    const idx = wt.selected.indexOf(cardIdx);
    if (idx >= 0) wt.selected.splice(idx, 1);
    else wt.selected.push(cardIdx);
    this.render();
  }

  Game.prototype.humanSelectJieyin = function() {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'jieyin_discard') return;
    const { player, selected } = this.waitingForTarget;
    if (selected.length < 2) { this.addLog('请选择2张牌弃置'); return; }
    const cards = [...selected].sort((a, b) => b - a).map(i => player.hand[i]);
    const twoCards = cards.slice(0, 2);
    for (const c of twoCards) this.discardCard(player, c);
    this.waitingForTarget = null;
    // 显示可选目标
    this.showTargetSelection({ name: '结姻', type: 'skill' },
      this.players.filter(p => p.alive && p.id !== player.id),
      (target) => {
        if (player.hp < player.hero.maxHp) player.hp++;
        if (target.hp < target.hero.maxHp) target.hp++;
        this.jieyinUsedThisTurn = true;
        this.addLog(`${player.hero.name}发动【结姻】，与${target.hero.name}各回复1点体力`, 'skill');
        this.render();
      });
  }

  Game.prototype.triggerQinyin = function(player) {
    const others = this.players.filter(p => p.alive && p.id !== player.id);
    if (others.length === 0) return;
    this.addLog(`${player.hero.name}发动【琴音】`, 'skill');
    for (const p of others) {
      if (p.hand.length > 0 && (p.isHuman && !this.autoPlay ? false : Math.random() < 0.5)) {
        const c = p.hand[Math.floor(Math.random() * p.hand.length)];
        this.discardCard(p, c);
        this.addLog(`${p.hero.name}选择弃置【${c.name}】`);
      } else {
        this.drawCard(p, 1);
        this.addLog(`${p.hero.name}选择摸1张牌`);
      }
    }
    this.render();
  }

