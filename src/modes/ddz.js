// ==================== 斗地主模式模块 ====================
// 三人斗地主玩法完整实现：1 名地主 vs 2 名农民。包含叫分定地主流程、
// 地主专属增益（+1 体力上限、飞扬/跋扈技能）、农民协作机制（同心补偿）。
// 整体复用标准回合结构与卡牌结算，仅在身份分配/团队目标/地主技能三层做差异注入。
// 设计纪律：
// - 任何会伤害/治疗/给牌的目标选择，都必须经过团队感知过滤（getEnemies / getAllies）
// - 数值全部带 rationale，未经 playtest 的标注 [PLACEHOLDER]

const DDZ_BANNED = ['caopi']; // 禁将：放逐/行殇在该节奏下会造成判定死锁，先拉黑

// 地主专属技能
const SKILL_FEIYANG = {
  id: 'feiyang', name: '飞扬', type: 'skill',
  desc: '判定阶段开始时，若你的判定区有牌，你可以弃置两张手牌，并弃置自己判定区的一张牌。每回合限一次。'
};
const SKILL_BAHU = {
  id: 'bahu', name: '跋扈', type: 'locked',
  desc: '锁定技。准备阶段，你摸一张牌；出牌阶段，你使用【杀】的次数上限+1。'
};
// 农民队友阵亡补偿（展示用标记，非武将原技能）
const SKILL_TONGXIN = {
  id: 'tongxin', name: '同心', type: 'skill',
  desc: '当你的农民队友阵亡时，你可以选择摸两张牌或回复1点体力。'
};

// 地主叫分收益倍率（仅用于结算日志，不影响胜负判定逻辑）
const DDZ_BID_MULTIPLIER = { 0: 1, 1: 1, 2: 2, 3: 3 };

// ==================== 入口：选将后进入叫分 ====================

function startDouDizhuBidding(pickedHeroIds) {
  game = new Game();
  window.game = game;
  game.isDouDizhu = true;
  game.ddzHeroIds = [...pickedHeroIds];

  game.players = pickedHeroIds.map((hId, i) => {
    const hero = HEROES[hId];
    return {
      id: i,
      hero: hero,
      hp: hero.maxHp,
      maxHp: hero.maxHp,
      hand: [],
      equipment: { weapon: null, armor: null, plusHorse: null, minusHorse: null },
      judgeArea: [],
      isHuman: i === 0,
      isAI: i !== 0,
      alive: true,
      linked: false,
      role: null,
      seat: i,
      shaQuota: 1,          // 出杀上限：普通1，地主2（跋扈）
      deckPosition: i,
    };
  });

  game.humanPlayerId = 0;
  game.rolesRevealed = {};
  game.winningTeam = null;
  game.currentPlayerIdx = 0;
  game.phase = 'bidding';
  game.aiThinking = false;
  game.autoPlay = false;
  game.gameOver = false;
  game.feiyangUsedThisTurn = false;
  game.shaUsedCount = 0;
  game.logEntries = [];

  // 叫分顺序：随机起手，顺时针（座位增序）轮转
  const startIdx = Math.floor(Math.random() * 3);
  game.ddzBid = {
    order: [0, 1, 2].map(k => (startIdx + k) % 3),
    current: 0,
    highest: 0,
    highestBidder: -1,
    done: false,
    picks: {},
  };

  game.addLog('====== 三人斗地主 开始 ======', 'important');
  game.addLog('每人已从 3 名武将中选好将，现在叫分决定地主', 'info');
  game.render();
  game._advanceBidding();
}

// ==================== 叫分流程 ====================

Game.prototype._advanceBidding = function () {
  const bid = this.ddzBid;
  if (bid.current >= bid.order.length) { this._resolveBidding(); return; }
  const pid = bid.order[bid.current];
  const player = this.players[pid];
  if (!player.alive) { bid.current++; return this._advanceBidding(); }
  this.currentPlayerIdx = pid;
  this.render();
  if (player.isHuman && !this.autoPlay) {
    // 人类点击叫分按钮（renderBidding 提供）
    return;
  }
  setTimeout(() => this._aiBid(player), 700);
};

