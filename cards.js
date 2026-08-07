// ==================== 牌数据定义 ====================

const SUITS = ['♠', '♥', '♣', '♦'];
const SUIT_NAMES = { '♠': '黑桃', '♥': '红桃', '♣': '梅花', '♦': '方块' };

function isRedSuit(suit) { return suit === '♥' || suit === '♦'; }

const CARD_DEFS = [
  // 基本牌
  { id: 'sha', name: '杀', icon: '⚔️', type: 'sha', category: 'basic' },
  { id: 'shan', name: '闪', icon: '🛡️', type: 'shan', category: 'basic' },
  { id: 'tao', name: '桃', icon: '🍑', type: 'tao', category: 'basic' },
  // 基本牌 — 军争篇（风林火山）
  { id: 'jiu', name: '酒', icon: '🍶', type: 'jiu', category: 'basic', pack: '风林火山',
    desc: '出牌阶段对自己使用，本回合下一张【杀】伤害+1；濒死时当【桃】使用' },
  // 锦囊牌 — 非延时
  { id: 'juedou', name: '决斗', icon: '🤺', type: 'juedou', category: 'tool' },
  { id: 'guohe', name: '过河拆桥', icon: '🌉', type: 'guohe', category: 'tool' },
  { id: 'shunshou', name: '顺手牵羊', icon: '🐑', type: 'shunshou', category: 'tool' },
  { id: 'wuzhong', name: '无中生有', icon: '✨', type: 'wuzhong', category: 'tool' },
  { id: 'nanman', name: '南蛮入侵', icon: '🐘', type: 'nanman', category: 'tool' },
  { id: 'wanjian', name: '万箭齐发', icon: '🏹', type: 'wanjian', category: 'tool' },
  { id: 'taoyuan', name: '桃园结义', icon: '🌸', type: 'taoyuan', category: 'tool' },
  { id: 'wugu', name: '五谷丰登', icon: '🌾', type: 'wugu', category: 'tool' },
  { id: 'wuxie', name: '无懈可击', icon: '🛇', type: 'wuxie', category: 'tool',
    desc: '抵消一张锦囊牌的效果' },
  // 锦囊牌 — 军争篇（风林火山）
  { id: 'huogong', name: '火攻', icon: '🔥', type: 'huogong', category: 'tool', pack: '风林火山',
    desc: '目标展示一张手牌，你弃一张同花色手牌，对其造成1点火焰伤害' },
  { id: 'tiesuo', name: '铁索连环', icon: '⛓️', type: 'tiesuo', category: 'tool', pack: '风林火山',
    desc: '选择1~2名角色横置/重置；你可重铸此牌（弃置摸1张牌）' },
  // 延时锦囊 — 判定区
  { id: 'lebu', name: '乐不思蜀', icon: '🎵', type: 'lebu', category: 'delay',
    desc: '判定：若非♥，跳过出牌阶段' },
  { id: 'bingliang', name: '兵粮寸断', icon: '🍚', type: 'bingliang', category: 'delay',
    desc: '判定：若非♣，跳过摸牌阶段' },
  { id: 'shandian', name: '闪电', icon: '⚡', type: 'shandian', category: 'delay',
    desc: '判定：若为♠2~9，受到3点雷电伤害；否则移至下家判定区' },
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
  { id: 'liannu', name: '诸葛连弩', icon: '🔫', type: 'weapon', category: 'equip', range: 1, pack: '标准',
    desc: '你可以额外使用任意张【杀】（无次数限制）' },
  { id: 'qinglong', name: '青龙偃月刀', icon: '🐉', type: 'weapon', category: 'equip', range: 3, pack: '标准',
    desc: '【杀】被闪避后，可弃一张牌令此【杀】强制命中并造成伤害' },
  { id: 'zhangba', name: '丈八蛇矛', icon: '🐍', type: 'weapon', category: 'equip', range: 3, pack: '标准',
    desc: '可将两张手牌当一张【杀】使用' },
  { id: 'guanshi', name: '贯石斧', icon: '🪓', type: 'weapon', category: 'equip', range: 3, pack: '标准',
    desc: '【杀】被闪避后，可弃两张牌强制命中' },
  { id: 'qiling', name: '麒麟弓', icon: '🏹', type: 'weapon', category: 'equip', range: 5, pack: '标准',
    desc: '【杀】造成伤害后，可弃置目标一张坐骑牌' },
  // +1坐骑（防御马）
  { id: 'dilu', name: '的卢', icon: '🐴', type: 'plusHorse', category: 'equip', pack: '标准',
    desc: '其他角色计算与你的距离+1' },
  { id: 'jueying', name: '绝影', icon: '🐴', type: 'plusHorse', category: 'equip', pack: '标准',
    desc: '其他角色计算与你的距离+1' },
  { id: 'zhuahuang', name: '爪黄飞电', icon: '🐴', type: 'plusHorse', category: 'equip', pack: '标准',
    desc: '其他角色计算与你的距离+1' },
  // -1坐骑（进攻马）
  { id: 'chitu', name: '赤兔', icon: '🐎', type: 'minusHorse', category: 'equip', pack: '标准',
    desc: '你计算与其他角色的距离-1' },
  { id: 'dawan', name: '大宛', icon: '🐎', type: 'minusHorse', category: 'equip', pack: '标准',
    desc: '你计算与其他角色的距离-1' },
  { id: 'zixing', name: '紫骍', icon: '🐎', type: 'minusHorse', category: 'equip', pack: '标准',
    desc: '你计算与其他角色的距离-1' },
  // 防具
  { id: 'baguazhen', name: '八卦阵', icon: '☯️', type: 'armor', category: 'equip', pack: '标准',
    desc: '当你需要使用【闪】时，可判定：若为红色，视为你打出了一张【闪】' },
  { id: 'renwang', name: '仁王盾', icon: '🛡️', type: 'armor', category: 'equip', pack: '标准',
    desc: '黑色【杀】对你无效' },
];

