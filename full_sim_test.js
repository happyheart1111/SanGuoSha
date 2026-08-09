// 完整对局模拟：AI 出牌 + 模拟人类自动响应，跑多个回合验证不卡死
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

// ===== 模拟人类玩家：自动响应所有等待 =====
function autoRespondHuman(g) {
  const wt = g.waitingForTarget;
  if (!wt) return;
  const human = g.players.find(p => p.isHuman && p.alive);
  if (!human) return;

  const pickCard = (type) => {
    let card = human.hand.find(c => c.type === type);
    if (!card && human.hero.id === 'guanyu') card = human.hand.find(c => isRedSuit(c.suit));
    if (!card && human.hero.id === 'zhaoyun') {
      if (type === 'sha') card = human.hand.find(c => c.type === 'shan');
      else if (type === 'shan') card = human.hand.find(c => c.type === 'sha');
    }
    return card;
  };

  switch (wt.type) {
    case 'aoe_response': {
      const card = pickCard(wt.requiredType);
      g.humanRespondAOE(card || null);
      break;
    }
    case 'shan_response': {
      const card = pickCard('shan');
      g.humanRespondShan(card || null);
      break;
    }
    case 'juedou_defend':
    case 'juedou_defend_second': {
      const card = pickCard('sha');
      if (wt.type === 'juedou_defend') g.humanRespondJuedou(card || null);
      else g.humanRespondJuedouSecond(card || null);
      break;
    }
    case 'guohe_discard': {
      // 人类被拆：选一张手牌弃（无手牌则选装备/判定区）
      const choices = wt.choices || [];
      const handPick = choices.find(c => c.type === 'hand');
      if (handPick) g.humanGuoheDiscard(handPick);
      else {
        const equipPick = choices.find(c => c.type === 'equip');
        if (equipPick) g.humanGuoheDiscard(equipPick);
        else {
          const judgePick = choices.find(c => c.type === 'judge');
          if (judgePick) g.humanGuoheDiscard(judgePick);
        }
      }
      break;
    }
    case 'shunshou_steal': {
      const choices = wt.choices || [];
      const handPick = choices.find(c => c.type === 'hand');
      if (handPick) g.humanShunshouSteal(handPick);
      else {
        const equipPick = choices.find(c => c.type === 'equip');
        if (equipPick) g.humanShunshouSteal(equipPick);
        else {
          const judgePick = choices.find(c => c.type === 'judge');
          if (judgePick) g.humanShunshouSteal(judgePick);
        }
      }
      break;
    }
    case 'huogong_show': {
      if (human.hand.length > 0) g.humanShowCardForHuogong(0);
      break;
    }
    case 'huogong_discard': {
      const idx = human.hand.findIndex(c => c.suit === wt.suit);
      if (idx >= 0) g.humanDiscardForHuogong(idx);
      break;
    }
    case 'dying': {
      const tao = human.hand.find(c => c.type === 'tao');
      const jiu = human.hand.find(c => c.type === 'jiu');
      g.humanDyingUseTao(tao || jiu || null);
      break;
    }
    case 'guicai': {
      g.humanGuicaiSkip();
      break;
    }
    case 'ganglian_source': {
      g.humanGanglianChoice('hurt');
      break;
    }
    case 'fankui_source': {
      if (human.hand.length > 0) g.humanFankuiPickHand(0);
      else g.humanFankuiPickEquip('weapon');
      break;
    }
    case 'poujun_discard': {
      // 破军是出牌者选，人类是目标时不处理；人类是出牌者才选（在 play 阶段）
      break;
    }
    case 'discard_phase':
    case 'human_discard': {
      // 人类弃牌
      const need = wt.needDiscard || (human.hand.length - human.hp);
      if (need > 0) {
        const toDrop = [];
        for (let i = 0; i < need; i++) toDrop.push(i);
        if (wt.type === 'discard_phase') {
          g.waitingForTarget.selected = toDrop;
          g.humanConfirmDiscard();
        } else {
          // human_discard 逐张弃
          for (const idx of toDrop) {
            if (human.hand.length <= human.hp) break;
            g.humanDiscardCard(0);
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

// 轮询：持续模拟人类响应 + 观察回合推进
function run(g, seconds, label, done) {
  const startTurn = g.turnNumber;
  const startIdx = g.currentPlayerIdx;
  const timer = setInterval(() => {
    if (errors.length > 0) { clearInterval(timer); console.error('✗ 异常:', errors.slice(0, 3)); process.exit(1); }
    autoRespondHuman(g);
    if (g.waitingForTarget && g.waitingForTarget.type === 'human_discard' && g.players.find(p => p.isHuman)) {
      // 人类逐张弃牌
    }
  }, 80);
  setTimeout(() => {
    clearInterval(timer);
    const alive = g.players.filter(p => p.alive).length;
    console.log(`  ${label}: ${seconds}秒后 turn=${g.turnNumber}(起始${startTurn}) idx=${g.currentPlayerIdx} phase=${g.phase} 存活=${alive}/${g.players.length} gameOver=${g.gameOver}`);
    if (g.turnNumber > startTurn || g.gameOver) {
      console.log(`  ✓ ${label} 正常流转`);
      if (done) done();
    } else {
      console.error(`  ✗ ${label} 卡死! waitingForTarget=${g.waitingForTarget ? g.waitingForTarget.type : 'null'}`);
      process.exit(1);
    }
  }, seconds * 1000);
}

// ===== 场景1：身份局 5 人，人类(刘备) vs 4 AI =====
console.log('场景1: 五人身份局完整对局');
{
  const g = new Game();
  g.init(5, ['liubei', 'caocao', 'zhugeliang', 'machao', 'xiahoudun']);
  setAISpeed(0.05);
  run(g, 12, '身份局', () => {
    console.log('场景2: 新武将局（谋黄忠/徐盛/马超/夏侯惇/司马懿）');
    const g2 = new Game();
    g2.init(8, ['mouhuangzhong', 'jiexusheng', 'machao', 'xiahoudun', 'simayi', 'huangzhong', 'zhaoyun', 'caoren']);
    setAISpeed(0.05);
    run(g2, 12, '新武将局', () => {
      console.log('全部通过');
      process.exit(0);
    });
  });
}
