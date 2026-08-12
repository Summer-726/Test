// 左滑删除/撤回：公共触摸逻辑
// 会话列表、最近消费共用，保证手势一致。
// 用法：Page(slideToDelete({ data: {...}, onShow(){...}, ... }))
//   - data 里会自动补上 openId / slideId / slideX 三个字段
//   - 页面需要绑定 onTouchStart / onTouchMove / onTouchEnd 到可滑动的容器
//   - 删除按钮宽 80px，位移范围 [-80, 0]，滑过一半吸附
// 配套样式在 app.wxss：.slide-wrap / .slide-content / .slide-delete

const SLIDE_W = 80; // 删除按钮宽度（px）

module.exports = function slideToDelete(pageOpts) {
  // 合并滑动状态字段进 data
  pageOpts.data = Object.assign({ openId: '', slideId: '', slideX: 0 }, pageOpts.data || {});

  Object.assign(pageOpts, {
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

    // 收起所有滑开的项（页面 onShow 时可调用，避免切页回来还残留）
    closeSlide() {
      this.setData({ openId: '', slideId: '', slideX: 0 });
    }
  });

  return pageOpts;
};
