// ==================== 入口与顶层函数模块 ====================
// 游戏模式选择界面、武将选将 UI、PvP 大厅入口、武将图鉴展示、游戏启动入口等
// 顶层全局函数，负责用户交互入口与页面路由。
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
        <div onclick="startHeroPick('ddz')" style="
          width:200px;padding:30px;background:linear-gradient(180deg,rgba(30,15,5,0.9),rgba(50,25,10,0.95));
          border:2px solid #8b6914;border-radius:16px;cursor:pointer;text-align:center;
          transition:all 0.3s;
        " onmouseover="this.style.transform='scale(1.05)';this.style.borderColor='#f0d060';this.style.boxShadow='0 0 25px rgba(240,208,96,0.3)'"
           onmouseout="this.style.transform='scale(1)';this.style.borderColor='#8b6914';this.style.boxShadow='none'">
          <div style="font-size:48px;">🃏</div>
          <div style="font-size:20px;font-weight:bold;margin:12px 0;color:#f0d060;">三人斗地主</div>
          <div style="font-size:12px;color:#a08050;">1地主 vs 2农民 · 叫分定身份</div>
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
            <div style="font-size:11px;color:#a09070;">${h.faction}</div>
            <div style="font-size:16px;font-weight:bold;color:#f0d060;margin:6px 0;">${h.name}</div>
            <div style="font-size:10px;color:#808080;">${h.title}</div>
            <div style="font-size:10px;color:#5090b0;margin:4px 0;">❤ ${h.maxHp} HP</div>
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
            <div style="font-size:11px;color:#a09070;">${h.faction}</div>
            <div style="font-size:16px;font-weight:bold;color:#f0d060;margin:6px 0;">${h.name}</div>
            <div style="font-size:10px;color:#808080;">${h.title}</div>
            <div style="font-size:10px;color:#5090b0;margin:4px 0;">❤ ${h.maxHp} HP</div>
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
  const totalPlayers = gameMode === 'pve' ? 2 : (gameMode === 1 || gameMode === 'ddz') ? 3 : gameMode;
  const allHeroIds = Object.keys(HEROES);

  // 斗地主禁将：剔除与节奏冲突的武将
  const availableHeroes = allHeroIds.filter(h => !(gameMode === 'ddz' && DDZ_BANNED.includes(h)));

  // 为每个玩家随机分配3个候选英雄（不重复）
  const pool = [...availableHeroes];
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
      <p style="color:#c0a060;font-size:15px;">${getGameModeName(gameMode) || gameMode + '人局'} — 从${pickCount}名武将中选择一位</p>
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
  const isDdz = heroPickState.gameMode === 'ddz';
  heroPickState = null;
  if (isDdz) {
    document.getElementById('app').innerHTML = '';
    startDouDizhuBidding(pickedHeroIds);
    return;
  }
  const mode = pickedHeroIds.length >= 5 ? pickedHeroIds.length : 1;
  document.getElementById('app').innerHTML = '';
  game = new Game();
  window.game = game;
  game.init(mode, pickedHeroIds, preRoles);
  game.render();
}

