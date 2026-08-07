// ==================== 游戏引擎 ====================

class Game {
  constructor() {
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
    this.gameMode = 1;       // 1=1v1, 5=五人, 8=八人
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

  // ========== 销毁清理 ==========
  destroy() {
    if (this._renderRafId) { cancelAnimationFrame(this._renderRafId); this._renderRafId = null; }
    this._renderPending = false;
    this.gameOver = true;
  }
  
  // ========== PvP 初始化 ==========
  initPvP(gameMode, totalPlayers, heroPool, hostHeroId, guestHeroId) {
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
  
  // ========== PvP 状态恢复（客机） ==========
  importPvPState(state) {
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
  
  // ========== 从序列化数据重建卡牌对象 ==========
  _reconstructCard(data) {
    if (!data) return null;
    // 尝试从卡牌库匹配
    const def = CARD_DEF[data.id];
    if (def) {
      const card = { ...def };
      card.suit = data.suit || card.suit;
      card.number = data.number || card.number;
      return card;
    }
    // 降级：直接用数据构建
    return {
      id: data.id || 'unknown',
      name: data.name || '未知',
      type: data.type || 'unknown',
      category: data.category || 'unknown',
      suit: data.suit || 'none',
      number: data.number || 0,
    };
  }

  init(gameMode, heroIds, preRoles) {
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

  initOld(humanHeroId) {
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

  // 分配座位号：主公固定1号位（seat 0），其余玩家随机分配 2~N 号位
  // 非身份局则全部随机
  assignSeats() {
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

  initDeck() {
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

  // ========== PvP 远程动作处理 ==========
  
  _pvpRemotePlayCard(payload) {
    const { playerId, cardIdx, targetPlayerIdx, equipSlot: eSlot } = payload;
    const player = this.players[playerId];
    if (!player || !player.alive) return;
    
    const card = player.hand[cardIdx];
    if (!card) return;
    
    // 根据卡牌类型，我们需要触发本地播放逻辑
    // 由于 guest 端也需要模拟主机端的动作，这里调用对应的 resolve 方法
    if (card.type === 'basic') {
      if (card.id === 'sha') {
        // 杀 - 需要找到目标
        if (targetPlayerIdx !== undefined && this.players[targetPlayerIdx]) {
          this._pvpPlayShaRemote(player, card, cardIdx, this.players[targetPlayerIdx]);
        }
      } else if (card.id === 'tao') {
        player.hand.splice(cardIdx, 1);
        this.heal(player, 1);
        this.render();
      } else if (card.id === 'jiu') {
        this.resolveJiu(player, cardIdx);
      }
    } else if (card.type === 'trick') {
      if (targetPlayerIdx !== undefined) {
        this._pvpPlayTrickRemote(player, card, cardIdx, this.players[targetPlayerIdx], eSlot);
      }
    } else if (card.type === 'equip') {
      this._pvpEquipRemote(player, card, cardIdx);
    }
  }
  
  _pvpPlayShaRemote(player, card, cardIdx, target) {
    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);
    
    if (this.gameMode === 1) {
      target = this.players.find(p => p.id !== player.id && p.alive);
      if (!target) return;
    }
    
    // 检查目标是否有闪
    const shanCard = target.hand.find(c => c.id === 'shan');
    if (!shanCard) {
      this.dealDamage(target, 1);
      this.render();
    }
    // 如果有闪，AI玩家自动使用，人类玩家等待
  }
  
  _pvpPlayTrickRemote(player, card, cardIdx, target, equipSlot) {
    player.hand.splice(cardIdx, 1);
    if (card.id === 'guohe') {
      if (equipSlot) {
        // 弃置装备
        target.equipment[equipSlot] = null;
        this.discardPile.push(card);
      } else {
        this.discardPile.push(card);
      }
    } else if (card.id === 'shunshou') {
      if (equipSlot) {
        player.equipment[equipSlot] = target.equipment[equipSlot];
        target.equipment[equipSlot] = null;
      }
    }
    this.render();
  }
  
  _pvpEquipRemote(player, card, cardIdx) {
    player.hand.splice(cardIdx, 1);
    const slot = card.equipSlot;
    if (slot && player.equipment[slot] !== undefined) {
      if (player.equipment[slot]) {
        this.discardPile.push(player.equipment[slot]);
      }
      player.equipment[slot] = card;
    }
    this.render();
  }
  
  _pvpRemoteRespond(payload) {
    const { playerId, cardIdx } = payload;
    this._pvpRespondData = { playerId, cardIdx }; // 存储响应数据供后续使用
  }
  
  _pvpRemoteEndPhase(payload) {
    const { playerId } = payload;
    this._pvpNextPhase = true; // 标记推进阶段
  }
  
  _pvpRemotePlayShan(payload) {
    const { playerId, cardIdx } = payload;
    this._pvpShanData = { playerId, cardIdx };
  }
  
  _pvpRemoteUseSkill(payload) {
    this._pvpSkillData = payload;
  }
  
  _pvpRemoteHeroPick(payload) {
    this._pvpHeroPickData = payload;
  }
  
  _pvpRemoteGuoheDiscard(payload) {
    this._pvpGuoheData = payload;
  }
  
  _pvpRemoteShunshouSteal(payload) {
    this._pvpShunshouData = payload;
  }
  
  _pvpRemoteTiesuoSelect(payload) {
    this._pvpTiesuoData = payload;
  }
  
  _pvpRemoteTiesuoReforge(payload) {
    this._pvpTiesuoReforgeDone = true;
  }
  
  _pvpRemoteHuogongShow(payload) {
    this._pvpHuogongShowData = payload;
  }
  
  _pvpRemoteHuogongDiscard(payload) {
    this._pvpHuogongDiscardData = payload;
  }
  
  _pvpRemoteFangzhuChoice(payload) {
    this._pvpFangzhuData = payload;
  }
  
  _pvpRemoteJianxiongChoice(payload) {
    this._pvpJianxiongData = payload;
  }
  
  _pvpRemoteTianduChoice(payload) {
    this._pvpTianduData = payload;
  }
  
  _pvpRemoteLeijiChoice(payload) {
    this._pvpLeijiData = payload;
  }
  
  _pvpRemoteDiscardCards(payload) {
    this._pvpDiscardData = payload;
  }
  
  _pvpRemoteAiAction(payload) {
    // 仅客机处理：主机发来的AI动作
    if (pvpManager && !pvpManager.isHost) {
      this._pvpAiActionData = payload;
    }
  }

  // ========== PvP 状态同步 ==========
  _pvpSyncState() {
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

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  dealInitialCards() {
    for (const player of this.players) {
      for (let i = 0; i < 4; i++) this.drawCard(player);
    }
  }

  drawCard(player, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        if (this.discardPile.length === 0) break;
        this.deck = [...this.discardPile];
        this.discardPile = [];
        this.shuffle(this.deck);
        this.addLog('牌堆已空，洗入弃牌堆。', 'important');
      }
      const card = this.deck.pop();
      card.ownerId = player.id;
      player.hand.push(card);
    }
  }

  drawOne() {
    if (this.deck.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.deck = [...this.discardPile];
      this.discardPile = [];
      this.shuffle(this.deck);
      this.addLog('牌堆已空，洗入弃牌堆。', 'important');
    }
    return this.deck.pop();
  }

  discardCard(player, card) {
    const idx = player.hand.indexOf(card);
    if (idx >= 0) {
      player.hand.splice(idx, 1);
      this.discardPile.push(card);
    }
  }

  // ==================== 托管系统 ====================

  toggleAutoPlay() {
    this.autoPlay = !this.autoPlay;
    if (this.autoPlay) {
      this.addLog('已开启托管，AI将代你出牌', 'auto');
      // 如果当前是人类回合且等待操作，让AI接管
      if (this.phase === 'play' && this.players[this.currentPlayerIdx]?.isHuman && !this.waitingForTarget) {
        const player = this.players[this.currentPlayerIdx];
        setTimeout(() => this.aiPlayPhase(player), 500);
      }
    } else {
      this.addLog('已取消托管，恢复正常操作', 'auto');
    }
    this.render();
  }

  // ==================== 回合流程 ====================

  startCurrentTurn() {
    if (this.gameOver) return;
    const player = this.players[this.currentPlayerIdx];
    if (!player.alive) { this.nextPlayer(); return; }
    this.shaUsedThisTurn = false;
    this.jiuDamageBoost = false;
    this.tieSuoSelecting = null;
    this.zhihengUsedThisTurn = false;
    this.jieyinUsedThisTurn = false;
    this.qingnangUsedThisTurn = false;
    this.yeyanUsedThisTurn = false;
    this.gongxinUsedThisTurn = false;
    this.haoshiUsedThisTurn = false;
    this.kejiEligible = true;
    this.extraShaChances = player.equipment.weapon && player.equipment.weapon.id === 'liannu' ? 999 : 0;
    
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

  resolveJudgePhase(player) {
    // 处理判定区的延时锦囊
    if (player.judgeArea.length === 0) {
      return this.goToDrawPhase(player);
    }
    const judgeCards = [...player.judgeArea];
    player.judgeArea = [];
    let skipPlay = false;
    let skipDraw = false;
    for (const jc of judgeCards) {
      const judgeCard = this.drawOne();
      if (!judgeCard) continue;
      this.addLog(`${player.hero.name}的【${jc.name}】判定：${judgeCard.suit} ${judgeCard.rank || ''}【${judgeCard.name}】`);
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
        if (judgeCard.suit === '♠' && ['2','3','4','5','6','7','8','9'].includes(judgeCard.rank)) {
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

  goToDrawPhase(player, skipPlay) {
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

  goToPlayPhase(player, skipPlay) {
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
    }
  }

  humanDrawPhase(skipPlay) {
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

  // ==================== 手牌选择 ====================

  selectCard(idx) {
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

  playSelectedCard() {
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
      if (player.hero.id !== 'zhangfei' && this.shaUsedThisTurn && card.type === 'sha') {
        this.addLog('本回合已经使用过【杀】了');
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
      this.useCardOnTarget(card, null, card.type);
      this.selectedCardIdx = -1;
    }
  }

  getValidTargets(card) {
    const player = this.players[this.currentPlayerIdx];
    const aliveOthers = this.players.filter(p => p.alive && p.id !== player.id);
    switch (card.type) {
      case 'sha': {
        const shaRange = this.getShaRange(player);
        return aliveOthers.filter(t => this.calcDistance(player, t, true) <= shaRange);
      }
      case 'juedou': return aliveOthers.filter(t => t.hero.id !== 'jiaxu');
      case 'huogong': return aliveOthers.filter(t => t.hand.length > 0);
      case 'shunshou': return aliveOthers.filter(t => t.hero.id !== 'jiaxu' && this.buildGuoheChoices(t).length > 0 && this.calcDistance(player, t) <= 1);
      case 'guohe': return aliveOthers.filter(t => t.hero.id !== 'jiaxu' && this.buildGuoheChoices(t).length > 0);
      case 'lebu': return aliveOthers.filter(t => t.judgeArea.length < 3);
      case 'bingliang': return aliveOthers.filter(t => t.judgeArea.length < 3 && this.calcDistance(player, t) <= 1);
      default: return [];
    }
  }

  getShaRange(player) {
    return player.equipment.weapon ? player.equipment.weapon.range : 1;
  }

  calcDistance(from, to, forSha = false) {
    let dist = 1;
    if (to.equipment.plusHorse && !(forSha && from.equipment.weapon && from.equipment.weapon.id === 'qinggang')) dist += 1;
    if (from.equipment.minusHorse) dist -= 1;
    if (from.hero.id === 'gongsunzan' && from.hp > 2) dist -= 1;
    if (to.hero.id === 'gongsunzan' && to.hp <= 2) dist += 1;
    return Math.max(1, dist);
  }

  equipCard(player, card) {
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

  showTargetSelection(card, targets, callback) {
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

  useCardOnTarget(card, target, effectiveTypeOverride) {
    const player = this.players[this.currentPlayerIdx];
    const effectiveType = effectiveTypeOverride || card.type;
    this.discardCard(player, card);
    
    // PvP 广播
    if (this._isPvP && player.isHuman) {
      pvpBroadcast(this, 'playCard', {
        playerId: player.id,
        cardIdx: player.hand.findIndex(c => c.id === card.id), // 可能已经出牌了，找原始的
        cardId: card.id,
        cardType: card.type,
        targetPlayerId: target ? target.id : -1,
        effectiveType: effectiveType,
      });
    }
    const isWushengSha = (player.hero.id === 'guanyu' && card.type !== 'sha' && effectiveType === 'sha');
    const desc = isWushengSha ? `将${card.suit}【${card.name}】当【杀】使用` : `使用了【${card.name}】`;
    this.addLog(`${player.hero.name}${desc}${target ? '，目标是' + target.hero.name : ''}`, isWushengSha ? 'skill' : '');

    if (effectiveType === 'sha') {
      if (player.hero.id !== 'zhangfei' && this.extraShaChances <= 0) this.shaUsedThisTurn = true;
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

  // ==================== 卡牌效果结算 ====================

  resolveSha(source, target, card) {
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

  waitForShanResponse(target, source, card) {
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

  humanRespondShan(withCard) {
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
      } else {
        this.addLog(`${target.hero.name}打出一张【闪】，还需${pd.shanNeeded}张`);
        this.waitingForTarget = null;
        setTimeout(() => this.waitForShanResponse(target, source, card), 200);
        return;
      }
    } else {
      this.waitingForTarget = null;
      this.dealDamage(target, source, 1, card);
    }
    this.render();
    this._pvpSyncState();
  }

  humanUseBaguazhen() {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shan_response') return;
    const { target, source, card } = this.waitingForTarget;
    this.waitingForTarget = null;
    const judgeCard = this.drawOne();
    if (!judgeCard) {
      this.dealDamage(target, source, 1, card);
      this.render();
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
      } else {
        this.addLog(`判定为红色，视为打出一张【闪】，还需${pd.shanNeeded}张`);
        setTimeout(() => this.waitForShanResponse(target, source, card), 200);
        return;
      }
    } else {
      this.addLog('判定为黑色，【八卦阵】未触发，仍需要【闪】', 'skill');
      // 让玩家继续选择
      setTimeout(() => {
        this.waitForShanResponse(target, source, card);
      }, 100);
    }
    this.render();
  }

  resolveTao(player) {
    if (player.hp < player.hero.maxHp) {
      player.hp++;
      this.addLog(`${player.hero.name}回复了1点体力 (${player.hp}/${player.hero.maxHp})`, 'heal');
    } else {
      this.addLog(`${player.hero.name}体力已满，【桃】无法生效`);
    }
  }

  resolveJiu(player) {
    this.jiuDamageBoost = true;
    this.addLog(`${player.hero.name}使用了【酒】，本回合下一张【杀】伤害+1`, 'skill');
    if (player.hp < player.hero.maxHp) this.addLog('（【酒】也可在回合外濒死时当【桃】使用）');
    this.render();
  }

  resolveJuedou(source, target) {
    this.addLog(`${source.hero.name}向${target.hero.name}发起决斗！`, 'important');
    this.juedouRound(source, target);
  }

  juedouRound(challenger, defender, challengerCard = null) {
    if (this.gameOver) return;
    // 吕布无双：与吕布决斗的角色每次需打出2张杀
    const lübuInvolved = challenger.hero.id === 'lübu' || defender.hero.id === 'lübu';
    const nonLübu = challenger.hero.id === 'lübu' ? defender : challenger;
    if (defender.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'juedou_defend', challenger, defender, shaNeeded: lübuInvolved && defender.id !== 'lübu' ? 2 : 1 };
      this.render();
      return;
    }
    this.aiRespondJuedou(defender, challenger, lübuInvolved);
  }

  humanRespondJuedou(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'juedou_defend') return;
    const { challenger, defender } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (withCard) {
      const isWusheng = defender.hero.id === 'guanyu' && withCard.type !== 'sha';
      this.discardCard(defender, withCard);
      this.addLog(`${defender.hero.name}${isWusheng ? '发动【武圣】' : ''}打出【杀】响应决斗`, isWusheng ? 'skill' : '');
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
    }
    this.render();
  }

  humanRespondJuedouSecond(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'juedou_defend_second') return;
    const { challenger, defender } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (withCard) {
      const isWusheng = defender.hero.id === 'guanyu' && withCard.type !== 'sha';
      this.discardCard(defender, withCard);
      this.addLog(`${defender.hero.name}${isWusheng ? '发动【武圣】' : ''}打出第2张【杀】响应决斗`, isWusheng ? 'skill' : '');
      this.juedouRound(defender, challenger, withCard);
    } else {
      this.addLog(`${defender.hero.name}无法打出第2张【杀】，受到1点伤害`);
      this.dealDamage(defender, challenger, 1);
    }
    this.render();
  }

  // 收集目标所有可拆的牌：手牌 + 装备 + 判定区
  buildGuoheChoices(target) {
    const list = [];
    target.hand.forEach((c, i) => list.push({ type: 'hand', idx: i, card: c }));
    ['weapon', 'armor', 'plusHorse', 'minusHorse'].forEach(s => {
      if (target.equipment[s]) list.push({ type: 'equip', slot: s, card: target.equipment[s] });
    });
    target.judgeArea.forEach((c, i) => list.push({ type: 'judge', idx: i, card: c }));
    return list;
  }

  // 执行过河拆桥的弃置
  executeGuoheDiscard(target, pick) {
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

  resolveGuohe(target) {
    const choices = this.buildGuoheChoices(target);
    if (choices.length === 0) {
      this.addLog(`${target.hero.name}没有可弃置的牌`);
      this.render();
      return;
    }

    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'guohe_discard', target, source: this.players[this.currentPlayerIdx], choices };
      this.render();
      return;
    }

    // AI / 随机选择
    const pick = choices[Math.floor(Math.random() * choices.length)];
    this.executeGuoheDiscard(target, pick);
    this.addLog(`${target.hero.name}的【${pick.card.name}】被过河拆桥弃置`);
    this.render();
  }

  humanGuoheDiscard(pickObj) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'guohe_discard') return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    this.executeGuoheDiscard(target, pickObj);
    this.addLog(`${target.hero.name}的【${pickObj.card.name}】被过河拆桥弃置`);
    this.render();
    // 如果是 AI 对玩家使用，完成后继续 AI 的出牌阶段
    if (source && !source.isHuman) {
      setTimeout(() => this.aiPlayCards(source), 140);
    }
  }

  humanGuoheDiscardEquip(slot) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'guohe_discard') return;
    const { target } = this.waitingForTarget;
    const card = target.equipment[slot];
    if (!card) return;
    this.humanGuoheDiscard({ type: 'equip', slot, card });
  }

  humanGuoheDiscardJudge(idx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'guohe_discard') return;
    const { target } = this.waitingForTarget;
    const card = target.judgeArea[idx];
    if (!card) return;
    this.humanGuoheDiscard({ type: 'judge', idx, card });
  }

  // ==================== 火攻 ====================
  resolveHuogong(source, target) {
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

  humanShowCardForHuogong(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'huogong_show') return;
    const { target, source } = this.waitingForTarget;
    const showCard = target.hand[cardIdx];
    if (!showCard) return;
    this.waitingForTarget = null;
    this.addLog(`${target.hero.name}展示了【${showCard.name}】(${showCard.suit})`, 'skill');
    this.doHuogongDiscard(source, target, showCard.suit);
    this.render();
  }

  doHuogongDiscard(source, target, suit) {
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

  humanDiscardForHuogong(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'huogong_discard') return;
    const { target, source, suit } = this.waitingForTarget;
    const card = source.hand[cardIdx];
    if (!card || card.suit !== suit) return;
    this.waitingForTarget = null;
    this.discardCard(source, card);
    this.addLog(`${source.hero.name}弃置【${card.name}】对${target.hero.name}造成1点火焰伤害`, 'damage');
    this.dealDamage(target, source, 1);
    this.render();
  }

  // ==================== 铁索连环 ====================
  showTiesuoSelect(player, card) {
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

  toggleTiesuoTarget(pid) {
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

  confirmTiesuo() {
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

  reforgeTiesuo() {
    if (!this.tieSuoSelecting) return;
    const { player, card } = this.tieSuoSelecting;
    this.tieSuoSelecting = null;
    this.discardCard(player, card);
    this.drawCard(player, 1);
    this.addLog(`${player.hero.name}重铸【铁索连环】，摸1张牌`);
    this.render();
  }

  resolveTiesuo(player) {
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

  resolveLebu(target) {
    target.judgeArea.push(CARD_DEF['lebu']);
    this.addLog(`【乐不思蜀】被置于${target.hero.name}的判定区`);
    this.render();
  }

  resolveBingliang(target) {
    target.judgeArea.push(CARD_DEF['bingliang']);
    this.addLog(`【兵粮寸断】被置于${target.hero.name}的判定区`);
    this.render();
  }

  resolveShandian(player) {
    player.judgeArea.push(CARD_DEF['shandian']);
    this.addLog(`【闪电】被置于${player.hero.name}的判定区`);
    this.render();
  }

  resolveShunshou(source, target) {
    const choices = this.buildGuoheChoices(target);
    if (choices.length === 0) {
      this.addLog(`${target.hero.name}没有可顺的牌`);
      this.render();
      return;
    }

    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'shunshou_steal', target, source, choices };
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

  executeShunshouSteal(source, target, pick) {
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
      target.judgeArea = target.judgeArea.filter((c, i) => i !== pick.idx);
      this.discardPile.push(pick.card);
      // 从判定区移到自己的手牌（生成新卡实例）
      const newCard = { ...pick.card };
      source.hand.push(newCard);
      this.addLog(`${source.hero.name}将${target.hero.name}判定区的【${pick.card.name}】移入手中`);
      return;
    }
  }

  humanShunshouSteal(pickObj) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shunshou_steal') return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    this.executeShunshouSteal(source, target, pickObj);
    const areaName = pickObj.type === 'hand' ? '手牌' : pickObj.type === 'equip' ? '装备' : '判定区';
    this.addLog(`${source.hero.name}顺手牵羊从${target.hero.name}${areaName}获得了【${pickObj.card.name}】`);
    this.render();
    // 如果是 AI 对玩家使用，完成后继续 AI 的出牌阶段
    if (source && !source.isHuman) {
      setTimeout(() => this.aiPlayCards(source), 140);
    }
  }

  humanShunshouStealEquip(slot) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shunshou_steal') return;
    const { target } = this.waitingForTarget;
    const card = target.equipment[slot];
    if (!card) return;
    this.humanShunshouSteal({ type: 'equip', slot, card });
  }

  humanShunshouStealJudge(idx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'shunshou_steal') return;
    const { target } = this.waitingForTarget;
    const card = target.judgeArea[idx];
    if (!card) return;
    this.humanShunshouSteal({ type: 'judge', idx, card });
  }

  resolveWuzhong(player) {
    this.drawCard(player, 2);
    this.addLog(`${player.hero.name}使用了无中生有，摸2张牌`);
  }

  resolveNanman(source) {
    this.addLog(`${source.hero.name}使用了【南蛮入侵】！所有人需打出【杀】`, 'important');
    this.resolveAOE(source, 'sha', '南蛮入侵');
  }

  resolveWanjian(source) {
    this.addLog(`${source.hero.name}使用了【万箭齐发】！所有人需打出【闪】`, 'important');
    this.resolveAOE(source, 'shan', '万箭齐发');
  }

  resolveAOE(source, requiredType, aoeName) {
    const targets = this.players.filter(p => p.alive && p.id !== source.id);
    this.processAOETargets(source, targets, requiredType, 0);
  }

  processAOETargets(source, targets, requiredType, idx) {
    if (idx >= targets.length) return;
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

  humanRespondAOE(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'aoe_response') return;
    const { source, target, requiredType, targets, aoeIdx } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (withCard) {
      const isWusheng = target.hero.id === 'guanyu' && withCard.type !== requiredType;
      this.discardCard(target, withCard);
      this.addLog(`${target.hero.name}${isWusheng ? '发动【武圣】' : ''}打出【${withCard.name}】`, isWusheng ? 'skill' : '');
    } else {
      this.addLog(`${target.hero.name}受到1点伤害`, 'damage');
      this.dealDamage(target, source, 1);
    }
    this.render();
    setTimeout(() => this.processAOETargets(source, targets, requiredType, aoeIdx + 1), 400);
  }

  resolveTaoyuan(player) {
    this.addLog(`${player.hero.name}使用了【桃园结义】！`, 'important');
    for (const p of this.players) {
      if (p.alive && p.hp < p.hero.maxHp) {
        p.hp++;
        this.addLog(`${p.hero.name}回复了1点体力`, 'heal');
      }
    }
  }

  resolveWugu(player) {
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

  // ==================== 伤害结算（含技能触发）====================

  dealDamage(target, source, amount, card = null) {
    // 酒效果：对该杀的伤害+1
    if (card && card.type === 'sha' && this.pendingDamageCards[target.id] && this.pendingDamageCards[target.id].jiuBoost) {
      amount += this.pendingDamageCards[target.id].jiuBoost;
      this.pendingDamageCards[target.id].jiuBoost = 0; // 只加成一次
    }
    for (let i = 0; i < amount; i++) {
      if (!target.alive) return;
      target.hp--;
      this.addLog(`${target.hero.name}受到1点伤害 (剩余HP: ${target.hp}/${target.hero.maxHp})`, 'damage');

      // 曹操奸雄
      if (target.alive && target.hero.id === 'caocao' && card && this.pendingDamageCards[target.id]) {
        const pd = this.pendingDamageCards[target.id];
        const dc = pd.card || pd;
        delete this.pendingDamageCards[target.id];
        this.triggerJianxiong(target, dc);
      }

      // 郭嘉天妒
      if (target.alive && target.hero.id === 'guojia') {
        this.triggerTiandu(target);
      }

      // 曹丕放逐
      if (target.alive && target.hero.id === 'caopi' && source && source !== target && source.alive) {
        this.triggerFangzhu(target, source);
      }

      // 张角雷击
      if (target.alive && target.hero.id === 'zhangjiao' && source && source !== target && source.alive) {
        this.triggerLeiji(target, source);
      }

      // 华雄恃勇
      if (target.alive && target.hero.id === 'huaxiong' && card && card.type === 'sha') {
        this.triggerShiyong(target, card);
      }

      if (target.hp <= 0) {
        this.handleDying(target, source);
        if (!target.alive) break;
      }
    }
    // 武器特效（每张杀触发一次）
    if (source && source.equipment.weapon && card && card.type === 'sha' && target.alive) {
      const wid = source.equipment.weapon.id;
      if (wid === 'zhuque') {
        target.hp--;
        this.addLog(`【朱雀羽扇】额外造成1点伤害 (剩余HP: ${target.hp}/${target.hero.maxHp})`, 'damage');
        if (target.hp <= 0) { this.handleDying(target, source); }
      }
      if (wid === 'guding' && target.hand.length === 0) {
        target.hp--;
        this.addLog(`【古锭刀】对空手角色额外造成1点伤害 (剩余HP: ${target.hp}/${target.hero.maxHp})`, 'damage');
        if (target.hp <= 0) { this.handleDying(target, source); }
      }
      if (wid === 'qilin' && target.equipment.plusHorse) {
        const horse = target.equipment.plusHorse;
        this.discardPile.push(horse);
        target.equipment.plusHorse = null;
        this.addLog(`【麒麟弓】弃置了${target.hero.name}的+1马【${horse.name}】`, 'skill');
      }
    }
    this.checkGameOver();
    this._pvpSyncState();
  }

  triggerJianxiong(target, card) {
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'jianxiong', target, card };
    } else {
      card.ownerId = target.id;
      target.hand.push(card);
      this.addLog(`${target.hero.name}发动【奸雄】，获得了【${card.name}】`, 'skill');
    }
  }

  humanJianxiong(take) {
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
    this.render();
  }

  triggerTiandu(target) {
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'tiandu', target };
    } else {
      this.drawCard(target, 1);
      this.addLog(`${target.hero.name}发动【天妒】，摸了一张牌`, 'skill');
    }
  }

  humanTiandu(take) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'tiandu') return;
    const { target } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (take) {
      this.drawCard(target, 1);
      this.addLog(`${target.hero.name}发动【天妒】，摸了一张牌`, 'skill');
    } else {
      this.addLog(`${target.hero.name}放弃发动【天妒】`);
    }
    this.render();
  }

