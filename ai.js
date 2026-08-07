// ==================== AI 逻辑模块 ====================
// 所有 AI 决策方法通过 Game.prototype 扩展

// AI 摸牌阶段
Game.prototype.aiDrawPhase = function(player, skipPlay) {
  // 张辽突袭 AI
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
      this.addLog(`${player.hero.name} 无目标可突袭，摸了2张牌`);
    }
  } else if (player.hero.id === 'shen-lvmeng') {
    // 神吕蒙涉猎
    this.resolveShelie(player);
  } else {
    this.drawCard(player, 2);
    this.addLog(`${player.hero.name} 摸了2张牌`);
  }
  this.phase = 'play';
  this.render();
  if (!skipPlay) {
    setTimeout(() => this.aiPlayPhase(player), 800);
  } else {
    setTimeout(() => this.goToDiscardPhase(player), 600);
  }
};

// AI 出牌阶段入口
Game.prototype.aiPlayPhase = function(player) {
  if (this.phase !== 'play' || this.gameOver) return;
  if (!player.alive) { this.nextPlayer(); return; }

  // AI技能
  this.aiUseSkills(player);

  // 如果技能触发了效果需要等待，延迟出牌
  setTimeout(() => this.aiPlayCards(player), 300);
};

// AI 使用武将技能
Game.prototype.aiUseSkills = function(player) {
  // 孙权制衡
  if (player.hero.id === 'sunquan' && !this.zhihengUsedThisTurn && player.hand.length >= 3) {
    const count = player.hand.length;
    const cards = [...player.hand];
    for (const c of cards) this.discardCard(player, c);
    this.drawCard(player, count);
    this.zhihengUsedThisTurn = true;
    this.addLog(`${player.hero.name}发动【制衡】，弃置${count}张牌并摸了${count}张牌`, 'skill');
  }

  // 刘备仁德
  if (player.hero.id === 'liubei' && player.hand.length >= 3 && player.hp < player.hero.maxHp) {
    const allies = this.players.filter(p => p.alive && p.id !== player.id);
    if (allies.length > 0) {
      const ally = allies.reduce((a, b) => a.hp <= b.hp ? a : b);
      const count = player.hand.length;
      const cards = [...player.hand];
      for (const c of cards) {
        this.discardCard(player, c);
        c.ownerId = ally.id;
        ally.hand.push(c);
      }
      this.addLog(`${player.hero.name}发动【仁德】，将${count}张手牌交给${ally.hero.name}`, 'skill');
      if (count >= 2) { player.hp++; this.addLog(`${player.hero.name}回复1点体力`, 'heal'); }
    }
  }

  // 黄盖苦肉
  if (player.hero.id === 'huanggai' && player.hp > 2 && player.hand.length <= 3) {
    const times = Math.min(2, player.hp - 1);
    for (let i = 0; i < times; i++) {
      if (player.hp <= 1) break;
      player.hp--;
      this.drawCard(player, 2);
      this.addLog(`${player.hero.name}发动【苦肉】，失去1点体力并摸2张牌`, 'skill');
    }
  }

  // 孙尚香结姻
  if (player.hero.id === 'sunshangxiang' && !this.jieyinUsedThisTurn && player.hand.length >= 2
      && (player.hp < player.hero.maxHp)) {
    const ally = this.players.find(p => p.alive && p.id !== player.id && p.hp < p.hero.maxHp);
    if (ally) {
      const cards = player.hand.slice(0, 2);
      for (const c of cards) this.discardCard(player, c);
      if (player.hp < player.hero.maxHp) player.hp++;
      if (ally.hp < ally.hero.maxHp) ally.hp++;
      this.jieyinUsedThisTurn = true;
      this.addLog(`${player.hero.name}发动【结姻】，与${ally.hero.name}各回复体力`, 'skill');
    }
  }
  // 华佗青囊
  if (player.hero.id === 'huatuo' && !this.qingnangUsedThisTurn && player.hand.length >= 1) {
    const injured = this.players.find(p => p.alive && p.hp < p.hero.maxHp);
    if (injured) {
      const card = player.hand[0];
      this.discardCard(player, card);
      injured.hp++;
      this.qingnangUsedThisTurn = true;
      this.addLog(`${player.hero.name}发动【青囊】，弃【${card.name}】令${injured.hero.name}回复1点体力`, 'skill');
    }
  }
  // 神周瑜业炎
  if (player.hero.id === 'shen-zhouyu' && !this.yeyanUsedThisTurn && player.hand.length >= 3) {
    const enemy = this.players.filter(p => p.alive && p.id !== player.id).sort((a, b) => a.hp - b.hp)[0];
    if (enemy) {
      const cards = player.hand.splice(0, 3);
      for (const c of cards) this.discardPile.push(c);
      this.yeyanUsedThisTurn = true;
      this.addLog(`${player.hero.name}发动【业炎】，对${enemy.hero.name}造成2点火焰伤害！`, 'skill');
      this.dealDamage(enemy, player, 2, { name: '业炎' });
    }
  }
  // 神吕蒙攻心
  if (player.hero.id === 'shen-lvmeng' && !this.gongxinUsedThisTurn) {
    const target = this.players.find(p => p.alive && p.id !== player.id && p.hand.some(c => c.suit === '♥'));
    if (target) {
      const heartCard = target.hand.find(c => c.suit === '♥');
      this.discardCard(target, heartCard);
      this.gongxinUsedThisTurn = true;
      this.addLog(`${player.hero.name}发动【攻心】，弃置${target.hero.name}的♥【${heartCard.name}】`, 'skill');
    }
  }
};

