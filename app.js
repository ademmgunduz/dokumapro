/* ═══════════════════════════════════════════
   DokumaQC — Application JavaScript
   Part 1: Core + Dashboard + Quality Control
   ═══════════════════════════════════════════ */

// ── State ──
let currentPage = 'dashboard';
let currentUser = null;
let fabricTypes = [];
let defectTypes = [];
let products = [];
let customers = [];
let chartInstances = {};
let appSettings = {};
let lastNotiCheckId = 0;
let unreadNotiCount = 0;
let chatOpen = false;
let lastMessageId = 0;
let unreadMessageCount = 0;
let isMuted = localStorage.getItem('isMuted') === 'true';
let csrfToken = '';

// ── Module Guide Data ──
const moduleGuideData = {
  'accounting': {
    title: '💰 Ön Muhasebe & Finans - Nasıl Kullanılır?',
    steps: [
      'Cariler sayfasından ilgili müşteriye tıklayıp 📊 Finans butonuna basın',
      'Üst kısımdaki TL, USD ve EUR kartlarından anlık bakiyeleri izleyin',
      '💵 Tahsilat veya 💸 Ödeme butonlarıyla finansal hareket ekleyin',
      'Dövizli işlemlerde Kur (Parite) bilgisini girmeyi unutmayın',
      '🧾 Yeni Fatura butonuna basarak sevk edilen ürünleri faturalandırın',
      'Fatura keserken KDV oranı ve tutarını manuel olarak da girebilirsiniz',
      '📱 WhatsApp butonuyla son hareketleri ve bakiyeyi müşteriye gönderin',
      '🖨️ Ekstre Yazdır butonuyla profesyonel PDF çıktısı alın',
      'Hatalı işlemleri çöp kutusu ikonuna tıklayarak silebilirsiniz'
    ]
  },
  'dashboard': {
    title: '📊 Dashboard - Nasıl Kullanılır?',
    steps: [
      'Sistemin genel durumunu buradan izleyin',
      'KPI kartları: Toplam stok, bugünkü kontroller, ortalama kalite puanı',
      'Grafikler: Kalite trendi (30 gün) ve hata dağılımını gösterir',
      'Alt tablolarda: Son kontrolleri ve stok durumunu görebilirsiniz',
      'Yenile butonu ile verileri güncelleyebilirsiniz'
    ]
  },
  'qc-new': {
    title: '🔍 Kalite Kontrol - Nasıl Kullanılır?',
    steps: [
      'Önce tezgah seçin - otomatik olarak ürün ve müşteri bilgisi gelecektir',
      'Metre, kilo ve en ölçülerini girin (gramaj otomatik hesaplanır)',
      'Tespit edilen hataları + Hata Ekle butonuyla ekleyin',
      'Kalite kararını seçin (1.Kalite, 2.Kalite, Parça, Fire)',
      'Puanı kontrol edin (otomatik hesaplanır)',
      'Kaydet butonuna basın, barkod otomatik oluşur',
      'Yazdır butonuyla barkod etiketini yazdırabilirsiniz'
    ]
  },
  'qc-list': {
    title: '📋 Kontrol Listesi - Nasıl Kullanılır?',
    steps: [
      'Tüm kalite kontrol kayıtlarını tablo halinde görün',
      'Arama kutusu ile top no, parti no veya ürün adına göre filtreleyin',
      'Tarih aralığı seçerek belirli dönemi inceleyin',
      'Kalite kararına göre filtreleme yapın (1.Kalite, 2.Kalite vb.)',
      'Düzenle ikonuna tıklayarak kaydı güncelleyin',
      'Sil ikonuna tıklayarak kaydı silin (tezgah sayacından düşülmez)'
    ]
  },
  'looms': {
    title: '🏭 Tezgahlar - Nasıl Kullanılır?',
    steps: [
      'Tüm tezgahları ve anlık durumlarını görün',
      'Yeni tezgah eklemek için + Tezgah Ekle butonuna tıklayın',
      'Tezgahı düzenlemek için listeden tezgah adına tıklayın',
      'RPM, çalışma saati, çerçeve sayısı gibi teknik bilgileri girin',
      'Ürün atamak için ilgili ürünü seçin (sipariş otomatik aktarılır)',
      'Çözgü bilgilerini girin: Toplam çözgü ve başlangıç metresi',
      'Günlük randıman girişi için "Randıman Girişi" butonunu kullanın',
      'Sıfırla butonu ile günlük veya çözgü sayacını sıfırlayın'
    ]
  },
  'products': {
    title: '📦 Ürünler & Stok - Nasıl Kullanılır?',
    steps: [
      'Tüm ürünleri liste halinde görün, stok miktarlarını takip edin',
      'Yeni ürün eklemek için + Ürün butonuna tıklayın',
      'Ürün kodu, adı, kumaş tipi ve birim bilgilerini girin',
      'Teknik detaylar kısmına sıklık, iplik cinsi gibi bilgileri ekleyin',
      'Excel\'den yükle butonu ile toplu ürün ekleyin (.xlsx, .xls, .csv)',
      'Excel\'e aktar butonu ile ürün listesini indirin',
      'Stok hareketlerini görmek için ürünün stok değerine tıklayın'
    ]
  },
  'customers': {
    title: '👥 Cariler - Nasıl Kullanılır?',
    steps: [
      'Müşteri veritabanını görüntüleyin',
      'Yeni müşteri eklemek için + Cari Ekle butonuna tıklayın',
      'Müşteri adı, telefon, e-posta ve notları girin',
      'Müşteri özetini görmek için müşteri adına tıklayın',
      'Özet sayfasında: Dış alımlar ve sevkiyatlar listelenir',
      'Müşteriyi silmek için çöp kutusu ikonuna tıklayın'
    ]
  },
  'orders': {
    title: '📑 Sipariş & Projeler - Nasıl Kullanılır?',
    steps: [
      'Tüm siparişleri ve durumlarını görün (Açık, Kapalı, İptal)',
      'Yeni sipariş eklemek için + Sipariş Ekle butonuna tıklayın',
      'Müşteri, ürün, sipariş tarihi ve teslim tarihini girin',
      'Sipariş miktarını (metre) belirtin',
      'Siparişi bir tezgaha atamak için Tezgahlar sayfasına gidin',
      'Durumu güncellemek için sipariş satırındaki duruma tıklayın',
      'Kapanan siparişler arşivlenir, aktif üretimden çıkar'
    ]
  },
  'shipments': {
    title: '🚚 Sevkiyat & Çeki - Nasıl Kullanılır?',
    steps: [
      'Hazırlanan veya sevk edilen çekileri görün',
      'Yeni sevkiyat oluşturmak için + Sevkiyat butonuna tıklayın',
      'Müşteri ve sevkiyat tarihini seçin',
      'Çekiye top eklemek için + Top Ekle butonunu kullanın',
      'Mevcut stoktan (shipment_id NULL olan) top seçin',
      'Plaka numarası girin ve sevkiyatı kaydedin',
      'Çeki yazdırmak için yazdır ikonuna tıklayın',
      'Sevk edildi olarak işaretlemek için durumu güncelleyin'
    ]
  },
  'depo-giris': {
    title: '📥 Depo Giriş (Dış Alım) - Nasıl Kullanılır?',
    steps: [
      'Harici tedarikçilerden gelen kumaşları kaydedin',
      'Müşteri seçin (dış alım yapılan tedarikçi/cari)',
      'Top no, parti no, metre, kilo ve en bilgilerini girin',
      'Kalite kararını belirleyin',
      'Kaydet butonuna basın - stoka otomatik eklenecektir',
      'Son girişleri aşağıdaki tablodan takip edin',
      'Düzenle veya sil butonlarıyla kayıtları yönetin'
    ]
  },
  'stock-move': {
    title: '🔄 Stok Hareketleri - Nasıl Kullanılır?',
    steps: [
      'Tüm stok giriş/çıkış hareketlerini görün',
      'Manuel giriş/çıkış yapmak için + Hareket Ekle butonuna tıklayın',
      'Ürün seçin, hareket tipini belirleyin (Giriş/Çıkış)',
      'Miktar girin, önceki ve yeni stok otomatik hesaplanır',
      'Filtreleme: Ürün, tarih aralığı veya işlem tipine göre filtreleyin',
      'Arama kutusu ile ürün adı, müşteri veya belge no ile arama yapın'
    ]
  },
  'reports': {
    title: '📈 Raporlar - Nasıl Kullanılır?',
    steps: [
      'Üretim, stok ve sevkiyat raporlarını görüntüleyin',
      'Tarih aralığı seçerek belirli dönemi raporlayın',
      'Rapor türünü seçin: Üretim özeti, Kalite raporu, Stok raporu',
      'Grafikleri ve özet tabloları inceleyin',
      'Raporu yazdırmak için yazdır butonunu kullanın',
      'Excel\'e aktar butonu ile raporu indirin'
    ]
  },
  'analiz': {
    title: '🔬 Analiz - Nasıl Kullanılır?',
    steps: [
      'Kumaş maliyet analizi için bu modülü kullanın',
      'Ürün seçin ve teknik bilgileri girin (sıklık, iplik vb.)',
      'Hammadde maliyetlerini girin (iplik, boya, apre vb.)',
      'Fire oranı ve işçilik maliyetlerini belirtin',
      'Sistem otomatik olarak birim maliyeti hesaplar',
      'Kar marjı ekleyerek satış fiyatını belirleyin',
      'Analiz sonuçlarını yazdırın veya kaydedin'
    ]
  },
  'settings': {
    title: '⚙️ Ayarlar - Nasıl Kullanılır?',
    steps: [
      'Firma bilgilerini düzenleyin (ad, telefon, adres)',
      'Kalite eşik değerlerini belirleyin (1.Kalite ve 2.Kalite için)',
      'Barkod boyutlarını ayarlayın (yazdırma için)',
      'Tema seçin: Koyu (Dark) veya Açık (Light)',
      'Kullanıcı yönetimi: Yeni kullanıcı ekle, yetkilendir',
      'Sistem sıfırlama: Tüm verileri temizle (kullanıcılar hariç)',
      'Yedekle: Veritabanını yedekle (.db dosyası indir)',
      'Geri yükle: Daha önce alınan yedeği yükle'
    ]
  }
};

function toggleModuleGuide(module) {
  const guide = document.getElementById('guide-' + module);
  const card = document.getElementById('feature-' + module);
  if (!guide || !card) return;

  const isOpen = guide.classList.contains('open');

  // Tüm açık olanları kapat
  document.querySelectorAll('.module-guide.open').forEach(g => {
    g.classList.remove('open');
    const cardId = g.id.replace('guide-', 'feature-');
    document.getElementById(cardId)?.classList.remove('expanded');
  });

  if (!isOpen) {
    guide.classList.add('open');
    card.classList.add('expanded');
  }
}

let _updatesLoaded = false;
function toggleUpdates() {
  const guide = document.getElementById('guide-updates');
  const card = document.getElementById('feature-updates');
  if (!guide || !card) return;

  const isOpen = guide.classList.contains('open');
  document.querySelectorAll('.module-guide.open').forEach(g => {
    g.classList.remove('open');
    const cardId = g.id.replace('guide-', 'feature-');
    document.getElementById(cardId)?.classList.remove('expanded');
  });

  if (!isOpen) {
    guide.classList.add('open');
    card.classList.add('expanded');
    if (!_updatesLoaded) {
      _updatesLoaded = true;
      const el = document.getElementById('updates-list');
      if (el) {
        fetch('https://api.github.com/repos/ademmgunduz/dokumapro/commits?per_page=5', { signal: AbortSignal.timeout(5000) })
          .then(r => r.json())
          .then(data => {
            if (!Array.isArray(data)) throw new Error('Geçersiz yanıt');
            el.innerHTML = data.map(c => {
              const msg = c.commit.message.split('\n')[0];
              const date = new Date(c.commit.author.date).toLocaleDateString('tr-TR');
              const sha = c.sha.slice(0, 7);
              return `<div style="padding:8px 0; border-bottom:1px solid var(--border)"><span style="font-family:monospace;font-size:10px;color:var(--text3)">${sha}</span> <span style="color:var(--text)">${msg}</span><br><span style="font-size:10px;color:var(--text3)">${date}</span></div>`;
            }).join('') || '<div style="color:var(--text3)">Henüz güncelleme yok.</div>';
          })
          .catch(() => {
            el.innerHTML = '<div style="color:var(--text3);padding:12px 0">Güncelleme bilgisi alınamadı.<br><span style="font-size:10px">İnternet bağlantınızı kontrol edin.</span></div>';
          });
      }
    }
  }
}

const ALL_MODULES = {
  dashboard: 'Genel Bakış',
  analiz: 'Maliyet Analizi',
  looms: 'Tezgahlar',
  qc: 'Kalite Kontrol (Yeni)',
  history: 'Kontrol Listesi',
  products: 'Ürünler & Stok',
  inventory: 'Stok Hareketleri',
  shipments: 'Sevkiyat / Çeki',
  orders: 'Sipariş & Projeler',
  depo: 'Depo Giriş (Dış Alım)',
  customers: 'Cariler',
  kartela: 'Kartela Takip',
  reports: 'Raporlar',
  settings: 'Ayarlar',
  about: 'Hakkında',
  modules: 'Modüller'
};

