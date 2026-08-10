// 三罐预算核心逻辑：分罐 / 预警 / 跨月结转
// 三罐：flower 花 | rescue 救急 | savings 存
// 数据结构见 docs/tech.md §3.2

const store = require('./store');

const KEY_CFG = 'monthConfig';   // 月度配置
const KEY_GOAL = 'savingsGoal';  // 存钱目标

const DEFAULT_RATIO = { flower: 70, rescue: 15, savings: 15 };

// ---------- 日期工具 ----------
function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function currentYearMonth() {
  return todayStr().slice(0, 7); // "2026-08"
}

// ---------- 月度配置 ----------
function getMonthConfig() {
  return wx.getStorageSync(KEY_CFG) || null;
}
function saveMonthConfig(cfg) {
  wx.setStorageSync(KEY_CFG, cfg);
}

// 确保配置属于当前月；跨月时自动结转救急/存，花罐重置
function ensureCurrentMonth() {
  const now = currentYearMonth();
  const cfg = getMonthConfig();
  if (cfg && cfg.yearMonth === now) return cfg;

  // 结转旧月结余（救急/存带进新月，花罐作废）
  let carry = { rescue: 0, savings: 0 };
  if (cfg) {
    const jars = computeJars(cfg);
    carry = { rescue: jars.rescue, savings: jars.savings };
  }
  const next = {
    yearMonth: now,
    totalIncome: 0,                       // 新月生活费待用户设置
    ratio: cfg ? { ...cfg.ratio } : { ...DEFAULT_RATIO },
    carry,
    warnEnabled: true,                    // 是否启用预警提醒（预算页可关）
    warned: { p70: false, p90: false, empty: false }
  };
  saveMonthConfig(next);
  return next;
}

// 计算三罐状态（基于月度配置 + 当月账本，实时计算）
function computeJars(cfg) {
  const monthLedger = store.getLedger().filter(e => e.date.slice(0, 7) === cfg.yearMonth);

  // 各罐当月已扣
  const used = { flower: 0, rescue: 0, savings: 0 };
  monthLedger.forEach(e => {
    if (e.type === 'expense' && used[e.jar] !== undefined) used[e.jar] += e.amount;
  });

  // 每罐总额 = 本月总收入 × 比例（+ 上月结转的救急/存）
  const p = {
    flower: cfg.ratio.flower / 100,
    rescue: cfg.ratio.rescue / 100,
    savings: cfg.ratio.savings / 100
  };
  const flowerTotal = cfg.totalIncome * p.flower;
  const rescueTotal = cfg.totalIncome * p.rescue + (cfg.carry.rescue || 0);
  const savingsTotal = cfg.totalIncome * p.savings + (cfg.carry.savings || 0);

  const flowerRemain = flowerTotal - used.flower;
  const rescue = rescueTotal - used.rescue;
  const savings = savingsTotal - used.savings;

  // 剩余天数 & 花罐日均可用
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate() + 1;

  return {
    flowerTotal,
    flowerUsed: used.flower,
    flowerRemain,
    percent: flowerTotal > 0 ? Math.round((used.flower / flowerTotal) * 100) : 0,
    rescue,
    savings,
    daysLeft,
    avgDaily: flowerRemain > 0 ? (flowerRemain / daysLeft).toFixed(1) : '0.0'
  };
}

// 收入到账：累加进本月总收入，参与三罐分配
function addIncome(amount) {
  const cfg = ensureCurrentMonth();
  cfg.totalIncome = (cfg.totalIncome || 0) + amount;
  saveMonthConfig(cfg);
  return cfg;
}

// ---------- 存钱目标 ----------
function getSavingsGoal() {
  return wx.getStorageSync(KEY_GOAL) || null;
}
function saveSavingsGoal(goal) {
  wx.setStorageSync(KEY_GOAL, goal);
}

module.exports = {
  DEFAULT_RATIO,
  currentYearMonth,
  getMonthConfig,
  saveMonthConfig,
  ensureCurrentMonth,
  computeJars,
  addIncome,
  getSavingsGoal,
  saveSavingsGoal
};
