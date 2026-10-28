// Supabase 配置与客户端单例
// 填好下方 anonKey 后，全站的登录 / 云同步才会真正生效。
// 未填写时，各模块会静默降级为浏览器本地存储（localStorage），页面仍可正常使用。
window.RomanticSupabaseConfig = {
  url: "https://vyxbxcqsjfuunhuiqzth.supabase.co",
  anonKey: "sb_publishable_xNDEqE751KHvoVj7HlAdHw_AhoMbvOs"
};

// ========== Supabase 客户端单例 ==========
// 页面可能同时加载 auth-manager.js、content-restriction.js、modern-auth.js，
// 若各自 createClient 会产生多个客户端与多份登录状态。
// 这里统一为全局唯一实例，所有模块通过 window.getSupabase() 获取。
window.getSupabase = (function () {
  let client = null;

  return function getSupabase() {
    if (client) return client;

    const config = window.RomanticSupabaseConfig || {};
    const url = (config.url || '').trim();
    const anonKey = (config.anonKey || '').trim();

    if (!url || !anonKey || !window.supabase) {
      return null;
    }

    try {
      client = window.supabase.createClient(url, anonKey);
      return client;
    } catch (error) {
      console.error('Supabase 初始化失败:', error);
      return null;
    }
  };
})();