  triggerFangzhu(target, source) {
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

  humanFangzhuChoice(choice) {
    if (!this.waitingForTarget || !['fangzhu_source', 'fangzhu_target'].includes(this.waitingForTarget.type)) return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (choice === 'discard') {
      if (source.hand.length === 0) { this.addLog('没有手牌可弃，曹丕摸1张牌'); this.drawCard(target, 1); }
      else {
        // 进入弃牌选择
        this.waitingForTarget = { type: 'fangzhu_discard', target, source };
        this.render();
      }
    } else {
      this.drawCard(target, 1);
      this.addLog(`${target.hero.name}发动【放逐】摸了1张牌`, 'skill');
    }
    this.render();
  }

  humanFangzhuDiscard(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'fangzhu_discard') return;
    const { source } = this.waitingForTarget;
    this.waitingForTarget = null;
    const card = source.hand[cardIdx];
    this.discardCard(source, card);
    this.addLog(`${source.hero.name}弃置了【${card.name}】（曹丕【放逐】）`, 'skill');
    this.render();
  }

  // 张角雷击
  triggerLeiji(target, source) {
    if (target.isHuman && !this.autoPlay) {
      this.waitingForTarget = { type: 'leiji', target, source };
    } else {
      this.doLeiji(target, source);
    }
  }

