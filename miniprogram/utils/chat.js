// 多会话对话：本地读写（隐私优先，全部存手机本地）
// 结构：sessions = [{ id, title, createdAt, messages: [{role, text, time}] }]
// 决策：AI 对话用多会话（2026-08-11 确认）

const KEY = 'chatSessions';

function nowStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

function getSessions() {
  return wx.getStorageSync(KEY) || [];
}

function getSession(id) {
  return getSessions().find(s => s.id === id) || null;
}

// 新建一个会话（最新放最前）
function createSession() {
  const sessions = getSessions();
  const s = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: '新对话',
    createdAt: nowStr(),
    messages: []
  };
  sessions.unshift(s);
  wx.setStorageSync(KEY, sessions);
  return s;
}

// 删除一个会话（本地，不可恢复）
function deleteSession(id) {
  const sessions = getSessions().filter(s => s.id !== id);
  wx.setStorageSync(KEY, sessions);
}

// 给某个会话加一条消息；首条用户消息自动生成标题
function addMessage(sessionId, role, text) {
  const sessions = getSessions();
  const s = sessions.find(x => x.id === sessionId);
  if (!s) return null;
  s.messages.push({ role, text, time: nowStr() });
  if (s.title === '新对话' && role === 'user' && text) {
    s.title = text.slice(0, 12);
  }
  // 数据最小化：单会话只保留最近 40 条（省 token，也够用）
  if (s.messages.length > 40) s.messages = s.messages.slice(-40);
  wx.setStorageSync(KEY, sessions);
  return s.messages[s.messages.length - 1];
}

module.exports = { getSessions, getSession, createSession, addMessage, deleteSession };
