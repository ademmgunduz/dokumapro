/* ═══════════════════════════════════════════
   DokumaQC — Application JavaScript
   Part 3: Shipment & Packing List
   ═════════════════════════════════════════ */

// Güvenlik: app2.js veya app.js yüklenemezse diye tanımla
if (typeof fmt === 'undefined') {
  function fmt(v, d=1) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
}

if (typeof fmtDate === 'undefined') {
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('tr-TR'); }
    catch(e) { return '—'; }
  }
}

// ══════════════════════════════
//  SHIPMENT LIST
// ══════════════════════════════
let allShipments = [];

async function loadShipments() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div class="filter-bar" style="flex-wrap:wrap; gap:8px">
      <h2 style="margin:0; font-size:18px; color:var(--text)">🚚 Sevkiyat ve Çeki Listeleri</h2>
      <div style="margin-left:auto; display:flex; gap:6px; align-items:center; flex-wrap:wrap">
        <input type="date" id="shipmentDateFilter" onchange="filterShipments()" style="height:32px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 8px; width:140px">
        <input type="text" id="shipmentCustomerFilter" placeholder="Müşteri..." oninput="filterShipments()" style="height:32px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 8px; width:120px">
        <input type="text" id="shipmentQualityFilter" placeholder="Kalite..." oninput="filterShipments()" style="height:32px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 8px; width:120px">
        <input type="text" id="shipmentPlateFilter" placeholder="Plaka..." oninput="filterShipments()" style="height:32px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 8px; width:100px">
        <select id="shipmentStatusFilter" onchange="filterShipments()" style="height:32px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 6px">
          <option value="">Tüm Durumlar</option>
          <option value="hazırlanıyor">Hazırlanıyor</option>
          <option value="sevk edildi">Sevk Edildi</option>
        </select>
        <button class="btn btn-sm btn-secondary" onclick="clearShipmentFilters()" style="font-size:11px; padding:4px 10px">✕ Temizle</button>
        <button class="btn btn-primary btn-sm" onclick="loadShipmentForm()" style="height:32px">+ Yeni Sevkiyat</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table class="toplu-table">
          <thead>
            <tr>
              <th style="width:60px">ID</th>
              <th>Tarih</th>
              <th>Müşteri</th>
              <th>Kalite</th>
              <th>Adres / Plaka</th>
              <th style="text-align:center">Top</th>
              <th style="text-align:center">Metraj</th>
              <th style="text-align:center">Kilo</th>
              <th>Durum</th>
              <th style="text-align:right">İşlem</th>
            </tr>
          </thead>
          <tbody id="shipmentTableBody">
            <tr><td colspan="10"><div class="spinner"></div></td></tr>
          </tbody>
          <tfoot id="shipmentTableFoot" style="background:var(--surface2); font-weight:800; border-top:2px solid var(--border)">
          </tfoot>
        </table>
      </div>
    </div>
  `;

  try {
    const res = await api('shipments');
    allShipments = res.data || [];
    renderShipmentList(allShipments);
  } catch (e) { toast(e.message, 'error'); }
}

function filterShipments() {
  const dateVal = document.getElementById('shipmentDateFilter').value;
  const cust = document.getElementById('shipmentCustomerFilter').value.toLowerCase();
  const qual = document.getElementById('shipmentQualityFilter').value.toLowerCase();
  const plate = document.getElementById('shipmentPlateFilter').value.toLowerCase();
  const status = document.getElementById('shipmentStatusFilter').value;
  
  const filtered = allShipments.filter(s => {
    const matchDate = !dateVal || s.shipment_date === dateVal;
    const matchCust = !cust || (s.customer_name || '').toLowerCase().includes(cust);
    const matchQual = !qual || (s.products_text || '').toLowerCase().includes(qual);
    const matchPlate = !plate || (s.plate_no || '').toLowerCase().includes(plate);
    const matchStatus = !status || s.status === status;
    return matchDate && matchCust && matchQual && matchPlate && matchStatus;
  });
  
  renderShipmentList(filtered);
}

function clearShipmentFilters() {
  ['shipmentDateFilter','shipmentCustomerFilter','shipmentQualityFilter','shipmentPlateFilter','shipmentStatusFilter']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  filterShipments();
}

function renderShipmentList(data) {
  const tbody = document.getElementById('shipmentTableBody');
  const tfoot = document.getElementById('shipmentTableFoot');
  
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding:40px; text-align:center; color:var(--text3)">Arama kriterlerine uygun sevkiyat bulunamadı.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  let grandRolls = 0;
  let grandMeters = 0;
  let grandWeight = 0;

  tbody.innerHTML = data.map(s => {
    const rolls = parseInt(s.roll_count || 0);
    const meters = parseFloat(s.total_meters || 0);
    const weight = parseFloat(s.total_weight || 0);
    grandRolls += rolls;
    grandMeters += meters;
    grandWeight += weight;
    
    return `
      <tr>
        <td style="color:var(--text3)">#${s.id}</td>
        <td>${fmtDate(s.shipment_date)}</td>
        <td style="font-weight:700; color:var(--text)">${s.customer_name || '-'}${s.order_no ? `<br><small style="color:var(--accent); font-size:10px">📋 ${s.order_no}</small>` : ''}</td>
        <td style="font-size:12px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
          ${s.products_text ? `<span style="font-weight:600; color:var(--text)">${s.products_text}</span>` : '<span style="color:var(--text3)">—</span>'}
        </td>
        <td style="font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
           ${s.shipping_address || '-'} <br>
           <small style="color:var(--accent)">🚗 ${s.plate_no || '-'}</small>
        </td>
        <td style="text-align:center; font-weight:700">${rolls}</td>
        <td style="text-align:center; font-weight:700; color:var(--accent)">${meters.toFixed(1)} mt</td>
        <td style="text-align:center; font-weight:700; color:var(--purple)">${weight.toFixed(1)} kg</td>
        <td><span class="badge ${s.status==='hazırlanıyor'?'badge-yellow':'badge-teal'}">${s.status.toUpperCase()}</span></td>
        <td style="text-align:right">
          <div style="display:flex; gap:4px; justify-content:flex-end">
            <button class="btn btn-sm btn-icon btn-secondary" onclick="viewShipmentDetails(${s.id})" title="Detay">👁</button>
            <button class="btn btn-sm btn-icon btn-secondary" onclick="loadShipmentForm(${s.id})" title="Düzenle">✏️</button>
            <button class="btn btn-sm btn-icon" style="background:${s.status==='sevk edildi'?'var(--warning)':'var(--accent)'}; color:#fff; border:none" onclick="toggleShipmentStatus(${s.id},'${s.status}')" title="${s.status==='sevk edildi'?'Geri Al':'Sevk Et'}">${s.status==='sevk edildi'?'↩️':'🚚'}</button>
            <button class="btn btn-sm btn-icon btn-danger" onclick="deleteShipment(${s.id})" title="Sil">🗑</button>
            <button class="btn btn-sm btn-secondary" onclick="printPackingList(${s.id}, true)" style="border-color:var(--text3); color:var(--text3); padding:4px 8px; font-size:10px">📋 ÖNİZLE</button>
            <button class="btn btn-sm btn-secondary" onclick="printPackingList(${s.id})" style="border-color:var(--accent); color:var(--accent); padding:4px 8px; font-size:10px">🖨 ÇEKİ</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tfoot.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:right; color:var(--text2)">TOPLAM (${data.length} Sevk):</td>
      <td style="text-align:center; color:var(--text)">${grandRolls} Top</td>
      <td style="text-align:center; color:var(--accent)">${grandMeters.toFixed(1)} mt</td>
      <td style="text-align:center; color:var(--purple)">${grandWeight.toFixed(1)} kg</td>
      <td colspan="2"></td>
    </tr>
  `;
}


// ═══════════════════════════════
//  SHIPMENT FORM (NEW / EDIT)
// ═══════════════════════════════
let selectedRolls = [];
let availableStock = [];
let currentShipmentId = null;

async function loadShipmentForm(id = null) {
  currentShipmentId = id;
  selectedRolls = [];
  let shipmentData = null;

  if (id) {
    try {
      const res = await api('shipment_details', { id });
      shipmentData = res.data.shipment;
      selectedRolls = res.data.items.map(it => it.id);
    } catch (e) {
      toast('Sevkiyat detayları yüklenemedi: ' + e.message, 'error');
      return;
    }
  }

  if (!activeOrders || !activeOrders.length) {
    try {
      const oRes = await api('orders');
      activeOrders = oRes.data || [];
    } catch {}
  }

  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div class="filter-bar">
      <button class="btn btn-secondary btn-sm" onclick="loadShipments()">⬅ Listeye Dön</button>
      <h2 style="margin:0 0 0 10px; font-size:16px; color:var(--text)">📦 ${id ? 'Sevkiyatı Düzenle (#' + id + ')' : 'Yeni Sevkiyat Hazırla'}</h2>
    </div>

    <div class="grid-2" style="grid-template-columns: 1fr 1.5fr; gap:20px; align-items:start">
      <!-- SOL: SEVKİYAT BİLGİLERİ -->
      <div class="panel">
        <div class="panel-head"><span class="panel-title">📝 Sevkiyat Bilgileri</span></div>
        <div class="panel-body">
          <form id="shipmentForm" onsubmit="saveShipment(event)">
            <input type="hidden" id="shipId" value="${id || ''}">
            <div class="form-grid">
              <div class="form-floating form-full">
                <select id="shipCustomer" required onchange="updateShipAddress(this.value)">
                  <option value="">Müşteri Seçiniz...</option>
                  ${customers.map(c => `<option value="${c.id}" ${shipmentData && shipmentData.customer_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
                <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Alıcı Müşteri *</label>
              </div>
              <div class="form-floating form-full">
                <select id="shipOrder">
                  <option value="">Sipariş Seçin... (Opsiyonel)</option>
                  ${(activeOrders || []).filter(o => o.status !== 'Tamamlandı' && o.status !== 'İptal').map(o => `<option value="${o.id}" ${shipmentData && shipmentData.order_id == o.id ? 'selected' : ''}>${o.order_no} — ${o.customer_name}</option>`).join('')}
                </select>
                <label>Bağlı Sipariş / Proje</label>
              </div>
              <div class="form-floating">
                <input type="date" id="shipDate" required value="${shipmentData ? shipmentData.shipment_date : new Date().toISOString().split('T')[0]}">
                <label>Sevkiyat Tarihi *</label>
              </div>
              <div class="form-floating">
                <input type="text" id="shipPlate" placeholder=" " value="${shipmentData ? shipmentData.plate_no || '' : ''}">
                <label>Araç Plaka / Şoför</label>
              </div>
              <div class="form-floating form-full">
                <textarea id="shipAddress" placeholder=" " rows="2">${shipmentData ? shipmentData.shipping_address || '' : ''}</textarea>
                <label>Teslimat Adresi</label>
              </div>
              <div class="form-floating form-full">
                <textarea id="shipNotes" placeholder=" " rows="2">${shipmentData ? shipmentData.notes || '' : ''}</textarea>
                <label>Notlar</label>
              </div>
              <div class="form-floating form-full">
                <select id="shipStatus">
                  <option value="hazırlanıyor" ${(!shipmentData || shipmentData.status === 'hazırlanıyor') ? 'selected' : ''}>Hazırlanıyor</option>
                  <option value="sevk edildi" ${shipmentData && shipmentData.status === 'sevk edildi' ? 'selected' : ''}>Sevk Edildi</option>
                </select>
                <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Durum</label>
              </div>
            </div>

            <div style="margin-top:20px; padding:16px; background:var(--s2); border-radius:8px; border:1px solid var(--border)">
               <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                  <span style="font-size:13px; color:var(--text2)">Seçilen Top Sayısı:</span>
                  <strong id="totalRollCount" style="color:var(--text)">0 Adet</strong>
               </div>
               <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                  <span style="font-size:13px; color:var(--text2)">Toplam Metraj:</span>
                  <strong id="totalShipMeters" style="color:var(--accent)">0 mt</strong>
               </div>
            </div>

            <div style="display:flex; gap:10px; margin-top:20px">
              <button type="submit" class="btn btn-primary" style="flex:1">💾 SEVKİYATI KAYDET</button>
              ${id ? `<button type="button" class="btn btn-secondary" onclick="printPackingList(${id})">🖨️ ÇEKİ LİSTESİ AL</button>` : ''}
            </div>
          </form>
        </div>
      </div>

      <!-- SAĞ: TOP SEÇİMİ -->
      <div class="panel">
        <div class="panel-head" style="display:flex; justify-content:space-between; align-items:center; gap:10px">
          <span class="panel-title">🔍 Stoktan Top Seç</span>
          <div style="display:flex; gap:8px; align-items:center; flex:1; justify-content:flex-end">
              <input type="text" id="shipStockSearch" placeholder="Top No, Ürün, Sipariş veya Müşteri Ara..."
                    style="background:var(--surface); border:1px solid var(--border); color:var(--text); padding:4px 10px; border-radius:4px; width:160px; font-size:11px"
                    oninput="renderShipmentStock()">
             <div style="background:var(--surface); padding:4px 12px; border-radius:20px; border:1px solid var(--accent)">
                <input type="text" id="shipBarcodeSearch" placeholder="BARKOD OKUT..." 
                       style="background:transparent; border:none; color:var(--accent); font-weight:700; width:100px; outline:none; font-size:11px"
                       onkeypress="handleShipmentBarcode(event)">
             </div>
             <button class="btn btn-secondary btn-sm" onclick="loadAvailableStock(currentShipmentId)" title="Stoku Yenile">🔄</button>
             <button class="btn btn-secondary btn-sm" onclick="selectAllFilteredRolls()" style="background:var(--surface2); color:var(--accent); border-color:var(--accent); font-weight:600">✓ Tümünü Seç</button>
          </div>
        </div>
        <div class="panel-body" style="padding:0">
           <div style="max-height:600px; overflow-y:auto">
              <table style="font-size:11px">
                <thead>
                  <tr>
                    <th style="width:30px">Seç</th>
                    <th>Top No</th>
                    <th>LOT</th>
                    <th>Ürün / Kalite</th>
                    <th>Sipariş / Müşteri</th>
                    <th style="text-align:center">MT</th>
                    <th style="text-align:center">KG</th>
                  </tr>
                </thead>
                <tbody id="shipStockBody">
                  <tr><td colspan="7"><div class="spinner"></div></td></tr>
                </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  `;

  loadAvailableStock(id);
}

async function loadAvailableStock(shipmentId = null) {
  try {
    const res = await api('stock_rolls', { shipment_id: shipmentId || '' });
    availableStock = res.data || [];
    renderShipmentStock();
  } catch (e) { toast(e.message, 'error'); }
}

function renderShipmentStock() {
  const tbody = document.getElementById('shipStockBody');
  const search = document.getElementById('shipStockSearch')?.value.toLowerCase() || '';

  if (!availableStock.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px">Stokta sevk edilecek top bulunamadı.</td></tr>';
    return;
  }

  const filtered = availableStock.filter(r => {
    return (r.roll_no || '').toLowerCase().includes(search) || 
           (r.lot_no || '').toLowerCase().includes(search) || 
           (r.product_code || '').toLowerCase().includes(search) ||
           (r.product_name || '').toLowerCase().includes(search) ||
           (r.order_no || '').toLowerCase().includes(search) ||
           (r.customer_name || '').toLowerCase().includes(search);
  });

  tbody.innerHTML = filtered.map(r => `
    <tr id="row-${r.id}" onclick="toggleRollSelection(${r.id})" style="cursor:pointer; ${selectedRolls.includes(r.id) ? 'background:rgba(0,212,170,0.1)' : ''}">
      <td><input type="checkbox" ${selectedRolls.includes(r.id) ? 'checked' : ''} style="pointer-events:none"></td>
      <td style="font-weight:600">${r.roll_no}</td>
      <td style="color:var(--warning); font-weight:600">${r.lot_no || '-'}</td>
      <td style="color:var(--text2)">${r.product_code || '-'} <br> <small>${r.product_name || '-'}</small></td>
      <td>${r.order_no ? '<span style="font-weight:600;color:var(--accent)">' + r.order_no + '</span>' + (r.customer_name ? '<br><small style="color:var(--text2)">' + r.customer_name + '</small>' : '') : '<span style="color:var(--text3);font-size:10px">—</span>'}</td>
      <td style="font-weight:700; color:var(--accent); text-align:center">${r.length_m}</td>
      <td style="text-align:center">${r.weight_kg || '0'}</td>
    </tr>
  `).join('');
  
  if (!filtered.length && search) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px">Arama sonucunda top bulunamadı.</td></tr>';
  }
  
  updateShipmentSummaries();
}

function handleShipmentBarcode(e) {
  if (e.key === 'Enter') {
    const code = e.target.value.trim();
    const roll = availableStock.find(r => r.roll_no === code || r.barcode === code);
    if (roll) {
      if (!selectedRolls.includes(roll.id)) {
        selectedRolls.push(roll.id);
        renderShipmentStock();
        toast('Top eklendi: ' + roll.roll_no);
      } else {
        toast('Bu top zaten seçili', 'info');
      }
    } else {
      toast('Top stokta bulunamadı!', 'error');
    }
    e.target.value = '';
    e.target.focus();
  }
}

function selectAllFilteredRolls() {
  const search = document.getElementById('shipStockSearch')?.value.toLowerCase() || '';
  const filtered = availableStock.filter(r => {
    return (r.roll_no || '').toLowerCase().includes(search) || 
           (r.lot_no || '').toLowerCase().includes(search) || 
           (r.product_code || '').toLowerCase().includes(search) ||
           (r.product_name || '').toLowerCase().includes(search) ||
           (r.order_no || '').toLowerCase().includes(search) ||
           (r.customer_name || '').toLowerCase().includes(search);
  });

  filtered.forEach(r => {
    if (!selectedRolls.includes(r.id)) {
      selectedRolls.push(r.id);
    }
  });
  
  renderShipmentStock();
  toast(`${filtered.length} adet top listeye eklendi.`);
}

function toggleRollSelection(id) {
  const idx = selectedRolls.indexOf(id);
  if (idx > -1) selectedRolls.splice(idx, 1);
  else selectedRolls.push(id);
  renderShipmentStock();
}

function updateShipmentSummaries() {
  const selectedData = availableStock.filter(r => selectedRolls.includes(r.id));
  const totalMeters = selectedData.reduce((sum, r) => sum + parseFloat(r.length_m), 0);
  
  const rollCountElem = document.getElementById('totalRollCount');
  const shipMetersElem = document.getElementById('totalShipMeters');
  
  if (rollCountElem) rollCountElem.textContent = selectedRolls.length + ' Adet';
  if (shipMetersElem) shipMetersElem.textContent = totalMeters.toFixed(1) + ' mt';
}

function updateShipAddress(custId) {
  const c = customers.find(x => x.id == custId);
  if (c && c.notes) {
    document.getElementById('shipAddress').value = c.notes;
  }
}

async function saveShipment(e) {
  e.preventDefault();
  if (selectedRolls.length === 0) {
    alert('Lütfen en az bir top seçiniz!');
    return;
  }

  try {
    const sid = document.getElementById('shipId').value;
    const res = await api('shipments', {
      id: sid,
      customer_id: document.getElementById('shipCustomer').value,
      order_id: document.getElementById('shipOrder')?.value || null,
      shipment_date: document.getElementById('shipDate').value,
      shipping_address: document.getElementById('shipAddress').value,
      plate_no: document.getElementById('shipPlate').value,
      notes: document.getElementById('shipNotes').value,
      status: document.getElementById('shipStatus').value
    }, 'POST');

    if (res.success) {
      const shipmentId = res.id;
      await api('shipment_add_rolls', {
        shipment_id: shipmentId,
        roll_ids: JSON.stringify(selectedRolls)
      }, 'POST');
      
      toast('Sevkiyat başarıyla kaydedildi');
      if (!sid) {
        // Yeni kayıt ise düzenleme moduna geç ki Yazdır butonu görünsün
        loadShipmentForm(shipmentId);
      }
      // printPackingList(shipmentId); // Otomatik yazdırı kaldırdım, kullanıcı butona basacak
    }
  } catch (e) { toast(e.message, 'error'); }
}

function deleteShipment(id) {
  openModal('Sevkiyat Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:12px;color:var(--text)">Sevkiyat kaydını silmek istediğinize emin misiniz?</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:24px">Bu işlem sonucunda sevkiyattaki tüm toplar tekrar stoğa dönecektir.</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button type="button" class="btn btn-danger" onclick="executeDeleteShipment(${id})">Evet, Sil</button>
      </div>
    </div>
  `);
}