const MODULE_ICONS = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
  reports: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/><circle cx="18" cy="8" r="2"/><circle cx="12" cy="2" r="2"/><circle cx="6" cy="16" r="2"/></svg>',
  analiz: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v8L6.5 9 2 17h20l-4.5-8L14 10V2"/><path d="M2 17h20v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M12 17v4"/></svg>',
  orders: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>',
  customers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  shipments: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><rect x="5" y="17" width="2" height="2" rx="1"/><rect x="17" y="17" width="2" height="2" rx="1"/></svg>',
  looms: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 6v12M2 12h20"/></svg>',
  'qc-new': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  'qc-list': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  kartela: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
  products: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
  'depo-giris': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>',
  'stock-move': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  about: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  modules: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
};

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  updateTopbarDate();
  updateExchangeRates();
  setInterval(updateTopbarDate, 60000);
  setInterval(updateExchangeRates, 1800000); // 30 mins
  checkSession();
  setInterval(checkNotifications, 10000); // 10 saniyede bir kontrol et
  setInterval(checkSmartAlerts, 60000); // 60 saniyede bir akıllı uyarıları kontrol et
  setInterval(pollMessages, 10000); // Mesajları kontrol et

  // Periyodik lisans kontrolü (her 1 gün)
  setInterval(async () => {
    if (currentUser) {
      const licenseRes = await api('check_license');
      if (!licenseRes.valid) {
        showLicenseExpiredScreen(licenseRes);
      } else if (licenseRes.warning && licenseRes.days_left <= 7) {
        toast(`⚠️ Lisansınızın süresi ${licenseRes.days_left} gün sonra dolacak!`, 'warning');
      }
      // Üst köşedeki lisans bilgisini güncelle
      const topbarLicense = document.getElementById('topbarLicense');
      if (topbarLicense && licenseRes.days_left !== undefined) {
        const daysLeft = licenseRes.days_left;
        let licenseText = '';
        let color = 'var(--accent)';

        if (daysLeft <= 0) {
          licenseText = ' | Lisans: Süre bitti!';
          color = 'var(--danger)';
        } else if (daysLeft <= 7) {
          licenseText = ` | Lisans: ${daysLeft} gün kaldı`;
          color = 'var(--warning)';
        } else {
          licenseText = ` | Lisans: ${daysLeft} gün kaldı`;
        }
        topbarLicense.textContent = licenseText;
        topbarLicense.style.color = color;
      }
    }
  }, 86400000); // 1 gün = 86400000 ms

  // Chat penceresi dışına tıklayınca kapat
  document.addEventListener('click', (e) => {
    const chatBtn = document.getElementById('topbarChatBtn');
    const chatWin = document.getElementById('chatWindow');
    if (chatOpen && chatWin && !chatWin.contains(e.target) && !chatBtn.contains(e.target)) {
      toggleChat();
    }
  });
});

async function updateExchangeRates() {
  const el = document.getElementById('exchangeRates');
  if (!el) return;
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://api.exchangerate-api.com/v4/latest/USD').then(r => r.json()),
      fetch('https://api.exchangerate-api.com/v4/latest/EUR').then(r => r.json())
    ]);

    const usdTry = usdRes.rates.TRY;
    const eurTry = eurRes.rates.TRY;

    el.innerHTML = `
      <div class="rate-item">
        <span class="rate-label">USD</span>
        <span class="rate-val">${usdTry.toFixed(2)} ₺</span>
      </div>
      <div class="rate-item">
        <span class="rate-label">EUR</span>
        <span class="rate-val eur">${eurTry.toFixed(2)} ₺</span>
      </div>
    `;
  } catch (e) {
    console.error('Döviz kuru alınamadı:', e);
  }
}

function toggleFullScreen() {
  const isFull = document.fullscreenElement || document.webkitFullscreenElement;
  if (!isFull) {
    const req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    req.call(document.documentElement).catch(err => {
      toast(`Tam ekran hatası: ${err.message}`, 'error');
    });
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    exit.call(document);
  }
}

function updateFullscreenBtn() {
  const btn = document.getElementById('fullScreenBtn');
  if (!btn) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6-6 6m16-6h-6m0 0v6m0-6 6 6M4 10h6m0 0V4m0 6-6-6m16 6h-6m0 0V4m0 6 6-6"/></svg>`;
    btn.title = "Tam Ekrandan Çık";
  } else {
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
    btn.title = "Tam Ekran";
  }
}

document.addEventListener('fullscreenchange', updateFullscreenBtn);
document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

function updateTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (el) {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let dateStr = now.toLocaleDateString('tr-TR', opts);

    // Lisans gün sayısını tarihin yanında göster (sadece giriş yapıldıysa)
    if (currentUser) {
      api('check_license').then(licenseRes => {
        const licenseEl = document.getElementById('topbarLicense');
        if (!licenseEl) return;

        if (licenseRes && licenseRes.days_left !== undefined) {
          const daysLeft = licenseRes.days_left;
          let licenseText = `LİSANS: ${daysLeft} GÜN`;
          let color = 'var(--accent)';
          let bgColor = 'rgba(0, 212, 170, 0.1)';

          if (daysLeft <= 0) {
            licenseText = '⚠️ SÜRE BİTTİ';
            color = '#ff4d4d';
            bgColor = 'rgba(255, 77, 77, 0.15)';
          } else if (daysLeft <= 7) {
            licenseText = `⚠️ ${daysLeft} GÜN`;
            color = '#ff9800';
            bgColor = 'rgba(255, 152, 0, 0.15)';
          }

          licenseEl.textContent = licenseText;
          licenseEl.style.cssText = `display:inline-block; font-size:10px; margin-right:12px; padding:3px 8px; border-radius:4px; font-weight:700; border:1px solid ${color}; color:${color}; background:${bgColor}; letter-spacing:0.5px;`;
        } else {
          licenseEl.style.display = 'none';
        }
      }).catch(() => { });
    }

    el.textContent = dateStr;
  }
}

// ═══════════════════════════════
//  API HELPER
// ═══════════════════════════════
async function api(action, data = null, method = 'GET') {
  try {
    let url = `api.php?action=${action}`;
    let opts = { method };
    if (method === 'GET' && data) {
      const params = new URLSearchParams(data);
      url += '&' + params.toString();
    } else if (data) {
      if (data instanceof FormData) {
        opts.body = data;
      } else {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(data);
      }
    }
    
    // CSRF Token ekle
    if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(method)) {
      opts.headers = opts.headers || {};
      opts.headers['X-CSRF-Token'] = csrfToken;
    }
    const res = await fetch(url, opts);
    if (action.startsWith('export_') || action === 'backup') return res;
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Bir hata oluştu');
    return json;
  } catch (e) {
    if (e.message.includes('Oturum')) {
      showLogin();
    }
    throw e;
  }
}

// ── Yardımcı Hesaplamalar ──
function getWarpConsumed(l) {
  if (appSettings.warp_deduction === 'qc') {
    return Math.max(0, parseFloat(l.qc_consumed_meters || 0));
  }
  return Math.max(0, parseFloat(l.current_meters || 0) - parseFloat(l.warp_start_meter || 0));
}

