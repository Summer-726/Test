// 预算页：页内分段 [预算 | 规划]
// 预算：本月生活费 + 三罐比例（预设，保证加起来恒为 100%）
// 规划：存钱目标（存罐余额自动计入进度）
const store = require('../../utils/store');
const budget = require('../../utils/budget');

// 三罐比例预设（可调，但保证总和 100%）
const PRESETS = [
  { idx: 0, flower: 70, rescue: 15, savings: 15, label: '70 · 15 · 15' },
  { idx: 1, flower: 80, rescue: 10, savings: 10, label: '80 · 10 · 10' },
  { idx: 2, flower: 100, rescue: 0, savings: 0, label: '100 · 0 · 0' }
];

Page({
  data: {
    tab: 'budget',                // budget 预算 | plan 规划
    income: '',                   // 本月生活费输入
    presets: PRESETS,
    activePreset: 0,              // 当前选中的比例预设
    ratio: { flower: 70, rescue: 15, savings: 15 },
    warnEnabled: true,            // 预警提醒开关
    // ===== 规划面板 =====
    goal: null,                   // 已设置的存钱目标
    goalName: '',
    goalTarget: '',
    goalSaved: '0.00',            // 存罐当前余额（= 目标已存）
    goalPercent: 0                // 目标进度 %
  },

  onLoad() {
    this.loadBudget();
    this.refreshPlan();
  },

  // 从本地月度配置回填预算表单
  loadBudget() {
    const cfg = budget.ensureCurrentMonth();
    const ratio = { ...cfg.ratio };
    let activePreset = PRESETS.findIndex(p =>
      p.flower === ratio.flower && p.rescue === ratio.rescue && p.savings === ratio.savings
    );
    if (activePreset < 0) activePreset = 0; // 自定义比例时回到第一个预设
    this.setData({
      income: cfg.totalIncome ? String(cfg.totalIncome) : '',
      ratio,
      activePreset,
      warnEnabled: cfg.warnEnabled !== false
    });
  },

  // 刷新规划面板（存罐余额 + 目标进度）
  refreshPlan() {
    const cfg = budget.ensureCurrentMonth();
    const jars = budget.computeJars(cfg);
    const goal = budget.getSavingsGoal();
    const goalPercent = goal && goal.target > 0
      ? Math.min(100, Math.round((jars.savings / goal.target) * 100))
      : 0;
    this.setData({ goal, goalSaved: jars.savings.toFixed(2), goalPercent });
  },

  // 分段切换
  switchTab(e) {
    const t = e.currentTarget.dataset.t;
    this.setData({ tab: t });
    if (t === 'budget') this.loadBudget();
    else this.refreshPlan();
  },

  // ===== 预算面板 =====
  onIncome(e) {
    this.setData({ income: e.detail.value });
  },

  // 选比例预设
  choosePreset(e) {
    const preset = PRESETS[e.currentTarget.dataset.idx];
    this.setData({
      ratio: { flower: preset.flower, rescue: preset.rescue, savings: preset.savings },
      activePreset: preset.idx
    });
  },

  // 保存预算：写入本月生活费 + 比例
  saveBudget() {
    const income = parseFloat(this.data.income);
    if (isNaN(income) || income <= 0) {
      wx.showToast({ title: '先填本月生活费', icon: 'none' });
      return;
    }
    const cfg = budget.getMonthConfig() || budget.ensureCurrentMonth();
    cfg.totalIncome = income;
    cfg.ratio = { ...this.data.ratio };
    cfg.warnEnabled = this.data.warnEnabled;
    budget.saveMonthConfig(cfg);
    wx.showToast({ title: '预算已保存 ✓', icon: 'success' });
  },

  // 预警提醒开关
  onWarnToggle(e) {
    this.setData({ warnEnabled: e.detail.value });
  },

  // ===== 规划面板 =====
  onGoalName(e) { this.setData({ goalName: e.detail.value }); },
  onGoalTarget(e) { this.setData({ goalTarget: e.detail.value }); },

  saveGoal() {
    const name = this.data.goalName.trim();
    const target = parseFloat(this.data.goalTarget);
    if (!name || isNaN(target) || target <= 0) {
      wx.showToast({ title: '填目标名称和金额', icon: 'none' });
      return;
    }
    budget.saveSavingsGoal({ name, target });
    this.setData({ goalName: '', goalTarget: '' });
    this.refreshPlan();
    wx.showToast({ title: '目标已设置 ✓', icon: 'success' });
  }
});
