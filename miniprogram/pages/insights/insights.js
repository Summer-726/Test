// 总结页（阶段 5c：本月分类花费图表，本地数据实时算）
// 入口：今日/本月汇报（原在首页，方案一挪来）；顾问点评已删（测试版从简）
const store = require('../../utils/store');
const budget = require('../../utils/budget');

// 固定 6 类，每个一个柔和色（克制，不花哨）
const CATES = [
  { name: '餐饮', color: '#0a84ff' },
  { name: '交通', color: '#30b0c7' },
  { name: '购物', color: '#af52de' },
  { name: '娱乐', color: '#ff9f0a' },
  { name: '学习', color: '#34c759' },
  { name: '其他', color: '#8e8e93' }
];

Page({
  data: {
    month: '',          // "8 月"
    totalExpense: '0.00',
    count: 0,
    cats: [],           // [{name, color, amount, percent}]
    empty: false
  },

  onShow() {
    this.build();
  },

  build() {
    const cfg = budget.ensureCurrentMonth();
    const list = store.getLedger().filter(e => e.date.slice(0, 7) === cfg.yearMonth);

    let expense = 0, count = 0;
    const byCat = {};
    CATES.forEach(c => { byCat[c.name] = 0; });
    list.forEach(e => {
      if (e.type !== 'expense') return;
      expense += e.amount;
      count++;
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    });

    // 条形宽度按"占本月最多那类"的比例，一眼看出大头在哪
    const max = Math.max(1, ...CATES.map(c => byCat[c.name] || 0));
    const cats = CATES
      .filter(c => byCat[c.name] > 0)
      .map(c => ({
        name: c.name,
        color: c.color,
        amount: byCat[c.name].toFixed(0),
        percent: Math.round((byCat[c.name] / max) * 100)
      }))
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

    this.setData({
      month: cfg.yearMonth.slice(5) + ' 月',
      totalExpense: expense.toFixed(2),
      count,
      cats,
      empty: count === 0
    });
  },

  // 汇报入口（原在首页，方案一挪到总结页）：今日 / 本月汇报
  onReportToday() {
    wx.navigateTo({ url: '/pages/report/report?scope=today' });
  },
  onReportMonth() {
    wx.navigateTo({ url: '/pages/report/report?scope=month' });
  }
});
