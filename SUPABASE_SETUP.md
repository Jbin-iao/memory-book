# Supabase 部署与中国访问说明

项目现在使用 Supabase 保存账号和回忆数据：未登录时继续使用浏览器本地存储，登录后会把记录同步到 Supabase。前端使用 `anon` 公钥，数据安全由数据库 RLS 策略保证。

## 1. 创建项目

1. 在 Supabase 创建项目。区域建议优先选择距离中国大陆较近、实际网络测试稳定的区域（通常是 Singapore 或 Tokyo）。Supabase 没有中国大陆内地节点，访问速度和可用性仍取决于运营商网络。
2. 在 SQL Editor 中执行 [supabase-schema.sql](./supabase-schema.sql)。
3. 在 Project Settings > API 复制 Project URL 和 `anon public` key。

## 2. 配置前端

编辑 `assets/js/supabase-config.js`：

```js
window.RomanticSupabaseConfig = {
  url: "https://你的项目.supabase.co",
  anonKey: "你的 anon public key"
};
```

`anonKey` 可以公开放在静态网页中，绝不能放入 `service_role` key。项目已经把 Supabase SDK 固化在 `assets/js/supabase.min.js`，页面不会依赖 jsDelivr，降低中国网络环境下的加载失败概率。

## 3. 配置认证回调

在 Authentication > URL Configuration 中设置 Site URL 和 `auth-modern.html` Redirect URL。若不需要邮箱验证，可在 Authentication > Providers > Email 中关闭 Confirm email。

## 4. 发布静态网站

```sh
node tests/record-store.test.cjs
node scripts/build.mjs
```

将 `dist/` 发布到 GitHub Pages、Cloudflare Pages、Netlify 或自己的静态服务器。生产环境必须使用 HTTPS。

## 5. 中国访问检查

部署后在中国大陆网络测试首页、登录、注册，以及刷新页面后记录是否仍然存在。若 Supabase 域名在某个运营商网络不可达，需更换 Supabase 区域、网络出口或自定义反向代理；仅修改前端代码无法消除跨境网络限制。