// AI 出牌
Game.prototype.aiPlayCards = function(player) {
  if (this.gameOver) return;
  this.render();

  // 装备武器/坐骑/防具
  const equipTypes = ['weapon', 'plusHorse', 'minusHorse', 'armor'];
  const equipIdx = player.hand.findIndex(c => equipTypes.includes(c.type));
  if (equipIdx >= 0) {
    const card = player.hand[equipIdx];
    const slotMap = { weapon: 'weapon', plusHorse: 'plusHorse', minusHorse: 'minusHorse', armor: 'armor' };
    const slot = slotMap[card.type];
    const shouldEquip = !player.equipment[slot] ||
      (card.type === 'weapon' && player.equipment.weapon && card.range > player.equipment.weapon.range);
    if (shouldEquip) {
      player.hand.splice(equipIdx, 1);
      this.equipCard(player, card);
      this.render();
      setTimeout(() => this.aiPlayCards(player), 300);
      return;
    }
  }

  // 无中生有
  const wuzhongIdx = player.hand.findIndex(c => c.type === 'wuzhong');
  if (wuzhongIdx >= 0) {
    const card = player.hand[wuzhongIdx];
    this.discardCard(player, card);
    this.resolveWuzhong(player);
    this.render();
    setTimeout(() => this.aiPlayCards(player), 500);
    return;
  }

  // AOE
  const aoeIdx = player.hand.findIndex(c => c.type === 'nanman' || c.type === 'wanjian');
  if (aoeIdx >= 0) {
    const card = player.hand[aoeIdx];
    this.discardCard(player, card);
    if (card.type === 'nanman') this.resolveNanman(player);
    else this.resolveWanjian(player);
    this.render();
    setTimeout(() => this.aiPlayCards(player), 1000);
    return;
  }

  // 桃园结义
  const taoyuanIdx = player.hand.findIndex(c => c.type === 'taoyuan');
  if (taoyuanIdx >= 0) {
    const card = player.hand[taoyuanIdx];
    this.discardCard(player, card);
    this.resolveTaoyuan(player);
    this.render();
    setTimeout(() => this.aiPlayCards(player), 500);
    return;
  }

  // 五谷丰登
  const wuguIdx = player.hand.findIndex(c => c.type === 'wugu');
  if (wuguIdx >= 0) {
    const card = player.hand[wuguIdx];
    this.discardCard(player, card);
    this.resolveWugu(player);
    this.render();
    setTimeout(() => this.aiPlayCards(player), 500);
    return;
  }

  // 桃主动使用
  if (player.hp < player.hero.maxHp) {
    const taoIdx = player.hand.findIndex(c => c.type === 'tao');
    if (taoIdx >= 0) {
      const card = player.hand[taoIdx];
      this.discardCard(player, card);
      this.resolveTao(player);
      this.render();
      setTimeout(() => this.aiPlayCards(player), 300);
      return;
    }
    // 华佗急救：红色牌当桃
    if (player.hero.id === 'huatuo') {
      const redIdx = player.hand.findIndex(c => isRedSuit(c.suit));
      if (redIdx >= 0) {
        const card = player.hand[redIdx];
        this.discardCard(player, card);
        player.hp++;
        this.addLog(`${player.hero.name}发动【急救】将${card.suit}【${card.name}】当【桃】使用`, 'skill');
        this.render();
        setTimeout(() => this.aiPlayCards(player), 300);
        return;
      }
    }
  }

  // 乐不思蜀/兵粮寸断 - 对敌人使用
  const delayIdx = player.hand.findIndex(c => c.type === 'lebu' || c.type === 'bingliang');
  if (delayIdx >= 0) {
    const card = player.hand[delayIdx];
    const targets = this.players.filter(p => p.alive && p.id !== player.id && p.judgeArea.length < 3);
    if (targets.length > 0) {
      const target = targets.reduce((a, b) => a.hp <= b.hp ? a : b);
      this.discardCard(player, card);
      if (card.type === 'lebu') this.resolveLebu(target);
      else this.resolveBingliang(target);
      this.render();
      setTimeout(() => this.aiPlayCards(player), 500);
      return;
    }
  }
  // 闪电
  const shandianIdx = player.hand.findIndex(c => c.type === 'shandian');
  if (shandianIdx >= 0 && player.judgeArea.length < 3) {
    const card = player.hand[shandianIdx];
    this.discardCard(player, card);
    this.resolveShandian(player);
    this.render();
    setTimeout(() => this.aiPlayCards(player), 500);
    return;
  }

  // 过河拆桥/顺手牵羊
  const toolIdx = player.hand.findIndex(c => c.type === 'guohe' || c.type === 'shunshou');
  if (toolIdx >= 0) {
    const card = player.hand[toolIdx];
    const hasEquip = (p) => p.equipment.weapon || p.equipment.armor || p.equipment.plusHorse || p.equipment.minusHorse;
    const targets = this.players.filter(p => p.alive && p.id !== player.id && (p.hand.length > 0 || (card.type === 'guohe' && hasEquip(p))));
    if (targets.length > 0) {
      const target = targets.reduce((a, b) => a.hp >= b.hp ? a : b);
      this.discardCard(player, card);
      if (card.type === 'guohe') this.resolveGuohe(target);
      else this.resolveShunshou(player, target);
      this.render();
      setTimeout(() => this.aiPlayCards(player), 500);
      return;
    }
  }

  // 决斗
  const juedouIdx = player.hand.findIndex(c => c.type === 'juedou');
  if (juedouIdx >= 0) {
    const card = player.hand[juedouIdx];
    const targets = this.players.filter(p => p.alive && p.id !== player.id);
    if (targets.length > 0) {
      const target = targets.reduce((a, b) => a.hand.length <= b.hand.length ? a : b);
      this.discardCard(player, card);
      this.resolveJuedou(player, target);
      this.render();
      setTimeout(() => this.aiPlayCards(player), 500);
      return;
    }
  }

  // 杀（张飞/诸葛连弩无限次数，加吕蒙不打杀保持克己）
  const liannuBonus = player.equipment.weapon && player.equipment.weapon.id === 'liannu' ? 999 : 0;
  const canSha = player.hero.id === 'zhangfei' || !this.shaUsedThisTurn || liannuBonus > 0;
  // 吕蒙AI：如果手牌多且安全，不打杀以保持克己
  const kejiHold = player.hero.id === 'lvmeng' && player.hand.length > player.hp && player.hp > 1;
  if (canSha && !kejiHold) {
    let shaIdx = player.hand.findIndex(c => c.type === 'sha');
    // 关羽AI：如果没有普通杀，找红牌当杀
    if (shaIdx < 0 && player.hero.id === 'guanyu') {
      shaIdx = player.hand.findIndex(c => c.type !== 'sha' && isRedSuit(c.suit));
    }
    if (shaIdx >= 0) {
      const card = player.hand[shaIdx];
      const shaRange = this.getShaRange(player);
      const targets = this.players.filter(p => p.alive && p.id !== player.id && this.calcDistance(player, p, true) <= shaRange);
      if (targets.length > 0) {
        const target = targets.reduce((a, b) => a.hp <= b.hp ? a : b);
        this.discardCard(player, card);
        if (player.hero.id !== 'zhangfei' && this.extraShaChances <= 0) this.shaUsedThisTurn = true;
        if (this.extraShaChances > 0) this.extraShaChances--;
        const isWusheng = card.type !== 'sha';
        if (isWusheng) this.addLog(`${player.hero.name}发动【武圣】将${card.suit}【${card.name}】当【杀】使用`, 'skill');
        this.resolveSha(player, target, card);
        this.render();
        setTimeout(() => this.aiPlayCards(player), 800);
        return;
      }
    }
  }

  this.endPlayPhase();
};

