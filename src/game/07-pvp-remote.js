// Auto-split from game.js — 07-pvp-remote
  Game.prototype._pvpRemotePlayCard = function(payload) {
    const { playerId, cardIdx, targetPlayerIdx, effectiveType } = payload;
    const player = this.players[playerId];
    if (!player || !player.alive) return;

    const card = player.hand[cardIdx];
    if (!card) return;

    const target = (targetPlayerIdx != null && targetPlayerIdx >= 0) ? this.players[targetPlayerIdx] : null;
    // 统一走本地结算入口，确保与主机端行为一致（玩家为 AI，不会再次广播）
    this.useCardOnTarget(card, target, effectiveType);
  }

  Game.prototype._pvpRemoteRespond = function(payload) {
    const { playerId, cardIdx } = payload;
    this._pvpRespondData = { playerId, cardIdx }; // 存储响应数据供后续使用
  }

  Game.prototype._pvpRemoteEndPhase = function(payload) {
    const { playerId } = payload;
    this._pvpNextPhase = true; // 标记推进阶段
  }

  Game.prototype._pvpRemotePlayShan = function(payload) {
    const { playerId, cardIdx } = payload;
    this._pvpShanData = { playerId, cardIdx };
  }

  Game.prototype._pvpRemoteUseSkill = function(payload) {
    this._pvpSkillData = payload;
  }

  Game.prototype._pvpRemoteHeroPick = function(payload) {
    this._pvpHeroPickData = payload;
  }

  Game.prototype._pvpRemoteGuoheDiscard = function(payload) {
    this._pvpGuoheData = payload;
  }

  Game.prototype._pvpRemoteShunshouSteal = function(payload) {
    this._pvpShunshouData = payload;
  }

  Game.prototype._pvpRemoteTiesuoSelect = function(payload) {
    this._pvpTiesuoData = payload;
  }

  Game.prototype._pvpRemoteTiesuoReforge = function(payload) {
    this._pvpTiesuoReforgeDone = true;
  }

  Game.prototype._pvpRemoteHuogongShow = function(payload) {
    this._pvpHuogongShowData = payload;
  }

  Game.prototype._pvpRemoteHuogongDiscard = function(payload) {
    this._pvpHuogongDiscardData = payload;
  }

  Game.prototype._pvpRemoteFangzhuChoice = function(payload) {
    this._pvpFangzhuData = payload;
  }

  Game.prototype._pvpRemoteJianxiongChoice = function(payload) {
    this._pvpJianxiongData = payload;
  }

  Game.prototype._pvpRemoteTianduChoice = function(payload) {
    this._pvpTianduData = payload;
  }

  Game.prototype._pvpRemoteLeijiChoice = function(payload) {
    this._pvpLeijiData = payload;
  }

  Game.prototype._pvpRemoteDiscardCards = function(payload) {
    this._pvpDiscardData = payload;
  }

  Game.prototype._pvpRemoteAiAction = function(payload) {
    // 仅客机处理：主机发来的AI动作
    if (pvpManager && !pvpManager.isHost) {
      this._pvpAiActionData = payload;
    }
  }

