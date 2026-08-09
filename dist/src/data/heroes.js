// ==================== 武将数据模块 ====================
// 定义所有可选武将的属性（名称、体力上限、势力、技能），为游戏选将阶段提供武将池。
// 包含各个历史/神话角色（如刘备、曹操、孙权、吕布、张角、神将等）的完整技能描述与分组信息。

const HEROES = {
  liubei: {
    id: 'liubei', name: '刘备', title: '乱世的枭雄', faction: '蜀',
    avatarClass: 'liubei', maxHp: 4,
    skills: [{ id: 'rende', name: '仁德', desc: '出牌阶段，你可以将任意张手牌交给一名其他角色。若给出的牌达到两张或更多，你回复1点体力。' }]
  },
  sunquan: {
    id: 'sunquan', name: '孙权', title: '年轻的贤君', faction: '吴',
    avatarClass: 'sunquan', maxHp: 4,
    skills: [{ id: 'zhiheng', name: '制衡', desc: '出牌阶段，你可以弃置任意张牌，然后摸等量的牌。每回合限一次。' }]
  },
  caocao: {
    id: 'caocao', name: '曹操', title: '乱世的奸雄', faction: '魏',
    avatarClass: 'caocao', maxHp: 4,
    skills: [{ id: 'jianxiong', name: '奸雄', desc: '当你受到伤害后，你可以获得对你造成伤害的牌。' }]
  },
  guojia: {
    id: 'guojia', name: '郭嘉', title: '早终的先知', faction: '魏',
    avatarClass: 'guojia', maxHp: 3,
    skills: [{ id: 'tiandu', name: '天妒', desc: '当你受到1点伤害后，你可以摸一张牌。' }]
  },
  caopi: {
    id: 'caopi', name: '曹丕', title: '霸业的继承者', faction: '魏',
    avatarClass: 'caopi', maxHp: 3,
    skills: [
      { id: 'xingshang', name: '行殇', desc: '当有角色阵亡时，你可以获得弃牌堆中的两张牌。' },
      { id: 'fangzhu', name: '放逐', desc: '当你受到伤害后，你可以令伤害来源选择：弃置一张手牌，或令你摸一张牌。' }
    ]
  },
  huanggai: {
    id: 'huanggai', name: '黄盖', title: '轻身为国', faction: '吴',
    avatarClass: 'huanggai', maxHp: 4,
    skills: [{ id: 'kurou', name: '苦肉', desc: '出牌阶段，你可以失去1点体力，然后摸两张牌。本回合无限次数。' }]
  },
  sunshangxiang: {
    id: 'sunshangxiang', name: '孙尚香', title: '弓腰姬', faction: '吴',
    avatarClass: 'sunshangxiang', maxHp: 3,
    skills: [{ id: 'jieyin', name: '结姻', desc: '出牌阶段，你可以弃置两张手牌，令你和一名其他角色各回复1点体力。每回合限一次。' }]
  },
  guanyu: {
    id: 'guanyu', name: '关羽', title: '美髯公', faction: '蜀',
    avatarClass: 'guanyu', maxHp: 4,
    skills: [{ id: 'wusheng', name: '武圣', desc: '你可以将一张红色牌当【杀】使用或打出。（点击红色手牌出杀，或响应时选择红色牌）' }]
  },
  zhangfei: {
    id: 'zhangfei', name: '张飞', title: '万夫不当', faction: '蜀',
    avatarClass: 'zhangfei', maxHp: 4,
    skills: [{ id: 'paoxiao', name: '咆哮', desc: '出牌阶段，你使用【杀】无次数限制。' }]
  },
  zhangjiao: {
    id: 'zhangjiao', name: '张角', title: '天公将军', faction: '群',
    avatarClass: 'zhangjiao', maxHp: 3,
    skills: [{ id: 'leiji', name: '雷击', desc: '当你受到伤害后，你可以进行判定：亮出牌堆顶一张牌，若为♠，伤害来源受到1点伤害。' }]
  },
  gongsunzan: {
    id: 'gongsunzan', name: '公孙瓒', title: '白马将军', faction: '群',
    avatarClass: 'gongsunzan', maxHp: 4,
    skills: [{ id: 'yicong', name: '义从', desc: '锁定技。若体力值>2则距离-1；若体力值≤2则其他角色计算与你的距离+1。' }]
  },
  huaxiong: {
    id: 'huaxiong', name: '华雄', title: '西凉猛将', faction: '群',
    avatarClass: 'huaxiong', maxHp: 6,
    skills: [{ id: 'shiyong', name: '恃勇', desc: '锁定技。当你受到【杀】造成的伤害后，你获得此【杀】，然后摸一张牌。' }]
  },
  lübu: {
    id: 'lübu', name: '吕布', title: '武的化身', faction: '群',
    avatarClass: 'lvbu', maxHp: 4,
    skills: [{ id: 'wushuang', name: '无双', desc: '锁定技。你使用【杀】指定目标后，该角色需连续打出2张【闪】才能抵消；与你【决斗】的角色每次需打出2张【杀】。' }]
  },
  huatuo: {
    id: 'huatuo', name: '华佗', title: '神医', faction: '群',
    avatarClass: 'huatuo', maxHp: 3,
    skills: [
      { id: 'jijiu', name: '急救', desc: '你的回合外，你可以将一张红色牌当【桃】使用。' },
      { id: 'qingnang', name: '青囊', desc: '出牌阶段，你可以弃置一张手牌并选择一名已受伤的角色，令其回复1点体力。每回合限一次。' }
    ]
  },
  lvmeng: {
    id: 'lvmeng', name: '吕蒙', title: '士别三日', faction: '吴',
    avatarClass: 'lvmeng', maxHp: 4,
    skills: [{ id: 'keji', name: '克己', desc: '锁定技。若你于出牌阶段内未使用或打出过【杀】，则你可以跳过此回合的弃牌阶段。' }]
  },
  zhangliao: {
    id: 'zhangliao', name: '张辽', title: '前将军', faction: '魏',
    avatarClass: 'zhangliao', maxHp: 4,
    skills: [{ id: 'tuxi', name: '突袭', desc: '摸牌阶段，你可以放弃摸牌，改为获得至多2名其他角色的各一张手牌。' }]
  },
  zhugeliang: {
    id: 'zhugeliang', name: '诸葛亮', title: '迟暮的丞相', faction: '蜀',
    avatarClass: 'zhugeliang', maxHp: 3,
    skills: [
      { id: 'guanxing', name: '观星', desc: '准备阶段开始时，你可以观看牌堆顶的X张牌（X为存活角色数且至多为5），然后将其中任意张牌置于牌堆底，其余按任意顺序置于牌堆顶。' },
      { id: 'kongcheng', name: '空城', desc: '锁定技。当你没有手牌时，你不能成为【杀】或【决斗】的目标。' }
    ]
  },
  zhaoyun: {
    id: 'zhaoyun', name: '赵云', title: '少年将军', faction: '蜀',
    avatarClass: 'zhaoyun', maxHp: 4,
    skills: [{ id: 'longdan', name: '龙胆', desc: '你可以将【杀】当【闪】、【闪】当【杀】使用或打出。' }]
  },
  huangzhong: {
    id: 'huangzhong', name: '黄忠', title: '老当益壮', faction: '蜀',
    avatarClass: 'huangzhong', maxHp: 4,
    skills: [{ id: 'liegong', name: '烈弓', desc: '当你使用【杀】指定目标后，若目标手牌数不小于你的体力值或你的手牌数不大于目标的手牌数，此【杀】不能被【闪】响应。' }]
  },
  machao: {
    id: 'machao', name: '马超', title: '一骑当千', faction: '蜀',
    avatarClass: 'machao', maxHp: 4,
    skills: [
      { id: 'mashu', name: '马术', desc: '锁定技。你计算与其他角色的距离-1。' },
      { id: 'tieqi', name: '铁骑', desc: '当你使用【杀】指定目标后，你可以进行判定，若结果为红色，此【杀】不能被【闪】响应。' }
    ]
  },
  xiahoudun: {
    id: 'xiahoudun', name: '夏侯惇', title: '独眼的罗刹', faction: '魏',
    avatarClass: 'xiahoudun', maxHp: 4,
    skills: [{ id: 'ganglian', name: '刚烈', desc: '当你受到伤害后，你可以进行判定，若结果为♠或♥，伤害来源需弃置两张手牌或受到1点伤害。' }]
  },
  caoren: {
    id: 'caoren', name: '曹仁', title: '大将军', faction: '魏',
    avatarClass: 'caoren', maxHp: 4,
    skills: [{ id: 'jushou', name: '据守', desc: '出牌阶段限一次，你可以摸三张牌，然后跳过本回合出牌阶段。' }]
  },
  simayi: {
    id: 'simayi', name: '司马懿', title: '狼顾之鬼', faction: '魏',
    avatarClass: 'simayi', maxHp: 3,
    skills: [
      { id: 'fankui', name: '反馈', desc: '当你受到伤害后，你可以获得伤害来源的一张牌。' },
      { id: 'guicai', name: '鬼才', desc: '当一名角色的判定牌生效前，你可以打出一张手牌代替之。' }
    ]
  },
  jiexusheng: {
    id: 'jiexusheng', name: '界徐盛', title: '江东的铁壁', faction: '吴',
    avatarClass: 'jiexusheng', maxHp: 4,
    skills: [{ id: 'poujun', name: '破军', desc: '当你使用【杀】指定目标后，你可以弃置其一张牌；若其因此没有手牌，此【杀】对其造成的伤害+1。' }]
  },
  mouhuangzhong: {
    id: 'mouhuangzhong', name: '谋黄忠', title: '没金铩羽', faction: '蜀',
    avatarClass: 'mouhuangzhong', maxHp: 4,
    skills: [{ id: 'mouliegong', name: '烈弓', desc: '当你使用牌或成为其他角色使用牌的目标后，记录此牌的花色。当你使用【杀】指定唯一目标后，可亮出牌堆顶的X张牌（X为记录花色数-1），每有一张花色与记录相同，此【杀】伤害+1且目标不能使用【闪】响应；结算后清除记录。' }]
  },
  'shen-lvmeng': {
    id: 'shen-lvmeng', name: '神·吕蒙', title: '圣光之国士', faction: '神',
    avatarClass: 'shenlvmeng', maxHp: 4,
    skills: [
      { id: 'shelie', name: '涉猎', desc: '摸牌阶段，你改为亮出牌堆顶5张牌，获得其中每种花色的牌各一张，然后弃置其余的。' },
      { id: 'gongxin', name: '攻心', desc: '出牌阶段，你可以观看一名其他角色的手牌，并选择其中一张♥牌弃置。每回合限一次。' }
    ]
  },
  'shen-zhouyu': {
    id: 'shen-zhouyu', name: '神·周瑜', title: '赤壁的火神', faction: '神',
    avatarClass: 'shenzhouyu', maxHp: 3,
    skills: [
      { id: 'qinyin', name: '琴音', desc: '弃牌阶段结束时，你可以令所有其他角色各选择：弃置一张牌，或摸一张牌。' },
      { id: 'yeyan', name: '业炎', desc: '出牌阶段，你可以弃置3张手牌，对一名角色造成2点火焰伤害。每回合限一次。' }
    ]
  },
  jiaxu: {
    id: 'jiaxu', name: '贾诩', title: '冷酷的毒士', faction: '群',
    avatarClass: 'jiaxu', maxHp: 3,
    skills: [
      { id: 'weimu', name: '帷幕', desc: '锁定技。你不能成为【过河拆桥】【顺手牵羊】【决斗】的目标。' },
      { id: 'wansha', name: '完杀', desc: '锁定技。你的回合内，其他角色不能使用【桃】。' }
    ]
  },
  'shen-lusu': {
    id: 'shen-lusu', name: '神·鲁肃', title: '缔盟之贤者', faction: '神',
    avatarClass: 'shenlusu', maxHp: 3,
    skills: [
      { id: 'dimeng', name: '缔盟', desc: '摸牌阶段，你改为摸4张牌。出牌阶段结束时，你可以将1张手牌交给手牌最少的一名角色。' },
      { id: 'haoshi', name: '好施', desc: '出牌阶段限一次。你可以弃置一张牌，令一名已受伤的角色回复1点体力。' }
    ]
  }
};
