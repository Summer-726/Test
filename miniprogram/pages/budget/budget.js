// 预算页：页内分段 [预算 | 规划]
// 预算：本月生活费 + 三罐比例（预设档 or 自定义，自定义校验合计正好 100%）
// 规划：存钱目标（存罐余额自动计入进度）
const store = require('../../utils/store');
const budget = require('../../utils/budget');

// 三罐比例预设（快速选择；想要自己的比例用「自定义」输入）
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
    activePreset: 0,              // 当前选中的比例预设（-1 = 自定义）
    ratio: { flower: 70, rescue: 15, savings: 15 },
    custom: { flower: '', rescue: '', savings: '' },  // 自定义比例输入框
    customTotal: 0,               // 自定义合计 %
    customOk: false,              // 合计是否正好 100
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
    // 不是预设档 → 进入自定义模式，把保存过的比例原样回填进输入框
    const custom = { flower: '', rescue: '', savings: '' };
    if (activePreset < 0) {
      activePreset = -1;
      custom.flower = String(ratio.flower);
      custom.rescue = String(ratio.rescue);
      custom.savings = String(ratio.savings);
    }
    this.setData({
      income: cfg.totalIncome ? String(cfg.totalIncome) : '',
      ratio,
      activePreset,
      custom,
      warnEnabled: cfg.warnEnabled !== false
    });
    this.updateCustom();
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

  // 选比例：预设档 or 自定义（idx = -1）
  choosePreset(e) {
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    if (idx === -1) {
      // 切到自定义：把当前比例带进输入框，方便在此基础上微调
      const ratio = this.data.ratio;
      this.setData({
        activePreset: -1,
        custom: {
          flower: String(ratio.flower),
          rescue: String(ratio.rescue),
          savings: String(ratio.savings)
        }
      });
      this.updateCustom();
      return;
    }
    const preset = PRESETS[idx];
    this.setData({
      ratio: { flower: preset.flower, rescue: preset.rescue, savings: preset.savings },
      activePreset: preset.idx
    });
  },

  // 自定义比例输入（data-field 区分 日常/应急/存款）
  onCustomInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ custom: { ...this.data.custom, [field]: e.detail.value } });
    this.updateCustom();
  },

  // 实时算自定义合计，并判断是否正好 100%
  updateCustom() {
    const f = parseFloat(this.data.custom.flower) || 0;
    const r = parseFloat(this.data.custom.rescue) || 0;
    const s = parseFloat(this.data.custom.savings) || 0;
    const total = f + r + s;
    this.setData({ customTotal: total, customOk: total === 100 });
  },

  // 保存预算：写入本月生活费 + 比例
  saveBudget() {
    const income = parseFloat(this.data.income);
    if (isNaN(income) || income <= 0) {
      wx.showToast({ title: '先填本月生活费', icon: 'none' });
      return;
    }

    // 比例：预设直接取；自定义需校验三项填满、合计正好 100%（允许某罐为 0）
    let ratio;
    if (this.data.activePreset === -1) {
      const f = parseFloat(this.data.custom.flower);
      const r = parseFloat(this.data.custom.rescue);
      const s = parseFloat(this.data.custom.savings);
      if (isNaN(f) || isNaN(r) || isNaN(s)) {
        wx.showToast({ title: '把三个比例都填上', icon: 'none' });
        return;
      }
      if (f + r + s !== 100) {
        wx.showToast({ title: '三项加起来要正好 100%', icon: 'none' });
        return;
      }
      ratio = { flower: f, rescue: r, savings: s };
    } else {
      ratio = { ...this.data.ratio };
    }

    const cfg = budget.getMonthConfig() || budget.ensureCurrentMonth();
    cfg.totalIncome = income;
    cfg.ratio = ratio;
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