Game.prototype._recordBid = function (pid, value) {
  const bid = this.ddzBid;
  bid.picks[pid] = value;
  if (value > bid.highest) { bid.highest = value; bid.highestBidder = pid; }
  this.addLog(`${this.players[pid].hero.name} ${value === 0 ? '不叫' : '叫 ' + value + ' 分'}`, value > 0 ? 'important' : 'normal');
  if (value === 3) {
    bid.current = bid.order.length;
    this._resolveBidding();
    return;
  }
  bid.current++;
  if (bid.current >= bid.order.length) {
    this._resolveBidding();
  } else {
    this.render();
    this._advanceBidding();
  }
};

Game.prototype.humanBid = function (value) {
  const bid = this.ddzBid;
  if (!bid || bid.done) return;
  const pid = bid.order[bid.current];
  if (!this.players[pid] || !this.players[pid].isHuman) return;
  if (value !== 0 && value <= bid.highest) {
    this.addLog('叫分必须高于当前最高分');
    this.render();
    return;
  }
  this._recordBid(pid, value);
};

Game.prototype._aiBid = function (player) {
  if (this.gameOver || !this.ddzBid || this.ddzBid.done) return;
  const bid = this.ddzBid;
  if (bid.order[bid.current] !== player.id) return;
  const want = this._aiBidValue(player);
  const choice = want > bid.highest ? want : 0;
  this._recordBid(player.id, choice);
};

// AI 叫分估值：基于武将强度（体力上限 + 爆发/生存技能加权）
Game.prototype._aiBidValue = function (player) {
  const hero = player.hero;
  let strength = hero.maxHp;
  const ids = hero.skills.map(s => s.id);
  if (ids.includes('paoxiao')) strength += 2;        // 张飞：无限杀
  if (ids.includes('wusheng')) strength += 1;        // 关羽：红牌当杀
  if (hero.id === 'lübu') strength += 2;             // 吕布：无双
  if (ids.includes('kurou')) strength += 1;          // 黄盖：苦肉爆发
  if (ids.includes('jianxiong')) strength += 1;      // 曹操：奸雄吸牌
  if (ids.includes('jiu')) strength += 0;            // 酒不在技能里，忽略
  // 映射到叫分档位
  if (strength >= 7) return 3;
  if (strength >= 5) return 2;
  if (strength >= 4) return 1;
  return 0;
};

Game.prototype._resolveBidding = function () {
  const bid = this.ddzBid;
  bid.done = true;
  let landlordIdx;
  if (bid.highestBidder >= 0) landlordIdx = bid.highestBidder;
  else landlordIdx = bid.order[0]; // 全不叫，首位叫分者当地主
  this._setupDouDizhu(landlordIdx);
};

// ==================== 布置战场 ====================

Game.prototype._setupDouDizhu = function (landlordIdx) {
  this.ddzLandlord = landlordIdx;
  this.players.forEach((p, i) => { p.role = (i === landlordIdx) ? 'dizhu' : 'nongmin'; });

  const landlord = this.players[landlordIdx];
  landlord.maxHp += 1;                 // rationale: 1v2 需要兵力补偿，+1 上限是官方设定
  landlord.hp = landlord.maxHp;
  landlord.shaQuota = 2;               // 跋扈：出杀上限 +1
  landlord.hero = {
    ...landlord.hero,
    skills: [...landlord.hero.skills, SKILL_BAHU, SKILL_FEIYANG],
  };

  // 农民：追加【同心】展示标记
  this.players.filter(p => p.role === 'nongmin').forEach(p => {
    p.hero = { ...p.hero, skills: [...p.hero.skills, SKILL_TONGXIN] };
  });

  this.rolesRevealed = {};
  this.players.forEach(p => { this.rolesRevealed[p.id] = true; }); // 斗地主身份全程公开

  this.deck = [];
  this.discardPile = [];
  this.initDeck();
  this.dealInitialCards();

  this.feiyangUsedThisTurn = false;
  this.shaUsedCount = 0;
  this.currentPlayerIdx = landlordIdx;
  this.phase = 'idle';

  this.addLog(`====== 叫分结束：${landlord.hero.name} 成为地主（体力上限+1，拥有【飞扬】【跋扈】） ======`, 'important');
  const human = this.players[0];
  this.addLog(`你的身份：${human.role === 'dizhu' ? '🏴 地主' : '🌾 农民'} —— ${human.role === 'dizhu' ? '击败两名农民！' : '与队友合力击杀地主！'}`);
  this.startCurrentTurn();
};

