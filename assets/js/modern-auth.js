// 现代化登录注册页面交互
(function() {
  'use strict';

  // ========== DOM 元素 ==========
  const dom = {
    // 表单状态
    formState: document.getElementById('auth-form-state'),
    signedState: document.getElementById('auth-signed-state'),

    // 表单元素
    form: document.getElementById('auth-form'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    confirmPasswordInput: document.getElementById('confirm-password'),
    confirmPasswordGroup: document.getElementById('confirm-password-group'),

    // 按钮
    submitBtn: document.getElementById('submit-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    tabLogin: document.getElementById('tab-login'),
    tabSignup: document.getElementById('tab-signup'),
    footerSwitch: document.getElementById('footer-switch'),

    // 文本
    formTitle: document.getElementById('form-title'),
    formSubtitle: document.getElementById('form-subtitle'),
    footerQuestion: document.getElementById('footer-question'),
    userEmail: document.getElementById('auth-user-email'),

    // 消息
    message: document.getElementById('auth-message'),

    // 密码相关
    passwordStrength: document.getElementById('password-strength'),
    togglePassword: document.querySelector('.toggle-password'),

    // 标签指示器
    tabsContainer: document.querySelector('.auth-tabs')
  };

  // ========== 状态 ==========
  let currentMode = 'login'; // 'login' | 'signup'
  let supabase = null;
  let user = null;

  // ========== Supabase 初始化 ==========
  // 客户端由 supabase-config.js 统一创建（单例），避免同页面多模块各建一个。
  // 这里保留独立的缺失检查，是为了给登录页用户明确的中文错误提示。
  function initSupabase() {
    const config = window.RomanticSupabaseConfig || {};
    const url = (config.url || '').trim();
    const anonKey = (config.anonKey || '').trim();

    if (!url || !anonKey || !window.supabase) {
      showMessage('Supabase 配置未完成，请先配置 supabase-config.js', 'error');
      return false;
    }

    supabase = window.getSupabase ? window.getSupabase() : null;

    if (!supabase) {
      showMessage('Supabase 初始化失败', 'error');
      return false;
    }

    return true;
  }

  // ========== 模式切换 ==========
  function switchMode(mode) {
    currentMode = mode;

    // 更新标签样式
    if (mode === 'login') {
      dom.tabLogin.classList.add('active');
      dom.tabSignup.classList.remove('active');
      dom.tabsContainer.removeAttribute('data-active');
    } else {
      dom.tabSignup.classList.add('active');
      dom.tabLogin.classList.remove('active');
      dom.tabsContainer.setAttribute('data-active', 'signup');
    }

    // 更新文本
    if (mode === 'login') {
      dom.formTitle.textContent = '登录账号';
      dom.formSubtitle.textContent = '登录后数据将自动同步到云端';
      dom.submitBtn.querySelector('.btn-text').textContent = '登录';
      dom.footerQuestion.textContent = '还没有账号？';
      dom.footerSwitch.textContent = '立即注册';
      dom.confirmPasswordGroup.hidden = true;
      dom.confirmPasswordInput.required = false;
    } else {
      dom.formTitle.textContent = '注册账号';
      dom.formSubtitle.textContent = '注册后即可开始记录你们的故事';
      dom.submitBtn.querySelector('.btn-text').textContent = '注册';
      dom.footerQuestion.textContent = '已有账号？';
      dom.footerSwitch.textContent = '立即登录';
      dom.confirmPasswordGroup.hidden = false;
      dom.confirmPasswordInput.required = true;
    }

    // 清空消息
    hideMessage();
  }

  // ========== 密码强度检测 ==========
  function checkPasswordStrength(password) {
    if (!password) {
      dom.passwordStrength.hidden = true;
      return;
    }

    dom.passwordStrength.hidden = false;

    const strengthFill = dom.passwordStrength.querySelector('.strength-fill');
    const strengthText = dom.passwordStrength.querySelector('.strength-text');

    let strength = 0;

    // 长度
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    // 包含数字
    if (/\d/.test(password)) strength++;

    // 包含字母
    if (/[a-zA-Z]/.test(password)) strength++;

    // 包含特殊字符
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    // 更新显示
    strengthFill.className = 'strength-fill';

    if (strength <= 2) {
      strengthFill.classList.add('weak');
      strengthText.textContent = '弱';
      strengthText.style.color = '#ef4444';
    } else if (strength <= 4) {
      strengthFill.classList.add('medium');
      strengthText.textContent = '中等';
      strengthText.style.color = '#f59e0b';
    } else {
      strengthFill.classList.add('strong');
      strengthText.textContent = '强';
      strengthText.style.color = '#22c55e';
    }
  }

  // ========== 密码显示切换 ==========
  function togglePasswordVisibility() {
    const type = dom.passwordInput.type === 'password' ? 'text' : 'password';
    dom.passwordInput.type = type;

    if (dom.confirmPasswordInput) {
      dom.confirmPasswordInput.type = type;
    }
  }

  // ========== 消息显示 ==========
  function showMessage(text, type = 'info') {
    dom.message.textContent = text;
    dom.message.className = `auth-message ${type}`;
    dom.message.hidden = false;
  }

  function hideMessage() {
    dom.message.hidden = true;
  }

  // ========== 加载状态 ==========
  function setLoading(loading) {
    dom.submitBtn.disabled = loading;
    dom.submitBtn.querySelector('.btn-text').hidden = loading;
    dom.submitBtn.querySelector('.btn-loader').hidden = !loading;
  }

  // ========== 表单验证 ==========
  function validateForm() {
    const email = dom.emailInput.value.trim();
    const password = dom.passwordInput.value;

    if (!email) {
      showMessage('请输入邮箱地址', 'error');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage('邮箱格式不正确', 'error');
      return false;
    }

    if (!password) {
      showMessage('请输入密码', 'error');
      return false;
    }

    if (password.length < 6) {
      showMessage('密码至少需要6位字符', 'error');
      return false;
    }

    if (currentMode === 'signup') {
      const confirmPassword = dom.confirmPasswordInput.value;

      if (!confirmPassword) {
        showMessage('请确认密码', 'error');
        return false;
      }

      if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return false;
      }
    }

    return true;
  }

  // ========== 登录 ==========
  async function handleLogin(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showMessage('登录成功！正在跳转...', 'success');

      setTimeout(() => {
        window.location.href = './love-story.html';
      }, 1500);

    } catch (error) {
      console.error('登录失败:', error);

      if (error.message.includes('Invalid login credentials')) {
        showMessage('邮箱或密码错误', 'error');
      } else if (error.message.includes('Email not confirmed')) {
        showMessage('请先验证邮箱', 'error');
      } else {
        showMessage('登录失败: ' + error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // ========== 注册 ==========
  async function handleSignup(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/auth-modern.html'
        }
      });

      if (error) throw error;

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        showMessage('该邮箱已注册，请直接登录', 'error');
        setTimeout(() => switchMode('login'), 2000);
        return;
      }

      showMessage('注册成功！如果启用了邮箱验证，请查收邮件', 'success');

      // 如果不需要邮箱验证，直接登录
      setTimeout(() => {
        if (data.session) {
          window.location.href = './love-story.html';
        } else {
          switchMode('login');
        }
      }, 2000);

    } catch (error) {
      console.error('注册失败:', error);

      if (error.message.includes('already registered')) {
        showMessage('该邮箱已注册', 'error');
      } else {
        showMessage('注册失败: ' + error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // ========== 表单提交 ==========
  async function handleSubmit(e) {
    e.preventDefault();

    if (!supabase) {
      showMessage('Supabase 未初始化', 'error');
      return;
    }

    if (!validateForm()) return;

    const email = dom.emailInput.value.trim();
    const password = dom.passwordInput.value;

    setLoading(true);
    hideMessage();

    if (currentMode === 'login') {
      await handleLogin(email, password);
    } else {
      await handleSignup(email, password);
    }
  }

  // ========== 退出登录 ==========
  async function handleLogout() {
    if (!supabase) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      showMessage('已退出登录', 'success');

      setTimeout(() => {
        dom.signedState.hidden = true;
        dom.formState.hidden = false;
        dom.form.reset();
      }, 1000);

    } catch (error) {
      console.error('退出失败:', error);
      showMessage('退出失败: ' + error.message, 'error');
    }
  }

  // ========== 检查登录状态 ==========
  async function checkAuthState() {
    if (!supabase) return;

    try {
      const { data } = await supabase.auth.getSession();
      user = data.session?.user || null;

      if (user) {
        dom.formState.hidden = true;
        dom.signedState.hidden = false;
        dom.userEmail.textContent = user.email;
      } else {
        dom.formState.hidden = false;
        dom.signedState.hidden = true;
      }
    } catch (error) {
      console.error('获取会话失败:', error);
    }
  }

  // ========== 事件绑定 ==========
  function bindEvents() {
    // 表单提交
    dom.form.addEventListener('submit', handleSubmit);

    // 标签切换
    dom.tabLogin.addEventListener('click', () => switchMode('login'));
    dom.tabSignup.addEventListener('click', () => switchMode('signup'));
    dom.footerSwitch.addEventListener('click', () => {
      switchMode(currentMode === 'login' ? 'signup' : 'login');
    });

    // 退出登录
    dom.logoutBtn.addEventListener('click', handleLogout);

    // 密码显示切换
    if (dom.togglePassword) {
      dom.togglePassword.addEventListener('click', togglePasswordVisibility);
    }

    // 密码强度检测
    dom.passwordInput.addEventListener('input', (e) => {
      if (currentMode === 'signup') {
        checkPasswordStrength(e.target.value);
      }
    });

    // 监听模式切换时重置密码强度
    dom.tabLogin.addEventListener('click', () => {
      dom.passwordStrength.hidden = true;
    });

    dom.tabSignup.addEventListener('click', () => {
      checkPasswordStrength(dom.passwordInput.value);
    });

    // 监听认证状态变化
    if (supabase) {
      supabase.auth.onAuthStateChange((event, session) => {
        user = session?.user || null;

        if (event === 'SIGNED_IN') {
          checkAuthState();
        } else if (event === 'SIGNED_OUT') {
          dom.signedState.hidden = true;
          dom.formState.hidden = false;
        }
      });
    }
  }

  // ========== 创建背景粒子 ==========
  function createParticles() {
    const particlesContainer = document.querySelector('.auth-particles');
    if (!particlesContainer) return;

    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 4 + 2}px;
        height: ${Math.random() * 4 + 2}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: particle-float ${Math.random() * 10 + 10}s ease-in-out infinite;
        animation-delay: ${Math.random() * 5}s;
        pointer-events: none;
      `;
      particlesContainer.appendChild(particle);
    }

    // 添加动画
    if (!document.querySelector('#particle-animation')) {
      const style = document.createElement('style');
      style.id = 'particle-animation';
      style.textContent = `
        @keyframes particle-float {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.3;
          }
          50% {
            transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px);
            opacity: 0.8;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ========== 初始化 ==========
  function init() {
    console.log('🔐 现代登录页面初始化...');

    // 初始化 Supabase
    const supabaseReady = initSupabase();

    // 绑定事件
    bindEvents();

    // 创建背景粒子
    createParticles();

    // 检查登录状态
    if (supabaseReady) {
      checkAuthState();
    }

    // 默认模式
    switchMode('login');

    console.log('✅ 初始化完成');
  }

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
