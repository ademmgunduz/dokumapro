/* ═══════════════════════════════════════════
   DokumaQC — Application JavaScript
   Part 5: İplik Stok (Giriş/Çıkış Takibi)
   ═══════════════════════════════════════════ */

let _yarnCache = [];
let _yarnMovCache = [];

const YARN_CINS = ['Pamuk', 'Polyester', 'Viskon', 'Penye', 'Akrilik', 'Yün', 'Keten', 'Linen', 'Elastan/Lycra', 'Metalik', 'Karışım'];
const YARN_CINS_DIGER = 'Diğer';

function isCustomCins(c) { return !!c && !YARN_CINS.includes(c); }

function getYarn(id) { return _yarnCache.find(y => y.id == id); }

// ── Numara Türleri & Dönüşüm ──
// 3 sistem: Nm (metrik), Ne (pamuk numarası), Denye (D)
// Nm = Ne × 1.6934 | D = 9000 / Nm
// Katlı iplikte: Nm/Ne efektif = numara / kat, Denye toplam = numara × kat
const YARN_COUNT_TYPES = [
  { v: 'nm', label: 'Nm — Metrik (viskon, polyester, akrilik)' },
  { v: 'ne', label: 'Ne — Pamuk numarası (pamuk, penye)' },
  { v: 'denye', label: 'Denye (D) — Filament (150D, 300D...)' }
];

function yarnCountTypeShort(type) {
  if (type === 'ne') return 'Ne';
  if (type === 'denye') return 'D';
  return 'Nm';
}

function yarnNumaraTypeOptions(selected = '') {
  return YARN_COUNT_TYPES.map(t =>
    `<option value="${t.v}" ${t.v === selected ? 'selected' : ''}>${t.label}</option>`).join('');
}

function yarnDetectType(numara, cins) {
  const n = (numara || '').trim();
  if (/d$/i.test(n)) return 'denye';
  if (['Pamuk', 'Penye', 'Keten', 'Denim', 'Karışım'].includes(cins)) return 'ne';
  return 'nm';
}

// Dönüşüm metni (≈ kısmı): "≈ Ne 23.6 · 225 D"
function yarnConversion(y) {
  const raw = (y.numara || '').trim();
  if (!raw) return '';
  const slash = raw.split('/');
  const num = parseFloat(slash[0].replace(/[^0-9.]/g, ''));
  let kat = slash.length > 1 ? (parseInt(slash[1]) || 1) : (parseInt(y.kat) || 1);
  if (!num || num <= 0 || !kat) return '';
  let type = (y.numara_type || 'nm');
  if (!['nm', 'ne', 'denye'].includes(type)) type = 'nm';

  const T = v => v >= 100 ? v.toFixed(0) : (v >= 10 ? v.toFixed(1) : v.toFixed(2));

  if (type === 'denye') {
    const d = num * kat;
    const nm = 9000 / d;
    const ne = nm / 1.6934;
    return `≈ ${T(d)} D · Nm ${T(nm)} · Ne ${T(ne)}`;
  }
  if (type === 'ne') {
    const ne = num / kat;
    const nm = ne * 1.6934;
    const d = 9000 / nm;
    return `≈ Nm ${T(nm)} · ${T(d)} D`;
  }
  const nm = num / kat;
  const ne = nm / 1.6934;
  const d = 9000 / nm;
  return `≈ Ne ${T(ne)} · ${T(d)} D`;
}

function yarnNumaraLabel(y) {
  const raw = (y.numara || '').trim();
  if (!raw) return '';
  const slash = raw.split('/');
  const base = slash[0];
  let kat = slash.length > 1 ? (parseInt(slash[1]) || 1) : (parseInt(y.kat) || 1);
  if (!kat || kat < 1) kat = 1;
  const hasD = /d$/i.test(base) || /denye/i.test(y.numara_type || '');
  if (hasD) return kat > 1 ? `${base}/${kat} D` : `${base} D`;
  return `${base}/${kat}`;
}

function yarnCinsOptions(selected = '') {
  const isOther = isCustomCins(selected);
  let html = YARN_CINS.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
  html += `<option value="${YARN_CINS_DIGER}" ${isOther || selected === YARN_CINS_DIGER ? 'selected' : ''}>${YARN_CINS_DIGER} (belirtin)</option>`;
  return html;
}

function yarnCinsChanged() {
  const sel = document.getElementById('yarnCins');
  const otherWrap = document.getElementById('yarnCinsOtherWrap');
  if (!sel || !otherWrap) return;
  otherWrap.style.display = sel.value === 'Diğer' ? 'block' : 'none';
  syncCinsChips();
  yarnAutoNumaraType();
  yarnConversionHint();
  updateYarnPreview();
}

function yarnAutoNumaraType() {
  const nSel = document.getElementById('yarnNumaraType');
  const nInput = document.getElementById('yarnNumara');
  const cSel = document.getElementById('yarnCins');
  if (!nSel || !nInput || !cSel) return;
  const t = yarnDetectType(nInput.value, cSel.value);
  nSel.value = t;
  yarnSyncTypeSeg();
}

function yarnNumaraInput() {
  const nInput = document.getElementById('yarnNumara');
  const kInput = document.getElementById('yarnKat');
  const tSel = document.getElementById('yarnNumaraType');
  if (nInput && kInput) {
    const raw = nInput.value.trim();
    if (raw.includes('/')) {
      const parts = raw.split('/');
      const base = parts[0].trim();
      const kat = parseInt(parts[1]);
      if (base && !isNaN(kat) && kat > 0) {
        nInput.value = base;
        kInput.value = kat;
      }
    }
  }
  if (nInput && tSel && /d$/i.test(nInput.value.trim())) tSel.value = 'denye';
  yarnSyncTypeSeg();
  yarnConversionHint();
  updateYarnPreview();
}

function yarnConversionHint() {
  const n = document.getElementById('yarnNumara')?.value || '';
  const k = document.getElementById('yarnKat')?.value || 1;
  const t = document.getElementById('yarnNumaraType')?.value || 'nm';
  const el = document.getElementById('yarnConvHint');
  if (!el) return;
  const conv = yarnConversion({ numara: n, kat: k, numara_type: t });
  const label = (n || '').trim();
  const typeLabel = yarnCountTypeShort(t);
  el.textContent = conv
    ? `Dönüşüm: ${label}${label && !/d$/i.test(label) ? ' ' + typeLabel : ''} ${conv}`
    : '';
}

// ── HTML Güvenliği & Profesyonel Modal Yardımcıları ──
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cinsSwatch(cins) {
  const map = {
    'Pamuk': { bg: 'linear-gradient(135deg,#f5f0e6,#d6c9a8)', icon: '☁️' },
    'Penye': { bg: 'linear-gradient(135deg,#ffffff,#e2d8c5)', icon: '🐑' },
    'Polyester': { bg: 'linear-gradient(135deg,#8b6cf5,#5b3fd6)', icon: '⚗️' },
    'Viskon': { bg: 'linear-gradient(135deg,#7fc8a9,#3f9a7a)', icon: '🌿' },
    'Akrilik': { bg: 'linear-gradient(135deg,#f5a97f,#e0713f)', icon: '🧶' },
    'Yün': { bg: 'linear-gradient(135deg,#d9b38c,#a97f56)', icon: '🐑' },
    'Keten': { bg: 'linear-gradient(135deg,#e5e0c8,#c2b894)', icon: '🌾' },
    'Linen': { bg: 'linear-gradient(135deg,#e5e0c8,#c2b894)', icon: '🌾' },
    'Elastan/Lycra': { bg: 'linear-gradient(135deg,#f58fbf,#d64a8a)', icon: '🎗️' },
    'Metalik': { bg: 'linear-gradient(135deg,#d4d4e8,#8f8fc0)', icon: '✨' },
    'Karışım': { bg: 'linear-gradient(135deg,#8fd8f5,#4a8ad6)', icon: '🌀' }
  };
  const hit = map[cins] || map[cins && cins.trim()];
  if (!hit) return { bg: 'linear-gradient(135deg,#8f9ab5,#5a6b8f)', icon: '🧵' };
  return hit;
}

function syncSeg(segId, inputId) {
  const seg = document.getElementById(segId);
  const input = document.getElementById(inputId);
  if (!seg || !input) return;
  seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === input.value));
}

function syncChips(rowId, inputId) {
  const row = document.getElementById(rowId);
  const input = document.getElementById(inputId);
  if (!row || !input) return;
  row.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.val === input.value));
}

