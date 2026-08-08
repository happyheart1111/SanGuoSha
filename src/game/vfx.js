// ==================== VFX 特效引擎 ====================
// 独立于 innerHTML 重建的持久化特效层，提供伤害飘字、屏幕震动、
// 技能光效、卡牌飞行、回合过渡等视觉反馈。
// 所有特效挂载在 #vfx-layer 上，不受 game._doRender 的 innerHTML 重建影响。

const VFX = (function() {
  let layer = null;
  let initialized = false;

  function init() {
    if (initialized) return;
    layer = document.getElementById('vfx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'vfx-layer';
      layer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:500;overflow:hidden;';
      document.body.appendChild(layer);
    }
    initialized = true;
  }

  // 获取玩家英雄面板在屏幕上的位置
  function getPlayerCenter(playerId) {
    const panels = document.querySelectorAll('.hero-panel');
    for (const panel of panels) {
      // 通过面板内的武将名匹配
      const nameEl = panel.querySelector('.hero-name');
      if (!nameEl) continue;
      // 尝试匹配 player id — 游戏中面板没有 data-pid，通过座位匹配
      // 用 avatar class + name 首字 匹配
      const avatar = panel.querySelector('.hero-avatar');
      if (avatar && avatar.textContent.trim()) {
        const rect = panel.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
      }
    }
    // 降级：屏幕中心
    return { x: window.innerWidth / 2, y: window.innerHeight / 2, rect: null };
  }

  // 按座位号获取面板位置
  function getSeatCenter(seat) {
    const badge = document.querySelector('.seat-badge');
    const panel = badge ? badge.closest('.hero-panel') : null;
    const allPanels = document.querySelectorAll('.player-slot');
    for (const slot of allPanels) {
      const badgeEl = slot.querySelector('.seat-badge');
      if (badgeEl && parseInt(badgeEl.textContent.trim()) === seat + 1) {
        const rect = slot.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
      }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2, rect: null };
  }

  // 按玩家对象获取位置（优先用 hero.name 匹配面板）
  function getTargetCenter(player) {
    if (!player) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const allSlots = document.querySelectorAll('.player-slot');
    for (const slot of allSlots) {
      const nameEl = slot.querySelector('.hero-name');
      if (nameEl && nameEl.textContent.replace(/[⛓️\s]/g, '').startsWith(player.hero.name)) {
        const panel = slot.querySelector('.hero-panel') || slot;
        const rect = panel.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
      }
    }
    // 人类底部托盘
    const tray = document.querySelector('.human-tray .hero-panel') || document.querySelector('.human-tray');
    if (tray) {
      const rect = tray.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // ====== 飘字 ======
  function spawnFloatText(x, y, text, type) {
    init();
    const el = document.createElement('div');
    el.className = 'vfx-float-text vfx-' + (type || 'damage');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer.appendChild(el);
    // 随机偏移
    const offsetX = (Math.random() - 0.5) * 40;
    el.style.setProperty('--offset-x', offsetX + 'px');
    el.addEventListener('animationend', () => el.remove());
    // 安全清理
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2000);
  }

  // ====== 屏幕震动 ======
  function screenShake(intensity) {
    init();
    const container = document.querySelector('.game-container') || document.body;
    intensity = intensity || 1;
    container.classList.remove('vfx-shake');
    void container.offsetWidth; // reflow
    container.style.setProperty('--shake-intensity', intensity);
    container.classList.add('vfx-shake');
    setTimeout(() => container.classList.remove('vfx-shake'), 400);
  }

  // ====== 目标闪烁 ======
  function flashTarget(player, color) {
    const center = getTargetCenter(player);
    if (!center.rect) return;
    init();
    const el = document.createElement('div');
    el.className = 'vfx-flash-overlay';
    el.style.left = center.rect.left + 'px';
    el.style.top = center.rect.top + 'px';
    el.style.width = center.rect.width + 'px';
    el.style.height = center.rect.height + 'px';
    if (color) el.style.setProperty('--flash-color', color);
    layer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 800);
  }

  // ====== 粒子爆发 ======
  function particleBurst(x, y, color, count) {
    init();
    count = count || 12;
    color = color || '#ff6060';
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'vfx-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const dist = 40 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      p.style.background = color;
      const size = 4 + Math.random() * 6;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      layer.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
      setTimeout(() => { if (p.parentNode) p.remove(); }, 1000);
    }
  }

  // ====== 技能激活光环 ======
  function skillActivate(player) {
    const center = getTargetCenter(player);
    init();
    // 环形扩散
    const ring = document.createElement('div');
    ring.className = 'vfx-skill-ring';
    ring.style.left = center.x + 'px';
    ring.style.top = center.y + 'px';
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
    setTimeout(() => { if (ring.parentNode) ring.remove(); }, 1000);
    // 粒子
    particleBurst(center.x, center.y, '#f0d060', 16);
  }

  // ====== 回合过渡横幅 ======
  function turnBanner(heroName, isHuman) {
    init();
    const el = document.createElement('div');
    el.className = 'vfx-turn-banner' + (isHuman ? ' vfx-turn-human' : '');
    el.innerHTML = '<span class="vfx-turn-line"></span>' +
      '<span class="vfx-turn-text">' + heroName + ' 的回合</span>' +
      '<span class="vfx-turn-line"></span>';
    layer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2000);
  }

  // ====== 死亡消散 ======
  function deathEffect(player) {
    const center = getTargetCenter(player);
    init();
    // 灰色粒子
    particleBurst(center.x, center.y, '#666666', 20);
    // 暗色扩散环
    const ring = document.createElement('div');
    ring.className = 'vfx-death-ring';
    ring.style.left = center.x + 'px';
    ring.style.top = center.y + 'px';
    layer.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
    setTimeout(() => { if (ring.parentNode) ring.remove(); }, 1200);
  }

  // ====== 卡牌出牌飞行 ======
  function cardFly(fromPlayer, toPlayer) {
    const from = getTargetCenter(fromPlayer);
    const to = getTargetCenter(toPlayer);
    init();
    const card = document.createElement('div');
    card.className = 'vfx-card-fly';
    card.textContent = '🃏';
    card.style.left = from.x + 'px';
    card.style.top = from.y + 'px';
    card.style.setProperty('--target-x', (to.x - from.x) + 'px');
    card.style.setProperty('--target-y', (to.y - from.y) + 'px');
    layer.appendChild(card);
    card.addEventListener('animationend', () => card.remove());
    setTimeout(() => { if (card.parentNode) card.remove(); }, 700);
  }

  // ====== 伤害完整效果 ======
  function damageEffect(player, amount) {
    const center = getTargetCenter(player);
    spawnFloatText(center.x, center.y - 20, '-' + amount, 'damage');
    flashTarget(player, 'rgba(255,50,50,0.5)');
    particleBurst(center.x, center.y, '#ff4040', 10 + amount * 4);
    screenShake(Math.min(amount * 0.5 + 0.5, 1.5));
  }

  // ====== 治疗完整效果 ======
  function healEffect(player, amount) {
    const center = getTargetCenter(player);
    spawnFloatText(center.x, center.y - 20, '+' + amount, 'heal');
    particleBurst(center.x, center.y, '#60ff60', 8);
  }

  // ====== 清理 ======
  function clear() {
    if (layer) layer.innerHTML = '';
  }

  return {
    init,
    spawnFloatText,
    screenShake,
    flashTarget,
    particleBurst,
    skillActivate,
    turnBanner,
    deathEffect,
    cardFly,
    damageEffect,
    healEffect,
    clear,
    getTargetCenter
  };
})();

// 挂到全局
window.VFX = VFX;