// ═══════════════════════════════
//  AUTH
// ═══════════════════════════════
async function checkSession() {
  try {
    const res = await api('check_session');
    if (res.logged_in) {
      currentUser = res.user;
      csrfToken = res.csrf_token || '';
      await showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}

function showLicenseExpiredScreen(licenseRes) {
  const loginScreen = document.getElementById('loginScreen');
  const appShell = document.getElementById('appShell');
  loginScreen.style.display = 'none';
  appShell.style.display = 'none';

  const oldScreen = document.getElementById('licenseScreen');
  if (oldScreen) oldScreen.remove();

  const daysLeft = licenseRes?.days_left || 0;
  const isExpired = daysLeft <= 0;
  const message = licenseRes?.message || 'Lisans sorunu';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  let contentHTML = '';

  if (isExpired) {
    if (isSuperAdmin) {
      contentHTML = `
        <div style="background:var(--surface2); border-radius:8px; padding:16px; margin-bottom:24px">
          <p style="color:var(--text3); font-size:12px; margin:0">Lisans süresi doldu. Yenilemek için giriş yapın.</p>
        </div>
        <button class="btn btn-primary" onclick="document.getElementById('licenseScreen')?.remove(); showLogin()" style="width:100%">Giriş Yap</button>
      `;
    } else {
      contentHTML = `
        <div style="background:var(--surface2); border-radius:8px; padding:16px; margin-bottom:24px">
          <p style="color:var(--text3); font-size:12px; margin:0">Bu programın kullanım hakkı sona ermiştir.</p>
        </div>
        
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; margin-bottom:24px; text-align:left">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border)">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div>
              <div style="font-weight:700; color:var(--text); font-size:16px">Adem Gündüz</div>
              <div style="font-size:11px; color:var(--text3)">Kurucu & Baş Geliştirici</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px">
            <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text2)">
              <span style="font-size:16px">📞</span>
              <a href="tel:05548251757" style="color:var(--accent); text-decoration:none; font-weight:600; font-family:'IBM Plex Mono',monospace">0554 825 17 57</a>
            </div>
            <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text2)">
              <span style="font-size:16px">✉️</span>
              <a href="mailto:ademmgunduz@gmail.com" style="color:var(--accent); text-decoration:none; font-weight:600; font-family:'IBM Plex Mono',monospace">ademmgunduz@gmail.com</a>
            </div>
          </div>
          <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border)">
            <p style="font-size:11px; color:var(--text3); margin:0; line-height:1.5">Lisans yenileme işlemi için yukarıdaki iletişim bilgilerini kullanarak bizimle iletişime geçebilirsiniz.</p>
          </div>
        </div>
        
        <button class="btn btn-secondary" onclick="document.getElementById('licenseScreen')?.remove(); showLogin()" style="width:100%">Giriş Ekranına Dön</button>
      `;
    }
  } else {
    contentHTML = `
      <div style="background:var(--surface2); border-radius:8px; padding:16px; margin-bottom:24px">
        <p style="color:var(--warning); font-size:14px; margin:0">Kalan gün: <strong>${daysLeft}</strong></p>
      </div>
      <button class="btn btn-primary" onclick="document.getElementById('licenseScreen')?.remove(); showLogin()" style="width:100%">Giriş Yap</button>
    `;
  }

  const licenseHTML = `
    <div id="licenseScreen" style="display:flex; align-items:center; justify-content:center; min-height:100vh; background:linear-gradient(135deg, #0a0c10 0%, #1a1c2e 100%); padding:20px">
      <div style="background:var(--surface); border-radius:16px; padding:40px; max-width:500px; width:100%; text-align:center; border:1px solid var(--border); box-shadow:0 20px 60px rgba(0,0,0,0.5)">
        <div style="font-size:64px; margin-bottom:20px">${isExpired ? '🔒' : '⚠️'}</div>
        <h2 style="color:var(--text); margin-bottom:10px; font-size:24px">${isExpired ? 'Lisans Süresi Doldu!' : 'Lisans Uyarısı'}</h2>
        <p style="color:var(--text2); margin-bottom:30px; font-size:14px; line-height:1.6">${message}</p>
        ${contentHTML}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', licenseHTML);
}

async function showApp() {
  try {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';

    // Show notification bell and chat button in topbar
    const notiBell = document.getElementById('notiBell');
    if (notiBell) notiBell.style.display = 'flex';
    const chatBtn = document.getElementById('topbarChatBtn');
    if (chatBtn) chatBtn.style.display = 'flex';

    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

    // Mute icon init
    const mIcon = document.getElementById('muteIcon');
    if (mIcon) mIcon.textContent = isMuted ? '🔇' : '🔊';

    renderSidebar();

    await loadReferenceData();
    
    // İlk giriş sonrası akıllı uyarıları hemen kontrol et
    setTimeout(checkSmartAlerts, 2000);

    // İlk açılış sayfasını belirle (varsayılan: dashboard)
    const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
    const defaultPage = appSettings.default_landing_page || 'dashboard';

    // Herkese açık sayfalar (izin gerektirmez)
    const publicPages = ['dashboard', 'modules', 'about'];

    // Kullanıcının bu sayfaya erişimi var mı?
    let hasAccess = false;

    if (publicPages.includes(defaultPage)) {
      hasAccess = true;
    } else if (isAdmin) {
      hasAccess = true;
    } else {
      // İzin tabanlı kontrol (defaultPage permission key mi? page key mi?)
      let permKey = defaultPage;
      if (defaultPage === 'qc-new') permKey = 'qc';
      if (defaultPage === 'qc-list') permKey = 'history';
      if (defaultPage === 'stock-move') permKey = 'inventory';
      if (defaultPage === 'depo-giris') permKey = 'depo';
      hasAccess = perms.includes(permKey);
    }

    if (hasAccess) {
      // Sayfanın pageConfig'de olduğunu kontrol et
      if (pageConfig[defaultPage]) {
        navigateTo(defaultPage);
      } else {
        // pageConfig'de yoksa dashboard'a yönlendir
        navigateTo('dashboard');
      }
    } else if (isAdmin || perms.includes('dashboard')) {
      navigateTo('dashboard');
    } else {
      // İzin verilen ilk sayfaya git - ALL_MODULES yerine pageConfig kullan
      const firstPage = Object.keys(pageConfig).find(p => {
        if (p === 'modules' || p === 'about') return true;
        return perms.includes(p);
      });
      if (firstPage) {
        navigateTo(firstPage);
      } else {
        toast('Erişim yetkiniz bulunan modül yok', 'error');
      }
    }
  } catch (e) {
    console.error('showApp() hatası:', e);
    toast('Uygulama başlatılırken hata: ' + e.message, 'error');
    // Fallback: dashboard'a git
    setTimeout(() => navigateTo('dashboard'), 1000);
  }
}

function renderSidebar() {
  const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  document.querySelectorAll('.nav-item').forEach(el => {
    const page = el.dataset.page;
    let permKey = page;
    if (page === 'qc-new') permKey = 'qc';
    if (page === 'qc-list') permKey = 'history';
    if (page === 'stock-move') permKey = 'inventory';
    if (page === 'depo-giris') permKey = 'depo';

    const hasAccess = isAdmin || perms.includes(permKey);
    el.style.display = hasAccess ? 'flex' : 'none';
  });

  document.querySelectorAll('.nav-section').forEach(sec => {
    let next = sec.nextElementSibling;
    let visible = false;
    while (next && next.classList.contains('nav-item')) {
      if (next.style.display !== 'none') { visible = true; break; }
      next = next.nextElementSibling;
    }
    sec.style.display = visible ? 'block' : 'none';
  });
}

async function doLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;margin:0;border-width:2px"></span>';
  errEl.textContent = '';
  try {
    const res = await api('login', {
      username: document.getElementById('loginUser').value,
      password: document.getElementById('loginPass').value
    }, 'POST');

    if (!res.user) {
      errEl.textContent = 'Sunucudan kullanıcı bilgisi alınamadı';
      btn.classList.remove('loading');
      btn.innerHTML = '<span>Giriş Yap</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
      return;
    }

    currentUser = res.user;
    csrfToken = res.csrf_token || '';

    // Lisans kontrolü (superadmin her zaman girebilir)
    try {
      const licenseRes = await api('check_license');
      if (!licenseRes.valid && currentUser.role !== 'superadmin') {
        showLicenseExpiredScreen(licenseRes);
        return;
      }
      if (licenseRes.warning && licenseRes.days_left > 0) {
        toast(`⚠️ Lisansınızın süresi ${licenseRes.days_left} gün sonra dolacak!`, 'warning');
      }
    } catch (licenseErr) {
      console.warn('Lisans kontrolü yapılamadı:', licenseErr);
      // Lisans kontrolü yapılamazsa girişe izin ver
    }

    await showApp();
    updateTopbarDate();
  } catch (e) {
    errEl.textContent = e.message || 'Giriş yapılırken hata oluştu';
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span>Giriş Yap</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  }
}

async function doLogout() {
  console.log('Çıkış yapılıyor...');
  try {
    await api('logout');
  } catch(e) { console.error('Logout API hatası:', e); }
  
  currentUser = null;
  const chatWidget = document.getElementById('chatWidget');
  if (chatWidget) chatWidget.style.display = 'none';
  showLogin();
  toast('Çıkış yapıldı', 'info');
}
window.doLogout = doLogout;

// ═══════════════════════════════
//  REFERENCE DATA
// ═══════════════════════════════
async function loadReferenceData() {
  try {
    const [ft, dt, pr, cu, st] = await Promise.all([
      api('fabric_types'), api('defect_types'), api('products'), api('customers'), api('settings')
    ]);
    fabricTypes = ft.data || [];
    defectTypes = dt.data || [];
    products = pr.data || [];
    customers = cu.data || [];
    appSettings = st.data || {};

    // Apply theme
    if (appSettings.theme) {
      document.body.className = 'theme-' + appSettings.theme;
    }
  } catch (e) {
    console.error('loadReferenceData hatası:', e);
    // Fallback: try to load settings separately
    try {
      const st = await api('settings');
      appSettings = st.data || {};
      if (appSettings.theme) {
        document.body.className = 'theme-' + appSettings.theme;
      }
    } catch (e2) {
      console.error('Settings yüklenemedi:', e2);
    }
  }
}

// ═══════════════════════════════
//  NAVIGATION
// ═══════════════════════════════
const pageConfig = {
  'dashboard': { title: 'Dashboard', breadcrumb: 'Ana Sayfa', loader: 'loadDashboard' },
  'analiz': { title: 'Maliyet Analizi', breadcrumb: 'Analiz', loader: 'loadAnaliz' },
  'qc-new': { title: 'Yeni Kalite Kontrolü', breadcrumb: 'Kalite Kontrol → Yeni', loader: 'loadQCNew' },
  'qc-list': { title: 'Kontrol Listesi', breadcrumb: 'Kalite Kontrol → Liste', loader: 'loadQCList' },
  'kartela': { title: 'Kartela Takip', breadcrumb: 'Üretim → Kartela', loader: 'loadKartela' },
  'looms': { title: 'Tezgah Takibi', breadcrumb: 'Üretim → Tezgahlar', loader: 'loadLooms' },
  'products': { title: 'Ürün Yönetimi', breadcrumb: 'Stok → Ürünler', loader: 'loadProducts' },
  'depo-giris': { title: 'Depo Giriş', breadcrumb: 'Stok → Depo Giriş', loader: 'loadDepoGiris' },
  'stock-move': { title: 'Stok Hareketleri', breadcrumb: 'Stok → Hareketler', loader: 'loadStockMovements' },
  'reports': { title: 'Raporlar', breadcrumb: 'Raporlar', loader: 'loadReports' },
  'customers': { title: 'Müşteri Yönetimi', breadcrumb: 'Müşteriler', loader: 'loadCustomers' },
  'orders': { title: 'Sipariş & Projeler', breadcrumb: 'Sipariş & Projeler', loader: 'loadOrders' },
  'shipments': { title: 'Sevkiyat Yönetimi', breadcrumb: 'Sevkiyat → Liste', loader: 'loadShipments' },
  'settings': { title: 'Ayarlar', breadcrumb: 'Sistem → Ayarlar', loader: 'loadSettings' },
  'about': { title: 'Hakkında', breadcrumb: 'Sistem → Hakkında', loader: 'loadAbout' },
  'modules': { title: 'Modüller', breadcrumb: 'Tüm Modüller', loader: 'loadModules' }
};

function navigateTo(page) {
  const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  let permKey = page;
  if (page === 'qc-new') permKey = 'qc';
  if (page === 'qc-list') permKey = 'history';
  if (page === 'stock-move') permKey = 'inventory';
  if (page === 'depo-giris') permKey = 'depo';
  if (page === 'orders') permKey = 'orders';

  // Modüller sayfası her zaman erişilebilir (içindeki modüller zaten filtreleniyor)
  const publicPages = ['dashboard', 'modules', 'about'];
  if (!publicPages.includes(page) && !isAdmin && !perms.includes(permKey)) {
    toast('Bu sayfaya erişim yetkiniz yok', 'error');
    return;
  }

  currentPage = page;
  const cfg = pageConfig[page];
  if (!cfg) return;

  document.getElementById('pageTitle').textContent = cfg.title;
  document.getElementById('pageBreadcrumb').textContent = cfg.breadcrumb;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Destroy charts
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch (e) { } });
  chartInstances = {};

  const content = document.getElementById('contentArea');
  // Her sayfa geçişinde overflow ve padding sıfırla
  content.style.overflow = '';
  content.style.padding = '20px';
  content.innerHTML = '<div class="spinner"></div>';
  content.style.animation = 'none';
  content.offsetHeight;
  content.style.animation = 'fadeUp .35s ease';

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');

  // Call loader function by name from global scope
  const loaderFn = window[cfg.loader];
  if (typeof loaderFn === 'function') {
    loaderFn();
  } else {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Sayfa yüklenemedi</div></div>';
  }
}


function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function toggleCollapse() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
}

// Restore sidebar state on load
(function () {
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    document.getElementById('sidebar')?.classList.add('collapsed');
  }
})();


// ═══════════════════════════════
//  TOAST
// ═══════════════════════════════
function toast(msg, type = 'success') {
  if (isMuted && type !== 'error') return; // Sadece hataları göster sessizdeyken
  const container = document.getElementById('toastContainer');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span style="font-size:16px;font-weight:700">${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    t.style.transition = '.3s';
    setTimeout(() => t.remove(), 300);
  }, 1200);
}

// ═══════════════════════════════
//  MODAL
// ═══════════════════════════════
function openModal(title, bodyHtml, width = '600px') {
  const card = document.querySelector('.modal-card');
  if (card) card.style.width = width;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

// ═══════════════════════════════
//  HELPERS
// ═══════════════════════════════
function fabricTypeOptions(selected = '') {
  return `<option value="">Seçiniz</option>` + fabricTypes.map(ft =>
    `<option value="${ft.id}" ${ft.id == selected ? 'selected' : ''}>${ft.name}</option>`
  ).join('');
}
function defectTypeOptions(selected = '') {
  return `<option value="">Hata Seçin</option>` + defectTypes.map(dt =>
    `<option value="${dt.id}" ${dt.id == selected ? 'selected' : ''}>${dt.name}</option>`
  ).join('');
}
function productOptions(selected = '') {
  return `<option value="">Seçiniz</option>` + products.map(p =>
    `<option value="${p.id}" ${p.id == selected ? 'selected' : ''}>${p.code} — ${p.name}</option>`
  ).join('');
}
function decisionBadge(d) {
  if (d === '1. Kalite') return `<span class="badge badge-teal">${d}</span>`;
  if (d === '2. Kalite') return `<span class="badge badge-yellow">${d}</span>`;
  if (d === 'Parça') return `<span class="badge badge-purple">${d}</span>`;
  return `<span class="badge badge-red">${d}</span>`;
}
function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ═══════════════════════════════
//  DASHBOARD
function loadAnaliz() {
  const content = document.getElementById("contentArea");
  content.style.padding = "0";
  content.style.overflow = "hidden";
  // Mevcut temayı al (body class'ından)
  let currentTheme = 'dark';
  const bodyClass = document.body.className;
  const match = bodyClass.match(/theme-([a-zA-Z0-9]+)/);
  if (match) currentTheme = match[1];
  let src = `analiz.php?theme=${encodeURIComponent(currentTheme)}`;
  if (window._editProductId) {
    src += `&product_id=${window._editProductId}`;
    delete window._editProductId;
  }
  content.innerHTML = `<iframe id="analizFrame" src="${src}" style="width:100%; height:100vh; height:100dvh; border:none; background:var(--bg);"></iframe>`;
}


async function loadDashboard() {
  try {
    const res = await api('dashboard_stats');
    const content = document.getElementById('contentArea');
    const formatNum = (v, d = 1) => typeof fmt === 'function' ? fmt(v, d) : Number(v).toLocaleString('tr-TR');
    content.innerHTML = `
      <!-- CRITICAL ALERTS BAR -->
      ${res.delayed_orders > 0 || res.low_warp_looms > 0 || (res.total_looms - res.active_looms) > 0 ? `
      <div style="background:rgba(255,80,80,0.1); border-left:4px solid var(--danger); padding:12px 20px; border-radius:8px; margin-bottom:25px; display:flex; align-items:center; gap:20px; animation:pulse-red 2s infinite">
        <div style="font-size:24px">⚠️</div>
        <div style="flex:1">
          <div style="font-weight:700; color:var(--danger); font-size:14px">DİKKAT: Müdahale Gerektiren Durumlar</div>
          <div style="font-size:12px; color:var(--text)">${res.delayed_orders > 0 ? `• <b>${res.delayed_orders} sipariş</b> teslim tarihini geçti! ` : ''} ${res.low_warp_looms > 0 ? `• <b>${res.low_warp_looms_list.join(' - ')} nolu tezgahlar</b> çözgüleri bitiyor! ` : ''} ${ (res.total_looms - res.active_looms) > 0 ? `• <b>${res.total_looms - res.active_looms} tezgah</b> şu an duruşta.` : ''}</div>
        </div>
        <div style="display:flex; gap:8px; flex-shrink:0">
          ${res.delayed_orders > 0 ? `<button class="btn btn-sm btn-danger" onclick="navigateTo('orders')">📋 Sipariş Detay</button>` : ''}
          ${res.low_warp_looms > 0 || (res.total_looms - res.active_looms) > 0 ? `<button class="btn btn-sm btn-danger" onclick="navigateTo('looms')">🏗️ Tezgah Detay</button>` : ''}
        </div>
      </div>
      ` : ''}

      <!-- PULSE DASHBOARD (Premium Stats) -->
      <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:20px; margin-bottom:30px">
        <div class="kpi-card" style="background:linear-gradient(135deg, #1e293b, #0f172a); border:1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-label" style="color:#94a3b8">TOPLAM CİRO DENGESİ</div>
            <div style="font-size:20px">💰</div>
          </div>
          <div class="kpi-value" style="font-size:24px; color:#fff; margin:10px 0">${Number(res.net_balance).toLocaleString('tr-TR')} <span style="font-size:14px">₺</span></div>
          <div style="font-size:11px; color:#64748b">Alacak/Borç Net Durumu</div>
        </div>
        
        <div class="kpi-card" style="background:linear-gradient(135deg, #064e3b, #022c22); border:1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-label" style="color:#6ee7b7">EN DEĞERLİ MÜŞTERİ</div>
            <div style="font-size:20px">🏆</div>
          </div>
          <div class="kpi-value" style="font-size:18px; color:#fff; margin:10px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${res.top_customer}</div>
          <div style="font-size:11px; color:#34d399">En yüksek sipariş hacmi</div>
        </div>

        <div class="kpi-card" style="background:linear-gradient(135deg, #4c1d95, #2e1065); border:1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-label" style="color:#c4b5fd">YILDIZ TEZGAH</div>
            <div style="font-size:20px">🌟</div>
          </div>
          <div class="kpi-value" style="font-size:22px; color:#fff; margin:10px 0">${res.top_loom}</div>
          <div style="font-size:11px; color:#a78bfa">Haftalık verimlilik şampiyonu</div>
        </div>

        <div class="kpi-card" style="background:linear-gradient(135deg, #1e3a8a, #172554); border:1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-label" style="color:#93c5fd">FABRİKA DOLULUK</div>
            <div style="font-size:20px">⚙️</div>
          </div>
          <div class="kpi-value" style="font-size:24px; color:#fff; margin:10px 0">%${res.total_looms > 0 ? Math.round((res.active_looms / res.total_looms) * 100) : 0}</div>
          <div style="font-size:11px; color:#60a5fa">${res.active_looms}/${res.total_looms} Tezgah Çalışıyor</div>
        </div>

        <div class="kpi-card" style="background:linear-gradient(135deg, #0f172a, #1e1b4b); border:1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3); cursor:pointer" onclick="navigateTo('orders')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-label" style="color:#a5b4fc">AÇIK SİPARİŞLER</div>
            <div style="font-size:20px">📋</div>
          </div>
          <div class="kpi-value" style="font-size:24px; color:#fff; margin:10px 0">${res.open_orders}</div>
          <div style="font-size:11px; color:#818cf8">Aktif Sipariş & Proje</div>
        </div>

        <div class="kpi-card" style="background:${res.delayed_orders > 0 ? 'linear-gradient(135deg, #7f1d1d, #450a0a)' : 'linear-gradient(135deg, #1e293b, #0f172a)'}; border:1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3); cursor:pointer" onclick="navigateTo('orders')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div class="kpi-label" style="color:${res.delayed_orders > 0 ? '#fca5a5' : '#94a3b8'}">GECİKEN SİPARİŞLER</div>
            <div style="font-size:20px">⚠️</div>
          </div>
          <div class="kpi-value" style="font-size:24px; color:#fff; margin:10px 0">${res.delayed_orders}</div>
          <div style="font-size:11px; color:${res.delayed_orders > 0 ? '#f87171' : '#64748b'}">${res.delayed_orders > 0 ? 'Teslim tarihi geçenler!' : 'Gecikme yok'}</div>
        </div>
      </div>

      <!-- SİPARİŞ TAKİP & İLERLEME PANELİ -->
      <div class="panel" style="border:none; background:var(--surface); box-shadow:var(--shadow); margin-bottom:30px">
        <div class="panel-head" style="background:transparent; border-bottom:1px solid var(--border)">
          <span class="panel-title" style="color:var(--text); font-weight:700">📋 Sipariş Takip & İlerleme Paneli (Aktif 5 Sipariş)</span>
          <span class="panel-action" onclick="navigateTo('orders')">Tüm Siparişler</span>
        </div>
        <div class="panel-body" style="padding:0; overflow-x:auto">
          <table class="boss-table" id="dashboardOrdersTable">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri</th>
                <th>Ürün / Kumaş</th>
                <th>Termin</th>
                <th>Sevk İlerlemesi</th>
                <th>Sevk / Sipariş</th>
                <th>Kalan</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${res.dashboard_orders && res.dashboard_orders.length ? res.dashboard_orders.map(o => {
                const shipped = parseFloat(o.shipped_m || 0);
                const ordered = parseFloat(o.quantity_m || 0);
                const ready = parseFloat(o.ready_m || 0);
                const remaining = Math.max(0, ordered - shipped);
                const pct = ordered > 0 ? Math.min(100, (shipped / ordered) * 100) : 0;
                
                let statColor = 'var(--text3)';
                if (o.status === 'Açık' || o.status === 'Üretimde') statColor = 'var(--warning)';
                if (o.status === 'Tamamlandı') statColor = 'var(--accent)';
                
                const barColor = pct >= 100 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--text3)';
                const deadlineStr = o.deadline_date ? o.deadline_date.split('-').reverse().join('.') : '-';
                
                const today = new Date().toISOString().split('T')[0];
                const isDelayed = o.deadline_date && o.deadline_date < today && o.status !== 'Tamamlandı' && o.status !== 'İptal';
                
                return `
                  <tr style="${isDelayed ? 'background:rgba(239,68,68,.06)' : ''}; cursor:pointer; transition:background 0.2s" onclick="openOrderDetail(${o.id})" class="dashboard-order-row">
                    <td>
                      <span style="font-weight:700; color:var(--text)">${o.order_no}</span>
                      ${isDelayed ? '<span style="display:inline-block;background:var(--danger);color:#fff;font-size:9px;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:4px">GECİKMİŞ</span>' : ''}
                    </td>
                    <td style="color:var(--text2)">${o.customer_name || '-'}</td>
                    <td style="color:var(--text2); font-size:11px">${o.product_code || '-'} - ${o.product_name || '-'}</td>
                    <td style="font-size:11px">${deadlineStr}</td>
                    <td style="min-width:120px">
                      <div style="background:var(--surface3);border-radius:4px;height:8px;overflow:hidden;position:relative;width:100%">
                        <div style="background:${barColor};height:100%;width:${pct}%;border-radius:4px;transition:width .3s"></div>
                      </div>
                      <div style="font-size:10px;color:var(--text3);text-align:right;margin-top:2px">%${pct.toFixed(0)}</div>
                    </td>
                    <td style="font-weight:700">${formatNum(shipped)} / ${formatNum(ordered)} mt${ready > 0 ? `<span style="font-size:9px;color:var(--warning)"> (+${formatNum(ready)} haz)</span>` : ''}</td>
                    <td style="color:${remaining > 0 ? 'var(--danger)' : 'var(--accent)'}; font-weight:700">${formatNum(remaining)} mt</td>
                    <td><span style="font-weight:700; color:${statColor}">${o.status}</span></td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text3)">Aktif sipariş bulunmuyor.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2" style="gap:25px">
        <!-- SOL PANEL: ANALİZLER -->
        <div style="display:flex; flex-direction:column; gap:25px">
           <div class="panel" style="border:none; background:var(--surface); box-shadow:var(--shadow)">
            <div class="panel-head" style="background:transparent; border-bottom:1px solid var(--border)">
              <span class="panel-title" style="color:var(--text); font-weight:700">📈 Kalite Performans Grafiği</span>
            </div>
            <div class="panel-body"><canvas id="chartQualityTrend" height="250"></canvas></div>
          </div>
          
          <div class="panel" style="border:none; background:var(--surface); box-shadow:var(--shadow)">
            <div class="panel-head" style="background:transparent; border-bottom:1px solid var(--border)">
              <span class="panel-title" style="color:var(--text); font-weight:700">🔴 Kritik Hata Dağılımı</span>
            </div>
            <div class="panel-body"><canvas id="chartDefectDist" height="250"></canvas></div>
          </div>
        </div>

        <!-- SAĞ PANEL: CANLI AKIŞ -->
        <div style="display:flex; flex-direction:column; gap:25px">
          <div class="panel" style="border:none; background:var(--surface); box-shadow:var(--shadow)">
            <div class="panel-head" style="background:transparent; border-bottom:1px solid var(--border)">
              <span class="panel-title" style="color:var(--text); font-weight:700">🔍 Son Üretilen Kaliteler</span>
              <span class="panel-action" onclick="navigateTo('qc-list')">Raporun Tamamı</span>
            </div>
            <div class="panel-body" style="padding:0">
              <table class="boss-table">
                <thead><tr><th>TOP NO</th><th>KALİTE</th><th>PUAN</th><th>DURUM</th></tr></thead>
                <tbody>${res.recent_controls.length ? res.recent_controls.map(c => `
                  <tr>
                    <td><div style="font-weight:700">#${c.roll_no}</div><div style="font-size:10px; color:var(--text3)">${fmtDate(c.control_date)}</div></td>
                    <td style="font-size:11px; color:var(--text2)">${c.fabric_type_name || 'Standart'}</td>
                    <td>
                      <div style="font-weight:800; color:${c.quality_score >= 85 ? 'var(--accent)' : c.quality_score >= 70 ? 'var(--warning)' : 'var(--danger)'}">%${Number(c.quality_score).toFixed(0)}</div>
                    </td>
                    <td>${decisionBadge(c.decision)}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align:center; padding:40px">Veri bekleniyor...</td></tr>'}</tbody>
              </table>
            </div>
          </div>

          <div class="panel" style="border:none; background:var(--surface); box-shadow:var(--shadow)">
            <div class="panel-head" style="background:transparent; border-bottom:1px solid var(--border)">
              <span class="panel-title" style="color:var(--text); font-weight:700">🔄 Stok Hareket Akışı</span>
              <span class="panel-action" onclick="navigateTo('stock-move')">Tüm Hareketler</span>
            </div>
            <div class="panel-body" style="padding:0">
              <table class="boss-table">
                <thead><tr><th>ÜRÜN</th><th>MİKTAR</th><th>İŞLEM</th></tr></thead>
                <tbody>${res.recent_stock_moves.length ? res.recent_stock_moves.map(m => `
                  <tr>
                    <td><div style="font-weight:600; font-size:11px">${m.product_name}</div><div style="font-size:10px; color:var(--text3)">${m.product_code}</div></td>
                    <td style="font-weight:800; color:${m.type === 'Giriş' ? 'var(--accent)' : 'var(--danger)'}">${m.type === 'Giriş' ? '+' : '-'}${Number(m.quantity).toLocaleString('tr-TR')}</td>
                    <td><span style="font-size:10px; padding:3px 8px; border-radius:10px; background:${m.type === 'Giriş' ? 'rgba(0,212,170,0.1)' : 'rgba(255,80,80,0.1)'}; color:${m.type === 'Giriş' ? 'var(--accent)' : 'var(--danger)'}; font-weight:700">${m.type.toUpperCase()}</span></td>
                  </tr>
                `).join('') : '<tr><td colspan="3" style="text-align:center; padding:40px">Hareket yok.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style>
        .boss-table { width:100%; border-collapse:collapse; }
        .boss-table th { text-align:left; padding:12px 15px; font-size:10px; color:var(--text3); border-bottom:1px solid var(--border); text-transform:uppercase; letter-spacing:1px; }
        .boss-table td { padding:12px 15px; border-bottom:1px solid var(--border); vertical-align:middle; }
        .boss-table tr:last-child td { border-bottom:none; }
        .boss-table tbody tr:hover { background: rgba(255, 255, 255, 0.03); }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255,80,80,0.4); } 70% { box-shadow: 0 0 0 10px rgba(255,80,80,0); } 100% { box-shadow: 0 0 0 0 rgba(255,80,80,0); } }
      </style>
    `;

    // Quality Trend Chart
    if (res.quality_trend.length > 0) {
      const ctx1 = document.getElementById('chartQualityTrend');
      chartInstances.trend = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: res.quality_trend.map(d => new Date(d.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })),
          datasets: [{
            label: 'Kalite Puanı',
            data: res.quality_trend.map(d => Number(d.avg_score).toFixed(1)),
            borderColor: '#00d4aa',
            backgroundColor: 'rgba(0,212,170,.1)',
            fill: true,
            tension: .4,
            pointRadius: 4,
            pointBackgroundColor: '#00d4aa'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#555d76', font: { size: 10 } }, grid: { color: 'rgba(42,48,64,.5)' } },
            y: { min: 0, max: 100, ticks: { color: '#555d76', font: { size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(42,48,64,.5)' } }
          }
        }
      });
    }

    // Defect Distribution Chart
    if (res.defect_distribution.length > 0) {
      const ctx2 = document.getElementById('chartDefectDist');
      const colors = ['#00d4aa', '#7c5cfc', '#4f7cff', '#ff5c6c', '#ffb347', '#a855f7', '#06b6d4', '#f43f5e'];
      chartInstances.defects = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: res.defect_distribution.map(d => d.name),
          datasets: [{
            data: res.defect_distribution.map(d => d.total),
            backgroundColor: colors.slice(0, res.defect_distribution.length),
            borderColor: '#12151c', borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: '#8b92a8', padding: 12, font: { size: 11 } } } }
        }
      });
    }
  } catch (e) {
    document.getElementById('contentArea').innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><div class="empty-text">${e.message}</div></div>`;
  }
}

// ═══════════════════════════════
//  QUALITY CONTROL — NEW
// ═══════════════════════════════
function loadQCNew() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px">
      <!-- ÜST BÖLÜM: BİLGİ VE FORM -->
      <div class="grid-qc" style="display:grid; align-items: start; gap: 20px">
        
        <!-- SOL: TEZGAH & İŞ DURUMU -->
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">🏗️ Tezgah ve İş Durumu</span>
          </div>
          <div class="panel-body">
            <div class="form-floating form-full" style="margin-bottom: 20px">
              <select id="qcLoomId" required onchange="onQCLoomChange(this.value)">
                <option value="">Lütfen Tezgah Seçiniz...</option>
              </select>
              <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Aktif Tezgah *</label>
            </div>

            <div id="loomInfoCard" style="display:none">
              <div class="info-row"><span class="info-label">Çalışan Ürün:</span><span class="info-value" id="qcProductDisplay">-</span></div>
              <div class="info-row"><span class="info-label">Müşteri:</span><span class="info-value" id="qcCustomerDisplay">-</span></div>
              <div class="info-row"><span class="info-label">Aktif LOT:</span><span class="info-value" id="loomLotDisplay" style="color:var(--warning)">-</span></div>
              <div class="info-row"><span class="info-label">Tezgah Sayacı:</span><span class="info-value" id="currentLoomM" style="color:var(--accent)">0 mt</span></div>
              <div class="info-row"><span class="info-label">Çözgü Toplam:</span><span class="info-value" id="warpTotal">0 mt</span></div>
              <div class="info-row" style="border-bottom:none"><span class="info-label">Kalan Çözgü:</span><span class="info-value" id="warpRemaining" style="color:var(--warning)">0 mt</span></div>
              
              <div style="margin-top:20px; padding:12px; background:var(--surface2); border-radius:var(--radius-sm); border:1px solid var(--border)">
                <div style="font-size:10px; color:var(--text3); font-weight:700; margin-bottom:4px">OTOMATİK BARKOD</div>
                <input type="text" id="qcRollNo" readonly style="background:transparent; border:none; color:var(--text2); font-family:monospace; font-size:14px; width:100%; outline:none">
              </div>

              <!-- SIRADAKİ İŞ PLANI -->
              <div id="nextJobCard" style="display:none; margin-top:20px; border-top:1px dashed var(--border); padding-top:20px">
                <div style="font-size:10px; color:var(--warning); font-weight:800; margin-bottom:10px; text-transform:uppercase; display:flex; align-items:center; gap:6px">
                  <span>📅 SIRADAKİ İŞ PLANI</span>
                  <div style="flex:1; height:1px; background:var(--border)"></div>
                </div>
                <div class="info-row"><span class="info-label">Sıradaki Ürün:</span><span class="info-value" id="nextProductDisplay" style="color:var(--text)">-</span></div>
                <div class="info-row"><span class="info-label">Sıradaki Müşteri:</span><span class="info-value" id="nextCustomerDisplay">-</span></div>
                <div class="info-row"><span class="info-label">Sıradaki LOT:</span><span class="info-value" id="nextLotDisplay" style="color:var(--warning)">-</span></div>
                <div class="info-row" style="border-bottom:none"><span class="info-label">Notlar:</span><span class="info-value" id="nextNotesDisplay" style="font-size:11px; font-style:italic">-</span></div>
                
                <button type="button" class="btn btn-secondary btn-sm" style="width:100%; margin-top:15px; border-color:var(--warning); color:var(--warning); background:rgba(255,152,0,0.05)" onclick="switchToNextJob()">🚀 SIRADAKİ İŞE BAŞLA</button>
              </div>
            </div>

            <div id="loomPlaceholder" style="padding:40px 0; text-align:center; color:var(--text3)">
               <div style="font-size:32px; margin-bottom:10px">🏗️</div>
               <div style="font-size:13px">Bilgileri görmek için tezgah seçiniz.</div>
            </div>
          </div>
        </div>

        <!-- SAĞ: KALİTE KONTROL FORMU -->
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">🔍 Kalite Kontrol Girişi</span>
          </div>
          <div class="panel-body">
            <form id="qcForm" onsubmit="submitQC(event)">
              <!-- SAYAÇ STİLİ GİRİŞLER -->
              <div class="qc-entry-grid">
                <div class="qc-entry-cell">
                  <span class="qc-entry-label">Metre (MT)</span>
                  <input type="number" id="qcLength" class="qc-entry-input" required step="0.1" placeholder="0.0" oninput="calcQCMath()">
                </div>
                <div class="qc-entry-cell">
                  <span class="qc-entry-label">Kilo (KG)</span>
                  <input type="number" id="qcWeight" class="qc-entry-input" required step="0.1" placeholder="0.0" oninput="calcQCMath()">
                </div>
                <div class="qc-entry-cell">
                  <span class="qc-entry-label">En (CM)</span>
                  <input type="number" id="qcWidth" class="qc-entry-input" required step="1" placeholder="0" oninput="calcQCMath()">
                </div>
              </div>

              <!-- ÖZET BİLGİ -->
              <div class="qc-summary-bar">
                <div class="qc-summary-item">
                  <span class="qc-summary-label">GRAMAJ</span>
                  <span class="qc-summary-value" id="displayGPM">0 g/mt</span>
                </div>
                <div class="qc-summary-item" style="text-align:right">
                   <span class="qc-summary-label">KALİTE PUANI</span>
                   <span class="qc-summary-value" id="displayScore" style="color:var(--accent2)">%100.0</span>
                </div>
              </div>

              <div class="form-section" style="margin-top:0">🔴 Tespit Edilen Hatalar</div>
              <div id="defectRows"></div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="addDefectRow()">+ Hata Ekle</button>

              <div class="form-grid" style="margin-top:20px">
                <div class="form-floating">
                  <select id="qcDecision" required onchange="onDecisionChange(this.value)">
                    ${['1. Kalite', '2. Kalite', 'Parça', 'Fire'].map(v => `<option value="${v}">${v}</option>`).join('')}
                  </select>
                  <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Karar *</label>
                </div>
                <div class="form-floating">
                  <input type="number" id="qcScore" value="100" min="0" max="100" step="0.1" oninput="document.getElementById('displayScore').textContent='%'+Number(this.value).toFixed(1)">
                  <label>Puan (%)</label>
                </div>
              </div>

              <div style="margin-top:15px; padding:12px; background:var(--surface2); border-radius:var(--radius-sm); border:1px solid var(--border)">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
                  <div style="font-size:12px; font-weight:700; color:var(--text2)">📐 Çözgü Düşüm Kaynağı</div>
                  <div style="font-size:11px; color:var(--text3)">Mevcut Sayaç: <strong id="currentLoomMeterDisplay" style="color:var(--accent)">—</strong> mt</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px">
                  <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text2); cursor:pointer">
                    <input type="radio" name="qcWarpDeduction" value="counter" onchange="updateWarpDeductionSetting(this.value)">
                    Makine Sayacı Üzerinden Düş (Önerilen)
                  </label>
                  <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text2); cursor:pointer">
                    <input type="radio" name="qcWarpDeduction" value="qc" onchange="updateWarpDeductionSetting(this.value)">
                    Kalite Kontrol (Gerçek Top Metresi) Üzerinden Düş
                  </label>
                </div>
              </div>

              <div class="form-actions" style="margin-top:20px; gap:8px">
                <button type="button" class="btn btn-secondary" style="flex:1" onclick="navigateTo('qc-list')">İptal</button>
                <button type="button" class="btn btn-secondary" style="border-color:var(--accent); color:var(--accent); background:rgba(0,212,170,0.03)" onclick="printCurrentQC()">🖨️ YAZDIR</button>
                <button type="submit" class="btn btn-primary" style="flex:2">✓ TOPU KAYDET</button>
              </div>
              
              <input type="hidden" id="qcProductId">
              <input type="hidden" id="qcFabricTypeId">
            </form>
          </div>
        </div>
      </div>

      <!-- ALT BÖLÜM: SON SARILAN TOPLAR -->
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">🕒 Son Sarılan Toplar (Bu Tezgahta)</span>
        </div>
        <div class="panel-body" style="padding:0; overflow-x:auto">
           <table>
              <thead><tr><th>Top No</th><th>MT</th><th>KG</th><th>G/MT</th><th>Karar</th><th>Puan</th><th>Tarih</th><th>İşlem</th></tr></thead>
              <tbody id="qcRecentTable">
                 <tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text3)">Lütfen yukarıdan bir tezgah seçiniz.</td></tr>
              </tbody>
           </table>
        </div>
      </div>
    </div>
  `;

  loadQCLooms();
}

async function loadQCLooms() {
  try {
    const res = await api('looms');
    const select = document.getElementById('qcLoomId');
    select.innerHTML = '<option value="">Lütfen Tezgah Seçiniz...</option>' +
      res.data.map(l => `<option value="${l.id}">${l.name} (${l.product_code || 'Ürün Yok'})</option>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function switchToNextJob() {
  const nextCard = document.getElementById('nextJobCard');
  if (!nextCard || !nextCard.dataset.loomData) return;

  const l = JSON.parse(nextCard.dataset.loomData);
  if (!confirm(`${l.name} tezgahını sıradaki işe ([${l.next_product_code}] ${l.next_product_name}) geçirmek istiyor musunuz? \n\nNot: Mevcut üretim sıfırlanacaktır.`)) return;

  try {
    const data = {
      ...l,
      product_id: l.next_product_id,
      customer_id: l.next_customer_id,
      order_id: l.next_order_id,
      lot_no: l.next_lot_no || '', 
      notes: l.next_job_notes,
      current_meters: 0,
      yesterday_meters: 0,
      daily_meters: 0,
      warp_start_meter: 0,
      qc_consumed_meters: 0,
      // Clear next job fields
      next_product_id: null,
      next_customer_id: null,
      next_order_id: null,
      next_lot_no: '',
      next_job_notes: ''
    };

    await api('looms', data, 'POST');
    toast('İş değişimi başarıyla yapıldı');
    onQCLoomChange(l.id); // Refresh view
  } catch (e) { toast(e.message, 'error'); }
}

