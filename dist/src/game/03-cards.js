// ==================== 卡牌结算模块 ====================
// 锦囊牌使用与效果结算：决斗、过河拆桥、顺手牵羊、南蛮入侵、万箭齐发、火攻、无懈可击、
// 铁索连环等卡牌的完整交互响应流程。
  Game.prototype.resolveJuedou = function(source, target) {
    this.addLog(`${source.hero.name}向${target.hero.name}发起决斗！`, 'important');
    this.juedouRound(source, target);
  }

  Game.prototype.humanRespondJuedou = function(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'juedou_defend') return;
    const { challenger, defender } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (withCard) {
      const isSkill = (defender.hero.id === 'guanyu' || defender.hero.id === 'zhaoyun') && withCard.type !== 'sha';
      const skillName = defender.hero.id === 'zhaoyun' ? '【龙胆】' : '【武圣】';
      this.discardCard(defender, withCard);
      this.addLog(`${defender.hero.name}${isSkill ? `发动${skillName}` : ''}打出【杀】响应决斗`, isSkill ? 'skill' : '');
      // 如果是吕布对非吕布的一方，需要第2张杀
      const lübuInvolved = challenger.hero.id === 'lübu' || defender.hero.id === 'lübu';
      if (lübuInvolved && defender.id !== 'lübu') {
        this.waitingForTarget = { type: 'juedou_defend_second', challenger, defender };
        this.render();
        return;
      }
      this.juedouRound(defender, challenger, withCard);
    } else {
      this.addLog(`${defender.hero.name}无法打出【杀】，受到1点伤害`);
      this.dealDamage(defender, challenger, 1);
      // 决斗结束，恢复的是当前出牌方（决斗发起者所在回合）的出牌阶段
      this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
    }
    this.render();
  }

  Game.prototype.humanRespondJuedouSecond = function(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'juedou_defend_second') return;
    const { challenger, defender } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (withCard) {
      const isSkill = (defender.hero.id === 'guanyu' || defender.hero.id === 'zhaoyun') && withCard.type !== 'sha';
      const skillName = defender.hero.id === 'zhaoyun' ? '【龙胆】' : '【武圣】';
      this.discardCard(defender, withCard);
      this.addLog(`${defender.hero.name}${isSkill ? `发动${skillName}` : ''}打出第2张【杀】响应决斗`, isSkill ? 'skill' : '');
      this.juedouRound(defender, challenger, withCard);
    } else {
      this.addLog(`${defender.hero.name}无法打出第2张【杀】，受到1点伤害`);
      this.dealDamage(defender, challenger, 1);
      // 决斗结束，恢复的是当前出牌方（决斗发起者所在回合）的出牌阶段
      this._resumeSourcePlay(this.players[this.currentPlayerIdx]);
    }
    this.render();
  }

  Game.prototype.buildGuoheChoices = function(target) {
    const list = [];
    target.hand.forEach((c, i) => list.push({ type: 'hand', idx: i, card: c }));
    ['weapon', 'armor', 'plusHorse', 'minusHorse'].forEach(s => {
      if (target.equipment[s]) list.push({ type: 'equip', slot: s, card: target.equipment[s] });
    });
    target.judgeArea.forEach((c, i) => list.push({ type: 'judge', idx: i, card: c }));
    return list;
  }

  Game.prototype.executeGuoheDiscard = function(target, pick) {
    if (pick.type === 'hand') {
      const idx = target.hand.indexOf(pick.card);
      if (idx >= 0) this.discardCard(target, pick.card);
    } else if (pick.type === 'equip') {
      target.equipment[pick.slot] = null;
      this.discardPile.push(pick.card);
    } else if (pick.type === 'judge') {
      target.judgeArea = target.judgeArea.filter((c, i) => i !== pick.idx);
      this.discardPile.push(pick.card);
    }
  }

  Game.prototype.resolveGuohe = function(target) {
    const choices = this.buildGuoheChoices(target);
    if (choices.length === 0) {
      this.addLog(`${target.hero.name}没有可弃置的牌`);
      this.render();
      return;
    }

    // 目标是人类且非托管：让目标自己选
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'guohe_discard', target, source: this.players[this.currentPlayerIdx], choices };
      this.render();
      return;
    }

    // 出牌者是人类且非托管（目标为AI或托管人类）：让出牌者盲选
    const sourcePlayer = this.players[this.currentPlayerIdx];
    if (sourcePlayer && sourcePlayer.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'guohe_discard', target, source: sourcePlayer, choices, blindPick: true };
      this.render();
      return;
    }

    // AI / 随机选择
    const pick = choices[Math.floor(Math.random() * choices.length)];
    this.executeGuoheDiscard(target, pick);
    this.addLog(`${target.hero.name}的【${pick.card.name}】被过河拆桥弃置`);
    this.render();
  }

  Game.prototype.humanGuoheDiscard = function(pickObj) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'guohe_discard') return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    this.executeGuoheDiscard(target, pickObj);
    this.addLog(`${target.hero.name}的【${pickObj.card.name}】被过河拆桥弃置`);
    this.render();
    // 如果是 AI 或托管人类对玩家使用，完成后继续出牌阶段
    if (source && (!source.isHuman || (source.isHuman && this.autoPlay))) {
      setTimeout(() => this.aiPlayCards(source), 140);
    }
  }

  Game.prototype.humanGuoheDiscardEquip = function(slot) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'guohe_discard') return;
    const { target } = this.waitingForTarget;
    const card = target.equipment[slot];
    if (!card) return;
    this.humanGuoheDiscard({ type: 'equip', slot, card });
  }

  Game.prototype.humanGuoheDiscardJudge = function(idx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'guohe_discard') return;
    const { target } = this.waitingForTarget;
    const card = target.judgeArea[idx];
    if (!card) return;
    this.humanGuoheDiscard({ type: 'judge', idx, card });
  }

  Game.prototype.resolveHuogong = function(source, target) {
    this.addLog(`${source.hero.name}对${target.hero.name}使用了【火攻】`, 'skill');
    if (target.hand.length === 0) {
      this.addLog(`${target.hero.name}没有手牌，【火攻】无法生效`);
      this.render();
      return;
    }
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'huogong_show', target, source };
      this.render();
      return;
    }
    // AI 随机展示手牌
    const showCard = target.hand[Math.floor(Math.random() * target.hand.length)];
    this.addLog(`${target.hero.name}展示了【${showCard.name}】(${showCard.suit})`, 'skill');
    this.doHuogongDiscard(source, target, showCard.suit);
  }

  Game.prototype.humanShowCardForHuogong = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'huogong_show') return;
    const { target, source } = this.waitingForTarget;
    const showCard = target.hand[cardIdx];
    if (!showCard) return;
    this.waitingForTarget = null;
    this.addLog(`${target.hero.name}展示了【${showCard.name}】(${showCard.suit})`, 'skill');
    this.doHuogongDiscard(source, target, showCard.suit);
    if (!this.waitingForTarget) this._resumeSourcePlay(source);
    this.render();
  }

  Game.prototype.doHuogongDiscard = function(source, target, suit) {
    const matchCards = source.hand.filter(c => c.suit === suit);
    if (matchCards.length === 0) {
      this.addLog(`${source.hero.name}没有与${suit}同花色的手牌，【火攻】取消`, 'skill');
      return;
    }
    if (source.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'huogong_discard', target, source, suit };
      this.render();
      return;
    }
    // AI 选择同花色牌弃置
    const discard = matchCards[Math.floor(Math.random() * matchCards.length)];
    this.discardCard(source, discard);
    this.addLog(`${source.hero.name}弃置【${discard.name}】对${target.hero.name}造成1点火焰伤害`, 'damage');
    this.dealDamage(target, source, 1);
    this.render();
  }

  Game.prototype.humanDiscardForHuogong = function(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'huogong_discard') return;
    const { target, source, suit } = this.waitingForTarget;
    const card = source.hand[cardIdx];
    if (!card || card.suit !== suit) return;
    this.waitingForTarget = null;
    this.discardCard(source, card);
    this.addLog(`${source.hero.name}弃置【${card.name}】对${target.hero.name}造成1点火焰伤害`, 'damage');
    this.dealDamage(target, source, 1);
    if (!this.waitingForTarget) this._resumeSourcePlay(source);
    this.render();
  }

  Game.prototype.showTiesuoSelect = function(player, card) {
    const app = document.getElementById('app');
    const candidates = this.players.filter(p => p.alive);
    const selected = new Set();
    let selectHtml = '';
    candidates.forEach(p => {
      const linkedMark = p.linked ? ' (横置)' : '';
      selectHtml += `<div onclick="game.toggleTiesuoTarget(${p.id})" data-tid="${p.id}" 
        style="padding:10px 16px;border:2px solid #8b6914;border-radius:8px;cursor:pointer;text-align:center;background:rgba(30,15,5,0.8);">
        ${p.hero.name}${linkedMark}</div>`;
    });
    const selLen = selected.size;
    app.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:20px;">
        <h1 style="color:#f0d060;">⛓️ 铁索连环</h1>
        <p style="color:#a08050;">选择1~2名角色横置/重置（已选: <span id="tiesuo-count">0</span>）</p>
        <div id="tiesuo-targets" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">${selectHtml}</div>
        <div style="margin-top:15px;display:flex;gap:15px;">
          <button onclick="game.confirmTiesuo()" style="padding:10px 28px;background:#8b6914;border:none;border-radius:6px;color:white;cursor:pointer;font-size:16px;">确认使用</button>
          <button onclick="game.reforgeTiesuo()" style="padding:10px 28px;background:#555;border:none;border-radius:6px;color:#ccc;cursor:pointer;font-size:16px;">重铸（弃牌摸1张）</button>
        </div>
      </div>`;
    this.tieSuoSelecting = { player, card, selected, candidates };
  }

  Game.prototype.toggleTiesuoTarget = function(pid) {
    if (!this.tieSuoSelecting) return;
    const ts = this.tieSuoSelecting;
    if (ts.selected.has(pid)) {
      ts.selected.delete(pid);
    } else {
      if (ts.selected.size >= 2) return;
      ts.selected.add(pid);
    }
    document.getElementById('tiesuo-count').textContent = ts.selected.size;
    const targetDivs = document.querySelectorAll('[data-tid]');
    targetDivs.forEach(div => {
      const tid = parseInt(div.getAttribute('data-tid'));
      div.style.borderColor = ts.selected.has(tid) ? '#f0d060' : '#8b6914';
      div.style.background = ts.selected.has(tid) ? 'rgba(240,208,96,0.2)' : 'rgba(30,15,5,0.8)';
    });
  }

  Game.prototype.confirmTiesuo = function() {
    if (!this.tieSuoSelecting) return;
    const { player, card, selected } = this.tieSuoSelecting;
    this.tieSuoSelecting = null;
    this.discardCard(player, card);
    const targets = [...selected].map(id => this.players[id]);
    for (const t of targets) {
      t.linked = !t.linked;
      this.addLog(`${t.hero.name}被${t.linked ? '横置' : '重置'}（铁索连环）`, 'skill');
    }
    this.render();
  }

  Game.prototype.reforgeTiesuo = function() {
    if (!this.tieSuoSelecting) return;
    const { player, card } = this.tieSuoSelecting;
    this.tieSuoSelecting = null;
    this.discardCard(player, card);
    this.drawCard(player, 1);
    this.addLog(`${player.hero.name}重铸【铁索连环】，摸1张牌`);
    this.render();
  }

  Game.prototype.resolveTiesuo = function(player) {
    // AI 简单处理：随机选择1~2个目标
    const candidates = this.players.filter(p => p.alive);
    const count = Math.min(2, 1 + Math.floor(Math.random() * Math.min(2, candidates.length)));
    const shuffled = [...candidates];
    this.shuffle(shuffled);
    const targets = shuffled.slice(0, count);
    for (const t of targets) {
      t.linked = !t.linked;
      this.addLog(`${t.hero.name}被${t.linked ? '横置' : '重置'}（铁索连环）`, 'skill');
    }
    this.render();
  }

  Game.prototype.resolveLebu = function(target) {
    target.judgeArea.push(CARD_DEF['lebu']);
    this.addLog(`【乐不思蜀】被置于${target.hero.name}的判定区`);
    this.render();
  }

  Game.prototype.resolveBingliang = function(target) {
    target.judgeArea.push(CARD_DEF['bingliang']);
    this.addLog(`【兵粮寸断】被置于${target.hero.name}的判定区`);
    this.render();
  }

  Game.prototype.resolveShandian = function(player) {
    player.judgeArea.push(CARD_DEF['shandian']);
    this.addLog(`【闪电】被置于${player.hero.name}的判定区`);
    this.render();
  }

  Game.prototype.resolveShunshou = function(source, target) {
    const choices = this.buildGuoheChoices(target);
    if (choices.length === 0) {
      this.addLog(`${target.hero.name}没有可顺的牌`);
      this.render();
      return;
    }

    // 目标是人类且非托管：让目标自己选
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'shunshou_steal', target, source, choices };
      this.render();
      return;
    }

    // 出牌者是人类且非托管（目标为AI或托管人类）：让出牌者盲选
    if (source.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'shunshou_steal', target, source, choices, blindPick: true };
      this.render();
      return;
    }

    // AI / 随机选择
    const pick = choices[Math.floor(Math.random() * choices.length)];
    this.executeShunshouSteal(source, target, pick);
    const areaName = pick.type === 'hand' ? '手牌' : pick.type === 'equip' ? '装备' : '判定区';
    this.addLog(`${source.hero.name}顺手牵羊从${target.hero.name}${areaName}获得了【${pick.card.name}】`);
    this.render();
  }

  Game.prototype.executeShunshouSteal = function(source, target, pick) {
    if (pick.type === 'hand') {
      const idx = target.hand.indexOf(pick.card);
      if (idx >= 0) {
        target.hand.splice(idx, 1);
        pick.card.ownerId = source.id;
        source.hand.push(pick.card);
      }
    } else if (pick.type === 'equip') {
      target.equipment[pick.slot] = null;
      pick.card.ownerId = source.id;
      source.hand.push(pick.card);
    } else if (pick.type === 'judge') {
      // 从判定区直接移入自己的手牌（保留同一卡牌实例）
      const idx = target.judgeArea.indexOf(pick.card);
      if (idx >= 0) target.judgeArea.splice(idx, 1);
      pick.card.ownerId = source.id;
      source.hand.push(pick.card);
    }
  }

  Game.prototype.humanShunshouSteal = function(pickObj) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shunshou_steal') return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    this.executeShunshouSteal(source, target, pickObj);
    const areaName = pickObj.type === 'hand' ? '手牌' : pickObj.type === 'equip' ? '装备' : '判定区';
    this.addLog(`${source.hero.name}顺手牵羊从${target.hero.name}${areaName}获得了【${pickObj.card.name}】`);
    this.render();
    // 如果是 AI 或托管人类对玩家使用，完成后继续出牌阶段
    if (source && (!source.isHuman || (source.isHuman && this.autoPlay))) {
      setTimeout(() => this.aiPlayCards(source), 140);
    }
  }

  Game.prototype.humanShunshouStealEquip = function(slot) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shunshou_steal') return;
    const { target } = this.waitingForTarget;
    const card = target.equipment[slot];
    if (!card) return;
    this.humanShunshouSteal({ type: 'equip', slot, card });
  }

  Game.prototype.humanShunshouStealJudge = function(idx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shunshou_steal') return;
    const { target } = this.waitingForTarget;
    const card = target.judgeArea[idx];
    if (!card) return;
    this.humanShunshouSteal({ type: 'judge', idx, card });
  }

  // 盲选手牌（过河拆桥/顺手牵羊/破军时，出牌者看不见牌面，仅按位置选择）
  Game.prototype.humanBlindPickHand = function(type, choiceIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== type) return;
    const filtered = this.waitingForTarget.choices.filter(c => c.type === 'hand');
    if (choiceIdx < 0 || choiceIdx >= filtered.length) return;
    const pick = filtered[choiceIdx];
    if (type === 'guohe_discard') {
      this.humanGuoheDiscard(pick);
    } else if (type === 'shunshou_steal') {
      this.humanShunshouSteal(pick);
    } else if (type === 'poujun_discard') {
      this.humanPoujunDiscard(pick);
    }
  }

  // ===== 界徐盛【破军】：弃置目标一张牌，若目标因此无手牌则此杀伤害+1 =====
  Game.prototype.humanPoujunDiscard = function(pickObj) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'poujun_discard') return;
    const { target, source, card } = this.waitingForTarget;
    this.waitingForTarget = null;
    this.executeGuoheDiscard(target, pickObj);
    this.addLog(`${source.hero.name}发动【破军】，弃置${target.hero.name}的【${pickObj.card.name}】`, 'skill');
    this._continueShaAfterPoujun(source, target, card);
    this.render();
  }

  Game.prototype.humanPoujunDiscardEquip = function(slot) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'poujun_discard') return;
    const { target } = this.waitingForTarget;
    const card = target.equipment[slot];
    if (!card) return;
    this.humanPoujunDiscard({ type: 'equip', slot, card });
  }

  Game.prototype.humanPoujunDiscardJudge = function(idx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'poujun_discard') return;
    const { target } = this.waitingForTarget;
    const card = target.judgeArea[idx];
    if (!card) return;
    this.humanPoujunDiscard({ type: 'judge', idx, card });
  }

  Game.prototype.resolveWuzhong = function(player) {
    this.drawCard(player, 2);
    this.addLog(`${player.hero.name}使用了无中生有，摸2张牌`);
  }

  Game.prototype.resolveNanman = function(source) {
    this.addLog(`${source.hero.name}使用了【南蛮入侵】！所有人需打出【杀】`, 'important');
    this.resolveAOE(source, 'sha', '南蛮入侵');
  }

  Game.prototype.resolveWanjian = function(source) {
    this.addLog(`${source.hero.name}使用了【万箭齐发】！所有人需打出【闪】`, 'important');
    this.resolveAOE(source, 'shan', '万箭齐发');
  }

  Game.prototype.resolveAOE = function(source, requiredType, aoeName) {
    const targets = this.players.filter(p => p.alive && p.id !== source.id);
    this.processAOETargets(source, targets, requiredType, 0);
  }

  Game.prototype.processAOETargets = function(source, targets, requiredType, idx) {
    if (idx >= targets.length) { this._resumeSourcePlay(source); return; }
    const target = targets[idx];

    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = {
        type: 'aoe_response', source, target, requiredType,
        remaining: targets.slice(idx + 1), aoeIdx: idx, targets,
      };
      let hasCard = target.hand.some(c => c.type === requiredType);
      if (target.hero.id === 'guanyu') {
        if (requiredType === 'sha') hasCard = target.hand.some(c => c.type === 'sha' || isRedSuit(c.suit));
        if (requiredType === 'shan') hasCard = target.hand.some(c => c.type === 'shan' || isRedSuit(c.suit));
      }
      if (target.hero.id === 'zhaoyun') {
        // 赵云龙胆：杀/闪互换
        hasCard = target.hand.some(c => c.type === requiredType
          || (requiredType === 'sha' ? c.type === 'shan' : c.type === 'sha'));
      }
      if (!hasCard) {
        setTimeout(() => {
          this.waitingForTarget = null;
          this.addLog(`${target.hero.name}没有【${requiredType === 'sha' ? '杀' : '闪'}】，受到1点伤害`, 'damage');
          this.dealDamage(target, source, 1);
          this.processAOETargets(source, targets, requiredType, idx + 1);
          this.render();
        }, 300);
      }
      this.render();
      return;
    }

    // AI响应AOE
    this.aiRespondToAOE(target, source, requiredType);
    this.render();
    setTimeout(() => this.processAOETargets(source, targets, requiredType, idx + 1), 400);
  }

  Game.prototype.humanRespondAOE = function(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'aoe_response') return;
    const { source, target, requiredType, targets, aoeIdx } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (withCard) {
      const isSkill = (target.hero.id === 'guanyu' || target.hero.id === 'zhaoyun') && withCard.type !== requiredType;
      const skillName = target.hero.id === 'zhaoyun' ? '【龙胆】' : '【武圣】';
      this.discardCard(target, withCard);
      this.addLog(`${target.hero.name}${isSkill ? `发动${skillName}` : ''}打出【${withCard.name}】`, isSkill ? 'skill' : '');
    } else {
      this.addLog(`${target.hero.name}受到1点伤害`, 'damage');
      this.dealDamage(target, source, 1);
    }
    this.render();
    const nextIdx = aoeIdx + 1;
    if (nextIdx >= targets.length) {
      // 所有AOE目标已处理完毕，恢复出牌
      this._resumeSourcePlay(source);
    } else {
      setTimeout(() => this.processAOETargets(source, targets, requiredType, nextIdx), 400);
    }
  }

  Game.prototype.resolveTaoyuan = function(player) {
    this.addLog(`${player.hero.name}使用了【桃园结义】！`, 'important');
    for (const p of this.players) {
      if (p.alive && p.hp < p.hero.maxHp) {
        p.hp++;
        this.addLog(`${p.hero.name}回复了1点体力`, 'heal');
      }
    }
  }

  Game.prototype.resolveWugu = function(player) {
    this.addLog(`${player.hero.name}使用了【五谷丰登】！`, 'important');
    const count = this.players.filter(p => p.alive).length;
    const revealed = [];
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        this.deck = [...this.discardPile];
        this.discardPile = [];
        this.shuffle(this.deck);
      }
      const c = this.deck.pop();
      if (c) revealed.push(c);
    }
    const alive = this.players.filter(p => p.alive);
    for (let i = 0; i < alive.length; i++) {
      const p = alive[i];
      const card = revealed[i];
      if (card) {
        card.ownerId = p.id;
        p.hand.push(card);
        this.addLog(`${p.hero.name}获得了【${card.name}】`);
      }
    }
  }