const CARD_DEF = {};
CARD_DEFS.forEach(c => { CARD_DEF[c.id] = c; });

const DECK_COMPOSITION = [
  { cardId: 'sha', count: 20 },
  { cardId: 'shan', count: 12 },
  { cardId: 'tao', count: 6 },
  { cardId: 'jiu', count: 5 },
  { cardId: 'juedou', count: 3 },
  { cardId: 'guohe', count: 4 },
  { cardId: 'shunshou', count: 3 },
  { cardId: 'wuzhong', count: 4 },
  { cardId: 'nanman', count: 3 },
  { cardId: 'wanjian', count: 2 },
  { cardId: 'taoyuan', count: 2 },
  { cardId: 'wugu', count: 2 },
  { cardId: 'huogong', count: 3 },
  { cardId: 'tiesuo', count: 6 },
  { cardId: 'hanbing', count: 1 },
  { cardId: 'guding', count: 1 },
  { cardId: 'zhuque', count: 1 },
  { cardId: 'qilin', count: 1 },
  { cardId: 'zhangba', count: 2 },
  { cardId: 'qinggang', count: 1 },
  { cardId: 'guanshi', count: 2 },
  { cardId: 'fangtian', count: 1 },
  { cardId: 'liannu', count: 2 },
  { cardId: 'qinglong', count: 1 },
  { cardId: 'qiling', count: 1 },
  { cardId: 'dilu', count: 1 },
  { cardId: 'jueying', count: 1 },
  { cardId: 'zhuahuang', count: 1 },
  { cardId: 'chitu', count: 1 },
  { cardId: 'dawan', count: 1 },
  { cardId: 'zixing', count: 1 },
  { cardId: 'baguazhen', count: 2 },
  { cardId: 'renwang', count: 1 },
  { cardId: 'wuxie', count: 3 },
  { cardId: 'lebu', count: 2 },
  { cardId: 'bingliang', count: 2 },
  { cardId: 'shandian', count: 2 },
];