function yarnSyncTypeSeg() {
  syncSeg('yarnTypeSeg', 'yarnNumaraType');
}

function setYarnType(t) {
  const sel = document.getElementById('yarnNumaraType');
  if (!sel) return;
  sel.value = t;
  yarnSyncTypeSeg();
  yarnConversionHint();
  updateYarnPreview();
}

function setYarnCins(c) {
  const sel = document.getElementById('yarnCins');
  if (!sel) return;
  sel.value = c;
  sel.dispatchEvent(new Event('change'));
}

function syncCinsChips() {
  syncChips('yarnCinsChips', 'yarnCins');
}

function setYarnCurrency(c) {
  const sel = document.getElementById('yarnCurrency');
  if (!sel) return;
  sel.value = c;
  syncSeg('yarnCurSeg', 'yarnCurrency');
  updateYarnPreview();
}

function setYarnUnit(u) {
  const sel = document.getElementById('yarnUnit');
  if (!sel) return;
  sel.value = u;
  syncChips('yarnUnitChips', 'yarnUnit');
  updateYarnPreview();
}

function setYarnMovCurrency(c) {
  const sel = document.getElementById('ymCurrency');
  if (!sel) return;
  sel.value = c;
  syncSeg('ymCurSeg', 'ymCurrency');
}

function setYarnCikisTipi(t) {
  const sel = document.getElementById('ymCikisTipi');
  if (!sel) return;
  sel.value = t;
  const seg = document.getElementById('ymCikisTipiSeg');
  if (seg) seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === t));
  ymCikisTipiChanged();
}

function updateYarnPreview() {
  const el = document.getElementById('yarnPreview');
  if (!el) return;
  const code = (document.getElementById('yarnCode')?.value || '').trim();
  const numara = (document.getElementById('yarnNumara')?.value || '').trim();
  const kat = (document.getElementById('yarnKat')?.value || '').trim();
  const t = document.getElementById('yarnNumaraType')?.value || 'nm';
  const cinsSel = document.getElementById('yarnCins');
  let cins = cinsSel ? cinsSel.value : '';
  if (cins === 'Diğer') cins = (document.getElementById('yarnCinsOther')?.value || '').trim() || 'Diğer';
  const unit = document.getElementById('yarnUnit')?.value || 'kg';
  const price = document.getElementById('yarnPrice')?.value;
  const cur = document.getElementById('yarnCurrency')?.value || 'TL';
  const swatch = cinsSwatch(cins);
  const label = yarnNumaraLabel({ numara, kat, numara_type: t });
  const conv = yarnConversion({ numara, kat, numara_type: t });
  const typeShort = yarnCountTypeShort(t);
  el.innerHTML = `
    <div class="yarn-preview">
      <div class="yarn-swatch" style="background:${swatch.bg}">${swatch.icon}</div>
      <div class="yarn-preview-info">
        <div class="yarn-preview-code">${esc(code || 'Otomatik Kod')}</div>
        <div class="yarn-preview-sub">${esc(label || 'Numara girilmedi')}</div>
        <div class="yarn-preview-meta">
          ${cins ? `<span class="yarn-preview-badge purple">${esc(cins)}</span>` : ''}
          <span class="yarn-preview-badge teal">${esc(typeShort)}</span>
          <span class="yarn-preview-badge blue">${esc(unit)}</span>
          ${price !== '' && parseFloat(price) > 0 ? `<span class="yarn-preview-badge">${fmtMoney(price)} ${esc(cur)}</span>` : ''}
        </div>
        ${conv ? `<div class="yarn-preview-sub" style="color:var(--accent3)">${esc(conv)}</div>` : ''}
      </div>
    </div>`;
}

// ── Yardımcılar ──
function fmtQty(n) {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

function fmtMoney(n) {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function yarnUnit(y) {
  return (y && y.unit) ? y.unit : 'kg';
}

function yarnName(y) {
  if (!y) return '-';
  const label = yarnNumaraLabel(y);
  return `${y.code} — ${label}${y.cins ? ' ' + y.cins : ''}`;
}

function lowStockBadge(y) {
  const st = parseFloat(y.current_stock) || 0;
  const min = parseFloat(y.min_stock) || 0;
  if (st <= min) return `<span class="badge badge-red">KRİTİK</span>`;
  return `<span class="badge badge-teal">Yeterli</span>`;
}

function yarnUnitOptions(selected = '') {
  const units = ['kg', 'gr', 'ton', 'koli', 'top', 'bobin', 'kutu', 'adet'];
  return units.map(u => `<option value="${u}" ${u === selected ? 'selected' : ''}>${u}</option>`).join('');
}

// ═══════════════════════════════
//  İPLİK SAYFASI (2 Sekme)
// ═══════════════════════════════
async function loadIplik() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div id="yarnStats"></div>
    <div class="filter-bar" style="justify-content:flex-start;margin-bottom:16px;gap:6px">
      <button class="btn btn-sm ${yarnActiveTab() === 'yarns' ? 'btn-primary' : 'btn-secondary'}" id="yarnTabBtn1" onclick="showYarnTab('yarns')">🧵 İplikler</button>
      <button class="btn btn-sm ${yarnActiveTab() === 'moves' ? 'btn-primary' : 'btn-secondary'}" id="yarnTabBtn2" onclick="showYarnTab('moves')">⇄ Stok Hareketleri</button>
      <button class="btn btn-sm ${yarnActiveTab() === 'report' ? 'btn-primary' : 'btn-secondary'}" id="yarnTabBtn3" onclick="showYarnTab('report')">📊 Stok Raporu</button>
    </div>
    <div id="yarnTabContent"></div>
  `;
  loadYarnStats();
  showYarnTab(yarnActiveTab());
}

function yarnActiveTab() {
  try { return sessionStorage.getItem('yarnTab') || 'yarns'; } catch (e) { return 'yarns'; }
}
function setYarnTab(t) {
  try { sessionStorage.setItem('yarnTab', t); } catch (e) { }
}

function showYarnTab(tab) {
  setYarnTab(tab);
  const btn1 = document.getElementById('yarnTabBtn1');
  const btn2 = document.getElementById('yarnTabBtn2');
  const btn3 = document.getElementById('yarnTabBtn3');
  if (btn1) { btn1.classList.toggle('btn-primary', tab === 'yarns'); btn1.classList.toggle('btn-secondary', tab !== 'yarns'); }
  if (btn2) { btn2.classList.toggle('btn-primary', tab === 'moves'); btn2.classList.toggle('btn-secondary', tab !== 'moves'); }
  if (btn3) { btn3.classList.toggle('btn-primary', tab === 'report'); btn3.classList.toggle('btn-secondary', tab !== 'report'); }
  if (tab === 'moves') loadYarnMovements();
  else if (tab === 'report') loadYarnStockReport();
  else loadYarnList();
}

// ── KPI Kartları ──
async function loadYarnStats() {
  const el = document.getElementById('yarnStats');
  if (!el) return;
  try {
    const s = await api('yarn_stats');
    const subParts = [];
    if ((s.stok_degeri_usd || 0) > 0) subParts.push(`${fmtMoney(s.stok_degeri_usd)} $`);
    if ((s.stok_degeri_eur || 0) > 0) subParts.push(`${fmtMoney(s.stok_degeri_eur)} €`);
    const subVal = subParts.length ? subParts.join(' · ') : '';
    el.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:16px">
        <div class="kpi-card">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Toplam İplik</div>
          <div class="kpi-value" style="font-size:26px;font-weight:800;color:var(--accent)">${s.toplam || 0}</div>
        </div>
        <div class="kpi-card">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Kritik Stok</div>
          <div class="kpi-value" style="font-size:26px;font-weight:800;color:${(s.kritik || 0) > 0 ? 'var(--danger)' : 'var(--accent2)'}">${s.kritik || 0}</div>
        </div>
        <div class="kpi-card">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Stok Değeri (TL)</div>
          <div class="kpi-value" style="font-size:22px;font-weight:800;color:var(--accent3)">${fmtMoney(s.stok_degeri_tl)} ₺</div>
          ${subVal ? `<div style="font-size:11px;color:var(--text3);font-weight:700">USD/EUR: ${subVal}</div>` : ''}
        </div>
        <div class="kpi-card">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Bu Dönem Giriş</div>
          <div class="kpi-value" style="font-size:26px;font-weight:800;color:var(--accent2)">${fmtQty(s.giris_qty)}</div>
          <div style="font-size:10px;color:var(--text3)">vs Çıkış ${fmtQty(s.cikis_qty)}</div>
        </div>
      </div>`;
  } catch (e) { console.warn('İplik istatistikleri yüklenemedi:', e); }
}

