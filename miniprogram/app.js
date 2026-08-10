// 全局入口：小程序启动时运行一次
App({
  onLaunch() {
    // 初始化云开发（阶段 4 接入云函数前，不指定 env 也能正常跑本地页面）
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请升级基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d4g23a9a83ba92c48', // 云开发环境 ID（阶段 4 接入）
        traceUser: true
      });
    }
  },
  globalData: {
    // 阶段 2 起存放：当前月份、三罐状态等
  }
});
