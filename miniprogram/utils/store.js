// 本地数据读写（统一封装，改字段只动这里）
// 账本数据全部存手机本地，隐私优先（见 docs/tech.md §3）

const KEY_LEDGER = 'ledger'; // 账本条目数组

// 读取全部账目（最新在前）
function getLedger() {
  return wx.getStorageSync(KEY_LEDGER) || [];
}

// 新增一条账目，返回带 id 的完整条目
function addLedger(entry) {
  const ledger = getLedger();
  entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  ledger.unshift(entry); // 最新一条放最前
  wx.setStorageSync(KEY_LEDGER, ledger);
  return entry;
}

// 按月份筛选账目，如 "2026-08"
function getLedgerByMonth(yearMonth) {
  return getLedger().filter(e => e.date.slice(0, 7) === yearMonth);
}

// 按 id 更新某条账目（如 AI 分类回写），返回更新后的条目
function updateLedger(id, patch) {
  const ledger = getLedger();
  const idx = ledger.findIndex(e => e.id === id);
  if (idx < 0) return null;
  ledger[idx] = Object.assign({}, ledger[idx], patch);
  wx.setStorageSync(KEY_LEDGER, ledger);
  return ledger[idx];
}

module.exports = { getLedger, addLedger, updateLedger, getLedgerByMonth };
