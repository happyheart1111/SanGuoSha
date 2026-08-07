// ==================== PvP 网络模块 (PeerJS) ====================
// 基于 WebRTC 数据通道实现双端 P2P 对战
// 使用 PeerJS 免费云信令服务，无需后端服务器

let PVP_DEBUG = true;

const PVP_CONFIG = {
  // PeerJS 免费云信令
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  // 连接超时
  connectTimeout: 30000,
  // 心跳间隔
  heartbeatInterval: 5000,
};

// ========== PvP 管理器 ==========

class PvPManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.conn = null;
    this.roomCode = null;
    this.isHost = false;
    this.connected = false;
    this.opponentName = '';
    this.pendingActions = [];
    this._heartbeatTimer = null;
    this._connectTimer = null;
    this._statusCallback = null;
    this._onConnectedCallback = null;
    this._onDisconnectedCallback = null;
    this._onActionCallback = null;
  }

  // ========== 状态回调 ==========

  onStatus(cb) { this._statusCallback = cb; }
  onConnected(cb) { this._onConnectedCallback = cb; }
  onDisconnected(cb) { this._onDisconnectedCallback = cb; }
  onAction(cb) { this._onActionCallback = cb; }

  _status(msg) {
    if (this._statusCallback) this._statusCallback(msg);
    if (PVP_DEBUG) console.log('[PvP]', msg);
  }

  // ========== 创建房间（主机） ==========

  createRoom() {
    this.isHost = true;
    this.roomCode = this._generateRoomCode();
    const peerId = 'sgs-' + this.roomCode;

    this._status('正在创建房间...');
    this.peer = new Peer(peerId, {
      host: PVP_CONFIG.host,
      port: PVP_CONFIG.port,
      secure: PVP_CONFIG.secure,
      debug: PVP_DEBUG ? 1 : 0,
    });

    this.peer.on('open', (id) => {
      this._status('房间创建成功！');
    });

    this.peer.on('connection', (conn) => {
      if (this.conn) {
        conn.close();
        this._status('已有玩家连接，拒绝新连接');
        return;
      }
      this._setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      this._status('连接错误: ' + err.message);
      if (err.type === 'unavailable-id') {
        // ID 冲突，重试
        this.roomCode = this._generateRoomCode();
        const newPeerId = 'sgs-' + this.roomCode;
        try {
          this.peer.destroy();
        } catch (e) {}
        setTimeout(() => this._retryCreate(newPeerId), 500);
      }
    });

    this._connectTimer = setTimeout(() => {
      if (!this.connected) {
        this._status('等待玩家加入中...（超时不会断开，请继续等待）');
      }
    }, PVP_CONFIG.connectTimeout);
  }

  _retryCreate(peerId) {
    this._status('正在创建房间...');
    this.peer = new Peer(peerId, {
      host: PVP_CONFIG.host,
      port: PVP_CONFIG.port,
      secure: PVP_CONFIG.secure,
      debug: PVP_DEBUG ? 1 : 0,
    });
    this.peer.on('open', () => this._status('房间创建成功！'));
    this.peer.on('connection', (conn) => {
      if (this.conn) { conn.close(); return; }
      this._setupConnection(conn);
    });
    this.peer.on('error', (err) => {
      this._status('发生错误: ' + err.message);
    });
  }

  // ========== 加入房间（客机） ==========

  joinRoom(code) {
    this.isHost = false;
    this.roomCode = code;
    const peerId = 'sgs-' + this._generateRandomId();
    const targetId = 'sgs-' + code;

    this._status('正在连接房间 ' + code + '...');
    this.peer = new Peer(peerId, {
      host: PVP_CONFIG.host,
      port: PVP_CONFIG.port,
      secure: PVP_CONFIG.secure,
      debug: PVP_DEBUG ? 1 : 0,
    });

    this.peer.on('open', () => {
      this._status('已连接到信令服务器，正在加入房间...');
      const conn = this.peer.connect(targetId, {
        reliable: true,
        serialization: 'json',
      });
      this._setupConnection(conn);

      this._connectTimer = setTimeout(() => {
        if (!this.connected) {
          this._status('连接超时！请检查房间号是否正确');
          this.disconnect();
        }
      }, PVP_CONFIG.connectTimeout);
    });

    this.peer.on('error', (err) => {
      this._status('连接错误: ' + err.message);
    });
  }

  // ========== 连接管理 ==========

  _setupConnection(conn) {
    this.conn = conn;

    conn.on('open', () => {
      this.connected = true;
      if (this._connectTimer) { clearTimeout(this._connectTimer); this._connectTimer = null; }
      
      this._status(this.isHost ? '玩家已加入！' : '已成功加入房间！');
      
      // 发送握手
      this._send({ type: 'handshake', isHost: this.isHost });

      // 开始心跳
      this._startHeartbeat();

      if (this._onConnectedCallback) this._onConnectedCallback();
    });

    conn.on('data', (data) => {
      this._handleMessage(data);
    });

    conn.on('close', () => {
      this._handleDisconnect();
    });

    conn.on('error', (err) => {
      console.error('[PvP] 连接错误:', err);
      this._handleDisconnect();
    });
  }

  _handleDisconnect() {
    this.connected = false;
    this._stopHeartbeat();
    if (this._onDisconnectedCallback) this._onDisconnectedCallback();
    this._status('对方已断开连接');
  }

  // ========== 消息处理 ==========

  _handleMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'handshake':
        this.opponentName = data.isHost ? 'Host' : 'Guest';
        this._status('连接已建立，等待游戏开始...');
        break;

      case 'heartbeat':
        if (data.ack) return;
        this._send({ type: 'heartbeat', ack: true });
        break;

      case 'action':
        if (this._onActionCallback) {
          this._onActionCallback(data.action, data.payload);
        }
        break;

      case 'game_init':
        if (this._onActionCallback) {
          this._onActionCallback('game_init', data.payload);
        }
        break;

      case 'chat':
        if (this.game && this.game.addLog) {
          this.game.addLog('[对手] ' + data.msg, 'chat');
        }
        break;

      default:
        console.log('[PvP] 未知消息类型:', data.type);
    }
  }

  _send(data) {
    if (this.conn && this.connected) {
      try {
        this.conn.send(data);
      } catch (e) {
        console.error('[PvP] 发送失败:', e);
      }
    }
  }

  // ========== 公共 API ==========

  // 发送游戏动作
  sendAction(action, payload) {
    if (!this.connected) return;
    this._send({ type: 'action', action, payload });
  }

  // 发送游戏初始化数据（仅主机）
  sendGameInit(payload) {
    if (!this.isHost || !this.connected) return;
    this._send({ type: 'game_init', payload });
  }

  // 发送聊天消息
  sendChat(msg) {
    if (!this.connected) return;
    this._send({ type: 'chat', msg });
  }

  // 断开连接
  disconnect() {
    this._stopHeartbeat();
    if (this._connectTimer) { clearTimeout(this._connectTimer); }
    this.connected = false;
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { 
        this.peer.destroy(); 
      } catch (e) {
        // disconnect may already be in progress
      }
      this.peer = null;
    }
  }

  // ========== 心跳 ==========

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this._send({ type: 'heartbeat' });
    }, PVP_CONFIG.heartbeatInterval);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ========== 工具方法 ==========

  _generateRoomCode() {
    // 6 位易读的房间码（排除容易混淆的字符）
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  _generateRandomId() {
    return Math.random().toString(36).substring(2, 10);
  }
}