// ==================== 团队感知（核心：区分敌我） ====================

Game.prototype.getEnemies = function (player) {
  if (!this.isDouDizhu) return this.players.filter(p => p.alive && p.id !== player.id);
  if (player.role === 'dizhu') return this.players.filter(p => p.alive && p.role === 'nongmin');
  return this.players.filter(p => p.alive && p.role === 'dizhu');
};

Game.prototype.getAllies = function (player) {
  if (!this.isDouDizhu) return [];
  return this.players.filter(p => p.alive && p.id !== player.id && p.role === player.role);
};

// 目标过滤：'enemy' 只留敌人，'ally' 只留队友（含自己），用于技能选目标
Game.prototype.ddzTargetFilter = function (player, intent) {
  if (!this.isDouDizhu) return () => true;
  if (intent === 'enemy') return (p) => this.getEnemies(player).some(e => e.id === p.id);
  if (intent === 'ally') return (p) => p.id === player.id || this.getAllies(player).some(a => a.id === p.id);
  return () => true;
};

Game.prototype.getModeName = function () {
  if (this.isDouDizhu) return '三人斗地主';
  return getGameModeName(this.gameMode);
};

// ==================== 地主【飞扬】 ====================

Game.prototype.maybeFeiyang = function (player) {
  const judgeCards = [...player.judgeArea];
  if (player.isHuman && !this.autoPlay) {
    this.waitingForTarget = { type: 'feiyang', player, judgeCards };
    this.render();
    return;
  }
  // AI：存在负面判定（乐/兵粮/闪电）才发动
  const negative = judgeCards.find(j => ['lebu', 'bingliang', 'shandian'].includes(j.type));
  if (negative) {
    this._doFeiyang(player, negative);
  } else {
    this.feiyangUsedThisTurn = true;
    this.resolveJudgePhase(player);
  }
};

Game.prototype._doFeiyang = function (player, judgeCard) {
  const discard = player.hand.slice(0, 2); // 弃两张手牌（AI/自动取前两张）
  for (const c of discard) this.discardCard(player, c);
  const jidx = player.judgeArea.indexOf(judgeCard);
  if (jidx >= 0) player.judgeArea.splice(jidx, 1);
  this.discardPile.push(judgeCard);
  this.feiyangUsedThisTurn = true;
  this.addLog(`${player.hero.name}发动【飞扬】，弃2张手牌并弃置判定区的【${judgeCard.name}】`, 'skill');
  this.resolveJudgePhase(player);
};

Game.prototype.humanFeiyang = function (judgeIdx) {
  if (!this.waitingForTarget || this.waitingForTarget.type !== 'feiyang') return;
  const { player, judgeCards } = this.waitingForTarget;
  this.waitingForTarget = null;
  if (judgeIdx < 0) {
    this.feiyangUsedThisTurn = true;
    this.resolveJudgePhase(player);
    return;
  }
  this._doFeiyang(player, judgeCards[judgeIdx]);
};

// ==================== 农民【同心】 ====================

Game.prototype.triggerNongminBonus = function (mate, deadMate) {
  if (mate.isHuman && !this.autoPlay) {
    this.waitingForTarget = { type: 'nongmin_bonus', mate, deadMate };
    this.render();
    return;
  }
  if (mate.hp < mate.hero.maxHp) {
    mate.hp++;
    this.addLog(`${mate.hero.name}发动【同心】，回复1点体力`, 'heal');
  } else {
    this.drawCard(mate, 2);
    this.addLog(`${mate.hero.name}发动【同心】，摸2张牌`, 'skill');
  }
  this.render();
};

