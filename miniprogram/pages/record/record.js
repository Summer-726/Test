// 记账页：金额键盘 + 描述 + 支出/收入 + 扣款来源 + 保存到本地账本
// 阶段 2 完成；AI 自动分类留到阶段 4
const store = require('../../utils/store');
const budget = require('../../utils/budget');

Page({
  data: {
    type: 'expense',      // expense 支出 | income 收入
    jar: 'flower',        // 扣款来源：flower 花 | rescue 救急 | savings 存
    amount: '',           // 金额字符串
    desc: '',             // 描述
    date: '',             // 日期（默认今天，可改）
    maxDate: '',          // 日期选择上限（今天）
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] // 键盘布局
  },

  onLoad() {
    const today = this.today();
    this.setData({ date: today, maxDate: today });
  },

  // tab 页跨天后不重载，日期会残留旧值：没手动改过就刷新为今天
  // （修 bug：今天记的账可能被存成首次进页那天的日期）
  onShow() {
    if (!this._dateEdited && this.data.date !== this.today()) {
      this.setData({ date: this.today() });
    }
  },

  // 日期选择：改日期（需求："日期默认当天，可改"）
  onDateChange(e) {
    this._dateEdited = true; // 记住用户手动改过，切页不重置
    this.setData({ date: e.detail.value });
  },

  // 返回今天的日期 YYYY-MM-DD
  today() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  // 支出 / 收入 切换
  switchType(e) {
    this.setData({ type: e.currentTarget.dataset.t });
  },

  // 扣款来源选择（仅支出时可用）
  chooseJar(e) {
    this.setData({ jar: e.currentTarget.dataset.j });
  },

  // 键盘输入
  onKey(e) {
    const k = e.currentTarget.dataset.k;
    let amount = this.data.amount;

    if (k === 'del') {
      amount = amount.slice(0, -1); // 退格
    } else if (k === '.') {
      if (amount.includes('.')) return; // 只能一个小数点
      amount = amount ? amount + '.' : '0.'; // 空时输入 "0."
    } else {
      // 数字：限制最多两位小数
      if (amount.includes('.')) {
        const dec = amount.split('.')[1];
        if (dec.length >= 2) return;
      }
      amount = amount === '0' ? k : amount + k; // 首位 0 会被替换
    }
    this.setData({ amount });
  },

  // 描述输入
  onDesc(e) {
    this.setData({ desc: e.detail.value });
  },

  // 保存：写入本地账本
  onSave() {
    const amount = parseFloat(this.data.amount);
    if (!this.data.amount || isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '先输入金额', icon: 'none' });
      return;
    }
    const { type, jar, desc, date } = this.data;
    const entry = store.addLedger({
      type,                                  // expense | income
      amount,                                // 数字
      desc: desc || (type === 'expense' ? '一笔支出' : '一笔收入'),
      category: '其他',                      // 初始"其他"，AI 自动分类后台回写
      jar: type === 'expense' ? jar : '',    // 收入不扣罐
      date,
      worth: null                            // 值得度评价（阶段 4 起可选）
    });

    // 收入：累加进本月总收入，参与三罐分配；支出：检查三罐预警
    if (type === 'income') {
      budget.addIncome(amount);
    } else {
      this.checkWarnings(jar);
    }

    // 4b：支出自动分类（后台调用，不阻塞保存；失败保持"其他"）
    if (type === 'expense' && entry) {
      this.classifyAsync(entry.id, entry.desc);
    }

    // 清空表单，方便连记
    this.setData({ amount: '', desc: '' });
    wx.showToast({ title: '已记下 ✓', icon: 'success' });
  },

  // 后台调云函数给这一笔分类，成功后回写本地账本
  classifyAsync(id, desc) {
    wx.cloud.callFunction({ name: 'ai', data: { mode: 'classify', desc } })
      .then(res => {
        const r = res.result || {};
        if (r.ok && r.category) {
          store.updateLedger(id, { category: r.category });
        }
      })
      .catch(() => { /* 分类失败就保持"其他"，不打扰用户 */ });
  },

  // 支出后的三罐预警（70% / 90% / 花罐见底 / 动用救急存）
  checkWarnings(jar) {
    const cfg = budget.ensureCurrentMonth();
    if (cfg.warnEnabled === false) return; // 预算页关掉了预警
    const jars = budget.computeJars(cfg);

    if (jar === 'flower') {
      if (jars.flowerRemain <= 0) {
        if (!cfg.warned.empty) {
          cfg.warned.empty = true;
          budget.saveMonthConfig(cfg);
          wx.showToast({ title: '日常额度已用完，接下来省着点', icon: 'none' });
        }
      } else if (jars.percent >= 90) {
        if (!cfg.warned.p90) {
          cfg.warned.p90 = true;
          budget.saveMonthConfig(cfg);
          wx.showModal({ title: '已花 90%', content: '日常额度快用完了，剩下几天省着花。', showCancel: false });
        }
      } else if (jars.percent >= 70) {
        if (!cfg.warned.p70) {
          cfg.warned.p70 = true;
          budget.saveMonthConfig(cfg);
          wx.showModal({ title: '已花 70%', content: '日常额度用了七成，注意控制节奏。', showCancel: false });
        }
      }
    } else if (jars.flowerRemain <= 0) {
      // 日常额度已用光，却从应急/存款扣款
      wx.showToast({ title: jar === 'rescue' ? '正在动用应急金' : '正在动用存款', icon: 'none' });
    }
  }
});