async function executeDeleteShipment(id) {
  closeModal();
  try {
    await api('shipment_delete', { id }, 'POST');
    toast('Sevkiyat silindi ve toplar stoğa aktarıldı');
    loadShipments();
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleShipmentStatus(id, currentStatus) {
  const newStatus = currentStatus === 'hazırlanıyor' ? 'sevk edildi' : 'hazırlanıyor';
  const label = newStatus === 'sevk edildi' ? 'Sevk Edildi' : 'Hazırlanıyor';
  try {
    await api('shipments', { id, status: newStatus }, 'POST');
    toast(`Sevkiyat #${id} durumu → ${label}`);
    loadShipments();
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  PACKING LIST PRINTING (A4 OPTIMIZED)
// ═══════════════════════════════
async function printPackingList(id, onlyPreview = false) {
  try {
    const res = await api('shipment_details', { id });
    const { shipment, items } = res.data;
    
    let totalMt = 0;
    let totalKg = 0;
    items.forEach(i => {
      totalMt += parseFloat(i.length_m);
      totalKg += parseFloat(i.weight_kg || 0);
    });

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast('Pop-up engellendi. Lütfen tarayıcınızın pop-up engelleyicisini bu site için devre dışı bırakın ve tekrar deneyin.', 'warning');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Çeki Listesi - #${shipment.id}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @media print { @page { size: A4; margin: 10mm; } }
            body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.2; font-size: 9pt; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .header-table td { vertical-align: top; padding: 5px; }
            .title { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            
            table.packing-list { width: 100%; border-collapse: collapse; }
            table.packing-list th, table.packing-list td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
            table.packing-list th { background: #f0f0f0; font-size: 8pt; text-transform: uppercase; }
            table.packing-list td { font-size: 8pt; }
            table.packing-list td .roll-bc svg { max-width: 90px; height: 24px; }
            table.packing-list td .roll-bc { margin-top: 2px; }
            
            .doc-barcode { text-align: center; margin-top: 8px; }
            .doc-barcode svg { max-width: 160px; height: 34px; }
            
            .summary { margin-top: 15px; text-align: right; font-weight: bold; font-size: 10pt; }
            .footer-notes { margin-top: 20px; border-top: 1px dashed #999; padding-top: 10px; font-size: 8pt; font-style: italic; }
            
            .packing-list tr { height: 18px; }
          </style>
        </head>
        <body>
          <div class="title">ÇEKİ LİSTESİ (PACKING LIST)</div>
          
          <table class="header-table">
            <tr>
              <td style="width:60%">
                <strong>ALICI MÜŞTERİ:</strong><br>
                <span style="font-size:12pt">${shipment.customer_name}</span><br>
                ${shipment.shipping_address || ''}
              </td>
              <td style="text-align:right">
                <strong>SEVKİYAT TARİHİ:</strong> ${fmtDate(shipment.shipment_date)}<br>
                <strong>ARAÇ / PLAKA:</strong> ${shipment.plate_no || '-'}<br>
                <strong>BELGE NO:</strong> #${shipment.id}
                <div class="doc-barcode"><svg id="bc-ship"></svg></div>
              </td>
            </tr>
          </table>

          <table class="packing-list">
            <thead>
              <tr>
                <th style="width:40px">SIRA</th>
                <th style="width:30px">TZ</th>
                <th>TOP NUMARASI / BARKOD</th>
                <th>LOT NO</th>
                <th>ÜRÜN / KALİTE ADI</th>
                <th>METRE (MT)</th>
                <th>KİLO (KG)</th>
                <th>BRÜT KG</th>
                <th>KALİTE</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${it.loom_name || '-'}</td>
                  <td style="font-weight:bold">
                    ${it.roll_no}
                    <div class="roll-bc"><svg id="bc-${idx}"></svg></div>
                  </td>
                  <td>${it.lot_no || it.party_no || '-'}</td>
                  <td style="text-align:left">${it.product_code || ''} - ${it.product_name || ''}</td>
                  <td style="font-weight:bold">${Number(it.length_m).toFixed(1)}</td>
                  <td>${Number(it.weight_kg || 0).toFixed(1)}</td>
                  <td>${(Number(it.weight_kg || 0) + 0.5).toFixed(1)}</td>
                  <td>${it.decision}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            TOPLAM: ${items.length} TOP | ${totalMt.toFixed(1)} MT | ${totalKg.toFixed(1)} KG Net
          </div>

          <div class="footer-notes">
            <strong>Notlar:</strong> ${shipment.notes || 'Yok'}<br><br>
            <div style="display:flex; justify-content:space-between; margin-top:20px; font-weight:normal; font-style:normal">
               <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:5px">Teslim Eden</div>
               <div style="border-top:1px solid #000; width:150px; text-align:center; padding-top:5px">Teslim Alan</div>
            </div>
          </div>

          <script>
            try {
              JsBarcode("#bc-ship", "CEK-${shipment.id}", {
                format: "CODE128",
                width: 2,
                height: 28,
                displayValue: true,
                fontSize: 10,
                margin: 2
              });
              ${items.map((it, idx) => `JsBarcode("#bc-${idx}", "${String(it.roll_no || '').replace(/"/g, '').trim()}", {
                format: "CODE128",
                width: 1.4,
                height: 20,
                displayValue: false,
                margin: 1
              });`).join('\n')}
            } catch (e) { console.error('Barkod hatası:', e); }
            ${onlyPreview ? '' : 'window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };'}
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  } catch (e) { toast(e.message, 'error'); }
}

async function viewShipmentDetails(id) {
  try {
    const res = await api('shipment_details', { id });
    const { shipment, items } = res.data;
    
    let totalMt = 0;
    let totalKg = 0;
    items.forEach(i => {
      totalMt += parseFloat(i.length_m);
      totalKg += parseFloat(i.weight_kg || 0);
    });

    openModal('Çeki Listesi Önizleme — #' + id, `
      <div style="background:var(--surface2); padding:16px; border-radius:10px; margin-bottom:20px; border:1px solid var(--border)">
        <div class="grid-2" style="gap:20px">
          <div>
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:4px">Alıcı Müşteri</div>
            <div style="font-size:15px; font-weight:700; color:var(--text)">${shipment.customer_name}</div>
            <div style="font-size:12px; color:var(--text2); margin-top:4px">${shipment.shipping_address || '-'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:4px">Sevkiyat Detayı</div>
            <div style="font-size:12px; color:var(--text2)"><b>Tarih:</b> ${fmtDate(shipment.shipment_date)}</div>
            <div style="font-size:12px; color:var(--text2)"><b>Plaka:</b> ${shipment.plate_no || '-'}</div>
            <div style="font-size:12px; color:var(--text2)"><b>Durum:</b> <span class="badge badge-teal">${shipment.status.toUpperCase()}</span></div>
          </div>
        </div>
      </div>

      <div style="max-height: 400px; overflow-y: auto; border-radius:8px; border:1px solid var(--border)">
        <table class="toplu-table" style="font-size:11px">
          <thead>
            <tr>
              <th style="width:40px">Sıra</th>
              <th style="width:30px">TZ</th>
              <th>Top No / Barkod</th>
              <th>LOT</th>
              <th>Ürün / Kalite</th>
              <th style="text-align:center">Metre</th>
              <th style="text-align:center">Net KG</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => `
              <tr>
                <td style="color:var(--text3)">${idx + 1}</td>
                <td style="font-weight:600; color:var(--accent)">${it.loom_name || '-'}</td>
                <td style="font-weight:700; color:var(--text)">${it.roll_no}</td>
                <td style="color:var(--warning)">${it.lot_no || '-'}</td>
                <td style="font-size:10px">${it.product_code} - ${it.product_name}</td>
                <td style="text-align:center; font-weight:700; color:var(--accent)">${it.length_m}</td>
                <td style="text-align:center">${it.weight_kg || '0'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot style="background:var(--surface3); font-weight:800">
            <tr>
              <td colspan="4" style="text-align:right">TOPLAM:</td>
              <td style="text-align:center; color:var(--accent)">${totalMt.toFixed(1)} mt</td>
              <td style="text-align:center">${totalKg.toFixed(1)} kg</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${shipment.notes ? `
        <div style="margin-top:16px; padding:12px; background:rgba(255,179,71,0.05); border-radius:8px; border:1px dashed var(--warning)">
          <div style="font-size:10px; color:var(--warning); text-transform:uppercase; margin-bottom:4px">Sevkiyat Notları</div>
          <div style="font-size:12px; color:var(--text2)">${shipment.notes}</div>
        </div>
      ` : ''}

      <div style="margin-top:20px; display:flex; gap:12px; justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeModal()">Kapat</button>
        <button class="btn btn-secondary" style="border-color:var(--accent); color:var(--accent)" onclick="loadShipmentForm(${id}); closeModal();">✏️ DÜZENLE</button>
        <button class="btn btn-primary" onclick="printPackingList(${id})">🖨️ YAZDIR</button>
      </div>
    `);
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  DEPO GİRİŞ (EXTERNAL ROLL ENTRY)
// ═══════════════════════════════
let dgSelectedRows = new Set();

async function loadDepoGiris() {
  const [cRes, oRes] = await Promise.all([
    api('customers'),
    api('orders')
  ]);
  const d_customers = cRes.data || [];
  window.dgOrders = (oRes.data || []).filter(o => o.status === 'Açık' || o.status === 'Üretimde');
  dgSelectedRows = new Set();
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <!-- HEADER -->
    <div class="filter-bar" style="margin-bottom:16px">
      <h2 style="margin:0; font-size:18px; color:var(--text)">📥 Depo Giriş — Dış Alım</h2>
      <div style="margin-left:auto; display:flex; gap:10px; align-items:center">
        <span id="dgSelCount" style="font-size:12px; color:var(--text3); display:none">0 top seçili</span>
        <button id="dgBulkDeleteBtn" class="btn btn-danger btn-sm" onclick="dgBulkDelete()" style="display:none">🗑️ Seçilenleri Sil</button>
        <button id="dgBulkPrintBtn" class="btn btn-secondary btn-sm" onclick="dgBulkPrint()" style="display:none; border-color:var(--accent); color:var(--accent)">🖨️ Seçilileri Yazdır</button>
        <button class="btn btn-secondary btn-sm" onclick="exportDepoGiris()">📤 Dışa Aktar</button>
        <button class="btn btn-secondary btn-sm" onclick="importDepoGirisExcel()">📥 İçe Aktar</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('dgFormPanel').style.display = document.getElementById('dgFormPanel').style.display==='none'?'block':'none'">+ Yeni Top Ekle</button>
      </div>
    </div>

    <!-- GİRİŞ FORMU (Yeni Premium Tasarım) -->
    <div id="dgFormPanel" class="dg-form-card" style="display:none">
      <div class="dg-form-header" style="cursor:pointer" onclick="document.getElementById('dgFormBody').style.display=document.getElementById('dgFormBody').style.display==='none'?'block':'none'">
        <div style="display:flex; align-items:center; gap:10px">
          <span style="font-size:20px">📝</span>
          <span class="panel-title">Hızlı Top Giriş Formu</span>
        </div>
        <span style="font-size:11px; color:var(--text3)">Daralt / Genişlet ▾</span>
      </div>
      <div id="dgFormBody" class="dg-form-body">
        <form id="depoGirisForm" onsubmit="saveDepoGiris(event)">
          <div class="dg-input-group" style="grid-template-columns: 1.5fr 1fr 1.5fr 1fr 1.5fr 0.8fr 0.8fr auto">
            
            <div class="dg-field">
              <label>Tedarikçi (Cari)</label>
              <div class="dg-input-wrapper">
                <select id="dgCustomerId" required style="padding-left:12px">
                  <option value="">Cari Seçiniz...</option>
                  ${d_customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="dg-field">
              <label>İrsaliye No</label>
              <div class="dg-input-wrapper">
                <span class="dg-input-icon">📄</span>
                <input type="text" id="dgWaybill" placeholder="No">
              </div>
            </div>

            <div class="dg-field">
              <label>Seçili Ürün</label>
              <div class="dg-input-wrapper">
                <select id="dgProductId" required style="padding-left:12px">
                  <option value="">Ürün Seçiniz...</option>
                  ${products.map(p => `<option value="${p.id}">${p.code} — ${p.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="dg-field">
              <label>Parti / LOT</label>
              <div class="dg-input-wrapper">
                <span class="dg-input-icon">🏷️</span>
                <input type="text" id="dgPartyNo" placeholder="LOT No">
              </div>
            </div>

            <div class="dg-field">
              <label>Sipariş</label>
              <div class="dg-input-wrapper">
                <select id="dgOrderId" style="padding-left:12px">
                  <option value="">Seçiniz...</option>
                  ${(window.dgOrders || []).map(o => `<option value="${o.id}">${o.order_no} — ${o.customer_name || ''} / ${o.product_name || ''}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="dg-field">
              <label>Metraj</label>
              <div class="dg-input-wrapper">
                <span class="dg-input-icon">📏</span>
                <input type="number" id="dgLength" required step="0.1" placeholder="0.0" min="0.1">
              </div>
            </div>

            <div class="dg-field">
              <label>Kilo</label>
              <div class="dg-input-wrapper">
                <span class="dg-input-icon">⚖️</span>
                <input type="number" id="dgWeight" required step="0.1" placeholder="0.0" min="0.1">
              </div>
            </div>

            <button type="submit" class="dg-btn-add">
              <span>➕</span> EKLE
            </button>
          </div>

          <div class="dg-footer">
            <div class="dg-auto-no">
              <span>BARKOD:</span>
              <strong id="dgRollNoDisplay">Kaydetmeden sonra üretilecek</strong>
            </div>
            <div style="display:flex; gap:10px">
              <button type="button" class="btn btn-secondary btn-sm" onclick="clearDGForm()">🗑️ Formu Temizle</button>
              <span style="font-size:11px; color:var(--text3); font-style:italic">Barkod sunucuda otomatik üretilir</span>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- KAYIT TABLOSU -->
    <div class="panel">
      <div class="panel-head" style="display:flex; justify-content:space-between; align-items:center">
        <span class="panel-title">📦 Stoktaki Dış Alım Topları</span>
        <div style="display:flex; gap:8px; align-items:center">
          <input type="date" id="dgDateStart" style="height:32px; border-radius:8px; border:1px solid var(--border); background:var(--surface2); color:var(--text); padding:0 8px; font-size:12px" onchange="dgFilterTable()">
          <span style="color:var(--text3); font-size:11px">-</span>
          <input type="date" id="dgDateEnd" style="height:32px; border-radius:8px; border:1px solid var(--border); background:var(--surface2); color:var(--text); padding:0 8px; font-size:12px" onchange="dgFilterTable()">
          <input type="text" id="dgSearch" placeholder="🔍 Top no, ürün, irsaliye ara..." 
            style="height:32px; border-radius:8px; border:1px solid var(--border); background:var(--surface2); color:var(--text); padding:0 12px; font-size:12px; width:200px"
            oninput="dgFilterTable()">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text2); cursor:pointer; margin-left:10px">
            <input type="checkbox" id="dgSelectAll" onchange="dgToggleAll(this.checked)" style="accent-color:var(--accent)">
            Tümünü Seç
          </label>
        </div>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table class="toplu-table">
          <thead>
            <tr>
              <th style="width:36px"></th>
              <th>Tarih</th>
              <th>Tedarikçi (Cari)</th>
              <th>Ürün</th>
              <th>Top No</th>
              <th>Parti / LOT</th>
              <th style="text-align:center">Metre</th>
              <th style="text-align:center">Kilo</th>
              <th style="text-align:center">MTÜL</th>
              <th style="text-align:right">İşlem</th>
            </tr>
          </thead>
          <tbody id="dgRecentTable">
            <tr><td colspan="10" style="text-align:center; padding:40px"><div class="spinner"></div></td></tr>
          </tbody>
          <tfoot id="dgTableFoot" style="background:var(--surface2); font-weight:800; border-top:2px solid var(--border)"></tfoot>
        </table>
      </div>
    </div>
  `;

  loadRecentDepoGiris();
}

function dgToggleAll(checked) {
  const checkboxes = document.querySelectorAll('.dg-row-check');
  checkboxes.forEach(cb => {
    const tr = cb.closest('tr');
    const isVisible = tr && tr.style.display !== 'none';
    
    if (checked) {
      if (isVisible) {
        cb.checked = true;
        dgSelectedRows.add(parseInt(cb.dataset.id));
      }
    } else {
      cb.checked = false;
      dgSelectedRows.delete(parseInt(cb.dataset.id));
    }
  });
  dgUpdateSelectionUI();
}

function dgToggleRow(id, checked) {
  if (checked) dgSelectedRows.add(id);
  else dgSelectedRows.delete(id);
  dgUpdateSelectionUI();
}

function dgUpdateSelectionUI() {
  const count = dgSelectedRows.size;
  const btn = document.getElementById('dgBulkPrintBtn');
  const delBtn = document.getElementById('dgBulkDeleteBtn');
  const countEl = document.getElementById('dgSelCount');
  if (btn) btn.style.display = count > 0 ? 'inline-flex' : 'none';
  if (delBtn) delBtn.style.display = count > 0 ? 'inline-flex' : 'none';
  if (countEl) {
    countEl.style.display = count > 0 ? 'inline' : 'none';
    countEl.textContent = `${count} top seçili`;
  }
}

function dgFilterTable() {
  const q = document.getElementById('dgSearch')?.value?.toLowerCase() || '';
  const dStart = document.getElementById('dgDateStart')?.value || '';
  const dEnd = document.getElementById('dgDateEnd')?.value || '';

  document.querySelectorAll('#dgRecentTable tr').forEach(tr => {
    const text = tr.textContent.toLowerCase();
    const rowDate = tr.dataset.date || ''; // YYYY-MM-DD
    
    let show = true;
    
    // Text search
    if (q && !text.includes(q)) show = false;
    
    // Date Range
    if (show && dStart && rowDate < dStart) show = false;
    if (show && dEnd && rowDate > dEnd) show = false;

    tr.style.display = show ? '' : 'none';
  });
}

async function dgBulkPrint() {
  if (dgSelectedRows.size === 0) return;
  // Get the data for selected rows from the table
  const selectedData = [];
  dgSelectedRows.forEach(id => {
    const row = document.querySelector(`[data-rowid="${id}"]`);
    if (row) {
      selectedData.push({
        roll_no: row.dataset.rollno,
        product_name: row.dataset.product,
        length_m: parseFloat(row.dataset.length),
        weight_kg: parseFloat(row.dataset.weight),
        lot_no: row.dataset.lot,
        loom_name: '-',
        decision: '1. Kalite',
        control_date: row.dataset.date
      });
    }
  });
  
  for (const r of selectedData) {
    printRollLabel(r);
    await new Promise(res => setTimeout(res, 300));
  }
  toast(`${selectedData.length} top için barkod yazdırma başlatıldı`);
}

async function saveDepoGiris(e) {
  e.preventDefault();
  try {
    const productId = document.getElementById('dgProductId').value;
    const customerId = document.getElementById('dgCustomerId').value;
    const lengthM = document.getElementById('dgLength').value;
    const weightKg = document.getElementById('dgWeight').value;
    const waybill = document.getElementById('dgWaybill').value;
    const partyNo = document.getElementById('dgPartyNo').value;
    const orderId = document.getElementById('dgOrderId').value || null;

    const notes = [];
    if (waybill) notes.push(`İrsaliye: ${waybill}`);
    notes.push('Dış Alım');

    const res = await api('depo_giris', {
      product_id: productId,
      customer_id: customerId,
      length_m: lengthM,
      weight_kg: weightKg,
      party_no: partyNo,
      order_id: orderId,
      notes: notes.join(' | ')
    }, 'POST');

    const barcode = res.barcode || 'Bilinmiyor';
    toast(`✅ Top eklendi: ${barcode}`);

    // Reset form for next entry
    document.getElementById('dgLength').value = '';
    document.getElementById('dgWeight').value = '';
    document.getElementById('dgRollNoDisplay').innerText = 'Kaydetmeden sonra üretilecek';
    document.getElementById('dgLength').focus();

    loadRecentDepoGiris();
  } catch (err) { toast(err.message, 'error'); }
}

function clearDGForm() {
  document.getElementById('dgLength').value = '';
  document.getElementById('dgWeight').value = '';
  document.getElementById('dgPartyNo').value = '';
  document.getElementById('dgCustomerId').value = '';
  document.getElementById('dgWaybill').value = '';
  document.getElementById('dgProductId').value = '';
  document.getElementById('dgOrderId').value = '';
  toast('Form temizlendi', 'info');
}

async function loadRecentDepoGiris() {
  try {
    const res = await api('recent_depo_giris');
    const tbody = document.getElementById('dgRecentTable');
    const tfoot = document.getElementById('dgTableFoot');
    if (!res.data || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:40px; color:var(--text3)"><div style="font-size:32px;margin-bottom:8px">📭</div>Henüz dış alım kaydı yok.</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    let grandMt = 0, grandKg = 0;

    tbody.innerHTML = res.data.map((r, idx) => {
      grandMt += parseFloat(r.length_m) || 0;
      grandKg += parseFloat(r.weight_kg) || 0;
      const notesText = (r.notes || '').replace(' | Dış Alım', '').replace('Dış Alım', '');
      const mtul = r.length_m > 0 ? (parseFloat(r.weight_kg || 0) / parseFloat(r.length_m)).toFixed(3) : '—';
      return `
        <tr data-rowid="${r.id}" data-rollno="${r.roll_no}" data-product="${r.product_name||''}" 
            data-length="${r.length_m}" data-weight="${r.weight_kg||0}" 
            data-lot="${r.party_no||''}" data-date="${r.control_date||''}">
          <td style="text-align:center">
            <input type="checkbox" class="dg-row-check" data-id="${r.id}" 
              style="accent-color:var(--accent)" onchange="dgToggleRow(${r.id}, this.checked)">
          </td>
          <td style="font-size:11px">${fmtDate(r.control_date)}</td>
          <td style="font-weight:600; color:var(--accent3); font-size:12px">${r.supplier_name || '—'}</td>
          <td>
            <div style="font-weight:600; font-size:12px; color:var(--text)">${r.product_code || '-'}</div>
            <div style="font-size:11px; color:var(--text3)">${r.product_name || '-'}</div>
          </td>
          <td style="font-weight:700; color:var(--accent); font-family:monospace; font-size:13px">${r.roll_no}</td>
          <td style="color:var(--warning); font-weight:600; font-size:12px">${r.party_no || '-'}</td>
          <td style="text-align:center; font-weight:700; color:var(--accent)">${parseFloat(r.length_m).toFixed(1)} mt</td>
          <td style="text-align:center; font-weight:600; color:var(--text2)">${parseFloat(r.weight_kg||0).toFixed(1)} kg</td>
          <td style="text-align:center; font-family:var(--mono); font-size:11px; color:var(--warning)">${mtul}</td>
          <td style="text-align:right">
            <div style="display:flex; gap:4px; justify-content:flex-end">
              <button class="btn btn-sm btn-secondary" title="Barkod Yazdır"
                onclick="printRollLabel({roll_no:'${r.roll_no}',product_name:'${(r.product_name||'').replace(/'/g,"\\'")}',length_m:${r.length_m},weight_kg:${r.weight_kg||0},lot_no:'${r.party_no||''}',loom_name:'-',decision:'1. Kalite',control_date:'${r.control_date||''}'})" 
                style="padding:4px 8px">🖨️</button>
              <button class="btn btn-sm btn-danger" title="Sil" onclick="deleteDepoGiris(${r.id})" style="padding:4px 8px">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:right; color:var(--text2); padding-right:12px">TOPLAM (${res.data.length} Top):</td>
          <td style="text-align:center; color:var(--accent)">${grandMt.toFixed(1)} mt</td>
          <td style="text-align:center; color:var(--text2)">${grandKg.toFixed(1)} kg</td>
          <td colspan="2"></td>
        </tr>
      `;
    }
  } catch (e) {
    const tbody = document.getElementById('dgRecentTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--danger);padding:30px">Veriler yüklenemedi.</td></tr>';
  }
}

function deleteDepoGiris(id) {
  openModal('Kayıt Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:12px;color:var(--text)">Bu top girişini silmek istediğinize emin misiniz?</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:24px">Bu işlem geri alınamaz.</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button type="button" class="btn btn-danger" onclick="executeDeleteDepoGiris(${id})">Evet, Sil</button>
      </div>
    </div>
  `);
}

function dgBulkDelete() {
  if (dgSelectedRows.size === 0) return;
  openModal('Toplu Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:12px;color:var(--text)">Seçilen <b>${dgSelectedRows.size}</b> topu silmek istediğinize emin misiniz?</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:24px">Bu işlem geri alınamaz.</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button type="button" class="btn btn-danger" onclick="executeBulkDeleteDepoGiris()">Evet, Hepsini Sil</button>
      </div>
    </div>
  `);
}

async function executeBulkDeleteDepoGiris() {
  closeModal();
  try {
    const ids = Array.from(dgSelectedRows).join(',');
    await api('depo_giris_delete', { ids }, 'POST');
    toast(`${dgSelectedRows.size} kayıt silindi`);
    dgSelectedRows.clear();
    dgUpdateSelectionUI();
    loadRecentDepoGiris();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeDeleteDepoGiris(id) {
  closeModal();
  try {
    await api('depo_giris_delete', { id }, 'POST');
    toast('Kayıt silindi');
    loadRecentDepoGiris();
  } catch (e) { toast(e.message, 'error'); }
}

async function exportDepoGiris() {
  try {
    const res = await api('recent_depo_giris');
    if (!res.data || !res.data.length) return toast('Dışa aktarılacak veri yok', 'warning');
    
    const data = res.data.map(r => ({
      'Tarih': r.control_date ? new Date(r.control_date).toLocaleDateString('tr-TR') : '—',
      'Tedarikçi (Cari)': r.supplier_name || '—',
      'Ürün Kodu': r.product_code || '—',
      'Ürün Adı': r.product_name || '—',
      'Top No': r.roll_no,
      'Parti / LOT': r.party_no || '—',
      'Metraj (mt)': parseFloat(r.length_m || 0).toFixed(1),
      'Kilo (kg)': parseFloat(r.weight_kg || 0).toFixed(1),
      'MTÜL (kg/mt)': r.length_m > 0 ? (parseFloat(r.weight_kg || 0) / parseFloat(r.length_m)).toFixed(3) : '0.000',
      'Notlar': (r.notes || '').replace(' | Dış Alım', '')
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dış Alım Listesi");
    XLSX.writeFile(wb, `Ipex_Dis_Alim_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { toast(e.message, 'error'); }
}

function importDepoGirisExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx, .xls, .csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const cRes = await api('customers');
      const d_customers = cRes.data || [];
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
          
          if (!rows.length) throw new Error('Dosya boş veya geçersiz format');
          
          toast(`${rows.length} kayıt okunuyor...`, 'info');
          let success = 0;
          
          for (const row of rows) {
            const product = products.find(p => 
              String(p.code).toLowerCase() === String(row['Ürün Kodu'] || '').toLowerCase() || 
              String(p.name).toLowerCase() === String(row['Ürün Adı'] || '').toLowerCase()
            );
            if (!product) continue;

            const supplierName = row['Tedarikçi (Cari)'] || row['Tedarikçi'] || row['Cari'];
            const customer = d_customers.find(c => 
              String(c.name).toLowerCase() === String(supplierName || '').toLowerCase()
            );
            
            // Tarih işlemleri (Gelişmiş)
            let controlDate = null;
            let rawDate = row['Tarih'];

            if (rawDate) {
              if (rawDate instanceof Date) {
                // Eğer SheetJS tarih objesi olarak verdiyse
                controlDate = rawDate.toISOString().split('T')[0];
              } else if (typeof rawDate === 'number') {
                // Eğer Excel seri numarası olarak geldiyse
                const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                controlDate = d.toISOString().split('T')[0];
              } else if (typeof rawDate === 'string') {
                // Eğer metin olarak geldiyse (nokta, slash veya tire ile ayırabilir)
                const parts = rawDate.split(/[./-]/).map(p => p.trim());
                if (parts.length === 3) {
                  if (parts[0].length === 4) { // YYYY-MM-DD
                    controlDate = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
                  } else { // DD.MM.YYYY
                    let y = parts[2];
                    if (y.length === 2) y = '20' + y;
                    controlDate = `${y}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                  }
                }
              }
            }

            await api('depo_giris', {
              product_id: product.id,
              customer_id: customer ? customer.id : null,
              control_date: controlDate,
              length_m: row['Metraj (mt)'] || row['Metraj'] || 0,
              weight_kg: row['Kilo (kg)'] || row['Kilo'] || 0,
              party_no: row['Parti / LOT'] || row['Parti'] || row['LOT'] || '',
              notes: row['Notlar'] || 'Excel İthalat'
            }, 'POST');
            success++;
          }
          
          toast(`✅ ${success} kayıt başarıyla içe aktarıldı`);
          loadRecentDepoGiris();
        } catch (err) { toast(err.message, 'error'); }
      };
      reader.readAsBinaryString(file);
    } catch (err) { toast(err.message, 'error'); }
  };
  input.click();
}

// ═══════════════════════════════
//  SİPARİŞLER & PROJELER
// ═══════════════════════════════
async function loadOrders() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div id="orderKpiCards" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:16px; margin-bottom:24px"></div>
    <div class="filter-bar">
      <input type="text" id="orderSearch" placeholder="🔍 Sipariş no, müşteri ara..." oninput="filterOrders()">
      <select id="orderStatusFilter" onchange="filterOrders()">
        <option value="">Tüm Durumlar</option>
        <option value="Açık">Açık</option>
        <option value="Üretimde">Üretimde</option>
        <option value="Tamamlandı">Tamamlandı</option>
        <option value="İptal">İptal</option>
      </select>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportOrders()">📥 Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="importOrdersExcel()">📤 İçe Aktar</button>
        <button class="btn btn-secondary btn-sm" id="calendarToggleBtn" onclick="toggleOrderCalendar()">📅 Takvim</button>
        <button class="btn btn-primary" onclick="openOrderModal()">+ Yeni Sipariş</button>
      </div>
    </div>
    <div id="calendarContainer" style="display:none; margin-bottom:24px">
      <div class="panel">
        <div class="panel-body" style="padding:16px">
          <div id="ordersCalendar"></div>
        </div>
      </div>
    </div>
    <div class="panel" id="ordersTablePanel">
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table class="toplu-table" id="ordersTable">
          <thead>
            <tr>
              <th>Sipariş No</th>
              <th>Müşteri</th>
              <th>Ürün / Kumaş</th>
              <th>Termin</th>
              <th>İlerleme</th>
              <th>Sipariş Miktarı</th>
              <th>Sevk Edilen</th>
              <th>Kalan</th>
              <th>Durum</th>
              <th style="width:120px">İşlem</th>
            </tr>
          </thead>
          <tbody id="ordersBody">
            <tr><td colspan="10" style="text-align:center;padding:20px">Yükleniyor...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  fetchOrders();
}

let activeOrders = [];
async function fetchOrders() {
  try {
    const res = await api('orders');
    activeOrders = res.data || [];
    renderOrderKpis();
    renderOrders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderOrderKpis() {
  const kpiEl = document.getElementById('orderKpiCards');
  if (!kpiEl) return;
  
  const open = activeOrders.filter(o => o.status === 'Açık' || o.status === 'Üretimde');
  const completed = activeOrders.filter(o => o.status === 'Tamamlandı');
  const totalQty = activeOrders.reduce((s, o) => s + parseFloat(o.quantity_m || 0), 0);
  const totalShipped = activeOrders.reduce((s, o) => s + parseFloat(o.shipped_m || 0), 0);
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const soon = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
  const urgent = activeOrders.filter(o => o.deadline_date && o.deadline_date < todayStr && o.status !== 'Tamamlandı' && o.status !== 'İptal');
  const approaching = activeOrders.filter(o => o.deadline_date && o.deadline_date >= todayStr && o.deadline_date <= soon && o.status !== 'Tamamlandı' && o.status !== 'İptal');
  
  kpiEl.innerHTML = `
    <div class="kpi-card purple" style="cursor:pointer" onclick="document.getElementById('orderStatusFilter').value='Açık';filterOrders()">
      <div class="kpi-label">Açık Siparişler</div>
      <div class="kpi-value">${open.length}</div>
      <div class="kpi-sub">${fmt(totalQty)} mt toplam</div>
    </div>
    <div class="kpi-card teal" style="cursor:pointer" onclick="document.getElementById('orderStatusFilter').value='Üretimde';filterOrders()">
      <div class="kpi-label">Üretimde</div>
      <div class="kpi-value">${activeOrders.filter(o=>o.status==='Üretimde').length}</div>
      <div class="kpi-sub">Sevk: ${fmt(totalShipped)} mt</div>
    </div>
    <div class="kpi-card ${urgent.length ? 'red' : 'blue'}">
      <div class="kpi-label">⚠ Termin Geciken</div>
      <div class="kpi-value">${urgent.length}</div>
      <div class="kpi-sub">${urgent.map(o=>o.order_no).join(', ') || '—'}</div>
    </div>
    <div class="kpi-card blue" style="${approaching.length?'border:2px solid var(--warning)':''}">
      <div class="kpi-label">📅 Yaklaşan Termin (7g)</div>
      <div class="kpi-value">${approaching.length}</div>
      <div class="kpi-sub">${approaching.map(o=>o.order_no).join(', ') || '—'}</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">✅ Tamamlanan</div>
      <div class="kpi-value">${completed.length}</div>
      <div class="kpi-sub">${fmt(completed.reduce((s,o)=>s+parseFloat(o.quantity_m||0),0))} mt</div>
    </div>
  `;
}

function renderOrders() {
  const search = (document.getElementById('orderSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('orderStatusFilter')?.value;
  const today = new Date().toISOString().split('T')[0];
  
  let html = '';
  activeOrders.forEach(o => {
    if (statusFilter && o.status !== statusFilter) return;
    if (search && !(
      o.order_no.toLowerCase().includes(search) || 
      (o.customer_name||'').toLowerCase().includes(search) ||
      (o.product_name||'').toLowerCase().includes(search)
    )) return;

    const shipped = parseFloat(o.shipped_m || 0);
    const ordered = parseFloat(o.quantity_m || 0);
    const ready = parseFloat(o.ready_m || 0);
    const remaining = Math.max(0, ordered - shipped);
    const pct = ordered > 0 ? Math.min(100, (shipped / ordered) * 100) : 0;
    
    let statColor = 'var(--text3)';
    if(o.status === 'Açık' || o.status === 'Üretimde') statColor = 'var(--warning)';
    if(o.status === 'Tamamlandı') statColor = 'var(--accent)';
    if(o.status === 'İptal') statColor = 'var(--danger)';

    let termBadge = '';
    if (o.deadline_date && o.status !== 'Tamamlandı' && o.status !== 'İptal') {
      if (o.deadline_date < today) {
        termBadge = '<span style="display:inline-block;background:var(--danger);color:#fff;font-size:9px;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:4px">GECİKMİŞ</span>';
      } else {
        const diff = Math.ceil((new Date(o.deadline_date) - new Date()) / 86400000);
        if (diff <= 7) {
          termBadge = `<span style="display:inline-block;background:var(--warning);color:#000;font-size:9px;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:4px">${diff}g kaldı</span>`;
        }
      }
    }

    const barColor = pct >= 100 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--text3)';
    const deadlineStr = o.deadline_date ? o.deadline_date.split('-').reverse().join('.') : '-';

    html += `
      <tr style="${o.deadline_date && o.deadline_date < today && o.status !== 'Tamamlandı' && o.status !== 'İptal' ? 'background:rgba(239,68,68,.06)' : ''}">
        <td><span style="font-weight:700; color:var(--text); cursor:pointer" onclick="openOrderDetail(${o.id})">${o.order_no}</span>${termBadge}</td>
        <td style="color:var(--text2)">${o.customer_name || '-'}</td>
        <td style="color:var(--text2); font-size:11px">${o.product_code} - ${o.product_name}</td>
        <td style="font-size:11px">${deadlineStr}</td>
        <td style="min-width:120px">
          <div style="background:var(--surface3);border-radius:4px;height:8px;overflow:hidden;position:relative">
            <div style="background:${barColor};height:100%;width:${pct}%;border-radius:4px;transition:width .3s"></div>
          </div>
          <div style="font-size:10px;color:var(--text3);text-align:right;margin-top:2px">%${pct.toFixed(0)}</div>
        </td>
        <td style="font-weight:700">${fmt(ordered)} mt</td>
        <td style="color:var(--accent); font-weight:700">${fmt(shipped)} mt${ready > 0 ? `<span style="font-size:9px;color:var(--warning)"> (+${fmt(ready)} hazır)</span>` : ''}</td>
        <td style="color:${remaining > 0 ? 'var(--danger)' : 'var(--accent)'}; font-weight:700">${fmt(remaining)} mt</td>
        <td style="font-weight:700; color:${statColor}">${o.status}</td>
        <td>
          <div style="display:flex;gap:4px">
            ${o.status !== 'Tamamlandı' && o.status !== 'İptal' ? `<button class="btn btn-icon" onclick="completeOrderFromList(${o.id})" title="Tamamla">✅</button>` : ''}
            <button class="btn btn-icon" onclick="openOrderDetail(${o.id})" title="Detay">👁</button>
            <button class="btn btn-icon" onclick="openOrderModal(${o.id})" title="Düzenle">✏️</button>
            <button class="btn btn-icon" onclick="printOrderCard(${o.id})" title="Durum Kartı">📄</button>
            <button class="btn btn-icon btn-danger" onclick="deleteOrder(${o.id})" title="Sil">🗑</button>
          </div>
        </td>
      </tr>
    `;
  });

  const tbody = document.getElementById('ordersBody');
  if (tbody) tbody.innerHTML = html || '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text3)">Sipariş bulunamadı</td></tr>';
}

function filterOrders() { renderOrders(); }

let calendarInstance = null;
let calendarVisible = false;

function toggleOrderCalendar() {
  const calContainer = document.getElementById('calendarContainer');
  const tablePanel = document.getElementById('ordersTablePanel');
  const toggleBtn = document.getElementById('calendarToggleBtn');

  if (!calContainer || !tablePanel || !toggleBtn) {
    toast('Takvim bileşeni bulunamadı', 'error');
    return;
  }

  if (typeof FullCalendar === 'undefined') {
    toast('FullCalendar kütüphanesi yüklenemedi, sayfayı yenileyin', 'error');
    return;
  }

  calendarVisible = !calendarVisible;

  if (calendarVisible) {
    calContainer.style.display = 'block';
    tablePanel.style.display = 'none';
    toggleBtn.classList.add('btn-primary');
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.textContent = '📋 Tablo';
    renderOrderCalendar();
  } else {
    calContainer.style.display = 'none';
    tablePanel.style.display = 'block';
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-secondary');
    toggleBtn.textContent = '📅 Takvim';
  }
}

function renderOrderCalendar() {
  const calendarEl = document.getElementById('ordersCalendar');
  if (!calendarEl) {
    toast('Takvim alanı bulunamadı', 'error');
    return;
  }

  if (calendarInstance) {
    calendarInstance.destroy();
    calendarInstance = null;
  }

  const events = getOrdersForCalendar();
  if (!events.length) {
    toast('Takvimde gösterilecek sipariş bulunamadı (termin/tarih bilgisi olan sipariş yok)', 'warning');
  }

  try {
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'tr',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,listWeek'
      },
      events: events,
      eventClick: function(info) {
        openOrderDetail(parseInt(info.event.id));
      },
      eventDidMount: function(info) {
        info.el.title = info.event.extendedProps.tooltip;
      },
      height: 'auto',
      dayMaxEvents: 3,
      nowIndicator: true,
      businessHours: {
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '18:00'
      },
      buttonText: {
        today: 'Bugün',
        month: 'Ay',
        week: 'Hafta',
        list: 'Liste'
      }
    });

    calendarInstance.render();
  } catch (e) {
    toast('Takvim oluşturulurken hata: ' + e.message, 'error');
  }
}

function getOrdersForCalendar() {
  const statusColors = {
    'Açık': '#f59e0b',
    'Üretimde': '#3b82f6',
    'Tamamlandı': '#10b981',
    'İptal': '#ef4444'
  };
  
  return activeOrders
    .filter(o => o.deadline_date || o.order_date)
    .map(o => {
      const dateToUse = o.deadline_date || o.order_date;
      const statusColor = statusColors[o.status] || '#6b7280';
      const customerName = o.customer_name || 'Müşteri';
      const productInfo = o.product_code ? `${o.product_code}` : '';
      
      return {
        id: o.id.toString(),
        title: `${o.order_no} - ${customerName}`,
        start: dateToUse,
        end: new Date(new Date(dateToUse).getTime() + 86400000).toISOString().split('T')[0],
        color: statusColor,
        borderColor: statusColor,
        extendedProps: {
          status: o.status,
          quantity: o.quantity_m,
          shipped: o.shipped_m,
          tooltip: `${o.order_no}\nMüşteri: ${customerName}\nÜrün: ${productInfo}\nDurum: ${o.status}\nMiktar: ${o.quantity_m} mt`
        }
      };
    });
}

function openOrderModal(id = 0) {
  Promise.all([api('customers'), api('products')]).then(([custRes, prodRes]) => {
    const customers = custRes.data || [];
    const products = prodRes.data || [];
    const order = activeOrders.find(x => x.id === id) || {};

    openModal(id ? '✏️ Siparişi Düzenle' : '📋 Yeni Sipariş Ekle', `
      <form onsubmit="saveOrder(event, ${id})">
        <div style="margin-bottom:16px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:8px;text-transform:uppercase">📌 Sipariş Bilgileri</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-floating" style="margin-bottom:0">
              <input type="text" id="orderNo" value="${order.order_no || ''}" required placeholder=" ">
              <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Sipariş No *</label>
            </div>
            <div class="form-floating" style="margin-bottom:0">
              <input type="date" id="orderDate" value="${order.order_date || new Date().toISOString().split('T')[0]}" required>
              <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Sipariş Tarihi</label>
            </div>
            <div class="form-floating" style="margin-bottom:0">
              <select id="orderCustomerId" required style="width:100%">
                <option value="">— Müşteri Seçiniz —</option>
                ${customers.map(c => `<option value="${c.id}" ${order.customer_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
              <label style="${order.customer_id ? 'top:8px;transform:none;font-size:10px;color:var(--accent)' : 'top:8px;transform:none;font-size:10px;color:var(--text3)'}">Müşteri *</label>
            </div>
            <div class="form-floating" style="margin-bottom:0">
              <input type="date" id="orderDeadline" value="${order.deadline_date || ''}">
              <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Termin Tarihi</label>
            </div>
          </div>
        </div>

        <div style="margin-bottom:16px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:8px;text-transform:uppercase">🧶 Ürün & Miktar</div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
            <div class="form-floating" style="margin-bottom:0">
              <select id="orderProductId" required style="width:100%">
                <option value="">— Ürün Seçiniz —</option>
                ${products.map(p => `<option value="${p.id}" ${order.product_id == p.id ? 'selected' : ''}>${p.code || '—'} — ${p.name}</option>`).join('')}
              </select>
              <label style="${order.product_id ? 'top:8px;transform:none;font-size:10px;color:var(--accent)' : 'top:8px;transform:none;font-size:10px;color:var(--text3)'}">Ürün / Kumaş *</label>
            </div>
            <div class="form-floating" style="margin-bottom:0">
              <input type="number" id="orderQuantity" step="0.1" value="${order.quantity_m || ''}" required placeholder=" ">
              <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Miktar (mt) *</label>
            </div>
          </div>
        </div>

        <div style="margin-bottom:20px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:8px;text-transform:uppercase">📊 Durum & Not</div>
          <div class="form-floating" style="margin-bottom:0">
            <select id="orderStatus" style="width:100%">
              <option value="Açık" ${order.status === 'Açık' ? 'selected' : ''}>Açık</option>
              <option value="Üretimde" ${order.status === 'Üretimde' ? 'selected' : ''}>Üretimde</option>
              <option value="Tamamlandı" ${order.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option>
              <option value="İptal" ${order.status === 'İptal' ? 'selected' : ''}>İptal</option>
            </select>
            <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Durum</label>
          </div>
          <div class="form-floating" style="margin-top:10px;margin-bottom:0">
            <textarea id="orderNotes" rows="2" placeholder=" ">${order.notes || ''}</textarea>
            <label style="${order.notes ? 'top:8px;transform:none;font-size:10px;color:var(--accent)' : 'top:18px;transform:none;font-size:10px;color:var(--text3)'}">Notlar / Açıklama</label>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
          <button type="submit" class="btn btn-primary">✓ Kaydet</button>
        </div>
      </form>
    `);
  });
}

async function saveOrder(e, id) {
  e.preventDefault();
  const payload = {
    id: id,
    order_no: document.getElementById('orderNo').value,
    customer_id: document.getElementById('orderCustomerId').value,
    product_id: document.getElementById('orderProductId').value,
    order_date: document.getElementById('orderDate').value,
    deadline_date: document.getElementById('orderDeadline').value,
    quantity_m: document.getElementById('orderQuantity').value,
    status: document.getElementById('orderStatus').value,
    notes: document.getElementById('orderNotes').value
  };

  try {
    toast('Kaydediliyor...', 'info');
    await api('orders', payload, 'POST');
    toast('Sipariş başarıyla kaydedildi');
    closeModal();
    fetchOrders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteOrder(id) {
  if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;
  try {
    await api('orders', { id }, 'DELETE');
    toast('Sipariş silindi');
    fetchOrders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function completeOrder(id) {
  const order = activeOrders.find(o => o.id === id);
  if (!order) return;
  const shipped = parseFloat(order.shipped_m || 0);
  const ordered = parseFloat(order.quantity_m || 0);
  const remaining = Math.max(0, ordered - shipped);
  
  let msg = `"${order.order_no}" siparişini tamamlandı olarak işaretlemek istiyor musunuz?`;
  if (remaining > 0) {
    msg = `"${order.order_no}" siparişinin henüz ${remaining.toFixed(0)} mt kısmı sevk edilmedi.\nYine de tamamlandı olarak işaretlemek istiyor musunuz?`;
  }
  if (!confirm(msg)) return;
  
  try {
    await api('orders', { id: id, status: 'Tamamlandı' }, 'POST');
    toast('Sipariş tamamlandı olarak işaretlendi');
    closeModal();
    fetchOrders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function completeOrderFromList(id) {
  const order = activeOrders.find(o => o.id === id);
  if (!order) return;
  const shipped = parseFloat(order.shipped_m || 0);
  const ordered = parseFloat(order.quantity_m || 0);
  const remaining = Math.max(0, ordered - shipped);
  
  let msg = `"${order.order_no}" siparişini tamamlandı olarak işaretlemek istiyor musunuz?`;
  if (remaining > 0) {
    msg = `"${order.order_no}" siparişinin henüz ${remaining.toFixed(0)} mt kısmı sevk edilmedi.\nYine de tamamlandı olarak işaretlemek istiyor musunuz?`;
  }
  if (!confirm(msg)) return;
  
  try {
    await api('orders', { id: id, status: 'Tamamlandı' }, 'POST');
    toast('Sipariş tamamlandı olarak işaretlendi');
    fetchOrders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function openOrderDetail(id) {
  const order = activeOrders.find(o => o.id === id);
  if (!order) return;
  
  const shipped = parseFloat(order.shipped_m || 0);
  const ready = parseFloat(order.ready_m || 0);
  const ordered = parseFloat(order.quantity_m || 0);
  const pct = ordered > 0 ? Math.min(100, (shipped / ordered) * 100) : 0;
  const barColor = pct >= 100 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--text3)';
  
  openModal(`📋 ${order.order_no} — Detay`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px">MÜŞTERİ</div>
        <div style="font-weight:600;color:var(--text)">${order.customer_name || '—'}</div>
      </div>
      <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px">ÜRÜN</div>
        <div style="font-weight:600;color:var(--text)">${order.product_code || ''} — ${order.product_name || '—'}</div>
      </div>
      <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px">SİPARİŞ TARİHİ</div>
        <div style="font-weight:600;color:var(--text)">${order.order_date ? new Date(order.order_date).toLocaleDateString('tr-TR') : '—'}</div>
      </div>
      <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px">TERMİN TARİHİ</div>
        <div style="font-weight:600;color:${order.deadline_date ? 'var(--warning)' : 'var(--text)'}">${order.deadline_date ? new Date(order.deadline_date).toLocaleDateString('tr-TR') : '—'}</div>
      </div>
    </div>
    
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:10px;color:var(--text3);font-weight:700">TAMAMLANMA ORANI</div>
        ${order.status !== 'Tamamlandı' ? `<button class="btn btn-primary btn-sm" onclick="completeOrder(${id})" style="font-size:10px;padding:4px 12px">✅ Tamamla</button>` : '<span class="badge badge-teal" style="font-size:10px">✓ Tamamlandı</span>'}
      </div>
      <div style="background:var(--surface3);border-radius:6px;height:16px;overflow:hidden">
        <div style="background:${barColor};height:100%;width:${pct}%;border-radius:6px;transition:width .3s;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;min-width:${pct > 15 ? '30px' : '0'}">%${pct.toFixed(0)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text3)">Sipariş</div>
          <div style="font-weight:700;color:var(--text);font-size:16px">${fmt(ordered)} mt</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text3)">Sevk Edilen</div>
          <div style="font-weight:700;color:var(--accent);font-size:16px">${fmt(shipped)} mt</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text3)">Hazır / Kalan</div>
          <div style="font-weight:700;color:var(--warning);font-size:16px">${fmt(ready)} / ${fmt(Math.max(0, ordered - shipped))} mt</div>
        </div>
      </div>
    </div>

    <div id="orderDetailTabs">
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
        <button class="tab-btn active" onclick="switchOrderTab('looms', ${id})" id="tabLooms" style="padding:8px 16px;font-size:11px;font-weight:600;border:none;background:transparent;color:var(--accent);cursor:pointer;border-bottom:2px solid var(--accent);margin-bottom:-2px">🏗️ Tezgahlar</button>
        <button class="tab-btn" onclick="switchOrderTab('qc', ${id})" id="tabQc" style="padding:8px 16px;font-size:11px;font-weight:600;border:none;background:transparent;color:var(--text3);cursor:pointer">🔍 Üretim</button>
        <button class="tab-btn" onclick="switchOrderTab('stock', ${id})" id="tabStock" style="padding:8px 16px;font-size:11px;font-weight:600;border:none;background:transparent;color:var(--text3);cursor:pointer">📦 Stoklar</button>
        <button class="tab-btn" onclick="switchOrderTab('shipments', ${id})" id="tabShip" style="padding:8px 16px;font-size:11px;font-weight:600;border:none;background:transparent;color:var(--text3);cursor:pointer">🚚 Sevkiyat</button>
      </div>
      <div id="orderTabContent" style="min-height:200px">
        <div class="spinner"></div>
      </div>
    </div>
  `, '750px');
  
  switchOrderTab('looms', id);
}

async function switchOrderTab(tab, orderId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.style.color = 'var(--text3)';
    b.style.borderBottom = 'none';
    b.classList.remove('active');
  });
  const activeBtn = document.getElementById(tab === 'looms' ? 'tabLooms' : tab === 'qc' ? 'tabQc' : tab === 'stock' ? 'tabStock' : 'tabShip');
  if (activeBtn) {
    activeBtn.style.color = 'var(--accent)';
    activeBtn.style.borderBottom = '2px solid var(--accent)';
    activeBtn.classList.add('active');
  }
  
  const container = document.getElementById('orderTabContent');
  
  if (tab === 'looms') {
    try {
      const res = await api('looms');
      const looms = (res.data || []).filter(l => l.order_id == orderId);
      if (!looms.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Bu siparişe atanmış tezgah yok.</div>';
        return;
      }
      container.innerHTML = `
        <table class="toplu-table">
          <thead><tr><th>Tezgah</th><th>Durum</th><th>Ürün</th><th>Sayaç</th><th>Günlük</th></tr></thead>
          <tbody>${looms.map(l => `
            <tr>
              <td style="font-weight:700;color:var(--text)">${l.name}</td>
              <td><span class="badge badge-${l.status === 'çalışıyor' ? 'teal' : 'red'}">${l.status}</span></td>
              <td style="font-size:11px">${l.product_code || '—'} ${l.product_name || ''}</td>
              <td style="font-weight:600">${Number(l.current_meters || 0).toFixed(1)} mt</td>
              <td style="font-weight:600;color:var(--accent)">${Number(l.daily_meters || 0).toFixed(1)} mt</td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    } catch (e) { container.innerHTML = '<div style="color:var(--danger)">Hata: ' + e.message + '</div>'; }
  } else if (tab === 'qc') {
    try {
      const res = await api('quality_controls', { order_id: orderId });
      const qcList = res.data || [];
      if (!qcList.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Bu sipariş için henüz üretim kaydı yok.</div>';
        return;
      }
      container.innerHTML = `
        <table class="toplu-table">
          <thead><tr><th>Top No</th><th>Tarih</th><th>MT</th><th>KG</th><th>Karar</th><th>Tezgah</th></tr></thead>
          <tbody>${qcList.map(q => `
            <tr>
              <td style="font-weight:600;color:var(--text)">${q.roll_no}</td>
              <td>${fmtDate(q.control_date)}</td>
              <td style="font-weight:700;color:var(--accent)">${q.length_m}</td>
              <td>${q.weight_kg || '0'}</td>
              <td>${decisionBadge(q.decision)}</td>
              <td>${q.loom_name || '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
        <div style="padding:8px;font-size:12px;color:var(--text3)">Toplam: ${qcList.reduce((s,q)=>s+parseFloat(q.length_m||0),0).toFixed(1)} mt / ${qcList.length} top</div>
      `;
    } catch (e) { container.innerHTML = '<div style="color:var(--danger)">Hata: ' + e.message + '</div>'; }
  } else if (tab === 'stock') {
    try {
      const res = await api('stock_rolls');
      const allRolls = res.data || [];
      const order = activeOrders.find(o => o.id === orderId);
      const orderRolls = allRolls.filter(r => {
        const matchOrder = r.order_no && order && r.order_no === order.order_no;
        const matchCustomer = r.customer_name && order && r.customer_name === order.customer_name;
        return matchOrder;
      });
      if (!orderRolls.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Bu sipariş için stokta bekleyen kumaş yok.</div>';
        return;
      }
      container.innerHTML = `
        <table class="toplu-table">
          <thead><tr><th>Top No</th><th>LOT</th><th>Ürün</th><th style="text-align:center">MT</th><th style="text-align:center">KG</th></tr></thead>
          <tbody>${orderRolls.map(r => `
            <tr>
              <td style="font-weight:600;color:var(--text)">${r.roll_no}</td>
              <td style="color:var(--warning);font-weight:600">${r.lot_no || '-'}</td>
              <td>${r.product_code || '-'} <small>${r.product_name || ''}</small></td>
              <td style="font-weight:700;color:var(--accent);text-align:center">${r.length_m}</td>
              <td style="text-align:center">${r.weight_kg || '0'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
        <div style="padding:8px;font-size:12px;color:var(--text3)">Toplam: ${orderRolls.reduce((s,r)=>s+parseFloat(r.length_m||0),0).toFixed(1)} mt / ${orderRolls.length} top (Stokta)</div>
      `;
    } catch (e) { container.innerHTML = '<div style="color:var(--danger)">Hata: ' + e.message + '</div>'; }
  } else if (tab === 'shipments') {
    try {
      const res = await api('shipments');
      const shipList = (res.data || []).filter(s => s.order_id == orderId);
      if (!shipList.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Bu sipariş için henüz sevkiyat yok.</div>';
        return;
      }
      container.innerHTML = `
        <table class="toplu-table">
          <thead><tr><th>Sevkiyat No</th><th>Tarih</th><th>Plaka</th><th>Toplam MT</th><th>Durum</th></tr></thead>
          <tbody>${shipList.map(s => `
            <tr>
              <td style="font-weight:600;color:var(--text)">S-${s.id}</td>
              <td>${fmtDate(s.shipment_date)}</td>
              <td>${s.plate_no || '—'}</td>
              <td style="font-weight:700;color:var(--accent)">${Number(s.total_meters || 0).toFixed(1)} mt</td>
              <td><span class="badge badge-teal">${s.status || 'hazırlanıyor'}</span></td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    } catch (e) { container.innerHTML = '<div style="color:var(--danger)">Hata: ' + e.message + '</div>'; }
  }
}

async function exportOrders() {
  try {
    const res = await api('orders');
    if (!res.data || !res.data.length) return toast('Dışa aktarılacak sipariş yok', 'warning');
    
    const data = res.data.map(o => {
      const ordered = parseFloat(o.quantity_m || 0);
      const shipped = parseFloat(o.shipped_m || 0);
      const remaining = Math.max(0, ordered - shipped);
      return {
        'Sipariş No': o.order_no,
        'Müşteri': o.customer_name || '',
        'Ürün Kodu': o.product_code || '',
        'Ürün Adı': o.product_name || '',
        'Sipariş Tarihi': o.order_date ? new Date(o.order_date).toLocaleDateString('tr-TR') : '',
        'Termin Tarihi': o.deadline_date ? new Date(o.deadline_date).toLocaleDateString('tr-TR') : '',
        'Sipariş Miktarı (mt)': ordered.toFixed(1),
        'Sevk Edilen (mt)': shipped.toFixed(1),
        'Kalan (mt)': remaining.toFixed(1),
        'Durum': o.status,
        'Notlar': o.notes || ''
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    
    ws['!cols'] = [
      { wch: 18 }, { wch: 25 }, { wch: 14 }, { wch: 30 },
      { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 35 }
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Siparişler');
    XLSX.writeFile(wb, `Siparisler_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast('Siparişler Excel\'e aktarıldı');
  } catch (e) { toast(e.message, 'error'); }
}

function importOrdersExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx, .xls, .csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const cRes = await api('customers');
      const pRes = await api('products');
      const custList = cRes.data || [];
      const prodList = pRes.data || [];
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
          
          if (!rows.length) throw new Error('Dosya boş veya geçersiz format');
          
          toast(`${rows.length} kayıt okunuyor...`, 'info');
          let success = 0;
          let errors = [];
          
          for (const row of rows) {
            const orderNo = row['Sipariş No'] || row['SiparişNo'] || row['Proje No'] || '';
            if (!orderNo) { errors.push('Sipariş No boş — atlandı'); continue; }
            
            const custName = row['Müşteri'] || row['Cari'] || '';
            const customer = custList.find(c => String(c.name).toLowerCase() === String(custName).toLowerCase());
            if (!customer && custName) { errors.push(`"${custName}" müşterisi bulunamadı — atlandı`); continue; }
            
            const prodCode = row['Ürün Kodu'] || row['Kod'] || '';
            const prodName = row['Ürün Adı'] || row['Ürün'] || '';
            const product = prodList.find(p => 
              (prodCode && String(p.code).toLowerCase() === String(prodCode).toLowerCase()) ||
              (prodName && String(p.name).toLowerCase() === String(prodName).toLowerCase())
            );
            if (!product) { errors.push(`"${prodCode || prodName}" ürünü bulunamadı — atlandı`); continue; }
            
            const orderDate = parseExcelDate(row['Sipariş Tarihi'] || row['Tarih']);
            const deadline = parseExcelDate(row['Termin Tarihi'] || row['Termin']);
            
            const payload = {
              order_no: String(orderNo).trim(),
              customer_id: customer ? customer.id : '',
              product_id: product.id,
              order_date: orderDate || new Date().toISOString().split('T')[0],
              deadline_date: deadline || '',
              quantity_m: parseFloat(row['Sipariş Miktarı (mt)'] || row['Miktar'] || 0),
              status: row['Durum'] || 'Açık',
              notes: row['Notlar'] || ''
            };
            
            try {
              await api('orders', payload, 'POST');
              success++;
            } catch (err) {
              errors.push(`${orderNo}: ${err.message}`);
            }
          }
          
          toast(`✅ ${success} kayıt içe aktarıldı`);
          if (errors.length) {
            setTimeout(() => {
              openModal('İçe Aktarma Hataları', `
                <div style="max-height:300px;overflow-y:auto">
                  ${errors.map(e => `<div style="padding:4px 0;font-size:12px;color:var(--danger);border-bottom:1px solid var(--border)">⚠ ${e}</div>`).join('')}
                </div>
                <div style="margin-top:12px;font-size:12px;color:var(--text3)">${errors.length} hata oluştu</div>
              `);
            }, 500);
          }
          fetchOrders();
        } catch (err) { toast(err.message, 'error'); }
      };
      reader.readAsBinaryString(file);
    } catch (err) { toast(err.message, 'error'); }
  };
  input.click();
}

function parseExcelDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  if (typeof raw === 'number') {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  if (typeof raw === 'string') {
    const parts = raw.split(/[./-]/).map(p => p.trim());
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
      } else {
        let y = parts[2];
        if (y.length === 2) y = '20' + y;
        return `${y}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
  }
  return null;
}

async function printOrderCard(id) {
  try {
    const res = await api('order_card', { id }, 'GET');
    const d = res.data;
    if (!d || !d.order) { toast('Sipariş bulunamadı', 'error'); return; }

    const o = d.order;
    const company = typeof appSettings !== 'undefined' ? (appSettings.company_name || 'DokumaQC') : 'DokumaQC';
    const dateStr = new Date().toLocaleDateString('tr-TR');
    const docNo = 'SK-' + String(id).padStart(4, '0') + '-' + new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const progress = o.quantity_m > 0 ? Math.round((o.shipped_m / o.quantity_m) * 100) : 0;
    const remaining = Math.max(0, o.quantity_m - o.shipped_m - (o.ready_m || 0));

    // Group QC records by loom
    const loomGroups = {};
    (d.qc_records || []).forEach(q => {
      const key = q.loom_name || 'Diğer';
      if (!loomGroups[key]) loomGroups[key] = { loom_name: key, total_mt: 0, total_kg: 0, count: 0 };
      loomGroups[key].total_mt += parseFloat(q.length_m || 0);
      loomGroups[key].total_kg += parseFloat(q.weight_kg || 0);
      loomGroups[key].count++;
    });
    const loomGroupList = Object.values(loomGroups);

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast('Pop-up engellendi. Lütfen tarayıcınızın pop-up engelleyicisini devre dışı bırakın.', 'warning');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Durum Kartı - ${o.order_no}</title>
          <style>
            @page { size: A4; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              background: #fff; color: #000;
              padding: 0; margin: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .page {
              width: 210mm; min-height: auto; height: auto;
              margin: 0 auto; background: #fff;
              border: 2px solid #000; padding: 8px 12px; position: relative;
            }
            .header {
              width: 100%; border-bottom: 3px solid #000;
              margin-bottom: 10px; padding-bottom: 6px;
            }
            .header table { width: 100%; border: none; }
            .header td { border: none; padding: 0; background: transparent; }
            .header-left h1 {
              font-size: 12px; font-weight: 700;
              letter-spacing: 1px; text-transform: uppercase;
              margin: 0; padding: 0;
            }
            .header-left .subtitle {
              font-size: 17px; font-weight: 800; margin-top: 2px;
            }
            .header-right { text-align: right; }
            .header-right .title-main { font-size: 19px; font-weight: 800; }
            .header-right .date { font-size: 11px; color: #555; margin-top: 2px; }
            .header-right .doc-no { font-size: 10px; color: #555; }
            .info-bar { margin-bottom: 10px; font-size: 10px; }
            .info-bar span {
              border: 1px solid #000; padding: 2px 8px;
              margin-right: 4px; margin-bottom: 4px;
              display: inline-block; white-space: nowrap;
            }
            .info-bar strong { font-weight: 700; }
            .section-title {
              font-size: 12px; font-weight: 800;
              border: 2px solid #000; border-bottom: none;
              padding: 4px 8px; margin-top: 8px; background: #e8e8e8;
            }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .data-table { border: 2px solid #000; }
            .data-table th {
              background: #e8e8e8; font-weight: 700;
              font-size: 10px; padding: 3px 5px; border: 1px solid #000;
            }
            .data-table td {
              padding: 3px 5px; border: 1px solid #000;
            }
            .data-table td:not(:first-child),
            .data-table th:not(:first-child) { text-align: center; }
            .note-box {
              border: 2px solid #000; padding: 6px 10px;
              margin-top: 8px; font-size: 12px; background: #fafafa;
            }
            .note-box div:first-child { font-weight: 700; margin-bottom: 3px; }
            .sign-area {
              margin-top: 30px; display: flex;
              justify-content: space-between; padding: 0 20px;
            }
            .sign-field { text-align: center; width: 200px; }
            .sign-field .line {
              border-top: 1px solid #000; margin-top: 40px;
              padding-top: 5px; font-size: 10px; font-weight: 600;
            }
            .summary-box {
              margin-top: 8px; padding: 6px 10px;
              border: 2px solid #000; background: #f5f5f5;
              text-align: center; font-size: 11px;
            }
            .summary-box .val { font-size: 17px; font-weight: 800; }
            .progress-bar {
              height: 14px; background: #ddd; border-radius: 7px;
              overflow: hidden; margin: 6px 0;
            }
            .progress-bar .fill {
              height: 100%; background: #222; border-radius: 7px;
              transition: width 0.3s;
            }
            @media print {
              html, body { width: 210mm; margin: 0; padding: 0; }
              body { background: #fff; }
              .page { border: 2px solid #000; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="page">

            <!-- HEADER -->
            <div class="header">
              <table>
                <tr>
                  <td class="header-left" style="text-align:left">
                    <h1>${company}</h1>
                    <div class="subtitle">SİPARİŞ DURUM KARTI</div>
                  </td>
                  <td class="header-right" style="text-align:right">
                    <div class="title-main">SİPARİŞ DURUM KARTI</div>
                    <div class="doc-no">Belge No: ${docNo}</div>
                    <div class="date">Tarih: ${dateStr}</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- INFO BAR -->
            <div class="info-bar">
              <span>Sipariş No: <strong>${o.order_no}</strong></span>
              <span>Müşteri: <strong>${o.customer_name || '-'}</strong></span>
              <span>Ürün: <strong>${o.product_code || ''} ${o.product_name || '-'}</strong></span>
              <span>Durum: <strong>${o.status}</strong></span>
            </div>

            <!-- ORDER DETAILS -->
            <div class="section-title">SİPARİŞ BİLGİLERİ</div>
            <table class="data-table">
              <tr>
                <th>Sipariş No</th>
                <td><strong>${o.order_no}</strong></td>
                <th>Müşteri</th>
                <td>${o.customer_name || '-'}</td>
                <th>Durum</th>
                <td><strong>${o.status}</strong></td>
              </tr>
              <tr>
                <th>Ürün</th>
                <td colspan="3">${o.product_code || ''} — ${o.product_name || '-'}</td>
                <th>Sipariş Tarihi</th>
                <td>${o.order_date || '-'}</td>
              </tr>
              <tr>
                <th>Sipariş Miktarı</th>
                <td><strong>${Number(o.quantity_m || 0).toFixed(0)} mt</strong></td>
                <th>Termin Tarihi</th>
                <td>${o.deadline_date || '-'}</td>
                <th>Kalan</th>
                <td style="color:${remaining > 0 ? '#c00' : '#080'};font-weight:700">${remaining.toFixed(0)} mt</td>
              </tr>
              <tr>
                <th>Sevk Edilen</th>
                <td style="color:#080;font-weight:700">${Number(o.shipped_m || 0).toFixed(0)} mt</td>
                <th>Hazır (Bekleyen)</th>
                <td style="color:#e67e22;font-weight:700">${Number(o.ready_m || 0).toFixed(0)} mt</td>
                <th>İlerleme</th>
                <td><strong>${progress}%</strong></td>
              </tr>
              <tr>
                <td colspan="6" style="padding:4px 5px">
                  <div class="progress-bar">
                    <div class="fill" style="width:${Math.min(progress, 100)}%"></div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- PRODUCTION (QC records grouped by loom) -->
            <div class="section-title">ÜRETİM KAYITLARI</div>
            <table class="data-table">
              <tr>
                <th>Tezgah</th>
                <th>Top Adet</th>
                <th>MT</th>
                <th>KG</th>
              </tr>
              ${loomGroupList.length > 0 ? loomGroupList.map(g => `
              <tr>
                <td style="text-align:left">${g.loom_name}</td>
                <td>${g.count}</td>
                <td>${g.total_mt.toFixed(1)}</td>
                <td>${g.total_kg.toFixed(1)}</td>
              </tr>
              `).join('') : '<tr><td colspan="4" style="color:#888">Henüz üretim kaydı yok</td></tr>'}
              ${loomGroupList.length > 0 ? `
              <tr style="font-weight:700;background:#f0f0f0">
                <td style="text-align:left">TOPLAM (${(d.qc_records || []).length} top)</td>
                <td>${(d.qc_records || []).length}</td>
                <td>${(d.qc_records || []).reduce((s, q) => s + parseFloat(q.length_m || 0), 0).toFixed(1)}</td>
                <td>${(d.qc_records || []).reduce((s, q) => s + parseFloat(q.weight_kg || 0), 0).toFixed(1)}</td>
              </tr>
              ` : ''}
            </table>

            <!-- QC SUMMARY -->
            <div class="section-title">KALİTE KONTROL ÖZETİ</div>
            <table class="data-table">
              <tr>
                <th>Toplam Kontrol</th>
                <th>Toplam MT</th>
                <th>Ortalama Skor</th>
              </tr>
              <tr>
                <td><strong>${d.qc_summary ? d.qc_summary.qc_count : 0}</strong></td>
                <td>${d.qc_summary && d.qc_summary.total_meters ? Number(d.qc_summary.total_meters).toFixed(1) : '0'}</td>
                <td>${d.qc_summary && d.qc_summary.avg_score ? Number(d.qc_summary.avg_score).toFixed(1) : '-'}</td>
              </tr>
            </table>

            <!-- NOTES -->
            ${o.notes ? `
            <div class="note-box">
              <div>Notlar:</div>
              <div>${o.notes}</div>
            </div>
            ` : ''}

            <!-- SIGNATURE -->
            <div class="sign-area">
              <div class="sign-field"><div class="line">Hazırlayan</div></div>
              <div class="sign-field"><div class="line">Onay</div></div>
              <div class="sign-field"><div class="line">Tarih</div></div>
            </div>

            <!-- PRINT BUTTON -->
            <div class="no-print" style="text-align:center;margin:20px 0">
              <button onclick="window.print()" style="padding:10px 50px;font-size:15px;font-weight:700;cursor:pointer;border:2px solid #000;background:#fff;border-radius:4px">🖨️ Yazdır / PDF Kaydet</button>
              <p style="font-size:11px;color:#555;margin-top:8px">PDF kaydetmek için yazdırma dialogunda "PDF olarak kaydet" seçin</p>
            </div>

          </div><!-- /.page -->
        </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    toast(err.message || 'Kart oluşturulamadı', 'error');
  }
}