// AI/自动 弃牌阶段
Game.prototype.aiGoToDiscardPhase = function(player) {
  const maxKeep = player.hp;
  while (player.hand.length > maxKeep) {
    const c = player.hand.pop();
    this.discardPile.push(c);
  }
  if (player.hand.length < 0) player.hand = [];
  this.addLog(`${player.hero.name}弃牌至${maxKeep}张`);
  this.endTurn();
};

// AI 响应杀
Game.prototype.aiRespondToSha = function(target, source, card) {
  const pd = this.pendingDamageCards[target.id];
  const totalNeeded = pd ? (pd.shanNeeded || 1) : 1;
  // 尝试打出一张闪
  const shanCard = target.hand.find(c => c.type === 'shan');
  const guanyuRed = target.hero.id === 'guanyu' ? target.hand.find(c => isRedSuit(c.suit) && c.type !== 'sha') : null;
  const useShan = shanCard || (guanyuRed && (target.hp <= 2 || Math.random() < 0.7));

  if (useShan) {
    const used = shanCard || guanyuRed;
    const isWusheng = target.hero.id === 'guanyu' && used !== shanCard;
    this.discardCard(target, used);
    if (pd) pd.shanNeeded = (pd.shanNeeded || 1) - 1;
    if (pd && pd.shanNeeded <= 0) {
      delete this.pendingDamageCards[target.id];
      this.addLog(`${target.hero.name}${isWusheng ? '发动【武圣】' : ''}打出【闪】，成功闪避${totalNeeded > 1 ? '（无双）' : ''}`, isWusheng ? 'skill' : '');
    } else {
      this.addLog(`${target.hero.name}打出一张【闪】，还需${pd.shanNeeded}张`);
      this.render();
      setTimeout(() => this.aiRespondToSha(target, source, card), 400);
      return;
    }
  } else if (target.equipment.armor && target.equipment.armor.id === 'baguazhen') {
    const judgeCard = this.drawOne();
    if (!judgeCard) {
      this.dealDamage(target, source, 1, card);
    } else {
      this.addLog(`${target.hero.name}发动【八卦阵】判定：${judgeCard.suit}【${judgeCard.name}】`, 'skill');
      this.discardPile.push(judgeCard);
      if (isRedSuit(judgeCard.suit)) {
        if (pd) pd.shanNeeded = (pd.shanNeeded || 1) - 1;
        if (pd && pd.shanNeeded <= 0) {
          delete this.pendingDamageCards[target.id];
          this.addLog('判定红色，视为打出【闪】，成功闪避', 'skill');
        } else {
          this.addLog(`判定红色，视为打出【闪】，还需${pd.shanNeeded}张`);
          this.render();
          setTimeout(() => this.aiRespondToSha(target, source, card), 400);
          return;
        }
      } else {
        this.addLog('判定黑色，【八卦阵】未生效', 'skill');
        this.dealDamage(target, source, 1, card);
      }
    }
  } else {
    this.addLog(`${target.hero.name}无法打出【闪】`);
    this.dealDamage(target, source, 1, card);
  }
  this.render();
};