// ═══════════════════════════════
//  SEKME 1: İPLİK KATALOĞU
// ═══════════════════════════════
async function loadYarnList() {
  const box = document.getElementById('yarnTabContent');
  if (!box) return;
  box.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="yarnSearchInput" placeholder="🔍 Kod, numara, cins, tedarikçi ara..." oninput="filterYarns()">
      <select id="yarnFilterCins" onchange="filterYarns()"><option value="">Tüm Cinsler</option></select>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportYarnsXlsx()">📥 Excel İndir</button>
        <button class="btn btn-secondary btn-sm" onclick="importYarnsExcel()">📤 Excel İçe Aktar</button>
        <button class="btn btn-primary btn-sm" onclick="openYarnModal()">+ Yeni İplik</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr>
            <th>Kod</th><th>Numara / Kat</th><th>Birim</th><th>Mevcut Stok</th><th>Min Stok</th><th>Tedarikçi</th><th>Birim Fiyat</th><th>İşlem</th>
          </tr></thead>
          <tbody id="yarnTableBody"><tr><td colspan="9"><div class="spinner"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  filterYarns();
}

async function filterYarns() {
  try {
    const params = {};
    const s = document.getElementById('yarnSearchInput')?.value;
    if (s) params.search = s;
    const c = document.getElementById('yarnFilterCins')?.value;
    if (c) params.cins = c;

    const res = await api('yarns', params);
    _yarnCache = res.data || [];

    // Cins filtre seçeneklerini doldur
    const cinsSel = document.getElementById('yarnFilterCins');
    if (cinsSel && cinsSel.options.length <= 1) {
      const unique = [...new Set(_yarnCache.map(y => y.cins).filter(Boolean))];
      unique.forEach(cn => cinsSel.insertAdjacentHTML('beforeend', `<option value="${cn}">${cn}</option>`));
    }

    const tbody = document.getElementById('yarnTableBody');
    if (!tbody) return;
    if (!_yarnCache.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🧵</div><div class="empty-text">İplik bulunamadı</div><button class="btn btn-primary" onclick="openYarnModal()">+ Yeni İplik</button></div></td></tr>';
      return;
    }
    tbody.innerHTML = _yarnCache.map(y => {
      const conv = yarnConversion(y);
      return `
      <tr>
        <td><span style="font-weight:700;color:var(--accent3);font-family:monospace">${y.code}</span></td>
        <td style="font-size:13px">
          <span style="font-weight:800">${yarnNumaraLabel(y)}</span>
          ${y.cins ? `<span style="font-weight:600;color:var(--text2)"> ${y.cins}</span>` : ''}
          ${conv ? `<br><small style="color:var(--accent3);font-weight:600">${conv}</small>` : ''}</td>
        <td style="font-size:12px;text-align:center">${y.unit}</td>
        <td>
          <span style="font-weight:800;font-size:14px;color:${(parseFloat(y.current_stock) || 0) <= (parseFloat(y.min_stock) || 0) ? 'var(--danger)' : 'var(--accent)'}">${fmtQty(y.current_stock)}</span>
          <span style="font-size:10px;color:var(--text3)"> ${y.unit}</span><br>
          ${lowStockBadge(y)}
        </td>
        <td style="font-size:12px;text-align:center">${fmtQty(y.min_stock)}</td>
        <td style="font-size:12px">${y.supplier || '-'}</td>
        <td style="font-size:12px">${fmtMoney(y.unit_price)} <span style="font-size:10px;color:var(--text3)">${y.currency}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openYarnGirisModal(${y.id})" title="Stok Girişi">⬇ Giriş</button>
          <button class="btn btn-sm btn-secondary" onclick="openYarnCikisModal(${y.id})" title="Stok Çıkışı">⬆ Çıkış</button>
          <button class="btn btn-sm btn-secondary" onclick="openYarnModal(${y.id})" title="Düzenle">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteYarn(${y.id})" title="Sil">🗑</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

// ── İplik CRUD ──
function openYarnModal(id = 0) {
  const y = id ? getYarn(id) : null;
  const rawNumara = y ? (y.numara || '') : '';
  const numaraSlash = rawNumara.split('/');
  const numaraBase = numaraSlash.length > 1 ? numaraSlash[0] : rawNumara;
  const numaraKat = numaraSlash.length > 1 ? numaraSlash[1] : (y ? (y.kat || 1) : 1);
  const initialType = y ? (y.numara_type || yarnDetectType(rawNumara, y.cins)) : yarnDetectType('', '');
  const isCinsOther = isCustomCins(y ? y.cins : '');
  const cinsSelected = isCinsOther ? YARN_CINS_DIGER : (y ? y.cins : '');
  const unitSelected = y ? y.unit : 'kg';
  const curSelected = y ? y.currency : 'TL';

  openModal(y ? `İplik Düzenle — ${y.code}` : 'Yeni İplik', `
    <div id="yarnPreview"></div>
    <form onsubmit="saveYarn(event, ${id})">

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🧬</span> İplik Bilgileri</div>
        <div class="form-grid">
          <div class="form-floating" style="grid-column:1/-1">
            <input type="text" id="yarnCode" placeholder=" " value="${esc(y ? y.code : '')}" oninput="updateYarnPreview()" ${y ? 'readonly' : ''}>
            <label>İplik Kodu ${y ? '' : '(boş bırakılırsa IPK-xxxx otomatik)'}</label>
          </div>
          <div class="form-floating">
            <input type="text" id="yarnNumara" inputmode="decimal" placeholder=" " value="${esc(numaraBase)}" oninput="yarnNumaraInput()">
            <label>Numara (40 / 150...)</label>
          </div>
          <div class="form-floating">
            <input type="number" id="yarnKat" step="1" min="1" placeholder=" " value="${numaraKat}" oninput="yarnConversionHint();updateYarnPreview()">
            <label>Kat</label>
          </div>
        </div>
        <div class="field-hint">💡 Numara alanına "40/2" gibi yazarsanız kat otomatik ayrılır.</div>
        <div class="seg-control" id="yarnTypeSeg" style="margin-top:10px">
          ${[['nm', 'Nm'], ['ne', 'Ne'], ['denye', 'Denye (D)']].map(([v, l]) =>
            `<button type="button" class="seg-btn ${initialType === v ? 'active' : ''}" data-val="${v}" onclick="setYarnType('${v}')">${l}</button>`).join('')}
        </div>
        <select id="yarnNumaraType" style="display:none">${yarnNumaraTypeOptions(initialType)}</select>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🧵</span> Malzeme</div>
        <div class="chip-row" id="yarnCinsChips">
          ${['Pamuk', 'Polyester', 'Viskon', 'Penye', 'Akrilik', 'Yün', 'Keten', 'Elastan/Lycra', 'Karışım', 'Diğer'].map(c =>
            `<button type="button" class="chip ${cinsSelected === c ? 'active' : ''}" data-val="${c}" onclick="setYarnCins('${c}')">${c}</button>`).join('')}
        </div>
        <div class="form-floating">
          <select id="yarnCins" onchange="yarnCinsChanged()">${yarnCinsOptions(cinsSelected)}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Cins *</label>
        </div>
        <div class="form-floating" id="yarnCinsOtherWrap" style="display:${isCinsOther ? 'block' : 'none'}">
          <input type="text" id="yarnCinsOther" placeholder=" " value="${esc(isCinsOther ? (y.cins || '') : '')}" oninput="updateYarnPreview()">
          <label>Cins (Diğer — belirtin, örn. Kaşmir, Naylon...)</label>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">📦</span> Tedarik & Fiyat</div>
        <div class="form-grid">
          <div class="form-floating">
            <input type="text" id="yarnSupplier" placeholder=" " value="${esc(y ? (y.supplier || '') : '')}">
            <label>Tedarikçi</label>
          </div>
          <div class="form-floating">
            <input type="number" id="yarnPrice" step="0.01" min="0" placeholder=" " value="${esc(y ? y.unit_price : 0)}" oninput="updateYarnPreview()">
            <label>Birim Fiyat</label>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3);font-weight:700;margin-bottom:6px">Para Birimi</div>
        <div class="seg-control" id="yarnCurSeg">
          ${['TL', 'USD', 'EUR'].map(c =>
            `<button type="button" class="seg-btn ${curSelected === c ? 'active' : ''}" data-val="${c}" onclick="setYarnCurrency('${c}')">${c}</button>`).join('')}
        </div>
        <select id="yarnCurrency" style="display:none">
          <option value="TL" ${curSelected === 'TL' ? 'selected' : ''}>TL</option>
          <option value="USD" ${curSelected === 'USD' ? 'selected' : ''}>USD</option>
          <option value="EUR" ${curSelected === 'EUR' ? 'selected' : ''}>EUR</option>
        </select>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">⚖️</span> Stok & Depolama</div>
        <div style="font-size:11px;color:var(--text3);font-weight:700;margin-bottom:6px">Birim</div>
        <div class="chip-row" id="yarnUnitChips">
          ${['kg', 'gr', 'ton', 'koli', 'top', 'bobin', 'kutu', 'adet'].map(u =>
            `<button type="button" class="chip ${unitSelected === u ? 'active' : ''}" data-val="${u}" onclick="setYarnUnit('${u}')">${u}</button>`).join('')}
        </div>
        <select id="yarnUnit" style="display:none">${yarnUnitOptions(unitSelected)}</select>
        <div class="form-floating" style="margin-top:8px">
          <input type="number" id="yarnMinStock" step="0.01" min="0" placeholder=" " value="${esc(y ? y.min_stock : 0)}">
          <label>Min Stok Eşiği (kritik uyarı)</label>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">📝</span> Notlar</div>
        <div class="form-floating" style="margin-bottom:0">
          <textarea id="yarnNotes" rows="2" placeholder=" ">${esc(y ? (y.notes || '') : '')}</textarea>
          <label>Notlar</label>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `, '640px');
  yarnConversionHint();
  updateYarnPreview();
}

async function saveYarn(e, id) {
  e.preventDefault();
  const cinsSel = document.getElementById('yarnCins');
  let cins;
  if (cinsSel.value === YARN_CINS_DIGER) {
    cins = (document.getElementById('yarnCinsOther').value || '').trim();
    if (!cins) return toast('"Diğer" seçildi — lütfen cinsi belirtin', 'error');
  } else {
    cins = cinsSel.value;
  }
  if (!cins) return toast('Cins seçimi zorunludur', 'error');
  try {
    const res = await api('yarns', {
      id: id || '',
      code: document.getElementById('yarnCode').value,
      numara: document.getElementById('yarnNumara').value,
      numara_type: document.getElementById('yarnNumaraType').value,
      kat: document.getElementById('yarnKat').value,
      cins,
      unit: document.getElementById('yarnUnit').value,
      supplier: document.getElementById('yarnSupplier').value,
      unit_price: document.getElementById('yarnPrice').value,
      currency: document.getElementById('yarnCurrency').value,
      min_stock: document.getElementById('yarnMinStock').value,
      notes: document.getElementById('yarnNotes').value
    }, 'POST');
    closeModal();
    toast(id ? 'İplik güncellendi' : `İplik eklendi: ${res.code || ''}`);
    filterYarns();
    loadYarnStats();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteYarn(id) {
  if (!confirm('Bu iplik katalogdan kaldırılsın mı? Hareket geçmişi korunur.')) return;
  try {
    await api('yarn_delete', { id }, 'POST');
    toast('İplik kaldırıldı');
    filterYarns();
    loadYarnStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Stok Girişi ──
function openYarnGirisModal(id = 0) {
  const y = id ? getYarn(id) : null;
  const yarnOptions = _yarnCache.map(yy =>
    `<option value="${yy.id}" ${y && yy.id == y.id ? 'selected' : ''}>${esc(yarnName(yy))}</option>`).join('');
  openModal('⬇ Stok Girişi', `
    <form onsubmit="saveYarnMovement(event, 'giris')">
      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🧵</span> İplik</div>
        <div class="form-floating">
          <select id="ymYarn" onchange="ymFillYarnInfo()">
            <option value="">İplik seçin</option>
            ${yarnOptions}
          </select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">İplik *</label>
        </div>
        <div id="ymYarnInfoBox"><div class="yarn-select-summary">İplik seçtiğinizde bilgiler burada görünür.</div></div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🕒</span> İşlem Bilgileri</div>
        <div class="form-grid">
          <div class="form-floating">
            <input type="date" id="ymDate" placeholder=" " value="${new Date().toISOString().split('T')[0]}">
            <label>İşlem Tarihi</label>
          </div>
          <div class="form-floating">
            <input type="number" id="ymQty" step="0.01" min="0.01" placeholder=" " required>
            <label>Miktar *</label>
          </div>
          <div class="form-floating">
            <input type="number" id="ymBale" step="1" min="0" placeholder=" " value="0">
            <label>Bobin / Top Adedi</label>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🧾</span> Tedarik Belgesi</div>
        <div class="form-grid">
          <div class="form-floating">
            <input type="text" id="ymInvoice" placeholder=" " value="">
            <label>Fatura No</label>
          </div>
          <div class="form-floating">
            <input type="text" id="ymSupplier" placeholder=" " value="">
            <label>Tedarikçi</label>
          </div>
          <div class="form-floating">
            <input type="number" id="ymPrice" step="0.01" min="0" placeholder=" " value="0">
            <label>Birim Fiyat</label>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3);font-weight:700;margin-bottom:6px">Para Birimi</div>
        <div class="seg-control" id="ymCurSeg">
          ${['TL', 'USD', 'EUR'].map(c =>
            `<button type="button" class="seg-btn ${c === 'TL' ? 'active' : ''}" data-val="${c}" onclick="setYarnMovCurrency('${c}')">${c}</button>`).join('')}
        </div>
        <select id="ymCurrency" style="display:none">
          <option value="TL" selected>TL</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">📝</span> Not</div>
        <div class="form-floating" style="margin-bottom:0">
          <textarea id="ymPurpose" rows="2" placeholder=" "></textarea>
          <label>Not</label>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">⬇ Giriş Yap</button>
      </div>
    </form>
  `, '620px');
  if (y) ymFillYarnInfo();
}

// ── Stok Çıkışı ──
async function openYarnCikisModal(id = 0) {
  const y = id ? getYarn(id) : null;
  let loomOptions = '<option value="">Tezgah seçin</option>';
  try {
    const res = await api('looms');
    loomOptions += (res.data || []).map(l =>
      `<option value="${l.id}">${esc(l.name || l.loom_no || ('Tezgah ' + l.id))}</option>`).join('');
  } catch (e) { console.warn('Tezgah listesi alınamadı:', e); }

  const yarnOptions = _yarnCache.map(yy =>
    `<option value="${yy.id}" ${y && yy.id == y.id ? 'selected' : ''}>${esc(yarnName(yy))}</option>`).join('');

  let customerOptions = '<option value="">Cari seçin...</option>';
  try {
    const res = await api('customers');
    (res.data || []).forEach(c => {
      customerOptions += `<option value="${c.id}">${esc(c.name)}</option>`;
    });
    customerOptions += '<option value="custom">✍️ Diğer / Manuel girin</option>';
  } catch (e) { console.warn('Cari listesi alınamadı:', e); }

  openModal('⬆ Stok Çıkışı', `
    <form onsubmit="saveYarnMovement(event, 'cikis')">
      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🧵</span> İplik</div>
        <div class="form-floating">
          <select id="ymYarn" onchange="ymFillYarnInfo()">
            <option value="">İplik seçin</option>
            ${yarnOptions}
          </select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">İplik *</label>
        </div>
        <div id="ymYarnInfoBox"><div class="yarn-select-summary">İplik seçtiğinizde bilgiler burada görünür.</div></div>
        <div id="ymStockWarn" style="display:none"></div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🕒</span> İşlem Bilgileri</div>
        <div class="form-grid">
          <div class="form-floating">
            <input type="date" id="ymDate" placeholder=" " value="${new Date().toISOString().split('T')[0]}">
            <label>İşlem Tarihi</label>
          </div>
          <div class="form-floating">
            <input type="number" id="ymQty" step="0.01" min="0.01" placeholder=" " required>
            <label>Miktar *</label>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">🚚</span> Çıkış Türü</div>
        <div class="seg-control" id="ymCikisTipiSeg">
          <button type="button" class="seg-btn active" data-val="tezgah" onclick="setYarnCikisTipi('tezgah')">🏭 Tezgaha</button>
          <button type="button" class="seg-btn" data-val="disari" onclick="setYarnCikisTipi('disari')">🚚 Dışarıya</button>
        </div>
        <select id="ymCikisTipi" style="display:none">
          <option value="tezgah" selected>Tezgaha</option>
          <option value="disari">Dışarıya</option>
        </select>
        <div class="form-floating" id="ymLoomWrap" style="margin-top:10px">
          <select id="ymLoom">${loomOptions}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Tezgah</label>
        </div>
        <div class="form-floating" id="ymDestWrap" style="margin-top:10px;display:none">
          <select id="ymDest" onchange="ymDestChanged()">${customerOptions}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Müşteri (Cari) *</label>
        </div>
        <div class="form-floating" id="ymDestCustomWrap" style="margin-top:10px;display:none">
          <input type="text" id="ymDestCustom" placeholder=" ">
          <label>Çıkış Yeri / Teslim Edilen (el ile)</label>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title"><span class="form-section-icon">📝</span> Amaç / Not</div>
        <div class="form-floating" style="margin-bottom:0">
          <textarea id="ymPurpose" rows="2" placeholder=" "></textarea>
          <label>Amaç / Not</label>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">⬆ Çıkış Yap</button>
      </div>
    </form>
  `, '620px');
  if (y) ymFillYarnInfo();
}

function ymCikisTipiChanged() {
  const t = document.getElementById('ymCikisTipi')?.value;
  const loomWrap = document.getElementById('ymLoomWrap');
  const destWrap = document.getElementById('ymDestWrap');
  if (!loomWrap || !destWrap) return;
  loomWrap.style.display = t === 'tezgah' ? 'block' : 'none';
  destWrap.style.display = t === 'disari' ? 'block' : 'none';
}

function ymDestChanged() {
  const sel = document.getElementById('ymDest');
  const customWrap = document.getElementById('ymDestCustomWrap');
  if (!sel || !customWrap) return;
  customWrap.style.display = sel.value === 'custom' ? 'block' : 'none';
}

function ymFillYarnInfo() {
  const sel = document.getElementById('ymYarn');
  if (!sel) return;
  const y = getYarn(sel.value);
  const info = document.getElementById('ymYarnInfoBox');
  const warn = document.getElementById('ymStockWarn');
  if (y) {
    const swatch = cinsSwatch(y.cins);
    const conv = yarnConversion(y);
    const stock = parseFloat(y.current_stock) || 0;
    const min = parseFloat(y.min_stock) || 0;
    const isLow = stock <= min;
    if (info) {
      info.innerHTML = `
        <div class="yarn-preview" style="margin:8px 0 0 0">
          <div class="yarn-swatch" style="background:${swatch.bg}">${swatch.icon}</div>
          <div class="yarn-preview-info">
            <div class="yarn-preview-code">${esc(y.code || '-')} — ${esc(yarnNumaraLabel(y))}</div>
            <div class="yarn-preview-meta">
              ${y.cins ? `<span class="yarn-preview-badge purple">${esc(y.cins)}</span>` : ''}
              <span class="yarn-preview-badge blue">${esc(y.unit || 'kg')}</span>
              <span class="yarn-preview-badge ${isLow ? '' : 'teal'}">Stok: ${fmtQty(stock)} ${esc(y.unit || 'kg')}</span>
              ${conv ? `<span class="yarn-preview-badge">${esc(conv)}</span>` : ''}
            </div>
          </div>
        </div>`;
    }
    if (warn) {
      if (isLow) {
        warn.style.display = 'block';
        warn.textContent = '⚠️ Bu iplik kritik stok seviyesinde!';
      } else warn.style.display = 'none';
    }
  } else {
    if (info) info.innerHTML = '<div class="yarn-select-summary">İplik seçtiğinizde bilgiler burada görünür.</div>';
    if (warn) warn.style.display = 'none';
  }
}

async function saveYarnMovement(e, type) {
  e.preventDefault();
  const y = getYarn(document.getElementById('ymYarn').value);
  const qty = parseFloat(document.getElementById('ymQty').value) || 0;
  if (!y) return toast('İplik seçin', 'error');
  if (type === 'cikis' && qty > (parseFloat(y.current_stock) || 0)) {
    return toast(`Stoktan fazla çıkış yapılamaz. Mevcut: ${fmtQty(y.current_stock)} ${y.unit}`, 'error');
  }
  let loomId = '';
  let destination = '';
  if (type === 'cikis') {
    const tip = document.getElementById('ymCikisTipi')?.value || 'tezgah';
    if (tip === 'tezgah') {
      loomId = document.getElementById('ymLoom')?.value || '';
    } else {
      const destSel = document.getElementById('ymDest');
      if (!destSel || !destSel.value) return toast('Dışarıya çıkış için müşteri (cari) seçin', 'error');
      if (destSel.value === 'custom') {
        destination = (document.getElementById('ymDestCustom')?.value || '').trim();
        if (!destination) return toast('Çıkış yeri / teslim edilen bilgisi girin', 'error');
      } else {
        destination = destSel.options[destSel.selectedIndex].text;
      }
    }
  }
  try {
    await api('yarn_movements', {
      yarn_id: y.id,
      type,
      quantity: qty,
      bale_count: type === 'giris' ? (document.getElementById('ymBale')?.value || 0) : 0,
      invoice_no: type === 'giris' ? (document.getElementById('ymInvoice')?.value || '') : '',
      supplier: type === 'giris' ? (document.getElementById('ymSupplier')?.value || '') : '',
      unit_price: type === 'giris' ? (document.getElementById('ymPrice')?.value || 0) : 0,
      currency: type === 'giris' ? (document.getElementById('ymCurrency')?.value || 'TL') : 'TL',
      loom_id: loomId,
      destination,
      purpose: document.getElementById('ymPurpose')?.value || '',
      date: document.getElementById('ymDate').value
    }, 'POST');
    closeModal();
    toast(type === 'giris' ? 'Stok girişi kaydedildi' : 'Stok çıkışı kaydedildi');
    filterYarns();
    loadYarnStats();
    showYarnTab('moves');
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  SEKME 2: STOK HAREKETLERİ
// ═══════════════════════════════
async function loadYarnMovements() {
  const box = document.getElementById('yarnTabContent');
  if (!box) return;
  box.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="ymSearchInput" placeholder="🔍 Kod, numara, fatura, tedarikçi, amaç ara..." oninput="filterYarnMovements()">
      <select id="ymFilterYarn" onchange="filterYarnMovements()"><option value="">Tüm İplikler</option></select>
      <select id="ymFilterType" onchange="filterYarnMovements()">
        <option value="">Giriş & Çıkış</option>
        <option value="giris">⬇ Giriş</option>
        <option value="cikis">⬆ Çıkış</option>
      </select>
      <input type="date" id="ymFilterFrom" onchange="filterYarnMovements()">
      <input type="date" id="ymFilterTo" onchange="filterYarnMovements()">
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportYarnMovementsCsv()">📥 CSV İndir</button>
        <button class="btn btn-primary btn-sm" onclick="openYarnGirisModal()">⬇ Giriş</button>
        <button class="btn btn-primary btn-sm" onclick="openYarnCikisModal()">⬆ Çıkış</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr>
            <th>Tarih</th><th>İplik</th><th>Tip</th><th>Miktar</th><th>Bobin/Top</th><th>Tedarikçi / Fatura</th><th>Birim Fiyat</th><th>Tezgah / Çıkış Yeri</th><th>Amaç / Not</th><th>Kullanıcı</th><th>İşlem</th>
          </tr></thead>
          <tbody id="yarnMovBody"><tr><td colspan="11"><div class="spinner"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  filterYarnMovements();
}

async function filterYarnMovements() {
  try {
    const params = {};
    const s = document.getElementById('ymSearchInput')?.value;
    if (s) params.search = s;
    const yid = document.getElementById('ymFilterYarn')?.value;
    if (yid) params.yarn_id = yid;
    const t = document.getElementById('ymFilterType')?.value;
    if (t) params.type = t;
    const f = document.getElementById('ymFilterFrom')?.value;
    if (f) params.date_from = f;
    const to = document.getElementById('ymFilterTo')?.value;
    if (to) params.date_to = to;

    const res = await api('yarn_movements', params);
    _yarnMovCache = res.data || [];

    // İplik filtre seçeneklerini doldur
    const ySel = document.getElementById('ymFilterYarn');
    if (ySel && ySel.options.length <= 1) {
      const rows = _yarnMovCache;
      const seen = {};
      rows.forEach(m => {
        if (!seen[m.yarn_id]) {
          seen[m.yarn_id] = true;
          ySel.insertAdjacentHTML('beforeend', `<option value="${m.yarn_id}">${m.yarn_code || m.yarn_id}</option>`);
        }
      });
    }

    const tbody = document.getElementById('yarnMovBody');
    if (!tbody) return;
    if (!_yarnMovCache.length) {
      tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">⇄</div><div class="empty-text">Hareket bulunamadı</div><button class="btn btn-primary" onclick="openYarnGirisModal()">⬇ Giriş Yap</button></div></td></tr>';
      return;
    }
    tbody.innerHTML = _yarnMovCache.map(m => {
      const mLabel = yarnNumaraLabel({ numara: m.yarn_numara, kat: m.yarn_kat, numara_type: m.yarn_numara_type });
      return `
      <tr>
        <td style="font-size:12px;white-space:nowrap">${fmtDate(m.date)}</td>
        <td style="font-size:12px;font-weight:600">${m.yarn_code || '-'}<br><small style="color:var(--text3);font-weight:400">${mLabel}${m.yarn_cins ? ' ' + m.yarn_cins : ''}</small></td>
        <td>${m.type === 'giris'
          ? '<span class="badge badge-teal">⬇ Giriş</span>'
          : '<span class="badge badge-red">⬆ Çıkış</span>'}</td>
        <td style="font-weight:800;color:${m.type === 'giris' ? 'var(--accent2)' : 'var(--danger)'}">${fmtQty(m.quantity)} <span style="font-size:10px;color:var(--text3);font-weight:400">${m.yarn_unit || ''}</span></td>
        <td style="font-size:12px;text-align:center">${m.bale_count || '-'}</td>
        <td style="font-size:12px">${m.supplier ? m.supplier : ''}${m.invoice_no ? `<br><small style="color:var(--text3)">${m.invoice_no}</small>` : ''}${!m.supplier && !m.invoice_no ? '-' : ''}</td>
        <td style="font-size:12px">${m.type === 'giris' ? `${fmtMoney(m.unit_price)} <span style="font-size:10px;color:var(--text3)">${m.currency || ''}</span>` : '-'}</td>
        <td style="font-size:12px">${m.loom_name ? `🔧 ${m.loom_name}` : (m.destination ? `🚚 ${m.destination}` : '-')}</td>
        <td style="font-size:12px;max-width:180px">${m.purpose || '-'}</td>
        <td style="font-size:11px;color:var(--text3)">${m.user_name || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center;align-items:center">
            <button class="btn btn-sm btn-secondary" onclick="printYarnMovementById(${m.id}, true)" title="Fiş Önizleme">👁</button>
            <button class="btn btn-sm btn-secondary" onclick="printYarnMovementById(${m.id})" title="Fiş Yazdır">🖨</button>
            <button class="btn btn-sm btn-danger" onclick="deleteYarnMovement(${m.id})" title="Sil">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteYarnMovement(id) {
  if (!confirm('Bu stok hareketi silinsin mi? Stok dengesi güncellenecek.')) return;
  try {
    await api('yarn_movement_delete', { id }, 'POST');
    toast('Hareket silindi');
    filterYarnMovements();
    filterYarns();
    loadYarnStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ── İplik Hareket Fişi (Önizleme / Yazdırma) ──
function printYarnMovementById(id, onlyPreview = false) {
  const m = _yarnMovCache.find(x => x.id == id);
  if (!m) return toast('Hareket bulunamadı', 'error');
  printYarnMovement(m, onlyPreview);
}

function printYarnMovement(m, onlyPreview = false) {
  const isGiris = m.type === 'giris';
  const title = isGiris ? 'İPLİK STOK GİRİŞ FİŞİ' : 'İPLİK STOK ÇIKIŞ FİŞİ';
  const date = fmtDate(m.date);
  const time = (m.created_at || '').split(' ')[1] || '';
  const numaraLabel = yarnNumaraLabel({ numara: m.yarn_numara, kat: m.yarn_kat, numara_type: m.yarn_numara_type });
  const barcodeText = 'STK-' + String(m.id).padStart(6, '0');
  const qty = `${fmtQty(m.quantity)} ${m.yarn_unit || 'kg'}`;
  const price = isGiris ? `${fmtMoney(m.unit_price)} ${m.currency || 'TL'}` : '-';
  const total = isGiris ? `${fmtMoney((parseFloat(m.quantity) || 0) * (parseFloat(m.unit_price) || 0))} ${m.currency || 'TL'}` : '-';
  const supplier = m.supplier || '-';
  const invoice = m.invoice_no || '-';
  const dest = m.loom_name ? `Tezgah: ${m.loom_name}` : (m.destination ? `Çıkış Yeri: ${m.destination}` : '-');

  const printWindow = window.open('', '_blank', 'width=500,height=700');
  if (!printWindow) {
    toast('Pop-up engellendi. Lütfen tarayıcınızın pop-up engelleyicisini bu site için devre dışı bırakın.', 'warning');
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>${title} - ${barcodeText}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @media print { @page { size: A4; margin: 12mm; } }
          body { font-family: 'Helvetica', 'Arial', sans-serif; color: #111; margin: 0; font-size: 10pt; }
          .doc-title { text-align: center; font-size: 17pt; font-weight: 900; letter-spacing: 1px; padding-bottom: 8px; border-bottom: 3px double #000; margin-bottom: 14px; }
          .meta { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 14px; }
          .meta b { font-size: 11pt; }
          .meta .type-tag { font-weight: 900; font-size: 14pt; padding: 2px 14px; border: 2px solid #000; border-radius: 4px; }
          .yarn-box { border: 1.5px solid #000; padding: 10px 12px; margin-bottom: 12px; }
          .yarn-code { font-size: 15pt; font-weight: 900; letter-spacing: .5px; }
          .yarn-sub { font-size: 11pt; margin-top: 4px; }
          table.fields { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          table.fields td { border: 1px solid #000; padding: 6px 9px; vertical-align: top; }
          table.fields td.lbl { background: #f2f2f2; font-weight: 700; font-size: 8.5pt; text-transform: uppercase; width: 22%; }
          .qty-big { font-size: 15pt; font-weight: 900; }
          .barcode-box { text-align: center; margin: 16px 0 20px; border: 1px dashed #999; padding: 10px; }
          .barcode-box svg { max-width: 100%; }
          .sign-row { display: flex; justify-content: space-between; margin-top: 34px; }
          .sign { border-top: 1px solid #000; width: 42%; text-align: center; padding-top: 6px; font-size: 10pt; }
          .no-print { text-align: center; margin: 18px 0 6px; }
          .no-print button { padding: 9px 36px; font-size: 13px; font-weight: 800; cursor: pointer; border: 2px solid #000; background: #fff; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="doc-title">${title}</div>

        <div class="meta">
          <div>
            <b>Belge No:</b> ${barcodeText}<br>
            <b>Tarih:</b> ${date}${time ? ' ' + time : ''}
          </div>
          <div class="type-tag">${isGiris ? 'GİRİŞ ⬇' : 'ÇIKIŞ ⬆'}</div>
        </div>

        <div class="yarn-box">
          <div class="yarn-code">${esc(m.yarn_code || '-')} — ${esc(numaraLabel || '-')}</div>
          <div class="yarn-sub">${m.yarn_cins ? esc(m.yarn_cins) : ''} · Birim: ${esc(m.yarn_unit || 'kg')}</div>
        </div>

        <table class="fields">
          <tr><td class="lbl">Miktar</td><td class="qty-big">${qty}</td></tr>
          ${isGiris ? `<tr><td class="lbl">Bobin / Top</td><td>${m.bale_count || 0}</td></tr>` : ''}
          ${isGiris ? `<tr><td class="lbl">Tedarikçi</td><td>${esc(supplier)}</td></tr>
          <tr><td class="lbl">Fatura No</td><td>${esc(invoice)}</td></tr>
          <tr><td class="lbl">Birim Fiyat</td><td>${price}</td></tr>
          <tr><td class="lbl">Toplam Tutar</td><td>${total}</td></tr>` : ''}
          <tr><td class="lbl">${isGiris ? 'Not' : 'Tezgah / Çıkış Yeri'}</td><td>${esc(isGiris ? (m.purpose || '-') : dest)}</td></tr>
          ${!isGiris && m.purpose ? `<tr><td class="lbl">Amaç / Not</td><td>${esc(m.purpose)}</td></tr>` : ''}
          <tr><td class="lbl">Kullanıcı</td><td>${esc(m.user_name || '-')}</td></tr>
        </table>

        <div class="barcode-box">
          <svg id="barcode"></svg>
        </div>

        <div class="sign-row">
          <div class="sign">İşlem Yapan</div>
          <div class="sign">İmza</div>
        </div>

        <div class="no-print">
          <button onclick="window.print()">🖨 Yazdır / PDF Kaydet</button>
        </div>

        <script>
          JsBarcode("#barcode", "${barcodeText}", {
            format: "CODE128",
            width: 2,
            height: 46,
            displayValue: true,
            fontSize: 16,
            fontOptions: "bold",
            margin: 4
          });
          ${onlyPreview ? '' : 'window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };'}
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ═══════════════════════════════
//  DIŞA AKTARMA
// ═══════════════════════════════
function exportYarnsXlsx() {
  if (!_yarnCache || !_yarnCache.length) return toast('Dışa aktarılacak veri yok', 'warning');
  const data = _yarnCache.map(y => ({
    'Kod': y.code,
    'Numara': y.numara || '',
    'Numara Türü': yarnCountTypeShort(y.numara_type),
    'Kat': y.kat || 1,
    'Dönüşüm': yarnConversion(y),
    'Cins': y.cins || '',
    'Birim': y.unit,
    'Mevcut Stok': parseFloat(y.current_stock) || 0,
    'Min Stok': y.min_stock || 0,
    'Tedarikçi': y.supplier || '',
    'Birim Fiyat': y.unit_price || 0,
    'Para Birimi': y.currency || 'TL',
    'Notlar': y.notes || ''
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'İplikler');
  XLSX.writeFile(wb, `Iplikler_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── Excel İçe Aktarma ──
// Beklenen kolonlar (Excel İndir çıktısıyla uyumlu):
// Kod | Numara | Numara Türü | Kat | Cins | Birim | Mevcut Stok* | Min Stok | Tedarikçi | Birim Fiyat | Para Birimi | Notlar
// * Mevcut Stok aktarılmaz (stok, hareketlerden hesaplanır)
function importYarnsExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv, .xlsx, .xls';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const dataArr = new Uint8Array(event.target.result);
        const workbook = XLSX.read(dataArr, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) return toast('Dosya boş veya başlık yok', 'error');

        const headers = json[0].map(h => String(h == null ? '' : h).trim().toLowerCase());
        const rows = json.slice(1).map(row => {
          const o = {};
          headers.forEach((h, i) => {
            const val = String(row[i] == null ? '' : row[i]).trim();
            if (h.includes('kod')) o.code = val;
            else if (h.includes('numara tür') || h.includes('numara tur')) o.numara_type = val;
            else if (h.includes('numara')) o.numara = val;
            else if (h.includes('kat')) o.kat = val;
            else if (h.includes('cins')) o.cins = val;
            else if (h.includes('birim')) o.unit = val;
            else if (h.includes('min')) o.min_stock = val;
            else if (h.includes('tedarik')) o.supplier = val;
            else if (h.includes('fiyat')) o.unit_price = val;
            else if (h.includes('para') || h.includes('kur') || h.includes('currency')) o.currency = val;
            else if (h.includes('not')) o.notes = val;
          });
          return o;
        }).filter(o => o.numara || o.cins || o.code);

        if (!rows.length) {
          toast('Geçerli veri bulunamadı. Kolon başlıklarını kontrol edin.', 'warning');
          return;
        }

        openModal('Excel İçe Aktarma Önizleme', `
          <div style="margin-bottom:15px;font-size:13px;color:var(--text2)">
            <strong>${rows.length}</strong> iplik bulundu.
            <span style="color:var(--text3)">Mevcut Stok sütunu aktarılmaz — stok girişleri "Stok Hareketleri" sekmesinden yapılır.</span>
          </div>
          <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:15px">
            <table style="width:100%;font-size:11px">
              <thead style="position:sticky;top:0;background:var(--surface2)">
                <tr><th>Kod</th><th>Numara / Kat</th><th>Cins</th><th>Fiyat</th></tr>
              </thead>
              <tbody>
                ${rows.slice(0, 10).map(o => {
                  const label = yarnNumaraLabel({ numara: o.numara, kat: parseInt(o.kat) || 1, numara_type: o.numara_type });
                  return `<tr><td>${o.code || '(otomatik)'}</td><td>${label}</td><td>${o.cins || '-'}</td><td>${o.unit_price || 0} ${o.currency || ''}</td></tr>`;
                }).join('')}
                ${rows.length > 10 ? `<tr><td colspan="4" style="text-align:center;color:var(--accent)">... ve ${rows.length - 10} iplik daha</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">İptal</button>
            <button class="btn btn-primary" id="confirmYarnImport">Onayla ve Yükle</button>
          </div>
        `);

        document.getElementById('confirmYarnImport').onclick = async () => {
          const btn = document.getElementById('confirmYarnImport');
          btn.disabled = true;
          btn.textContent = 'Yükleniyor...';
          try {
            const res = await api('yarns_bulk', { data: JSON.stringify(rows) }, 'POST');
            closeModal();
            if (res && res.inserted != null) {
              toast(`${res.inserted} iplik eklendi${res.skipped ? `, ${res.skipped} atlandı` : ''}.`);
            } else {
              toast('İplikler başarıyla yüklendi.');
            }
            filterYarns();
            loadYarnStats();
          } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Onayla ve Yükle';
          }
        };
      } catch (err) {
        console.error(err);
        toast('Dosya okuma hatası! Lütfen geçerli bir Excel veya CSV dosyası seçin.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

async function exportYarnMovementsCsv() {
  try {
    const res = await api('export_yarn_movements', null, 'GET');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Iplik_Hareketleri_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════
//  İPLİK STOK RAPORU (3. SEKME)
// ═══════════════════════════════════════
let _yarnReportCache = [];

async function loadYarnStockReport() {
  const box = document.getElementById('yarnTabContent');
  if (!box) return;
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  box.innerHTML = `
    <div class="filter-bar">
      <label style="font-size:11px;font-weight:700;color:var(--text3);margin-right:4px">Dönem:</label>
      <input type="date" id="ysrFrom" value="${firstDay}" onchange="filterYarnStockReport()">
      <input type="date" id="ysrTo" value="${today}" onchange="filterYarnStockReport()">
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportYarnStockReport()">📥 Excel İndir</button>
      </div>
    </div>
    <div id="ysrStats"></div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr>
            <th>Kod</th><th>Numara / Cins</th><th>Birim</th><th>Mevcut Stok</th><th>Min Stok</th>
            <th style="text-align:right">Dönem Giriş</th><th style="text-align:right">Dönem Çıkış</th>
            <th style="text-align:right">Stok Değeri</th><th>Son Hareket</th><th>İşlem</th>
          </tr></thead>
          <tbody id="ysrTableBody"><tr><td colspan="10"><div class="spinner"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  filterYarnStockReport();
}

async function filterYarnStockReport() {
  try {
    const from = document.getElementById('ysrFrom')?.value || '';
    const to = document.getElementById('ysrTo')?.value || '';
    const res = await api('yarn_stock_report', { from, to });
    _yarnReportCache = res.data || [];
    const period = res.period || {};

    let totalStock = 0, totalValue = 0, totalValueUsd = 0, totalValueEur = 0;
    let critCount = 0, totalGiris = 0, totalCikis = 0;
    _yarnReportCache.forEach(y => {
      const cs = parseFloat(y.current_stock) || 0;
      const mp = parseFloat(y.min_stock) || 0;
      totalStock += cs;
      if (cs <= mp && mp > 0) critCount++;
      const val = cs * (parseFloat(y.unit_price) || 0);
      if (y.currency === 'USD') totalValueUsd += val;
      else if (y.currency === 'EUR') totalValueEur += val;
      else totalValue += val;
      totalGiris += parseFloat(y.period_giris) || 0;
      totalCikis += parseFloat(y.period_cikis) || 0;
    });

    const statsEl = document.getElementById('ysrStats');
    if (statsEl) {
      const subParts = [];
      if (totalValueUsd > 0) subParts.push(`${fmtMoney(totalValueUsd)} $`);
      if (totalValueEur > 0) subParts.push(`${fmtMoney(totalValueEur)} €`);
      const subVal = subParts.length ? subParts.join(' · ') : '';
      statsEl.innerHTML = `
        <div class="kpi-grid" style="margin-bottom:16px">
          <div class="kpi-card">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Toplam Stok</div>
            <div class="kpi-value" style="font-size:26px;font-weight:800;color:var(--accent)">${fmtQty(totalStock)}</div>
            <div style="font-size:11px;color:var(--text3)">${_yarnReportCache.length} İplik</div>
          </div>
          <div class="kpi-card">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Kritik Stok</div>
            <div class="kpi-value" style="font-size:26px;font-weight:800;color:${critCount > 0 ? 'var(--danger)' : 'var(--accent2)'}">${critCount}</div>
          </div>
          <div class="kpi-card">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Stok Değeri (TL)</div>
            <div class="kpi-value" style="font-size:22px;font-weight:800;color:var(--accent3)">${fmtMoney(totalValue)} ₺</div>
            ${subVal ? `<div style="font-size:11px;color:var(--text3);font-weight:700">USD/EUR: ${subVal}</div>` : ''}
          </div>
          <div class="kpi-card">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Dönem Giriş / Çıkış</div>
            <div class="kpi-value" style="font-size:22px;font-weight:800;color:var(--accent2)">${fmtQty(totalGiris)}</div>
            <div style="font-size:10px;color:var(--text3)">vs Çıkış ${fmtQty(totalCikis)}</div>
          </div>
        </div>`;
    }

    const tbody = document.getElementById('ysrTableBody');
    if (!tbody) return;
    if (!_yarnReportCache.length) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">Bu dönem için iplik bulunamadı</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = _yarnReportCache.map(y => {
      const cs = parseFloat(y.current_stock) || 0;
      const mp = parseFloat(y.min_stock) || 0;
      const pg = parseFloat(y.period_giris) || 0;
      const pc = parseFloat(y.period_cikis) || 0;
      const stockVal = cs * (parseFloat(y.unit_price) || 0);
      const isCrit = cs <= mp && mp > 0;
      return `
      <tr style="cursor:pointer" onclick="showYarnCard(${y.id})">
        <td><span style="font-weight:700;color:var(--accent3);font-family:monospace">${y.code}</span></td>
        <td style="font-size:13px">
          <span style="font-weight:800">${yarnNumaraLabel(y)}</span>
          ${y.cins ? `<span style="font-weight:600;color:var(--text2)"> ${y.cins}</span>` : ''}
        </td>
        <td style="font-size:12px;text-align:center">${y.unit}</td>
        <td>
          <span style="font-weight:800;font-size:14px;color:${isCrit ? 'var(--danger)' : 'var(--accent)'}">${fmtQty(cs)}</span>
          <span style="font-size:10px;color:var(--text3)"> ${y.unit}</span>
          ${isCrit ? '<span style="display:inline-block;background:rgba(255,80,80,.15);color:var(--danger);font-size:9px;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:4px">KRİTİK</span>' : ''}
        </td>
        <td style="font-size:12px;text-align:center">${fmtQty(mp)}</td>
        <td style="text-align:right;font-weight:700;color:var(--accent2)">${pg > 0 ? '+' + fmtQty(pg) : '-'}</td>
        <td style="text-align:right;font-weight:700;color:var(--danger)">${pc > 0 ? '-' + fmtQty(pc) : '-'}</td>
        <td style="text-align:right;font-weight:700;color:var(--accent3)">${fmtMoney(stockVal)} <span style="font-size:10px;color:var(--text3)">${y.currency}</span></td>
        <td style="font-size:11px">${y.last_movement_date ? fmtDate(y.last_movement_date) : '-'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();showYarnCard(${y.id})" title="İplik Kartı">📋</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function showYarnCard(yarnId) {
  const y = _yarnReportCache.find(x => x.id == yarnId);
  if (!y) return;
  const cs = parseFloat(y.current_stock) || 0;
  const mp = parseFloat(y.min_stock) || 0;
  const isCrit = cs <= mp && mp > 0;
  const stockVal = cs * (parseFloat(y.unit_price) || 0);

  openModal(`İplik Kartı — ${y.code}`, `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--surface2);padding:14px;border-radius:8px;border:1px solid var(--border)">
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Kod</div>
          <div style="font-weight:700;font-family:monospace;margin-top:4px;color:var(--accent3)">${y.code}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Numara</div>
          <div style="font-weight:700;margin-top:4px">${yarnNumaraLabel(y)} ${y.cins || ''}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Tedarikçi</div>
          <div style="margin-top:4px">${y.supplier || '-'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Birim Fiyat</div>
          <div style="margin-top:4px">${fmtMoney(y.unit_price)} ${y.currency}</div>
        </div>
        <div style="grid-column:1/-1;background:${isCrit ? 'rgba(255,80,80,.1)' : 'rgba(0,212,170,.1)'};border:1px solid ${isCrit ? 'var(--danger)' : 'var(--accent)'};border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Mevcut Stok</div>
          <div style="font-size:32px;font-weight:900;color:${isCrit ? 'var(--danger)' : 'var(--accent)'};margin:4px 0">${fmtQty(cs)} <span style="font-size:14px;color:var(--text3)">${y.unit}</span></div>
          ${isCrit ? `<div style="font-size:11px;color:var(--danger);font-weight:700">⚠️ Min stok seviyesinin altında! (Min: ${fmtQty(mp)} ${y.unit})</div>` : `<div style="font-size:11px;color:var(--text3)">Min: ${fmtQty(mp)} ${y.unit} · Değer: ${fmtMoney(stockVal)} ${y.currency}</div>`}
        </div>
      </div>
      <div>
        <div class="form-section">📋 Dönem Hareketleri (${y.period_giris || 0} Giriş / ${y.period_cikis || 0} Çıkış)</div>
        <div id="ycMovList" style="margin-top:8px"><div class="spinner"></div></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Kapat</button>
      </div>
    </div>
  `, '560px');

  try {
    const from = document.getElementById('ysrFrom')?.value || '';
    const to = document.getElementById('ysrTo')?.value || '';
    const res = await api('yarn_movements', { yarn_id: yarnId, date_from: from, date_to: to });
    const moves = res.data || [];
    const el = document.getElementById('ycMovList');
    if (!el) return;
    if (!moves.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">Bu dönemde hareket yok</div>';
      return;
    }
    let balance = 0;
    el.innerHTML = '<table style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Tarih</th><th>Tip</th><th style="text-align:right">Miktar</th><th style="text-align:right">Bakiye</th><th>Detay</th></tr></thead><tbody>' +
      moves.reverse().map(m => {
        const qty = parseFloat(m.quantity) || 0;
        if (m.type === 'giris') balance += qty; else balance -= qty;
        const isGiris = m.type === 'giris';
        return `<tr>
          <td style="font-size:11px">${fmtDate(m.date)}</td>
          <td style="text-align:center"><span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;background:${isGiris ? 'rgba(0,212,170,.1)' : 'rgba(255,80,80,.1)'};color:${isGiris ? 'var(--accent)' : 'var(--danger)'}">${isGiris ? 'GİRİŞ' : 'ÇIKIŞ'}</span></td>
          <td style="text-align:right;font-weight:700;color:${isGiris ? 'var(--accent)' : 'var(--danger)'}">${isGiris ? '+' : '-'}${fmtQty(qty)}</td>
          <td style="text-align:right;font-weight:800;color:${balance >= 0 ? 'var(--text)' : 'var(--danger)'}">${fmtQty(balance)}</td>
          <td style="font-size:11px;color:var(--text3)">${m.loom_name ? 'Tezgah: ' + m.loom_name : ''}${m.destination ? m.destination : ''}${m.supplier ? m.supplier : ''}</td>
        </tr>`;
      }).join('') + '</tbody></table>';
  } catch (e) { toast(e.message, 'error'); }
}

function exportYarnStockReport() {
  if (!_yarnReportCache || !_yarnReportCache.length) return toast('Dışa aktarılacak veri yok', 'warning');
  const data = _yarnReportCache.map(y => ({
    'Kod': y.code || '',
    'Numara': yarnNumaraLabel(y),
    'Cins': y.cins || '',
    'Birim': y.unit || '',
    'Mevcut Stok': parseFloat(y.current_stock) || 0,
    'Min Stok': parseFloat(y.min_stock) || 0,
    'Dönem Giriş': parseFloat(y.period_giris) || 0,
    'Dönem Çıkış': parseFloat(y.period_cikis) || 0,
    'Birim Fiyat': parseFloat(y.unit_price) || 0,
    'Para Birimi': y.currency || '',
    'Stok Değeri': (parseFloat(y.current_stock) || 0) * (parseFloat(y.unit_price) || 0),
    'Tedarikçi': y.supplier || '',
    'Son Hareket': y.last_movement_date || '',
    'Hareket Sayısı': y.movement_count || 0
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'İplik Stok Raporu');
  XLSX.writeFile(wb, `Iplik_Stok_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
}