Game.prototype.humanNongminBonus = function (choice) {
  if (!this.waitingForTarget || this.waitingForTarget.type !== 'nongmin_bonus') return;
  const { mate } = this.waitingForTarget;
  this.waitingForTarget = null;
  if (choice === 'heal') {
    mate.hp++;
    this.addLog(`${mate.hero.name}发动【同心】，回复1点体力`, 'heal');
  } else {
    this.drawCard(mate, 2);
    this.addLog(`${mate.hero.name}发动【同心】，摸2张牌`, 'skill');
  }
  this.render();
  this.checkGameOver();
  // 同心结算后恢复出牌回合：阵亡发生在攻击方（地主）的回合内，
  // currentPlayerIdx 仍是该攻击方，需续上其出牌，否则回合永久挂起。
  if (!this.gameOver) this._resumeGameAfterDying(this.players[this.currentPlayerIdx]);
};

// ==================== 叫分界面渲染 ====================

Game.prototype.renderBidding = function () {
  const app = document.getElementById('app');
  const bid = this.ddzBid;
  const current = bid.order[bid.current];
  const curPlayer = (current != null && this.players[current]) ? this.players[current] : null;
  const isHumanTurn = curPlayer && curPlayer.isHuman && !this.autoPlay && !bid.done;

  const heroCards = this.players.map(p => {
    const active = (p.id === current && !bid.done) ? 'border-color:#f0d060;box-shadow:0 0 25px rgba(240,208,96,0.4);transform:scale(1.05);' : '';
    const bidTxt = bid.picks[p.id] !== undefined ? (bid.picks[p.id] === 0 ? '不叫' : bid.picks[p.id] + '分') : '—';
    return `<div style="width:160px;padding:18px;background:linear-gradient(180deg,rgba(30,15,5,0.95),rgba(50,25,10,0.95));border:2px solid #8b6914;border-radius:14px;text-align:center;${active}">
      <div class="hero-avatar ${p.hero.avatarClass}" style="margin:0 auto 8px;width:56px;height:56px;font-size:24px;">${p.hero.name[0]}</div>
      <div style="font-size:17px;font-weight:bold;color:#f0d060;">${p.hero.name}</div>
      <div style="font-size:11px;color:#a08050;margin:3px 0;">${p.hero.title}</div>
      <div style="font-size:12px;color:#c0a060;margin-top:6px;">叫分：${bidTxt}</div>
      ${p.isHuman ? '<div style="font-size:11px;color:#60ff80;">（你）</div>' : ''}
    </div>`;
  }).join('');

  let actionHtml = '';
  if (bid.done) {
    actionHtml = `<p style="color:#f0d060;font-size:18px;">叫分结束，正在布置战场…</p>`;
  } else if (isHumanTurn) {
    const minB = bid.highest + 1;
    const opts = [
      { v: 0, label: '不叫', dis: false },
      { v: 1, label: '叫 1 分', dis: 1 < minB },
      { v: 2, label: '叫 2 分', dis: 2 < minB },
      { v: 3, label: '叫 3 分', dis: 3 < minB },
    ];
    actionHtml = `<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      ${opts.map(o => `<button class="btn ${o.v === 0 ? '' : 'skill-btn'}" ${o.dis ? 'disabled' : ''} onclick="game.humanBid(${o.v})">${o.label}</button>`).join('')}
    </div>
    <p style="color:#806040;font-size:12px;margin-top:8px;">当前最高：${bid.highest === 0 ? '暂无' : bid.highest + ' 分'} · 叫分需高于当前最高（或选不叫）</p>`;
  } else {
    actionHtml = `<p style="color:#a08050;font-size:16px;">${curPlayer.hero.name} 正在考虑叫分…</p>`;
  }

  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:24px;padding:20px;">
      <h1 style="font-size:32px;color:#f0d060;text-shadow:0 0 20px rgba(240,208,96,0.5);">🃏 三人斗地主 · 叫分</h1>
      <p style="color:#c0a060;font-size:14px;">1 名地主对抗 2 名农民，叫分最高者成为地主（全不叫则首位叫分者当地主）</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">${heroCards}</div>
      <div style="background:rgba(0,0,0,0.3);padding:18px 30px;border-radius:14px;text-align:center;min-width:300px;">${actionHtml}</div>
      <button class="btn-outline" onclick="showHeroSelect()" style="margin-top:6px;">⬅ 返回主菜单</button>
    </div>`;
};
