// ==================== 牌数据定义 ====================

const SUITS = ['♠', '♥', '♣', '♦'];
const SUIT_NAMES = { '♠': '黑桃', '♥': '红桃', '♣': '梅花', '♦': '方块' };

function isRedSuit(suit) { return suit === '♥' || suit === '♦'; }

const CARD_DEFS = [
  // 基本牌
  { id: 'sha', name: '杀', icon: '⚔️', type: 'sha', category: 'basic' },
  { id: 'shan', name: '闪', icon: '🛡️', type: 'shan', category: 'basic' },
  { id: 'tao', name: '桃', icon: '🍑', type: 'tao', category: 'basic' },
  // 锦囊牌
  { id: 'juedou', name: '决斗', icon: '🤺', type: 'juedou', category: 'tool' },
  { id: 'guohe', name: '过河拆桥', icon: '🌉', type: 'guohe', category: 'tool' },
  { id: 'shunshou', name: '顺手牵羊', icon: '🐑', type: 'shunshou', category: 'tool' },
  { id: 'wuzhong', name: '无中生有', icon: '✨', type: 'wuzhong', category: 'tool' },
  { id: 'nanman', name: '南蛮入侵', icon: '🐘', type: 'nanman', category: 'tool' },
  { id: 'wanjian', name: '万箭齐发', icon: '🏹', type: 'wanjian', category: 'tool' },
  { id: 'taoyuan', name: '桃园结义', icon: '🌸', type: 'taoyuan', category: 'tool' },
  { id: 'wugu', name: '五谷丰登', icon: '🌾', type: 'wugu', category: 'tool' },
  // 武器牌 — 风林火山包
  { id: 'hanbing', name: '寒冰剑', icon: '❄️', type: 'weapon', category: 'equip', range: 3, pack: '风林火山',
    desc: '【杀】造成伤害时，可防止伤害并弃置目标2张手牌' },
  { id: 'guding', name: '古锭刀', icon: '🔪', type: 'weapon', category: 'equip', range: 2, pack: '风林火山',
    desc: '【杀】指定目标后，若其手牌为0则伤害+1' },
  { id: 'zhuque', name: '朱雀羽扇', icon: '🔥', type: 'weapon', category: 'equip', range: 3, pack: '风林火山',
    desc: '你的【杀】造成的伤害+1' },
  { id: 'qilin', name: '麒麟弓', icon: '🎯', type: 'weapon', category: 'equip', range: 5, pack: '风林火山',
    desc: '【杀】造成伤害后，可弃置目标的+1马' },
  // 武器牌 — 界限突破包
  { id: 'zhangba', name: '丈八蛇矛', icon: '🐍', type: 'weapon', category: 'equip', range: 3, pack: '界限突破',
    desc: '可将两张手牌当【杀】使用' },
  { id: 'qinggang', name: '青釭剑', icon: '🗡️', type: 'weapon', category: 'equip', range: 2, pack: '界限突破',
    desc: '使用【杀】时无视目标+1马' },
  { id: 'guanshi', name: '贯石斧', icon: '🪓', type: 'weapon', category: 'equip', range: 4, pack: '界限突破',
    desc: '【杀】被【闪】抵消时弃2牌仍可造成伤害' },
  { id: 'fangtian', name: '方天画戟', icon: '🔱', type: 'weapon', category: 'equip', range: 4, pack: '界限突破',
    desc: '最后一张手牌【杀】可额外选择至多2个目标' },
];

const DECK_COMPOSITION = [
  { cardId: 'sha', count: 20 },
  { cardId: 'shan', count: 12 },
  { cardId: 'tao', count: 6 },
  { cardId: 'juedou', count: 3 },
  { cardId: 'guohe', count: 4 },
  { cardId: 'shunshou', count: 3 },
  { cardId: 'wuzhong', count: 4 },
  { cardId: 'nanman', count: 3 },
  { cardId: 'wanjian', count: 2 },
  { cardId: 'taoyuan', count: 2 },
  { cardId: 'wugu', count: 2 },
  { cardId: 'hanbing', count: 1 },
  { cardId: 'guding', count: 1 },
  { cardId: 'zhuque', count: 1 },
  { cardId: 'qilin', count: 1 },
  { cardId: 'zhangba', count: 1 },
  { cardId: 'qinggang', count: 1 },
  { cardId: 'guanshi', count: 1 },
  { cardId: 'fangtian', count: 1 },
];
