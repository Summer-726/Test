// 云函数调用封装：失败自动重试一次
// 解决"经常 cloud.callFunction fail"：冷启动第一次慢、瞬时网络抖动，重试一次就能过
// 用法：cloud.call('ai', { mode: 'chat', ... }) 代替 wx.cloud.callFunction
function call(name, data) {
  return wx.cloud.callFunction({ name, data })
    .catch(() => wx.cloud.callFunction({ name, data })); // 失败自动重试一次
}

module.exports = { call };
