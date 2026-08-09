// AI 出牌卡死复现测试：给 AI 各种手牌，跑 aiPlayCards，检查回合是否能推进
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
global.window = global;
global.document = {
  body: { classList: { add() {}, remove() {}, contains: () => false }, style: { setProperty() {} } },
  getElementById: () => ({ innerHTML: '', classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, style: {}, querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }),
  createElement: () => ({ style: { setProperty() {} }, appendChild() {}, classList: { add() {}, remove() {} }, addEventListener() {}, remove() {} }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
};
global.addEventListener = () => {};
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = () => {};
global.setAISpeed = () => {};
global.Peer = class { constructor() {} };
global.navigator = { clipboard: { writeText() {} } };

const files = [
  'src/data/heroes.js', 'src/data/cards.js', 'src/data/roles.js', 'src/data/prng.js',
  'src/modes/pvp.js', 'src/game/00-core-class.js', 'src/game/01-core.js', 'src/game/02-turn.js',
  'src/game/03-cards.js', 'src/game/04-skills.js', 'src/game/05-combat.js', 'src/game/06-phase.js',
  'src/game/07-pvp-remote.js', 'src/game/08-ui.js', 'src/ai/ai.js', 'src/game/vfx.js',
  'src/modes/ddz.js', 'src/game/09-functions.js',
];
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });

let errors = [];
process.on('uncaughtException', (e) => { errors.push(e.message); console.error('UNCAUGHT:', e.message); });

function makeCard(id, name, suit, number, type, extra = {}) {
  return { id, name, suit, number, type, icon: '🃏', ...extra };
}

function makePlayer(id, heroId, opts = {}) {
  return {
    id, hero: HEROES[heroId], hp: opts.hp || HEROES[heroId].maxHp, maxHp: HEROES[heroId].maxHp,
    hand: opts.hand || [], equipment: { weapon: null, armor: null, plusHorse: null, minusHorse: null },
    judgeArea: [], isHuman: opts.isHuman || false, alive: true, linked: false, role: null, seat: opts.seat || id,
    shaQuota: 1,
  };
}

// ===== 场景：AI(曹操) 出完所有手牌后能否正常结束回合 =====
console.log('场景1: AI 出完普通手牌（杀/闪/桃/锦囊/装备）后结束回合');
{
  const g = new Game();
  g.players = [
    makePlayer(0, 'caocao', { hand: [
      makeCard('s1', '杀', '♠', 7, 'sha'),
      makeCard('t1', '桃', '♥', 3, 'tao'),
      makeCard('e1', '八卦阵', '♣', 2, 'armor'),
      makeCard('gh1', '过河拆桥', '♠', 3, 'guohe'),
      makeCard('ss1', '顺手牵羊', '♦', 3, 'shunshou'),
      makeCard('jd1', '决斗', '♠', 1, 'juedou'),
      makeCard('nm1', '南蛮入侵', '♠', 7, 'nanman'),
      makeCard('wj1', '万箭齐发', '♥', 1, 'wanjian'),
      makeCard('wz1', '无中生有', '♠', 7, 'wuzhong'),
      makeCard('sh1', '闪', '♦', 6, 'shan'),
    ] }),
    makePlayer(1, 'liubei', { isHuman: true, hand: [makeCard('s2', '杀', '♣', 6, 'sha')] }),
  ];
  g.currentPlayerIdx = 0;
  g.phase = 'play';
  g.pendingDamageCards = {};
  g.logEntries = [];
  g.gameOver = false;
  g.deck = [makeCard('d1', '杀', '♠', 8, 'sha'), makeCard('d2', '闪', '♦', 7, 'shan'), makeCard('d3', '桃', '♥', 5, 'tao'), makeCard('d4', '杀', '♣', 9, 'sha')];
  g.discardPile = [];
  g.autoPlay = false;
  g.turnNumber = 1;
  g.shaUsedCount = 0;
  g.shaUsedThisTurn = false;
  g.jiuDamageBoost = false;
  g.tieSuoSelecting = null;
  g.kejiEligible = true;
  g.extraShaChances = 0;
  g.jushouUsedThisTurn = false;
  g.zhihengUsedThisTurn = false;

  const startTurn = g.turnNumber;
  const startIdx = g.currentPlayerIdx;
  g.aiPlayCards(g.players[0]);
  console.log('  AI 开始出牌...');

  setTimeout(() => {
    const alive = g.players.filter(p => p.alive).length;
    console.log(`  3秒后: turn=${g.turnNumber}(起始${startTurn}), currentPlayerIdx=${g.currentPlayerIdx}(起始${startIdx}), phase=${g.phase}, 曹操手牌=${g.players[0].hand.length}`);
    if (errors.length > 0) { console.error('  ✗ 异常:', errors.slice(0, 3)); process.exit(1); }
    if (g.turnNumber > startTurn || g.currentPlayerIdx !== startIdx) {
      console.log('  ✓ AI 正常结束回合并轮到下家');
      process.exit(0);
    } else {
      console.error('  ✗ 卡死：回合未推进!');
      console.error('  waitingForTarget:', JSON.stringify(g.waitingForTarget ? { type: g.waitingForTarget.type } : null));
      process.exit(1);
    }
  }, 3000);
}