// ========== 游戏状态序列化 ==========
// PvP 需要将游戏状态序列化以同步双端

function serializeGameState(game) {
  return {
    players: game.players.map(p => ({
      id: p.id,
      heroId: p.hero.id,
      name: p.name,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      isHuman: p.isHuman,
      isAI: p.isAI,
      role: p.role || null,
      hand: p.isHuman ? null : p.hand.map(c => ({ id: c.id, name: c.name, suit: c.suit, number: c.number, type: c.type, category: c.category })),
      handCount: p.hand.length,
      equipment: { ...p.equipment },
      judgeArea: p.judgeArea.map(c => ({ id: c.id, name: c.name, suit: c.suit, number: c.number, type: c.type, category: c.category })),
      linked: p.linked,
      seat: p.seat,
      deckPosition: p.deckPosition,
    })),
    discardPileCount: game.discardPile.length,
    deckCount: game.deck.length,
    currentPlayerIdx: game.currentPlayerIdx,
    phase: game.phase,
    gameMode: game.gameMode,
    rolesRevealed: { ...game.rolesRevealed },
    winningTeam: game.winningTeam,
    gameOver: game.gameOver,
    shaUsedThisTurn: game.shaUsedThisTurn,
    logEntries: game.logEntries.slice(-10), // 最近10条日志
  };
}

// 为对手视角生成状态（隐藏对手手牌内容）
function serializeOpponentView(game, opponentPlayerIdx) {
  const state = serializeGameState(game);
  // 隐藏所有人类玩家手牌，只暴露对手自己的
  state.players.forEach(p => {
    if (p.isHuman && p.id !== opponentPlayerIdx) {
      p.hand = null;
    }
  });
  const ownPlayer = game.players.find(p => p.id === opponentPlayerIdx);
  if (ownPlayer) {
    const pState = state.players.find(p => p.id === opponentPlayerIdx);
    if (pState) {
      pState.hand = ownPlayer.hand.map(c => ({ id: c.id, name: c.name, suit: c.suit, number: c.number, type: c.type, category: c.category }));
    }
  }
  return state;
}

function applyGameState(game, state) {
  // 更新牌堆计数（不直接替换，因为卡牌对象不同）
  // 仅更新可视状态
  game.players.forEach((p, i) => {
    if (state.players[i]) {
      const sp = state.players[i];
      p.hp = sp.hp;
      p.maxHp = sp.maxHp;
      p.alive = sp.alive;
      p.equipment = { ...sp.equipment };
      p.judgeArea = sp.judgeArea.map(c => game._reconstructCard(c));
      p.linked = sp.linked;
      p.handCount = sp.handCount || p.hand.length;
      if (p.isHuman && sp.hand) {
        p.hand = sp.hand.map(c => game._reconstructCard(c));
      }
    }
  });
  game.currentPlayerIdx = state.currentPlayerIdx;
  game.phase = state.phase;
  game.rolesRevealed = { ...state.rolesRevealed };
  game.winningTeam = state.winningTeam;
  game.gameOver = state.gameOver;
  game.shaUsedThisTurn = state.shaUsedThisTurn;
}
