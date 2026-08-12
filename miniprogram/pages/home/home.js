// 首页概览：AI 顾问入口 + 三罐状态卡 + 顾问提醒 + 最近消费
// 最近消费支持左滑撤回（记错了能撤销，金额自动退回罐里/生活费扣回）
const store = require('../../utils/store');
const budget = require('../../utils/budget');
const slideToDelete = require('../../utils/slideToDelete');

Page(slideToDelete({
  data: {
    // ===== 三罐状态（阶段 3 从本地账本实时计算）=====
    jar: {
      flowerRemain: '0.00',   // 花罐剩余
      flowerUsed: '0.00',     // 花罐已用
      flowerTotal: '0.00',    // 花罐本月总额
      percent: 0,             // 已用百分比（进度条宽度）
      rescue: '0.00',         // 应急罐余额
      savings: '0.00',        // 存罐余额
      daysLeft: '30',         // 本月剩余天数
      avgDaily: '0.00'        // 日均还能花
    },
    // ===== 最近 5 笔消费（本地账本）=====
    recent: [],
    // ===== 顾问提醒卡片动态文案（阶段 6c：按预算状态给不同提醒）=====
    advisorText: ''
  },

  onShow() {
    this.closeSlide(); // 收起可能残留的滑动撤回态
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
      advisorText: this.advisorText(cfg, jars),
      recent: store.getLedger().slice(0, 5).map(e => ({
        id: e.id,
        desc: e.desc,
        category: e.category,
        dateLabel: this.dateLabel(e.date),
        sign: e.type === 'expense' ? '-' : '+',
        amount: e.amount.toFixed(2)
      }))
    });
  },

  // 顾问提醒文案：按日常罐状态给不同提醒（从紧到松），口语化
  advisorText(cfg, jars) {
    if (cfg.totalIncome <= 0) {
      return '先设置本月生活费，顾问才能帮你盯住预算、分析每一笔花得值不值。';
    }
    const remain = jars.flowerRemain;
    const pct = jars.percent;
    if (remain < 0) {
      return `日常罐已经超了 ¥${Math.abs(remain).toFixed(0)}，这月接下来得收着点。想聊怎么调整，随时来找我。`;
    }
    if (pct >= 90) {
      return `日常罐只剩 ¥${remain.toFixed(0)} 了（已用 ${pct}%），接下来几天悠着点。要我帮你算算怎么花吗？`;
    }
    if (pct >= 70) {
      return `日常已用 ${pct}%，还剩 ¥${remain.toFixed(0)}，日均还能花 ¥${jars.avgDaily}。节奏偏快，留意别到月底没得花。`;
    }
    if (pct >= 40) {
      return `日常还剩 ¥${remain.toFixed(0)}，日均还能花 ¥${jars.avgDaily}。节奏不错，继续保持。`;
    }
    return `本月日常还剩 ¥${remain.toFixed(0)}，花得挺克制。有拿不准的消费，先问问我。`;
  },

  // 消费时间标签：今天 / 昨天 / MM-DD（保持简单，不搞复杂）
  dateLabel(dateStr) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = fmt(now);
    if (dateStr === today) return '今天';
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (dateStr === fmt(yest)) return '昨天';
    // 同年显示 MM-DD，跨年显示完整年月日，避免误会
    return dateStr.slice(0, 4) === String(now.getFullYear()) ? dateStr.slice(5) : dateStr;
  },

  // 点三罐状态卡 → 进预算页
  goBudget() {
    wx.navigateTo({ url: '/pages/budget/budget' });
  },

  // 首页 AI 顾问入口（方案一：AI 是主角，点一下随时进对话页咨询）
  onAskAI() {
    wx.switchTab({ url: '/pages/chat/chat' });
  },

  // ---- 左滑撤回一笔记录（触摸事件来自公共模块 slideToDelete）----
  onDeleteEntry(e) {
    const id = e.currentTarget.dataset.id;
    const entry = store.getLedger().find(x => x.id === id);
    if (!entry) return;

    wx.showModal({
      title: '撤回这笔记录？',
      content: entry.type === 'expense'
        ? '撤回后，这笔钱会退回日常/应急/存款。'
        : '撤回后，本月生活费会扣回这笔收入。',
      confirmText: '撤回',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (!res.confirm) {
          this.closeSlide();
          return;
        }
        // 撤回当月收入 → 生活费总额同步扣回（否则三罐虚高）
        if (entry.type === 'income' && entry.date.slice(0, 7) === budget.currentYearMonth()) {
          budget.removeIncome(entry.amount);
        }
        store.deleteLedger(id);
        this.closeSlide();
        wx.showToast({ title: '已撤回', icon: 'success' });
        this.onShow(); // 重新拉取三罐 + 最近消费
      }
    });
  }
}));
