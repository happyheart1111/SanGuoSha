// 模糊测试：随机决策的人类 + 随机武将，跑多局找卡死点
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

// 随机决策的自动响应器（更接近真实，暴露更多路径）
function autoRespond(g) {
  const wt = g.waitingForTarget;
  if (!wt) return;
  const human = g.players.find(p => p.isHuman && p.alive);
  if (!human) return;
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const anyCard = (pred) => {
    const matches = human.hand.filter(pred);
    return matches.length > 0 ? rnd(matches) : null;
  };

  switch (wt.type) {
    case 'aoe_response': {
      const card = anyCard(c => c.type === wt.requiredType || (human.hero.id === 'guanyu' && isRedSuit(c.suit)) || (human.hero.id === 'zhaoyun' && (wt.requiredType === 'sha' ? c.type === 'shan' : c.type === 'sha')));
      g.humanRespondAOE(card && Math.random() < 0.7 ? card : null);
      break;
    }
    case 'shan_response': {
      const card = anyCard(c => c.type === 'shan' || (human.hero.id === 'guanyu' && isRedSuit(c.suit)) || (human.hero.id === 'zhaoyun' && c.type === 'sha'));
      g.humanRespondShan(card && Math.random() < 0.7 ? card : null);
      break;
    }
    case 'juedou_defend':
    case 'juedou_defend_second': {
      const card = anyCard(c => c.type === 'sha' || (human.hero.id === 'guanyu' && isRedSuit(c.suit)) || (human.hero.id === 'zhaoyun' && c.type === 'shan'));
      if (wt.type === 'juedou_defend') g.humanRespondJuedou(card && Math.random() < 0.6 ? card : null);
      else g.humanRespondJuedouSecond(card && Math.random() < 0.6 ? card : null);
      break;
    }
    case 'guohe_discard':
    case 'shunshou_steal': {
      const choices = wt.choices || [];
      if (choices.length > 0) {
        const pick = rnd(choices);
        if (wt.type === 'guohe_discard') g.humanGuoheDiscard(pick);
        else g.humanShunshouSteal(pick);
      } else if (wt.blindPick) {
        // 出牌者盲选：取消
        g.cancelWait();
      }
      break;
    }
    case 'huogong_show': {
      if (human.hand.length > 0) g.humanShowCardForHuogong(Math.floor(Math.random() * human.hand.length));
      break;
    }
    case 'huogong_discard': {
      const matches = human.hand.map((c, i) => ({ c, i })).filter(x => x.c.suit === wt.suit);
      if (matches.length > 0) g.humanDiscardForHuogong(rnd(matches).i);
      break;
    }
    case 'dying': {
      const card = anyCard(c => c.type === 'tao' || c.type === 'jiu' || (wt.huatuoJijiu && isRedSuit(c.suit)));
      g.humanDyingUseTao(card && Math.random() < 0.8 ? card : null);
      break;
    }
    case 'guicai': {
      if (Math.random() < 0.3 && wt.sima.hand.length > 0) g.humanGuicai(Math.floor(Math.random() * wt.sima.hand.length));
      else g.humanGuicaiSkip();
      break;
    }
    case 'ganglian_source': {
      g.humanGanglianChoice(Math.random() < 0.5 ? 'discard' : 'hurt');
      break;
    }
    case 'fankui_source': {
      if (human.hand.length > 0) g.humanFankuiPickHand(Math.floor(Math.random() * human.hand.length));
      else {
        const slots = ['weapon', 'armor', 'plusHorse', 'minusHorse'].filter(s => human.equipment[s]);
        if (slots.length > 0) g.humanFankuiPickEquip(rnd(slots));
      }
      break;
    }
    case 'guanxing': {
      // 随机选几张放底
      const n = Math.floor(Math.random() * (wt.cards.length + 1));
      wt.toBottom = [];
      for (let i = 0; i < n; i++) wt.toBottom.push(i);
      g.humanGuanxingConfirm();
      break;
    }
    case 'discard_phase':
    case 'human_discard': {
      const need = wt.needDiscard || (human.hand.length - human.hp);
      if (need > 0 && human.hand.length > 0) {
        if (wt.type === 'discard_phase') {
          const idxs = [...new Set(Array.from({ length: Math.min(need, human.hand.length) }, () => Math.floor(Math.random() * human.hand.length)))];
          while (idxs.length < need && idxs.length < human.hand.length) idxs.push(Math.floor(Math.random() * human.hand.length));
          g.waitingForTarget.selected = idxs.slice(0, need);
          g.humanConfirmDiscard();
        } else {
          g.humanDiscardCard(0);
        }
      }
      break;
    }
    default:
      break;
  }
}

const allHeroIds = Object.keys(HEROES);
let gameCount = 0;

function startOne() {
  const shuffled = [...allHeroIds];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const heroes = shuffled.slice(0, 8);
  const g = new Game();
  g.init(8, heroes);
  setAISpeed(0.03);
  gameCount++;
  console.log(`对局#${gameCount}: [${heroes.join(',')}]`);

  const check = setInterval(() => {
    if (errors.length > 0) {
      clearInterval(check);
      console.error(`✗ 对局#${gameCount} 异常:`, errors.slice(0, 3));
      process.exit(1);
    }
    autoRespond(g);
    // 模拟人类主动操作：出牌阶段随机结束出牌 / 随机出牌
    const human = g.players.find(p => p.isHuman && p.alive);
    if (human && g.phase === 'play' && g.players[g.currentPlayerIdx].id === human.id && !g.waitingForTarget && !g.autoPlay) {
      if (Math.random() < 0.25) {
        g.humanEndPlayPhase();
      } else if (Math.random() < 0.4 && human.hand.length > 0) {
        g.selectCard(Math.floor(Math.random() * human.hand.length));
        if (Math.random() < 0.5) g.playSelectedCard();
      }
    }
  }, 60);

  setTimeout(() => {
    clearInterval(check);
    const alive = g.players.filter(p => p.alive).length;
    console.log(`  15秒后 turn=${g.turnNumber} 存活=${alive}/8 gameOver=${g.gameOver}`);
    if (g.turnNumber < 2 && !g.gameOver) {
      console.error(`✗ 对局#${gameCount} 卡死! waitingForTarget=${g.waitingForTarget ? g.waitingForTarget.type : 'null'}`);
      process.exit(1);
    }
    if (gameCount >= 5) {
      console.log("\n=== 模糊测试 5 局全部通过 ===");
      process.exit(0);
    }
    startOne();
  }, 20000);
}

startOne();