async function onQCLoomChange(id) {
  if (!id) {
    document.getElementById('loomInfoCard').style.display = 'none';
    document.getElementById('loomPlaceholder').style.display = 'block';
    return;
  }
  try {
    const res = await api('looms');
    const l = res.data.find(x => x.id == id);
    if (!l) return;

    // Fill Display Fields
    document.getElementById('qcProductDisplay').textContent = l.product_name || 'Tanımsız Ürün';
    document.getElementById('qcCustomerDisplay').textContent = l.customer_name || 'Müşteri Atanmamış';
    document.getElementById('qcWidth').value = l.product_width || 160;
    document.getElementById('qcProductId').value = l.product_id || '';
    document.getElementById('qcFabricTypeId').value = l.fabric_type_id || '';

    // Loom Card
    document.getElementById('loomInfoCard').style.display = 'block';
    document.getElementById('loomPlaceholder').style.display = 'none';

    document.getElementById('loomLotDisplay').textContent = l.lot_no || '-';
    document.getElementById('currentLoomM').textContent = Number(l.current_meters).toFixed(1) + ' mt';
    document.getElementById('warpTotal').textContent = l.warp_total + ' mt';

    // Sayaç gösterge panelini güncelle
    const meterDisplay = document.getElementById('currentLoomMeterDisplay');
    if (meterDisplay) meterDisplay.textContent = Number(l.current_meters).toFixed(1);

    // Radyo butonlarını ayara göre seç
    const radios = document.querySelectorAll('input[name="qcWarpDeduction"]');
    radios.forEach(r => {
      if (r.value === (appSettings.warp_deduction || 'counter')) {
        r.checked = true;
      }
    });

    const consumed = getWarpConsumed(l);
    const remaining = Math.max(0, l.warp_total - consumed);
    document.getElementById('warpRemaining').textContent = remaining.toFixed(1) + ' mt';

    // Sıradaki İş Bilgisi
    const nextCard = document.getElementById('nextJobCard');
    if (l.next_product_name) {
      nextCard.style.display = 'block';
      document.getElementById('nextProductDisplay').textContent = `[${l.next_product_code || ''}] ${l.next_product_name}`;
      document.getElementById('nextCustomerDisplay').textContent = l.next_customer_name || '-';
      document.getElementById('nextLotDisplay').textContent = l.next_lot_no || '-';
      document.getElementById('nextNotesDisplay').textContent = l.next_job_notes || '-';
      
      // Store current loom data for switching
      nextCard.dataset.loomData = JSON.stringify(l);
    } else {
      nextCard.style.display = 'none';
    }

    // Barkod sunucuda üretilecek, input'u temizle
    document.getElementById('qcRollNo').value = '';

    // Load recent for this loom
    loadQCRecent(id);
  } catch (e) { toast(e.message, 'error'); }
}

