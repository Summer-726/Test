// 问 AI 页（阶段 4c：多会话对话）
// 会话列表 ↔ 对话视图切换；本地历史；AI 带实时账本回答（RAG）
const chat = require('../../utils/chat');
const store = require('../../utils/store');
const budget = require('../../utils/budget');

// 左滑删除：删除按钮宽度（px），滑动范围 [-SLIDE_W, 0]
const SLIDE_W = 80;

Page({
  data: {
    view: 'list',            // 'list' 会话列表 | 'chat' 对话
    sessions: [],            // 会话列表 [{id, title, preview}]
    messages: [],            // 当前会话消息 [{role, text, time}]
    currentSessionId: '',
    title: '',
    greeting: '',            // 空会话时的开场白（本地生成，不调 AI）
    input: '',
    sending: false,
    scrollInto: '',
    // 左滑删除状态：同时最多一个会话处于滑开状态
    openId: '',              // 已吸附滑开（露出删除）的会话 id
    slideId: '',             // 正在拖动/刚拖完的会话 id
    slideX: 0                // 该会话当前位移（px）
  },

  onShow() {
    // 每次回到本页刷新列表（可能在其他页记了新账）
    this.refreshList();
  },

  // ---- 会话列表 ----
  refreshList() {
    this.setData({
      sessions: chat.getSessions().map(s => ({
        id: s.id,
        title: s.title,
        preview: s.messages.length ? s.messages[s.messages.length - 1].text : ''
      }))
    });
  },

  onNew() {
    const s = chat.createSession();
    this.openSession(s.id);
  },

  openSession(e) {
    const id = typeof e === 'string' ? e : (e.currentTarget.dataset.id || '');
    // 点的是已滑开的项：只收起，不进入对话
    if (this.data.openId === id) {
      this.setData({ openId: '', slideId: '', slideX: 0 });
      return;
    }
    this.setData({ openId: '', slideId: '', slideX: 0 });
    const s = chat.getSession(id);
    if (!s) return;
    this.setData({
      view: 'chat',
      currentSessionId: id,
      title: s.title,
      messages: s.messages,
      greeting: s.messages.length ? '' : this.buildGreeting(),
      scrollInto: s.messages.length ? 'msg-' + (s.messages.length - 1) : ''
    });
  },

  backToList() {
    this.refreshList();
    this.setData({ view: 'list', currentSessionId: '', messages: [], scrollInto: '' });
  },

  // ---- 左滑删除 ----
  onTouchStart(e) {
    const id = e.currentTarget.dataset.id;
    this._startX = e.touches[0].clientX;
    this._startY = e.touches[0].clientY;
    this._touchingId = id;
    this._horiz = null; // 滑动方向还没判定：null / true 横滑 / false 纵滑
    // 别的项处于滑开状态时，这里先收起来
    if (this.data.openId && this.data.openId !== id) {
      this.setData({ openId: '', slideId: '', slideX: 0 });
    }
  },

  onTouchMove(e) {
    if (!this._touchingId) return;
    const dx = e.touches[0].clientX - this._startX;
    const dy = e.touches[0].clientY - this._startY;

    // 首次位移足够时判定方向：明显的横向才处理，纵向则让页面正常滚动
    if (this._horiz === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      this._horiz = Math.abs(dx) > Math.abs(dy);
    }
    if (!this._horiz) return;

    // 该项若已滑开，起点是 -SLIDE_W；否则从 0 开始
    const base = this.data.openId === this._touchingId ? -SLIDE_W : 0;
    let x = base + dx;
    if (x > 0) x = 0;
    if (x < -SLIDE_W) x = -SLIDE_W;
    this.setData({ slideX: x, slideId: this._touchingId });
  },

  onTouchEnd() {
    if (!this._touchingId) return;
    const id = this._touchingId;
    this._touchingId = null;
    this._horiz = null;
    // 位移超过一半 → 吸附滑开；否则回弹收起
    const x = this.data.slideId === id ? this.data.slideX : 0;
    const shouldOpen = x < -SLIDE_W / 2;
    this.setData({
      slideX: shouldOpen ? -SLIDE_W : 0,
      slideId: shouldOpen ? id : '',
      openId: shouldOpen ? id : ''
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这段对话？',
      content: '删除后不可恢复，本地记录会一并清掉。',
      confirmText: '删除',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (res.confirm) {
          chat.deleteSession(id);
          if (this.data.currentSessionId === id) this.setData({ currentSessionId: '' });
          this.refreshList();
          this.setData({ openId: '', slideId: '', slideX: 0 });
          wx.showToast({ title: '已删除', icon: 'success' });
        } else {
          // 取消：把滑开的项收回去
          this.setData({ openId: '', slideId: '', slideX: 0 });
        }
      }
    });
  },

  // ---- 对话 ----
  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  onSend() {
    const text = this.data.input.trim();
    if (!text || this.data.sending) return;
    const sessionId = this.data.currentSessionId;
    if (!sessionId) return;

    chat.addMessage(sessionId, 'user', text);
    const msgs = chat.getSession(sessionId).messages;
    this.setData({
      input: '',
      messages: msgs,
      sending: true,
      greeting: '',
      scrollInto: 'msg-' + (msgs.length - 1)
    });

    wx.cloud.callFunction({
      name: 'ai',
      data: {
        mode: 'chat',
        question: text,
        context: this.buildContext(),
        history: msgs.slice(-10, -1) // 最近历史（不含刚发的这条），数据最小化
      }
    })
      .then(res => {
        const r = res.result || {};
        const reply = r.ok ? r.reply : '（出错了：' + (r.error || '未知错误') + '）';
        this.appendReply(sessionId, reply);
      })
      .catch(err => {
        this.appendReply(sessionId, '（调用失败：' + (err.errMsg || '网络异常') + '，请稍后再试）');
      });
  },

  appendReply(sessionId, text) {
    chat.addMessage(sessionId, 'assistant', text);
    const msgs = chat.getSession(sessionId).messages;
    this.setData({ messages: msgs, sending: false, scrollInto: 'msg-' + (msgs.length - 1) });
  },

  // ---- 构造发给 AI 的上下文（RAG，只发摘要，不发原始账本）----
  buildContext() {
    const cfg = budget.ensureCurrentMonth();
    const jars = budget.computeJars(cfg);
    const recent = store.getLedger().slice(0, 15).map(e => {
      const sign = e.type === 'expense' ? '-' : '+';
      return sign + e.amount + ' ' + (e.desc || '') + '(' + (e.category || '其他') + ')';
    }).join('；');
    return [
      '本月生活费 ' + cfg.totalIncome + ' 元，分罐：日常 ' + jars.flowerTotal.toFixed(0) + '、应急 ' + jars.rescue.toFixed(0) + '、存款 ' + jars.savings.toFixed(0),
      '日常已花 ' + jars.flowerUsed.toFixed(0) + '（' + jars.percent + '%），还剩 ' + jars.flowerRemain.toFixed(0) + '，距月底还有 ' + jars.daysLeft + ' 天',
      '最近消费：' + (recent || '暂无')
    ].join('。');
  },

  // 空会话的开场白（不调 AI，纯本地，让顾问显得"看得见"数据）
  buildGreeting() {
    const cfg = budget.ensureCurrentMonth();
    const jars = budget.computeJars(cfg);
    if (cfg.totalIncome <= 0) {
      return '你好！我是零钱智能体。你还没设置本月生活费，先去「预算」页设一下，我就能帮你盯预算啦。';
    }
    return '你好！这个月日常还剩 ¥' + jars.flowerRemain.toFixed(0) + '，日均还能花 ¥' + jars.avgDaily + '。想问点啥？';
  }
});
