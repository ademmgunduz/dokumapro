<?php require_once __DIR__ . '/config.php'; ?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo getSetting('company_name', 'DokumaQC'); ?> — Kalite Kontrol & Stok Takip</title>
<meta name="description" content="Dokuma sektörü için kalite kontrol ve stok takip sistemi">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Syne:wght@600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link href='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/main.min.css' rel='stylesheet' />
<script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/main.min.js'></script>
<link rel="stylesheet" href="style.css">
<script>
  const APP_VERSION = '<?php echo APP_VERSION; ?>';
  const APP_COMMIT = '<?php echo APP_COMMIT; ?>';
</script>
</head>
<body>

<!-- ══════ LOGIN ══════ -->
<div id="loginScreen" class="login-screen">
  <div class="login-bg-pattern"></div>
  <div class="login-card">
    <div class="login-logo">
      <div class="login-logo-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 8h24M4 16h24M4 24h24" stroke="url(#lg1)" stroke-width="2.5" stroke-linecap="round"/><path d="M8 4v24M16 4v24M24 4v24" stroke="url(#lg2)" stroke-width="1.5" stroke-linecap="round" opacity=".4"/><defs><linearGradient id="lg1" x1="4" y1="8" x2="28" y2="24"><stop stop-color="#00d4aa"/><stop offset="1" stop-color="#7c5cfc"/></linearGradient><linearGradient id="lg2" x1="8" y1="4" x2="24" y2="28"><stop stop-color="#00d4aa"/><stop offset="1" stop-color="#4f7cff"/></linearGradient></defs></svg>
      </div>
      <div class="login-logo-text">
        <span class="login-brand"><?php echo getSetting('company_name', 'DokumaQC'); ?></span>
        <span class="login-sub">Kalite Kontrol & Stok Takip</span>
      </div>
    </div>
    <form id="loginForm" onsubmit="doLogin(event)">
      <div class="form-floating">
        <input type="text" id="loginUser" required placeholder=" " autocomplete="username">
        <label for="loginUser">Kullanıcı Adı</label>
      </div>
      <div class="form-floating">
        <input type="password" id="loginPass" required placeholder=" " autocomplete="current-password">
        <label for="loginPass">Şifre</label>
      </div>
      <button type="submit" class="btn-login" id="loginBtn">
        <span>Giriş Yap</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
      <div id="loginError" class="login-error"></div>
    </form>
    <div class="login-footer">v<?php echo APP_VERSION; ?></div>
  </div>
</div>