function calcQCMath() {
  const mt = parseFloat(document.getElementById('qcLength').value) || 0;
  const kg = parseFloat(document.getElementById('qcWeight').value) || 0;

  const gpm = (mt > 0) ? (kg * 1000) / mt : 0;
  document.getElementById('displayGPM').textContent = gpm.toFixed(0) + ' g/mt';
}

function printRollLabel(r, onlyPreview = false) {
  const date = r.control_date ? fmtDate(r.control_date) : new Date().toLocaleDateString('tr-TR');
  const bW = appSettings.barcode_width || '100';
  const bH = Math.max(80, parseInt(appSettings.barcode_height) || 100);

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    toast('Pop-up engellendi. Lütfen tarayıcınızın pop-up engelleyicisini bu site için devre dışı bırakın.', 'warning');
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>Barkod Yazdır - ${r.roll_no}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: ${bW}mm ${bH}mm; margin: 0; }
          body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            padding: 2mm; 
            text-align: center; 
            color: #000; 
            margin: 0; 
            background: #fff;
          }
          .label-box { 
            border: 1mm solid #000; 
            height: 100%; 
            display: flex; 
            flex-direction: column; 
            padding: 2mm; 
            box-sizing: border-box; 
            position: relative;
            page-break-inside: avoid;
          }
          .brand-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-bottom: 4px;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
          }
          .header-text { 
            font-size: 12px; 
            font-weight: 800; 
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .barcode-wrapper { 
            margin: 6px 0;
            display: flex;
            justify-content: center;
          }
          #barcode { 
            max-width: 100%; 
            height: auto;
          }
          .metrics-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            border: 1px solid #000;
            border-radius: 6px;
            overflow: hidden;
            margin-top: auto;
          }
          .m-item { 
            padding: 6px 0;
            border-right: 1px solid #000;
          }
          .m-item:last-child { border-right: none; }
          .m-label { 
            font-size: 11px; 
            font-weight: 700; 
            color: #666; 
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .m-val { 
            font-size: 19px; 
            font-weight: 900; 
          }
          .footer-info { 
            margin-top: 6px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            font-size: 12px; 
            font-weight: 600;
          }
          .decision-tag {
            border: 1px solid #000;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 800;
          }
          .info-row { display: flex; align-items: center; gap: 6px; margin: 2px 0; flex-wrap: wrap; justify-content: center; }
          .info-label { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-value { font-size: 15px; font-weight: 700; color: #000; }
          .info-sep { color: #ccc; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="label-box">
          <div class="brand-header">
            <div class="header-text">Kalite Kontrol Etiketi</div>
          </div>
          
          <div class="content">
            <div class="info-row">
              <span class="info-label">Kalite Adı:</span>
              <span class="info-value">${r.product_name || r.product_code || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Lot No:</span>
              <span class="info-value">${r.lot_no || '-'}</span>
              <span class="info-sep">|</span>
              <span class="info-label">Tezgah:</span>
              <span class="info-value">${r.loom_name || '-'}</span>
            </div>
            
            <div class="barcode-wrapper">
              <svg id="barcode"></svg>
            </div>
          </div>
          
          <div class="metrics-grid">
            <div class="m-item">
              <div class="m-label">Metraj</div>
              <div class="m-val">${r.length_m || '0'}<small style="font-size:13px;margin-left:2px">mt</small></div>
            </div>
            <div class="m-item">
              <div class="m-label">Ağırlık</div>
              <div class="m-val">${r.weight_kg || '0'}<small style="font-size:13px;margin-left:2px">kg</small></div>
            </div>
          </div>
          
          <div class="footer-info">
            <span>Tarih: ${date}</span>
            <span class="decision-tag">${r.decision.toUpperCase()}</span>
          </div>
        </div>
        <script>
          JsBarcode("#barcode", "${r.roll_no}", {
            format: "CODE128",
            width: 2.5,
            height: 35,
            displayValue: true,
            fontSize: 17,
            fontOptions: "bold",
            margin: 0
          });
          ${onlyPreview ? '' : 'window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };'}
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function printCurrentQC() {
  const loomSelect = document.getElementById('qcLoomId');
  const r = {
    roll_no: document.getElementById('qcRollNo').value,
    product_name: document.getElementById('qcProductDisplay').textContent,
    lot_no: document.getElementById('loomLotDisplay').textContent,
    loom_name: loomSelect.selectedOptions[0]?.text || '-',
    length_m: document.getElementById('qcLength').value || '0',
    weight_kg: document.getElementById('qcWeight').value || '0',
    decision: document.getElementById('qcDecision').value,
    control_date: null
  };
  printRollLabel(r);
}

function printQCFromHistory(rollId, onlyPreview = false) {
  api('quality_controls', { search: rollId }).then(res => {
    const r = res.data.find(x => x.id == rollId || x.roll_no == rollId);
    if (r) printRollLabel(r, onlyPreview);
    else toast('Top bulunamadı', 'error');
  }).catch(e => toast(e.message, 'error'));
}

async function loadQCRecent(loomId) {
  try {
    const res = await api('quality_controls', { limit: 20 });
    const my = res.data.filter(x => x.loom_id == loomId);
    const tbody = document.getElementById('qcRecentTable');
    if (!my.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text3)">Henüz kontrol kaydı yok.</td></tr>';
      return;
    }
    const totalMt = my.reduce((s, r) => s + parseFloat(r.length_m || 0), 0);
    const totalKg = my.reduce((s, r) => s + parseFloat(r.weight_kg || 0), 0);

    tbody.innerHTML = my.map(r => `
      <tr>
        <td style="font-weight:600; color:var(--text)">${r.roll_no}</td>
        <td style="font-weight:700; color:var(--accent)">${r.length_m} mt</td>
        <td>${r.weight_kg || '0'} kg</td>
        <td style="color:var(--text3)">${r.length_m > 0 ? ((r.weight_kg * 1000) / r.length_m).toFixed(0) : '0'}</td>
        <td>${decisionBadge(r.decision)}</td>
        <td style="font-weight:700; color:${r.quality_score >= 85 ? 'var(--accent)' : r.quality_score >= 70 ? 'var(--warning)' : 'var(--danger)'}">%${Number(r.quality_score).toFixed(1)}</td>
        <td style="font-size:11px">${fmtDate(r.control_date)}</td>
        <td style="text-align:right">
           <div style="display:flex; gap:4px; justify-content:flex-end">
             <button class="btn btn-sm btn-secondary btn-icon" onclick="printQCFromHistory(${r.id}, true)" title="Önizle">👁</button>
             <button class="btn btn-sm btn-secondary btn-icon" onclick="printQCFromHistory(${r.id})" title="Barkod Yazdır">🖨️</button>
             <button class="btn btn-sm btn-danger btn-icon" onclick="confirmDeleteRecent(${r.id}, ${loomId})">🗑</button>
           </div>
        </td>
      </tr>
    `).join('') + `
      <tr style="background:rgba(0,212,170,0.05); font-weight:800; border-top:1px solid var(--accent)">
        <td style="color:var(--text2)">GENEL TOPLAM (${my.length} Top)</td>
        <td style="color:var(--accent)">${totalMt.toFixed(1)} mt</td>
        <td style="color:var(--text)">${totalKg.toFixed(1)} kg</td>
        <td colspan="5"></td>
      </tr>
    `;
  } catch { }
}

async function confirmDeleteRecent(id, loomId) {
  openModal('Top Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:24px;color:var(--text)">Bu topu listeden silmek istediğinize emin misiniz?</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button type="button" class="btn btn-danger" onclick="executeDeleteRecent(${id}, ${loomId})">Evet, Sil</button>
      </div>
    </div>
  `);
}

async function executeDeleteRecent(id, loomId) {
  closeModal();
  try {
    await api('quality_control_delete', { id }, 'POST');
    toast('Top silindi');
    loadQCRecent(loomId);
  } catch (e) { toast(e.message, 'error'); }
}

async function submitQC(e) {
  e.preventDefault();
  const defects = [];
  document.querySelectorAll('.defect-row').forEach(r => {
    const typeId = r.querySelector('.defect-type').value;
    if (typeId) {
      defects.push({
        defect_type_id: typeId,
        count: r.querySelector('.defect-count').value,
        severity: r.querySelector('.defect-severity').value
      });
    }
  });

  const mt = parseFloat(document.getElementById('qcLength').value) || 0;
  const width = parseFloat(document.getElementById('qcWidth').value) || 0;
  const m2 = (mt * width) / 100;

  const formData = {
    loom_id: document.getElementById('qcLoomId').value,
    lot_no: document.getElementById('loomLotDisplay').textContent,
    party_no: document.getElementById('loomLotDisplay').textContent,
    fabric_type_id: document.getElementById('qcFabricTypeId').value,
    product_id: document.getElementById('qcProductId').value,
    length_m: mt,
    weight_kg: document.getElementById('qcWeight').value,
    width_cm: width,
    m2: m2.toFixed(2),
    line_m: mt.toFixed(2),
    inspector: currentUser ? currentUser.full_name : '',
    control_date: new Date().toISOString().split('T')[0],
    total_defects: defects.reduce((sum, d) => sum + parseInt(d.count), 0),
    quality_score: document.getElementById('qcScore').value,
    decision: document.getElementById('qcDecision').value,
    notes: '',
    defects: JSON.stringify(defects)
  };

  try {
    toast('Kaydediliyor...', 'info');
    const res = await api('quality_controls', formData, 'POST');
    toast(`✅ Kaydedildi: ${res.barcode || 'Barkod üretildi'}`);
    // Barkodu input'a yaz
    if (res.barcode) {
      document.getElementById('qcRollNo').value = res.barcode;
    }
    // Reload form instead of navigating away to keep workflow fast
    loadQCNew();
    // If you want to navigate: navigateTo('qc-list');
  } catch (e) { toast(e.message, 'error'); }
}

function onDecisionChange(val) {
  // Optional: Add visual feedback when decision changes manually
}


let defectRowCount = 0;
function addDefectRow() {
  defectRowCount++;
  const container = document.getElementById('defectRows');
  const row = document.createElement('div');
  row.className = 'defect-row';
  row.id = `defect-${defectRowCount}`;
  row.innerHTML = `
    <select class="defect-type">${defectTypeOptions()}</select>
    <input type="number" class="defect-count" value="1" min="1" placeholder="Adet">
    <select class="defect-severity">
      <option value="1">Hafif</option>
      <option value="2">Orta</option>
      <option value="3">Ciddi</option>
      <option value="4">Çok Ciddi</option>
    </select>
    <button type="button" class="defect-remove" onclick="this.parentElement.remove();calcScore()">✕</button>
  `;
  container.appendChild(row);
  row.querySelector('.defect-count').addEventListener('change', calcScore);
  row.querySelector('.defect-severity').addEventListener('change', calcScore);
}

function calcScore() {
  const rows = document.querySelectorAll('.defect-row');
  let total = 0;
  rows.forEach(r => {
    const count = parseInt(r.querySelector('.defect-count').value) || 0;
    const severity = parseInt(r.querySelector('.defect-severity').value) || 1;
    total += count * severity;
  });
  const score = Math.max(0, 100 - (total * 2.5));
  document.getElementById('qcScore').value = score.toFixed(1);
  // Auto-set decision
  const dec = document.getElementById('qcDecision');
  if (score >= 85) dec.value = '1. Kalite';
  else if (score >= 70) dec.value = '2. Kalite';
  else if (score >= 50) dec.value = 'Parça';
  else dec.value = 'Fire';
}

async function updateWarpDeductionSetting(value) {
  try {
    const fd = new FormData();
    fd.append('warp_deduction', value);
    await api('settings', fd, 'POST');
    appSettings.warp_deduction = value;

    // Sadece "Kalan Çözgü" rakamını mevcut tezgaha göre güncelle
    const activeLoomId = document.getElementById('qcLoomId')?.value;
    if (activeLoomId) {
      const res = await api('looms');
      const loom = res.data.find(x => x.id == activeLoomId);
      if (loom) {
        const consumed = getWarpConsumed(loom);
        const remaining = Math.max(0, loom.warp_total - consumed);
        const rEl = document.getElementById('warpRemaining');
        if (rEl) rEl.textContent = remaining.toFixed(1) + ' mt';
      }
    }
    toast('Çözgü Düşüm Kaynağı güncellendi', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ═══════════════════════════════
//  QUALITY CONTROL — LIST
// ═══════════════════════════════
async function loadQCList() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div id="qcSummaryCards" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:16px; margin-bottom:24px"></div>

    <div class="filter-bar">
      <input type="text" id="qcSearchInput" placeholder="🔍 Kalite, LOT veya Top No ara..." oninput="filterQCList()">
      <select id="qcFilterDecision" onchange="filterQCList()">
        <option value="">Tüm Kaliteler</option>
        <option value="1. Kalite">1. Kalite</option>
        <option value="2. Kalite">2. Kalite</option>
        <option value="Parça">Parça</option>
        <option value="Fire">Fire</option>
      </select>
      <select id="qcFilterProduct" onchange="filterQCList()">
        <option value="">Tüm Ürünler / Kaliteler</option>
        ${products.map(p => `<option value="${p.id}">${p.code} - ${p.name.substring(0, 20)}</option>`).join('')}
      </select>
      <select id="qcFilterSource" onchange="filterQCList()">
        <option value="">Tüm Kaynaklar</option>
        <option value="0">İç Üretim</option>
        <option value="1">Dış Alım</option>
      </select>
      <input type="date" id="qcFilterFrom" onchange="filterQCList()">
      <input type="date" id="qcFilterTo" onchange="filterQCList()">
      <select id="qcFilterStock" onchange="filterQCList()" style="border-color:var(--accent); color:var(--accent); font-weight:600">
        <option value="">Tüm Stok Durumu</option>
        <option value="1" selected>📦 Stokta Olanlar</option>
        <option value="0">🚚 Sevk Edilenler</option>
      </select>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportQuality()">📥 Excel</button>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('qc-new')">+ Yeni Kontrol</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr>
            <th>ID</th><th>Top No</th><th>LOT No</th><th>Ürün / Kalite</th><th>Tezgah</th><th>Tarih</th>
            <th>Metre</th><th>Kilo</th><th>Durum</th><th>Karar</th><th>İşlem</th>
          </tr></thead>
          <tbody id="qcTableBody"><tr><td colspan="11"><div class="spinner"></div></td></tr></tbody>
          <tfoot id="qcTableFoot" style="background:var(--surface2); font-weight:800; border-top:2px solid var(--border)"></tfoot>
        </table>
      </div>
    </div>
  `;
  filterQCList();
}

async function filterQCList() {
  try {
    const params = {};
    const s = document.getElementById('qcSearchInput')?.value;
    if (s) params.search = s;
    const d = document.getElementById('qcFilterDecision')?.value;
    if (d) params.decision = d;
    const prod = document.getElementById('qcFilterProduct')?.value;
    if (prod) params.product_id = prod;
    const df = document.getElementById('qcFilterFrom')?.value;
    if (df) params.date_from = df;
    const dt = document.getElementById('qcFilterTo')?.value;
    if (dt) params.date_to = dt;
    const stock = document.getElementById('qcFilterStock')?.value ?? '';
    if (stock !== '') params.in_stock = stock;
    const source = document.getElementById('qcFilterSource')?.value ?? '';
    if (source !== '') params.source = source;
    params.limit = 100;

    const res = await api('quality_controls', params);
    const tbody = document.getElementById('qcTableBody');
    const data = res?.data || [];
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Kayıt bulunamadı</div></div></td></tr>';
      const tfoot2 = document.getElementById('qcTableFoot');
      if (tfoot2) tfoot2.innerHTML = '';
      return;
    }
    let grandMeters = 0;
    let grandKg = 0;

    tbody.innerHTML = data.map(c => {
      grandMeters += parseFloat(c.length_m) || 0;
      grandKg += parseFloat(c.weight_kg) || 0;
      return `
      <tr>
        <td style="color:var(--text3)">#${c.id}</td>
        <td style="font-weight:600;color:var(--text)">${c.roll_no} ${c.is_external == 1 ? '<span class="badge badge-yellow" style="font-size:9px;margin-left:4px">Dış Alım</span>' : ''}</td>
        <td style="color:var(--warning);font-weight:600">${c.lot_no || c.party_no || '-'}</td>
        <td style="font-size:12px;font-weight:600;color:var(--accent)">${c.product_code || '-'} <br><small style="color:var(--text3);font-weight:400">${c.product_name || '-'}</small></td>
        <td style="font-weight:600">${c.loom_name || '-'}</td>
        <td style="font-size:11px">${fmtDate(c.control_date)}</td>
        <td style="font-weight:700;color:var(--accent)">${c.length_m} mt</td>
        <td style="font-weight:700;color:var(--accent3)">${c.weight_kg || '0'} kg</td>
        <td>${c.shipment_id ? '<span class="badge badge-purple">SEVK EDİLDİ</span>' : '<span class="badge badge-teal">STOKTA</span>'}</td>
        <td>${decisionBadge(c.decision)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewQCDetail(${c.id})">👁</button>
          <button class="btn btn-sm btn-danger" onclick="deleteQC(${c.id})">🗑</button>
        </td>
      </tr>
      `;
    }).join('');

    const tfoot = document.getElementById('qcTableFoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:right; color:var(--text2)">TOPLAM (${data.length} Top):</td>
          <td style="font-weight:700; color:var(--accent)">${grandMeters.toFixed(1)} mt</td>
          <td style="font-weight:700; color:var(--accent3)">${grandKg.toFixed(1)} kg</td>
          <td colspan="3"></td>
        </tr>
      `;
    }

    // KPI Cards rendering
    const summary = {};
    res.data.forEach(c => {
      const key = c.product_code || 'Tanımsız';
      if (!summary[key]) summary[key] = { total: 0, stock: 0 };
      const mt = parseFloat(c.length_m);
      summary[key].total += mt;
      if (!c.shipment_id) summary[key].stock += mt;
    });

    const summaryCards = document.getElementById('qcSummaryCards');
    if (summaryCards) {
      summaryCards.innerHTML = Object.entries(summary).map(([key, val]) => `
        <div class="panel" style="padding:16px; border-left:4px solid var(--accent); display:flex; flex-direction:column; gap:4px; box-shadow:var(--shadow-sm)">
          <div style="font-size:10px; color:var(--text3); font-weight:700; text-transform:uppercase">STOK DURUMU</div>
          <div style="font-size:14px; font-weight:700; color:var(--text)">${key}</div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end">
            <div>
              <div style="font-size:9px; color:var(--accent); font-weight:700">GÜNCEL STOK</div>
              <div style="font-size:20px; font-weight:900; color:var(--accent); font-family:Syne">${Number(val.stock).toLocaleString('tr-TR')} <small style="font-size:10px">mt</small></div>
            </div>
            <div style="text-align:right">
              <div style="font-size:9px; color:var(--text3); font-weight:700">TOPLAM ÜRETİM</div>
              <div style="font-size:14px; font-weight:700; color:var(--text2)">${Number(val.total).toLocaleString('tr-TR')} <small style="font-size:9px">mt</small></div>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

function viewQCDetail(id) {
  api('quality_controls', { search: '', limit: 100 }).then(res => {
    const c = res.data.find(x => x.id === id);
    if (!c) return;
    openModal('Kontrol Detayı — #' + c.id, `
      <div class="form-grid" style="margin-bottom:16px">
        <div><strong style="color:var(--text3);font-size:11px">TOP NO</strong><br><span style="font-size:15px;font-weight:600">${c.roll_no}</span></div>
        <div><strong style="color:var(--text3);font-size:11px">LOT NO</strong><br><span style="font-size:15px;font-weight:600;color:var(--warning)">${c.lot_no || c.party_no || '-'}</span></div>
        <div><strong style="color:var(--text3);font-size:11px">KUMAŞ TİPİ</strong><br>${c.fabric_type_name || '-'}</div>
        <div><strong style="color:var(--text3);font-size:11px">TARİH</strong><br>${fmtDate(c.control_date)}</div>
        <div><strong style="color:var(--text3);font-size:11px">METRE</strong><br><strong>${c.length_m} mt</strong></div>
        <div><strong style="color:var(--text3);font-size:11px">KİLO</strong><br><strong>${c.weight_kg || '0'} kg</strong></div>
        <div><strong style="color:var(--text3);font-size:11px">GSM</strong><br>${((c.weight_kg * 1000) / c.length_m).toFixed(0)} g/mt</div>
        <div><strong style="color:var(--text3);font-size:11px">M2</strong><br>${c.m2 || '0'} m²</div>
        <div><strong style="color:var(--text3);font-size:11px">KONTROLCÜ</strong><br>${c.inspector || '-'}</div>
        <div><strong style="color:var(--text3);font-size:11px">KARAR</strong><br>${decisionBadge(c.decision)}</div>
      </div>
      <div style="text-align:center;margin:20px 0">
        <div style="font-size:48px;font-weight:800;font-family:Syne;color:${c.quality_score >= 85 ? 'var(--accent)' : c.quality_score >= 70 ? 'var(--warning)' : 'var(--danger)'}">%${Number(c.quality_score).toFixed(1)}</div>
        <div style="color:var(--text3);font-size:12px">Kalite Puanı</div>
      </div>
      ${c.defects.length ? `
        <div class="form-section">Tespit Edilen Hatalar</div>
        <table>
          <thead><tr><th>Hata Tipi</th><th>Adet</th><th>Ciddiyet</th></tr></thead>
          <tbody>${c.defects.map(d => `
            <tr>
              <td style="font-weight:500;color:var(--text)">${d.defect_name}</td>
              <td>${d.count}</td>
              <td><span class="badge ${d.severity >= 3 ? 'badge-red' : d.severity >= 2 ? 'badge-yellow' : 'badge-teal'}">${['', 'Hafif', 'Orta', 'Ciddi', 'Çok Ciddi'][d.severity]}</span></td>
            </tr>
          `).join('')}</tbody>
        </table>
      ` : ''}
      ${c.notes ? `<div style="margin-top:16px;padding:12px;background:var(--surface2);border-radius:8px;font-size:13px;color:var(--text2)"><strong>Notlar:</strong> ${c.notes}</div>` : ''}
    `);
  });
}

function deleteQC(id) {
  openModal('Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:24px;color:var(--text)">Bu kalite kontrol kaydını silmek istediğinize emin misiniz?</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button type="button" class="btn btn-danger" onclick="executeDeleteQC(${id})">Evet, Sil</button>
      </div>
    </div>
  `);
}

async function executeDeleteQC(id) {
  closeModal();
  try {
    await api('quality_control_delete', { id }, 'POST');
    toast('Kayıt silindi');
    filterQCList();
  } catch (e) { toast(e.message, 'error'); }
}

function exportQuality() {
  window.location.href = 'api.php?action=export_quality';
}
function loadAbout() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div style="max-width:1100px; margin:0 auto; padding:40px 20px">

      <!-- HERO SECTION -->
      <div style="text-align:center; margin-bottom:60px; animation:fadeUp .5s ease">
        <h1 style="font-family:'Syne',sans-serif; font-size:36px; font-weight:800; color:var(--text); margin-bottom:10px">IPEX ERP</h1>
        <p style="font-size:18px; color:var(--text2); margin-bottom:5px">Dokuma Üretim ve Kalite Kontrol Sistemi</p>
        <p style="font-size:14px; color:var(--text3); margin-bottom:20px">"Dokuma üretimini dijitalleştirin, kaliteyi zirveye taşıyın."</p>

        <div style="display:inline-flex; gap:10px; flex-wrap:wrap; justify-content:center">
          <span style="background:var(--surface2); border:1px solid var(--border); border-radius:20px; padding:6px 18px; font-size:11px; color:var(--text2); font-weight:600">${APP_VERSION} (${APP_COMMIT})</span>
        </div>
      </div>

      <!-- FEATURES SECTION -->
      <div style="margin-bottom:60px">
        <h2 style="font-family:'Syne',sans-serif; font-size:24px; font-weight:700; color:var(--text); text-align:center; margin-bottom:10px">Sistem Özellikleri</h2>
        <p style="text-align:center; font-size:13px; color:var(--text3); margin-bottom:30px">Modül kartına tıklayarak kullanım bilgilerini görün</p>

        <div class="grid-3" style="gap:20px">
          <!-- Dashboard -->
          <div id="feature-dashboard" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent)" onclick="toggleModuleGuide('dashboard')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Dashboard</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Canlı KPI göstergeleri, interaktif grafikler ve anlık üretim özeti.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-dashboard">
              <div class="guide-title">📊 Dashboard - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['dashboard'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Kalite Kontrol -->
          <div id="feature-qc-new" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent2)" onclick="toggleModuleGuide('qc-new')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Kalite Kontrol</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Hata takibi, otomatik skorlama, barkodlu giriş ve raporlama.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-qc-new">
              <div class="guide-title">🔍 Kalite Kontrol - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['qc-new'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Kontrol Listesi -->
          <div id="feature-qc-list" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent3)" onclick="toggleModuleGuide('qc-list')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Kontrol Listesi</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Tüm kalite kontrol kayıtlarını listele, filtrele ve yönet.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-qc-list">
              <div class="guide-title">📋 Kontrol Listesi - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['qc-list'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Tezgahlar -->
          <div id="feature-looms" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent3)" onclick="toggleModuleGuide('looms')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 6v12M2 12h20"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Tezgah Yönetimi</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">RPM takibi, verimlilik analizi ve günlük randıman kayıtları.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-looms">
              <div class="guide-title">🏭 Tezgahlar - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['looms'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Ürünler -->
          <div id="feature-products" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent)" onclick="toggleModuleGuide('products')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Ürün & Stok</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Ürün CRUD, teknik detaylar, stok hareketleri ve takibi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-products">
              <div class="guide-title">📦 Ürünler & Stok - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['products'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Depo Girişi -->
          <div id="feature-depo-giris" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent2)" onclick="toggleModuleGuide('depo-giris')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Depo Girişi</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Harici alım girişleri, müşteri bağlantılı stok takibi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-depo-giris">
              <div class="guide-title">📥 Depo Giriş (Dış Alım) - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['depo-giris'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Stok Hareketleri -->
          <div id="feature-stock-move" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent3)" onclick="toggleModuleGuide('stock-move')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Stok Hareketleri</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Giriş/çıkış takibi, bakiye yönetimi ve hareket geçmişi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-stock-move">
              <div class="guide-title">🔄 Stok Hareketleri - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['stock-move'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Sevkiyat -->
          <div id="feature-shipments" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent)" onclick="toggleModuleGuide('shipments')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><rect x="5" y="17" width="2" height="2" rx="1"/><rect x="17" y="17" width="2" height="2" rx="1"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Sevkiyat & Çeki</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Paketleme listeleri, barkod yazdırma ve sevkiyat yönetimi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-shipments">
              <div class="guide-title">🚚 Sevkiyat & Çeki - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['shipments'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Siparişler -->
          <div id="feature-orders" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent2)" onclick="toggleModuleGuide('orders')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Sipariş & Projeler</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Termin takibi, durum yönetimi ve proje planlama.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-orders">
              <div class="guide-title">📑 Sipariş & Projeler - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['orders'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>


          <!-- Cariler -->
          <div id="feature-customers" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent3)" onclick="toggleModuleGuide('customers')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Cariler</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Müşteri veritabanı, iletişim bilgileri ve ilişki yönetimi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-customers">
              <div class="guide-title">👥 Cariler - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['customers'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>
          
          <!-- Muhasebe -->
          <div id="feature-accounting" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid #25D366" onclick="toggleModuleGuide('accounting')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Ön Muhasebe & Finans</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Cari takibi, faturalandırma, dövizli işlemler ve ödeme yönetimi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-accounting">
              <div class="guide-title">💰 Ön Muhasebe - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['accounting'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Analiz -->
          <div id="feature-analiz" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent)" onclick="toggleModuleGuide('analiz')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v8L6.5 9 2 17h20l-4.5-8L14 10V2"/><path d="M2 17h20v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M12 17v4"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Analiz</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Maliyet hesaplama, kumaş analizi ve detaylı raporlar.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-analiz">
              <div class="guide-title">🔬 Analiz - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['analiz'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Raporlar -->
          <div id="feature-reports" class="feature-card" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent2)" onclick="toggleModuleGuide('reports')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/><circle cx="18" cy="8" r="2"/><circle cx="12" cy="2" r="2"/><circle cx="6" cy="16" r="2"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Raporlar</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Üretim, stok, sevkiyat raporları ve veri analizi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-reports">
              <div class="guide-title">📈 Raporlar - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['reports'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Raporlar kartı kapanır -->

        </div><!-- /grid-3 -->

        <!-- Ayarlar + Güncellemeler Row -->
        <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:20px">

          <!-- Ayarlar -->
          <div id="feature-settings" class="feature-card" style="flex:1; min-width:280px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent3)" onclick="toggleModuleGuide('settings')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Ayarlar</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">Şirket bilgileri, 12 tema seçeneği ve kullanıcı yönetimi.</div>
            <div class="card-hint">ℹ️ Nasıl kullanılır? (Tıkla)</div>
            <div class="module-guide" id="guide-settings">
              <div class="guide-title">⚙️ Ayarlar - Nasıl Kullanılır?</div>
              <ol>
                ${moduleGuideData['settings'].steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </div>
          </div>

          <!-- Son Güncellemeler -->
          <div id="feature-updates" class="feature-card" style="flex:1; min-width:280px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:24px; text-align:center; transition:var(--transition); border-top:3px solid var(--accent)" onclick="toggleUpdates()">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <div style="font-weight:700; color:var(--text); margin:10px 0 8px; font-size:14px">Son Güncellemeler</div>
            <div style="font-size:12px; color:var(--text2); line-height:1.5">GitHub'daki son gelişmeleri görüntüleyin.</div>
            <div class="card-hint">📦 Son güncellemeler (Tıkla)</div>
            <div class="module-guide" id="guide-updates">
              <div class="guide-title">📦 Son Güncellemeler</div>
              <div id="updates-list" style="text-align:left; font-size:12px; color:var(--text2); line-height:1.6; padding:4px 0">Yükleniyor...</div>
            </div>
          </div>

        </div><!-- /Ayarlar + Güncellemeler Row -->

      </div><!-- /features section -->

      <!-- TECHNOLOGY STACK -->
      <div style="margin-bottom:60px">
        <h2 style="font-family:'Syne',sans-serif; font-size:24px; font-weight:700; color:var(--text); text-align:center; margin-bottom:10px">Teknoloji Altyapısı</h2>
        <p style="text-align:center; font-size:13px; color:var(--text3); margin-bottom:30px">Modern ve güvenilir teknolojiler kullanılarak geliştirilmiştir</p>

        <div class="grid-4" style="gap:16px">
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; text-align:center">
            <div style="font-weight:700; color:var(--accent); font-size:14px; margin-bottom:5px">Backend</div>
            <div style="font-size:12px; color:var(--text2)">PHP 8.x + SQLite3</div>
          </div>
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; text-align:center">
            <div style="font-weight:700; color:var(--accent2); font-size:14px; margin-bottom:5px">Frontend</div>
            <div style="font-size:12px; color:var(--text2)">Vanilla JavaScript ES6+</div>
          </div>
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; text-align:center">
            <div style="font-weight:700; color:var(--accent3); font-size:14px; margin-bottom:5px">Kütüphaneler</div>
            <div style="font-size:12px; color:var(--text2)">Chart.js, SheetJS, JsBarcode</div>
          </div>
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; text-align:center">
            <div style="font-weight:700; color:var(--accent); font-size:14px; margin-bottom:5px">Tasarım</div>
            <div style="font-size:12px; color:var(--text2)">Responsive, 12 Tema Desteği</div>
          </div>
        </div>
      </div>

      <!-- COPYRIGHT / DEVELOPER (BEAUTIFIED) -->
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:40px; text-align:center; position:relative; overflow:hidden">
        <div style="position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, var(--accent), var(--accent2), var(--accent3))"></div>

        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 15px">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <h3 style="font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:var(--text); margin-bottom:5px">Adem Gündüz</h3>
        <p style="font-size:13px; color:var(--text2); margin-bottom:5px">Kurucu & Baş Geliştirici</p>
        <p style="font-size:11px; color:var(--text3); margin-bottom:20px">IPEX ERP Sistem Mimarı</p>
        <div style="font-size:12px; color:var(--text2); margin-bottom:15px; display:flex; gap:20px; justify-content:center; flex-wrap:wrap">
          <div style="display:flex; align-items:center; gap:6px">📞 <span style="font-family:'IBM Plex Mono',monospace; font-weight:600">05548251757</span></div>
          <div style="display:flex; align-items:center; gap:6px">✉️ <span style="font-family:'IBM Plex Mono',monospace; font-weight:600">ademmgunduz@gmail.com</span></div>
        </div>
        
        <div style="height:1px; background:var(--border); margin:20px 0"></div>

        <div style="display:flex; justify-content:center; gap:20px; flex-wrap:wrap; margin-bottom:20px">
          <div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px">Sistem</div>
            <div style="font-weight:700; color:var(--text); font-size:14px">IPEX ERP</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px">Versiyon</div>
            <div style="font-weight:700; color:var(--text); font-size:14px">${APP_VERSION}</div>
            <div style="font-size:9px; color:var(--text3); font-family:monospace">${APP_COMMIT}</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px">Lisans</div>
            <div style="font-weight:700; color:var(--accent); font-size:14px">Professional Edition</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; letter-spacing:1px; margin-bottom:5px">Yıl</div>
            <div style="font-weight:700; color:var(--text); font-size:14px">© 2026</div>
          </div>
        </div>

        <div style="font-size:11px; color:var(--text3)">Tüm hakları saklıdır. İzinsiz kopyalanamaz veya dağıtılamaz.</div>
      </div>

    </div>
  `;
}

// ── Notifications ──
function toggleNotifications() {
  const drop = document.getElementById('notiDropdown');
  if (!drop) return;
  drop.classList.toggle('active');
  if (drop.classList.contains('active')) {
    unreadNotiCount = 0;
    updateNotiBadge();
    document.querySelectorAll('.noti-item.unread').forEach(el => el.classList.remove('unread'));
  }
}

async function checkNotifications() {
  if (!currentUser) return;
  try {
    const res = await api('quality_controls', { limit: 15 });
    const data = res.data || [];
    if (!data.length) return;

    if (lastNotiCheckId === 0) {
      // İlk yüklemede: sadece son ID'yi kaydet, ESKİ bildirimleri GÖSTERME
      lastNotiCheckId = Math.max(...data.map(x => x.id));
      // localStorage'dan kaydedilmiş ID varsa onu kullan
      const savedId = parseInt(localStorage.getItem('lastNotiCheckId') || '0');
      if (savedId > 0) {
        lastNotiCheckId = Math.max(lastNotiCheckId, savedId);
      }
      return;
    }

    const newOnes = data.filter(x => x.id > lastNotiCheckId);
    if (newOnes.length > 0) {
      unreadNotiCount += newOnes.length;
      updateNotiBadge();
      updateNotiList(newOnes);

      newOnes.forEach(one => {
        // Kendi işlemimiz değilse toast popup göster
        if (one.user_id != currentUser.id) {
          const title = one.is_external == 1 ? 'Dış Alım' : 'Yeni Üretim';
          if (!isMuted) toast(`${title}: ${one.product_name} - ${one.length_m}mt`, 'info');
        }
      });

      // lastNotiCheckId her zaman en büyüğe güncellenmeli ki tekrar etmesin
      lastNotiCheckId = Math.max(lastNotiCheckId, ...newOnes.map(x => x.id));
      localStorage.setItem('lastNotiCheckId', lastNotiCheckId);
    }
  } catch (e) { console.error('Bildirim hatası:', e); }
}

// ── Akıllı Uyarılar (Smart Alerts) ──
let lastSmartAlertHash = '';
async function checkSmartAlerts() {
  if (!currentUser) return;
  try {
    const res = await api('smart_alerts');
    const alerts = res.alerts || [];

    // Hash oluştur tekrar bildirimi engellemek için
    const hash = JSON.stringify(alerts.map(a => a.type + a.message));
    if (hash === lastSmartAlertHash) return;
    lastSmartAlertHash = hash;

    const list = document.getElementById('notiList');
    if (!list) return;

    // Mevcut smart alert bölümünü temizle
    const oldSection = list.querySelector('.smart-alert-section');
    if (oldSection) oldSection.remove();

    if (!alerts.length) return;

    // Eğer boş mesajı varsa temizle
    if (list.querySelector('.noti-empty')) list.innerHTML = '';

    // Smart alert bölümünü en alta ekle
    const section = document.createElement('div');
    section.className = 'smart-alert-section';
    section.innerHTML = '<div style="padding:8px 16px;font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;border-top:1px solid var(--b2);margin-top:4px">⚡ Sistem Uyarıları</div>';

    let newAlertCount = 0;
    alerts.forEach(alert => {
      newAlertCount++;
      const item = document.createElement('div');
      item.className = 'noti-item smart-alert unread';
      item.dataset.alertKey = alert.type + '-' + alert.message;

      const severityColor = alert.severity === 'danger' ? '#ff4757' : (alert.severity === 'warning' ? '#ffa502' : 'var(--accent)');

      item.onclick = () => { navigateTo(alert.page); toggleNotifications(); };
      item.innerHTML = `
        <div class="noti-icon" style="font-size:18px">${alert.icon}</div>
        <div class="noti-content">
          <span class="noti-title" style="color:${severityColor}">${alert.title}</span>
          <span class="noti-desc">${alert.message}</span>
          <span class="noti-time">Anlık Uyarı</span>
        </div>
      `;
      section.appendChild(item);
    });

    // Bölümü listenin EN ALTINA ekle
    list.appendChild(section);

    if (newAlertCount > 0) {
      unreadNotiCount += newAlertCount;
      updateNotiBadge();

      // Kritik uyarılar için toast göster
      if (!isMuted) {
        const dangerAlerts = alerts.filter(a => a.severity === 'danger');
        dangerAlerts.forEach(a => {
          toast(`${a.icon} ${a.title}: ${a.message}`, 'error');
        });
        const warningAlerts = alerts.filter(a => a.severity === 'warning');
        if (warningAlerts.length > 0) {
          toast(`⚠️ ${warningAlerts.length} adet uyarı bildirimi var`, 'warning');
        }
      }
    }
  } catch (e) { console.error('Smart alert hatası:', e); }
}

function markAllNotiRead(e) {
  if (e) e.stopPropagation();
  unreadNotiCount = 0;
  updateNotiBadge();
  document.querySelectorAll('.noti-item.unread').forEach(el => el.classList.remove('unread'));
}

function clearNotifications() {
  const list = document.getElementById('notiList');
  if (list) list.innerHTML = '<div class="noti-empty">Henüz yeni bildirim yok.</div>';
  unreadNotiCount = 0;
  updateNotiBadge();
  lastSmartAlertHash = '';
  // Mevcut ID'yi kaydet, böylece eski bildirimler tekrar gelmez
  localStorage.setItem('lastNotiCheckId', lastNotiCheckId);
}

// ── Chat ──
async function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input || !input.value.trim()) return;
  try {
    await api('messages', { message: input.value.trim() }, 'POST');
    input.value = '';
    if (chatOpen) loadChatMessages();
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleChat() {
  const win = document.getElementById('chatWindow');
  if (!win) return;
  chatOpen = !chatOpen;
  win.classList.toggle('active');
  if (chatOpen) {
    unreadMessageCount = 0;
    updateChatBadge();
    loadChatMessages();
    api('messages_read');
    // Focus input
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 100);
  }
}

function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem('isMuted', isMuted);
  const icon = document.getElementById('muteIcon');
  if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
  toast(isMuted ? 'Bildirimler susturuldu' : 'Bildirimler açıldı', 'info');
}

function updateNotiBadge() {
  const badge = document.getElementById('notiBadge');
  if (!badge) return;
  if (unreadNotiCount > 0) {
    badge.textContent = unreadNotiCount;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function updateNotiList(newOnes, silent = false) {
  const list = document.getElementById('notiList');
  if (!list) return;
  if (list.querySelector('.noti-empty')) list.innerHTML = '';

  // Yeniden eskiye sıralı geldiği için ters çevirip prepend yaparsak en yeni en üstte kalır
  [...newOnes].reverse().forEach(one => {
    const item = document.createElement('div');
    item.className = 'noti-item' + (silent ? '' : ' unread');
    item.onclick = () => { navigateTo('qc-list'); toggleNotifications(); };
    const isExt = one.is_external == 1;
    item.innerHTML = `
      <div class="noti-icon">${isExt ? '📥' : '🔍'}</div>
      <div class="noti-content">
        <span class="noti-title">${isExt ? 'Dış Alım' : 'Yeni Üretim'}</span>
        <span class="noti-desc">${one.product_name} - ${one.length_m}mt</span>
        <span class="noti-time">${new Date(one.created_at).toLocaleString('tr-TR')}</span>
      </div>
    `;
    list.prepend(item);
  });
}

async function loadChatMessages() {
  try {
    const res = await api('messages');
    const data = res.data || [];
    renderChatMessages(data);
    if (data.length > 0) lastMessageId = data[data.length - 1].id;
  } catch (e) { console.error('Chat hatası:', e); }
}

function renderChatMessages(messages) {
  const body = document.getElementById('chatBody');
  if (!body) return;
  body.innerHTML = messages.map(m => `
    <div class="chat-msg ${m.sender_id == currentUser.id ? 'sent' : 'received'}">
      <span class="chat-msg-info">${m.sender_id == currentUser.id ? 'Siz' : m.sender_name}</span>
      ${m.message}
      <span class="chat-msg-time">${new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `).join('');
  body.scrollTop = body.scrollHeight;
}

function updateChatBadge() {
  const badge = document.getElementById('chatBadge');
  if (!badge) return;
  if (unreadMessageCount > 0) {
    badge.textContent = unreadMessageCount;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

async function pollMessages() {
  if (!currentUser) return;
  try {
    const res = await api('messages', { limit: 10 });
    const data = res.data || [];
    if (!data.length) return;

    const latestId = data[data.length - 1].id;
    if (lastMessageId === 0) {
      lastMessageId = latestId;
      renderChatMessages(data);
      return;
    }

    if (latestId > lastMessageId) {
      const newOnes = data.filter(m => m.id > lastMessageId);
      lastMessageId = latestId;

      if (chatOpen) {
        renderChatMessages(data);
      } else {
        const received = newOnes.filter(m => m.sender_id != currentUser.id);
        if (received.length > 0) {
          unreadMessageCount += received.length;
          updateChatBadge();
          received.forEach(m => {
            toast(`Mesaj: ${m.sender_name}: ${m.message}`, 'info');
          });
        }
      }
    }
  } catch (e) { console.error('Chat poll hatası:', e); }
}

// ═══════════════════════════════
// ANALİZ SAYFASI FONKSİYONLARI
// ═══════════════════════════════

// Tema (ana uygulamadan alır, kendi temasını kullanmaz)
// Analiz sayfası data-theme attribute'ünü kullanır

// ═══════════════════════════════
//  NUMARA → TEX
// ═══════════════════════════════

// ═════════════════════════════
//  MODÜLLER SAYFASI
// ═════════════════════════════
async function loadModules() {
  const content = document.getElementById('contentArea');
  const perms = currentUser.permissions ? currentUser.permissions.split(',') : [];
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  let moduleCards = '';
  // pageConfig üzerinde döngü yap (doğru sayfa anahtarları için)
  for (const [pageKey, cfg] of Object.entries(pageConfig)) {
    if (pageKey === 'modules') continue;

    // İzin anahtarını bul
    let permKey = pageKey;
    if (pageKey === 'qc-new') permKey = 'qc';
    if (pageKey === 'qc-list') permKey = 'history';
    if (pageKey === 'stock-move') permKey = 'inventory';
    if (pageKey === 'depo-giris') permKey = 'depo';

    const hasAccess = isAdmin || perms.includes(permKey);
    if (!hasAccess) continue;

    const icon = MODULE_ICONS[pageKey] || '';
    const label = cfg.title || pageKey;

    moduleCards += `
      <div class="module-card" onclick="navigateTo('${pageKey}')" title="${label}">
        <div class="module-icon">${icon}</div>
        <div class="module-label">${label}</div>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="panel" style="border:none;box-shadow:none;background:transparent">
      <div class="panel-head"><span class="panel-title">📱 Tüm Modüller</span></div>
      <div class="modules-grid">
        ${moduleCards}
      </div>
    </div>
  `;
}
