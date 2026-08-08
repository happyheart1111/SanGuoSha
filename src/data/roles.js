// ==================== 身份系统 ====================
// 独立存储身份场玩法规则

const ROLES = {
  zhugong: { id: 'zhugong', name: '主公', color: '#f0d060', icon: '👑', desc: '消灭所有反贼和内奸',
    summary: '主公 — 忠臣辅佐你消灭反贼与内奸' },
  zhongchen: { id: 'zhongchen', name: '忠臣', color: '#ffa040', icon: '🛡️', desc: '保护主公，消灭反贼和内奸',
    summary: '忠臣 — 不惜一切保护主公' },
  fanzei: { id: 'fanzei', name: '反贼', color: '#ff5050', icon: '⚔️', desc: '消灭主公即可获胜',
    summary: '反贼 — 杀死主公即可获胜' },
  neijian: { id: 'neijian', name: '内奸', color: '#c080ff', icon: '🎭', desc: '成为最后的幸存者，且主公需最后死亡',
    summary: '内奸 — 消灭所有人，主公必须最后阵亡' },
  // 斗地主身份
  dizhu: { id: 'dizhu', name: '地主', color: '#f0d060', icon: '🏴', desc: '击败两名农民即可获胜',
    summary: '地主 — 凭兵力优势单挑两名农民' },
  nongmin: { id: 'nongmin', name: '农民', color: '#60e080', icon: '🌾', desc: '合力击杀地主即可获胜',
    summary: '农民 — 与队友合力击杀地主' },
};

const ROLE_CONFIG = {
  5: { zhugong: 1, zhongchen: 1, fanzei: 2, neijian: 1, total: 5 },
  8: { zhugong: 1, zhongchen: 2, fanzei: 4, neijian: 1, total: 8 },
};

function buildRolePool(playerCount) {
  const config = ROLE_CONFIG[playerCount];
  if (!config) return [];
  const pool = [];
  for (const [roleId, count] of Object.entries(config)) {
    if (roleId === 'total') continue;
    for (let i = 0; i < count; i++) pool.push(roleId);
  }
  return pool;
}

function getGameModeName(count) {
  if (count === 'ddz') return '三人斗地主';
  switch (count) {
    case 5: return '五人身份局';
    case 8: return '八人身份局';
    default: return `${count}人局`;
  }
}

function getRoleSummary(roleId) {
  const r = ROLES[roleId];
  return r ? r.summary : '';
}

function getRoleDisplayName(roleId) {
  const r = ROLES[roleId];
  return r ? `${r.icon} ${r.name}` : '？';
}