// AI 响应AOE
Game.prototype.aiRespondToAOE = function(target, source, requiredType) {
  let card;
  if (target.hero.id === 'guanyu') {
    card = target.hand.find(c => c.type === requiredType);
    if (!card) card = target.hand.find(c => isRedSuit(c.suit));
  } else {
    card = target.hand.find(c => c.type === requiredType);
  }
  if (card && (target.hp <= 2 || Math.random() < 0.7)) {
    const isWusheng = target.hero.id === 'guanyu' && card.type !== requiredType;
    this.discardCard(target, card);
    this.addLog(`${target.hero.name}${isWusheng ? '发动【武圣】' : ''}打出【${card.name}】`, isWusheng ? 'skill' : '');
  } else {
    this.addLog(`${target.hero.name}受到1点伤害`, 'damage');
    this.dealDamage(target, source, 1);
  }
};

// AI 响应决斗
Game.prototype.aiRespondJuedou = function(defender, challenger, lübuInvolved) {
  const shaCards = [];
  const needed = lübuInvolved && defender.id !== 'lübu' ? 2 : 1;
  for (let i = 0; i < needed; i++) {
    const sha = defender.hand.find(c => c.type === 'sha' && !shaCards.includes(c));
    if (!sha && defender.hero.id === 'guanyu') {
      const red = defender.hand.find(c => isRedSuit(c.suit) && c.type !== 'sha' && !shaCards.includes(c));
      if (red) shaCards.push(red);
    } else if (sha) shaCards.push(sha);
  }
  if (shaCards.length >= needed) {
    const lastCard = shaCards[shaCards.length - 1];
    for (const c of shaCards) {
      const isWusheng = defender.hero.id === 'guanyu' && c.type !== 'sha';
      this.discardCard(defender, c);
      this.addLog(`${defender.hero.name}${isWusheng ? '发动【武圣】' : ''}打出【杀】响应决斗`, isWusheng ? 'skill' : '');
    }
    this.juedouRound(defender, challenger, lastCard);
  } else {
    this.addLog(`${defender.hero.name}无法打出${needed > 1 ? '足够的' : ''}【杀】，受到1点伤害`);
    this.dealDamage(defender, challenger, 1);
    this.render();
  }
};

