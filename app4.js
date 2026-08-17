/* ═══════════════════════════════════════════
   DokumaQC — Application JavaScript
   Part 4: Kartela Takip (Kumaş Numune Kartı)
   ═══════════════════════════════════════════ */

const KARTELA_STATUSES = {
  fabrikada:   { label: 'Fabrikada',    badge: 'badge-blue' },
  musteride:   { label: 'Müşteride',    badge: 'badge-yellow' },
  iade_edildi: { label: 'İade Edildi',  badge: 'badge-purple' },
  onaylandi:   { label: 'Onaylandı',    badge: 'badge-teal' },
  reddedildi:  { label: 'Reddedildi',   badge: 'badge-red' },
  kayip:       { label: 'Kayıp',        badge: 'badge-red' }
};

function kartelaStatusBadge(st) {
  const s = KARTELA_STATUSES[st] || { label: st, badge: 'badge-blue' };
  return `<span class="badge ${s.badge}">${s.label}</span>`;
}

function kartelaStatusOptions(selected = '') {
  return Object.entries(KARTELA_STATUSES).map(([k, v]) =>
    `<option value="${k}" ${k === selected ? 'selected' : ''}>${v.label}</option>`).join('');
}

function kartelaCustomerOptions(selected = '') {
  return `<option value="">Seçiniz</option>` + customers.map(c =>
    `<option value="${c.id}" ${c.id == selected ? 'selected' : ''}>${c.name}</option>`).join('');
}

let _kartelaCache = [];
function getKartela(id) { return _kartelaCache.find(k => k.id == id); }

