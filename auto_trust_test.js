// 托管模式测试：人类开启托管后跑完整对局，验证 AI 出牌/托管人类不卡死
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

const g = new Game();
g.init(8, ['simayi', 'mouhuangzhong', 'jiexusheng', 'zhugeliang', 'machao', 'xiahoudun', 'zhaoyun', 'huangzhong']);
g.autoPlay = true;
g.resolveAutoPlayPending();
setAISpeed(0.03);

// 持续检查等待状态：托管模式下若有未被处理的等待，说明卡死
const startTurn = g.turnNumber;
const check = setInterval(() => {
  if (errors.length > 0) { clearInterval(check); console.error('✗ 异常:', errors.slice(0, 3)); process.exit(1); }
}, 80);

setTimeout(() => {
  clearInterval(check);
  console.log(`托管局: 20秒后 turn=${g.turnNumber}(起始${startTurn}) gameOver=${g.gameOver} 存活=${g.players.filter(p => p.alive).length}/8`);
  console.log('  waitingForTarget:', g.waitingForTarget ? g.waitingForTarget.type : 'null');
  if (g.turnNumber > startTurn + 2 || g.gameOver) {
    console.log('✓ 托管模式正常流转');
    process.exit(0);
  } else {
    console.error('✗ 托管模式疑似卡死');
    process.exit(1);
  }
}, 20000);