// AI 濒死处理
Game.prototype.aiHandleDying = function(player) {
  const huatuoJijiu = player.hero.id === 'huatuo' && player.hand.some(c => isRedSuit(c.suit));
  const taoCard = player.hand.find(c => c.type === 'tao');
  const redCard = huatuoJijiu ? player.hand.find(c => isRedSuit(c.suit)) : null;
  const useCard = taoCard || redCard;
  if (useCard) {
    const isJijiu = huatuoJijiu && useCard !== taoCard;
    this.discardCard(player, useCard);
    player.hp = 1;
    this.addLog(`${player.hero.name}${isJijiu ? '发动【急救】将红色牌当【桃】' : '使用【桃】'}自救，回复至1点体力`, isJijiu ? 'skill' : 'heal');
    return true;
  }
  return false;
};

// AI 放逐
Game.prototype.doFangzhuAI = function(source, target) {
  if (source.hand.length > 1) {
    const card = source.hand[Math.floor(Math.random() * source.hand.length)];
    this.discardCard(source, card);
    this.addLog(`${source.hero.name}选择弃置【${card.name}】（曹丕【放逐】）`, 'skill');
  } else {
    this.drawCard(target, 1);
    this.addLog(`${target.hero.name}发动【放逐】摸了1张牌`, 'skill');
  }
};