// ═══════════════════════════════
//  KARTELA SAYFASI
// ═══════════════════════════════
async function loadKartela() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div id="kartelaStats"></div>
    <div class="filter-bar">
      <input type="text" id="kartSearchInput" placeholder="🔍 Kartela no, ürün, müşteri, konum ara..." oninput="filterKartelas()">
      <select id="kartFilterStatus" onchange="filterKartelas()">
        <option value="">Tüm Durumlar</option>
        ${Object.entries(KARTELA_STATUSES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <select id="kartFilterCustomer" onchange="filterKartelas()">
        <option value="">Tüm Müşteriler</option>
        ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <select id="kartFilterProduct" onchange="filterKartelas()">
        <option value="">Tüm Ürünler</option>
        ${products.map(p => `<option value="${p.id}">${p.code} — ${p.name}</option>`).join('')}
      </select>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportKartelas()">📥 Excel İndir</button>
        <button class="btn btn-primary btn-sm" onclick="openKartelaModal()">+ Yeni Kartela</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr>
            <th>Kartela No</th><th>Ürün / Kumaş</th><th>Müşteri</th><th>Durum</th><th>Konum</th><th>Adet</th><th>Gönderim</th><th>İade</th><th>İşlem</th>
          </tr></thead>
          <tbody id="kartTableBody"><tr><td colspan="9"><div class="spinner"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  loadKartelaStats();
  filterKartelas();
}

async function loadKartelaStats() {
  const el = document.getElementById('kartelaStats');
  if (!el) return;
  try {
    const s = await api('kartela_stats');
    const cards = [
      { label: 'Toplam', val: s.toplam || 0, color: 'var(--accent)', click: '' },
      { label: 'Fabrikada', val: s.fabrikada || 0, color: 'var(--accent3)', click: "filterKartelaStatus('fabrikada')" },
      { label: 'Müşteride', val: s.musteride || 0, color: 'var(--warning)', click: "filterKartelaStatus('musteride')" },
      { label: 'İade Edildi', val: s.iade_edildi || 0, color: 'var(--accent2)', click: "filterKartelaStatus('iade_edildi')" },
      { label: 'Onaylandı', val: s.onaylandi || 0, color: 'var(--accent)', click: "filterKartelaStatus('onaylandi')" },
      { label: 'Reddedildi', val: s.reddedildi || 0, color: 'var(--danger)', click: "filterKartelaStatus('reddedildi')" },
      { label: 'Kayıp', val: s.kayip || 0, color: 'var(--danger)', click: "filterKartelaStatus('kayip')" }
    ];
    el.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:16px">
        ${cards.map(c => `
          <div class="kpi-card" style="cursor:${c.click ? 'pointer' : 'default'}" onclick="${c.click || ''}" title="Bu durumu filtrele">
            <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${c.label}</div>
            <div class="kpi-value" style="font-size:26px;font-weight:800;color:${c.color}">${c.val}</div>
          </div>`).join('')}
      </div>`;
  } catch (e) { console.warn('Kartela istatistikleri yüklenemedi:', e); }
}

function filterKartelaStatus(status) {
  const sel = document.getElementById('kartFilterStatus');
  if (sel) { sel.value = status; filterKartelas(); }
}

async function filterKartelas() {
  try {
    const params = {};
    const s = document.getElementById('kartSearchInput')?.value;
    if (s) params.search = s;
    const st = document.getElementById('kartFilterStatus')?.value;
    if (st) params.status = st;
    const cu = document.getElementById('kartFilterCustomer')?.value;
    if (cu) params.customer_id = cu;
    const pr = document.getElementById('kartFilterProduct')?.value;
    if (pr) params.product_id = pr;

    const res = await api('kartelas', params);
    _kartelaCache = res.data || [];
    const tbody = document.getElementById('kartTableBody');
    if (!_kartelaCache.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📇</div><div class="empty-text">Kartela bulunamadı</div><button class="btn btn-primary" onclick="openKartelaModal()">+ Yeni Kartela</button></div></td></tr>';
      return;
    }
    tbody.innerHTML = _kartelaCache.map(k => `
      <tr>
        <td>
          <span style="font-weight:700;color:var(--accent3);font-family:monospace">${k.kartela_no}</span>
          <button class="btn btn-sm btn-secondary" style="margin-left:4px;padding:2px 6px" onclick="printKartelaLabel(${k.id})" title="Barkod Etiketi Yazdır">🏷</button>
        </td>
        <td style="font-size:12px;font-weight:600">
          ${k.product_code ? `<span style="color:var(--accent)">${k.product_code}</span> — ${k.product_name || ''}` : '-'}
          ${k.fabric_type_name ? `<br><small style="color:var(--text3);font-weight:400">${k.fabric_type_name}</small>` : ''}
        </td>
        <td style="font-weight:600">${k.customer_name || '-'}</td>
        <td>${kartelaStatusBadge(k.status)}</td>
        <td style="font-size:12px">${k.location || '-'}</td>
        <td style="text-align:center">${k.sample_count}</td>
        <td style="font-size:11px">${fmtDate(k.send_date)}</td>
        <td style="font-size:11px">${fmtDate(k.return_date)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="showKartelaDetail(${k.id})" title="Detay & Geçmiş">👁</button>
          <button class="btn btn-sm btn-secondary" onclick="updateKartelaStatus(${k.id})" title="Durum Değiştir">🔄</button>
          <button class="btn btn-sm btn-secondary" onclick="openKartelaModal(${k.id})" title="Düzenle">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteKartela(${k.id})" title="Sil">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  CRUD
// ═══════════════════════════════
function onKartelaProductChange() {
  const pid = document.getElementById('kartProduct').value;
  const compInput = document.getElementById('kartComposition');
  if (!compInput) return;
  if (compInput.value.trim()) return;
  const p = products.find(x => x.id == pid);
  if (p && p.composition) compInput.value = p.composition;
}

function openKartelaModal(id = 0) {
  const k = id ? getKartela(id) : null;
  openModal(k ? `Kartela Düzenle — ${k.kartela_no}` : 'Yeni Kartela', `
    <form onsubmit="saveKartela(event, ${id})">
      <div class="form-grid">
        <div class="form-floating">
          <input type="text" id="kartNo" placeholder=" " value="${k ? k.kartela_no : ''}" ${k ? 'readonly' : ''}>
          <label>Kartela No ${k ? '' : '(boş bırakılırsa otomatik)'}</label>
        </div>
        <div class="form-floating">
          <input type="number" id="kartCount" min="1" placeholder=" " value="${k ? k.sample_count : 1}">
          <label>Numune Adedi</label>
        </div>
        <div class="form-floating">
          <select id="kartProduct" onchange="onKartelaProductChange()">${productOptions(k ? k.product_id : '')}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Ürün / Kumaş</label>
        </div>
        <div class="form-floating">
          <input type="text" id="kartComposition" placeholder=" " value="${k ? (k.composition || '') : ''}">
          <label>Kompozisyon</label>
        </div>
        <div class="form-floating">
          <select id="kartFabric">${fabricTypeOptions(k ? k.fabric_type_id : '')}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Kumaş Tipi</label>
        </div>
        <div class="form-floating">
          <select id="kartCustomer">${kartelaCustomerOptions(k ? k.customer_id : '')}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Müşteri / Firma</label>
        </div>
        <div class="form-floating">
          <select id="kartStatus">${kartelaStatusOptions(k ? k.status : 'fabrikada')}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Durum</label>
        </div>
        <div class="form-floating">
          <input type="text" id="kartLocation" placeholder=" " value="${k ? (k.location || '') : ''}">
          <label>Konum (raf no vb.)</label>
        </div>
        <div class="form-floating">
          <input type="date" id="kartSendDate" placeholder=" " value="${k ? (k.send_date || '') : ''}">
          <label>Gönderim Tarihi</label>
        </div>
        <div class="form-floating">
          <input type="date" id="kartReturnDate" placeholder=" " value="${k ? (k.return_date || '') : ''}">
          <label>İade / Dönüş Tarihi</label>
        </div>
      </div>
      <div class="form-floating" style="margin-top:12px">
        <textarea id="kartNotes" rows="3" placeholder=" ">${k ? (k.notes || '') : ''}</textarea>
        <label>Notlar</label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `, '640px');
}

async function saveKartela(e, id) {
  e.preventDefault();
  try {
    const res = await api('kartelas', {
      id: id || '',
      kartela_no: document.getElementById('kartNo').value,
      product_id: document.getElementById('kartProduct').value,
      fabric_type_id: document.getElementById('kartFabric').value,
      customer_id: document.getElementById('kartCustomer').value,
      composition: document.getElementById('kartComposition').value,
      status: document.getElementById('kartStatus').value,
      location: document.getElementById('kartLocation').value,
      sample_count: document.getElementById('kartCount').value,
      send_date: document.getElementById('kartSendDate').value,
      return_date: document.getElementById('kartReturnDate').value,
      notes: document.getElementById('kartNotes').value
    }, 'POST');
    closeModal();
    toast(id ? 'Kartela güncellendi' : `Kartela eklendi: ${res.kartela_no || ''}`);
    filterKartelas();
    loadKartelaStats();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteKartela(id) {
  if (!confirm('Bu kartela silinsin mi?')) return;
  try {
    await api('kartela_delete', { id }, 'POST');
    toast('Kartela silindi');
    filterKartelas();
    loadKartelaStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  DURUM GÜNCELLEME
// ═══════════════════════════════
function updateKartelaStatus(id) {
  const k = getKartela(id);
  if (!k) return;
  openModal(`Durum Değiştir — ${k.kartela_no}`, `
    <form onsubmit="executeStatusUpdate(event, ${id})">
      <div class="form-grid">
        <div class="form-floating">
          <select id="kartNewStatus">${kartelaStatusOptions(k.status)}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Yeni Durum</label>
        </div>
        <div class="form-floating">
          <input type="date" id="kartStatusDate" placeholder=" " value="${new Date().toISOString().split('T')[0]}">
          <label>Tarih</label>
        </div>
      </div>
      <div class="form-floating" style="margin-top:12px">
        <textarea id="kartStatusNotes" rows="2" placeholder=" "></textarea>
        <label>Not</label>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:14px">ℹ️ Müşteride'ye geçiş Gönderim tarihini, İade/Onay/Red geçişleri İade tarihini otomatik günceller.</div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Durumu Güncelle</button>
      </div>
    </form>
  `, '480px');
}

async function executeStatusUpdate(e, id) {
  e.preventDefault();
  try {
    await api('kartela_status_update', {
      id,
      status: document.getElementById('kartNewStatus').value,
      date: document.getElementById('kartStatusDate').value,
      notes: document.getElementById('kartStatusNotes').value
    }, 'POST');
    closeModal();
    toast('Durum güncellendi');
    filterKartelas();
    loadKartelaStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  DETAY & GEÇMİŞ
// ═══════════════════════════════
async function showKartelaDetail(id) {
  const k = getKartela(id);
  if (!k) return;
  openModal(`Kartela Detay — ${k.kartela_no}`, `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--surface2);padding:14px;border-radius:8px;border:1px solid var(--border)">
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Durum</div>
          <div style="margin-top:4px">${kartelaStatusBadge(k.status)}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Ürün</div>
          <div style="font-weight:600;margin-top:4px">${k.product_code ? `${k.product_code} — ${k.product_name || ''}` : '-'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Kompozisyon</div>
          <div style="font-weight:600;margin-top:4px">${k.composition || '-'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Kumaş Tipi</div>
          <div style="margin-top:4px">${k.fabric_type_name || '-'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Müşteri</div>
          <div style="font-weight:600;margin-top:4px">${k.customer_name || '-'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Konum</div>
          <div style="margin-top:4px">${k.location || '-'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Numune Adedi</div>
          <div style="margin-top:4px">${k.sample_count}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Gönderim</div>
          <div style="margin-top:4px">${fmtDate(k.send_date)}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">İade</div>
          <div style="margin-top:4px">${fmtDate(k.return_date)}</div>
        </div>
        ${k.notes ? `
        <div style="grid-column:1/-1">
          <div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Notlar</div>
          <div style="margin-top:4px;font-size:13px;white-space:pre-wrap">${k.notes}</div>
        </div>` : ''}
      </div>
      <div>
        <div class="form-section">📜 Durum Geçmişi</div>
        <div id="kartHistoryList" style="margin-top:8px"><div class="spinner"></div></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="printKartelaLabel(${id})">🏷 Barkod Yazdır</button>
        <button type="button" class="btn btn-secondary" onclick="updateKartelaStatus(${id})">🔄 Durum Değiştir</button>
        <button type="button" class="btn btn-primary" onclick="closeModal()">Kapat</button>
      </div>
    </div>
  `, '560px');

  try {
    const res = await api('kartela_history', { kartela_id: id });
    const rows = res.data || [];
    const el = document.getElementById('kartHistoryList');
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">Geçmiş kaydı yok</div>';
      return;
    }
    el.innerHTML = rows.map(h => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
        ${kartelaStatusBadge(h.status)}
        <div style="flex:1;font-size:12px">${h.notes ? h.notes : '<span style="color:var(--text3)">(not yok)</span>'}</div>
        <div style="text-align:right;font-size:10px;color:var(--text3)">${fmtDate(h.date)}<br>${h.user_name || ''}</div>
      </div>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  BARKOD ETİKETİ YAZDIRMA
// ═══════════════════════════════
function printKartelaLabel(id) {
  const k = getKartela(id);
  if (!k) return;
  const company = appSettings.company_name || 'DokumaQC';
  const stLabel = (KARTELA_STATUSES[k.status] || { label: k.status }).label;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    toast('Pop-up engellendi. Lütfen tarayıcınızın pop-up engelleyicisini bu site için devre dışı bırakın.', 'warning');
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>Kartela Etiket - ${k.kartela_no}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <style>
          @page { size: 60mm 40mm; margin: 0; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            padding: 2mm; text-align: center; color: #000; margin: 0; background: #fff;
          }
          .label-box {
            border: 1mm solid #000; height: 100%; display: flex; flex-direction: column;
            padding: 2mm; box-sizing: border-box; page-break-inside: avoid;
          }
          .brand { font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 2px; }
          .title { font-size: 13px; font-weight: 900; letter-spacing: 2px; }
          .barcode-wrapper { margin: 2px 0; display: flex; justify-content: center; }
          #barcode { max-width: 100%; height: auto; }
          .kno { font-family: monospace; font-weight: 800; font-size: 12px; }
          .info-row { display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 700; margin: 1px 0; }
          .info-label { color: #555; font-size: 7px; font-weight: 700; text-transform: uppercase; }
          .status-tag { border: 1px solid #000; padding: 1px 5px; border-radius: 3px; font-weight: 800; font-size: 8px; }
        </style>
      </head>
      <body>
        <div class="label-box">
          <div class="brand">${company}</div>
          <div class="title">KARTELA</div>
          <div class="barcode-wrapper"><svg id="barcode"></svg></div>
          <div class="kno">${k.kartela_no}</div>
          <div class="info-row"><span class="info-label">Ürün</span><span>${k.product_code || '-'} ${k.product_name || ''}</span></div>
          ${k.composition ? `<div class="info-row"><span class="info-label">Kompozisyon</span><span style="font-size:7px">${k.composition}</span></div>` : ''}
          <div class="info-row"><span class="info-label">Müşteri</span><span>${k.customer_name || '-'}</span></div>
          <div class="info-row"><span class="info-label">Adet</span><span>${k.sample_count}</span><span class="status-tag">${stLabel}</span></div>
        </div>
        <script>
          JsBarcode("#barcode", "${k.kartela_no}", { format: "CODE128", width: 2, height: 32, displayValue: false, margin: 0 });
          setTimeout(function () { window.print(); }, 400);
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ═══════════════════════════════
//  EXCEL DIŞA AKTARMA
// ═══════════════════════════════
function exportKartelas() {
  if (!_kartelaCache || !_kartelaCache.length) return toast('Dışa aktarılacak veri yok', 'warning');
  const data = _kartelaCache.map(k => ({
    'Kartela No': k.kartela_no,
    'Ürün Kodu': k.product_code || '',
    'Ürün Adı': k.product_name || '',
    'Kompozisyon': k.composition || '',
    'Kumaş Tipi': k.fabric_type_name || '',
    'Müşteri': k.customer_name || '',
    'Durum': (KARTELA_STATUSES[k.status] || { label: k.status }).label,
    'Konum': k.location || '',
    'Numune Adedi': k.sample_count,
    'Gönderim Tarihi': k.send_date || '',
    'İade Tarihi': k.return_date || '',
    'Notlar': k.notes || ''
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kartela Listesi');
  XLSX.writeFile(wb, `Kartela_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
}
