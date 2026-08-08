// ==================== 确定性伪随机数模块 (PRNG) ====================
// 基于种子值的 Mulberry32 算法，保证相同种子产生相同随机序列。
// 用于 PvP 双端同步（牌堆洗牌、随机选将等），确保对等操作确定性一致。

class SeededRandom {
  constructor(seed) {
    this.seed = seed | 0;
    if (this.seed === 0) this.seed = 1;
  }

  // Mulberry32 — 快速高质量 32 位 PRNG
  next() {
    let t = this.seed;
    t = (t + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t ^ (Math.imul(t ^ (t >>> 7), t | 61))) ^ t;
    this.seed = t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // 返回 [0, max) 的整数
  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  // Fisher-Yates 洗牌
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// 全局 PRNG 实例，默认使用随机种子
let GLOBAL_PRNG = null;

function seedRandom(seed) {
  GLOBAL_PRNG = new SeededRandom(seed);
  return GLOBAL_PRNG;
}

function getPRNG() {
  if (!GLOBAL_PRNG) {
    GLOBAL_PRNG = new SeededRandom(Math.floor(Math.random() * 2147483647) + 1);
  }
  return GLOBAL_PRNG;
}

// 替代 Math.random() 的全局函数
function prngRandom() {
  return getPRNG().next();
}

// 替代洗牌
function prngShuffle(arr) {
  return getPRNG().shuffle(arr);
}
