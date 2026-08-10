// 首页概览：三罐状态卡 + 汇报按钮 + 顾问提醒 + 最近消费
// 阶段 1b：界面结构成型（空态可展示）；数据在阶段 2/3/4 接入
Page({
  data: {
    // ===== 三罐状态（阶段 3 从本地账本读取，当前为占位）=====
    jar: {
      flowerRemain: '0.00',   // 花罐剩余
      flowerUsed: '0.00',     // 花罐已用
      flowerTotal: '0.00',    // 花罐本月总额
      percent: 0,             // 已用百分比（进度条宽度）
      rescue: '0.00',         // 救急罐余额
      savings: '0.00',        // 存罐余额
      daysLeft: '30',         // 本月剩余天数
      avgDaily: '0.00'        // 日均还能花
    },
    // ===== 最近 5 笔消费（阶段 2 从本地账本读取）=====
    recent: []
  },

  onShow() {
    const store = require('../../utils/store');
    const budget = require('../../utils/budget');

    // 三罐状态（本地账本实时计算，跨月自动结转）
    const cfg = budget.ensureCurrentMonth();
    const jars = budget.computeJars(cfg);
    this.setData({
      jar: {
        flowerRemain: jars.flowerRemain.toFixed(2),
        flowerUsed: jars.flowerUsed.toFixed(2),
        flowerTotal: jars.flowerTotal.toFixed(2),
        percent: jars.percent,
        rescue: jars.rescue.toFixed(2),
        savings: jars.savings.toFixed(2),
        daysLeft: jars.daysLeft,
        avgDaily: jars.avgDaily
      },
      // 最近 5 笔消费（本地账本）
      recent: store.getLedger().slice(0, 5).map(e => ({
        id: e.id,
        desc: e.desc,
        category: e.category,
        sign: e.type === 'expense' ? '-' : '+',
        amount: e.amount.toFixed(2)
      }))
    });
  },

  // 点三罐状态卡 → 进预算页
  goBudget() {
    wx.navigateTo({ url: '/pages/budget/budget' });
  },

  // 今日 / 本月汇报（阶段 4 接 AI 后真正生成）
  onReportToday() {
    wx.showToast({ title: '汇报功能将在阶段 4 接入', icon: 'none' });
  },
  onReportMonth() {
    wx.showToast({ title: '汇报功能将在阶段 4 接入', icon: 'none' });
  }
});
