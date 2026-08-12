// 问 AI 页（阶段 4c：多会话对话）
// 会话列表 ↔ 对话视图切换；本地历史；AI 带实时账本回答（RAG）
const chat = require('../../utils/chat');
const store = require('../../utils/store');
const budget = require('../../utils/budget');
const slideToDelete = require('../../utils/slideToDelete');
const cloud = require('../../utils/cloud');

// 左滑删除逻辑来自公共模块 utils/slideToDelete.js（openId/slideId/slideX + 触摸事件）
Page(slideToDelete({
  data: {
    view: 'list',            // 'list' 会话列表 | 'chat' 对话
    sessions: [],            // 会话列表 [{id, title, preview}]
    messages: [],            // 当前会话消息 [{role, text, time}]
    currentSessionId: '',
    title: '',
    greeting: '',            // 空会话时的开场白（本地生成，不调 AI）
    input: '',
    sending: false,
    scrollInto: ''
  },

  onShow() {
    // 每次回到本页刷新列表（可能在其他页记了新账）
    this.refreshList();
    // 收起可能残留的滑动删除态
    this.closeSlide();
  },

  // ---- 会话列表 ----
  refreshList() {
    this.setData({
      // 过滤掉空会话（历史遗留的"新对话"不再显示）
      sessions: chat.getSessions()
        .filter(s => s.messages && s.messages.length > 0)
        .map(s => ({
          id: s.id,
          title: s.title,
          preview: s.messages[s.messages.length - 1].text
        }))
    });
  },

  onNew() {
    // 延迟创建：先进入"新对话"视图，用户发出第一条消息才真正建会话存本地
    // （避免"新建 → 没问问题 → 返回"在会话列表留下空会话）
    this.setData({
      view: 'chat',
      currentSessionId: '',
      title: '新对话',
      messages: [],
      greeting: this.buildGreeting(),
      scrollInto: ''
    });
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

  // ---- 左滑删除（触摸事件来自公共模块 slideToDelete）----
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
    // 新对话的第一次发送：此刻才真正创建会话并保存
    let sessionId = this.data.currentSessionId;
    if (!sessionId) {
      sessionId = chat.createSession().id;
    }

    chat.addMessage(sessionId, 'user', text);
    const msgs = chat.getSession(sessionId).messages;
    this.setData({
      currentSessionId: sessionId,
      input: '',
      messages: msgs,
      sending: true,
      greeting: '',
      scrollInto: 'msg-' + (msgs.length - 1)
    });

    cloud.call('ai', {
      mode: 'chat',
      question: text,
      context: this.buildContext(),
      history: msgs.slice(-5, -1) // 最近 5 条历史（不含刚发的这条），数据最小化，也缩短 AI 处理时间
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
      '本月生活费 ' + cfg.totalIncome + ' 元，三分：日常 ' + jars.flowerTotal.toFixed(0) + '、应急 ' + jars.rescue.toFixed(0) + '、存款 ' + jars.savings.toFixed(0),
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
}));
