// ==================== 游戏核心类定义 ====================
// Game 类的构造函数，初始化所有游戏状态变量（玩家数组、牌堆、回合阶段、技能标记、PvP 标记、
// 渲染防抖等），是所有游戏逻辑的入口和状态容器。

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
}
