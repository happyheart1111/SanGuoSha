// ============================================================
//  VFX Layer — 打击感特效引擎（技术美术）
//  设计约束：
//   - #app 每帧 innerHTML 整块重建，故所有瞬时特效必须放在独立的
//     #vfx-layer 覆盖层，绝不进入游戏 DOM，否则会被重建清掉/重复触发。
//   - 所有动画只用 transform / opacity（GPU 合成），不碰 box-shadow /
//     filter 动画，保证移动端预算可控。
//   - 元素短生命周期，animationend 即销毁，无残留图层堆积。
// ============================================================
window.VFX = (function () {
  const layer = () => document.getElementById('vfx-layer');
  let lastShake = 0;

  // 取某个武将面板中心的屏幕坐标，找不到则回退到视口中心
  function centerOf(playerId) {
    const el = playerId != null ? document.getElementById('hero-' + playerId) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // 在 (x,y) 生成一个短暂特效节点
  function spawn(cls, x, y, inner) {
    const l = layer();
    if (!l) return null;
    const el = document.createElement('div');
    el.className = 'vfx ' + cls;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    if (inner) el.innerHTML = inner;
    l.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    // 兜底清理，防止 animationend 未触发时残留
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1500);
    return el;
  }

  // 全屏闪光（伤害红 / 治疗绿）
  function flash(cls) {
    const l = layer();
    if (!l) return;
    const el = document.createElement('div');
    el.className = 'vfx ' + cls;
    l.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 800);
  }

  // 屏幕震动（带节流，避免多段伤害叠加过猛）
  function shake() {
    const now = performance.now();
    if (now - lastShake < 220) return;
    lastShake = now;
    const b = document.body;
    b.classList.remove('vfx-shake');
    void b.offsetWidth; // 强制回流以重启动画
    b.classList.add('vfx-shake');
    setTimeout(() => b.classList.remove('vfx-shake'), 450);
  }

  function fire(type, playerId) {
    const p = centerOf(playerId);
    if (type === 'damage') {
      spawn('vfx-damage-ring', p.x, p.y);
      spawn('vfx-damage-spark', p.x, p.y);
      flash('vfx-flash-damage');
      shake();
    } else if (type === 'heal') {
      spawn('vfx-heal', p.x, p.y);
      flash('vfx-flash-heal');
    } else if (type === 'skill') {
      spawn('vfx-skill', p.x, p.y);
    }
  }

  return { fire, shake, flash, centerOf };
})();
