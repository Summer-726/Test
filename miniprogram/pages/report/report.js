// 汇报页（阶段 5a/5b：今日 / 本月汇报）
// 从首页两个按钮进入，scope=today|month；前端拼账本摘要 → AI 生成汇报
const store = require('../../utils/store');
const budget = require('../../utils/budget');
const cloud = require('../../utils/cloud');
const chat = require('../../utils/chat'); // 读取最近对话，让汇报"记住"聊过的话

const CATES = ['餐饮', '交通', '购物', '娱乐', '学习', '其他'];

Page({
  data: {
    scope: 'month',   // today 今日 | month 本月 | insight 本月分布点评
    title: '本月汇报',
    loading: true,    // 生成中
    error: '',        // 出错信息
    report: ''        // AI 汇报正文
  },

  onLoad(options) {
    const s = options.scope;
    const scope = ['today', 'month', 'insight'].indexOf(s) >= 0 ? s : 'month';
    const titles = { today: '今日汇报', month: '本月汇报', insight: '本月点评' };
    this.setData({ scope, title: titles[scope] });
    wx.setNavigationBarTitle({ title: this.data.title });
    this.gen();
  },

  todayStr() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  // 构建发给 AI 的账本摘要（只发汇总，不发原始账本；数据最小化）
  buildContext() {
    const cfg = budget.ensureCurrentMonth();
    const jars = budget.computeJars(cfg);
    const scope = this.data.scope;
    const today = this.todayStr();
    const ledger = store.getLedger();
    const list = scope === 'today'
      ? ledger.filter(e => e.date === today)
      : ledger.filter(e => e.date.slice(0, 7) === cfg.yearMonth);

    // 分类汇总（只统计支出）
    let expenseTotal = 0, count = 0;
    const byCat = {};
    CATES.forEach(c => { byCat[c] = 0; });
    list.forEach(e => {
      if (e.type !== 'expense') return;
      expenseTotal += e.amount;
      count++;
      const c = CATES.indexOf(e.category) >= 0 ? e.category : '其他';
      byCat[c] += e.amount;
    });
    const catLine = CATES.filter(c => byCat[c] > 0).map(c => c + ' ' + byCat[c].toFixed(0) + ' 元').join('、') || '暂无';

    const lines = [];
    if (scope === 'today') {
      lines.push('今日 ' + today + '：');
      lines.push('支出共 ' + expenseTotal.toFixed(0) + ' 元，' + count + ' 笔；分类：' + catLine);
    } else {
      lines.push('本月 ' + cfg.yearMonth + ' 至今天：');
      lines.push('生活费总收入 ' + cfg.totalIncome + ' 元，已支出 ' + expenseTotal.toFixed(0) + ' 元，' + count + ' 笔；分类：' + catLine);
      lines.push('三罐：日常 ' + jars.flowerTotal.toFixed(0) + '（已花 ' + jars.flowerUsed.toFixed(0) + '，剩 ' + jars.flowerRemain.toFixed(0) + '，' + jars.percent + '%）、应急 ' + jars.rescue.toFixed(0) + '、存款 ' + jars.savings.toFixed(0) + '；距月底还有 ' + jars.daysLeft + ' 天，日均还能花 ' + jars.avgDaily);
    }
    // 带上最近和顾问聊过的内容，帮 AI 理解消费背景（用户说过的细节优先，避免凭空揣测）
    const recent = this.recentChat();
    if (recent) {
      lines.push('');
      lines.push('===== 你最近和顾问聊过（帮 AI 理解消费背景）=====');
      lines.push(recent);
    }
    return lines.join('\n');
  },

  // 最近一次有内容的会话的最后 5 条消息（数据最小化）
  recentChat() {
    const s = chat.getSessions().find(x => x.messages && x.messages.length > 0);
    if (!s) return '';
    return s.messages.slice(-5).map(m => (m.role === 'user' ? '我：' : '顾问：') + m.text).join('\n');
  },

  // 生成 / 重新生成
  gen() {
    const context = this.buildContext();
    this.setData({ loading: true, error: '', report: '' });
    cloud.call('ai', { mode: 'report', scope: this.data.scope, context })
      .then(res => {
        const r = res.result || {};
        this.setData({ loading: false });
        if (r.ok) {
          this.setData({ report: r.report });
        } else {
          this.setData({ error: r.error || '未知错误' });
        }
      })
      .catch(err => {
        this.setData({ loading: false, error: err.errMsg || '网络异常，请稍后再试' });
      });
  },

  onRetry() {
    this.gen();
  }
});
