// ==================== 工具与渲染模块 ====================
// Game 类的公开辅助方法：摸牌、距离计算、决斗回合、伤害处理、牌堆管理、弃牌操作、
// 手牌数获取等供前端界面调用的通用工具函数。
  Game.prototype.drawCard = function(player, count = 1) {
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

  Game.prototype.calcDistance = function(from, to, forSha = false) {
    let dist = 1;
    if (to.equipment.plusHorse && !(forSha && from.equipment.weapon && from.equipment.weapon.id === 'qinggang')) dist += 1;
    if (from.equipment.minusHorse) dist -= 1;
    if (from.hero.id === 'gongsunzan' && from.hp > 2) dist -= 1;
    if (to.hero.id === 'gongsunzan' && to.hp <= 2) dist += 1;
    return Math.max(1, dist);
  }

  Game.prototype.juedouRound = function(challenger, defender, challengerCard = null) {
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

  Game.prototype.dealDamage = function(target, source, amount, card = null) {
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

  Game.prototype.getNextAlivePlayer = function(current) {
    const idx = this.players.indexOf(current);
    for (let i = 1; i <= this.players.length; i++) {
      const p = this.players[(idx + i) % this.players.length];
      if (p.alive) return p;
    }
    return null;
  }

  Game.prototype.addLog = function(msg, type = '') {
    this.logEntries.push({ msg, type });
    // 超过 150 条时批量截断，避免频繁 shift()
    if (this.logEntries.length > 200) {
      this.logEntries = this.logEntries.slice(-150);
    }
  }

  // 装备牌名简写映射
  const EQUIP_SHORT = {
    '诸葛连弩': '连弩', '青龙偃月刀': '青龙刀', '丈八蛇矛': '丈八', '贯石斧': '贯石',
    '青釭剑': '青釭', '方天画戟': '方天', '朱雀羽扇': '朱雀', '麒麟弓': '麒麟',
    '寒冰剑': '寒冰', '古锭刀': '古锭',
    '八卦阵': '八卦', '仁王盾': '仁王',
    '的卢': '的卢', '绝影': '绝影', '爪黄飞电': '爪黄',
    '赤兔': '赤兔', '大宛': '大宛', '紫骍': '紫骍',
  };
  Game.prototype.getEquipShortName = function(name) {
    return EQUIP_SHORT[name] || name;
  };

  Game.prototype._renderPvPBadge = function() {
    if (!this._isPvP) return '';
    const connected = pvpManager && pvpManager.connected;
    return `<span class="pvp-badge">
      <span class="dot${connected ? '' : ' disconnected'}"></span>
      ${connected ? '联机中' : '断开连接'}
    </span>`;
  }

  Game.prototype.render = function() {
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

  Game.prototype._doRender = function() {
    const app = document.getElementById('app');
    // 叫分阶段：单独渲染叫分界面
    if (this.phase === 'bidding') { this.renderBidding(); return; }
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
        ${(this.gameMode >= 5 || this.isDouDizhu) ? this.getModeName() + ' · ' : ''}
        回合: ${player ? player.hero.name : ''}
        ${(this.gameMode >= 5 || this.isDouDizhu) && humanPlayer && humanPlayer.role ? ` · 你的身份: ${getRoleDisplayName(humanPlayer.role)}` : ''}
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

    // 椭圆环形桌位布局（人类固定桌底，其余按座位环绕）
    const sortedPlayers = [...this.players].sort((a, b) => a.seat - b.seat);
    const N = sortedPlayers.length;
    const step = 360 / N;
    let humanPos = sortedPlayers.findIndex(p => p.isHuman);
    if (humanPos < 0) humanPos = 0;
    const seatOffset = 180 - humanPos * step; // 旋转桌面，使人类固定到桌底(180°)

    html += '<div class="game-board">';
    html += '<div class="seat-table">';

    // 桌心：牌堆 + 出牌流向提示
    html += `<div class="table-center">
      <div class="deck-visual-bar">牌堆</div>
      <span class="table-deck-info">牌堆 ${this.deck.length} 张 | 弃牌 ${this.discardPile.length} 张</span>
      <div class="table-ring-hint">出牌顺序 ↺</div>
    </div>`;

    for (const p of sortedPlayers) {
      const idx = sortedPlayers.indexOf(p);
      const angle = ((idx * step + seatOffset) % 360 + 360) % 360;
      const theta = angle * Math.PI / 180;
      const xPct = (36 * Math.sin(theta)).toFixed(2);
      const yPct = (-34 * Math.cos(theta)).toFixed(2);
      const isHuman = p.isHuman;
      html += `<div class="player-slot ${isHuman ? 'has-human' : ''}" style="--x:${xPct}%;--y:${yPct}%;">`;

      // 英雄面板
      html += this.renderHeroPanel(p, isHuman, p.seat);

      // AI/敌人手牌（数字显示）
      if (!isHuman && p.hand.length > 0) {
        html += `<div class="player-hand-row" style="text-align:center;color:#c0a060;font-size:11px;">手牌: ${p.hand.length}张</div>`;
      }

      // 人类手牌与装备已移至桌面底部托盘（seat-table 之后渲染，不参与环形定位）

      html += '</div>'; // close player-slot
    }

    html += '</div>'; // close seat-table

    // 人类专属底部操作托盘（不参与环形定位，桌面底部独立横条）
    if (humanPlayer && humanPlayer.alive) {
      html += '<div class="human-tray">';
      html += '<div class="human-hand-inline">';
      html += '<div class="hand-label-inline"><span>手牌 (' + humanPlayer.hand.length + '张) ' + (this.autoPlay ? '<span style="color:#60ff80;">🤖托管中</span>' : '') + '</span>';

      if (this.waitingForTarget?.type === 'discard_phase') {
        const wt = this.waitingForTarget;
        html += '<span style="color:#ff6060;">弃 ' + wt.needDiscard + ' 张 (已选 ' + wt.selected.length + ')</span>';
      }
      if (this.waitingForTarget?.type === 'jieyin_discard') {
        const wt = this.waitingForTarget;
        html += '<span style="color:#ffe080;">结姻选牌 (已选 ' + wt.selected.length + ')</span>';
      }
      if (this.waitingForTarget?.type === 'yeyan_discard') {
        const wt = this.waitingForTarget;
        html += '<span style="color:#ffa040;">业炎选牌 (已选 ' + wt.selected.length + ')</span>';
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
            clickable = humanPlayer.isHuman && wt.target.id === humanPlayer.id;
          }
          else if (wt.type === 'huogong_discard') {
            clickable = humanPlayer.isHuman && wt.source.id === humanPlayer.id && card.suit === wt.suit;
          }
          else if (wt.type === 'discard_phase' || wt.type === 'jieyin_discard' || wt.type === 'yeyan_discard'
            || wt.type === 'fangzhu_discard' || wt.type === 'guohe_discard' || wt.type === 'shunshou_steal') {
            // 盲选模式下出牌者是玩家自己，不应点击自己的手牌
            clickable = !wt.blindPick;
          }
          else if (wt.type) clickable = false;
        }

        if (!isHumanTurn && !this.waitingForTarget) clickable = false;
        if (this.autoPlay && !this.waitingForTarget) clickable = false;

        const suitColor = isRedSuit(card.suit) ? 'card-suit-red' : 'card-suit-black';
        html += '<div class="card ' + cardClass + ' ' + (clickable ? '' : 'disabled') + '"'
          + ' onclick="game.handleCardClick(' + i + ')">'
          + '<div class="card-top"><span class="card-suit-num ' + suitColor + '">' + card.suit + this.getNumberStr(card.number) + '</span></div>'
          + '<div class="card-icon">' + card.icon + '</div>'
          + '<div class="card-name-text">' + card.name + '</div>'
          + '<div class="card-num-bot ' + suitColor + '">' + card.suit + this.getNumberStr(card.number) + '</div>'
          + '</div>';
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
        const eqName = eq ? this.getEquipShortName(eq.name) : '(空)';
        html += '<div class="equip-zone"><div class="equip-zone-label">' + label + '</div>'
          + '<div class="equip-slot ' + (eq ? 'occupied ' + cls : '') + '">' + eqName + '</div></div>';
      }
      html += '</div>';
      html += '</div>'; // close human-tray
    }

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
      if (wt.type === 'feiyang') {
        html += `<span style="color:#f0d060;margin-right:10px;">【飞扬】选择要抵消的判定牌（将弃2张手牌）：</span>`;
        for (let i = 0; i < wt.judgeCards.length; i++) {
          const jc = wt.judgeCards[i];
          html += `<button class="btn skill-btn" onclick="game.humanFeiyang(${i})">抵消【${jc.name}】</button>`;
        }
        html += '<button class="btn" onclick="game.humanFeiyang(-1)">不发动</button>';
      }
      if (wt.type === 'nongmin_bonus') {
        html += `<span style="color:#60e080;margin-right:10px;">队友阵亡！【同心】选择：</span>`;
        html += '<button class="btn skill-btn" onclick="game.humanNongminBonus(\'draw\')">摸2张牌</button>';
        html += '<button class="btn skill-btn" onclick="game.humanNongminBonus(\'heal\')">回复1点体力</button>';
      }
      // 过河拆桥/顺手牵羊盲选手牌（出牌者看不见牌面，仅按位置选）
      if ((wt.type === 'guohe_discard' || wt.type === 'shunshou_steal') && wt.blindPick) {
        const verb = wt.type === 'guohe_discard' ? '弃置' : '顺走';
        html += `<span style="color:#f0d060;margin-right:10px;">选择要${verb}${wt.target.hero.name}的手牌（点击装备/判定区可直选）：</span>`;
        const handChoices = wt.choices.filter(c => c.type === 'hand');
        for (let i = 0; i < handChoices.length; i++) {
          html += `<button class="btn" onclick="game.humanBlindPickHand('${wt.type}', ${i})" style="border:1px dashed #666;">手牌${i + 1}</button>`;
        }
        html += '<button class="btn" onclick="game.waitingForTarget = null; game.render()">取消</button>';
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
      } else if (this.isDouDizhu) {
        const humanWin = (this.winningTeam === 'dizhu' && hu.role === 'dizhu')
                       || (this.winningTeam === 'nongmin' && hu.role === 'nongmin');
        isWin = humanWin;
        resultMsg = `获胜阵营：${this.winningTeam === 'dizhu' ? '🏴 地主' : '🌾 农民'}`;
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
      if (this.gameMode >= 5 || this.isDouDizhu) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:10px 0;">';
        for (const p of this.players) {
          const r = ROLES[p.role];
          html += `<div style="font-size:12px;color:${r.color};background:rgba(0,0,0,0.3);padding:4px 10px;border-radius:6px;">${p.hero.name} ${r.icon}${r.name}${!p.alive ? ' (已阵亡)' : ''}</div>`;
        }
        html += '</div>';
      }
      html += `<button class="btn btn-replay" onclick="showReplay()" style="margin:5px;">📋 复盘本局</button>
        ${!this._isPvP ? `<button class="btn" onclick="game.restart()" style="margin:5px;">再来一局（同一武将）</button>` : ''}
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

  Game.prototype.renderHeroPanel = function(player, isHuman, seat) {
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
    if ((this.gameMode >= 5 || this.isDouDizhu) && player.role) {
      const showRole = player.isHuman || this.rolesRevealed[player.id] || this.gameOver || player.role === 'zhugong' || player.role === 'dizhu';
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
      const eqName = eq ? this.getEquipShortName(eq.name) : '(空)';
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

  Game.prototype.getCardStyle = function(card) {
    switch (card.type) {
      case 'sha': return 'sha-type'; case 'shan': return 'shan-type'; case 'tao': return 'tao-type';
      case 'juedou': return 'juedou-type'; case 'weapon': return 'weapon-type';
      case 'plusHorse': return 'plushorse-type'; case 'minusHorse': return 'minushorse-type';
      case 'armor': return 'armor-type'; case 'lebu': case 'bingliang': case 'shandian': return 'delay-type';
      case 'wuxie': return 'wuxie-type'; default: return 'other-type';
    }
  }

  Game.prototype.getNumberStr = function(num) {
    const map = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
    return map[num] || num;
  }

  Game.prototype.handleCardClick = function(idx) {
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
      if (wt.type === 'guohe_discard') {
        if (wt.blindPick) return;
        this.humanGuoheDiscard({type: 'hand', idx, card: card}); return;
      }
      if (wt.type === 'shunshou_steal') {
        if (wt.blindPick) return;
        this.humanShunshouSteal({type: 'hand', idx, card: card}); return;
      }
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

  Game.prototype.showSkillDetail = function(heroId) {
    const hero = this.skillModalHero = HEROES[heroId];
    if (!hero) return;
    this.render();
  }

  Game.prototype.closeSkillModal = function() {
    this.skillModalHero = null;
    this.render();
  }

  Game.prototype.restart = function() {
    if (this.isDouDizhu && this.ddzHeroIds) {
      startDouDizhuBidding(this.ddzHeroIds);
      return;
    }
    if (this.gameMode >= 5 && this.heroIdList) {
      this.init(this.gameMode, this.heroIdList);
    } else {
      this.init(this.humanPlayerId);
    }
  }