function showReplay() {
  const data = window._replayData;
  if (!data || !data.logs || data.logs.length === 0) return;

  // 停止之前的自动播放
  if (window._replayTimer) { clearInterval(window._replayTimer); window._replayTimer = null; }
  window._replayStep = data.logs.length - 1; // 默认到最后一步
  window._replayAuto = false;

  const app = document.getElementById('app');
  const renderReplayUI = () => {
    const step = window._replayStep;
    const maxStep = data.logs.length - 1;

    let playersHtml = '';
    for (const p of data.playerInfo) {
      const roleData = ROLES[p.role] || ROLES.free || { name: '自由', icon: '🆓', color: '#aaa' };
      const status = p.alive ? '<span style="color:#4caf50;">存活</span>' : '<span style="color:#f44336;">阵亡</span>';
      playersHtml += `<div class="replay-player-card ${!p.alive ? 'dead' : ''}">
        <div class="replay-player-name" style="color:${roleData.color};">${p.name}</div>
        <div class="replay-player-info">${roleData.icon} ${roleData.name} · ${status}</div>
        <div class="replay-player-info">${p.faction} · 体力${p.maxHp}</div>
        ${p.isHuman ? '<div class="replay-player-you">你</div>' : ''}
      </div>`;
    }

    let logHtml = '';
    for (let i = 0; i <= step; i++) {
      const entry = data.logs[i];
      if (!entry) continue;
      if (entry.msg.startsWith('====================================')) {
        logHtml += `<div class="replay-log-entry replay-log-entry-separator ${i === step ? 'current' : ''}">——————</div>`;
      } else {
        const typeClass = entry.type || '';
        logHtml += `<div class="replay-log-entry ${typeClass} ${i === step ? 'current' : ''}" data-step="${i}">${entry.msg}</div>`;
      }
    }

    if (step < maxStep) {
      logHtml += `<div class="replay-log-entry replay-log-entry-pending">··· 后续步骤 ···</div>`;
    }

    const progress = maxStep > 0 ? Math.round((step / maxStep) * 100) : 100;

    app.innerHTML = `<div class="replay-overlay">
      <div class="replay-container">
        <div class="replay-header">
          <h2>📋 对局复盘</h2>
          <div class="replay-summary">
            <span>${data.modeName}</span>
            <span class="replay-dot">·</span>
            <span>共 ${data.turnCount} 回合</span>
            <span class="replay-dot">·</span>
            <span style="color:#f0d060;">${data.resultMsg}</span>
          </div>
        </div>
        <div class="replay-body">
          <div class="replay-sidebar">
            <h3>参战玩家</h3>
            ${playersHtml}
          </div>
          <div class="replay-main">
            <div class="replay-log-header">
              <span>📜 战斗日志</span>
              <span class="replay-step-indicator">${step + 1} / ${data.logs.length}</span>
            </div>
            <div class="replay-log-list" id="replayLogList">
              ${logHtml}
            </div>
          </div>
        </div>
        <div class="replay-footer">
          <div class="replay-controls">
            <button class="replay-btn" onclick="replayStepTo(0)" ${step <= 0 ? 'disabled' : ''}>⏮ 开头</button>
            <button class="replay-btn" onclick="replayStepPrev()" ${step <= 0 ? 'disabled' : ''}>◀ 上一步</button>
            <button class="replay-btn replay-btn-play" onclick="replayToggleAuto()">${window._replayAuto ? '⏸ 暂停' : '▶ 自动播放'}</button>
            <button class="replay-btn" onclick="replayStepNext()" ${step >= maxStep ? 'disabled' : ''}>下一步 ▶</button>
            <button class="replay-btn" onclick="replayStepTo(${maxStep})" ${step >= maxStep ? 'disabled' : ''}>结尾 ⏭</button>
          </div>
          <div class="replay-speed" style="${window._replayAuto ? '' : 'opacity:0.4;'}">
            速度：<input type="range" min="1" max="10" value="${window._replaySpeed || 4}" oninput="replaySetSpeed(this.value)">
            <span>${window._replaySpeed || 4}/10</span>
          </div>
          <button class="replay-btn replay-btn-close" onclick="replayClose()">✕ 关闭复盘</button>
        </div>
      </div>
    </div>`;

    // 滚动到当前步骤
    setTimeout(() => {
      const logList = document.getElementById('replayLogList');
      if (logList) {
        const curEntry = logList.querySelector('.replay-log-entry.current');
        if (curEntry) curEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
        else logList.scrollTop = logList.scrollHeight;
      }
    }, 50);
  };

  renderReplayUI();
}

// 复盘控制函数
function replayStepTo(n) {
  const data = window._replayData;
  if (!data) return;
  window._replayStep = Math.max(0, Math.min(n, data.logs.length - 1));
  showReplay();
}

function replayStepNext() {
  const data = window._replayData;
  if (!data) return;
  if (window._replayStep < data.logs.length - 1) {
    window._replayStep++;
    showReplay();
  }
}

function replayStepPrev() {
  if (window._replayStep > 0) {
    window._replayStep--;
    showReplay();
  }
}

function replayToggleAuto() {
  window._replayAuto = !window._replayAuto;
  if (window._replayAuto) {
    window._replaySpeed = window._replaySpeed || 4;
    replayAutoAdvance();
  } else {
    if (window._replayTimer) { clearInterval(window._replayTimer); window._replayTimer = null; }
    showReplay();
  }
}

function replayAutoAdvance() {
  if (window._replayTimer) clearInterval(window._replayTimer);
  const data = window._replayData;
  if (!data) { window._replayAuto = false; return; }
  window._replayTimer = setInterval(() => {
    if (!window._replayAuto || window._replayStep >= data.logs.length - 1) {
      clearInterval(window._replayTimer);
      window._replayTimer = null;
      window._replayAuto = false;
      showReplay();
      return;
    }
    window._replayStep++;
    showReplay();
  }, 1100 - (window._replaySpeed || 4) * 100);
}

function replaySetSpeed(v) {
  window._replaySpeed = parseInt(v);
  if (window._replayAuto) {
    replayAutoAdvance();
  }
  showReplay();
}

function replayClose() {
  if (window._replayTimer) { clearInterval(window._replayTimer); window._replayTimer = null; }
  window._replayAuto = false;
  // 重新渲染游戏结束画面
  if (window.game && window.game.gameOver) {
    window.game.render();
  }
}

showHeroSelect();