<!-- ══════ APP SHELL ══════ -->
<div id="appShell" class="app-shell" style="display:none">
  <div class="overlay" id="overlay" onclick="toggleSidebar()"></div>

  <!-- SIDEBAR -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo-icon" onclick="toggleCollapse()" style="cursor:pointer" title="Menüyü Daralt/Genişlet">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><path d="M4 8h24M4 16h24M4 24h24" stroke="url(#slg1)" stroke-width="2.5" stroke-linecap="round"/><path d="M8 4v24M16 4v24M24 4v24" stroke="url(#slg2)" stroke-width="1.5" stroke-linecap="round" opacity=".4"/><defs><linearGradient id="slg1" x1="4" y1="8" x2="28" y2="24"><stop stop-color="#00d4aa"/><stop offset="1" stop-color="#7c5cfc"/></linearGradient><linearGradient id="slg2" x1="8" y1="4" x2="24" y2="28"><stop stop-color="#00d4aa"/><stop offset="1" stop-color="#4f7cff"/></linearGradient></defs></svg>
      </div>
      <div class="sidebar-logo-text">
        <span class="sidebar-brand"><?php echo getSetting('company_name', 'DokumaQC'); ?></span>
        <span class="sidebar-sub">KALİTE & STOK</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <!-- GENEL -->
      <div class="nav-item active" data-page="dashboard" onclick="navigateTo('dashboard')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></span>
        <span class="nav-label">Dashboard</span>
      </div>
      <div class="nav-item" data-page="modules" onclick="navigateTo('modules')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
        <span class="nav-label">Modüller</span>
      </div>
      <div class="nav-item" data-page="reports" onclick="navigateTo('reports')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/><circle cx="18" cy="8" r="2"/><circle cx="12" cy="2" r="2"/><circle cx="6" cy="16" r="2"/></svg></span>
        <span class="nav-label">Raporlar</span>
      </div>
      <div class="nav-item" data-page="analiz" onclick="navigateTo('analiz')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v8L6.5 9 2 17h20l-4.5-8L14 10V2"/><path d="M2 17h20v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M12 17v4"/></svg></span>
        <span class="nav-label">Analiz</span>
      </div>

      <div class="nav-section">SATIŞ & SİPARİŞ</div>
      <div class="nav-item" data-page="orders" onclick="navigateTo('orders')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg></span>
        <span class="nav-label">Sipariş & Projeler</span>
      </div>
      <div class="nav-item" data-page="customers" onclick="navigateTo('customers')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
        <span class="nav-label">Cariler</span>
      </div>
      <div class="nav-item" data-page="shipments" onclick="navigateTo('shipments')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><rect x="5" y="17" width="2" height="2" rx="1"/><rect x="17" y="17" width="2" height="2" rx="1"/></svg></span>
        <span class="nav-label">Sevkiyat / Çeki</span>
      </div>

      <div class="nav-section">ÜRETİM & KALİTE</div>
      <div class="nav-item" data-page="looms" onclick="navigateTo('looms')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 6v12M2 12h20"/></svg></span>
        <span class="nav-label">Tezgahlar</span>
      </div>
      <div class="nav-item" data-page="qc-new" onclick="navigateTo('qc-new')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
        <span class="nav-label">Kalite Kontrol</span>
      </div>
      <div class="nav-item" data-page="qc-list" onclick="navigateTo('qc-list')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg></span>
        <span class="nav-label">Kontrol Listesi</span>
      </div>

      <div class="nav-section">STOK İŞLEMLERİ</div>
      <div class="nav-item" data-page="products" onclick="navigateTo('products')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg></span>
        <span class="nav-label">Ürünler</span>
      </div>
      <div class="nav-item" data-page="depo-giris" onclick="navigateTo('depo-giris')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg></span>
        <span class="nav-label">Depo Giriş</span>
      </div>
      <div class="nav-item" data-page="stock-move" onclick="navigateTo('stock-move')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/></svg></span>
        <span class="nav-label">Stok Hareketleri</span>
      </div>

      <div class="nav-section">SİSTEM</div>
      <div class="nav-item" data-page="settings" onclick="navigateTo('settings')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span>
        <span class="nav-label">Ayarlar</span>
      </div>
      <div class="nav-item" data-page="about" onclick="navigateTo('about')">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></span>
        <span class="nav-label">Hakkında</span>
      </div>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" onclick="window.doLogout()" style="cursor:pointer; transition: background 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
        <div class="sidebar-avatar" id="userAvatar">A</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name" id="userName">Admin</span>
          <span class="sidebar-user-role" style="color:var(--danger)">Çıkış Yap →</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="main-area">
    <header class="topbar">
      <button class="hamburger" onclick="toggleSidebar()">☰</button>
      <div class="topbar-title">
        <h1 id="pageTitle">Dashboard</h1>
        <span class="topbar-breadcrumb" id="pageBreadcrumb">Ana Sayfa</span>
      </div>
      <div class="topbar-right">
        <div id="exchangeRates" class="topbar-rates"></div>
        <div class="topbar-notifications" id="notiBell" onclick="toggleNotifications()" style="display:none">
          <span class="noti-bell">🔔</span>
          <span class="noti-badge" id="notiBadge" style="display:none">0</span>
          <div class="noti-dropdown" id="notiDropdown">
            <div class="noti-header">
              <h4>BİLDİRİMLER</h4>
              <div style="display:flex; gap:5px">
                <button class="btn btn-icon" id="muteBtn" onclick="toggleMute()" title="Bildirim Sesini/Pop-uplarını Kapat">
                  <span id="muteIcon">🔊</span>
                </button>
                <button class="btn btn-icon" onclick="clearNotifications()" title="Tümünü Okundu İşaretle">✔️</button>
              </div>
            </div>
            <div class="noti-list" id="notiList"></div>
          </div>
        </div>
        <div class="topbar-notifications" id="topbarChatBtn" onclick="toggleChat()" style="display:none; position:relative">
          <span class="noti-bell">💬</span>
          <span class="noti-badge" id="chatBadge" style="display:none">0</span>
          <div class="chat-window" id="chatWindow" onclick="event.stopPropagation()">
            <div class="chat-header">
              <h4>💬 Takım Sohbeti</h4>
              <button class="chat-btn" id="muteChatBtn" onclick="toggleMute()" style="width:32px;height:32px;font-size:14px;background:transparent;box-shadow:none" title="Sessize Al/Aç">🔊</button>
            </div>
            <div class="chat-body" id="chatBody"></div>
            <div class="chat-footer">
              <input type="text" class="chat-input" id="chatInput" placeholder="Mesajınızı yazın..." onkeydown="if(event.key==='Enter')sendMessage()">
              <button class="chat-send" onclick="sendMessage()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div id="topbarLicense" style="display:none"></div>
        <button class="btn-fullscreen" id="fullScreenBtn" onclick="toggleFullScreen()" title="Tam Ekran">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <span class="topbar-date" id="topbarDate"></span>
      </div>
    </header>
    <div class="content" id="contentArea">
      <!-- Dynamic content loaded here -->
    </div>
  </main>
</div>

<!-- ══════ TOAST ══════ -->
<div id="toastContainer" class="toast-container"></div>

<!-- ══════ MODAL ══════ -->
<div id="modalOverlay" class="modal-overlay" onclick="closeModal()">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h3 id="modalTitle">Modal</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="app.js"></script>
<script src="app2.js"></script>
<script src="app3.js"></script>
</body>
</html>