  doLeiji(target, source) {
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

  humanLeiji(take) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'leiji') return;
    const { target, source } = this.waitingForTarget;
    this.waitingForTarget = null;
    if (take) {
      this.doLeiji(target, source);
    } else {
      this.addLog(`${target.hero.name}放弃发动【雷击】`);
    }
    if (!this.gameOver) this.render();
  }

  // 华雄恃勇
  triggerShiyong(target, card) {
    this.addLog(`${target.hero.name}发动【恃勇】，获得【${card.name}】并摸一张牌`, 'skill');
    card.ownerId = target.id;
    target.hand.push(card);
    this.drawCard(target, 1);
  }

  // 行殇：有角色阵亡时曹丕摸牌
  triggerXingshang(caopiPlayer) {
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

  handleDying(player, source) {
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

  killPlayer(player, source) {
    player.alive = false;
    this.addLog(`${player.hero.name}阵亡！`, 'important');
    if (player.role && !this.rolesRevealed[player.id]) {
      this.rolesRevealed[player.id] = true;
      this.addLog(`${player.hero.name}的身份是：${getRoleDisplayName(player.role)}`, 'important');
    }

    // 杀死反贼奖励：摸3张牌
    if (player.role === 'fanzei' && source && source.alive) {
      this.drawCard(source, 3);
      this.addLog(`${source.hero.name}杀死反贼，摸3张牌奖励！`, 'reward');
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

    const caopi = this.players.find(p => p.hero.id === 'caopi' && p.alive);
    if (caopi) this.triggerXingshang(caopi);
  }

  humanDyingUseTao(withCard) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'dying') return;
    const player = this.waitingForTarget.player;
    const source = this.waitingForTarget.source;
    this.waitingForTarget = null;
    if (withCard) {
      const isJijiu = player.hero.id === 'huatuo' && withCard.type !== 'tao';
      this.discardCard(player, withCard);
      player.hp = 1;
      this.addLog(`${player.hero.name}${isJijiu ? '发动【急救】将红色牌当【桃】' : '使用【桃】'}自救，回复至1点体力`, isJijiu ? 'skill' : 'heal');
    } else {
      this.killPlayer(player, source);
    }
    this.checkGameOver();
    this.render();
  }

  // ==================== 武将主动技能 ====================

  useSkill(skillId) {
    const player = this.players[this.currentPlayerIdx];
    if (!player.isHuman || this.phase !== 'play' || this.autoPlay) return;

    switch (skillId) {
      case 'rende': {
        if (player.hand.length === 0) { this.addLog('没有手牌可以给出'); return; }
        const targets = this.players.filter(p => p.alive && p.id !== player.id);
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
        const targets = this.players.filter(p => p.alive && p.id !== player.id);
        this.waitingForTarget = {
          type: 'jieyin_discard',
          player,
          targets: this.players.filter(p => p.alive && p.id !== player.id),
          selected: [],
        };
        this.render();
        break;
      }
      case 'qingnang': {
        if (this.qingnangUsedThisTurn) { this.addLog('本回合已经使用过【青囊】了'); return; }
        if (player.hand.length === 0) { this.addLog('没有手牌可弃置'); return; }
        const targets = this.players.filter(p => p.alive && p.hp < p.hero.maxHp);
        if (targets.length === 0) { this.addLog('没有需要治疗的受伤角色'); return; }
        this.waitingForTarget = { type: 'qingnang_select', player, targets };
        this.render();
        break;
      }
      case 'yeyan': {
        if (this.yeyanUsedThisTurn) { this.addLog('本回合已经使用过【业炎】了'); return; }
        if (player.hand.length < 3) { this.addLog('手牌不足3张，无法发动【业炎】'); return; }
        const yetargets = this.players.filter(p => p.alive && p.id !== player.id);
        this.waitingForTarget = { type: 'yeyan_discard', player, targets: yetargets, selected: [] };
        this.render();
        break;
      }
      case 'gongxin': {
        if (this.gongxinUsedThisTurn) { this.addLog('本回合已经使用过【攻心】了'); return; }
        const gotargets = this.players.filter(p => p.alive && p.id !== player.id && p.hand.length > 0);
        if (gotargets.length === 0) { this.addLog('没有有手牌的目标'); return; }
        if (gotargets.length === 1) { this.doGongxin(player, gotargets[0]); }
        else { this.showTargetSelection({ name: '攻心', type: 'skill' }, gotargets, (t) => this.doGongxin(player, t)); }
        break;
      }
      case 'haoshi': {
        if (this.haoshiUsedThisTurn) { this.addLog('本回合已经使用过【好施】了'); return; }
        if (player.hand.length === 0) { this.addLog('没有手牌可弃置'); return; }
        const hatargets = this.players.filter(p => p.alive && p.hp < p.hero.maxHp);
        if (hatargets.length === 0) { this.addLog('没有需要治疗的受伤角色'); return; }
        this.waitingForTarget = { type: 'haoshi_select', player, targets: hatargets };
        this.render();
        break;
      }
    }
  }

  doRende(player, target) {
    const count = player.hand.length;
    const cards = [...player.hand];
    for (const c of cards) {
      this.discardCard(player, c);
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

  humanSelectQingnangTarget(target) {
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

  humanSelectHaoshiTarget(target) {
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

  humanSelectYeyanDiscard(cardIdx) {
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

  doYeyanDamage(player, target) {
    this.yeyanUsedThisTurn = true;
    this.addLog(`${player.hero.name}发动【业炎】，对${target.hero.name}造成2点火焰伤害！`, 'skill');
    this.dealDamage(target, player, 2, { name: '业炎' });
    this.render();
  }

  doGongxin(player, target) {
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

  transferCard(from, to, card) {
    const idx = from.hand.indexOf(card);
    if (idx >= 0) from.hand.splice(idx, 1);
    card.ownerId = to.id;
    to.hand.push(card);
  }

  getNextAlivePlayer(current) {
    const idx = this.players.indexOf(current);
    for (let i = 1; i <= this.players.length; i++) {
      const p = this.players[(idx + i) % this.players.length];
      if (p.alive) return p;
    }
    return null;
  }

  resolveShelie(player) {
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
      const s = c.suit[0];
      if (!suits[s]) suits[s] = c;
    }
    const keep = Object.values(suits);
    const discard = revealed.filter(c => !keep.includes(c));
    for (const c of keep) { c.ownerId = player.id; player.hand.push(c); }
    for (const c of discard) this.discardPile.push(c);
    this.addLog(`${player.hero.name}获得：${keep.map(c => `【${c.name}】`).join('、')}（共${keep.length}张）`, 'skill');
  }

  goToDiscardPhase(player) {
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

  handleHumanDiscard() {
    const player = this.players[this.currentPlayerIdx];
    const maxKeep = player.hp;
    if (player.hand.length <= maxKeep) { this.endTurn(); return; }
    this.waitingForTarget = { type: 'human_discard', player, maxKeep };
    this.render();
  }

  humanDiscardCard(cardIdx) {
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

  endPlayPhase() {
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

  triggerDimengGive(player) {
    const others = this.players.filter(p => p.alive && p.id !== player.id);
    if (others.length === 0) return;
    let target = others[0];
    for (const o of others) {
      if (o.hand.length < target.hand.length) target = o;
    }
    const card = player.hand[Math.floor(Math.random() * player.hand.length)];
    this.transferCard(player, target, card);
    this.addLog(`${player.hero.name}发动【缔盟】，将【${card.name}】交给了${target.hero.name}`, 'skill');
  }

  humanEndPlayPhase() {
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

  humanSelectDiscard(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'discard_phase') return;
    const wt = this.waitingForTarget;
    const idx = wt.selected.indexOf(cardIdx);
    if (idx >= 0) wt.selected.splice(idx, 1);
    else wt.selected.push(cardIdx);
    this.render();
  }

  humanConfirmDiscard() {
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

  // ==================== 神周瑜琴音 ====================

  humanSelectJieyinDiscard(cardIdx) {
    if (!this.waitingForTarget || this.waitingForTarget.type !== 'jieyin_discard') return;
    const wt = this.waitingForTarget;
    const idx = wt.selected.indexOf(cardIdx);
    if (idx >= 0) wt.selected.splice(idx, 1);
    else wt.selected.push(cardIdx);
    this.render();
  }

  humanSelectJieyin() {
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

  triggerQinyin(player) {
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

  endTurn() {
    this.nextPlayer();
  }

  // ==================== 回合控制 ====================

  nextPlayer() {
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
    this.zhihengUsedThisTurn = false;
    
    // PvP 状态同步
    this._pvpSyncState();
    this.jieyinUsedThisTurn = false;
    this.render();
    setTimeout(() => this.startCurrentTurn(), 800);
  }

  checkGameOver() {
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

  addLog(msg, type = '') {
    this.logEntries.push({ msg, type });
    // 超过 150 条时批量截断，避免频繁 shift()
    if (this.logEntries.length > 200) {
      this.logEntries = this.logEntries.slice(-150);
    }
  }

  // ==================== 渲染 ====================

  // ========== PvP 连接状态徽章 ==========
  _renderPvPBadge() {
    if (!this._isPvP) return '';
    const connected = pvpManager && pvpManager.connected;
    return `<span class="pvp-badge">
      <span class="dot${connected ? '' : ' disconnected'}"></span>
      ${connected ? '联机中' : '断开连接'}
    </span>`;
  }

  render() {
    // 使用 rAF 合并同一帧内多次调用，避免 layout thrashing
    if (this._renderPending) return;
    this._renderPending = true;
    if (this._renderRafId) cancelAnimationFrame(this._renderRafId);
    this._renderRafId = requestAnimationFrame(() => {
      this._renderRafId = null;
      this._renderPending = false;
      this._doRender();
    });
  }

  _doRender() {
    const app = document.getElementById('app');
    const player = this.players[this.currentPlayerIdx];
    const humanPlayer = this.players.find(p => p.isHuman);
    const isHumanTurn = player && player.isHuman;
    const isAutoTurn = isHumanTurn && this.autoPlay;

    let html = '';

    // 顶部栏
    html += `
    <div class="top-bar">
      <h1>🏯 三国杀</h1>
      <div class="game-info">
        ${this.gameMode >= 5 ? getGameModeName(this.gameMode) + ' · ' : ''}
        回合: ${player ? player.hero.name : ''}
        ${this.gameMode >= 5 && humanPlayer && humanPlayer.role ? ` · 你的身份: ${getRoleDisplayName(humanPlayer.role)}` : ''}
        ${isAutoTurn ? ' <span style="color:#60ff80;">[托管中]</span>' : ''}
        ${this._isPvP ? ' <span style="color:#60c0ff;">[PvP]</span>' : ''}
      </div>
      <div class="deck-info">
        <span id="ai-speed-indicator" class="ai-speed">正常</span>
        <span class="deck-count">牌堆: ${this.deck.length} | 弃牌: ${this.discardPile.length}</span>
        <div class="deck-visual">牌<br>堆</div>
      </div>
      ${this._isPvP ? this._renderPvPBadge() : ''}
    </div>`;

    // 平铺牌局
    const totalPlayers = this.players.length;
    let cols = 2;
    if (totalPlayers >= 7) cols = 4;
    else if (totalPlayers >= 5) cols = 3;
    else if (totalPlayers >= 3) cols = 2;
    else cols = 1;

    html += '<div class="game-board">';

    // 牌堆信息条
    html += `<div class="table-deck-bar">
      <div class="deck-visual-bar">牌堆</div>
      <span class="table-deck-info">牌堆 ${this.deck.length} 张 | 弃牌 ${this.discardPile.length} 张</span>
      <div style="font-size:28px;color:rgba(240,208,96,0.3);font-weight:bold;letter-spacing:5px;">殺</div>
    </div>`;

    // 玩家网格（按座位号排序展示所有玩家）
    const sortedPlayers = [...this.players].sort((a, b) => a.seat - b.seat);
    html += `<div class="players-grid cols-${cols}">`;

    for (const p of sortedPlayers) {
      const isHuman = p.isHuman;
      html += `<div class="player-slot ${isHuman ? 'has-human' : ''}">`;

      // 英雄面板
      html += this.renderHeroPanel(p, isHuman, p.seat);

      // AI 手牌（卡背或可见状态）
      if (!isHuman && p.hand.length > 0) {
        html += '<div class="player-hand-row">';
        for (let i = 0; i < p.hand.length; i++) {
          const card = p.hand[i];
          const isRevealed = this.waitingForTarget && !this.autoPlay &&
            ((this.waitingForTarget.type === 'guohe_discard' || this.waitingForTarget.type === 'shunshou_steal')
            && this.waitingForTarget.target.id === p.id);
          if (isRevealed) {
            html += `<div class="mini-card ${this.getCardStyle(card)}" style="font-size:7px;">${card.name}</div>`;
          } else {
            html += '<div class="mini-card face-down"></div>';
          }
        }
        html += '</div>';
      }

      // 人类玩家手牌（在网格槽位内）
      if (isHuman && humanPlayer.alive) {
        html += '<div class="human-hand-inline">';
        html += `<div class="hand-label-inline"><span>手牌 (${humanPlayer.hand.length}张) ${this.autoPlay ? '<span style="color:#60ff80;">🤖托管中</span>' : ''}</span>`;

        if (this.waitingForTarget?.type === 'discard_phase') {
          const wt = this.waitingForTarget;
          html += `<span style="color:#ff6060;">弃 ${wt.needDiscard} 张 (已选 ${wt.selected.length})</span>`;
        }
        if (this.waitingForTarget?.type === 'jieyin_discard') {
          const wt = this.waitingForTarget;
          html += `<span style="color:#ffe080;">结姻选牌 (已选 ${wt.selected.length})</span>`;
        }
        if (this.waitingForTarget?.type === 'yeyan_discard') {
          const wt = this.waitingForTarget;
          html += `<span style="color:#ffa040;">业炎选牌 (已选 ${wt.selected.length})</span>`;
        }
        html += '</div>'; // close hand-label-inline

        for (let i = 0; i < humanPlayer.hand.length; i++) {
          const card = humanPlayer.hand[i];
          const isSelected = this.selectedCardIdx === i;
          const isDiscardSelected = this.waitingForTarget?.selected?.includes(i);
          let cardClass = this.getCardStyle(card);
          if (isSelected || isDiscardSelected) cardClass += ' selected';
          if (isHumanTurn && humanPlayer.hero.id === 'guanyu' && card.type !== 'sha' && isRedSuit(card.suit)
              && this.phase === 'play' && !this.waitingForTarget && !this.autoPlay) {
            cardClass += ' wusheng-able';
          }
          let clickable = true;

          if (this.waitingForTarget) {
            const wt = this.waitingForTarget;
            if (wt.type === 'shan_response') {
              if (humanPlayer.hero.id === 'guanyu') clickable = (card.type === 'shan' || isRedSuit(card.suit));
              else clickable = (card.type === 'shan');
            }
            else if (wt.type === 'juedou_defend' || wt.type === 'juedou_defend_second') {
              if (humanPlayer.hero.id === 'guanyu') clickable = (card.type === 'sha' || isRedSuit(card.suit));
              else clickable = (card.type === 'sha');
            }
            else if (wt.type === 'aoe_response') {
              if (humanPlayer.hero.id === 'guanyu') clickable = (card.type === wt.requiredType || isRedSuit(card.suit));
              else clickable = (card.type === wt.requiredType);
            }
            else if (wt.type === 'dying') {
              clickable = (card.type === 'tao') || (card.type === 'jiu') || (wt.huatuoJijiu && isRedSuit(card.suit));
            }
            else if (wt.type === 'huogong_show') {
              clickable = player.isHuman && wt.target.id === player.id;
            }
            else if (wt.type === 'huogong_discard') {
              clickable = player.isHuman && wt.source.id === player.id && card.suit === wt.suit;
            }
            else if (wt.type === 'discard_phase' || wt.type === 'jieyin_discard' || wt.type === 'yeyan_discard'
              || wt.type === 'fangzhu_discard' || wt.type === 'guohe_discard' || wt.type === 'shunshou_steal') {
              clickable = true;
            }
            else if (wt.type) clickable = false;
          }

          if (!isHumanTurn && !this.waitingForTarget) clickable = false;
          if (this.autoPlay && !this.waitingForTarget) clickable = false;

          const suitColor = isRedSuit(card.suit) ? 'card-suit-red' : 'card-suit-black';
          html += `<div class="card ${cardClass} ${clickable ? '' : 'disabled'}"
            onclick="game.handleCardClick(${i})">
            <div class="card-top"><span class="card-suit-num ${suitColor}">${card.suit}${this.getNumberStr(card.number)}</span></div>
            <div class="card-icon">${card.icon}</div>
            <div class="card-name-text">${card.name}</div>
            <div class="card-num-bot ${suitColor}">${card.suit}${this.getNumberStr(card.number)}</div>
          </div>`;
        }
        if (humanPlayer.hand.length === 0) {
          html += '<div style="color:#604020;padding:12px;width:100%;text-align:center;">暂无手牌</div>';
        }
        html += '</div>'; // close human-hand-inline

        // 人类装备区
        html += '<div style="display:flex;gap:6px;justify-content:center;margin-top:4px;flex-wrap:wrap;">';
        const equipSlots = [
          { slot: 'weapon', label: '武器', cls: 'wpn' },
          { slot: 'armor', label: '防具', cls: 'armr' },
          { slot: 'plusHorse', label: '+1马', cls: 'p1h' },
          { slot: 'minusHorse', label: '-1马', cls: 'm1h' },
        ];
        for (const { slot, label, cls } of equipSlots) {
          const eq = humanPlayer.equipment[slot];
          const eqName = eq ? eq.name : '(空)';
          html += `<div class="equip-zone"><div class="equip-zone-label">${label}</div>
            <div class="equip-slot ${eq ? 'occupied ' + cls : ''}">${eqName}</div></div>`;
        }
        html += '</div>';
      }

      html += '</div>'; // close player-slot
    }

    html += '</div>'; // close players-grid

    // 响应提示
    if (this.waitingForTarget && !this.autoPlay) {
      const wt = this.waitingForTarget;
      html += '<div class="action-bar">';
      if (wt.type === 'shan_response' && (wt.hasShan || wt.hasBaguazhen)) {
        html += `<span style="color:#ff6060;margin-right:10px;">需要打出【闪】响应${wt.source.hero.name}的【杀】</span>`;
        if (wt.hasBaguazhen) html += '<button class="btn skill-btn" onclick="game.humanUseBaguazhen()">👘八卦阵判定</button>';
        html += '<button class="btn danger" onclick="game.humanRespondShan(null)">不出（受伤害）</button>';
      }
      if (wt.type === 'juedou_defend') {
        html += `<span style="color:#ff6060;margin-right:10px;">${wt.challenger.hero.name}向你发起决斗！请出【杀】</span>`;
        html += '<button class="btn danger" onclick="game.humanRespondJuedou(null)">不出（受伤害）</button>';
      }
      if (wt.type === 'aoe_response') {
        const reqName = wt.requiredType === 'sha' ? '杀' : '闪';
        const sourceName = wt.source ? wt.source.hero.name : '';
        html += `<span style="color:#ff6060;margin-right:10px;">需要打出【${reqName}】响应${sourceName}</span>`;
        const hasCard = wt.target.hand.some(c => {
          if (wt.target.hero.id === 'guanyu') return c.type === wt.requiredType || isRedSuit(c.suit);
          return c.type === wt.requiredType;
        });
        if (!hasCard) html += '<span style="color:#ff6060;">没有可用的牌，将受到伤害...</span>';
        else html += `<button class="btn danger" onclick="game.humanRespondAOE(null)">不出（受伤害）</button>`;
      }
      if (wt.type === 'dying') {
        html += '<span style="color:#ff6060;margin-right:10px;">你处于濒死状态！' + (wt.huatuoJijiu ? '可使用【桃】或红色牌（急救）自救' : '使用【桃】自救') + '</span>';
        html += '<button class="btn danger" onclick="game.humanDyingUseTao(null)">不使用（阵亡）</button>';
      }
      if (wt.type === 'juedou_defend_second') {
        html += `<span style="color:#ff6060;margin-right:10px;">吕布【无双】需要第2张【杀】！</span>`;
        html += '<button class="btn danger" onclick="game.humanRespondJuedouSecond(null)">不出（受伤害）</button>';
      }
      if (wt.type === 'qingnang_select') {
        html += `<span style="color:#80ff80;margin-right:10px;">【青囊】选择治疗目标：</span>`;
        for (const t of wt.targets) {
          html += `<button class="btn skill-btn" onclick="game.humanSelectQingnangTarget(${t.id})">${t.hero.name}(${t.hp}/${t.hero.maxHp})</button>`;
        }
        html += '<button class="btn" onclick="game.waitingForTarget = null; game.render()">取消</button>';
      }
      if (wt.type === 'haoshi_select') {
        html += `<span style="color:#80ff80;margin-right:10px;">【好施】选择治疗目标：</span>`;
        for (const t of wt.targets) {
          html += `<button class="btn skill-btn" onclick="game.humanSelectHaoshiTarget(${t.id})">${t.hero.name}(${t.hp}/${t.hero.maxHp})</button>`;
        }
        html += '<button class="btn" onclick="game.waitingForTarget = null; game.render()">取消</button>';
      }
      if (wt.type === 'yeyan_discard') {
        html += `<span style="color:#ffa040;margin-right:10px;">【业炎】选择3张牌弃置（已选${wt.selected.length}/3）：</span>`;
        if (wt.selected.length >= 3) {
          html += '<button class="btn skill-btn" onclick="game.humanSelectYeyanDiscard(-1)">确认发动</button>';
        }
        html += '<button class="btn" onclick="game.waitingForTarget = null; game.render()">取消</button>';
      }
      if (wt.type === 'jieyin_discard') {
        html += `<span style="color:#ff80a0;margin-right:10px;">【结姻】选择2张牌弃置（已选${wt.selected.length}张）：</span>`;
        if (wt.selected.length >= 2 && wt.selected.length % 2 === 0) {
          html += '<button class="btn skill-btn" onclick="game.humanSelectJieyin()">确认结姻</button>';
        }
        html += '<button class="btn" onclick="game.waitingForTarget = null; game.render()">取消</button>';
      }
      if (wt.type === 'jianxiong') {
        html += `<span style="color:#ffa040;margin-right:10px;">是否发动【奸雄】获得【${wt.card.name}】？</span>`;
        html += '<button class="btn skill-btn" onclick="game.humanJianxiong(true)">发动</button>';
        html += '<button class="btn" onclick="game.humanJianxiong(false)">不发动</button>';
      }
      if (wt.type === 'tiandu') {
        html += '<span style="color:#8080ff;margin-right:10px;">是否发动【天妒】摸一张牌？</span>';
        html += '<button class="btn skill-btn" onclick="game.humanTiandu(true)">发动</button>';
        html += '<button class="btn" onclick="game.humanTiandu(false)">不发动</button>';
      }
      if (wt.type === 'fangzhu_source') {
        html += `<span style="color:#ffa040;margin-right:10px;">${wt.target.hero.name}发动【放逐】，你是否弃置一张牌？否则${wt.target.hero.name}摸1张牌</span>`;
        html += '<button class="btn skill-btn" onclick="game.humanFangzhuChoice(\'discard\')">弃置一张牌</button>';
        html += '<button class="btn" onclick="game.humanFangzhuChoice(\'draw\')">不弃（让其摸牌）</button>';
      }
      if (wt.type === 'fangzhu_target') {
        html += `<span style="color:#ffa040;margin-right:10px;">是否发动【放逐】令${wt.source.hero.name}选择弃牌或让你摸牌？</span>`;
        html += '<button class="btn skill-btn" onclick="game.humanFangzhuChoice(\'draw\')">发动</button>';
        html += '<button class="btn" onclick="game.humanFangzhuChoice(\'skip\')">不发动</button>';
      }
      if (wt.type === 'fangzhu_discard') {
        html += `<span style="color:#ff6060;margin-right:10px;">选择一张手牌弃置（曹丕【放逐】）</span>`;
      }
      if (wt.type === 'leiji') {
        html += `<span style="color:#a040ff;margin-right:10px;">是否发动【雷击】？判定为♠则对${wt.source.hero.name}造成1点伤害</span>`;
        html += '<button class="btn skill-btn" onclick="game.humanLeiji(true)">发动</button>';
        html += '<button class="btn" onclick="game.humanLeiji(false)">不发动</button>';
      }
      if (wt.type === 'discard_phase') {
        html += `<span style="color:#ff6060;margin-right:10px;">已选 ${wt.selected.length}/${wt.needDiscard} 张</span>`;
        html += `<button class="btn danger" onclick="game.humanConfirmDiscard()" ${wt.selected.length !== wt.needDiscard ? 'disabled' : ''}>确认弃置</button>`;
      }
      html += '</div>';
    }

    // 出牌阶段按钮
    if (isHumanTurn && this.phase === 'play' && !this.waitingForTarget && !this.autoPlay) {
      html += '<div class="action-bar">';
      html += `<button class="btn" onclick="game.playSelectedCard()" ${this.selectedCardIdx < 0 ? 'disabled' : ''}>出牌</button>`;

      const humanHeroId = humanPlayer.hero.id;
      // 技能按钮
      const skillDefs = {
        liubei: [{ id: 'rende', name: '仁德', cond: humanPlayer.hand.length > 0 }],
        sunquan: [{ id: 'zhiheng', name: '制衡', cond: !this.zhihengUsedThisTurn && humanPlayer.hand.length > 0 }],
        huanggai: [{ id: 'kurou', name: '苦肉', cond: humanPlayer.hp > 1 }],
        sunshangxiang: [{ id: 'jieyin', name: '结姻', cond: !this.jieyinUsedThisTurn && humanPlayer.hand.length >= 2 }],
        huatuo: [{ id: 'qingnang', name: '青囊', cond: !this.qingnangUsedThisTurn && humanPlayer.hand.length > 0 }],
        'shen-zhouyu': [{ id: 'yeyan', name: '业炎', cond: !this.yeyanUsedThisTurn && humanPlayer.hand.length >= 3 }],
        'shen-lvmeng': [{ id: 'gongxin', name: '攻心', cond: !this.gongxinUsedThisTurn }],
        'shen-lusu': [{ id: 'haoshi', name: '好施', cond: !this.haoshiUsedThisTurn && humanPlayer.hand.length > 0 }],
      };

      if (skillDefs[humanHeroId]) {
        for (const s of skillDefs[humanHeroId]) {
          html += `<button class="btn skill-btn" onclick="game.useSkill('${s.id}')" ${!s.cond ? 'disabled' : ''}>${s.name}</button>`;
        }
      }

      html += '<button class="btn" onclick="game.humanEndPlayPhase()">结束出牌</button>';
      html += '</div>';
    }

    html += '</div>'; // close game-board

    // 托管按钮（始终显示）
    html += '<div class="action-bar">';
    html += `<button class="btn auto-play-btn ${this.autoPlay ? 'active' : ''}" onclick="game.toggleAutoPlay()" ${this.gameOver ? 'disabled' : ''}>
      ${this.autoPlay ? '🔴 取消托管' : '🤖 托管'}
    </button>`;
    if (this.gameOver) {
      html += '<button class="btn" onclick="game.restart()">🔄 再来一局（同一武将）</button>';
      html += '<button class="btn" onclick="showHeroSelect()">🏠 选择武将</button>';
    }
    html += '</div>';

    // 日志
    html += '<div class="log-area">';
    const recentLogs = this.logEntries.slice(-30);
    for (const log of recentLogs) {
      html += `<div class="log-entry ${log.type}">${log.msg}</div>`;
    }
    html += '</div>';

    // 游戏结束弹窗
    if (this.gameOver) {
      let hu, isWin, resultMsg;
      if (this._isPvP) {
        const myIdx = (pvpManager && pvpManager.isHost) ? 0 : 1;
        hu = this.players.find(p => p.id === myIdx) || this.players.find(p => p.isHuman);
      } else {
        hu = this.players.find(p => p.isHuman);
      }
      if (this.gameMode >= 5) {
        const humanWin = (this.winningTeam === 'zhugong' && (hu.role === 'zhugong' || hu.role === 'zhongchen'))
                       || (this.winningTeam === 'fanzei' && hu.role === 'fanzei')
                       || (this.winningTeam === 'neijian' && hu.role === 'neijian');
        isWin = humanWin;
        const teamNames = { zhugong: '主公&忠臣', fanzei: '反贼', neijian: '内奸', free: '自由' };
        resultMsg = `获胜阵营：${teamNames[this.winningTeam] || '未知'}`;
      } else {
        const alive = this.players.filter(p => p.alive);
        isWin = alive.length > 0 && (this._isPvP ? hu.alive : alive[0].isHuman);
        resultMsg = alive.length > 0 ? alive[0].hero.name + ' 获得了最终胜利！' : '全员阵亡！';
      }
      html += `
      <div class="modal">
        <div class="modal-content">
          <h2>${isWin ? '🎉 胜利！' : '💀 失败…'}</h2>
          <p>${resultMsg}</p>`;
      // 显示所有玩家身份
      if (this.gameMode >= 5) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0;">';
        for (const p of this.players) {
          const r = ROLES[p.role];
          html += `<div style="font-size:12px;color:${r.color};background:rgba(0,0,0,0.3);padding:4px 10px;border-radius:6px;">${p.hero.name} ${r.icon}${r.name}${!p.alive ? ' (已阵亡)' : ''}</div>`;
        }
        html += '</div>';
      }
      html += `${!this._isPvP ? `<button class="btn" onclick="game.restart()" style="margin:5px;">再来一局（同一武将）</button>` : ''}
          <button class="btn" onclick="showHeroSelect()" style="margin:5px;">${this._isPvP ? '返回大厅' : '选择新武将'}</button>
        </div>
      </div>`;
    }

    // 技能详情弹窗
    if (this.skillModalHero) {
      const hero = this.skillModalHero;
      html += `<div class="skill-modal-overlay" onclick="game.closeSkillModal()">
        <div class="skill-modal-content" onclick="event.stopPropagation()">
          <h2>${hero.name}</h2>
          <div class="skill-detail-hero-title">${hero.title} · ${hero.faction} · ${hero.avatarClass.includes('female') ? '♀' : '♂'} · ${hero.maxHp}体力</div>`;
      for (const skill of hero.skills) {
        html += `<div class="skill-detail-card">
          <div class="skill-detail-name">${skill.name}<span class="skill-detail-type">${skill.type === 'locked' ? '锁定技' : '技能'}</span></div>
          <div class="skill-detail-desc">${skill.desc}</div>
        </div>`;
      }
      html += `<button class="btn" onclick="game.closeSkillModal()" style="margin-top:10px;">关闭</button>
        </div>
      </div>`;
    }

    app.innerHTML = html;
    const logEl = app.querySelector('.log-area');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  renderHeroPanel(player, isHuman, seat) {
    let classes = 'hero-panel';
    if (this.currentPlayerIdx === this.players.indexOf(player) && !this.gameOver) classes += ' active-turn';
    if (!player.alive) classes += ' dead';
    if (isHuman) classes += ' human-panel';

    let html = `<div class="${classes}">`;
    // 座位号徽章
    if (seat !== undefined && seat !== null) {
      const seatLabel = seat + 1;
      html += `<div class="seat-badge ${isHuman ? 'human' : ''}">${seatLabel}</div>`;
    }
    html += '<div class="hero-header">';
    html += `<div class="hero-avatar ${player.hero.avatarClass}">${player.hero.name[0]}</div>`;
    html += `<div><div class="hero-name">${player.hero.name}${player.linked ? ' ⛓️' : ''}</div><div class="hero-title">${player.hero.title}</div><div class="hero-faction">${player.hero.faction}</div>`;
    // 显示身份：人类玩家始终可见，主公始终公开，其他人死亡后公开
    if (this.gameMode >= 5 && player.role) {
      const showRole = player.isHuman || this.rolesRevealed[player.id] || this.gameOver || player.role === 'zhugong';
      const roleInfo = ROLES[player.role];
      html += `<div style="font-size:10px;color:${roleInfo.color};margin-top:2px;">`;
      html += showRole ? `${roleInfo.icon} ${roleInfo.name}` : `❓ 未知`;
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="hp-bar"><div class="hp-dots">';
    for (let i = 0; i < player.hero.maxHp; i++) {
      html += `<div class="hp-dot ${i >= player.hp ? 'lost' : ''}"></div>`;
    }
    html += `</div><span style="font-size:10px;color:#c0a060;">${player.hp}/${player.hero.maxHp}</span></div>`;

    html += '<div class="skills">';
    for (const skill of player.hero.skills) {
      html += `<span class="skill-badge" onclick="event.stopPropagation(); game.showSkillDetail('${player.hero.id}')" 
        title="点击查看技能详情：${skill.desc}" style="cursor:pointer;">${skill.name}</span>`;
    }
    html += '</div>';

    html += `<div class="hand-count" style="cursor:pointer;" onclick="game.showSkillDetail('${player.hero.id}')"
      title="点击查看武将技能详情">手牌: ${player.hand.length}张 👁️技能</div>`;

    html += '<div class="equipment-area">';
    const equipSlots = [
      { slot: 'weapon', label: '武器', cls: 'wpn' },
      { slot: 'armor', label: '防具', cls: 'armr' },
      { slot: 'plusHorse', label: '+1坐骑', cls: 'p1h' },
      { slot: 'minusHorse', label: '-1坐骑', cls: 'm1h' },
    ];
    // 过河拆桥/顺手牵羊时人类目标可点击装备和判定区
    const guoheTarget = this.waitingForTarget && !this.autoPlay
      && this.waitingForTarget.type === 'guohe_discard' && this.waitingForTarget.target.id === player.id;
    const shunshouTarget = this.waitingForTarget && !this.autoPlay
      && this.waitingForTarget.type === 'shunshou_steal' && this.waitingForTarget.target.id === player.id;
    const canClickEquip = guoheTarget || shunshouTarget;
    for (const { slot, label, cls } of equipSlots) {
      const eq = player.equipment[slot];
      const eqName = eq ? eq.name : '(空)';
      let clickAttr = '';
      if (canClickEquip && eq) {
        if (guoheTarget) clickAttr = ` onclick="event.stopPropagation(); game.humanGuoheDiscardEquip('${slot}')" style="cursor:pointer;border:2px dashed #f0d060;" title="点击弃置此装备"`;
        else if (shunshouTarget) clickAttr = ` onclick="event.stopPropagation(); game.humanShunshouStealEquip('${slot}')" style="cursor:pointer;border:2px dashed #60d0ff;" title="点击顺走此装备"`;
      }
      html += `<div class="equip-zone"><div class="equip-zone-label">${label}</div>
        <div class="equip-slot ${eq ? 'occupied ' + cls : ''}"${clickAttr}>${eqName}</div></div>`;
    }
    html += '</div>';

    html += '<div class="judge-area">';
    html += '<div class="judge-zone-label">判定区</div>';
    if (player.judgeArea.length > 0) {
      for (let ji = 0; ji < player.judgeArea.length; ji++) {
        const jc = player.judgeArea[ji];
        let jclick = '';
        if (guoheTarget) jclick = ` onclick="event.stopPropagation(); game.humanGuoheDiscardJudge(${ji})" style="cursor:pointer;border:2px dashed #f0d060;" title="点击弃置此延时锦囊"`;
        else if (shunshouTarget) jclick = ` onclick="event.stopPropagation(); game.humanShunshouStealJudge(${ji})" style="cursor:pointer;border:2px dashed #60d0ff;" title="点击顺走此延时锦囊"`;
        html += `<div class="judge-slot has-card"${jclick}>${jc.icon || ''} ${jc.name}</div>`;
      }
    } else {
      html += '<div class="judge-slot">(空)</div>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  getCardStyle(card) {
    switch (card.type) {
      case 'sha': return 'sha-type'; case 'shan': return 'shan-type'; case 'tao': return 'tao-type';
      case 'juedou': return 'juedou-type'; case 'weapon': return 'weapon-type';
      case 'plusHorse': return 'plushorse-type'; case 'minusHorse': return 'minushorse-type';
      case 'armor': return 'armor-type'; case 'lebu': case 'bingliang': case 'shandian': return 'delay-type';
      case 'wuxie': return 'wuxie-type'; default: return 'other-type';
    }
  }

  getMiniCardStyle(card) { return this.getCardStyle(card); }

  getNumberStr(num) {
    const map = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
    return map[num] || num;
  }

  handleCardClick(idx) {
    const humanPlayer = this.players.find(p => p.isHuman);
    if (!humanPlayer || !humanPlayer.alive || this.autoPlay) return;

    if (this.waitingForTarget) {
      const wt = this.waitingForTarget;
      const card = humanPlayer.hand[idx];

      if (wt.type === 'shan_response') {
        if (card.type === 'shan' || (humanPlayer.hero.id === 'guanyu' && isRedSuit(card.suit))) {
          this.humanRespondShan(card); return;
        }
        return;
      }
      if (wt.type === 'juedou_defend') {
        if (card.type === 'sha' || (humanPlayer.hero.id === 'guanyu' && isRedSuit(card.suit))) {
          this.humanRespondJuedou(card); return;
        }
        return;
      }
      if (wt.type === 'aoe_response') {
        if (card.type === wt.requiredType || (humanPlayer.hero.id === 'guanyu' && isRedSuit(card.suit))) {
          this.humanRespondAOE(card); return;
        }
        return;
      }
      if (wt.type === 'dying' && (card.type === 'tao' || card.type === 'jiu' || (wt.huatuoJijiu && isRedSuit(card.suit)))) { this.humanDyingUseTao(card); return; }
      if (wt.type === 'huogong_show') { this.humanShowCardForHuogong(idx); return; }
      if (wt.type === 'huogong_discard') { this.humanDiscardForHuogong(idx); return; }
      if (wt.type === 'juedou_defend_second' && (card.type === 'sha' || (humanPlayer.hero.id === 'guanyu' && isRedSuit(card.suit)))) { this.humanRespondJuedouSecond(card); return; }
      if (wt.type === 'guohe_discard') { this.humanGuoheDiscard({type: 'hand', idx, card: card}); return; }
      if (wt.type === 'shunshou_steal') { this.humanShunshouSteal({type: 'hand', idx, card: card}); return; }
      if (wt.type === 'discard_phase') { this.humanSelectDiscard(idx); return; }
      if (wt.type === 'jieyin_discard') { this.humanSelectJieyinDiscard(idx); return; }
      if (wt.type === 'yeyan_discard') { this.humanSelectYeyanDiscard(idx); return; }
      if (wt.type === 'fangzhu_discard') { this.humanFangzhuDiscard(idx); return; }
      return;
    }

    if (this.phase === 'play' && this.players[this.currentPlayerIdx].isHuman) {
      this.selectCard(idx);
    }
  }

  // ==================== 技能详情弹窗 ====================

  showSkillDetail(heroId) {
    const hero = this.skillModalHero = HEROES[heroId];
    if (!hero) return;
    this.render();
  }

  closeSkillModal() {
    this.skillModalHero = null;
    this.render();
  }

  restart() {
    if (this.gameMode >= 5 && this.heroIdList) {
      this.init(this.gameMode, this.heroIdList);
    } else {
      this.init(this.humanPlayerId);
    }
  }
}

// ==================== 启动 ====================

let game;

function startGame(heroId) {
  document.getElementById('app').innerHTML = '';
  game = new Game();
  window.game = game;
  // 重置 AI 速度为默认
  if (typeof setAISpeed === 'function') setAISpeed(0.45);
  game.init(heroId);
  game.render();
}

// ==================== 模式选择 ====================

function showHeroSelect() {
  showGameModeSelect();
}

function showGameModeSelect() {
  // 清理 PvP 连接
  if (pvpManager) {
    pvpManager.disconnect();
    pvpManager = null;
  }
  pvpMode = null;
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:30px;padding:20px;">
      <h1 style="font-size:40px;color:#f0d060;text-shadow:0 0 20px rgba(240,208,96,0.5);letter-spacing:8px;">🏯 三国杀</h1>
      <p style="color:#c0a060;font-size:16px;">选择游戏模式</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">
        <div onclick="startHeroPick(1)" style="
          width:200px;padding:30px;background:linear-gradient(180deg,rgba(30,15,5,0.9),rgba(50,25,10,0.95));
          border:2px solid #8b6914;border-radius:16px;cursor:pointer;text-align:center;
          transition:all 0.3s;
        " onmouseover="this.style.transform='scale(1.05)';this.style.borderColor='#f0d060';this.style.boxShadow='0 0 25px rgba(240,208,96,0.3)'"
           onmouseout="this.style.transform='scale(1)';this.style.borderColor='#8b6914';this.style.boxShadow='none'">
          <div style="font-size:48px;">⚔️</div>
          <div style="font-size:20px;font-weight:bold;margin:12px 0;color:#f0d060;">1v1 混战</div>
          <div style="font-size:12px;color:#a08050;">你 + 2名AI · 自由对战</div>
        </div>
        <div onclick="startHeroPick(5)" style="
          width:200px;padding:30px;background:linear-gradient(180deg,rgba(30,15,5,0.9),rgba(50,25,10,0.95));
          border:2px solid #8b6914;border-radius:16px;cursor:pointer;text-align:center;
          transition:all 0.3s;
        " onmouseover="this.style.transform='scale(1.05)';this.style.borderColor='#f0d060';this.style.boxShadow='0 0 25px rgba(240,208,96,0.3)'"
           onmouseout="this.style.transform='scale(1)';this.style.borderColor='#8b6914';this.style.boxShadow='none'">
          <div style="font-size:48px;">👑</div>
          <div style="font-size:20px;font-weight:bold;margin:12px 0;color:#f0d060;">五人身份局</div>
          <div style="font-size:12px;color:#a08050;">1主1忠2反1内 · 身份隐藏</div>
        </div>
        <div onclick="startHeroPick(8)" style="
          width:200px;padding:30px;background:linear-gradient(180deg,rgba(30,15,5,0.9),rgba(50,25,10,0.95));
          border:2px solid #8b6914;border-radius:16px;cursor:pointer;text-align:center;
          transition:all 0.3s;
        " onmouseover="this.style.transform='scale(1.05)';this.style.borderColor='#f0d060';this.style.boxShadow='0 0 25px rgba(240,208,96,0.3)'"
           onmouseout="this.style.transform='scale(1)';this.style.borderColor='#8b6914';this.style.boxShadow='none'">
          <div style="font-size:48px;">🏰</div>
          <div style="font-size:20px;font-weight:bold;margin:12px 0;color:#f0d060;">八人身份局</div>
          <div style="font-size:12px;color:#a08050;">1主2忠4反1内 · 身份隐藏</div>
        </div>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <div onclick="showPvPLobby()" style="
          display:inline-block;padding:18px 44px;background:linear-gradient(135deg,rgba(0,102,204,0.3),rgba(0,180,255,0.2));
          border:2px solid #3090d0;border-radius:14px;cursor:pointer;text-align:center;
          transition:all 0.3s;
        " onmouseover="this.style.transform='scale(1.05)';this.style.borderColor='#60c0ff';this.style.boxShadow='0 0 30px rgba(96,192,255,0.3)'"
           onmouseout="this.style.transform='scale(1)';this.style.borderColor='#3090d0';this.style.boxShadow='none'">
          <div style="font-size:48px;">🌐</div>
          <div style="font-size:20px;font-weight:bold;margin:12px 0;color:#60c0ff;">PvP 联机对战</div>
          <div style="font-size:12px;color:#5090b0;">创建/加入房间 · 双人对战</div>
        </div>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <button onclick="showHeroGallery()" style="
          padding:14px 40px;background:rgba(255,255,255,0.06);color:#c0a060;
          border:1px solid #6a5530;border-radius:10px;cursor:pointer;font-size:16px;
          transition:all 0.3s;
        " onmouseover="this.style.borderColor='#f0d060';this.style.color='#f0d060';this.style.background='rgba(255,255,255,0.1)'"
           onmouseout="this.style.borderColor='#6a5530';this.style.color='#c0a060';this.style.background='rgba(255,255,255,0.06)'">
          📜 查看武将
        </button>
      </div>
    </div>
  `;
}

// ==================== 武将图鉴 ====================

function showHeroGallery() {
  const app = document.getElementById('app');
  const heroes = Object.values(HEROES);
  
  // 按势力分组
  const factionOrder = ['魏', '蜀', '吴', '群', '神'];
  const factionColors = {
    '魏': { bg: 'rgba(30,50,90,0.9)', border: '#4a7ac0', title: '#80b0ff' },
    '蜀': { bg: 'rgba(60,30,20,0.9)', border: '#c05030', title: '#ff9060' },
    '吴': { bg: 'rgba(20,50,30,0.9)', border: '#40a050', title: '#60e080' },
    '群': { bg: 'rgba(50,20,50,0.9)', border: '#a050a0', title: '#d080e0' },
    '神': { bg: 'rgba(40,20,60,0.9)', border: '#9070d0', title: '#c0a0ff' },
  };
  
  const grouped = {};
  for (const f of factionOrder) grouped[f] = heroes.filter(h => h.faction === f);
  
  let html = `<div style="max-width:1100px;margin:0 auto;padding:20px;">`;
  html += `<h1 style="text-align:center;color:#f0d060;font-size:32px;margin-bottom:10px;">📜 武将图鉴</h1>`;
  html += `<div style="text-align:center;margin-bottom:25px;color:#a08050;">共 ${heroes.length} 名武将，点击查看技能详情</div>`;
  
  for (const f of factionOrder) {
    const list = grouped[f];
    if (list.length === 0) continue;
    const fc = factionColors[f];
    
    html += `<div style="margin-bottom:25px;">`;
    html += `<h2 style="color:${fc.title};font-size:20px;margin-bottom:12px;border-left:3px solid ${fc.border};padding-left:10px;">${f}</h2>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">`;
    
    for (const hero of list) {
      const avatarColors = {
        'CaoCao': 'linear-gradient(135deg, #1a2a50, #3040a0)',
        'sima': 'linear-gradient(135deg, #2a2030, #5040a0)',
        'caopi': 'linear-gradient(135deg, #1a2a55, #3050b0)',
        'xiahou': 'linear-gradient(135deg, #2a1530, #603090)',
        'zhangliao': 'linear-gradient(135deg, #152a30, #2060a0)',
        'xuchu': 'linear-gradient(135deg, #201a10, #806030)',
        'zhenji': 'linear-gradient(135deg, #3a1a2a, #8040a0)',
        'guojia': 'linear-gradient(135deg, #1a2a40, #4060a0)',
        'liubei': 'linear-gradient(135deg, #302010, #805030)',
        'guanyu': 'linear-gradient(135deg, #202a10, #508020)',
        'zhangfei': 'linear-gradient(135deg, #2a2010, #604020)',
        'zhugeliang': 'linear-gradient(135deg, #1a3020, #306050)',
        'zhaoyun': 'linear-gradient(135deg, #1a2530, #406080)',
        'machao': 'linear-gradient(135deg, #2a1a20, #804040)',
        'huangzhong': 'linear-gradient(135deg, #302010, #806030)',
        'sunquan': 'linear-gradient(135deg, #102a20, #206050)',
        'zhouyu': 'linear-gradient(135deg, #2a1515, #903030)',
        'lvmeng': 'linear-gradient(135deg, #1a2a30, #205070)',
        'luxun': 'linear-gradient(135deg, #1a3020, #306040)',
        'ganning': 'linear-gradient(135deg, #2a2015, #906030)',
        'huanggai': 'linear-gradient(135deg, #302010, #805040)',
        'daqiao': 'linear-gradient(135deg, #2a2030, #8050a0)',
        'sunshangxiang': 'linear-gradient(135deg, #3a2020, #a04040)',
        'huatuo': 'linear-gradient(135deg, #2a3020, #606030)',
        'lübu': 'linear-gradient(135deg, #301010, #a02020)',
        'diaochan': 'linear-gradient(135deg, #3a2040, #a04080)',
        'yuanshao': 'linear-gradient(135deg, #302820, #807040)',
        'caocao': 'linear-gradient(135deg, #1a2a50, #3040a0)',
        'shen-zhouyu': 'linear-gradient(135deg, #3a1010, #a02020)',
        'shen-lvmeng': 'linear-gradient(135deg, #2a1a3a, #6040a0)',
        'jiaxu': 'linear-gradient(135deg, #1a0a1a, #4a2050)',
        'shen-lusu': 'linear-gradient(135deg, #1a3a3a, #306060)',
      };
      const bg = avatarColors[hero.id] || avatarColors[hero.avatarClass] || 'linear-gradient(135deg, #2a2a3a, #4a4a6a)';
      
      html += `<div style="background:${fc.bg};border:1px solid ${fc.border};border-radius:12px;padding:16px;cursor:pointer;transition:all 0.25s;"
        onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.4)'"
        onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'"
        onclick="showHeroDetail('${hero.id}')">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:56px;height:56px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            ${hero.name[0]}
          </div>
          <div style="flex:1;">
            <div style="font-size:17px;font-weight:bold;color:#f0d060;">${hero.name}</div>
            <div style="font-size:12px;color:#a09080;margin:3px 0;">${hero.title}</div>
            <div style="font-size:12px;color:#ff8080;">❤ ${hero.maxHp}体力</div>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
          ${hero.skills.map(s => `<span style="background:rgba(240,208,96,0.12);color:#f0d060;padding:2px 8px;border-radius:4px;font-size:11px;">${s.name}</span>`).join('')}
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }
  
  html += `<div style="text-align:center;margin-top:20px;">
    <button onclick="showGameModeSelect()" style="padding:12px 30px;background:rgba(255,255,255,0.08);color:#c0a060;border:1px solid #6a5530;border-radius:8px;cursor:pointer;font-size:15px;">返回首页</button>
  </div>`;
  html += `</div>`;
  
  app.innerHTML = html;
}

function showHeroDetail(heroId) {
  const hero = HEROES[heroId];
  if (!hero) return;
  
  const factionColors = {
    '魏': '#80b0ff', '蜀': '#ff9060', '吴': '#60e080', '群': '#d080e0', '神': '#c0a0ff',
  };
  
  const app = document.getElementById('app');
  let html = `<div style="max-width:600px;margin:40px auto;padding:20px;">`;
  html += `<div style="background:linear-gradient(180deg,rgba(20,16,10,0.95),rgba(40,30,20,0.95));border:2px solid #8b6914;border-radius:16px;padding:30px;text-align:center;">`;
  
  // 头像
  html += `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#3a2a1a,#605030);display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:bold;color:#f0d060;margin-bottom:15px;box-shadow:0 4px 16px rgba(0,0,0,0.4);border:2px solid #8b6914;">${hero.name[0]}</div>`;
  html += `<h2 style="color:#f0d060;font-size:24px;margin:0;">${hero.name}</h2>`;
  html += `<div style="color:#c0a060;font-size:14px;margin:4px 0;">${hero.title}</div>`;
  html += `<div style="color:${factionColors[hero.faction] || '#c0a060'};font-size:13px;margin-bottom:15px;">${hero.faction}势力 · ${hero.maxHp}体力</div>`;
  
  // 技能
  html += `<div style="text-align:left;margin-top:20px;">`;
  html += `<h3 style="color:#e0c080;font-size:16px;border-bottom:1px solid #3a3020;padding-bottom:8px;">技能</h3>`;
  for (const skill of hero.skills) {
    html += `<div style="background:rgba(240,208,96,0.06);border-radius:8px;padding:12px 16px;margin-bottom:10px;">`;
    html += `<div style="color:#f0d060;font-size:15px;font-weight:bold;">${skill.name}</div>`;
    html += `<div style="color:#b0a080;font-size:13px;margin-top:4px;line-height:1.6;">${skill.desc}</div>`;
    html += `</div>`;
  }
  html += `</div>`;
  
  html += `<button onclick="showHeroGallery()" style="margin-top:20px;padding:10px 28px;background:rgba(255,255,255,0.08);color:#c0a060;border:1px solid #6a5530;border-radius:8px;cursor:pointer;font-size:14px;">← 返回武将列表</button>`;
  html += `</div></div>`;
  
  app.innerHTML = html;
}

// ==================== PvP 联机大厅 ====================

let pvpManager = null;
let pvpMode = null; // 'host' | 'guest' | null
let pvpGameMode = 0; // 选定的模式
let pvpOpponentPick = null; // 对手选将

function showPvPLobby() {
  pvpManager = null;
  pvpMode = null;
  pvpGameMode = 0;
  pvpOpponentPick = null;
  document.getElementById('app').innerHTML = `
    <div class="pvp-lobby">
      <h2 style="color:#f0d060;font-size:28px;">🌐 PvP 联机对战</h2>
      <div style="color:#a09070;font-size:14px;margin-bottom:8px;">
        一人创建房间，另一人输入房间号加入
      </div>
      
      <div class="pvp-btn-row">
        <button class="btn" style="min-width:140px;background:linear-gradient(135deg,rgba(0,102,204,0.4),rgba(0,180,255,0.3));border-color:#3090d0;" 
          onclick="pvpCreateRoom()">🏠 创建房间</button>
        <button class="btn" style="min-width:140px;" onclick="pvpShowJoin()">🚪 加入房间</button>
      </div>
      
      <div id="pvp-panel" style="margin-top:10px;width:100%;max-width:420px;"></div>
      
      <button class="btn-outline" onclick="showGameModeSelect()" style="margin-top:10px;">⬅ 返回主菜单</button>
    </div>
  `;
}

// ========== 创建房间 ==========
function pvpCreateRoom() {
  pvpMode = 'host';
  renderPvpPanel();
}

// ========== 加入房间 ==========
function pvpShowJoin() {
  pvpMode = 'guest';
  renderPvpPanel();
}

function renderPvpPanel() {
  const panel = document.getElementById('pvp-panel');
  if (!panel) return;
  
  if (pvpMode === 'host') {
    panel.innerHTML = `
      <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
        <p style="color:#a09070;margin:0 0 12px 0;">创建房间后将生成6位房间码，</p>
        <p style="color:#a09070;margin:0 0 16px 0;">将房间码发送给对手即可加入</p>
        <button class="btn" onclick="pvpStartHost()">创建并等待对手加入</button>
      </div>
    `;
  } else if (pvpMode === 'guest') {
    panel.innerHTML = `
      <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
        <p style="color:#a09070;margin:0 0 10px 0;">输入主机分享的6位房间码</p>
        <input id="pvp-room-input" class="pvp-input" placeholder="输入房间码" maxlength="6" 
          style="text-transform:uppercase;" oninput="document.getElementById('pvp-room-input').value=this.value.toUpperCase()">
        <div style="margin-top:12px;">
          <button class="btn" onclick="pvpStartJoin()">加入房间</button>
        </div>
      </div>
    `;
    // 聚焦输入框
    setTimeout(() => {
      const inp = document.getElementById('pvp-room-input');
      if (inp) inp.focus();
    }, 100);
  }
}

// ========== 等待对手 ==========
function pvpShowWaiting(statusText) {
  const panel = document.getElementById('pvp-panel');
  if (!panel) return;
  const connectingIcon = pvpMode === 'host' ? '🏠' : '🚪';
  panel.innerHTML = `
    <div style="text-align:center;padding:24px;background:rgba(0,0,0,0.4);border-radius:12px;">
      <div style="font-size:36px;margin-bottom:12px;">${connectingIcon}</div>
      <div id="pvp-status-line" class="pvp-status">${statusText || '正在连接...'}</div>
      <div style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out infinite;"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.2s infinite;"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.4s infinite;"></div>
      </div>
      <button class="btn-outline" onclick="pvpCancel()" style="margin-top:16px;">取消</button>
    </div>
  `;
}

function pvpUpdateStatus(msg, isError) {
  const el = document.getElementById('pvp-status-line');
  if (el) {
    el.textContent = msg;
    el.className = 'pvp-status' + (isError ? ' error' : '');
  }
}

function pvpCancel() {
  if (pvpManager) { pvpManager.disconnect(); pvpManager = null; }
  showPvPLobby();
}

// ========== 主机：开始等待 ==========
function pvpStartHost() {
  const game = new Game();
  pvpManager = new PvPManager(game);
  game.pvpManager = pvpManager;
  
  pvpShowWaiting('正在创建房间...');
  
  pvpManager.onStatus((msg) => pvpUpdateStatus(msg));
  
  pvpManager.onConnected(() => {
    pvpUpdateStatus('玩家已加入！准备开始游戏...', false);
    // 显示模式选择
    setTimeout(() => pvpShowModeSelect(), 800);
  });
  
  pvpManager.onDisconnected(() => {
    pvpUpdateStatus('连接已断开', true);
  });
  
  // 设置动作回调
  setupPvpActionHandler(game);
  
  pvpManager.createRoom();
  
  // 显示房间码
  setTimeout(() => {
    const panel = document.getElementById('pvp-panel');
    if (panel && pvpManager.roomCode) {
      panel.innerHTML = `
        <div style="text-align:center;">
          <p style="color:#a09070;margin:0 0 8px 0;">房间码（点击复制）</p>
          <div class="pvp-room-code" onclick="pvpCopyRoomCode()" 
               title="点击复制房间码">${pvpManager.roomCode}</div>
          <p style="color:#5090b0;font-size:12px;margin:8px 0;">将房间码发送给对手</p>
          <div id="pvp-status-line" class="pvp-status">等待玩家加入...</div>
          <div style="margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out infinite;"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.2s infinite;"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.4s infinite;"></div>
          </div>
          <button class="btn-outline" onclick="pvpCancel()" style="margin-top:14px;">取消</button>
        </div>
      `;
    }
  }, 500);
}

function pvpCopyRoomCode() {
  if (pvpManager && pvpManager.roomCode) {
    navigator.clipboard.writeText(pvpManager.roomCode).then(() => {
      pvpUpdateStatus('已复制房间码！', false);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = pvpManager.roomCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      pvpUpdateStatus('已复制房间码！', false);
    });
  }
}

// ========== 客机：加入房间 ==========
function pvpStartJoin() {
  const input = document.getElementById('pvp-room-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (code.length !== 6) {
    pvpUpdateStatus('请输入6位房间码', true);
    return;
  }
  
  const game = new Game();
  pvpManager = new PvPManager(game);
  game.pvpManager = pvpManager;
  
  pvpShowWaiting('正在加入房间...');
  
  pvpManager.onStatus((msg) => pvpUpdateStatus(msg));
  
  pvpManager.onConnected(() => {
    pvpUpdateStatus('已成功加入房间！等待主机开始游戏...', false);
  });
  
  pvpManager.onDisconnected(() => {
    pvpUpdateStatus('连接已断开', true);
  });
  
  // 主机发来的 game_init 会包含初始状态
  pvpManager.onAction((action, payload) => {
    if (action === 'mode_select') {
      pvpUpdateStatus('主机正在选择游戏模式...', false);
    } else if (action === 'host_hero_picked') {
      pvpUpdateStatus('主机已选将，轮到你了...', false);
      // 主机选完后，客机选将
      setTimeout(() => startPvPGuestHeroPick(payload.availableHeroes, payload.hostHeroId), 500);
    } else if (action === 'game_init') {
      // 接收完整游戏状态，开始游戏
      pvpUpdateStatus('游戏开始！', false);
      startPvPGuestGame(game, payload);
    }
  });
  
  setupPvpActionHandler(game);
  
  pvpManager.joinRoom(code);
}

// ========== 主机：PvP 模式选择 ==========
function pvpShowModeSelect() {
  const panel = document.getElementById('pvp-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
      <p style="color:#f0d060;font-size:18px;margin:0 0 14px 0;">选择游戏模式</p>
      <div class="pvp-btn-row" style="margin-bottom:10px;">
        <button class="btn" onclick="pvpStartGame(1)" style="min-width:120px;">👤 1v1</button>
        <button class="btn" onclick="pvpStartGame(5)" style="min-width:120px;">👥 五人局</button>
        <button class="btn" onclick="pvpStartGame(8)" style="min-width:120px;">👥 八人局</button>
      </div>
      <p style="font-size:12px;color:#a09070;">你和对手各控制一名角色，其余为AI</p>
    </div>
  `;
  // 通知客机
  pvpManager.sendAction('mode_select', {});
}

// ========== 主机：PvP 开始游戏 ==========
function pvpStartGame(gameMode) {
  pvpGameMode = gameMode;
  // 主机先选将
  startPvPHostHeroPick(gameMode);
}

function startPvPHostHeroPick(gameMode) {
  const game = pvpManager.game;
  const totalPlayers = gameMode === 1 ? 3 : gameMode;
  const allHeroIds = Object.keys(HEROES);
  const pool = [...allHeroIds];
  shuffleArray(pool);
  // 为主机准备3个候选
  const hostChoices = pool.slice(0, 3);
  
  // 存到 game 中
  game._pvpHeroPool = pool;
  game._pvpTotalPlayers = totalPlayers;
  game._pvpGameMode = gameMode;
  
  const panel = document.getElementById('pvp-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
      <p style="color:#f0d060;font-size:18px;margin:0 0 14px 0;">选择你的武将（Host）</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        ${hostChoices.map(hid => {
          const h = HEROES[hid];
          return `<div onclick="pvpHostPickHero('${hid}')" style="cursor:pointer;width:120px;background:rgba(0,0,0,0.4);border:2px solid #8b6914;border-radius:10px;padding:12px 8px;text-align:center;transition:all 0.3s;"
            onmouseover="this.style.borderColor='#f0d060';this.style.transform='scale(1.05)'"
            onmouseout="this.style.borderColor='#8b6914';this.style.transform='scale(1)'">
            <div style="font-size:11px;color:#a09070;">${h.kingdom}</div>
            <div style="font-size:16px;font-weight:bold;color:#f0d060;margin:6px 0;">${h.name}</div>
            <div style="font-size:10px;color:#808080;">${h.title}</div>
            <div style="font-size:10px;color:#5090b0;margin:4px 0;">❤ ${h.hp} HP</div>
            <div style="font-size:9px;color:#c0a060;line-height:1.3;">${h.skills.map(s => s.name).join(' · ')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ========== 主机选将 ==========
function pvpHostPickHero(heroId) {
  const game = pvpManager.game;
  game._pvpHostHero = heroId;
  
  // 发送给客机，让客机选将
  const allHeroIds = Object.keys(HEROES);
  const availableForGuest = allHeroIds.filter(id => id !== heroId);
  shuffleArray(availableForGuest);
  const guestChoices = availableForGuest.slice(0, 3);
  
  pvpManager.sendAction('host_hero_picked', {
    hostHeroId: heroId,
    availableHeroes: guestChoices,
  });
  
  // 等待客机选将
  const panel = document.getElementById('pvp-panel');
  if (panel) {
    panel.innerHTML = `
      <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
        <p style="color:#f0d060;">已选择 <span style="font-weight:bold;">${HEROES[heroId].name}</span></p>
        <div class="pvp-status">等待对手选将...</div>
        <div style="margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out infinite;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.2s infinite;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.4s infinite;"></div>
        </div>
      </div>
    `;
  }
  
  // 监听客机的选择
  const prevHandler = pvpManager._onActionCallback;
  pvpManager._onActionCallback = (action, payload) => {
    if (action === 'guest_hero_picked') {
      // 恢复处理器
      pvpManager._onActionCallback = prevHandler;
      const guestHero = payload.heroId;
      // 设置 guest 的英雄
      game._pvpGuestHero = guestHero;
      // 初始化游戏
      pvpInitHostGame(game);
    } else if (prevHandler) {
      prevHandler(action, payload);
    }
  };
}

// ========== 客机选将 ==========
function startPvPGuestHeroPick(availableHeroes, hostHeroId) {
  const panel = document.getElementById('pvp-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
      <p style="color:#f0d060;font-size:18px;margin:0 0 4px 0;">选择你的武将</p>
      <p style="color:#a09070;font-size:12px;margin:0 0 14px 0;">主机已选：${HEROES[hostHeroId] ? HEROES[hostHeroId].name : '?'}</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        ${availableHeroes.map(hid => {
          const h = HEROES[hid];
          return `<div onclick="pvpGuestPickHero('${hid}')" style="cursor:pointer;width:120px;background:rgba(0,0,0,0.4);border:2px solid #8b6914;border-radius:10px;padding:12px 8px;text-align:center;transition:all 0.3s;"
            onmouseover="this.style.borderColor='#f0d060';this.style.transform='scale(1.05)'"
            onmouseout="this.style.borderColor='#8b6914';this.style.transform='scale(1)'">
            <div style="font-size:11px;color:#a09070;">${h.kingdom}</div>
            <div style="font-size:16px;font-weight:bold;color:#f0d060;margin:6px 0;">${h.name}</div>
            <div style="font-size:10px;color:#808080;">${h.title}</div>
            <div style="font-size:10px;color:#5090b0;margin:4px 0;">❤ ${h.hp} HP</div>
            <div style="font-size:9px;color:#c0a060;line-height:1.3;">${h.skills.map(s => s.name).join(' · ')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ========== 客机发送选将 ==========
function pvpGuestPickHero(heroId) {
  pvpManager.sendAction('guest_hero_picked', { heroId: heroId });
  
  const panel = document.getElementById('pvp-panel');
  if (panel) {
    panel.innerHTML = `
      <div style="text-align:center;padding:16px;background:rgba(0,0,0,0.3);border-radius:12px;">
        <p style="color:#f0d060;">已选择 <span style="font-weight:bold;">${HEROES[heroId].name}</span></p>
        <div class="pvp-status">等待主机开始游戏...</div>
        <div style="margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out infinite;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.2s infinite;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#60c0ff;animation:blink 0.8s ease-in-out 0.4s infinite;"></div>
        </div>
      </div>
    `;
  }
}

// ========== 主机：初始化 PvP 游戏 ==========
function pvpInitHostGame(game) {
  const gameMode = game._pvpGameMode;
  const totalPlayers = game._pvpTotalPlayers;
  const hostHero = game._pvpHostHero;
  const guestHero = game._pvpGuestHero;
  const pool = game._pvpHeroPool;
  
  // 初始化游戏 (PvP 模式，玩家0=主机，玩家1=客机)
  game.initPvP(gameMode, totalPlayers, pool, hostHero, guestHero);
  
  // 序列化初始状态并发送给客机
  const initialState = serializeGameState(game);
  // 为客机提供自己的手牌 (玩家1)
  initialState.players.forEach(p => {
    if (p.id === 1 && p.isHuman) {
      const guestPlayer = game.players[1];
      if (guestPlayer) {
        p.hand = guestPlayer.hand.map(c => ({ id: c.id, name: c.name, suit: c.suit, number: c.number, type: c.type, category: c.category }));
      }
    }
  });
  // 隐藏主机手牌内容，确保客机手牌存在
  initialState.players.forEach(p => {
    if (p.id === 0) p.hand = null;
    if (p.id === 1 && (!p.hand || p.hand.length === 0)) {
      const gp = game.players[1];
      if (gp) p.hand = gp.hand.map(c => ({ id: c.id, name: c.name, suit: c.suit, number: c.number, type: c.type, category: c.category }));
    }
  });
  initialState._pvpMode = true;
  
  pvpManager.sendGameInit(initialState);
  
  // 渲染主机视角
  game.render();
  
  // 如果当前是客机回合，进入等待状态
  const currentPlayer = game.players[game.currentPlayerIdx];
  if (currentPlayer && currentPlayer.isHuman && currentPlayer.id !== 0) {
    game._pvpWaitingForRemote = true;
  }
  
  // 开始回合
  game.startCurrentTurn();
}

// ========== 客机：开始游戏（接收主机状态） ==========
function startPvPGuestGame(game, initialState) {
  game.importPvPState(initialState);
  game.render();
  
  // 如果当前是客机回合
  const currentPlayer = game.players[game.currentPlayerIdx];
  if (currentPlayer && currentPlayer.isHuman && currentPlayer.id === 1) {
    game._pvpWaitingForRemote = false;
  } else {
    game._pvpWaitingForRemote = true;
  }
  
  game.startCurrentTurn();
}

// ========== PvP 动作处理器 ==========
function setupPvpActionHandler(game) {
  game._isPvP = true;
  
  pvpManager.onAction((action, payload) => {
    if (action === 'game_init' || action === 'host_hero_picked' || 
        action === 'mode_select' || action === 'guest_hero_picked') return;
    
    handlePvpRemoteAction(game, action, payload);
  });
  
  // PvP 断开处理
  pvpManager.onDisconnected(() => {
    if (!game.gameOver) {
      game.addLog('⚠️ 对手已断开连接，游戏暂停', 'important');
      game.render();
    }
  });
}

function handlePvpRemoteAction(game, action, payload) {
  const { playerId } = payload || {};
  
  switch (action) {
    case 'playCard':
      // 远程玩家打出卡牌
      game._pvpRemotePlayCard(payload);
      break;
    
    case 'respond':
      // 远程玩家响应
      game._pvpRemoteRespond(payload);
      break;
    
    case 'endPhase':
      game._pvpRemoteEndPhase(payload);
      break;
    
    case 'playShan':
      game._pvpRemotePlayShan(payload);
      break;
    
    case 'useSkill':
      game._pvpRemoteUseSkill(payload);
      break;
    
    case 'selectHeroPick':
      game._pvpRemoteHeroPick(payload);
      break;
    
    case 'guoheDiscard':
      game._pvpRemoteGuoheDiscard(payload);
      break;
    
    case 'shunshouSteal':
      game._pvpRemoteShunshouSteal(payload);
      break;
    
    case 'tiesuoSelect':
      game._pvpRemoteTiesuoSelect(payload);
      break;
    
    case 'tiesuoReforge':
      game._pvpRemoteTiesuoReforge(payload);
      break;
    
    case 'huogongShow':
      game._pvpRemoteHuogongShow(payload);
      break;
    
    case 'huogongDiscard':
      game._pvpRemoteHuogongDiscard(payload);
      break;
    
    case 'fangzhuChoice':
      game._pvpRemoteFangzhuChoice(payload);
      break;
    
    case 'jianxiongChoice':
      game._pvpRemoteJianxiongChoice(payload);
      break;
    
    case 'tianduChoice':
      game._pvpRemoteTianduChoice(payload);
      break;
    
    case 'leijiChoice':
      game._pvpRemoteLeijiChoice(payload);
      break;
    
    case 'discardCards':
      game._pvpRemoteDiscardCards(payload);
      break;
    
    case 'aiAction':
      game._pvpRemoteAiAction(payload);
      break;
    
    case 'stateSync':
      // 完整状态同步（客机接收）
      if (pvpManager && !pvpManager.isHost) {
        applyGameState(game, payload);
        game.render();
        // 检查是否需要恢复回合推进
        const cp = game.players[game.currentPlayerIdx];
        if (cp && cp.isHuman && cp.id === 1) {
          // 是客机回合，恢复游戏
          game._pvpWaitingForRemote = false;
          // 根据阶段恢复
          if (game.phase === 'draw') {
            setTimeout(() => game.humanDrawPhase(false), 300);
          } else if (game.phase === 'play') {
            game.render();
          } else if (game.phase === 'discard') {
            setTimeout(() => game.handleHumanDiscard(), 300);
          }
        }
      }
      break;
    
    default:
      console.log('[PvP] 未处理的远程动作:', action, payload);
  }
}

// ========== 广播动作（当前玩家调用） ==========
function pvpBroadcast(game, action, payload) {
  if (!game._isPvP || !pvpManager || !pvpManager.connected) return;
  
  // 只在本地玩家行动时广播到对方
  const currentPlayer = game.players[game.currentPlayerIdx];
  if (!currentPlayer) return;
  
  // 确定谁是我的本地玩家
  const myPlayerIdx = pvpManager.isHost ? 0 : 1;
  const remotePlayerIdx = pvpManager.isHost ? 1 : 0;
  
  const myPlayer = game.players.find(p => p.id === myPlayerIdx);
  if (!myPlayer || !myPlayer.isHuman) return;
  
  // 如果是我的回合，广播动作
  if (myPlayerIdx === currentPlayer.id) {
    pvpManager.sendAction(action, { ...payload, playerId: myPlayerIdx });
  }
  // 如果是对响应或主动技能，也广播
  else if (action === 'respond' || action === 'useSkill' || action === 'playShan' || 
           action === 'guoheDiscard' || action === 'shunshouSteal' ||
           action === 'huogongShow' || action === 'huogongDiscard' ||
           action === 'fangzhuChoice' || action === 'jianxiongChoice' ||
           action === 'tianduChoice' || action === 'leijiChoice' ||
           action === 'discardCards') {
    pvpManager.sendAction(action, { ...payload, playerId: myPlayerIdx });
  }
}

// 广播 AI 动作（仅主机）
function pvpBroadcastAiAction(game, action, payload) {
  if (!game._isPvP || !pvpManager || !pvpManager.connected) return;
  if (!pvpManager.isHost) return;
  pvpManager.sendAction('aiAction', { action, payload });
}

// ========== 洗牌辅助函数 ==========
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ==================== 选将系统 ====================

let heroPickState = null;

function startHeroPick(gameMode) {
  const totalPlayers = gameMode === 1 ? 3 : gameMode;
  const allHeroIds = Object.keys(HEROES);

  // 为每个玩家随机分配3个候选英雄（不重复）
  const pool = [...allHeroIds];
  for (let k = pool.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [pool[k], pool[j]] = [pool[j], pool[k]];
  }
  const choices = [];
  for (let i = 0; i < totalPlayers; i++) {
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    choices.push(pool.slice(0, 3));
  }

  // 5人或8人模式：预分配身份，确定主公
  let roles = null;
  let lordIdx = -1;
  let lordHero = null;
  if (gameMode >= 5) {
    const rolePool = buildRolePool(gameMode);
    // 洗牌身份
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }
    roles = rolePool;
    lordIdx = rolePool.indexOf('zhugong');

    // 主公多一个候选武将名额（4选1）
    if (lordIdx >= 0) {
      const heroPool = [...allHeroIds];
      for (let k = heroPool.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [heroPool[k], heroPool[j]] = [heroPool[j], heroPool[k]];
      }
      const extraHero = heroPool.find(h => !choices[lordIdx].includes(h));
      if (extraHero) choices[lordIdx].push(extraHero);
    }

    // 主公是AI：自动选将（优先选体力最高的）
    if (lordIdx > 0) {
      const lordChoices = [...choices[lordIdx]];
      lordChoices.sort((a, b) => HEROES[b].maxHp - HEROES[a].maxHp);
      lordHero = lordChoices[0];
    }
  }

  const picked = new Array(totalPlayers).fill(null);
  if (lordHero) picked[lordIdx] = lordHero;

  // 若主公AI已先选将，从人类候选池中排除该武将，避免重复
  let humanChoices = [...choices[0]];
  if (lordHero) {
    humanChoices = humanChoices.filter(h => h !== lordHero);
    while (humanChoices.length < 3) {
      const extra = allHeroIds.find(h => !humanChoices.includes(h) && !picked.includes(h));
      if (extra) humanChoices.push(extra);
      else break;
    }
  }

  heroPickState = { gameMode, choices, picked, totalPlayers, roles, lordIdx, lordHero };
  showHumanHeroPick(humanChoices, gameMode, lordHero, lordIdx);
}

function showHumanHeroPick(heroChoices, gameMode, lordHero, lordIdx) {
  const app = document.getElementById('app');
  let cardsHtml = '';
  heroChoices.forEach(hId => {
    const h = HEROES[hId];
    cardsHtml += `
    <div onclick="confirmHeroPick('${h.id}')" style="
      width:180px;padding:20px;background:linear-gradient(180deg,rgba(30,15,5,0.95),rgba(50,25,10,0.95));
      border:2px solid #8b6914;border-radius:14px;cursor:pointer;text-align:center;
      transition:all 0.3s;
    " onmouseover="this.style.transform='scale(1.08)';this.style.borderColor='#f0d060';this.style.boxShadow='0 0 30px rgba(240,208,96,0.4)'"
       onmouseout="this.style.transform='scale(1)';this.style.borderColor='#8b6914';this.style.boxShadow='none'">
      <div class="hero-avatar ${h.avatarClass}" style="margin:0 auto 10px;width:70px;height:70px;font-size:32px;">${h.name[0]}</div>
      <div style="font-size:20px;font-weight:bold;margin-bottom:3px;">${h.name}</div>
      <div style="font-size:11px;color:#a08050;margin-bottom:8px;">${h.title} · ${h.faction}</div>
      <div style="font-size:11px;color:#a08050;margin-bottom:8px;">体力: ${'❤️'.repeat(h.maxHp)}</div>
      <div style="font-size:10px;color:#b09030;display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">
        ${h.skills.map(s => `<span style="background:rgba(139,105,20,0.3);border:1px solid #8b6914;border-radius:3px;padding:2px 6px;">${s.name}</span>`).join('')}
      </div>
    </div>`;
  });

  // 主公信息栏
  let lordInfoHtml = '';
  if (lordIdx === 0) {
    // 人类是主公
    lordInfoHtml = `<div style="background:rgba(240,208,96,0.12);border:2px solid #f0d060;border-radius:14px;padding:16px 28px;text-align:center;margin-bottom:8px;">
      <div style="font-size:18px;color:#f0d060;font-weight:bold;">👑 你是主公（一号位）</div>
      <div style="font-size:12px;color:#c0a060;margin-top:4px;">主公身份公开，体力上限+1，可从4名武将中选将</div>
    </div>`;
  } else if (lordHero && lordIdx > 0) {
    // AI是主公，展示其已选武将
    const lh = HEROES[lordHero];
    lordInfoHtml = `<div style="background:rgba(240,208,96,0.12);border:2px solid #f0d060;border-radius:14px;padding:16px 28px;text-align:center;margin-bottom:8px;">
      <div style="font-size:16px;color:#f0d060;font-weight:bold;">👑 主公已选择（一号位）</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:10px;">
        <div class="hero-avatar ${lh.avatarClass}" style="width:52px;height:52px;font-size:24px;margin:0;">${lh.name[0]}</div>
        <div style="text-align:left;">
          <div style="font-size:19px;font-weight:bold;color:#f0d060;">${lh.name}</div>
          <div style="font-size:12px;color:#c0a060;">${lh.title} · 体力上限+1: ${'❤️'.repeat(lh.maxHp + 1)}</div>
        </div>
      </div>
    </div>`;
  }

  const pickCount = heroChoices.length;
  const modeNames = { 1: '1v1 混战模式', 5: '五人身份局', 8: '八人身份局' };
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:25px;padding:20px;">
      <h1 style="font-size:30px;color:#f0d060;text-shadow:0 0 20px rgba(240,208,96,0.5);">🎯 选择武将</h1>
      <p style="color:#c0a060;font-size:15px;">${modeNames[gameMode] || gameMode + '人局'} — 从${pickCount}名武将中选择一位</p>
      ${lordInfoHtml}
      <div style="display:flex;gap:25px;flex-wrap:wrap;justify-content:center;">
        ${cardsHtml}
      </div>
      <p style="color:#806040;font-size:12px;">点击武将卡片确认选择</p>
    </div>
  `;
}

function confirmHeroPick(heroId) {
  if (!heroPickState) return;
  heroPickState.picked[0] = heroId;

  // AI自动选将：跳过已选的主公槽位
  const pickedHeroIds = [...heroPickState.picked]; // 包含主公已选
  for (let i = 1; i < heroPickState.totalPlayers; i++) {
    if (pickedHeroIds[i]) continue; // 主公(非人类)已自动选
    const choices = heroPickState.choices[i].filter(h => !pickedHeroIds.includes(h));
    if (choices.length > 0) {
      choices.sort((a, b) => HEROES[b].maxHp - HEROES[a].maxHp);
      pickedHeroIds[i] = choices[0];
    } else {
      const remaining = Object.keys(HEROES).filter(h => !pickedHeroIds.includes(h));
      pickedHeroIds[i] = remaining[Math.floor(Math.random() * remaining.length)];
    }
  }

  const preRoles = heroPickState.roles;
  heroPickState = null;
  const mode = pickedHeroIds.length >= 5 ? pickedHeroIds.length : 1;
  document.getElementById('app').innerHTML = '';
  game = new Game();
  window.game = game;
  game.init(mode, pickedHeroIds, preRoles);
  game.render();
}

showHeroSelect();