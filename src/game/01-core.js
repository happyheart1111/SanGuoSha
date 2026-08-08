// Auto-split from game.js — 01-core
  Game.prototype.constructor = function() {
    this.players = [];
    this.deck = [];
    this.discardPile = [];
    this.currentPlayerIdx = 0;
    this.phase = 'idle';
    this.logEntries = [];
    this.shaUsedThisTurn = false;
    this.zhihengUsedThisTurn = false;
    this.jieyinUsedThisTurn = false;
    this.selectedCardIdx = -1;
    this.waitingForTarget = null;
    this.humanPlayerId = null;
    this.gameOver = false;
    this.aiThinking = false;
    this.pendingDamageCards = {};
    this.autoPlay = false; // 托管状态
    this.autoPlayTimer = null;
    this.gameMode = 1;       // 1=1v1, 5=五人, 8=八人, 'ddz'=三人斗地主
    this.isDouDizhu = false; // 斗地主模式开关
    this.ddzBid = null;      // 叫分状态
    this.ddzHeroIds = null;  // 本局选将（用于重开）
    this.feiyangUsedThisTurn = false; // 飞扬每回合限一次
    this.shaUsedCount = 0;   // 出杀计数（地主跋扈可出2张）
    this.rolesRevealed = {}; // 已公开身份
    this.winningTeam = null;
    this.skillModalHero = null;
    this.heroSelectPhase = null;
    this.heroIdList = null;
    this.qingnangUsedThisTurn = false;
    this.yeyanUsedThisTurn = false;
    this.gongxinUsedThisTurn = false;
    this.haoshiUsedThisTurn = false;
    this.kejiEligible = true;
    this.extraShaChances = 0;
    this.tuxiUsedThisTurn = false;
    // PvP 相关
    this._isPvP = false;
    this._pvpWaitingForRemote = false;
    this._pvpRemoteActionQueue = [];
    this._pvpHostHero = null;
    this._pvpGuestHero = null;
    this._pvpHeroPool = null;
    this._pvpTotalPlayers = 0;
    this._pvpGameMode = 0;
    this._pvpActionOverrides = {};
    this._pvpPendingAOE = null;
    this._pvpPendingJuedou = null;
    this._pvpHostHumanId = 0;
    this._pvpGuestHumanId = 1;
    // 渲染防抖 — 合并同一帧内的多次 render() 调用
    this._renderPending = false;
    this._renderRafId = null;
  }

  Game.prototype.destroy = function() {
    if (this._renderRafId) { cancelAnimationFrame(this._renderRafId); this._renderRafId = null; }
    this._renderPending = false;
    this.gameOver = true;
  }

  Game.prototype.initPvP = function(gameMode, totalPlayers, heroPool, hostHeroId, guestHeroId) {
    this.gameMode = gameMode;
    this._isPvP = true;
    
    // 构建英雄列表：0=主机, 1=客机, 其余=AI随机
    const humanHeroIds = [hostHeroId, guestHeroId];
    const usedHeroes = new Set([hostHeroId, guestHeroId]);
    const aiHeroes = heroPool.filter(h => !usedHeroes.has(h));
    
    const heroIds = [];
    for (let i = 0; i < totalPlayers; i++) {
      if (i === 0) heroIds.push(hostHeroId);
      else if (i === 1 && totalPlayers > 1) heroIds.push(guestHeroId);
      else {
        if (aiHeroes.length > 0) {
          heroIds.push(aiHeroes.shift());
        } else {
          const allIds = Object.keys(HEROES);
          const avail = allIds.filter(id => !usedHeroes.has(id));
          if (avail.length > 0) {
            const pick = avail[Math.floor(Math.random() * avail.length)];
            usedHeroes.add(pick);
            heroIds.push(pick);
          }
        }
      }
    }
    
    this.heroIdList = [...heroIds];
    this.rolesRevealed = {};
    this.winningTeam = null;
    
    // 预分配身份（5人+模式）
    let preRoles = null;
    if (gameMode >= 5) {
      const rolePool = buildRolePool(gameMode);
      for (let i = rolePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
      }
      preRoles = rolePool;
    }
    
    // 创建玩家 — 使用数字ID，0=主机人类，1=客机人类
    this.players = heroIds.map((hId, i) => {
      const hero = HEROES[hId];
      return {
        id: i,
        hero: hero,
        hp: hero.hp || hero.maxHp,
        maxHp: hero.maxHp || hero.hp,
        hand: [],
        equipment: { weapon: null, armor: null, plusHorse: null, minusHorse: null },
        judgeArea: [],
        isHuman: i < 2,
        isAI: i >= 2,
        alive: true,
        linked: false,
        role: (preRoles && preRoles[i]) ? preRoles[i] : null,
        seat: i,
        deckPosition: i,
      };
    });
    
    // 身份局：人类玩家查看身份
    if (gameMode >= 5) {
      const humanRole = this.players[0].role;
      this.addLog(`你的身份：${getRoleDisplayName(humanRole)}`, 'important');
    }
    
    // 初始化牌组
    this.initDeck();
    this.dealInitialCards();
    this.currentPlayerIdx = 0;
    this.phase = 'idle';
    this.logEntries = [];
    this.shaUsedThisTurn = false;
    this.gameOver = false;
  }

  Game.prototype.importPvPState = function(state) {
    this._isPvP = true;
    this.gameMode = state.gameMode;
    this.heroIdList = state.players.map(p => HEROES[p.heroId] ? p.heroId : Object.keys(HEROES)[0]);
    this.rolesRevealed = { ...state.rolesRevealed };
    this.winningTeam = state.winningTeam;
    this.currentPlayerIdx = state.currentPlayerIdx;
    this.phase = state.phase;
    this.shaUsedThisTurn = state.shaUsedThisTurn || false;
    this.gameOver = state.gameOver;
    
    // 重建玩家
    this.players = state.players.map((sp, i) => {
      const hero = HEROES[sp.heroId] || Object.values(HEROES)[0];
      return {
        id: i,
        hero: hero,
        hp: sp.hp,
        maxHp: sp.maxHp,
        hand: sp.hand ? sp.hand.map(c => this._reconstructCard(c)) : [],
        equipment: { ...sp.equipment },
        judgeArea: sp.judgeArea ? sp.judgeArea.map(c => this._reconstructCard(c)) : [],
        isHuman: sp.isHuman,
        isAI: !sp.isHuman,
        alive: sp.alive,
        linked: sp.linked,
        role: sp.role || null,
        seat: sp.seat || i,
        deckPosition: sp.seat || i,
      };
    });
    
    this.logEntries = (state.logEntries || []).map(l => ({
      text: l.text || l,
      type: l.type || 'normal',
    }));
  }

  Game.prototype._reconstructCard = function(data) {
    if (!data) return null;
    // 用定义 id（cardDefId）从卡牌库重建完整卡牌，保留 range 等字段
    const def = CARD_DEF[data.cardDefId];
    if (def) {
      const card = { ...def };
      card.id = data.id != null ? data.id : card.id;
      card.cardDefId = data.cardDefId;
      card.suit = data.suit || card.suit;
      card.number = data.number != null ? data.number : card.number;
      card.ownerId = data.ownerId;
      return card;
    }
    // 降级：直接用数据构建
    return {
      id: data.id != null ? data.id : 'unknown',
      cardDefId: data.cardDefId,
      name: data.name || '未知',
      type: data.type || 'unknown',
      category: data.category || 'unknown',
      suit: data.suit || 'none',
      number: data.number != null ? data.number : 0,
      ownerId: data.ownerId,
    };
  }

  Game.prototype.init = function(gameMode, heroIds, preRoles) {
    // gameMode: 数字参数；heroIds: [heroId1, heroId2, ...]
    // preRoles: 预分配身份数组 (5/8人模式时由选角阶段传入)
    // 兼容旧接口：如果 heroIds 不存在，则 humanHeroId = gameMode，使用旧的1v1逻辑
    if (!Array.isArray(heroIds)) {
      return this.initOld(gameMode);
    }
    this.gameMode = gameMode;
    this.humanPlayerId = heroIds[0]; // 人类玩家总是第0位
    this.heroIdList = [...heroIds];
    this.rolesRevealed = {};
    this.winningTeam = null;

    // 创建玩家
    this.players = heroIds.map((hId, i) => ({
      id: i,
      hero: HEROES[hId],
      hp: HEROES[hId].maxHp,
      hand: [],
      equipment: { weapon: null, armor: null, plusHorse: null, minusHorse: null },
      judgeArea: [],
      isHuman: i === 0,
      alive: true,
      linked: false,
      role: (preRoles && preRoles[i]) ? preRoles[i] : null,
      shaQuota: 1,        // 出杀上限：普通1，斗地主地主2（跋扈）
    }));

    // 5人或8人模式：分配身份（已在选角阶段预分配则跳过）
    if (gameMode >= 5) {
      if (preRoles && preRoles.length === this.players.length) {
        // 使用选角阶段预分配的身份
        const humanRole = this.players.find(p => p.isHuman).role;
        this.addLog(`你的身份：${getRoleDisplayName(humanRole)}`, 'important');
      } else {
        // 兼容旧入口：随机分配身份
        const rolePool = buildRolePool(gameMode);
        this.shuffle(rolePool);
        this.players.forEach((p, i) => { p.role = rolePool[i]; });
        const humanRole = this.players.find(p => p.isHuman).role;
        this.addLog(`你的身份：${getRoleDisplayName(humanRole)}`, 'important');
      }
    }

    // 随机分配座位号（所有玩家随机入座，然后按座位排序保证出牌顺序）
    this.assignSeats();

    this.initDeck();
    this.dealInitialCards();

    // 主公加成：多摸一张 + 体力上限+1
    if (gameMode >= 5) {
      const zhugong = this.players.find(p => p.role === 'zhugong');
      if (zhugong) {
        this.drawCard(zhugong);
        zhugong.hp += 1;
        zhugong.hero = {...zhugong.hero, maxHp: zhugong.hero.maxHp + 1};
        this.addLog(`${zhugong.hero.name}（主公）体力上限+1，额外获得一张手牌`);
      }
    }

    // 主公先行动
    this.currentPlayerIdx = gameMode >= 5 ? this.players.findIndex(p => p.role === 'zhugong') : 0;
    if (this.currentPlayerIdx < 0) this.currentPlayerIdx = 0;
    this.phase = 'draw';
    this.selectedCardIdx = -1;
    this.waitingForTarget = null;
    this.gameOver = false;
    this.aiThinking = false;
    this.autoPlay = false;
    this.shaUsedThisTurn = false;
    this.zhihengUsedThisTurn = false;
    this.jieyinUsedThisTurn = false;
    this.logEntries = [];
    this.addLog(`====== ${getGameModeName(gameMode)} 开始 ======`, 'important');
    const humanHero = HEROES[heroIds[0]];
    this.addLog(`你扮演【${humanHero.name}】`);
    if (gameMode >= 5) {
      const humanRole = this.players.find(p => p.isHuman).role;
      this.addLog(`${getRoleSummary(humanRole)}`, 'important');
    } else {
      const otherNames = heroIds.slice(1).map(id => '【' + HEROES[id].name + '】').join('、');
      this.addLog(`对手：${otherNames}`);
    }
    this.startCurrentTurn();
  }

  Game.prototype.initOld = function(humanHeroId) {
    this.gameMode = 1;
    this.humanPlayerId = humanHeroId;
    this.heroIdList = [humanHeroId];
    this.rolesRevealed = {};
    const otherHeroIds = Object.keys(HEROES).filter(id => id !== humanHeroId);
    this.shuffle(otherHeroIds);
    const aiHeroIds = otherHeroIds.slice(0, 2);
    const allHeroIds = [humanHeroId, ...aiHeroIds];
    this.shuffle(allHeroIds);

    this.players = allHeroIds.map(id => ({
      id: id,
      hero: HEROES[id],
      hp: HEROES[id].maxHp,
      hand: [],
      equipment: { weapon: null, armor: null, plusHorse: null, minusHorse: null },
      judgeArea: [],
      isHuman: id === humanHeroId,
      alive: true,
      role: null,
      shaQuota: 1,        // 出杀上限：普通1，斗地主地主2（跋扈）
    }));
    this.assignSeats();
    this.initDeck();
    this.dealInitialCards();
    this.currentPlayerIdx = 0;
    this.phase = 'draw';
    this.selectedCardIdx = -1;
    this.waitingForTarget = null;
    this.gameOver = false;
    this.aiThinking = false;
    this.autoPlay = false;
    this.shaUsedThisTurn = false;
    this.zhihengUsedThisTurn = false;
    this.jieyinUsedThisTurn = false;
    this.logEntries = [];
    this.addLog('========== 游戏开始 ==========', 'important');
    this.addLog(`你扮演【${HEROES[humanHeroId].name}】，对手：${aiHeroIds.map(id => '【' + HEROES[id].name + '】').join('、')}`);
    this.startCurrentTurn();
  }

  Game.prototype.assignSeats = function() {
    const n = this.players.length;
    const zhugongIdx = this.players.findIndex(p => p.role === 'zhugong');
    if (zhugongIdx >= 0) {
      // 身份局：主公固定1号位
      this.players[zhugongIdx].seat = 0;
      const otherSeats = [];
      for (let s = 1; s < n; s++) otherSeats.push(s);
      this.shuffle(otherSeats);
      let si = 0;
      for (let i = 0; i < n; i++) {
        if (this.players[i].seat !== 0) {
          this.players[i].seat = otherSeats[si++];
        }
      }
    } else {
      // 非身份局：全部随机
      const seats = [];
      for (let s = 0; s < n; s++) seats.push(s);
      this.shuffle(seats);
      for (let i = 0; i < n; i++) {
        this.players[i].seat = seats[i];
      }
    }
    // 按座位号排序，使 currentPlayerIdx 递增 = 按座位号顺序出牌
    this.players.sort((a, b) => a.seat - b.seat);
  }

  Game.prototype.initDeck = function() {
    this.deck = [];
    let cardId = 0;
    for (const comp of DECK_COMPOSITION) {
      const def = CARD_DEF[comp.cardId];
      if (!def) continue;
      for (let i = 0; i < comp.count; i++) {
        const suit = SUITS[Math.floor(Math.random() * 4)];
        const num = Math.floor(Math.random() * 13) + 1;
        this.deck.push({
          id: cardId++,
          cardDefId: comp.cardId,
          ...def,
          suit: suit,
          number: num,
        });
      }
    }
    this.shuffle(this.deck);
  }

  Game.prototype._pvpSyncState = function() {
    if (!this._isPvP || !pvpManager || !pvpManager.connected) return;
    if (!pvpManager.isHost) return;
    
    const state = serializeGameState(this);
    // 为客机暴露手牌
    state.players.forEach(p => {
      if (p.id === 1) {
        const gp = this.players[1];
        if (gp && gp.isHuman) {
          p.hand = gp.hand.map(c => ({ id: c.id, name: c.name, suit: c.suit, number: c.number, type: c.type, category: c.category }));
        }
      }
    });
    state._pvpMode = true;
    pvpManager.sendAction('stateSync', state);
  }

  Game.prototype.shuffle = function(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  Game.prototype.dealInitialCards = function() {
    for (const player of this.players) {
      for (let i = 0; i < 4; i++) this.drawCard(player);
    }
  }

  Game.prototype.drawOne = function() {
    if (this.deck.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.deck = [...this.discardPile];
      this.discardPile = [];
      this.shuffle(this.deck);
      this.addLog('牌堆已空，洗入弃牌堆。', 'important');
    }
    return this.deck.pop();
  }

  Game.prototype.discardCard = function(player, card) {
    const idx = player.hand.indexOf(card);
    if (idx >= 0) {
      player.hand.splice(idx, 1);
      this.discardPile.push(card);
    }
  }

