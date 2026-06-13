/* ═══════════════════════════════════════════
   DokumaQC — Application JavaScript
   Part 2: Products, Stock, Reports, Settings
   ═══════════════════════════════════════════ */

// ═══════════════════════════════
//  PRODUCTS
// ═══════════════════════════════
async function loadProducts() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="prodSearchInput" placeholder="🔍 Ürün ara..." oninput="filterProducts()">
      <select id="prodFilterFabric" onchange="filterProducts()">
        <option value="">Tüm Kumaşlar</option>
        ${fabricTypes.map(ft => `<option value="${ft.id}">${ft.name}</option>`).join('')}
      </select>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="exportStock()">📥 Excel İndir</button>
        <button class="btn btn-secondary btn-sm" onclick="importProductsExcel()" title="GEREKLİ FORMAT:&#10;- Kod (Ürün Kodu)&#10;- Ad (Ürün Adı)&#10;- Kumaş (Kumaş Tipi)&#10;- Sıklık (Atkı Sıklığı)&#10;- Birim (Metre/Kg)&#10;- Kompozisyon (İçerik)&#10;&#10;.xlsx, .xls veya .csv dosyaları desteklenir.">📤 Excel'den Yükle</button>
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('analiz')" style="background:linear-gradient(135deg,rgba(58,232,160,.1),rgba(58,232,160,.05));border-color:var(--accent)">🔬 Analiz İle Ekle</button>
        <button class="btn btn-primary btn-sm" onclick="openProductModal()">+ Basit Ürün</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr><th>Kod</th><th>Ürün Adı</th><th>Kumaş Tipi</th><th>Atkı Sıklık</th><th>Birim</th><th>Mevcut Stok</th><th>Tedarikçi</th><th>İşlem</th></tr></thead>
          <tbody id="prodTableBody"><tr><td colspan="8"><div class="spinner"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  filterProducts();
}

async function filterProducts() {
  try {
    const params = {};
    const s = document.getElementById('prodSearchInput')?.value;
    if (s) params.search = s;
    const ft = document.getElementById('prodFilterFabric')?.value;
    if (ft) params.fabric_type_id = ft;

    const res = await api('products', params);
    products = res.data || [];
    const tbody = document.getElementById('prodTableBody');
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">Ürün bulunamadı</div><button class="btn btn-primary" onclick="openProductModal()">+ Ürün Ekle</button></div></td></tr>';
      return;
    }
    tbody.innerHTML = products.map(p => {
      return `<tr>
        <td style="font-weight:600;color:var(--accent3)">${p.code}</td>
        <td style="font-weight:600;color:var(--text)">${p.name}</td>
        <td>${p.fabric_type_name || '-'}</td>
        <td><span style="background:var(--s2);padding:2px 8px;border-radius:4px;font-size:11px;border:1px solid var(--b2)">${p.density || '-'}</span></td>
        <td>${p.unit}</td>
        <td style="font-weight:700;color:var(--accent)">${Number(p.current_stock).toLocaleString('tr-TR')}</td>
        <td>${p.supplier || '-'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openProductModal(${p.id})" title="Düzenle">✏️</button>
          <button class="btn btn-sm btn-secondary" onclick="openProductModal(${p.id}, true)" title="Kopyala">📄</button>
          <button class="btn btn-sm btn-secondary" onclick="openStockMoveModal(${p.id})" title="Stok Hareketi">📦</button>
          <button class="btn btn-sm btn-secondary" onclick="printWorkOrder(${p.id}, true)" title="PDF Önizleme">👁</button>
          <button class="btn btn-sm btn-secondary" onclick="printWorkOrder(${p.id})" title="İş Emri Yazdır">📋</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})" title="Sil">🗑</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

window._previewProductImage = function(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('prodImagePreview');
      if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
    window._removeProductImageFlag = false;
  }
};
window._removeProductImage = function() {
  const preview = document.getElementById('prodImagePreview');
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  const input = document.getElementById('prodImage');
  if (input) input.value = '';
  window._removeProductImageFlag = true;
};

function openProductModal(id = 0, isClone = false) {
  const p = id ? products.find(x => x.id === id) : null;
  const saveId = isClone ? 0 : id;

  let tdObj = {};
  if (p && p.tech_details) {
    try { tdObj = JSON.parse(p.tech_details); } catch (e) { }
  }

  openModal(isClone ? 'Ürünü Kopyala' : (p ? 'Ürün Düzenle' : 'Yeni Ürün'), `
    <form onsubmit="saveProduct(event, ${saveId})">
      <div class="form-grid">
        <div class="form-floating">
          <input type="text" id="prodCode" required placeholder=" " value="${p ? (isClone ? p.code + '-K' : p.code) : ''}">
          <label>Ürün Kodu *</label>
        </div>
        <div class="form-floating">
          <input type="text" id="prodName" required placeholder=" " value="${p ? (isClone ? p.name + ' (Kopya)' : p.name) : ''}">
          <label>Ürün Adı *</label>
        </div>
        <div class="form-floating">
          <select id="prodFabricType">${fabricTypeOptions(p ? p.fabric_type_id : '')}</select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Kumaş Tipi</label>
        </div>
        <div class="form-floating">
          <input type="text" id="prodComp" placeholder=" " value="${p ? (p.composition || '') : ''}">
          <label>Kompozisyon</label>
          ${p && p.tech_details ? `<span onclick="fillCompFromAnaliz()" style="position:absolute;right:10px;top:12px;font-size:10px;color:var(--accent);cursor:pointer;font-weight:600;padding:4px 8px;background:var(--s2);border-radius:4px;border:1px solid var(--accent)">🔬 Hesapla</span>` : ''}
        </div>
        <div class="form-floating">
          <input type="text" id="prodDensity" placeholder=" " value="${p ? (p.density || '') : ''}">
          <label>Atkı Sıklık</label>
        </div>
        <div class="form-floating">
          <select id="prodUnit">
            <option value="metre" ${p?.unit === 'metre' ? 'selected' : ''}>Metre</option>
            <option value="kg" ${p?.unit === 'kg' ? 'selected' : ''}>Kg</option>
            <option value="top" ${p?.unit === 'top' ? 'selected' : ''}>Top</option>
            <option value="adet" ${p?.unit === 'adet' ? 'selected' : ''}>Adet</option>
          </select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Birim</label>
        </div>
        <div class="form-floating">
          <input type="number" id="prodWarpCount" placeholder=" " value="${tdObj.totalTel || ''}">
          <label>Çözgü Tel Sayısı</label>
        </div>
        <div class="form-floating">
          <input type="text" id="prodReed" placeholder=" " value="${tdObj.reed || ''}">
          <label>Tarak Numarası</label>
        </div>
        <div class="form-floating">
          <input type="number" step="0.1" id="prodWidth" placeholder=" " value="${tdObj.width || ''}">
          <label>Kumaş Eni (cm)</label>
        </div>
        <div class="form-floating form-full">
          <input type="text" id="prodSupplier" placeholder=" " value="${p ? (p.supplier || '') : ''}">
          <label>Tedarikçi</label>
        </div>
        <div class="form-floating form-full">
          <textarea id="prodNotes" placeholder=" " rows="2">${p ? (p.notes || '') : ''}</textarea>
          <label>Notlar</label>
        </div>
        <div class="form-floating form-full">
          <textarea id="prodWeftReport" placeholder=" " rows="2">${p ? (p.weft_report || '') : ''}</textarea>
          <label>Atkı Raporu</label>
        </div>
        ${!isClone ? `
        <div class="form-full" style="display:flex;align-items:center;gap:12px;margin-top:6px;padding:8px 0">
          <img id="prodImagePreview" src="${p && p.image ? 'uploads/' + p.image : ''}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--s4);${p && p.image ? '' : 'display:none'}">
          <div style="flex:1">
            <input type="file" id="prodImage" accept="image/*" onchange="_previewProductImage(this)" style="font-size:12px">
            <div style="font-size:10px;color:var(--text2);margin-top:2px">Maks: 5MB (JPG, PNG, GIF, WEBP)</div>
          </div>
          ${p && p.image ? '<button type="button" class="btn btn-sm" style="background:var(--danger);color:white;border:none" onclick="_removeProductImage()">🗑 Resmi Sil</button>' : ''}
        </div>
        ` : ''}
        <input type="hidden" id="prodTechDetails" value='${p && p.tech_details ? p.tech_details.replace(/'/g, "&#39;") : ""}'>
      </div>
      
      ${p ? `
      <div style="margin-top:10px; padding:12px; background:var(--s3); border-radius:8px; border:1px solid var(--accent); display:flex; align-items:center; justify-content:space-between">
        <div style="font-size:11px; color:var(--text2)">Bu ürünün teknik analiz verilerini güncellemek ister misiniz?</div>
        <button type="button" class="btn btn-sm" style="background:var(--accent); color:white; border:none" onclick="closeModal(); window._editProductId=${p.id}; navigateTo('analiz')">🔬 Analiz Ekranına Git</button>
      </div>
      ` : ''}

      ${renderTechDetails(p)}
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveProduct(e, id) {
  e.preventDefault();
  try {
    let td = {};
    try {
      td = JSON.parse(document.getElementById('prodTechDetails').value || '{}');
    } catch (err) { }

    td.totalTel = document.getElementById('prodWarpCount').value;
    td.reed = document.getElementById('prodReed').value;
    td.width = document.getElementById('prodWidth').value;

    const fd = new FormData();
    fd.append('id', id || '');
    fd.append('code', document.getElementById('prodCode').value);
    fd.append('name', document.getElementById('prodName').value);
    fd.append('fabric_type_id', document.getElementById('prodFabricType').value);
    fd.append('composition', document.getElementById('prodComp').value);
    fd.append('density', document.getElementById('prodDensity').value);
    fd.append('unit', document.getElementById('prodUnit').value);
    fd.append('supplier', document.getElementById('prodSupplier').value);
    fd.append('notes', document.getElementById('prodNotes').value);
    fd.append('weft_report', document.getElementById('prodWeftReport').value);
    fd.append('tech_details', JSON.stringify(td));
    const imgInput = document.getElementById('prodImage');
    if (imgInput && imgInput.files.length > 0) {
      fd.append('image', imgInput.files[0]);
    }
    if (window._removeProductImageFlag) {
      fd.append('remove_image', '1');
      window._removeProductImageFlag = false;
    }
    await api('products', fd, 'POST');
    closeModal();
    toast(id ? 'Ürün güncellendi' : 'Ürün eklendi');
    await loadReferenceData();
    filterProducts();
  } catch (err) { toast(err.message, 'error'); }
}

function renderTechDetails(p) {
  if (!p || !p.tech_details) return '';
  try {
    const td = JSON.parse(p.tech_details);
    const warpHtml = (td.warpKgList || []).length
      ? td.warpKgList.map(w =>
          `<div style="font-size:10px;color:var(--text);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.02)">${w.no}/${w.kat} ${w.unitTxt} ${w.name} <strong style="color:#ffb347">(${w.repeat} tel)</strong></div>`
        ).join('')
      : (td.warpList || []).map(w => `<div style="font-size:10px;color:var(--text);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.02)">${w}</div>`).join('') || '-';
    const weftHtml = (td.weftKgList || []).length
      ? td.weftKgList.map(w =>
          `<div style="font-size:10px;color:var(--text);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.02)">${w.no}/${w.kat} ${w.unitTxt} ${w.name} <strong style="color:#00d4aa">(${w.repeat} atkı)</strong></div>`
        ).join('')
      : (td.weftList || []).map(w => `<div style="font-size:10px;color:var(--text);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.02)">${w}</div>`).join('') || '-';

    return `
      <div style="margin-top:16px;padding:16px;background:var(--s2);border-radius:var(--radius-sm);border:1px solid var(--b1);width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--b2);padding-bottom:8px">
          <div style="font-size:12px;color:var(--accent);font-weight:700;display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            TEKNİK MALİYET ANALİZİ
          </div>
          <div style="font-size:10px;color:var(--text3)">${p.unit === 'metre' ? '/ metre' : ''}</div>
        </div>
        
        <!-- YENİ: İplikler ve Teknik Detaylar (Tarak En vb) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:var(--s1);padding:10px;border-radius:6px;border-left:3px solid #ffb347">
             <div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-weight:600">🧵 ÇÖZGÜ İPLİKLERİ</div>
             <div style="margin-bottom:6px">${warpHtml}</div>
             <div style="font-size:10px;color:var(--text2);display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px dashed var(--b2)">
               <span>Tarak: <strong>${td.reed || '-'}</strong> / <strong>${td.dent || '-'}</strong></span>
               <span>Top. Tel: <strong style="color:var(--text)">${td.totalTel || '0'}</strong></span>
             </div>
          </div>
          <div style="background:var(--s1);padding:10px;border-radius:6px;border-left:3px solid #00d4aa">
             <div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-weight:600">🪡 ATKI İPLİKLERİ</div>
             <div style="margin-bottom:6px">${weftHtml}</div>
             <div style="font-size:10px;color:var(--text2);display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px dashed var(--b2)">
               <span>Kumaş Eni: <strong>${td.width || '-'}</strong> cm</span>
               <span>Atkı Sıklık: <strong style="color:var(--text)">${td.dens || '-'}</strong> tel/cm</span>
             </div>
          </div>
        </div>

        <div style="font-size:11px;color:var(--text2);text-align:right;margin-bottom:8px">
          Örgü/Armür: <strong style="color:var(--text);margin-right:12px">${td.weaveType || '-'}</strong>
          Ham Gramaj: <strong style="color:var(--text)">${((td.cGrTotal || 0) + (td.aGrTotal || 0)).toFixed(1)}</strong> g/m
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:var(--s1);padding:10px;border-radius:6px;border-left:3px solid #ffb347">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Çözgü İplik Maliyeti</div>
            <div style="color:#ffb347;font-weight:700;font-size:16px">$${Number(td.cCostTotal || 0).toFixed(3)}</div>
          </div>
          <div style="background:var(--s1);padding:10px;border-radius:6px;border-left:3px solid #00d4aa">
            <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Atkı İplik Maliyeti</div>
            <div style="color:#00d4aa;font-weight:700;font-size:16px">$${Number(td.aCostTotal || 0).toFixed(3)}</div>
          </div>
        </div>
        
        <div style="display:flex;gap:12px;align-items:stretch">
          <div style="flex:1;background:var(--s1);padding:8px;border-radius:6px">
            <div style="font-size:10px;color:var(--text3)">Dokuma İşçilik</div>
            <div style="color:var(--text);font-weight:600;font-size:13px">$${Number(td.workCost || 0).toFixed(3)}</div>
          </div>
          <div style="flex:1;background:var(--s1);padding:8px;border-radius:6px">
            <div style="font-size:10px;color:var(--text3)">Toplam Ek Gider</div>
            <div style="color:var(--text);font-weight:600;font-size:13px">$${Number(td.extraTotal || 0).toFixed(3)}</div>
          </div>
          <div style="flex:1;background:linear-gradient(135deg,rgba(58,232,160,.1),rgba(58,232,160,.02));padding:8px;border-radius:6px;border:1px solid rgba(58,232,160,.2)">
            <div style="font-size:10px;color:var(--accent);font-weight:700">TOPLAM MALİYET</div>
            <div style="color:var(--accent);font-weight:800;font-size:15px">$${Number(td.totalUsd || 0).toFixed(3)}</div>
          </div>
        </div>
      </div>
    `;
  } catch (e) { return ''; }
}

function printWorkOrder(id, onlyPreview = false) {
  const p = products.find(x => x.id === id);
  if (!p) { toast('Ürün bulunamadı', 'error'); return; }

  let td = {};
  if (p.tech_details) {
    try { td = JSON.parse(p.tech_details); } catch (e) {}
  }

  const dateStr = new Date().toLocaleDateString('tr-TR');
  const company = appSettings.company_name || 'DokumaQC';
  const docNo = 'İE-' + String(id).padStart(4, '0') + '-' + new Date().toISOString().slice(2, 10).replace(/-/g, '');

  function yarnRowFromKg(item, i, label) {
    const name = item.name || '-';
    const miktar = item.repeat ?? '-';
    const birim = item.unitTxt || '-';
    const grmt = item.gr ? Number(item.gr).toFixed(1) : '-';
    return `<tr><td>${i + 1}</td><td style="text-align:left">${name}</td><td>${miktar}</td><td>${birim}</td><td>${grmt}</td></tr>`;
  }

  function yarnRowFromString(s, i) {
    const m = s.match(/^(\S+)\s+(\S+)\s+(.+)$/);
    if (m) {
      return `<tr><td>${i + 1}</td><td style="text-align:left">${m[3]}</td><td>${m[1]}</td><td>${m[2]}</td><td>-</td></tr>`;
    }
    return `<tr><td>${i + 1}</td><td style="text-align:left">${s}</td><td>-</td><td>-</td><td>-</td></tr>`;
  }

  const warpYarnRows = (td.warpKgList || []).length
    ? td.warpKgList.map((w, i) => yarnRowFromKg(w, i, 'Çözgü')).join('')
    : (td.warpList || []).map((w, i) => yarnRowFromString(w, i)).join('');

  const weftYarnRows = (td.weftKgList || []).length
    ? td.weftKgList.map((w, i) => yarnRowFromKg(w, i, 'Atkı')).join('')
    : (td.weftList || []).map((w, i) => yarnRowFromString(w, i)).join('');

  const hasWarp = warpYarnRows.length > 0;
  const hasWeft = weftYarnRows.length > 0;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    toast('Pop-up engellendi. Lütfen tarayıcınızın pop-up engelleyicisini devre dışı bırakın.', 'warning');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>İş Emri - ${p.code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #fff;
            color: #000;
            padding: 0;
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page {
            width: 210mm;
            min-height: auto;
            height: auto;
            margin: 0 auto;
            background: #fff;
            border: 2px solid #000;
            padding: 8px 12px;
            position: relative;
          }
          .header {
            width: 100%;
            border-bottom: 3px solid #000;
            margin-bottom: 10px;
            padding-bottom: 6px;
          }
          .header table { width: 100%; border: none; }
          .header td { border: none; padding: 0; background: transparent; }
          .header-left h1 {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin: 0; padding: 0;
          }
          .header-left .subtitle {
            font-size: 17px;
            font-weight: 800;
            margin-top: 2px;
          }
          .header-right { text-align: right; }
          .header-right .title-main {
            font-size: 19px;
            font-weight: 800;
          }
          .header-right .date {
            font-size: 11px;
            color: #555;
            margin-top: 2px;
          }
          .header-right .doc-no {
            font-size: 10px;
            color: #555;
          }
          .info-bar { margin-bottom: 10px; font-size: 10px; }
          .info-bar span {
            border: 1px solid #000;
            padding: 2px 8px;
            margin-right: 4px;
            margin-bottom: 4px;
            display: inline-block;
            white-space: nowrap;
          }
          .info-bar strong { font-weight: 700; }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            border: 2px solid #000;
            border-bottom: none;
            padding: 4px 8px;
            margin-top: 8px;
            background: #e8e8e8;
          }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .data-table { border: 2px solid #000; }
          .data-table th {
            background: #e8e8e8;
            font-weight: 700;
            font-size: 10px;
            padding: 3px 5px;
            border: 1px solid #000;
          }
          .data-table td {
            padding: 3px 5px;
            border: 1px solid #000;
          }
          .data-table td:not(:first-child),
          .data-table th:not(:first-child) { text-align: center; }
          .layout-table { width: 100%; border: none; margin-top: 8px; }
          .layout-table > tbody > tr > td {
            vertical-align: top;
            border: none;
            padding: 0;
            width: 50%;
          }
          .layout-table > tbody > tr > td.col-left { padding-right: 5px; }
          .layout-table > tbody > tr > td.col-right { padding-left: 5px; }
          .note-box {
            clear: both;
            display: block;
            width: 100%;
            border: 2px solid #000;
            padding: 6px 10px;
            margin-top: 8px;
            font-size: 12px;
            background: #fafafa;
          }
          .note-box div:first-child {
            font-weight: 700;
            margin-bottom: 3px;
          }
          .sign-area {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
          }
          .sign-field {
            text-align: center;
            width: 200px;
          }
          .sign-field .line {
            border-top: 1px solid #000;
            margin-top: 40px;
            padding-top: 5px;
            font-size: 10px;
            font-weight: 600;
          }
          .summary-cost {
            margin-top: 8px;
            padding: 6px 10px;
            border: 2px solid #000;
            background: #f5f5f5;
            text-align: center;
            font-size: 11px;
          }
          .summary-cost .val {
            font-size: 17px;
            font-weight: 800;
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
                  <div class="subtitle">İŞ EMRİ</div>
                </td>
                <td class="header-right" style="text-align:right">
                  <div class="title-main">İŞ EMRİ</div>
                  <div class="doc-no">Belge No: ${docNo}</div>
                  <div class="date">Tarih: ${dateStr}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- INFO BAR -->
          <div class="info-bar">
            <span>Kod: <strong>${p.code}</strong></span>
            <span>Ad: <strong>${p.name}</strong></span>
            ${p.fabric_type_name ? `<span>Kumaş: <strong>${p.fabric_type_name}</strong></span>` : ''}
            ${p.composition ? `<span>Kompozisyon: <strong>${p.composition}</strong></span>` : ''}
            ${td.weaveType ? `<span>Örgü: <strong>${td.weaveType}</strong></span>` : ''}
            ${p.density ? `<span>Atkı Sıklık: <strong>${p.density}</strong></span>` : ''}
            ${p.supplier ? `<span>Tedarikçi: <strong>${p.supplier}</strong></span>` : ''}
          </div>

          <!-- TECHNICAL PARAMETERS -->
          <div class="section-title">TEKNİK PARAMETRELER</div>
          <table class="data-table">
            <tr>
              <th>Çözgü Tel</th>
              <td><strong>${td.totalTel || '-'}</strong></td>
              <th>Tarak No</th>
              <td>${td.reed || '-'}${td.dent ? '/' + td.dent : ''}</td>
              <th>Tarak Eni</th>
              <td><strong>${td.width ? td.width + ' cm' : '-'}</strong></td>
            </tr>
            <tr>
              <th>Atkı Sıklık (Tezgah)</th>
              <td>${p.density || '-'}</td>
              <th>Gramaj (Çözgü)</th>
              <td>${td.cGrTotal ? td.cGrTotal.toFixed(1) + ' g/m' : '-'}</td>
              <th>Gramaj (Atkı)</th>
              <td>${td.aGrTotal ? td.aGrTotal.toFixed(1) + ' g/m' : '-'}</td>
            </tr>
            <tr>
              <th>Birim</th>
              <td>${p.unit || '-'}</td>
              <th>Mevcut Stok</th>
              <td><strong>${Number(p.current_stock).toLocaleString('tr-TR')}</strong></td>
              <th></th>
              <td></td>
            </tr>
          </table>

          <!-- WARP + WEFT YARN TABLES -->
          ${hasWarp || hasWeft ? `
          <table class="layout-table">
            <tr>
              <td class="col-left">
                ${hasWarp ? `
                <div class="section-title" style="margin-top:0;">ÇÖZGÜ İPLİK</div>
                <table class="data-table" style="border-top:none;">
                  <tr>
                    <th>Sıra</th>
                    <th>İplik / Açıklama</th>
                    <th>Tel / Miktar</th>
                    <th>Birim</th>
                    <th>gr/mt</th>
                  </tr>
                  ${warpYarnRows}
                </table>
                ` : ''}
              </td>
              <td class="col-right">
                ${hasWeft ? `
                <div class="section-title" style="margin-top:0;">ATKI İPLİK</div>
                <table class="data-table" style="border-top:none;">
                  <tr>
                    <th>Sıra</th>
                    <th>İplik / Açıklama</th>
                    <th>Tel / Miktar</th>
                    <th>Birim</th>
                    <th>gr/mt</th>
                  </tr>
                  ${weftYarnRows}
                </table>
                ` : ''}
              </td>
            </tr>
          </table>
          ` : ''}

          <!-- COST SUMMARY -->
          ${td.totalUsd ? `
          <div class="summary-cost">
            <div>TOPLAM MALİYET</div>
            <div class="val">$${Number(td.totalUsd).toFixed(3)}</div>
            <div style="margin-top:4px;font-size:9px;color:#555">
              Çözgü: $${Number(td.cCostTotal || 0).toFixed(3)} &nbsp;|&nbsp;
              Atkı: $${Number(td.aCostTotal || 0).toFixed(3)} &nbsp;|&nbsp;
              İşçilik: $${Number(td.workCost || 0).toFixed(3)} &nbsp;|&nbsp;
              Ek Gider: $${Number(td.extraTotal || 0).toFixed(3)}
            </div>
          </div>
          ` : ''}

          <!-- NOTES -->
          ${p.notes ? `
          <div class="note-box">
            <div>Notlar:</div>
            <div>${p.notes}</div>
          </div>
          ` : ''}

          ${p.weft_report ? `
          <div class="note-box">
            <div>Atkı Raporu:</div>
            <div>${p.weft_report}</div>
          </div>
          ` : ''}

          ${p.image ? `<div style="text-align:center;margin-top:8px"><img src="uploads/${p.image}" style="max-width:250px;max-height:180px;border:1px solid #000;border-radius:4px"></div>` : ''}

          <!-- SIGNATURE -->
          <div class="sign-area">
            <div class="sign-field">
              <div class="line">Hazırlayan</div>
            </div>
            <div class="sign-field">
              <div class="line">Onay</div>
            </div>
            <div class="sign-field">
              <div class="line">Tarih</div>
            </div>
          </div>

          ${onlyPreview ? `
          <div class="no-print" style="text-align:center;margin:20px 0">
            <button onclick="window.print()" style="padding:10px 50px;font-size:15px;font-weight:700;cursor:pointer;border:2px solid #000;background:#fff;border-radius:4px">🖨️ Yazdır / PDF Kaydet</button>
            <p style="font-size:11px;color:#555;margin-top:8px">PDF kaydetmek için yazdırma dialogunda "PDF olarak kaydet" seçin</p>
          </div>
          ` : ''}

        </div><!-- /.page -->

        ${onlyPreview ? '' : '<script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };<\/script>'}
      </body>
    </html>
  `);
  printWindow.document.close();
}

function deleteProduct(id) {
  openModal('Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:24px;color:var(--text)">Bu ürünü silmek istediğinize emin misiniz?</div>
      <div style="display:flex;gap:13px;justify-content:center">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button type="button" class="btn btn-danger" onclick="executeDeleteProduct(${id})">Evet, Sil</button>
      </div>
    </div>
  `);
}

async function executeDeleteProduct(id) {
  closeModal();
  try {
    const res = await api('product_delete', { id }, 'POST');
    toast('Ürün silindi');
    await loadReferenceData();
    filterProducts();
  } catch (e) { toast(e.message, 'error'); }
}

function calculateProductComp(techDetails) {
  if (!techDetails) return '';
  try {
    const td = typeof techDetails === 'string' ? JSON.parse(techDetails) : techDetails;
    const matMap = {};
    let totalKg = 0;
    [...(td.warpKgList || []), ...(td.weftKgList || [])].forEach(i => {
      let n = i.name.trim().toUpperCase();
      n = n.replace(/^[0-9\/]+\s*/, '');
      if (!n) n = 'BİLİNMEYEN';
      if (!matMap[n]) matMap[n] = 0;
      matMap[n] += (i.kg || 0);
      totalKg += (i.kg || 0);
    });
    if (totalKg <= 0) return '';
    let sortedMats = Object.keys(matMap).sort((a, b) => matMap[b] - matMap[a]);
    return sortedMats.map(n => {
      let p = Math.round((matMap[n] / totalKg) * 100);
      return p > 0 ? `%${p} ${n}` : null;
    }).filter(x => x).join(', ');
  } catch (e) { return ''; }
}

function fillCompFromAnaliz() {
  const td = document.getElementById('prodTechDetails').value;
  const comp = calculateProductComp(td);
  if (comp) {
    document.getElementById('prodComp').value = comp;
    toast('Kompozisyon analizden hesaplandı');
  } else {
    toast('Analiz verisi yetersiz veya bulunamadı', 'info');
  }
}

function openStockMoveModal(productId) {
  const p = products.find(x => x.id === productId);
  openModal('Stok Hareketi — ' + (p?.name || ''), `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:11px;color:var(--text3)">MEVCUT STOK</div>
      <div style="font-size:32px;font-weight:800;font-family:Syne;color:var(--accent)">${Number(p?.current_stock || 0).toLocaleString('tr-TR')} <span style="font-size:14px;color:var(--text3)">${p?.unit || ''}</span></div>
    </div>
    <form onsubmit="saveStockMove(event, ${productId})">
      <div class="form-grid">
        <div class="form-floating">
          <select id="smType" required>
            <option value="giris">📥 Stok Girişi</option>
            <option value="cikis">📤 Stok Çıkışı</option>
          </select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Hareket Tipi *</label>
        </div>
        <div class="form-floating">
          <input type="number" id="smQty" required placeholder=" " step="0.1" min="0.1">
          <label>Miktar *</label>
        </div>
        <div class="form-floating">
          <input type="text" id="smDocNo" placeholder=" ">
          <label>Belge No</label>
        </div>
        <div class="form-floating">
          <input type="text" id="smDesc" placeholder=" ">
          <label>Açıklama</label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveStockMove(e, productId) {
  e.preventDefault();
  try {
    await api('stock_movements', {
      product_id: productId,
      type: document.getElementById('smType').value,
      quantity: document.getElementById('smQty').value,
      document_no: document.getElementById('smDocNo').value,
      description: document.getElementById('smDesc').value
    }, 'POST');
    closeModal();
    toast('Stok hareketi kaydedildi');
    await loadReferenceData();
    if (currentPage === 'stock-move') filterStockMoves();
  } catch (e) { toast(e.message, 'error'); }
}

function exportStock() {
  if (!products || !products.length) return toast('Dışa aktarılacak veri yok', 'warning');

  const data = products.map(p => ({
    'Kod': p.code,
    'Ürün Adı': p.name,
    'Kumaş Tipi': p.fabric_type_name || '',
    'Atkı Sıklık': p.density || '',
    'Birim': p.unit || '',
    'Mevcut Stok': p.current_stock || 0,
    'Tedarikçi': p.supplier || '',
    'Kompozisyon': p.composition || '',
    'Genişlik (cm)': p.width_cm || '',
    'Gramaj (gr/m2)': p.weight_gr_m2 || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ürün Listesi");
  XLSX.writeFile(wb, `Ipex_Urun_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ═══════════════════════════════
//  STOCK MOVEMENTS
// ═══════════════════════════════
async function loadStockMovements() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <span class="panel-title">🔄 Stok Hareket Geçmişi</span>
        <div style="display:flex; gap:8px; margin-left:auto">
          <input type="text" id="smSearch" placeholder="🔍 Firma, Ürün veya Top No ara..." oninput="filterStockMoves()" style="width:200px; font-size:11px; padding:4px; border-radius:4px; border:1px solid var(--border)">
          <select id="smFilterProduct" onchange="filterStockMoves()" style="width:150px; font-size:11px; padding:4px; border-radius:4px; border:1px solid var(--border)">
            <option value="">Tüm Ürünler</option>
            ${products.map(p => `<option value="${p.id}">${p.code} — ${p.name}</option>`).join('')}
          </select>
          <select id="smFilterType" onchange="filterStockMoves()" style="width:120px; font-size:11px; padding:4px; border-radius:4px; border:1px solid var(--border)">
            <option value="">Tüm Tipler</option>
            <option value="giris">📥 Sadece Girişler</option>
            <option value="cikis">📤 Sadece Çıkışlar</option>
            <option value="qc">🏭 İç Üretim</option>
            <option value="external">📦 Dış Üretim / Alım</option>
          </select>
          <input type="date" id="smFilterFrom" onchange="filterStockMoves()" style="width:120px; font-size:11px; padding:4px; border-radius:4px; border:1px solid var(--border)">
          <input type="date" id="smFilterTo" onchange="filterStockMoves()" style="width:120px; font-size:11px; padding:4px; border-radius:4px; border:1px solid var(--border)">
        </div>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table class="table-hover">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Ürün</th>
              <th>Tezgah</th>
              <th>Cari / Firma</th>
              <th>Tip</th>
              <th style="text-align:center">MT</th>
              <th style="text-align:center">KG</th>
              <th style="text-align:center">Gr/Mt</th>
              <th>Belge/Top No</th>
              <th>Açıklama</th>
              <th>Kullanıcı</th>
            </tr>
          </thead>
          <tbody id="smTableBody"><tr><td colspan="12"><div class="spinner"></div></td></tr></tbody>
          <tfoot style="background:#f9f9f9; font-weight:700; border-top:2px solid var(--border)">
            <tr>
              <td colspan="5" style="text-align:right; padding:12px; color:var(--text3)">LİSTE TOPLAMI / ORTALAMA:</td>
              <td id="smTotalQty" style="text-align:center; color:var(--accent); font-size:15px">0 mt</td>
              <td id="smTotalWeight" style="text-align:center; color:var(--purple); font-size:15px">0 kg</td>
              <td id="smAvgGrm" style="text-align:center; color:var(--text2); font-size:15px">0 gr</td>
              <td colspan="4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
  filterStockMoves();
}

async function loadRecentActivities() {
  try {
    const res = await api('activities', { limit: 12 });
    const container = document.getElementById('recentActivitiesBody');
    if (!res.data.length) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text3)">İşlem bulunamadı.</div>';
      return;
    }

    container.innerHTML = res.data.map(a => {
      const icon = a.type === 'giris' ? '📥' : '📤';
      const color = a.type === 'giris' ? 'var(--accent)' : 'var(--danger)';
      const typeLabel = a.act_type === 'qc' ? 'Kalite Kontrol' : (a.act_type === 'ship' ? 'Sevkiyat' : 'Manuel');
      const badgeClass = a.act_type === 'qc' ? 'badge-teal' : (a.act_type === 'ship' ? 'badge-purple' : 'badge-blue');

      return `
        <div style="padding:10px; border-bottom:1px solid var(--border); position:relative">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px">
            <span class="badge ${badgeClass}" style="font-size:9px">${typeLabel}</span>
            <small style="color:var(--text3); font-size:10px">${fmtDate(a.created_at)}</small>
          </div>
          <div style="font-weight:600; font-size:12px; color:var(--text)">${a.product_name}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px">
            <span style="font-size:11px; color:var(--text2)">${a.info || '-'}</span>
            <span style="font-weight:700; color:${color}">${icon} ${a.qty}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) { console.error(e); }
}

async function filterStockMoves() {
  try {
    const params = {};
    const pid = document.getElementById('smFilterProduct')?.value;
    if (pid) params.product_id = pid;
    const q = document.getElementById('smSearch')?.value;
    if (q) params.q = q;
    const type = document.getElementById('smFilterType')?.value;
    if (type) {
      if (type === 'external' || type === 'qc') params.act_type = type;
      else params.type = type;
    }
    const df = document.getElementById('smFilterFrom')?.value;
    if (df) params.date_from = df;
    const dt = document.getElementById('smFilterTo')?.value;
    if (dt) params.date_to = dt;

    const res = await api('stock_movements', params);
    const tbody = document.getElementById('smTableBody');
    const totalQtyEl = document.getElementById('smTotalQty');
    const totalWeightEl = document.getElementById('smTotalWeight');
    const avgGrmEl = document.getElementById('smAvgGrm');

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="12"><div class="empty-state"><div class="empty-icon">🔄</div><div class="empty-text">Stok hareketi bulunamadı</div></div></td></tr>';
      if (totalQtyEl) totalQtyEl.innerText = '0 mt';
      if (totalWeightEl) totalWeightEl.innerText = '0 kg';
      if (avgGrmEl) avgGrmEl.innerText = '0 gr';
      return;
    }

    let totalQty = 0;
    let totalWeight = 0;
    tbody.innerHTML = res.data.map(m => {
      const isGiris = m.type === 'giris';
      const icon = isGiris ? '📥' : '📤';
      const color = isGiris ? 'var(--accent)' : 'var(--danger)';

      const mult = isGiris ? 1 : -1;
      const mQty = parseFloat(m.qty || 0);
      const mWeight = parseFloat(m.weight_kg || 0);

      totalQty += mult * mQty;
      totalWeight += mult * mWeight;

      const grm = (mQty > 0) ? (mWeight * 1000 / mQty).toFixed(0) : '-';

      let typeLabel = 'Bilinmiyor';
      let badgeClass = 'badge-blue';

      switch (m.act_type) {
        case 'qc': typeLabel = 'İç Üretim'; badgeClass = 'badge-teal'; break;
        case 'external': typeLabel = 'Dış Alım'; badgeClass = 'badge-blue'; break;
        case 'ship': typeLabel = 'Sevkiyat'; badgeClass = 'badge-purple'; break;
        case 'manual': typeLabel = 'Düzeltme'; badgeClass = 'badge-red'; break;
      }

      return `
        <tr>
          <td style="font-size:11px">${fmtDate(m.created_at)}</td>
          <td style="font-weight:600;color:var(--text)">
            ${m.product_name} <br>
            <span style="color:var(--text3);font-size:10px">${m.product_code || ''}</span>
          </td>
          <td style="font-weight:600; color:var(--text2)">${m.loom_name || '-'}</td>
          <td style="font-weight:700; color:var(--accent)">${m.customer_name || '-'}</td>
          <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
          <td style="font-weight:700;color:${color}; text-align:center">${m.qty} mt</td>
          <td style="font-weight:700;color:var(--purple); text-align:center">${m.weight_kg || '0'} kg</td>
          <td style="text-align:center; color:var(--text2)">${grm} gr</td>
          <td>${m.document_no || '-'}</td>
          <td style="font-size:11px">${m.info || '-'}</td>
          <td style="font-size:11px">${m.user_name || '-'}</td>
        </tr>
      `;
    }).join('');

    if (totalQtyEl) {
      totalQtyEl.innerText = totalQty.toFixed(1) + ' mt';
      totalQtyEl.style.color = totalQty >= 0 ? 'var(--accent)' : 'var(--danger)';
    }
    if (totalWeightEl) {
      totalWeightEl.innerText = totalWeight.toFixed(1) + ' kg';
    }
    if (avgGrmEl) {
      // Ağırlıklı ortalama daha doğrudur: Toplam KG * 1000 / Toplam MT
      const avg = (totalQty > 0) ? (totalWeight * 1000 / totalQty) : 0;
      avgGrmEl.innerText = avg.toFixed(0) + ' gr';
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  REPORTS
// ═══════════════════════════════
async function loadReports() {
  const content = document.getElementById('contentArea');
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  content.innerHTML = `
    <div class="filter-bar" style="background:var(--surface2); padding:15px; border-radius:12px; margin-bottom:25px; border:1px solid var(--border)">
      <div style="display:flex; align-items:center; gap:15px">
        <div style="font-weight:700; color:var(--accent); font-size:14px">📅 RAPOR DÖNEMİ:</div>
        <input type="date" id="rptFrom" value="${firstDay}" class="form-control" style="width:160px" onchange="refreshReports()">
        <input type="date" id="rptTo" value="${today}" class="form-control" style="width:160px" onchange="refreshReports()">
        <button class="btn btn-primary btn-sm" onclick="refreshReports()">🔄 VERİLERİ GÜNCELLE</button>
      </div>
    </div>

    <!-- ÖZET KARTLAR (PATRON KPI) -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:25px">
      <!-- 1. ÜRETİM (KK) -->
      <div class="panel" style="background:linear-gradient(135deg, var(--surface), var(--surface2)); border-left:4px solid var(--accent)">
        <div class="panel-body" style="padding:15px">
          <div style="font-size:11px; color:var(--text3); font-weight:600; margin-bottom:8px; text-transform:uppercase">🏭 KK ÜRETİM</div>
          <div style="display:flex; align-items:baseline; gap:5px">
            <span id="statProdMt" style="font-size:24px; font-weight:800; color:var(--text)">0</span>
            <span style="color:var(--accent); font-weight:600; font-size:12px">mt</span>
          </div>
          <div id="statProdKg" style="font-size:11px; color:var(--text2); margin-top:4px">0 kg / 0 Top</div>
        </div>
      </div>

      <!-- 2. SEVKİYAT -->
      <div class="panel" style="background:linear-gradient(135deg, var(--surface), var(--surface2)); border-left:4px solid var(--purple)">
        <div class="panel-body" style="padding:15px">
          <div style="font-size:11px; color:var(--text3); font-weight:600; margin-bottom:8px; text-transform:uppercase">🚚 SEVKİYAT</div>
          <div style="display:flex; align-items:baseline; gap:5px">
            <span id="statShipMt" style="font-size:24px; font-weight:800; color:var(--text)">0</span>
            <span style="color:var(--purple); font-weight:600; font-size:12px">mt</span>
          </div>
          <div id="statShipKg" style="font-size:11px; color:var(--text2); margin-top:4px">0 kg / 0 Sevk</div>
        </div>
      </div>

      <!-- 3. TOPLAM STOK -->
      <div class="panel" style="background:linear-gradient(135deg, var(--surface), var(--surface2)); border-left:4px solid #00d4aa">
        <div class="panel-body" style="padding:15px">
          <div style="font-size:11px; color:var(--text3); font-weight:600; margin-bottom:8px; text-transform:uppercase">📦 TOPLAM STOK</div>
          <div style="display:flex; align-items:baseline; gap:5px">
            <span id="statStock" style="font-size:24px; font-weight:800; color:#00d4aa">0</span>
            <span style="color:var(--text3); font-weight:600; font-size:12px">mt</span>
          </div>
          <div id="statStockSub" style="font-size:11px; color:var(--text2); margin-top:4px">0 kg / 0 Top</div>
        </div>
      </div>

      <!-- 4. DOKUMA PERFORMANSI -->
      <div class="panel" style="background:linear-gradient(135deg, var(--surface), var(--surface2)); border-left:4px solid #4f7cff">
        <div class="panel-body" style="padding:15px">
          <div style="font-size:11px; color:var(--text3); font-weight:600; margin-bottom:8px; text-transform:uppercase">🧶 DOKUMA (TEZGAH)</div>
          <div style="display:flex; align-items:baseline; gap:5px">
            <span id="statLoomMt" style="font-size:24px; font-weight:800; color:#4f7cff">0</span>
            <span style="color:var(--text3); font-weight:600; font-size:12px">mt</span>
          </div>
          <div id="statLoomCount" style="font-size:11px; color:var(--text2); margin-top:4px">0 Aktif Tezgah</div>
        </div>
      </div>

      <!-- 5. KALİTE BAŞARISI -->
      <div class="panel" style="background:linear-gradient(135deg, var(--surface), var(--surface2)); border-left:4px solid var(--warning)">
        <div class="panel-body" style="padding:15px">
          <div style="font-size:11px; color:var(--text3); font-weight:600; margin-bottom:8px; text-transform:uppercase">⭐ KALİTE</div>
          <div style="display:flex; align-items:baseline; gap:5px">
            <span id="statQuality" style="font-size:24px; font-weight:800; color:var(--warning)">0</span>
            <span style="color:var(--text3); font-weight:600; font-size:12px">/ 100</span>
          </div>
          <div style="font-size:11px; color:var(--text2); margin-top:4px">Hata Oranı Analizi</div>
        </div>
      </div>
    </div>

    <!-- GRAFİKLER VE LİSTELER -->
    <div class="grid-2" style="grid-template-columns: 2fr 1fr; gap:25px; margin-bottom:25px">
      <div class="panel">
        <div class="panel-head" style="background:var(--surface2)"><span class="panel-title">📈 GÜNLÜK ÜRETİM TRENDİ (KK)</span></div>
        <div class="panel-body" style="height:320px">
          <canvas id="rptTrendChart"></canvas>
        </div>
      </div>
      
      <div class="panel">
        <div class="panel-head" style="background:var(--surface2)"><span class="panel-title">🏆 EN ÇOK SEVK EDİLEN MÜŞTERİLER</span></div>
        <div class="panel-body" style="padding:0">
          <table style="font-size:12px">
            <tbody id="rptTopCustomers">
              <tr><td style="text-align:center; padding:50px; color:var(--text3)">Yükleniyor...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid-2" style="grid-template-columns: 1.5fr 1.5fr; gap:25px">
      <div class="panel">
        <div class="panel-head" style="background:var(--surface2)"><span class="panel-title">🧶 STOKTAKİ EN ÇOK ÜRÜNLER (METRAJ)</span></div>
        <div class="panel-body" style="padding:0">
          <table>
            <thead><tr><th>Ürün Adı</th><th style="text-align:right">Mevcut Stok</th></tr></thead>
            <tbody id="rptTopStock">
              <tr><td colspan="2" style="text-align:center; padding:50px; color:var(--text3)">Yükleniyor...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head" style="background:var(--surface2)"><span class="panel-title">📊 GENEL VERİMLİLİK</span></div>
        <div class="panel-body" style="padding:20px">
           <div style="text-align:center; margin-bottom:20px">
             <div style="font-size:12px; color:var(--text3); margin-bottom:8px; font-weight:600">SEVKİYAT / ÜRETİM DENGESİ</div>
             <div id="efficiencyValue" style="font-size:48px; font-weight:800; color:var(--accent)">%0</div>
             <div id="efficiencyText" style="font-size:12px; color:var(--text2); margin-top:8px">Analiz ediliyor...</div>
           </div>
           
           <hr style="border:0; border-top:1px solid var(--border); margin:20px 0">
           
           <div style="font-size:12px; font-weight:700; color:var(--text); margin-bottom:12px">📟 TEZGAH ANLIK DURUMU</div>
           <div id="loomStatusList" style="display:flex; flex-direction:column; gap:8px">
              <!-- JS ile dolacak -->
           </div>
        </div>
      </div>
    </div>
  `;

  refreshReports();
}

async function refreshReports() {
  try {
    const from = document.getElementById('rptFrom').value;
    const to = document.getElementById('rptTo').value;

    const res = await api('boss_reports', { from, to });
    const { stats, top_customers, top_stock, trend } = res;

    // 1. Üretim (KK) Kartı
    document.getElementById('statProdMt').innerText = Number(stats.production.meters || 0).toLocaleString('tr-TR');
    document.getElementById('statProdKg').innerText = `${Number(stats.production.weight || 0).toLocaleString('tr-TR')} kg / ${stats.production.rolls} Top`;

    // 2. Sevkiyat Kartı
    document.getElementById('statShipMt').innerText = Number(stats.shipment.meters || 0).toLocaleString('tr-TR');
    document.getElementById('statShipKg').innerText = `${Number(stats.shipment.weight || 0).toLocaleString('tr-TR')} kg / ${stats.shipment.count} Sevk`;

    // 3. Stok Mevcudu (Ürün Kartlarından)
    const stockMtrs = parseFloat(stats.stock.total_meters || 0);
    document.getElementById('statStock').innerText = stockMtrs.toLocaleString('tr-TR');
    document.getElementById('statStockSub').innerText = `${Number(stats.stock.total_kg || 0).toLocaleString('tr-TR')} kg / ${stats.stock.total_rolls || 0} Top`;

    // 4. Dokuma (Tezgah) Kartı
    document.getElementById('statLoomMt').innerText = Number(stats.looms.total_meters || 0).toLocaleString('tr-TR');
    document.getElementById('statLoomCount').innerText = `${stats.looms.count || 0} Aktif Tezgah`;

    // 5. Kalite Skoru
    document.getElementById('statQuality').innerText = stats.production.quality || 0;

    // Verimlilik Hesaplama
    const shipMt = parseFloat(stats.shipment.meters || 0);
    const prodMt = parseFloat(stats.production.meters || 0);
    let efficiency = 0;
    if (prodMt > 0) efficiency = Math.min(100, Math.round((shipMt / prodMt) * 100));

    document.getElementById('efficiencyValue').innerText = `%${efficiency}`;

    let effText = "Dönem verileri analiz ediliyor...";
    if (prodMt > 0) {
      if (efficiency > 90) effText = "Üretilen mallar hızla sevk ediliyor, stok yükünüz azalıyor. 🚀";
      else if (efficiency < 40) effText = "Üretim hızı sevkiyatın üzerinde, stok birikimi olabilir. 📦";
      else effText = "Üretim ve sevkiyat dengesi stabil seyrediyor.";
    }
    document.getElementById('efficiencyText').innerText = effText;

    // Tezgah Durumları
    const loomStatusBody = document.getElementById('loomStatusList');
    if (loomStatusBody) {
      const statusLabels = { 'çalışıyor': 'AKTİF', 'durdu': 'DURDU', 'bekliyor': 'İŞBAŞI', 'arıza': 'ARIZA' };
      const statusColors = { 'çalışıyor': '#00d4aa', 'durdu': '#ff5c6c', 'bekliyor': '#ffb347', 'arıza': '#ffb347' };

      // Özet Badge'ler
      let summaryHtml = (stats.looms.status_distribution || []).map(s => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface); padding:6px 10px; border-radius:6px; border:1px solid var(--border)">
          <div style="display:flex; align-items:center; gap:6px">
            <div style="width:8px; height:8px; border-radius:50%; background:${statusColors[s.status] || '#8b92a8'}"></div>
            <span style="font-size:10px; font-weight:600; color:var(--text2)">${(statusLabels[s.status] || s.status).toUpperCase()}</span>
          </div>
          <span style="font-weight:700; color:var(--text); font-size:11px">${s.count}</span>
        </div>
      `).join('');

      // Detaylı Liste (Randımanlı)
      let listHtml = `
        <div style="margin-top:12px; max-height:250px; overflow-y:auto; border-top:1px dashed var(--border); padding-top:12px">
          <table style="width:100%; font-size:10px">
            <thead>
              <tr style="color:var(--text3); text-transform:uppercase; font-size:9px">
                <th style="text-align:left; padding-bottom:6px">Tezgah</th>
                <th style="text-align:center; padding-bottom:6px">Durum</th>
                <th style="text-align:right; padding-bottom:6px">Randıman</th>
              </tr>
            </thead>
            <tbody>
              ${(stats.looms.list || []).map(l => {
        const eff = parseFloat(l.last_efficiency || 0);
        const color = eff >= 85 ? 'var(--accent)' : (eff >= 70 ? 'var(--warning)' : 'var(--danger)');
        return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.02)">
                    <td style="font-weight:700; padding:6px 0">${l.name}</td>
                    <td style="text-align:center"><div style="width:6px; height:6px; border-radius:50%; background:${statusColors[l.status]}; display:inline-block"></div></td>
                    <td style="text-align:right; font-weight:800; color:${color}">%${eff.toFixed(1)}</td>
                  </tr>
                `;
      }).join('')}
            </tbody>
          </table>
        </div>
      `;

      loomStatusBody.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px">${summaryHtml}</div>
        ${listHtml}
      `;
    }

    // Top Müşteriler
    const custBody = document.getElementById('rptTopCustomers');
    if (top_customers && top_customers.length) {
      custBody.innerHTML = top_customers.map((c, i) => `
        <tr>
          <td style="width:40px; text-align:center"><span style="background:var(--accent); color:white; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:10px">${i + 1}</span></td>
          <td style="font-weight:600">${c.name}</td>
          <td style="text-align:right; font-weight:700; color:var(--accent)">${Number(c.total_mt).toLocaleString('tr-TR')} mt</td>
        </tr>
      `).join('');
    } else {
      custBody.innerHTML = '<tr><td style="text-align:center; padding:50px; color:var(--text3)">Bu dönemde sevkiyat bulunamadı.</td></tr>';
    }

    // 3. Stok (Ürün Kartlarından) - ÖNCELİKLİ YÜKLEME
    const stockBody = document.getElementById('rptTopStock');
    if (stockBody) {
      if (top_stock && top_stock.length) {
        stockBody.innerHTML = top_stock.map(p => `
          <tr>
            <td style="font-weight:600; color:var(--text)">${p.name}</td>
            <td style="text-align:right; font-weight:700; color:#00d4aa">${Number(p.qty || 0).toLocaleString('tr-TR')} mt</td>
          </tr>
        `).join('');
      } else {
        stockBody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:50px; color:var(--text3)">Stok kaydı bulunamadı.</td></tr>';
      }
    }

    // Trend Grafiği - GÜVENLİ YÜKLEME
    try {
      const ctx = document.getElementById('rptTrendChart')?.getContext('2d');
      if (ctx) {
        if (chartInstances['rptTrend']) chartInstances['rptTrend'].destroy();
        chartInstances['rptTrend'] = new Chart(ctx, {
          type: 'line',
          data: {
            labels: trend.map(t => t.label.split('-').reverse().slice(0, 2).join('.')),
            datasets: [{
              label: 'Günlük Üretim (mt)',
              data: trend.map(t => t.value),
              borderColor: '#7c5cfc',
              backgroundColor: 'rgba(124, 92, 252, 0.1)',
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              pointRadius: 4,
              pointBackgroundColor: '#7c5cfc'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    } catch (chartError) {
      console.error('Grafik yüklenemedi:', chartError);
    }

  } catch (e) { toast(e.message, 'error'); }
}


// ═══════════════════════════════
//  SETTINGS
// ═══════════════════════════════
// New tabbed settings page - will be merged into app2.js

async function loadSettings() {
  const content = document.getElementById('contentArea');
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  content.innerHTML = `
    <div class="tab-bar" id="settingsTabBar" style="margin-bottom:20px; position:sticky; top:0; z-index:10; background:var(--bg); padding:8px 0">
      <button type="button" class="tab-btn active" onclick="switchSettingsTab('firma')">🏢 Firma Bilgileri</button>
      <button type="button" class="tab-btn" onclick="switchSettingsTab('sistem')">💾 Sistem</button>
      <button type="button" class="tab-btn" onclick="switchSettingsTab('tipler')">🧵 Tipler</button>
      ${isAdmin ? '<button type="button" class="tab-btn" onclick="switchSettingsTab(\'kullanicilar\')">👥 Kullanıcılar</button>' : ''}
      ${isSuperAdmin ? '<button type="button" class="tab-btn" onclick="switchSettingsTab(\'lisans\')">🔑 Lisans & Program</button>' : ''}
    </div>

    <!-- TAB: Firma Bilgileri -->
    <div id="settingsTab-firma" class="settings-tab-content">
      <div class="panel">
        <div class="panel-head"><span class="panel-title">🏢 Firma Bilgileri</span></div>
        <div class="panel-body">
          <form onsubmit="saveSettings(event)">
            <div class="form-grid">
              <div class="form-floating form-full">
                <input type="text" id="setCompanyName" placeholder=" ">
                <label>Firma Adı</label>
              </div>
              <div class="form-floating">
                <input type="text" id="setCompanyPhone" placeholder=" ">
                <label>Telefon</label>
              </div>
              <div class="form-floating">
                <input type="number" id="setThreshold1" placeholder=" " min="0" max="100">
                <label>1. Kalite Eşiği (%)</label>
              </div>
              <div class="form-floating form-full">
                <textarea id="setCompanyAddress" placeholder=" " rows="2"></textarea>
                <label>Adres</label>
              </div>
              <div class="form-floating">
                <input type="number" id="setThreshold2" placeholder=" " min="0" max="100">
                <label>2. Kalite Eşiği (%)</label>
              </div>
            </div>

            <div class="form-actions" style="border:none;padding-top:8px"><button type="submit" class="btn btn-primary">✓ Kaydet</button></div>
          </form>
        </div>
      </div>
    </div>

    <!-- TAB: Sistem -->
    <div id="settingsTab-sistem" class="settings-tab-content" style="display:none">
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><span class="panel-title">🎨 Tema & Görünüm</span></div>
          <div class="panel-body">
            <form onsubmit="saveSettings(event)">
              <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Sistem Teması</div>
              <div style="display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap">
                <div class="theme-opt" onclick="setThemePreview('dark')" id="t-dark" title="Dokuma Dark" style="background:#0a0c10; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('ipex')" id="t-ipex" title="IPEX Blue" style="background:#0B1C2E; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('light')" id="t-light" title="Açık Tema" style="background:#F5F7FB; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('emerald')" id="t-emerald" title="Zümrüt Yeşil" style="background:#06110E; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('purple')" id="t-purple" title="Gece Moru" style="background:#0c0a15; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('sunset')" id="t-sunset" title="Gün Batımı" style="background:#120a0a; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('midnight')" id="t-midnight" title="Lacivert Gece" style="background:#020617; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('carbon')" id="t-carbon" title="Karbon Gri" style="background:#111111; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('earth')" id="t-earth" title="Toprak Tonları" style="background:#0f0d0c; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('cyber')" id="t-cyber" title="Cyberpunk Neon" style="background:#050505; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('neon')" id="t-neon" title="Neon Nights" style="background:#090912; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('ocean')" id="t-ocean" title="Ocean Deep" style="background:#050b14; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('forest')" id="t-forest" title="Forest Zen" style="background:#081008; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('gold')" id="t-gold" title="Luxury Gold" style="background:#0a0a0a; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('arctic')" id="t-arctic" title="Arktik Beyaz" style="background:#f0f4f8; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('sand')" id="t-sand" title="Kumsal / Toprak" style="background:#fdfaf6; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('mint')" id="t-mint" title="Taze Nane" style="background:#f6fcf9; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <div class="theme-opt" onclick="setThemePreview('rose')" id="t-rose" title="Gül Kurusu" style="background:#fff5f7; border:2px solid var(--border); width:28px; height:28px; border-radius:50%; cursor:pointer"></div>
                <input type="hidden" id="setTheme" value="dark">
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">🏠 Varsayılan Açılış Sayfası</div>
              <div class="form-floating" style="margin-bottom:15px">
                <select id="setDefaultPage">
                  <option value="dashboard">Dashboard</option>
                  <option value="modules">Modüller</option>
                  <option value="qc-new">Kalite Kontrol</option>
                  <option value="qc-list">Kontrol Listesi</option>
                  <option value="looms">Tezgahlar</option>
                  <option value="analiz">Maliyet Analizi</option>
                  <option value="products">Ürünler & Stok</option>
                  <option value="depo-giris">Depo Giriş</option>
                  <option value="stock-move">Stok Hareketleri</option>
                  <option value="orders">Sipariş & Projeler</option>
                  <option value="shipments">Sevkiyat / Çeki</option>
                  <option value="customers">Cariler</option>
                  <option value="reports">Raporlar</option>
                  <option value="settings">Ayarlar</option>
                  <option value="about">Hakkında</option>
                </select>
                <label>Giriş Yaptıktan Sonra Açılacak Sayfa</label>
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);margin-top:18px;margin-bottom:8px;text-transform:uppercase">📐 Çözgü Düşüm Kaynağı</div>
              <div class="form-floating" style="margin-bottom:15px">
                <select id="setWarpDeduction">
                  <option value="counter">Makine Sayacı Üzerinden Düş (Önerilen)</option>
                  <option value="qc">Kalite Kontrol (Gerçek Top Metresi) Üzerinden Düş</option>
                </select>
                <label>Randıman ve Kalan Çözgü Hesaplama Yöntemi</label>
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);margin-top:18px;margin-bottom:8px;text-transform:uppercase">⚠️ Çözgü Azalma Uyarı Eşiği</div>
              <div class="form-floating" style="margin-bottom:15px">
                <input type="number" id="setWarpLowThreshold" placeholder=" " value="2000">
                <label>Minimum Kalan Çözgü (mt) — Altındaki tezgahlar uyarılır</label>
              </div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);margin-top:18px;margin-bottom:8px;text-transform:uppercase">🏷️ Barkod Ayarları</div>
              <div style="display:flex; gap:14px; margin-bottom:15px">
                <div class="form-floating" style="flex:1">
                  <input type="number" id="setBarcodeWidth" placeholder=" " value="100">
                  <label>Genişlik (mm)</label>
                </div>
                <div class="form-floating" style="flex:1">
                  <input type="number" id="setBarcodeHeight" placeholder=" " value="100">
                  <label>Yükseklik (mm)</label>
                </div>
              </div>
              <div class="form-actions" style="border:none;padding-top:8px"><button type="submit" class="btn btn-primary">✓ Kaydet</button></div>
            </form>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><span class="panel-title">🔧 Yedekleme & Bakım</span></div>
          <div class="panel-body">
            <div style="padding:16px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:12px">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">Veritabanı Yedeği</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:12px">SQLite veritabanı dosyasını indirerek yedekleyin.</div>
              <button class="btn btn-secondary" onclick="window.location.href='api.php?action=backup'">📥 Yedek İndir</button>
            </div>
            <div style="padding:16px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:12px">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">Yedek Yükle</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Daha önce indirdiğiniz bir .db yedeğini geri yükleyin.</div>
              <input type="file" id="restoreFile" accept=".db,.sqlite" style="display:none" onchange="systemRestore(this)">
              <button class="btn btn-secondary" onclick="document.getElementById('restoreFile').click()">📤 Yedek Yükle</button>
            </div>
            <div style="padding:16px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:12px">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">Uygulama Bilgileri</div>
              <div style="font-size:12px;color:var(--text2);line-height:1.8">
                <strong>Versiyon:</strong> v1.0.0<br>
                <strong>PHP:</strong> Backend<br>
                <strong>Veritabanı:</strong> SQLite
              </div>
            </div>
            <div style="padding:16px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:12px">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">Mesajlaşma Yönetimi</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Chat mesaj geçmişini temizleyerek yer kazanın.</div>
              <button class="btn btn-secondary" onclick="clearChatHistory()">🗑️ Mesaj Geçmişini Temizle</button>
            </div>
            <div style="padding:16px;background:rgba(255,92,108,0.06);border:1px solid rgba(255,92,108,0.15);border-radius:var(--radius-sm)">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--danger)">⚠️ Tehlikeli Bölge</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Veritabanındaki tüm verileri tamamen siler. Bu işlem geri alınamaz!</div>
              <button class="btn btn-danger" style="width:100%" onclick="systemReset()">🔴 Veritabanını Sıfırla</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Tipler -->
    <div id="settingsTab-tipler" class="settings-tab-content" style="display:none">
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">🧵 Kumaş Tipleri</span>
            <span class="panel-action" onclick="addFabricType()">+ Ekle</span>
          </div>
          <div class="panel-body" style="padding:0">
            <table><tbody id="fabricTypeList"></tbody></table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">🔴 Hata Tipleri</span>
            <span class="panel-action" onclick="addDefectType()">+ Ekle</span>
          </div>
          <div class="panel-body" style="padding:0">
            <table><tbody id="defectTypeList"></tbody></table>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: Kullanıcılar (admin only) -->
    ${isAdmin ? `
    <div id="settingsTab-kullanicilar" class="settings-tab-content" style="display:none">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">👥 Kullanıcılar</span>
          <span class="panel-action" onclick="openUserModal()">+ Yeni Kullanıcı</span>
        </div>
        <div class="panel-body" style="padding:0;overflow-x:auto">
          <table>
            <thead><tr><th>Kullanıcı Adı</th><th>Ad Soyad</th><th>Rol</th><th>Son Giriş</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody id="userTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>` : ''}

    <!-- TAB: Lisans & Program (superadmin only) -->
    ${isSuperAdmin ? `
    <div id="settingsTab-lisans" class="settings-tab-content" style="display:none">
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><span class="panel-title">🔑 Lisans Yönetimi</span></div>
          <div class="panel-body">
            <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:12px;text-transform:uppercase">Lisans Bilgileri</div>
            <div id="licenseInfo" style="background:var(--surface2);padding:16px;border-radius:var(--radius-sm);margin-bottom:16px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                <div>
                  <div style="font-size:11px;color:var(--text3)">Bitiş Tarihi</div>
                  <div id="licenseEndDate" style="font-weight:600;color:var(--text);font-size:14px">Yükleniyor...</div>
                </div>
                <div>
                  <div style="font-size:11px;color:var(--text3)">Kalan Gün</div>
                  <div id="licenseDaysLeft" style="font-weight:600;color:var(--accent);font-size:14px">-</div>
                </div>
              </div>
              <div id="licenseWarning" style="display:none;padding:8px;background:rgba(255,179,71,.1);border:1px solid var(--warning);border-radius:6px;color:var(--warning);font-size:12px"></div>
            </div>
            <form id="licenseForm" onsubmit="saveLicense(event)" style="background:var(--surface2);padding:16px;border-radius:var(--radius-sm)">
              <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase">Lisansı Güncelle</div>
              <div class="form-grid">
                <div class="form-floating">
                  <input type="date" id="licenseEndDateInput" required placeholder=" ">
                  <label>Lisans Bitiş Tarihi *</label>
                </div>
                <div class="form-floating">
                  <input type="number" id="licenseWarningDays" placeholder=" " value="7" min="1" max="30">
                  <label>Uyarı Gün Sayısı</label>
                </div>
              </div>
              <div class="form-actions" style="border:none;padding:0;margin-top:12px">
                <button type="submit" class="btn btn-primary">💾 Lisansı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">🏷️ Program Alıcıları ve Barkod Serileri</span></div>
        <div class="panel-body">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:12px;text-transform:uppercase">Kayıtlı Program Alıcıları</div>
          <div style="overflow-x:auto">
            <table class="toplu-table" style="margin-bottom:16px;min-width:700px">
              <thead>
                <tr>
                  <th>Müşteri Adı</th>
                  <th>İç Üretim Başlangıç</th>
                  <th>Dış Üretim Başlangıç</th>
                  <th>Satış Tarihi</th>
                  <th>Notlar</th>
                  <th style="width:80px"></th>
                </tr>
              </thead>
              <tbody id="programBuyerList">
                <tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Yükleniyor...</td></tr>
              </tbody>
            </table>
          </div>
          <form id="programBuyerForm" onsubmit="saveProgramBuyer(event)" style="background:var(--surface2);padding:16px;border-radius:var(--radius-sm)">
            <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase">Yeni Müşteri Ekle / Düzenle</div>
            <input type="hidden" id="pbId" value="">
            <div class="form-grid">
              <div class="form-floating">
                <input type="text" id="pbCustomerName" placeholder=" " required>
                <label>Müşteri Adı</label>
              </div>
              <div class="form-floating">
                <input type="number" id="pbInternalStart" placeholder=" " min="100000000" max="999999999">
                <label>İç Üretim Barkod Başlangıç (9 haneli)</label>
              </div>
              <div class="form-floating">
                <input type="number" id="pbExternalStart" placeholder=" " min="100000000" max="999999999">
                <label>Dış Üretim Barkod Başlangıç (9 haneli)</label>
              </div>
              <div class="form-floating">
                <input type="date" id="pbSaleDate" placeholder=" ">
                <label>Satış Tarihi</label>
              </div>
            </div>
            <div class="form-floating" style="margin-top:8px;margin-bottom:12px">
              <textarea id="pbNotes" placeholder=" " style="height:60px;resize:vertical"></textarea>
              <label>Notlar</label>
            </div>
            <div class="form-actions" style="border:none;padding:0">
              <button type="submit" class="btn btn-primary">💾 Kaydet</button>
              <button type="button" class="btn btn-secondary" onclick="resetProgramBuyerForm()">Temizle</button>
            </div>
          </form>
        </div>
      </div>
    </div>` : ''}
  `;
  loadSettingsData();
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#settingsTabBar .tab-btn').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('settingsTab-' + tab);
  if (target) target.style.display = 'block';
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
}


function systemReset() {
  openModal('Sistemi Sıfırla', `
    <div style="text-align:center; padding:10px 0">
      <div style="font-size:48px; margin-bottom:16px">⚠️</div>
      <div style="font-size:16px; font-weight:700; color:var(--danger); margin-bottom:12px">TÜM VERİLER SİLİNECEK!</div>
      <div style="font-size:13px; color:var(--text2); line-height:1.6; margin-bottom:20px">
        Bu işlem sonucunda tezgahlar, üretimler, stoklar ve müşteriler dahil tüm veritabanı temizlenecektir. <b>Bu işlem geri alınamaz.</b>
      </div>
      <div class="form-floating">
        <input type="text" id="resetConfirmCode" placeholder=" " style="text-align:center; letter-spacing:2px; font-weight:800; color:var(--danger)">
        <label>Onaylamak için "SIFIRLA" yazın</label>
      </div>
      <div style="display:flex; gap:12px; margin-top:24px">
        <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-danger" style="flex:1" onclick="executeSystemReset()">Evet, Her Şeyi Sil</button>
      </div>
    </div>
  `);
}

async function executeSystemReset() {
  const code = document.getElementById('resetConfirmCode').value;
  if (code !== 'SIFIRLA') {
    toast('Lütfen onay kodunu doğru girin (SIFIRLA)', 'error');
    return;
  }

  try {
    closeModal();
    toast('Sistem sıfırlanıyor...', 'info');
    const res = await api('system_reset', {}, 'POST');
    if (res.success) {
      toast('Sistem başarıyla sıfırlandı');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(res.error || 'Sıfırlama başarısız');
    }
  } catch (e) { toast(e.message, 'error'); }
}

function clearChatHistory() {
  openModal('Mesaj Geçmişini Temizle', `
    <div style="text-align:center; padding:10px 0">
      <div style="font-size:48px; margin-bottom:16px">🗑️</div>
      <div style="font-size:16px; font-weight:700; color:var(--danger); margin-bottom:12px">TÜM MESAJLAR SİLİNECEK!</div>
      <div style="font-size:13px; color:var(--text2); line-height:1.6; margin-bottom:20px">
        Tüm sohbet geçmişi kalıcı olarak silinecektir. Bu işlem veritabanında yer açmanızı sağlar ancak <b>geri alınamaz.</b>
      </div>
      <div style="display:flex; gap:12px; margin-top:24px">
        <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-danger" style="flex:1" onclick="executeClearChatHistory()">Evet, Temizle</button>
      </div>
    </div>
  `);
}

async function executeClearChatHistory() {
  try {
    closeModal();
    toast('Mesajlar temizleniyor...', 'info');
    const res = await api('messages_clear', {}, 'POST');
    if (res.success) {
      toast('Mesaj geçmişi başarıyla temizlendi');
    } else {
      throw new Error(res.error || 'Temizleme işlemi başarısız oldu');
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

function systemRestore(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  openModal('Yedek Geri Yükle', `
    <div style="text-align:center; padding:10px 0">
      <div style="font-size:48px; margin-bottom:16px">📤</div>
      <div style="font-size:16px; font-weight:700; color:var(--warning); margin-bottom:12px">VERİLERİN ÜZERİNE YAZILACAK</div>
      <div style="font-size:13px; color:var(--text2); line-height:1.6; margin-bottom:20px">
        <b>${file.name}</b> isimli yedek dosyası yüklenecek. Mevcut tüm verileriniz silinecek ve bu yedekteki veriler getirilecektir.
      </div>
      <div style="display:flex; gap:12px; margin-top:24px">
        <button class="btn btn-secondary" style="flex:1" onclick="closeModal(); document.getElementById('restoreFile').value=''">Vazgeç</button>
        <button class="btn btn-primary" style="flex:1" id="btnConfirmRestore">Evet, Yükle</button>
      </div>
    </div>
  `);

  document.getElementById('btnConfirmRestore').onclick = async () => {
    const formData = new FormData();
    formData.append('backup_file', file);

    try {
      closeModal();
      toast('Yedek yükleniyor, lütfen bekleyin...', 'info');
      const res = await fetch('api.php?action=restore', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast('Yedek başarıyla yüklendi. Sistem yeniden başlatılıyor...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        throw new Error(data.error || 'Yükleme başarısız');
      }
    } catch (e) {
      toast(e.message, 'error');
      document.getElementById('restoreFile').value = '';
    }
  };
}

async function loadSettingsData() {
  try {
    const [sRes, ftRes, dtRes] = await Promise.all([
      api('settings'), api('fabric_types'), api('defect_types')
    ]);
    const s = sRes.data || {};
    document.getElementById('setCompanyName').value = s.company_name || '';
    document.getElementById('setCompanyPhone').value = s.company_phone || '';
    document.getElementById('setCompanyAddress').value = s.company_address || '';
    document.getElementById('setThreshold1').value = s.quality_threshold_1 || '85';
    document.getElementById('setThreshold2').value = s.quality_threshold_2 || '70';
    document.getElementById('setBarcodeWidth').value = s.barcode_width || '100';
    document.getElementById('setBarcodeHeight').value = s.barcode_height || '100';
    document.getElementById('setWarpDeduction').value = s.warp_deduction || 'counter';
    document.getElementById('setWarpLowThreshold').value = s.warp_low_threshold || '2000';

    document.getElementById('setDefaultPage').value = s.default_landing_page || 'dashboard';
    setThemePreview(s.theme || 'dark');

    fabricTypes = ftRes.data || [];
    const ftList = document.getElementById('fabricTypeList');
    ftList.innerHTML = fabricTypes.map(ft => `
      <tr>
        <td style="font-weight:500;color:var(--text);padding:10px 14px;width:100%">${ft.name}</td>
        <td style="padding:10px 14px"><button class="btn-del" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px" onclick="deleteFabricType(${ft.id})" title="Sil">×</button></td>
      </tr>
    `).join('') || '<tr><td style="text-align:center;color:var(--text3);padding:20px">Kumaş tipi yok</td></tr>';

    defectTypes = dtRes.data || [];
    const dtList = document.getElementById('defectTypeList');
    dtList.innerHTML = defectTypes.map(dt => `
      <tr>
        <td style="font-weight:500;color:var(--text);padding:10px 14px;width:100%">${dt.name} <span style="color:var(--text3);font-size:11px;margin-left:8px">(${dt.code || '-'})</span></td>
        <td style="padding:10px 14px"><button class="btn-del" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px" onclick="deleteDefectType(${dt.id})" title="Sil">×</button></td>
      </tr>
    `).join('') || '<tr><td style="text-align:center;color:var(--text3);padding:20px">Hata tipi yok</td></tr>';

    if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') loadUsers();
    if (currentUser?.role === 'superadmin') {
      // Show superadmin-only elements
      document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = '');
      loadProgramBuyers();
      loadLicenseInfo();
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function saveSettings(e) {
  e.preventDefault();
  try {
    await api('settings', {
      company_name: document.getElementById('setCompanyName').value,
      company_phone: document.getElementById('setCompanyPhone').value,
      company_address: document.getElementById('setCompanyAddress').value,
      quality_threshold_1: document.getElementById('setThreshold1').value,
      quality_threshold_2: document.getElementById('setThreshold2').value,
      barcode_width: document.getElementById('setBarcodeWidth').value,
      barcode_height: document.getElementById('setBarcodeHeight').value,
      warp_deduction: document.getElementById('setWarpDeduction').value,
      warp_low_threshold: document.getElementById('setWarpLowThreshold').value,
      theme: document.getElementById('setTheme').value,
      default_landing_page: document.getElementById('setDefaultPage').value,
    }, 'POST');
    toast('Ayarlar kaydedildi', 'success');
    // appSettings'i güncelle
    appSettings.default_landing_page = document.getElementById('setDefaultPage').value;
    appSettings.warp_deduction = document.getElementById('setWarpDeduction').value;
  } catch (e) { toast(e.message, 'error'); }
}

function setThemePreview(theme) {
  document.getElementById('setTheme').value = theme;
  document.querySelectorAll('.theme-opt').forEach(el => {
    el.style.borderColor = el.id === 't-' + theme ? 'var(--accent)' : 'var(--border)';
    el.style.transform = el.id === 't-' + theme ? 'scale(1.15)' : 'scale(1)';
  });

  // Apply to body immediately
  document.body.className = 'theme-' + theme;

  // Sync analiz iframe
  const iframe = document.getElementById('analizFrame');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: 'theme-change', theme: theme }, '*');
  }
}

function addFabricType() {
  openModal('Yeni Kumaş Tipi', `
    <form onsubmit="saveNewFabricType(event)">
      <div class="form-floating">
        <input type="text" id="newFabricTypeName" required placeholder=" ">
        <label>Kumaş Tipi Adı *</label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveNewFabricType(e) {
  e.preventDefault();
  const name = document.getElementById('newFabricTypeName').value.trim();
  if (!name) return;
  try {
    await api('fabric_types', { name }, 'POST');
    closeModal();
    toast('Kumaş tipi eklendi');
    loadSettingsData();
    await loadReferenceData();
  } catch (err) { toast(err.message, 'error'); }
}

function addDefectType() {
  openModal('Yeni Hata Tipi', `
    <form onsubmit="saveNewDefectType(event)">
      <div class="form-floating">
        <input type="text" id="newDefectName" required placeholder=" ">
        <label>Hata Tipi Adı *</label>
      </div>
      <div class="form-floating">
        <input type="text" id="newDefectCode" placeholder=" ">
        <label>Kodu (Opsiyonel)</label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveNewDefectType(e) {
  e.preventDefault();
  const name = document.getElementById('newDefectName').value.trim();
  const code = document.getElementById('newDefectCode').value.trim();
  if (!name) return;
  try {
    await api('defect_types', { name, code, severity_default: 1 }, 'POST');
    closeModal();
    toast('Hata tipi eklendi');
    loadSettingsData();
    await loadReferenceData();
  } catch (err) { toast(err.message, 'error'); }
}

function deleteFabricType(id) {
  openModal('Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:24px;color:var(--text)">Bu kumaş tipini silmek istediğinize emin misiniz?</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-danger" onclick="executeDeleteFabricType(${id})">Evet, Sil</button>
      </div>
    </div>
  `);
}

async function executeDeleteFabricType(id) {
  closeModal();
  try {
    await api('fabric_type_delete', { id }, 'POST');
    toast('Kumaş tipi silindi');
    loadSettingsData();
    await loadReferenceData();
  } catch (e) { toast(e.message, 'error'); }
}

function deleteDefectType(id) {
  openModal('Silme Onayı', `
    <div style="padding:20px 0;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:500;margin-bottom:24px;color:var(--text)">Bu hata tipini silmek istediğinize emin misiniz?</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-danger" onclick="executeDeleteDefectType(${id})">Evet, Sil</button>
      </div>
    </div>
  `);
}

async function executeDeleteDefectType(id) {
  closeModal();
  try {
    await api('defect_type_delete', { id }, 'POST');
    toast('Hata tipi silindi');
    loadSettingsData();
    await loadReferenceData();
  } catch (e) { toast(e.message, 'error'); }
}

// Users
async function loadUsers() {
  try {
    const res = await api('users');
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = res.data.map(u => `
      <tr>
        <td style="font-weight:600;color:var(--text)">${u.username}</td>
        <td>${u.full_name}</td>
        <td><span class="badge ${u.role === 'superadmin' ? 'badge-gold' : u.role === 'admin' ? 'badge-purple' : 'badge-blue'}">${u.role === 'superadmin' ? 'Süper Admin' : u.role === 'admin' ? 'Yönetici' : 'Operatör'}</span></td>
        <td>${u.last_login ? fmtDate(u.last_login) : 'Hiç'}</td>
        <td><span style="font-weight:600;color:${u.is_active ? 'var(--accent)' : 'var(--danger)'}">${u.is_active ? '✅ Aktif' : '⛔ Pasif'}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick='openUserModal(${JSON.stringify(u)})'>✏️</button>
          ${u.username !== 'root' ? `<button class="btn btn-sm btn-danger" onclick="toggleUser(${u.id})">${u.is_active ? '🔒' : '🔓'}</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

function openUserModal(user = null) {
  const id = user ? user.id : 0;
  const username = user ? user.username : '';
  const fullName = user ? user.full_name : '';
  const role = user ? user.role : 'operator';
  const perms = user && user.permissions ? user.permissions.split(',') : (role === 'admin' || role === 'superadmin' ? Object.keys(ALL_MODULES) : []);

  const moduleCheckboxes = Object.entries(ALL_MODULES).map(([key, label]) => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;cursor:pointer">
      <input type="checkbox" name="userPerms" value="${key}" ${perms.includes(key) ? 'checked' : ''} style="width:16px;height:16px">
      <span style="font-size:12px">${label}</span>
    </label>
  `).join('');

  openModal(id ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı', `
    <form onsubmit="saveUser(event, ${id})">
      <div class="form-grid">
        <div class="form-floating">
          <input type="text" id="userUsername" required placeholder=" " value="${username}">
          <label>Kullanıcı Adı *</label>
        </div>
        <div class="form-floating">
          <input type="text" id="userFullName" required placeholder=" " value="${fullName}">
          <label>Ad Soyad *</label>
        </div>
        <div class="form-floating">
          <input type="password" id="userPassword" placeholder=" " ${id ? '' : 'required'}>
          <label>Şifre ${id ? '(boş bırakılırsa değişmez)' : '*'}</label>
        </div>
        <div class="form-floating">
          <select id="userRole">
            <option value="operator" ${role === 'operator' ? 'selected' : ''}>Operatör</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Yönetici</option>
          </select>
          <label style="top:8px;transform:none;font-size:10px;color:var(--accent)">Rol</label>
        </div>
      </div>
      
      <div class="form-section">🛡️ Erişebileceği Modüller</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
        ${moduleCheckboxes}
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveUser(e, id) {
  e.preventDefault();
  try {
    const selectedPerms = Array.from(document.querySelectorAll('input[name="userPerms"]:checked')).map(cb => cb.value).join(',');
    await api('users', {
      id: id || '',
      username: document.getElementById('userUsername').value,
      full_name: document.getElementById('userFullName').value,
      password: document.getElementById('userPassword').value,
      role: document.getElementById('userRole').value,
      permissions: selectedPerms
    }, 'POST');
    closeModal();
    toast(id ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi');
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleUser(id) {
  try {
    await api('user_toggle', { id }, 'POST');
    toast('Kullanıcı durumu güncellendi');
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Lisans Fonksiyonları ──
async function loadLicenseInfo() {
  try {
    const res = await api('check_license');
    const elEndDate = document.getElementById('licenseEndDate');
    const elDaysLeft = document.getElementById('licenseDaysLeft');
    const elInput = document.getElementById('licenseEndDateInput');
    const elWarning = document.getElementById('licenseWarning');

    if (elEndDate) elEndDate.textContent = res.end_date || 'Belirlenmemiş';
    if (elDaysLeft) elDaysLeft.textContent = res.days_left;
    if (elInput) elInput.value = res.end_date || '';

    if (elWarning) {
      if (res.days_left <= 0) {
        elWarning.style.display = 'block';
        elWarning.textContent = '🔒 Lisans süresi doldu!';
      } else if (res.warning && res.days_left > 0) {
        elWarning.style.display = 'block';
        elWarning.textContent = `⚠️ Lisansınızın süresi ${res.days_left} gün sonra dolacak!`;
      } else {
        elWarning.style.display = 'none';
      }
    }
  } catch (e) { console.error('License load error:', e); }
}

async function saveLicense(e) {
  e.preventDefault();
  try {
    const data = {
      license_end_date: document.getElementById('licenseEndDateInput').value,
      license_warning_days: document.getElementById('licenseWarningDays').value
    };

    if (!data.license_end_date) {
      toast('Lisans bitiş tarihi gerekli', 'error');
      return;
    }

    await api('set_license', data, 'POST');
    toast('✅ Lisans güncellendi');
    loadLicenseInfo();
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  LOOMS / TEZGAHLAR
// ═══════════════════════════════
function fmt(v, d = 1) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function getEffClass(eff) {
  if (eff >= 92) return 'great';
  if (eff >= 85) return 'good';
  if (eff >= 75) return 'warn';
  return 'bad';
}

async function loadLooms() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div id="efficiencyKPI" class="kpi-grid"><div class="spinner-sm"></div></div>
    <div class="filter-bar">
      <div style="font-size:13px;color:var(--text3);font-weight:500;white-space:nowrap">Tezgah Üretim & Randıman Takibi</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:1">
        <button class="btn btn-secondary btn-sm" onclick="openArchivedLoomsModal()">📁 Pasif</button>
        <button class="btn btn-secondary btn-sm" onclick="loadLoomBulkEntry()">⌨️ Sayaç Girişi</button>
        <button class="btn btn-secondary btn-sm" onclick="loadLoomListView()">📋 Liste</button>
        <button class="btn btn-secondary btn-sm" onclick="loadLoomGantt()">📊 Gantt</button>
        <button class="btn btn-secondary btn-sm" onclick="resetAllLooms()">🌅 Sıfırla</button>
        <button class="btn btn-primary btn-sm" onclick="choosePrintFormat()">🖨️ Yazdır</button>
        <button class="btn btn-primary btn-sm" onclick="openLoomModal()">+ Yeni Tezgah</button>
      </div>
    </div>
    <div id="loomGrid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap:14px">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const [lRes, pRes] = await Promise.all([api('looms'), api('products')]);
    const looms = lRes.data || [];
    const grid = document.getElementById('loomGrid');

    if (!looms.length) {
      grid.innerHTML = '<div style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">🏗️</div><div class="empty-text">Henüz tezgah eklenmemiş</div><button class="btn btn-primary" onclick="openLoomModal()">+ Tezgah Ekle</button></div></div>';
      return;
    }

    let totalEff = 0;
    let effCount = 0;
    let totalDaily = 0;
    let totalTheoretical = 0;
    let activeLooms = 0;

    grid.innerHTML = looms.map(l => {
      // Randıman Hesaplama
      let effValue = 0;
      let theoretical = 0;
      const minsPassed = Math.max(1, l.mins_passed || 1);
      const density = parseFloat(l.product_density || 0);
      const workHours = parseFloat(l.work_hours || 24);

      if (l.last_efficiency !== null) {
        effValue = parseFloat(l.last_efficiency);
        // Theoretical still needed for UI display
        if (l.rpm > 0 && density > 0) {
          theoretical = (parseFloat(l.rpm) * minsPassed) / (density * 100);
        }
      } else if (l.rpm > 0 && density > 0) {
        theoretical = (parseFloat(l.rpm) * minsPassed) / (density * 100);
        effValue = theoretical > 0 ? Math.min(100, (parseFloat(l.daily_meters || 0) / theoretical) * 100) : 0;
      }

      if (l.status === 'çalışıyor') {
        totalEff += effValue;
        effCount++;
        activeLooms++;
      }
      totalDaily += parseFloat(l.daily_meters || 0);
      if (l.rpm > 0 && density > 0) {
        totalTheoretical += (parseFloat(l.rpm) * 60 * workHours) / (density * 100);
      }

      const ec = getEffClass(effValue);
      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, l.warp_total - consumed);

      let remainingDays = '-';
      if (l.rpm > 0 && density > 0 && remaining > 0) {
        const mph = (parseFloat(l.rpm) * 60) / (density * 100);
        const realMpd = mph * 24 * 0.85;
        remainingDays = (remaining / realMpd).toFixed(1) + ' gün';
      }

      let warpYarnDisplay = l.warp_yarn || '-';
      let weftYarnDisplay = l.weft_yarn || '-';
      if (l.product_tech) {
        try {
          const td = JSON.parse(l.product_tech);
          if (td.warpList && td.warpList.length) warpYarnDisplay = td.warpList.join(', ');
          if (td.weftList && td.weftList.length) weftYarnDisplay = td.weftList.join(', ');
        } catch (e) { }
      }

      return `
        <div class="tcard ${l.status === 'çalışıyor' ? 'active' : (l.status === 'durdu' ? 'stopped' : 'idle')}" id="lcard-${l.id}" onclick="openLoomModal(${l.id})" style="cursor:pointer">
          <div class="card-head">
            <div style="display:flex; flex-direction:column; gap:2px">
              <div class="tezgah-id">${l.name}</div>
              <div style="font-size:11px; font-weight:800; color:${effValue >= 85 ? 'var(--accent)' : (effValue >= 70 ? 'var(--warning)' : 'var(--danger)')}">
                %${effValue.toFixed(1)} <span style="font-size:9px; font-weight:400; color:var(--text3)">Rand.</span>
              </div>
            </div>
            <span class="status-badge ${l.status === 'çalışıyor' ? 'active' : (l.status === 'durdu' ? 'stopped' : 'idle')}"
              onclick="event.stopPropagation(); toggleLoomStatus(${l.id})"
              title="Durumu Değiştir"
              style="cursor:pointer; user-select:none">
              ${l.status === 'çalışıyor' ? 'AKTİF' : (l.status === 'durdu' ? 'DURDU' : (l.status === 'arıza' ? 'ARIZA' : 'BEKLİYOR'))}
            </span>
          </div>
          
          <div class="card-meta">
            ${l.order_no ? `
            <div class="meta-row" style="background:rgba(0,212,170,.06);padding:3px 6px;margin:-4px -6px 4px -6px;border-radius:4px">
              <span class="meta-label">📋 Sipariş</span>
              <span class="meta-val" style="color:var(--accent); font-weight:700" title="${l.order_no}">${l.order_no.substring(0, 14)}</span>
            </div>` : ''}
            <div class="meta-row">
              <span class="meta-label">Müşteri</span>
              <span class="meta-val" title="${l.customer_name || '-'}">${l.customer_name ? l.customer_name.substring(0, 12) : '-'}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Kalite</span>
              <span class="meta-val" title="${l.product_name || l.product_code || '-'}">${l.product_code || '-'} ${l.product_name ? l.product_name.substring(0, 10) : ''}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">LOT No</span>
              <span class="meta-val" style="color:var(--warning); font-weight:700">${l.lot_no || '-'}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Hız / Sıklık</span>
              <span class="meta-val">${l.rpm || 0} dev / ${density || 0} tel</span>
            </div>
            ${l.next_product_name ? `
            <div class="meta-row" style="background:rgba(255,160,0,0.08);padding:3px 6px;margin:4px -6px -4px -6px;border-radius:4px;border:1px dashed var(--warning)">
              <span class="meta-label" style="color:var(--warning);font-weight:700">📅 SIRADAKİ</span>
              <span class="meta-val" style="color:var(--text); font-weight:700; font-size:10px" title="${l.next_product_name}">${l.next_product_code || ''} ${l.next_product_name.substring(0, 10)}...</span>
            </div>` : ''}
          </div>

          <div class="card-randiman" style="padding: 10px 16px">
            <div class="rand-header" style="margin-bottom:4px">
              <span class="rand-label" style="font-size:8px">RANDIMAN</span>
              <span class="rand-pct ${ec}" style="font-size:18px">${fmt(effValue, 1)}%</span>
            </div>
            <div class="gauge-track" style="height:4px">
              <div class="gauge-fill ${ec}" style="width: ${effValue}%"></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:6px">
               <div style="font-family:var(--mono); font-size:8px; color:var(--text3)">
                 Üretim: <span style="color:var(--text)">${fmt(l.daily_meters)}</span><small>/${fmt(theoretical)}</small> mt
               </div>
               <div style="font-family:var(--mono); font-size:8px; color:var(--text3)">
                 Süre: <span style="color:var(--text)">${Math.floor(minsPassed / 60)}s ${Math.round(minsPassed % 60)}d</span>
               </div>
            </div>
          </div>

          <div class="card-teknik" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div class="teknik-chip" style="grid-column: 1 / -1">
              <span class="teknik-chip-label">İplik (Çözgü / Atkı)</span>
              <span class="teknik-chip-val" style="color:var(--accent2); font-size:9px;" title="${warpYarnDisplay} / ${weftYarnDisplay}">${warpYarnDisplay} <span style="color:var(--text3)">/</span> ${weftYarnDisplay}</span>
            </div>
            <div class="teknik-chip">
              <span class="teknik-chip-label">Çözgü Kalan</span>
              <span class="teknik-chip-val ${remaining < 200 ? 'danger' : ''}">${fmt(remaining, 0)} mt <span style="color:var(--warning)">(${remainingDays})</span></span>
            </div>
            <div class="teknik-chip" onclick="event.stopPropagation(); toggleWarpSpare(${l.id})" style="cursor:pointer" title="Durumu Değiştir">
              <span class="teknik-chip-label">Yedek Çözgü</span>
              <span class="teknik-chip-val" style="color:${l.warp_spare_status === 'Hazır' ? '#00d4aa' : (l.warp_spare_status === 'Hazırlanıyor' ? 'var(--warning)' : 'var(--text2)')}">
                ${l.warp_spare_status || 'Yok'}
              </span>
            </div>
          </div>

          <div class="card-actions" style="display:flex; gap:4px; padding:4px 6px; border-top:1px solid var(--border)">
            <button class="btn btn-secondary btn-xs" style="flex:1; padding:5px 3px; font-size:10px; white-space:nowrap" onclick="event.stopPropagation(); openMeterModal(${l.id})">📏 Sayaç</button>
            <button class="btn btn-warning btn-xs" style="flex:1; padding:5px 3px; font-size:10px; white-space:nowrap; background:rgba(255,179,71,0.1); color:var(--warning)" onclick="event.stopPropagation(); resetLoomSingle(${l.id}, 'warp')">🔗 İşbağ</button>
            <button class="btn btn-xs" style="flex:1; padding:5px 3px; font-size:10px; white-space:nowrap; background:${l.order_no ? 'rgba(0,212,170,.15)' : 'rgba(79,124,255,.1)'}; color:${l.order_no ? 'var(--accent)' : 'var(--blue)'}; border:1px solid ${l.order_no ? 'rgba(0,212,170,.3)' : 'rgba(79,124,255,.3)'}" onclick="event.stopPropagation(); openLoomOrderModal(${l.id})" title="Sipariş Ata">${l.order_no ? '📋 Değiştir' : '📋 Sipariş'}</button>
          </div>
        </div>
      `;

    }).join('');

    // KPI Güncelleme
    const avgEff = effCount > 0 ? totalEff / effCount : 0;
    const kpi = document.getElementById('efficiencyKPI');
    kpi.innerHTML = `
      <div class="kpi-card teal" style="cursor:default">
        <div class="kpi-label">Toplam Tezgah</div>
        <div class="kpi-value">${looms.length}</div>
      </div>
      <div class="kpi-card green" style="cursor:default">
        <div class="kpi-label">Aktif / Durdu</div>
        <div class="kpi-value"><span style="color:var(--accent)">${activeLooms}</span> / <span style="color:var(--danger)">${looms.length - activeLooms}</span></div>
      </div>
      <div class="kpi-card purple" style="cursor:default">
        <div class="kpi-label">Fabrika Randıman</div>
        <div class="kpi-value accent">${fmt(avgEff, 1)}%</div>
      </div>
      <div class="kpi-card blue" style="cursor:default">
        <div class="kpi-label">Günlük Toplam Üretim</div>
        <div class="kpi-value">${fmt(totalDaily, 1)} mt</div>
      </div>
      <div class="kpi-card orange" style="cursor:default">
        <div class="kpi-label">24h Kapasite</div>
        <div class="kpi-value" style="color:var(--text3)">${fmt(totalTheoretical, 0)} mt</div>
      </div>
    `;

  } catch (e) { console.error(e); toast(e.message, 'error'); }
}

function openLoomModal(id = 0) {
  const promises = [api('looms'), api('products'), api('customers'), api('orders')];
  if (id > 0) {
    promises.push(api('loom_daily_entries', { loom_id: id }));
    promises.push(api('quality_controls', { loom_id: id, limit: 100 }));
  }

  Promise.all(promises).then(([loomRes, prodRes, custRes, orderRes, entriesRes, qcRes]) => {
    const looms = loomRes.data || [];
    const loom = looms.find(x => x.id === id);
    const products = prodRes.data || [];
    const customersList = custRes.data || [];
    const ordersList = orderRes.data || [];
    const entries = (entriesRes && entriesRes.data) ? entriesRes.data : [];
    const qcEntries = (qcRes && qcRes.data) ? qcRes.data : [];

    // Geçmiş verilerini birleştir
    let combinedHistory = [];

    // Günlük Sayaç girişleri
    entries.forEach(e => {
      combinedHistory.push({
        type: 'daily',
        date: new Date(e.date.replace(' ', 'T')).getTime() || 0,
        dateStr: e.date,
        title: 'Sayaç Girişi',
        desc: e.notes || '-',
        val1: fmt(e.meters) + ' mt',
        val2: parseFloat(e.efficiency || 0) > 0 ? `%${parseFloat(e.efficiency || 0).toFixed(1)}` : '-',
        eff: parseFloat(e.efficiency || 0),
        id: e.id
      });
    });

    // Kalite Kontrol girişleri
    qcEntries.forEach(q => {
      combinedHistory.push({
        type: 'qc',
        date: new Date(q.created_at.replace(' ', 'T')).getTime() || 0,
        dateStr: q.created_at,
        title: 'Kalite Kontrol (' + q.roll_no + ')',
        desc: q.decision + ' / ' + (q.notes || '-'),
        val1: fmt(q.length_m) + ' mt',
        val2: q.quality_score + ' Puan',
        id: q.id
      });
    });

    // İşbağ Çizgisi
    if (loom && loom.warp_start_date) {
      combinedHistory.push({
        type: 'warp_start',
        date: new Date(loom.warp_start_date).getTime() || 0,
        dateStr: loom.warp_start_date,
        title: 'YENİ ÇÖZGÜ (İŞBAĞ)',
        desc: loom.warp_total + ' mt toplam çözgü',
        val1: '-',
        val2: '-'
      });
    }

    // Tarihe göre yeninden eskiye sırala
    combinedHistory.sort((a, b) => b.date - a.date);

    // Son 7 günlük randıman verisi hazırla
    let statsHtml = '';
    if (id > 0) {
      const last7 = entries.slice(0, 7).reverse();
      const effs = last7.map(e => parseFloat(e.efficiency || 0));
      const meters = last7.map(e => parseFloat(e.meters || 0));
      const avgEff = effs.length > 0 ? (effs.reduce((a, b) => a + b, 0) / effs.length) : 0;
      const totalMeters = meters.reduce((a, b) => a + b, 0);
      const bestDay = effs.length > 0 ? Math.max(...effs) : 0;
      const worstDay = effs.length > 0 ? Math.min(...effs) : 0;
      const bestIdx = effs.indexOf(bestDay);
      const worstIdx = effs.indexOf(worstDay);

      // Trend: son 3 gün vs önceki 3 gün
      let trendArrow = '—', trendColor = 'var(--text3)', trendText = '';
      if (effs.length >= 6) {
        const recent3 = effs.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const prev3 = effs.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        if (recent3 > prev3 + 3) { trendArrow = '▲'; trendColor = 'var(--accent)'; trendText = 'Yükselişte'; }
        else if (recent3 < prev3 - 3) { trendArrow = '▼'; trendColor = 'var(--danger)'; trendText = 'Düşüşte'; }
        else { trendArrow = '▶'; trendColor = 'var(--warning)'; trendText = 'Sabit'; }
      }

      const avgColor = avgEff >= 85 ? 'var(--accent)' : (avgEff >= 70 ? 'var(--warning)' : 'var(--danger)');

      let tableRows = last7.map((e, i) => {
        const eff = parseFloat(e.efficiency || 0);
        const m = parseFloat(e.meters || 0);
        const clr = eff >= 85 ? 'var(--accent)' : (eff >= 70 ? 'var(--warning)' : 'var(--danger)');
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:8px 12px;font-size:11px;color:var(--text2);font-weight:600">' + (e.date.split(' ')[0] || '—') + '</td>'
          + '<td style="padding:8px 12px;font-weight:700;color:var(--accent);font-size:12px">' + m.toFixed(1) + ' mt</td>'
          + '<td style="padding:8px 12px;font-weight:700;color:' + clr + ';font-size:12px">% ' + eff.toFixed(1) + '</td>'
          + '<td style="padding:8px 12px">'
          + '<div style="background:var(--surface3);border-radius:4px;height:8px;width:80px;overflow:hidden">'
          + '<div style="background:' + clr + ';height:100%;width:' + Math.min(100, eff) + '%;border-radius:4px"></div>'
          + '</div>'
          + '</td>'
          + '</tr>';
      }).join('');

      statsHtml = `
        <div style="padding:4px 0">
          <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:12px">📊 PERFORMANÖZETİ</div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);text-align:center">
              <div style="font-size:9px;color:var(--text3);margin-bottom:4px">ORTALAMA VERİM</div>
              <div style="font-size:22px;font-weight:800;color:${avgColor}">%${avgEff.toFixed(1)}</div>
            </div>
            <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);text-align:center">
              <div style="font-size:9px;color:var(--text3);margin-bottom:4px">TOPLAM ÜRETİM</div>
              <div style="font-size:22px;font-weight:800;color:var(--accent)">${totalMeters.toFixed(1)}</div>
              <div style="font-size:9px;color:var(--text3)">metre</div>
            </div>
            <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);text-align:center">
              <div style="font-size:9px;color:var(--text3);margin-bottom:4px">EN YÜKSEK</div>
              <div style="font-size:22px;font-weight:800;color:var(--accent)">%</div>
              <div style="font-size:14px;font-weight:600;color:var(--text)">${bestDay.toFixed(1)}${bestIdx >= 0 ? '<br><span style="font-size:8px;color:var(--text3)">' + (last7[bestIdx]?.date?.split(' ')[0] || '') + '</span>' : ''}</div>
            </div>
            <div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);text-align:center">
              <div style="font-size:9px;color:var(--text3);margin-bottom:4px">TREND</div>
              <div style="font-size:22px;font-weight:800;color:${trendColor}">${trendArrow}</div>
              <div style="font-size:10px;font-weight:600;color:${trendColor}">${trendText}</div>
            </div>
          </div>
          
          <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr style="background:var(--surface2)">
                  <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Tarih</th>
                  <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Üretim</th>
                  <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Verim</th>
                  <th style="padding:8px 12px;text-align:left;font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase">Grafik</th>
                </tr>
              </thead>
              <tbody>${tableRows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3)">Veri yok</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    openModal(id ? 'Tezgah Detay — ' + loom.name : 'Yeni Tezgah Ekle', `
      <form onsubmit="saveLoom(event, ${id})" id="loomForm">
        <div class="tab-bar">
          <button type="button" class="tab-btn active" onclick="switchLoomTab('basic')">🏠 Temel</button>
          <button type="button" class="tab-btn" onclick="switchLoomTab('technical')">⚙️ Teknik</button>
          <button type="button" class="tab-btn" onclick="switchLoomTab('planning')">📅 Planlama</button>
          ${id > 0 ? `
            <button type="button" class="tab-btn" onclick="switchLoomTab('stats')">📊 İstatistik</button>
            <button type="button" class="tab-btn" onclick="switchLoomTab('history')">📋 Geçmiş</button>
          ` : ''}
        </div>

        <div id="loomTab-basic" class="tab-content active">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="padding:14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
              <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:10px;text-transform:uppercase">🏷️ Kimlik</div>
              <div class="form-floating" style="margin-bottom:0">
                <input type="text" id="loomName" required placeholder=" " value="${loom ? loom.name : ''}">
                <label>Tezgah No / Adı *</label>
              </div>
              <div class="form-floating" style="margin-top:10px;margin-bottom:0">
                <select id="loomStatus" style="width:100%">
                  <option value="çalışıyor" ${loom?.status === 'çalışıyor' ? 'selected' : ''}>🟢 Çalışıyor</option>
                  <option value="durdu" ${loom?.status === 'durdu' ? 'selected' : ''}>🔴 Durdu</option>
                  <option value="bekliyor" ${loom?.status === 'bekliyor' ? 'selected' : ''}>🟡 Bekliyor</option>
                  <option value="arıza" ${loom?.status === 'arıza' ? 'selected' : ''}>🟠 Arıza</option>
                </select>
                <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Durum</label>
              </div>
              <div class="form-floating" style="margin-top:10px;margin-bottom:0">
                <select id="loomLocation" style="width:100%">
                  <option value="Fabrika" ${loom?.location === 'Fabrika' ? 'selected' : ''}>Fabrika</option>
                  <option value="Fason" ${loom?.location === 'Fason' ? 'selected' : ''}>Fason</option>
                </select>
                <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Konum</label>
              </div>
            </div>

            <div style="padding:14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
              <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:10px;text-transform:uppercase">⚡ Üretim Ayarları</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-floating" style="margin-bottom:0">
                  <input type="number" id="loomRpm" required placeholder=" " value="${loom ? loom.rpm : 500}">
                  <label>RPM *</label>
                </div>
                <div class="form-floating" style="margin-bottom:0">
                  <input type="number" id="loomWorkHours" step="0.5" placeholder=" " value="${loom ? loom.work_hours : 24}">
                  <label>Saat/Gün</label>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
                <div class="form-floating" style="margin-bottom:0">
                  <input type="number" id="loomWarpTotal" step="0.1" placeholder=" " value="${loom ? loom.warp_total : 0}">
                  <label>Çözgü (mt)</label>
                </div>
                <div class="form-floating" style="margin-bottom:0">
                  <input type="text" id="loomLotNo" placeholder=" " value="${loom ? (loom.lot_no || '') : ''}">
                  <label>LOT No</label>
                </div>
              </div>
              <div class="form-floating" style="margin-top:10px;margin-bottom:0">
                <input type="number" id="loomWarpStartMeter" step="0.1" placeholder=" " value="${loom ? loom.warp_start_meter : 0}">
                <label>Çözgü Başlangıç (mt)</label>
              </div>
            </div>
          </div>

          ${loom ? `
          <div style="margin-top:16px;padding:14px;background:linear-gradient(135deg,var(--surface2),var(--surface3));border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Mevcut Sayaç</div>
              <div style="font-size:28px;font-weight:800;color:var(--accent);font-family:var(--mono)">${loom.current_meters} <span style="font-size:14px;font-weight:400;color:var(--text3)">mt</span></div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-secondary btn-sm" onclick="openMeterModal(${loom.id})">📏 Sayaç Güncelle</button>
              <button type="button" class="btn btn-warning btn-sm" onclick="resetLoomSingle(${loom.id}, 'warp')">🔗 İşbağ</button>
            </div>
          </div>
          ` : ''}
        </div>

        <div id="loomTab-technical" class="tab-content" style="display:none">
          <div style="padding:14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);margin-bottom:14px">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:10px;text-transform:uppercase">🧶 Ürün & Müşteri</div>
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
              <div class="form-floating" style="margin-bottom:0">
                <select id="loomProduct" style="width:100%">
                  <option value="">Ürün Seçin...</option>
                  ${products.map(p => `<option value="${p.id}" ${loom?.product_id == p.id ? 'selected' : ''}>${p.code} — ${p.name}</option>`).join('')}
                </select>
                <label style="${loom?.product_id ? 'top:8px;transform:none;font-size:10px;color:var(--accent)' : 'top:8px;transform:none;font-size:10px;color:var(--text3)'}">Çalışan Kumaş / Kalite</label>
              </div>
              <div class="form-floating" style="margin-bottom:0">
                <select id="loomCustomer" style="width:100%">
                  <option value="">Müşteri Seçin...</option>
                  ${customersList.map(c => `<option value="${c.id}" ${loom?.customer_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
                <label style="${loom?.customer_id ? 'top:8px;transform:none;font-size:10px;color:var(--accent)' : 'top:8px;transform:none;font-size:10px;color:var(--text3)'}">Müşteri</label>
              </div>
            </div>
          </div>

          <div style="padding:14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);margin-bottom:14px">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:10px;text-transform:uppercase">⚙️ Tezgah Özellikleri</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              <div class="form-floating" style="margin-bottom:0">
                <input type="text" id="loomType" placeholder=" " value="${loom ? (loom.type || '') : 'OPT'}">
                <label>Tezgah Tipi</label>
              </div>
              <div class="form-floating" style="margin-bottom:0">
                <input type="number" id="loomFrames" placeholder=" " value="${loom ? loom.frames : 0}">
                <label>Çerçeve Sayısı</label>
              </div>
              <div class="form-floating" style="margin-bottom:0">
                <input type="number" id="loomWidth" step="0.1" placeholder=" " value="${loom ? loom.width : 0}">
                <label>Kumaş Eni (cm)</label>
              </div>
            </div>
          </div>

          <div style="padding:14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:10px;text-transform:uppercase">🔄 Yedek Çözgü</div>
            <div class="form-floating" style="margin-bottom:0">
              <select id="loomWarpSpareStatus" style="width:100%">
                <option value="">Yok / Hazırlanmadı</option>
                <option value="Hazırlanıyor" ${loom?.warp_spare_status === 'Hazırlanıyor' ? 'selected' : ''}>Hazırlanıyor</option>
                <option value="Hazır" ${loom?.warp_spare_status === 'Hazır' ? 'selected' : ''}>Hazır (Makine Yanında)</option>
              </select>
              <label style="top:8px;transform:none;font-size:10px;color:var(--text3)">Yedek Çözgü Durumu</label>
            </div>
          </div>
        </div>

        <div id="loomTab-planning" class="tab-content" style="display:none">
          <div style="padding:14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:12px;text-transform:uppercase">📅 SIRADAKİ İŞ / PLANLAMA</div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px">
              <div class="form-group">
                <label style="font-size:10px; color:var(--text3); display:block; margin-bottom:4px">Sıradaki Kumaş</label>
                <select id="loomNextProduct" style="width:100%; padding:8px; background:var(--surface3); color:var(--text); border:1px solid var(--border); border-radius:6px">
                  <option value="">-- Kumaş Seçin --</option>
                  ${products.map(p => `<option value="${p.id}" ${loom?.next_product_id == p.id ? 'selected' : ''}>[${p.code}] ${p.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:10px; color:var(--text3); display:block; margin-bottom:4px">Sıradaki Müşteri</label>
                <select id="loomNextCustomer" style="width:100%; padding:8px; background:var(--surface3); color:var(--text); border:1px solid var(--border); border-radius:6px">
                  <option value="">-- Müşteri Seçin --</option>
                  ${customersList.map(c => `<option value="${c.id}" ${loom?.next_customer_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px">
              <div class="form-group">
                <label style="font-size:10px; color:var(--text3); display:block; margin-bottom:4px">Sıradaki Sipariş</label>
                <select id="loomNextOrder" style="width:100%; padding:8px; background:var(--surface3); color:var(--text); border:1px solid var(--border); border-radius:6px">
                  <option value="">-- Sipariş Seçin --</option>
                  ${ordersList.map(o => `<option value="${o.id}" ${loom?.next_order_id == o.id ? 'selected' : ''}>${o.order_no} (${o.product_name})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:10px; color:var(--text3); display:block; margin-bottom:4px">Sıradaki LOT No</label>
                <input type="text" id="loomNextLot" style="width:100%; padding:8px; background:var(--surface3); color:var(--text); border:1px solid var(--border); border-radius:6px" placeholder="LOT No giriniz..." value="${loom?.next_lot_no || ''}">
              </div>
            </div>

            <div class="form-group">
              <label style="font-size:10px; color:var(--text3); display:block; margin-bottom:4px">Planlama Notları</label>
              <textarea id="loomNextNotes" style="width:100%;height:60px;padding:10px;background:var(--surface3);color:var(--text);border:1px solid var(--border);border-radius:6px;resize:none" placeholder="Planlama notları...">${loom?.next_job_notes || ''}</textarea>
            </div>
            
            <div style="margin-top:12px;padding:10px;background:rgba(0, 212, 170, 0.05);border-radius:6px;border:1px dashed var(--accent);font-size:10px;color:var(--text2);line-height:1.4">
              💡 Bu bilgiler Kalite Kontrol ekranında operatöre rehberlik eder. İş değişimi yapıldığında bu veriler otomatik olarak aktif hale gelir.
            </div>
          </div>
        </div>

        ${id > 0 ? `
        <div id="loomTab-stats" class="tab-content" style="display:none">
          ${statsHtml}
        </div>
        <div id="loomTab-history" class="tab-content" style="display:none">
          <div style="max-height: 400px; overflow-y: auto; border-radius:8px; border:1px solid var(--border)">
            <table class="toplu-table">
              <thead><tr><th>Tarih</th><th>İşlem / Tür</th><th>Değer</th><th>Ek/Rand.</th><th>Detay</th><th></th></tr></thead>
              <tbody>
                ${combinedHistory.length ? combinedHistory.map(item => {
      if (item.type === 'warp_start') {
        return `
                      <tr style="background:rgba(0, 212, 170, 0.1); border-top:2px solid var(--accent)">
                        <td style="font-size:10px; color:var(--accent); font-weight:700">${item.dateStr.split(' ')[0]}</td>
                        <td style="font-weight:800; color:var(--accent)" colspan="2">🚀 ${item.title}</td>
                        <td style="font-weight:700; color:var(--text)" colspan="3">${item.desc}</td>
                      </tr>
                    `;
      }
      if (item.type === 'qc') {
        return `
                      <tr style="background:var(--surface2)">
                        <td style="font-size:10px">${item.dateStr}</td>
                        <td style="font-weight:700; color:var(--text2)">🏷️ ${item.title}</td>
                        <td style="font-weight:700; color:var(--warning)">${item.val1}</td>
                        <td style="font-weight:700; color:var(--text)">${item.val2}</td>
                        <td style="font-size:11px; color:var(--text3)">${item.desc}</td>
                        <td></td>
                      </tr>
                    `;
      }
      // daily entry
      return `
                    <tr>
                      <td style="font-size:10px">${item.dateStr}</td>
                      <td style="font-weight:700; color:var(--text)">📟 ${item.title}</td>
                      <td style="font-weight:700; color:var(--accent2)">${item.val1}</td>
                      <td style="font-weight:700; color:${item.eff >= 85 ? 'var(--accent)' : 'var(--warning)'}">${item.val2}</td>
                      <td style="font-size:11px; color:var(--text3)">${item.desc}</td>
                      <td><button type="button" class="btn btn-icon btn-danger" style="width:24px; height:24px" onclick="deleteLoomEntry(${item.id}, ${id})">🗑</button></td>
                    </tr>
                  `;
    }).join('') : '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text3)">Geçmiş kayıt bulunamadı</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}

        <div class="form-actions">
          ${id > 0 ? `<button type="button" class="btn btn-danger" style="margin-right:auto" onclick="deleteLoom(${id})">📦 Tezgâhı Arşivle</button>` : ''}
          <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
          <button type="button" id="btnSaveLoom" class="btn btn-primary" onclick="document.getElementById('loomForm').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}))">✓ Kaydet</button>
        </div>
      </form>
    `, '900px');
  });
}


function switchLoomTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('loomTab-' + tab).style.display = 'block';
  if (event) event.currentTarget.classList.add('active');
}



async function saveLoomMeter(e, id) {
  e.preventDefault();
  try {
    const val = parseFloat(document.getElementById('newMeterValue').value);
    const res = await api('looms');
    const loom = res.data.find(x => x.id === id);

    await api('looms', {
      ...loom,
      current_meters: val
    }, 'POST');

    // Tarihçe için kaydet
    const dateInput = document.getElementById('meterEntryDate').value.replace('T', ' ');

    await api('loom_daily_entries', {
      loom_id: id,
      date: dateInput,
      meters: val - (loom.yesterday_meters || 0),
      notes: 'Sayaç: ' + val + ' mt'
    }, 'POST');

    closeModal();
    toast('Sayaç güncellendi');
    loadLooms();
  } catch (e) { toast(e.message, 'error'); }
}

async function resetAllLooms() {
  openModal('Sistem Geneli Sıfırlama', `
    <div style="text-align:center; padding:10px 0">
      <div style="font-size:40px; margin-bottom:12px">🔄</div>
      <div style="font-size:15px; font-weight:700; color:var(--text); margin-bottom:8px">Hangi işlemi yapmak istiyorsunuz?</div>
      
      <div style="display:grid; grid-template-columns:1fr; gap:12px; margin-top:20px">
        <div onclick="executeResetLooms('day')" style="background:var(--surface2); border:1px solid var(--border); padding:16px; border-radius:12px; cursor:pointer; text-align:left; transition:all 0.2s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-weight:700; color:var(--accent)">🌅 Gün Sonu Sıfırlama</div>
          <div style="font-size:11px; color:var(--text3); margin-top:4px">Bütün tezgahların günlük üretimini sıfırlar, yeni güne başlar. (Çözgü/İşbağ bozulmaz)</div>
        </div>
        
        <div onclick="executeResetLooms('warp')" style="background:var(--surface2); border:1px solid var(--border); padding:16px; border-radius:12px; cursor:pointer; text-align:left; transition:all 0.2s" onmouseover="this.style.borderColor='var(--danger)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-weight:700; color:var(--danger)">🚜 Tüm Tezgahlarda Yeni Çözgü (İşbağ)</div>
          <div style="font-size:11px; color:var(--text3); margin-top:4px">TÜM tezgahları tamamen sıfırlar. Her şey baştan başlar. (Dikkatli kullanın!)</div>
        </div>
      </div>
      
      <button class="btn btn-secondary" onclick="closeModal()" style="margin-top:20px; width:100%">Vazgeç</button>
    </div>
  `);
}

async function resetLoomSingle(id, type) {
  const label = type === 'warp' ? 'İŞBAĞ / YENİ ÇÖZGÜ' : 'GÜN SONU';
  const desc = type === 'warp' ? 'Bu tezgah tamamen sıfırlanacak ve yeni çözgü başlayacaktır.' : 'Tezgahın günlük üretimi sıfırlanacaktır.';

  openModal(label, `
    <div style="text-align:center; padding:10px 0">
      <div style="font-size:40px; margin-bottom:12px">${type === 'warp' ? '🔗' : '🌅'}</div>
      <div style="font-size:15px; font-weight:700; color:var(--text)">${label} Onayı</div>
      <div style="font-size:12px; color:var(--text3); margin-top:8px">${desc} Emin misiniz?</div>
      <div style="display:flex; gap:12px; justify-content:center; margin-top:24px">
        <button class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button class="btn ${type === 'warp' ? 'btn-warning' : 'btn-primary'}" onclick="executeResetSingleLoom(${id}, '${type}')">Evet, Sıfırla</button>
      </div>
    </div>
  `);
}

async function executeResetSingleLoom(id, type) {
  closeModal();
  try {
    await api('loom_reset', { id, type }, 'POST');
    toast('Tezgah sıfırlandı');
    loadLooms();
  } catch (e) { toast(e.message, 'error'); }
}

async function executeResetLooms(type) {
  closeModal();
  try {
    await api('loom_reset', { type }, 'POST');
    toast('İşlem başarıyla tamamlandı');
    loadLooms();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteLoom(id) {
  openModal('Tezgah Silme / Arşivleme', `
    <div style="text-align:center; padding:10px 0">
      <div style="font-size:48px; margin-bottom:12px">⚠️</div>
      <div style="font-size:15px; font-weight:700; color:var(--text)">Tezgahı Arşivle</div>
      <div style="font-size:12px; color:var(--text3); margin-top:8px">Bu tezgahı pasife çekmek istediğinize emin misiniz? Geçmiş veriler korunacak ancak aktif listeden kaldırılacaktır.</div>
      <div style="display:flex; gap:12px; justify-content:center; margin-top:24px">
        <button class="btn btn-secondary" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-danger" onclick="executeDeleteLoom(${id})">Evet, Arşivle</button>
      </div>
    </div>
  `, '400px');
}

async function executeDeleteLoom(id) {
  try {
    await api('loom_delete', { id }, 'POST');
    toast('Tezgah arşivlendi (pasife alındı)');
    closeModal();
    loadLooms();
  } catch (err) { toast(err.message, 'error'); }
}

async function openArchivedLoomsModal() {
  try {
    const res = await api('looms', { archived: 1 });
    const archived = res.data || [];

    if (archived.length === 0) {
      toast('Arşivlenmiş (pasif) tezgah bulunamadı', 'info');
      return;
    }

    const rows = archived.map(l => `
      <tr>
        <td style="font-weight:700; color:var(--text)">${l.name}</td>
        <td style="color:var(--text2)">${l.product_code || '—'}</td>
        <td style="color:var(--text3); font-size:11px">${fmtDate(l.updated_at)}</td>
        <td style="text-align:right">
          <button class="btn btn-sm btn-primary" onclick="restoreLoom(${l.id})">🔄 Geri Yükle</button>
        </td>
      </tr>
    `).join('');

    openModal('Arşivlenmiş (Pasif) Tezgahlar', `
      <div style="max-height: 400px; overflow-y: auto">
        <table class="toplu-table">
          <thead>
            <tr>
              <th>Tezgah Adı</th>
              <th>Son Çalışan Ürün</th>
              <th>Arşiv Tarihi</th>
              <th style="text-align:right">İşlem</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Kapat</button>
      </div>
    `, '600px');
  } catch (err) { toast(err.message, 'error'); }
}

async function restoreLoom(id) {
  try {
    await api('loom_restore', { id }, 'POST');
    toast('Tezgah başarıyla geri yüklendi');
    closeModal();
    loadLooms();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteLoomEntry(entryId, loomId) {
  if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
  try {
    await api('loom_daily_entries', { id: entryId }, 'DELETE');
    toast('Kayıt silindi');
    openLoomModal(loomId);
    setTimeout(() => switchLoomTab('history'), 200);
  } catch (err) { toast(err.message, 'error'); }
}

async function saveLoom(e, id) {
  e.preventDefault();
  try {
    let oldData = {};
    if (id) {
      const res = await api('looms');
      oldData = res.data.find(x => x.id === id) || {};
    }

    const data = {
      ...oldData,
      id: id || '',
      name: document.getElementById('loomName').value,
      status: document.getElementById('loomStatus').value,
      product_id: document.getElementById('loomProduct')?.value || null,
      customer_id: document.getElementById('loomCustomer')?.value || null,
      order_id: document.getElementById('loomOrder')?.value || null,
      lot_no: document.getElementById('loomLotNo')?.value || '',
      rpm: document.getElementById('loomRpm').value,
      work_hours: document.getElementById('loomWorkHours').value,
      warp_total: document.getElementById('loomWarpTotal').value,
      warp_start_meter: document.getElementById('loomWarpStartMeter').value,
      type: document.getElementById('loomType')?.value || oldData.type || '',
      frames: document.getElementById('loomFrames')?.value || oldData.frames || 0,
      width: document.getElementById('loomWidth')?.value || oldData.width || 0,
      location: document.getElementById('loomLocation')?.value || oldData.location || 'Fabrika',
      warp_spare_status: document.getElementById('loomWarpSpareStatus')?.value || oldData.warp_spare_status || '',
      next_product_id: document.getElementById('loomNextProduct')?.value || null,
      next_customer_id: document.getElementById('loomNextCustomer')?.value || null,
      next_order_id: document.getElementById('loomNextOrder')?.value || null,
      next_lot_no: document.getElementById('loomNextLot')?.value || '',
      next_job_notes: document.getElementById('loomNextNotes')?.value || ''
    };

    await api('looms', data, 'POST');
    closeModal();
    toast(id ? 'Tezgah güncellendi' : 'Tezgah eklendi');
    loadLooms();
  } catch (e) { toast(e.message, 'error'); }
}

function openLoomOrderModal(loomId) {
  Promise.all([api('looms'), api('orders')]).then(([lRes, oRes]) => {
    const loom = (lRes.data || []).find(x => x.id === loomId);
    if (!loom) { toast('Tezgah bulunamadı', 'error'); return; }
    const openOrders = (oRes.data || []).filter(o => o.status !== 'Tamamlandı' && o.status !== 'İptal');

    const ordersHtml = openOrders.length === 0
      ? '<div style="padding:20px;text-align:center;color:var(--text3)">Açık sipariş bulunmuyor.</div>'
      : openOrders.map(o => {
        const ordered = parseFloat(o.quantity_m || 0);
        const shipped = parseFloat(o.shipped_m || 0);
        const remaining = Math.max(0, ordered - shipped);
        const pct = ordered > 0 ? Math.min(100, (shipped / ordered) * 100) : 0;
        const isMatch = o.id == loom.order_id;
        const safeName = o.order_no.replace(/'/g, "\\'");
        const bc = isMatch ? 'var(--accent)' : 'var(--border)';
        const bg = isMatch ? 'rgba(0,212,170,.06)' : 'var(--surface2)';
        return '<div onclick="assignOrderToLoom(' + loomId + ',' + o.id + ",\'" + safeName + '\')" '
          + 'style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:6px;border-radius:8px;border:1px solid ' + bc
          + ';background:' + bg + ';cursor:pointer;transition:all .15s" '
          + 'onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'' + bc + '\'">'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-weight:700;color:var(--text);font-size:13px">' + o.order_no + '</div>'
          + '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + (o.customer_name || '') + ' — ' + (o.product_code || '') + ' ' + (o.product_name || '') + '</div>'
          + '</div>'
          + '<div style="text-align:right;flex-shrink:0">'
          + '<div style="font-size:11px;color:var(--text3)">Kalan</div>'
          + '<div style="font-weight:700;color:var(--danger);font-size:14px">' + remaining.toFixed(0) + ' mt</div>'
          + '<div style="font-size:9px;color:var(--text3)">Sevk: ' + shipped.toFixed(0) + ' mt (%' + pct.toFixed(0) + ')</div>'
          + '</div></div>';
      }).join('');

    const removeHtml = loom.order_no
      ? '<div style="margin-top:16px"><button class="btn btn-danger" onclick="removeOrderFromLoom(' + loomId + ')" style="width:100%">🗑 Siparişi Kaldır</button></div>'
      : '';

    const titleHtml = '📋 Tezgah Sipariş Ata — ' + loom.name;

    openModal(titleHtml,
      '<div style="padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);margin-bottom:16px">'
      + '<div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:6px">TEZGAH BİLGİSİ</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">'
      + '<div><span style="color:var(--text3)">Müşteri:</span> <strong style="color:var(--text)">' + (loom.customer_name || '—') + '</strong></div>'
      + '<div><span style="color:var(--text3)">Kalite:</span> <strong style="color:var(--text)">' + (loom.product_code || '') + ' ' + (loom.product_name || '') + '</strong></div>'
      + '<div><span style="color:var(--text3)">Mevcut Sipariş:</span> <strong style="color:var(--accent)">' + (loom.order_no || 'Yok') + '</strong></div>'
      + '</div></div>'
      + '<div style="margin-bottom:12px;font-size:12px;font-weight:600;color:var(--text2)">UYGUN SİPARİŞLER</div>'
      + '<div style="max-height:300px;overflow-y:auto">' + ordersHtml + '</div>'
      + removeHtml
      , '500px');
  }).catch(e => toast(e.message, 'error'));
}

function assignOrderToLoom(loomId, orderId, orderNo) {
  api('loom_order', { id: loomId, order_id: orderId }, 'POST').then(() => {
    toast(`"${orderNo}" siparişi tezgaha atandı`);
    closeModal();
    loadLooms();
  }).catch(e => toast(e.message, 'error'));
}

function removeOrderFromLoom(loomId) {
  Promise.all([api('looms'), api('products'), api('customers')]).then(([lRes, pRes, cRes]) => {
    const loom = (lRes.data || []).find(x => x.id === loomId);
    if (!loom) { toast('Tezgah bulunamadı', 'error'); return; }
    const products = pRes.data || [];
    const customers = cRes.data || [];
    openModal('🔄 Çalışan Kalite Seçiniz',
      '<div style="margin-bottom:12px;font-size:12px;color:var(--text3)">Sipariş kaldırıldı. Yeni kalite ve müşteri seçiniz:</div>'
      + '<div style="margin-bottom:8px;font-size:10px;color:var(--text3)">Mevcut: <strong>' + (loom.customer_name || '—') + '</strong> — <strong>' + (loom.product_code || '') + ' ' + (loom.product_name || '') + '</strong></div>'
      + '<div class="form-floating" style="margin-bottom:12px">'
      + '<select id="removeOrderProduct" style="width:100%"><option value="">— Mevcut Kaliteyi Koru —</option>'
      + products.map(p => '<option value="' + p.id + '"' + (p.id == loom.product_id ? ' selected' : '') + '>' + (p.code || '') + ' ' + p.name + '</option>').join('')
      + '</select><label>Kalite</label></div>'
      + '<div class="form-floating" style="margin-bottom:16px">'
      + '<select id="removeOrderCustomer" style="width:100%"><option value="">— Mevcut Müşteriyi Koru —</option>'
      + customers.map(c => '<option value="' + c.id + '"' + (c.id == loom.customer_id ? ' selected' : '') + '>' + c.name + '</option>').join('')
      + '</select><label>Müşteri</label></div>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="btn btn-secondary" style="flex:1" onclick="closeModal()">İptal</button>'
      + '<button class="btn btn-primary" style="flex:1" onclick="confirmRemoveOrder(' + loomId + ', ' + (loom.product_id || 0) + ', ' + (loom.customer_id || 0) + ')">✓ Kaydet</button>'
      + '</div>'
      , '420px');
  }).catch(e => toast(e.message, 'error'));
}

function confirmRemoveOrder(loomId, defaultProductId, defaultCustomerId) {
  const productVal = document.getElementById('removeOrderProduct').value;
  const customerVal = document.getElementById('removeOrderCustomer').value;
  const productId = productVal ? parseInt(productVal) : defaultProductId;
  const customerId = customerVal ? parseInt(customerVal) : defaultCustomerId;
  api('loom_order', { id: loomId, order_id: '', product_id: productId, customer_id: customerId }, 'POST').then(() => {
    toast('Sipariş bağlantısı kaldırıldı');
    closeModal();
    loadLooms();
  }).catch(e => toast(e.message, 'error'));
}

function openMeterModal(id) {
  api('looms').then(res => {
    const l = res.data.find(x => x.id === id);
    openModal('Sayaç Girişi — ' + l.name, `
      <div style="text-align:center; margin-bottom:20px">
        <div style="font-size:11px; color:var(--text3)">SON KAYITLI SAYAÇ</div>
        <div style="font-size:24px; font-weight:800; color:var(--accent)">${l.current_meters} mt</div>
      </div>
      <form onsubmit="saveLoomMeter(event, ${id})">
        <div class="form-floating">
          <input type="number" id="newMeterValue" step="0.1" required autofocus placeholder=" " value="${l.current_meters}">
          <label>Yeni Sayaç Bilgisini Girin *</label>
        </div>
        <div class="form-floating">
          <input type="datetime-local" id="meterEntryDate" required value="${new Date().toISOString().substring(0, 16)}">
          <label>Kayıt Tarihi</label>
        </div>
        <div style="font-size:11px; color:var(--text3); margin-top:-8px; margin-bottom:16px">Not: Bu değerden düne ait metre çıkarılarak günlük üretim hesaplanacaktır.</div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
          <button type="submit" class="btn btn-primary">✓ Güncelle</button>
        </div>
      </form>
    `);
  });
}


// ═══════════════════════════════
//  BULK ENTRY / TOPLU GİRİŞ
// ═══════════════════════════════
async function loadLoomBulkEntry() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div class="filter-bar">
      <button class="btn btn-secondary btn-sm" onclick="loadLooms()">⬅ Kart Görünümüne Dön</button>
      <div style="font-size:13px;color:var(--text3);font-weight:500;margin-left:10px">Hızlı Sayaç & Kalite Girişi Mode</div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <label style="font-size:11px; color:var(--text3)">Giriş Tarihi:</label>
        <input type="datetime-local" id="bulkEntryDate" style="height:32px; font-size:12px" value="${new Date().toISOString().substring(0, 16)}">
        <button class="btn btn-primary" onclick="saveAllLoomMeters()">💾 TÜMÜNÜ KAYDET</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table id="bulkLoomTable">
          <thead>
            <tr>
              <th style="width:100px">Tezgah</th>
              <th style="width:180px">Çalışan Kalite</th>
              <th style="width:120px">LOT NO</th>
              <th style="width:160px">Müşteri</th>
               <th style="width:100px">Önceki</th>
               <th style="width:120px">Yeni Sayaç</th>
               <th style="width:100px">Saat</th>
               <th style="width:110px">Fark (mt)</th>
               <th style="width:110px">Randıman</th>
               <th style="width:110px">Kalan</th>
             </tr>
           </thead>
          <tbody id="bulkLoomBody">
            <tr><td colspan="9" style="text-align:center;padding:40px"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div style="margin-top:20px; display:flex; justify-content:center">
       <button class="btn btn-primary btn-lg" style="padding:16px 40px; font-size:16px; border-radius:12px; box-shadow:0 10px 30px rgba(0,212,170,0.3)" onclick="saveAllLoomMeters()">💾 TÜMÜNÜ SİSTEME İŞLE</button>
    </div>
  `;

  try {
    const [lRes, pRes, cRes] = await Promise.all([api('looms'), api('products'), api('customers')]);
    const looms = lRes.data || [];
    const products = pRes.data || [];
    const customers = cRes.data || [];
    const tbody = document.getElementById('bulkLoomBody');

    if (!looms.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text3)">Tezgah bulunamadı</td></tr>';
      return;
    }

    tbody.innerHTML = looms.map(l => {
      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, l.warp_total - consumed);

      // Randıman Önizleme
      let effLabel = '-';
      if (l.rpm > 0 && l.product_density > 0 && l.reset_at) {
        const resetTime = new Date(l.reset_at.replace(' ', 'T')).getTime();
        const minsPassed = Math.max(1, (Date.now() - resetTime) / 60000);
        const theoretical = (l.rpm * minsPassed) / (l.product_density * 100);
        const eff = theoretical > 0 ? Math.min(100, (l.daily_meters / theoretical) * 100) : 0;
        effLabel = `%${eff.toFixed(1)}`;
      }

      return `
        <tr data-id="${l.id}" 
            data-yesterday="${l.yesterday_meters}" 
            data-warp-total="${l.warp_total}" 
            data-warp-start="${l.warp_start_meter}"
            data-rpm="${l.rpm}"
            data-density="${l.product_density}"
            data-reset="${l.reset_at}"
            data-qc-consumed="${l.qc_consumed_meters || 0}">
          <td style="font-weight:700; color:var(--text)">${l.name}</td>
          <td>
            <select class="bulk-product" style="width:100%; border:none; background:transparent; color:var(--accent); font-weight:600; font-size:11px">
              <option value="">Seçilmedi</option>
              ${products.map(p => `<option value="${p.id}" ${l.product_id == p.id ? 'selected' : ''}>${p.code} - ${p.name.substring(0, 10)}...</option>`).join('')}
            </select>
          </td>
          <td>
            <input type="text" class="bulk-lot" value="${l.lot_no || ''}" 
                   style="width:100%; border:none; background:transparent; color:var(--warning); font-weight:700; font-size:11px"
                   placeholder="LOT Girin">
          </td>
          <td>
            <select class="bulk-customer" style="width:100%; border:none; background:transparent; color:var(--accent2); font-weight:600; font-size:11px">
              <option value="">Seçilmedi</option>
              ${customers.map(c => `<option value="${c.id}" ${l.customer_id == c.id ? 'selected' : ''}>${c.name.substring(0, 15)}</option>`).join('')}
            </select>
          </td>
          <td style="color:var(--text3); font-size:11px">${Number(l.current_meters).toLocaleString('tr-TR')}</td>
          <td>
            <input type="number" class="bulk-meter" step="0.1" value="${l.current_meters}" 
                   style="width:90px; height:28px; background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:0 6px; color:var(--accent); font-size:12px"
                   oninput="updateBulkRow(this)">
          </td>
          <td>
            <input type="number" class="bulk-hours" step="0.5" value="${l.work_hours || 24}" 
                   style="width:60px; height:28px; background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:0 6px; color:var(--text2); font-size:12px"
                   oninput="updateBulkRow(this)">
          </td>
          <td class="row-diff" style="font-weight:700; color:var(--accent); font-size:12px">${Number(l.daily_meters).toFixed(1)}</td>
          <td class="row-eff" style="font-weight:700; color:var(--accent2); font-size:12px">${effLabel}</td>
          <td class="row-remaining" style="font-weight:700; color:var(--warning); font-size:12px">${Number(remaining).toFixed(1)}</td>
        </tr>
      `;
    }).join('');

  } catch (e) { toast(e.message, 'error'); }
}

function updateBulkRow(input) {
  const tr = input.closest('tr');
  const d = tr.dataset;
  const val = parseFloat(input.value) || 0;

  // Fark (Üretim)
  const diff = val - parseFloat(d.yesterday);
  tr.querySelector('.row-diff').textContent = diff.toFixed(1) + ' mt';

  // Randıman Anlık
  const hours = parseFloat(tr.querySelector('.bulk-hours').value) || 24;
  if (parseFloat(d.rpm) > 0 && parseFloat(d.density) > 0) {
    const theoretical = (parseFloat(d.rpm) * hours * 60) / (parseFloat(d.density) * 100);
    const eff = theoretical > 0 ? Math.min(100, (diff / theoretical) * 100) : 0;
    tr.querySelector('.row-eff').textContent = `%${eff.toFixed(1)}`;
  }

  // Kalan Çözgü
  const warpDeduction = appSettings.warp_deduction || 'counter';
  let remaining = 0;
  if (warpDeduction === 'qc') {
    const consumed = parseFloat(d.qcConsumed || 0);
    remaining = Math.max(0, parseFloat(d.warpTotal) - consumed);
  } else {
    const consumed = Math.max(0, val - parseFloat(d.warpStart));
    remaining = Math.max(0, parseFloat(d.warpTotal) - consumed);
  }
  tr.querySelector('.row-remaining').textContent = remaining.toFixed(1) + ' mt';
}

async function saveAllLoomMeters() {
  const items = [];
  document.querySelectorAll('#bulkLoomBody tr').forEach(tr => {
    items.push({
      id: tr.dataset.id,
      product_id: tr.querySelector('.bulk-product').value,
      customer_id: tr.querySelector('.bulk-customer').value,
      lot_no: tr.querySelector('.bulk-lot').value,
      current_meters: tr.querySelector('.bulk-meter').value,
      hours: tr.querySelector('.bulk-hours').value
    });
  });

  try {
    toast('Kaydediliyor...', 'info');
    const date = document.getElementById('bulkEntryDate')?.value.replace('T', ' ');
    await api('looms_bulk_update', { items: JSON.stringify(items), date: date }, 'POST');
    toast('Tüm tezgahlar güncellendi');
    loadLooms();
  } catch (e) { toast(e.message, 'error'); }
}


// ═══════════════════════════════
//  CUSTOMERS (MÜŞTERİLER)
// ═══════════════════════════════


async function loadCustomers() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <div class="kpi-grid" id="customerKpiGrid">
      <div class="kpi-card teal">
        <div class="kpi-label">Toplam Cari</div>
        <div class="kpi-value" id="totalCustCount">0</div>
        <div class="kpi-sub">Kayıtlı Firma Sayısı</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-label">Toplam Borç (B)</div>
        <div class="kpi-value" id="totalDebitBal">0.00 ₺</div>
        <div class="kpi-sub" id="totalDebitExtra" style="display:flex; gap:10px; font-weight:700">
          <span style="color:#ffb347">0.00 $</span>
          <span style="color:#7c5cfc">0.00 €</span>
        </div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Toplam Alacak (A)</div>
        <div class="kpi-value" id="totalCreditBal">0.00 ₺</div>
        <div class="kpi-sub" id="totalCreditExtra" style="display:flex; gap:10px; font-weight:700">
          <span style="color:#ffb347">0.00 $</span>
          <span style="color:#7c5cfc">0.00 €</span>
        </div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">Borçlu Cari</div>
        <div class="kpi-value" id="debtorCustCount">0</div>
        <div class="kpi-sub">Bakiye Bekleyen Cariler</div>
      </div>
    </div>

    <div class="filter-bar">
      <input type="text" id="custSearchInput" placeholder="🔍 Cari ara..." oninput="filterCustomers()">
      <div style="margin-left:auto; display:flex; gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="printCustomerList('debtors')" style="background:#ff4d4f; color:white; border:none">🔴 Borçluları Yazdır</button>
        <button class="btn btn-secondary btn-sm" onclick="printCustomerList('creditors')" style="background:#25D366; color:white; border:none">🟢 Alacaklıları Yazdır</button>
        <button class="btn btn-primary btn-sm" onclick="openCustomerModal()">+ Yeni Cari Kartı</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;overflow-x:auto">
        <table>
          <thead><tr><th>Cari Adı</th><th>Telefon</th><th>Bakiye (TL)</th><th>Bakiye (USD)</th><th>Bakiye (EUR)</th><th>Notlar</th><th style="text-align:right">İşlem</th></tr></thead>
          <tbody id="custTableBody"><tr><td colspan="5"><div class="spinner"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  filterCustomers();
}

async function printCustomerList(type) {
  const res = await api('customers');
  let list = res.data || [];

  if (type === 'debtors') {
    list = list.filter(c => c.balance > 0 || c.balance_usd > 0 || c.balance_eur > 0);
  } else if (type === 'creditors') {
    list = list.filter(c => c.balance < 0 || c.balance_usd < 0 || c.balance_eur < 0);
  }

  if (!list.length) {
    toast('Yazdırılacak veri bulunamadı', 'info');
    return;
  }

  const title = type === 'debtors' ? 'BORÇLU CARİ LİSTESİ' : 'ALACAKLI CARİ LİSTESİ';
  const formatMoney = (val, curr = 'TRY') => {
    const sym = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : '₺';
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(Math.abs(val || 0)) + ' ' + sym;
  };

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; font-size: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f5f5f5; text-transform: uppercase; }
          .balance { font-weight: bold; }
          .footer { margin-top: 30px; font-size: 10px; text-align: right; color: #666; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p style="text-align:center; font-size:11px">Tarih: ${new Date().toLocaleString('tr-TR')}</p>
        <table>
          <thead>
            <tr>
              <th>Cari Adı</th>
              <th>Telefon</th>
              <th>Bakiye (TL)</th>
              <th>Bakiye (USD)</th>
              <th>Bakiye (EUR)</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td class="balance">${formatMoney(c.balance, 'TL')} ${c.balance > 0 ? '(B)' : c.balance < 0 ? '(A)' : ''}</td>
                <td class="balance">${formatMoney(c.balance_usd, 'USD')} ${c.balance_usd > 0 ? '(B)' : c.balance_usd < 0 ? '(A)' : ''}</td>
                <td class="balance">${formatMoney(c.balance_eur, 'EUR')} ${c.balance_eur > 0 ? '(B)' : c.balance_eur < 0 ? '(A)' : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">Bu rapor İPEX ERP sistemi tarafından oluşturulmuştur.</div>
        <script>window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

async function filterCustomers() {
  try {
    const res = await api('customers');
    customers = res.data || [];
    const tbody = document.getElementById('custTableBody');
    const search = document.getElementById('custSearchInput')?.value.toLowerCase();

    let filtered = customers;
    if (search) {
      filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search) ||
        (c.phone && c.phone.includes(search))
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center; color:var(--text3)">Müşteri bulunamadı.</td></tr>';
      return;
    }

    const formatMoney = (val, curr = 'TRY') => {
      const sym = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : '₺';
      return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0) + ' ' + sym;
    };

    // KPI Güncelleme
    const stats = filtered.reduce((acc, c) => {
      acc.total++;
      // TL
      if (c.balance > 0) { acc.debit_tl += c.balance; acc.debtors++; }
      else if (c.balance < 0) { acc.credit_tl += Math.abs(c.balance); }
      // USD
      if (c.balance_usd > 0) { acc.debit_usd += c.balance_usd; }
      else if (c.balance_usd < 0) { acc.credit_usd += Math.abs(c.balance_usd); }
      // EUR
      if (c.balance_eur > 0) { acc.debit_eur += c.balance_eur; }
      else if (c.balance_eur < 0) { acc.credit_eur += Math.abs(c.balance_eur); }

      return acc;
    }, { total: 0, debit_tl: 0, credit_tl: 0, debit_usd: 0, credit_usd: 0, debit_eur: 0, credit_eur: 0, debtors: 0 });

    document.getElementById('totalCustCount').textContent = stats.total;
    document.getElementById('totalDebitBal').textContent = formatMoney(stats.debit_tl, 'TRY');
    document.getElementById('totalCreditBal').textContent = formatMoney(stats.credit_tl, 'TRY');
    document.getElementById('debtorCustCount').textContent = stats.debtors;

    // Extra Currencies
    document.getElementById('totalDebitExtra').innerHTML = `
      <span style="color:#ffb347">${formatMoney(stats.debit_usd, 'USD')}</span>
      <span style="color:#7c5cfc">${formatMoney(stats.debit_eur, 'EUR')}</span>
    `;
    document.getElementById('totalCreditExtra').innerHTML = `
      <span style="color:#ffb347">${formatMoney(stats.credit_usd, 'USD')}</span>
      <span style="color:#7c5cfc">${formatMoney(stats.credit_eur, 'EUR')}</span>
    `;

    tbody.innerHTML = filtered.map(c => {
      const balTL = c.balance || 0;
      const balUSD = c.balance_usd || 0;
      const balEUR = c.balance_eur || 0;

      return `
      <tr>
        <td style="font-weight:700; color:var(--text)">${c.name}</td>
        <td>${c.phone || '-'}</td>
        <td style="font-weight:700; color:${balTL > 0 ? '#ff4d4f' : balTL < 0 ? '#25D366' : 'var(--text)'}">${formatMoney(Math.abs(balTL))} ${balTL > 0 ? '(B)' : balTL < 0 ? '(A)' : ''}</td>
        <td style="font-weight:700; color:${balUSD > 0 ? '#ffb347' : balUSD < 0 ? '#25D366' : 'var(--text3)'}">${formatMoney(Math.abs(balUSD), 'USD')} ${balUSD > 0 ? '(B)' : balUSD < 0 ? '(A)' : ''}</td>
        <td style="font-weight:700; color:${balEUR > 0 ? '#7c5cfc' : balEUR < 0 ? '#25D366' : 'var(--text3)'}">${formatMoney(Math.abs(balEUR), 'EUR')} ${balEUR > 0 ? '(B)' : balEUR < 0 ? '(A)' : ''}</td>
        <td style="font-size:12px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${c.notes || '-'}</td>
        <td style="white-space:nowrap; text-align:right">
          <button class="btn btn-sm btn-secondary" style="background:#7c5cfc; border-color:#7c5cfc; color:white; font-weight:700" onclick="openCustomerFinances(${c.id})" title="Finans ve Ekstre">💳 EKSTRE</button>
          <button class="btn btn-sm btn-secondary" style="background:#25D366; border-color:#25D366; color:white; font-weight:700" onclick="shareFullCustomerReport(${c.id})" title="WhatsApp Rapor Paylaş">📲 RAPOR</button>
          <button class="btn btn-sm btn-secondary" style="background:var(--accent); border-color:var(--accent); color:white" onclick="previewCustomerReport(${c.id})" title="Sevkiyat & Giriş Raporu">📊 ÖNİZLEME</button>
          <button class="btn btn-sm btn-secondary" onclick="openCustomerModal(${c.id})" title="Düzenle">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})" title="Sil">🗑</button>
        </td>
      </tr>
    `;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

function openCustomerModal(id = 0) {
  const c = id ? customers.find(x => x.id === id) : null;
  openModal(id ? 'Cari Düzenle' : 'Yeni Cari Kartı', `
    <form onsubmit="saveCustomer(event, ${id})">
      <div class="form-grid">
        <div class="form-floating form-full">
          <input type="text" id="custName" required placeholder=" " value="${c ? c.name : ''}">
          <label>Cari / Firma Adı *</label>
        </div>
        <div class="form-floating">
          <input type="text" id="custPhone" placeholder=" " value="${c ? c.phone : ''}">
          <label>Telefon</label>
        </div>
        <div class="form-floating">
          <input type="email" id="custEmail" placeholder=" " value="${c ? c.email : ''}">
          <label>E-posta</label>
        </div>
        <div class="form-floating form-full">
          <textarea id="custNotes" style="height:80px; padding-top:25px" placeholder=" ">${c ? c.notes : ''}</textarea>
          <label>Notlar</label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
        <button type="submit" class="btn btn-primary">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveCustomer(e, id) {
  e.preventDefault();
  try {
    await api('customers', {
      id: id || '',
      name: document.getElementById('custName').value,
      phone: document.getElementById('custPhone').value,
      email: document.getElementById('custEmail').value,
      notes: document.getElementById('custNotes').value
    }, 'POST');
    closeModal();
    toast(id ? 'Müşteri güncellendi' : 'Müşteri eklendi');
    loadCustomers();
  } catch (e) { toast(e.message, 'error'); }
}

function deleteCustomer(id) {
  if (confirm('Müşteriyi silmek istediğinizden emin misiniz?')) {
    api('customer_delete', { id }, 'POST').then(() => {
      toast('Müşteri silindi');
      loadCustomers();
    }).catch(e => toast(e.message, 'error'));
  }
}

// 💰 FİNANS VE EKSTRE
async function openCustomerFinances(customerId) {
  try {
    const c = customers.find(x => x.id === customerId);
    const customerName = c ? c.name : 'Cari';

    const res = await api('acc_transactions', { customer_id: customerId });
    const txs = res.data || [];

    const getBal = (cur) => {
      let b = 0;
      txs.filter(t => (t.currency || 'TL') === cur).forEach(t => {
        const isBorc = t.type === 'fatura_satis' || t.type === 'odeme';
        b += isBorc ? parseFloat(t.amount) : -parseFloat(t.amount);
      });
      return b;
    };

    const tlBal = getBal('TL');
    const usdBal = getBal('USD');
    const eurBal = getBal('EUR');

    const cardHTML = (title, val, sym, color) => `
      <div class="stat-card" style="padding:15px; flex:1; background:var(--bg-card); border:1px solid var(--border); border-left:4px solid ${color}">
        <div style="font-size:10px; text-transform:uppercase; color:var(--text3); margin-bottom:5px; font-weight:700">${title}</div>
        <div style="font-size:18px; font-weight:900; color:${val > 0 ? '#ff4d4f' : val < 0 ? '#25D366' : 'var(--text)'}">
          ${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(Math.abs(val))} ${sym}
          <span style="font-size:10px; font-weight:400; opacity:0.7">${val > 0 ? '(B)' : val < 0 ? '(A)' : ''}</span>
        </div>
      </div>
    `;

    let html = `
      <div style="display:flex; gap:12px; margin-bottom:20px">
        ${cardHTML('TL Bakiyesi', tlBal, '₺', '#7c5cfc')}
        ${cardHTML('USD Bakiyesi', usdBal, '$', '#25D366')}
        ${cardHTML('EUR Bakiyesi', eurBal, '€', '#ffb347')}
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:10px">
        <div style="display:flex; gap:10px">
          <button class="btn btn-sm" style="background:#25D366; color:white; border:none; padding:8px 15px" onclick="openAddTransactionModal(${customerId}, '${customerName}', 'tahsilat')">💵 + Tahsilat Ekle</button>
          <button class="btn btn-sm" style="background:#ff4d4f; color:white; border:none; padding:8px 15px" onclick="openAddTransactionModal(${customerId}, '${customerName}', 'odeme')">💸 - Ödeme Yap</button>
        </div>
        <div style="display:flex; gap:10px">
          <button class="btn btn-sm" style="background:#25D366; color:white; border:none; padding:8px 15px" onclick="shareCustomerStatement(${customerId})">📱 WhatsApp ile Gönder</button>
          <button class="btn btn-sm" style="background:var(--bg-card); color:var(--text); border:1px solid var(--border)" onclick="printCustomerStatement(${customerId})">🖨️ Ekstre Yazdır</button>
          <button class="btn btn-sm" style="background:#7c5cfc; color:white; border:none; padding:8px 15px" onclick="openInvoiceModal(${customerId})">🧾 Yeni Fatura Oluştur</button>
        </div>
      </div>

      <div style="overflow-x:auto; max-height:350px; border:1px solid var(--border); border-radius:8px">
        <table style="font-size:13px; margin:0">
          <thead style="position:sticky; top:0; background:var(--bg)">
            <tr>
              <th>Tarih</th>
              <th>İşlem Tipi</th>
              <th>Araç</th>
              <th>Açıklama</th>
              <th style="text-align:right">Tutar</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody id="customerTxBody">
    `;

    if (txs.length === 0) {
      html += `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text3)">Henüz bir finansal hareket bulunmuyor.</td></tr>`;
    } else {
      html += txs.map(t => {
        const isBorc = t.type === 'fatura_satis' || t.type === 'odeme';
        let typeStr = '';
        if (t.type === 'fatura_satis') typeStr = 'Satış Faturası';
        if (t.type === 'fatura_alis') typeStr = 'Alış Faturası';
        if (t.type === 'tahsilat') typeStr = 'Tahsilat Eklendi';
        if (t.type === 'odeme') typeStr = 'Ödeme Yapıldı';

        return `
          <tr>
            <td style="white-space:nowrap">${t.date.split('-').reverse().join('.')}</td>
            <td style="font-weight:600">${typeStr}</td>
            <td><span class="badge" style="background:var(--bg-card)">${t.payment_method || '-'}</span></td>
            <td>${t.notes || '-'}</td>
            <td style="text-align:right; font-weight:700; color:${isBorc ? '#ff4d4f' : '#25D366'}">
              ${isBorc ? '+' : '-'}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(t.amount)} ${t.currency === 'USD' ? '$' : (t.currency === 'EUR' ? '€' : '₺')}
            </td>
            <td style="text-align:right">
              <button class="btn btn-sm btn-icon" onclick="deleteTransaction(${t.id}, ${customerId})" title="İşlemi Sil" style="color:#ff4d4f; background:transparent; border:none; padding:5px; cursor:pointer">🗑️</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    html += `</tbody>
        <tfoot style="position:sticky; bottom:0; background:var(--bg-card); font-weight:800; border-top:2px solid var(--border)">
          <tr>
            <td colspan="6" style="text-align:center; padding:10px; font-size:11px; color:var(--text3)">Dövizli bakiyeler yukarıdaki kartlarda özetlenmiştir.</td>
          </tr>
        </tfoot>
    </table></div>`;
    openModal(`💳 Cari Ekstresi: ${customerName}`, html, '900px');
  } catch (e) { toast(e.message, 'error'); }
}

function openAddTransactionModal(customerId, customerName, type) {
  const title = type === 'tahsilat' ? 'Tahsilat Ekle (Para Girişi)' : 'Ödeme Yap (Para Çıkışı)';
  const color = type === 'tahsilat' ? '#25D366' : '#ff4d4f';

  openModal(title, `
    <form onsubmit="saveTransaction(event, ${customerId}, '${type}')">
      <div style="margin-bottom:15px; font-weight:600; color:var(--text2)">Cari: ${customerName}</div>
      <div class="form-grid">
        <div class="form-floating">
          <input type="date" id="txDate" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
          <label>Tarih *</label>
        </div>
        <div class="form-floating">
          <select id="txMethod" class="form-control" required>
            <option value="Nakit">Nakit</option>
            <option value="Banka">Banka (EFT/Havale)</option>
            <option value="Çek">Çek</option>
            <option value="Kredi Kartı">Kredi Kartı</option>
          </select>
          <label>Ödeme Aracı *</label>
        </div>
        <div class="form-floating">
          <select id="txCurrency" class="form-control" onchange="document.getElementById('txRateArea').style.display = this.value==='TL'?'none':'block'">
            <option value="TL">TRY (₺)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
          <label>Döviz</label>
        </div>
        <div class="form-floating" id="txRateArea" style="display:none">
          <input type="number" id="txExchangeRate" class="form-control" value="1" step="0.0001">
          <label>Kur (Parite)</label>
        </div>
        <div class="form-floating form-full">
          <input type="number" id="txAmount" class="form-control" required placeholder=" " step="0.01" min="0.01">
          <label>Tutar *</label>
        </div>
        <div class="form-floating form-full">
          <input type="text" id="txNotes" class="form-control" placeholder=" ">
          <label>Açıklama / Belge No</label>
        </div>
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button type="button" class="btn btn-secondary" onclick="openCustomerFinances(${customerId})">Geri Dön</button>
        <button type="submit" class="btn btn-primary" style="background:${color}; border-color:${color}">✓ Kaydet</button>
      </div>
    </form>
  `);
}

async function saveTransaction(e, customerId, type) {
  e.preventDefault();
  try {
    await api('acc_transactions', {
      customer_id: customerId,
      type: type,
      amount: document.getElementById('txAmount').value,
      currency: document.getElementById('txCurrency').value,
      exchange_rate: document.getElementById('txExchangeRate').value,
      payment_method: document.getElementById('txMethod').value,
      date: document.getElementById('txDate').value,
      notes: document.getElementById('txNotes').value
    }, 'POST');
    toast('Finansal işlem başarıyla kaydedildi', 'success');
    loadCustomers();
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

// 🧾 FATURA KESME (SEVKİYAT/ÇEKİ LİSTESİ SEÇEREK)
let currentInvoiceItems = [];

async function openInvoiceModal(customerId, initialType = 'satis') {
  try {
    const c = customers.find(x => x.id === customerId);
    const customerName = c ? c.name : 'Cari';

    const endpoint = initialType === 'satis' ? 'unbilled_shipments' : 'unbilled_entries';
    const res = await api(endpoint, { customer_id: customerId });
    const list = res.data || [];
    window._currentInvoiceList = list;

    let html = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px">
        <div style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-sm)">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:var(--text3); margin-bottom:10px">İşlem Detayları</div>
          <div style="font-weight:700; color:var(--text); font-size:16px; margin-bottom:15px">${customerName}</div>
          <div style="display:flex; background:var(--bg); padding:5px; border-radius:8px; border:1px solid var(--border)">
            <button class="btn ${initialType === 'satis' ? 'btn-primary' : ''}" style="flex:1; border:none; font-size:12px; ${initialType === 'satis' ? 'background:#7c5cfc' : 'background:transparent; color:var(--text2)'}" onclick="openInvoiceModal(${customerId}, 'satis')">Satış Faturası</button>
            <button class="btn ${initialType === 'alis' ? 'btn-primary' : ''}" style="flex:1; border:none; font-size:12px; ${initialType === 'alis' ? 'background:#7c5cfc' : 'background:transparent; color:var(--text2)'}" onclick="openInvoiceModal(${customerId}, 'alis')">Alış Faturası</button>
          </div>
        </div>

        <div style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border); box-shadow:var(--shadow-sm)">
          <div style="display:flex; gap:10px; margin-bottom:15px">
            <div style="flex:1">
              <label style="display:block; font-size:11px; margin-bottom:5px; opacity:0.7">Fatura Döviz</label>
              <select id="invCurrency" class="form-control" onchange="updateCurrencySymbols()">
                <option value="TL">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div style="flex:1; display:none" id="invRateArea">
              <label style="display:block; font-size:11px; margin-bottom:5px; opacity:0.7">Kur (Parite)</label>
              <input type="number" id="invExchangeRate" class="form-control" value="1" step="0.0001">
            </div>
          </div>
          <div style="display:flex; gap:10px; margin-bottom:15px">
            <div style="flex:1">
              <label style="display:block; font-size:11px; margin-bottom:5px; opacity:0.7">Fatura Tarihi</label>
              <input type="date" id="invDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div style="flex:1">
              <label style="display:block; font-size:11px; margin-bottom:5px; opacity:0.7">Fatura No</label>
              <input type="text" id="invNo" placeholder="Örn: ABC2024..." class="form-control">
            </div>
          </div>
        </div>
      </div>

      <div style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border); overflow:hidden; margin-bottom:20px; box-shadow:var(--shadow-sm)">
        <div style="padding:12px 15px; background:rgba(124, 92, 252, 0.05); border-bottom:1px solid var(--border); font-weight:600; font-size:13px">
          Faturalandırılacak ${initialType === 'satis' ? 'Çeki Listeleri' : 'Giriş Kayıtları'}
        </div>
        <div style="max-height:180px; overflow-y:auto">
          <table style="font-size:12px; margin:0">
            <thead style="position:sticky; top:0; background:var(--bg-card); z-index:10">
              <tr style="border-bottom:1px solid var(--border)">
                <th style="width:40px; text-align:center"><input type="checkbox" onchange="toggleAllInvoiceShipments(this)"></th>
                <th>Tarih</th>
                <th>Evrak/Fiş No</th>
                <th>İçerik Özeti</th>
              </tr>
            </thead>
            <tbody id="invoiceShipmentList">
              ${list.map(s => {
      let summary = '';
      if (initialType === 'satis') {
        summary = s.items ? s.items.map(i => `${i.product_name} (${Number(i.total_qty).toFixed(1)}m)`).join(', ') : '';
      } else {
        summary = `${s.product_name} (${Number(s.total_qty).toFixed(1)}m)`;
      }
      return `
                  <tr>
                    <td style="text-align:center"><input type="checkbox" class="inv-shipment-cb" value="${s.id}" onchange="calculateInvoiceTotals()"></td>
                    <td>${s.shipment_date ? safeFormatDate(s.shipment_date) : safeFormatDate(s.control_date)}</td>
                    <td style="font-weight:700; color:#7c5cfc">${initialType === 'satis' ? 'SVK-' + s.id : s.doc_no || 'Giriş-' + s.id}</td>
                    <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${summary}">${summary || 'Boş'}</td>
                  </tr>
                `;
    }).join('')}
              ${list.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text3)">Faturalandırılmamış kayıt bulunamadı.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div id="invoiceItemsArea" style="display:none; margin-bottom:20px">
        <div style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border); overflow:hidden; box-shadow:var(--shadow-sm)">
          <div style="padding:12px 15px; background:rgba(124, 92, 252, 0.05); border-bottom:1px solid var(--border); font-weight:600; font-size:13px">Ürün Detayları & Fiyatlandırma</div>
          <table style="font-size:12px; margin:0">
            <thead style="background:var(--bg)"><tr><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th style="text-align:right">Ara Toplam</th></tr></thead>
            <tbody id="invoiceItemsBody"></tbody>
          </table>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:20px; align-items: flex-start">
        <div style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid var(--border)">
          <label style="font-size:11px; color:var(--text3); display:block; margin-bottom:8px">Fatura Açıklaması</label>
          <textarea id="invNotes" rows="4" placeholder="Fatura ile ilgili notlar..." style="width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:8px; font-size:13px; resize:none"></textarea>
        </div>

        <div style="background:#7c5cfc; padding:20px; border-radius:12px; color:white; box-shadow:0 10px 20px rgba(124, 92, 252, 0.2)">
          <div style="display:flex; justify-content:space-between; margin-bottom:10px; opacity:0.8; font-size:13px">
            <span>Ara Toplam</span>
            <span id="invSubtotal">0.00 ₺</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center">
            <span style="opacity:0.8; font-size:13px">KDV Oranı (%)</span>
            <input type="number" id="invTaxRate" value="10" min="0" max="100" oninput="recalcInvoiceGrandTotal(false)" style="background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:2px 5px; font-size:12px; width:60px; text-align:right">
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:15px; opacity:0.8; font-size:13px; align-items:center">
            <span>KDV Tutarı</span>
            <input type="number" id="invTaxAmount" step="0.01" value="0.00" oninput="recalcInvoiceGrandTotal(true)" style="background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:2px 5px; font-size:12px; width:80px; text-align:right">
          </div>
          <div style="height:1px; background:rgba(255,255,255,0.2); margin-bottom:15px"></div>
          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:22px">
            <span>TOPLAM</span>
            <span id="invTotalAmount">0.00 ₺</span>
          </div>
        </div>
      </div>

      <div class="form-actions" style="margin-top:25px; padding-top:20px; border-top:1px solid var(--border)">
        <button type="button" class="btn btn-secondary" onclick="openCustomerFinances(${customerId})">Vazgeç</button>
        <button type="button" class="btn btn-primary" style="padding: 10px 30px; font-weight:700; background:#7c5cfc; border:none; box-shadow:0 4px 10px rgba(124,92,252,0.3)" onclick="submitInvoice(${customerId})">Faturayı Kaydet & Cariyi Güncelle</button>
      </div>
    `;

    openModal(`🧾 ${initialType === 'satis' ? 'Satış' : 'Alış'} Faturası Kes - ${customerName}`, html, '800px');
  } catch (e) { toast(e.message, 'error'); }
}

function safeFormatDate(d) {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return parts.reverse().join('.');
}

function toggleAllInvoiceShipments(el) {
  document.querySelectorAll('.inv-shipment-cb').forEach(cb => cb.checked = el.checked);
  calculateInvoiceTotals();
}

function calculateInvoiceTotals() {
  const itemsMap = {};
  // Fatura tipini aktif butondan veya başlıktan anla
  const isSatis = document.querySelector('button[onclick*="satis"].btn-primary') !== null;
  const type = isSatis ? 'satis' : 'alis';

  document.querySelectorAll('.inv-shipment-cb:checked').forEach(cb => {
    const s = window._currentInvoiceList.find(x => x.id == cb.value);
    if (!s) return;

    let items = [];
    if (type === 'satis') {
      items = s.items || [];
    } else {
      items = [{ product_id: s.product_id, product_name: s.product_name, total_qty: s.total_qty }];
    }

    items.forEach(i => {
      if (!itemsMap[i.product_id]) {
        itemsMap[i.product_id] = { id: i.product_id, name: i.product_name, qty: 0, price: 0 };
      }
      itemsMap[i.product_id].qty += parseFloat(i.total_qty || 0);
    });
  });

  currentInvoiceItems = Object.values(itemsMap);
  const tbody = document.getElementById('invoiceItemsBody');
  const area = document.getElementById('invoiceItemsArea');
  const notesField = document.getElementById('invNotes');

  if (currentInvoiceItems.length === 0) {
    area.style.display = 'none';
    if (notesField) notesField.value = '';
    recalcInvoiceGrandTotal();
    return;
  }

  area.style.display = 'block';

  // Otomatik açıklama (Kalite ve Metraj Bilgisi)
  if (notesField) {
    let summary = currentInvoiceItems.map(it => `${it.qty.toFixed(1)}m ${it.name}`).join(', ') + " faturasıdır.";
    notesField.value = summary;
  }

  const oldPrices = {};
  document.querySelectorAll('.inv-price-input').forEach(inp => {
    oldPrices[inp.dataset.id] = parseFloat(inp.value || 0);
  });

  tbody.innerHTML = currentInvoiceItems.map(item => {
    const price = oldPrices[item.id] || '';
    const total = (item.qty * (parseFloat(price) || 0)).toFixed(2);
    item.price = parseFloat(price) || 0;
    item.total = total;
    return `
      <tr>
        <td style="font-weight:600">${item.name}</td>
        <td>${item.qty.toFixed(2)} Metre</td>
        <td>
          <div style="display:flex; align-items:center; gap:5px">
            <input type="number" step="0.01" min="0" class="inv-price-input" data-id="${item.id}" value="${price}" oninput="updateInvoiceRow(${item.id})" style="width:100px; padding:6px; font-size:13px; border:1px solid var(--border); border-radius:4px; text-align:right" placeholder="0.00">
            <span class="inv-curr-symbol" style="color:var(--text3)">₺</span>
          </div>
        </td>
        <td style="text-align:right; font-weight:700; font-size:14px; color:var(--text)" id="inv-row-total-val-${item.id}">${total} ₺</td>
      </tr>
    `;
  }).join('');

  recalcInvoiceGrandTotal();
}

function updateInvoiceRow(id) {
  const inp = document.querySelector(`.inv-price-input[data-id="${id}"]`);
  const price = parseFloat(inp.value || 0);
  const item = currentInvoiceItems.find(x => x.id === id);
  if (item) {
    item.price = price;
    item.total = item.qty * price;
    const cell = document.getElementById(`inv-row-total-val-${id}`);
    if (cell) cell.innerText = item.total.toFixed(2) + ' ' + (document.getElementById('invCurrency').value === 'USD' ? '$' : (document.getElementById('invCurrency').value === 'EUR' ? '€' : '₺'));
  }
  recalcInvoiceGrandTotal();
}

function updateCurrencySymbols() {
  const cur = document.getElementById('invCurrency').value;
  const sym = cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '₺');
  document.getElementById('invRateArea').style.display = cur === 'TL' ? 'none' : 'block';
  document.querySelectorAll('.inv-curr-symbol').forEach(el => el.innerText = sym);
  recalcInvoiceGrandTotal();
}

function recalcInvoiceGrandTotal(isManualTax = false) {
  let subtotal = 0;
  currentInvoiceItems.forEach(i => subtotal += parseFloat(i.total || 0));

  const taxRateSelect = document.getElementById('invTaxRate');
  const taxAmountInput = document.getElementById('invTaxAmount');
  if (!taxAmountInput) return;

  let taxAmount = 0;
  if (isManualTax) {
    taxAmount = parseFloat(taxAmountInput.value || 0);
  } else {
    const taxRate = parseInt(taxRateSelect.value || 0);
    taxAmount = subtotal * (taxRate / 100);
    taxAmountInput.value = taxAmount.toFixed(2);
  }

  const total = subtotal + taxAmount;
  const cur = document.getElementById('invCurrency').value;
  const sym = cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '₺');
  const fmt = (v) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ' + sym;

  document.getElementById('invSubtotal').innerText = fmt(subtotal);
  document.getElementById('invTotalAmount').innerText = fmt(total);
}

async function submitInvoice(customerId) {
  const isSatis = document.querySelector('button[onclick*="satis"].btn-primary') !== null;
  const type = isSatis ? 'satis' : 'alis';
  const selectedCheckboxes = Array.from(document.querySelectorAll('.inv-shipment-cb:checked'));
  const ids = selectedCheckboxes.map(cb => cb.value);

  if (ids.length === 0) return toast('Lütfen faturalandırılacak en az bir kayıt seçin.', 'error');

  let subtotal = 0;
  const items = currentInvoiceItems.map(i => {
    subtotal += (i.qty * i.price);
    return { product_id: i.id, quantity: i.qty, unit_price: i.price, total_price: i.qty * i.price };
  });

  const hasZeroPrice = items.some(i => i.unit_price <= 0);
  if (hasZeroPrice && !confirm('Bazı ürünlerin birim fiyatı 0 (Sıfır) olarak bırakılmış. Devam etmek istiyor musunuz?')) return;

  const taxAmount = parseFloat(document.getElementById('invTaxAmount').value || 0);
  const currency = document.getElementById('invCurrency').value;
  const rate = document.getElementById('invExchangeRate').value;
  const total = subtotal + taxAmount;

  if (total <= 0) return toast('Fatura toplam tutarı 0 olamaz. Lütfen birim fiyat giriniz.', 'error');

  const payload = {
    customer_id: customerId,
    type: type,
    invoice_no: document.getElementById('invNo').value,
    date: document.getElementById('invDate').value,
    subtotal: subtotal,
    tax: taxAmount,
    total: total,
    notes: document.getElementById('invNotes').value,
    items: items,
    currency: currency,
    exchange_rate: rate
  };

  if (type === 'satis') payload.shipment_ids = ids;
  else payload.entry_ids = ids;

  try {
    await api('save_invoice', payload, 'POST');

    toast('Fatura başarıyla kaydedildi!', 'success');
    openCustomerFinances(customerId);
    loadCustomers();
  } catch (e) { toast(e.message, 'error'); }
}


async function shareCustomerStatement(customerId) {
  try {
    const c = customers.find(x => x.id === customerId);
    const name = c ? c.name : 'Cari';

    const res = await api('acc_transactions', { customer_id: customerId });
    const txs = res.data || [];
    if (txs.length === 0) return toast('Paylaşılacak işlem bulunmuyor.', 'info');

    const settingsRes = await api('settings');
    const settings = settingsRes.data || {};
    const companyName = settings.company_name || 'DokumaQC';

    const balances = { TL: 0, USD: 0, EUR: 0 };
    let msg = `*${name} - HESAP EKSTRESİ* 📄\n\n`;

    // Son 15 işlemi listele
    txs.slice(0, 15).forEach(t => {
      const cur = t.currency || 'TL';
      const date = t.date.split('-').reverse().join('.');
      const sym = cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '₺');

      let typeStr = t.type === 'fatura_satis' ? 'Satış Fat.' : (t.type === 'fatura_alis' ? 'Alış Fat.' : (t.type === 'tahsilat' ? 'Tahsilat' : 'Ödeme'));
      msg += `📅 ${date} | ${typeStr} | *${new Intl.NumberFormat('tr-TR').format(t.amount)} ${sym}* \n`;
      if (t.notes) msg += `   └ _${t.notes}_\n`;
    });

    // Tüm işlemler üzerinden bakiyeleri hesapla
    txs.forEach(t => {
      const cur = t.currency || 'TL';
      const isBorc = t.type === 'fatura_satis' || t.type === 'odeme';
      if (!balances[cur]) balances[cur] = 0;
      balances[cur] += isBorc ? parseFloat(t.amount) : -parseFloat(t.amount);
    });

    msg += `\n--------------------------\n`;
    msg += `💰 *GÜNCEL BAKİYELER:* \n`;

    Object.keys(balances).forEach(cur => {
      if (Math.abs(balances[cur]) > 0.01) {
        const sym = cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : '₺');
        const b = balances[cur];
        msg += `• ${cur}: *${new Intl.NumberFormat('tr-TR').format(Math.abs(b))} ${sym}* ${b > 0 ? '(Borç)' : '(Alacak)'}\n`;
      }
    });

    msg += `\n_Bu rapor ${companyName} üzerinden otomatik oluşturulmuştur._`;

    const encoded = encodeURIComponent(msg);
    const whatsappUrl = `https://wa.me/?text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  } catch (e) { toast(e.message, 'error'); }
}

// 📝 RAPOR PAYLAŞMA (WhatsApp)
async function shareLoomStatus(id) {
  try {
    const res = await api('looms');
    const l = res.data.find(x => x.id === id);
    if (!l) return;

    // Kalan çözgü hesabı
    const consumed = getWarpConsumed(l);
    const remaining = Math.max(0, l.warp_total - consumed);

    // Randıman metni
    let effText = "";
    if (l.rpm > 0 && l.product_density > 0 && l.reset_at) {
      const resetTime = new Date(l.reset_at.replace(' ', 'T')).getTime();
      const minsPassed = Math.max(1, (Date.now() - resetTime) / 60000);
      const theoretical = (l.rpm * minsPassed) / (l.product_density * 100);
      const eff = theoretical > 0 ? Math.min(100, (l.daily_meters / theoretical) * 100) : 0;
      effText = `🔹 *Günlük Randıman:* %${eff.toFixed(1)} \n`;
    }

    const settingsRes = await api('settings');
    const settings = settingsRes.data || {};
    const companyName = settings.company_name || 'DokumaQC';

    const customerText = l.customer_name ? `Sayın *${l.customer_name}*, \n\n` : "";
    const message = `${customerText}*SİPARİŞ DURUM RAPORU* 📊 \n\n` +
      `🏗 *Tezgah:* ${l.name} \n` +
      `📦 *Kalite:* ${l.product_code || '-'} (${l.product_name || '-'}) \n` +
      `📏 *Kalan Çözgü:* ${remaining.toFixed(1)} metre \n` +
      `${effText}` +
      `\n_${companyName} Takip Sistemi üzerinden otomatik oluşturulmuştur._`;

    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  } catch (e) { toast(e.message, 'error'); }
}

// 📊 TOPLU MÜŞTERİ RAPORU (WhatsApp)
async function shareFullCustomerReport(customerId) {
  try {
    toast('Rapor hazırlanıyor...', 'info');
    const [loomRes, custRes] = await Promise.all([api('looms'), api('customers')]);

    const customer = custRes.data.find(c => c.id == customerId);
    const myLooms = loomRes.data.filter(l => l.customer_id == customerId);

    if (!customer) throw new Error('Müşteri bulunamadı');
    if (!myLooms.length) {
      toast('Bu müşteriye atanmış aktif tezgah bulunamadı', 'warning');
      return;
    }

    let message = `Sayın *${customer.name}*, \n`;
    message += `İşletmemizde sizin için çalışan tezgahların güncel durumu aşağıdadır: \n\n`;

    myLooms.forEach(l => {
      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, l.warp_total - consumed);

      let statusIcon = l.status === 'çalışıyor' ? '🟢' : (l.status === 'durdu' ? '🔴' : '🟠');
      let statusText = l.status.toUpperCase();

      message += `${statusIcon} *Tezgah ${l.name}:* \n`;
      message += `   📦 Kalite: ${l.product_code || '-'} \n`;
      message += `   📏 Kalan: ${remaining.toFixed(1)} mt \n`;
      message += `   ⚙️ Durum: ${statusText} \n`;

      if (l.rpm > 0 && l.product_density > 0 && l.reset_at && l.status === 'çalışıyor') {
        const resetTime = new Date(l.reset_at.replace(' ', 'T')).getTime();
        const minsPassed = Math.max(1, (Date.now() - resetTime) / 60000);
        const theoretical = (l.rpm * minsPassed) / (l.product_density * 100);
        const eff = theoretical > 0 ? Math.min(100, (l.daily_meters / theoretical) * 100) : 0;
        message += `   📈 Randıman: %${eff.toFixed(1)} \n`;
      }
      message += `\n`;
    });

    const settingsRes = await api('settings');
    const settings = settingsRes.data || {};
    const companyName = settings.company_name || 'DokumaQC';

    message += `_${companyName} Takip Sistemi üzerinden otomatik oluşturulmuştur._`;

    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customer.phone ? customer.phone.replace(/\D/g, '') : ''}?text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  } catch (e) { toast(e.message, 'error'); }
}
let allLoomsList = [];

async function loadLoomListView() {
  const content = document.getElementById('contentArea');
  content.innerHTML = '<div class="spinner"></div>';

  try {
    const [lRes, oRes] = await Promise.all([api('looms'), api('orders')]);
    allLoomsList = (lRes.data || []).map(l => {
      const order = (oRes.data || []).find(o => o.id == l.order_id);
      return { ...l, _orderNo: order ? order.order_no : null };
    });
    renderLoomListTable(allLoomsList);
  } catch (e) { toast(e.message, 'error'); }
}

function renderLoomListTable(looms) {
  const content = document.getElementById('contentArea');

  let rows = looms.map(l => {
    let density = parseFloat(l.product_density || 0);
    let warpYarn = l.warp_yarn || '-';
    let weftYarn = l.weft_yarn || '-';

    if (l.product_tech) {
      try {
        const td = JSON.parse(l.product_tech);
        if (td.warpList && td.warpList.length) warpYarn = td.warpList.join(', ');
        if (td.weftList && td.weftList.length) weftYarn = td.weftList.join(', ');
      } catch (e) { }
    }

    const consumed = getWarpConsumed(l);
    const remaining = Math.max(0, l.warp_total - consumed);

    let remainingDays = '-';
    if (l.rpm > 0 && density > 0 && remaining > 0) {
      const mph = (parseFloat(l.rpm) * 60) / (density * 100);
      const realMpd = mph * (l.work_hours || 24) * 0.85;
      remainingDays = (remaining / realMpd).toFixed(1) + ' gün';
    }

    return `
      <tr>
        <td style="background:var(--surface2); border-right:1px solid var(--border)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div style="font-weight:800; color:var(--accent); font-size:18px">${l.name}</div>
            <div style="font-size:11px; font-weight:800; color:${(() => {
        let eff = 0;
        const mins = Math.max(1, l.mins_passed || 1);
        const dens = parseFloat(l.product_density || 0);
        if (l.last_efficiency !== null) eff = parseFloat(l.last_efficiency);
        else if (l.rpm > 0 && dens > 0) {
          const theoretical = (parseFloat(l.rpm) * mins) / (dens * 100);
          eff = theoretical > 0 ? Math.min(100, (parseFloat(l.daily_meters || 0) / theoretical) * 100) : 0;
        }
        return eff >= 85 ? 'var(--accent)' : (eff >= 70 ? 'var(--warning)' : 'var(--danger)');
      })()}">
              %${(() => {
        let eff = 0;
        const mins = Math.max(1, l.mins_passed || 1);
        const dens = parseFloat(l.product_density || 0);
        if (l.last_efficiency !== null) eff = parseFloat(l.last_efficiency);
        else if (l.rpm > 0 && dens > 0) {
          const theoretical = (parseFloat(l.rpm) * mins) / (dens * 100);
          eff = theoretical > 0 ? Math.min(100, (parseFloat(l.daily_meters || 0) / theoretical) * 100) : 0;
        }
        return eff.toFixed(1);
      })()}
            </div>
          </div>
          <div style="font-size:10px; color:var(--text3); font-weight:700">${l.rpm || 0} RPM</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px">
            <div style="font-weight:700">${l.product_name || '-'}</div>
            <div style="font-size:11px; color:var(--accent); background:rgba(0,212,170,0.1); padding:2px 6px; border-radius:4px; font-weight:800">${density || 0} TEL</div>
          </div>
          <div style="font-size:10px; color:var(--text3)">${l.product_code || ''}</div>
        </td>
        <td>
          ${l._orderNo ? `
          <div style="font-weight:700;color:var(--accent);font-size:12px">📋 ${l._orderNo}</div>
          <div style="font-size:10px;color:var(--text2)">${l.customer_name || '-'}</div>` : `<div style="font-size:11px;color:var(--text3)">Yok</div><button class="btn btn-xs" style="margin-top:4px;padding:2px 6px;font-size:10px;background:rgba(79,124,255,.1);color:var(--blue);border:1px solid rgba(79,124,255,.3)" onclick="openLoomOrderModal(${l.id})">+ Ata</button>`}
        </td>
        <td style="color:var(--warning); font-weight:800">${l.lot_no || '-'}</td>
        <td style="font-size:11px; line-height:1.2">
          <div style="color:var(--text2)">Ç: ${warpYarn}</div>
          <div style="color:var(--text3)">A: ${weftYarn}</div>
        </td>
        <td style="text-align:right; font-weight:600">${l.warp_total || 0} m</td>
        <td style="text-align:right; color:var(--accent)">${l.current_meters || 0} m</td>
        <td style="text-align:right; font-weight:700; color:${remaining < 100 ? 'var(--danger)' : 'var(--text)'}">${remaining.toFixed(1)} m</td>
        <td style="text-align:center; font-weight:700; color:var(--accent2)">${remainingDays}</td>
        <td style="text-align:center">
          <span class="status-badge ${l.status === 'çalışıyor' ? 'active' : (l.status === 'durdu' ? 'stopped' : 'idle')}">
            ${l.status.toUpperCase()}
          </span>
        </td>
        <td style="padding:4px">
          <input type="text" class="input-sm" value="${l.notes || ''}" 
            onchange="saveLoomNote(${l.id}, this.value)" 
            placeholder="Not..." style="width:100%; height:32px; background:var(--surface2); border:1px solid var(--border); border-radius:4px; color:var(--text); padding:0 8px; font-size:11px">
        </td>
      </tr>
    `;
  }).join('');

  const totals = looms.reduce((acc, l) => {
    const consumed = getWarpConsumed(l);
    const remaining = Math.max(0, l.warp_total - consumed);
    acc.warp += parseFloat(l.warp_total || 0);
    acc.woven += parseFloat(l.current_meters || 0);
    acc.remaining += remaining;
    return acc;
  }, { warp: 0, woven: 0, remaining: 0 });

  const footerRow = `
    <tr style="background:var(--surface3); font-weight:800; border-top:2px solid var(--border)">
      <td colspan="5" style="text-align:right; padding-right:15px">GENEL TOPLAM:</td>
      <td style="text-align:right">${totals.warp.toFixed(0)} m</td>
      <td style="text-align:right; color:var(--accent)">${totals.woven.toFixed(0)} m</td>
      <td style="text-align:right; color:var(--warning)">${totals.remaining.toFixed(0)} m</td>
      <td colspan="3"></td>
    </tr>
  `;

  content.innerHTML = `
    <div class="filter-bar" style="gap:15px; flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="loadLooms()">⬅ Kart Görünümü</button>
      <button class="btn btn-secondary btn-sm" onclick="printLoomListViewReport()">🖨️ Yazdır</button>
      
      <div style="position:relative; flex:1; min-width:250px">
        <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); opacity:0.5">🔍</span>
        <input type="text" id="loomListSearch" placeholder="Kalite, LOT veya Sıklık ara..." 
          style="width:100%; height:36px; padding-left:35px; background:var(--surface2); border:1px solid var(--border); border-radius:20px; color:var(--text)"
          oninput="filterLoomList(this.value)">
      </div>

      <div style="display:flex; gap:10px; align-items:center; margin-left:auto">
        <div class="kpi-mini">
          <span class="kpi-label">TEZGAH:</span>
          <span class="kpi-val">${looms.length}</span>
        </div>
        <div class="kpi-mini">
          <span class="kpi-label">KALAN TOPLAM:</span>
          <span class="kpi-val">${looms.reduce((sum, l) => sum + Math.max(0, l.warp_total - getWarpConsumed(l)), 0).toFixed(0)} m</span>
        </div>
      </div>
    </div>
    
    <div class="panel">
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table class="tbl" style="margin-bottom:0; font-size:12px">
          <thead>
            <tr>
              <th style="width:90px">TEZGAH / HIZ</th>
              <th>KALİTE / SIKLIK</th>
              <th>SİPARİŞ</th>
              <th>LOT NO</th>
              <th>İPLİK DETAYLARI (Ç / A)</th>
              <th style="text-align:right">ÇÖZGÜ MT</th>
              <th style="text-align:right">DOKUNAN MT</th>
              <th style="text-align:right">KALAN MT</th>
              <th style="text-align:center">KALAN GÜN</th>
              <th style="text-align:center">DURUM</th>
              <th style="min-width:200px">NOTLAR</th>
            </tr>
          </thead>
          <tbody id="loomListTableBody">${rows}</tbody>
          <tfoot id="loomListTableFoot">${footerRow}</tfoot>
        </table>
      </div>
    </div>
  `;
}

function filterLoomList(query) {
  const q = query.toLowerCase();
  const filtered = allLoomsList.filter(l =>
    (l.product_name || '').toLowerCase().includes(q) ||
    (l.product_code || '').toLowerCase().includes(q) ||
    (l.lot_no || '').toLowerCase().includes(q) ||
    (l.product_density || '').toString().includes(q) ||
    (l._orderNo || '').toLowerCase().includes(q) ||
    (l.customer_name || '').toLowerCase().includes(q)
  );

  const tbody = document.getElementById('loomListTableBody');
  if (tbody) {
    // We only update the rows to avoid losing focus if possible, 
    // but a full re-render of rows is simpler for now.
    // If the search is active, we just re-render the rows part.
    tbody.innerHTML = filtered.map(l => {
      let density = parseFloat(l.product_density || 0);
      let warpYarn = l.warp_yarn || '-';
      let weftYarn = l.weft_yarn || '-';
      if (l.product_tech) {
        try {
          const td = JSON.parse(l.product_tech);
          if (td.warpList && td.warpList.length) warpYarn = td.warpList.join(', ');
          if (td.weftList && td.weftList.length) weftYarn = td.weftList.join(', ');
        } catch (e) { }
      }
      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, l.warp_total - consumed);
      let remainingDays = '-';
      if (l.rpm > 0 && density > 0 && remaining > 0) {
        const mph = (parseFloat(l.rpm) * 60) / (density * 100);
        const realMpd = mph * (l.work_hours || 24) * 0.85;
        remainingDays = (remaining / realMpd).toFixed(1) + ' gün';
      }

      return `
        <tr>
          <td style="background:var(--surface2); border-right:1px solid var(--border)">
            <div style="font-weight:800; color:var(--accent); font-size:16px">${l.name}</div>
            <div style="font-size:10px; color:var(--text3); font-weight:700">${l.rpm || 0} RPM</div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:8px">
              <div style="font-weight:700">${l.product_name || '-'}</div>
              <div style="font-size:11px; color:var(--accent); background:rgba(0,212,170,0.1); padding:2px 6px; border-radius:4px; font-weight:800">${density || 0} TEL</div>
            </div>
            <div style="font-size:10px; color:var(--text3)">${l.product_code || ''}</div>
          </td>
          <td>
            ${l._orderNo ? `
            <div style="font-weight:700;color:var(--accent);font-size:12px">📋 ${l._orderNo}</div>
            <div style="font-size:10px;color:var(--text2)">${l.customer_name || '-'}</div>` : `<div style="font-size:11px;color:var(--text3)">Yok</div>`}
          </td>
          <td style="color:var(--warning); font-weight:800">${l.lot_no || '-'}</td>
          <td style="font-size:11px; line-height:1.2">
            <div style="color:var(--text2)">Ç: ${warpYarn}</div>
            <div style="color:var(--text3)">A: ${weftYarn}</div>
          </td>
          <td style="text-align:right; font-weight:600">${l.warp_total || 0} m</td>
          <td style="text-align:right; color:var(--accent)">${l.current_meters || 0} m</td>
          <td style="text-align:right; font-weight:700; color:${remaining < 100 ? 'var(--danger)' : 'var(--text)'}">${remaining.toFixed(1)} m</td>
          <td style="text-align:center; font-weight:700; color:var(--accent2)">${remainingDays}</td>
          <td style="text-align:center">
            <span class="status-badge ${l.status === 'çalışıyor' ? 'active' : (l.status === 'durdu' ? 'stopped' : 'idle')}">
              ${l.status.toUpperCase()}
            </span>
          </td>
          <td style="padding:4px">
            <input type="text" class="input-sm" value="${l.notes || ''}" 
              onchange="saveLoomNote(${l.id}, this.value)" 
              placeholder="Not..." style="width:100%; height:32px; background:var(--surface2); border:1px solid var(--border); border-radius:4px; color:var(--text); padding:0 8px; font-size:11px">
          </td>
        </tr>
      `;
    }).join('');

    const totals = filtered.reduce((acc, l) => {
      const consumed = Math.max(0, l.current_meters - l.warp_start_meter);
      const remaining = Math.max(0, l.warp_total - consumed);
      acc.warp += parseFloat(l.warp_total || 0);
      acc.woven += parseFloat(l.current_meters || 0);
      acc.remaining += remaining;
      return acc;
    }, { warp: 0, woven: 0, remaining: 0 });

    const tfoot = document.getElementById('loomListTableFoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr style="background:var(--surface3); font-weight:800; border-top:2px solid var(--border)">
          <td colspan="4" style="text-align:right; padding-right:15px">GENEL TOPLAM:</td>
          <td style="text-align:right">${totals.warp.toFixed(0)} m</td>
          <td style="text-align:right; color:var(--accent)">${totals.woven.toFixed(0)} m</td>
          <td style="text-align:right; color:var(--warning)">${totals.remaining.toFixed(0)} m</td>
          <td colspan="3"></td>
        </tr>
      `;
    }
  }
}

async function saveLoomNote(id, note) {
  try {
    const res = await api('looms');
    const loom = res.data.find(l => l.id == id);
    if (!loom) return;

    const formData = new FormData();
    formData.append('id', id);
    formData.append('name', loom.name);
    formData.append('product_id', loom.product_id || 0);
    formData.append('customer_id', loom.customer_id || 0);
    formData.append('status', loom.status);
    formData.append('rpm', loom.rpm);
    formData.append('current_meters', loom.current_meters);
    formData.append('warp_total', loom.warp_total);
    formData.append('lot_no', loom.lot_no);
    formData.append('type', loom.type);
    formData.append('work_hours', loom.work_hours);
    formData.append('frames', loom.frames);
    formData.append('warp_yarn', loom.warp_yarn);
    formData.append('weft_yarn', loom.weft_yarn);
    formData.append('width', loom.width);
    formData.append('location', loom.location);
    formData.append('warp_start_date', loom.warp_start_date);
    formData.append('notes', note);

    await fetch('api.php?action=looms', { method: 'POST', body: formData });
    toast(loom.name + ' notu güncellendi');
  } catch (e) { toast(e.message, 'error'); }
}

function importProductsExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv, .xlsx, .xls';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const dataArr = new Uint8Array(event.target.result);
        const workbook = XLSX.read(dataArr, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) return toast('Dosya boş veya başlık yok', 'error');

        const headers = json[0].map(h => String(h || '').trim().toLowerCase());
        const data = json.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => {
            const val = String(row[i] || '').trim();
            if (h.includes('kod')) obj.code = val;
            else if (h.includes('ad')) obj.name = val;
            else if (h.includes('kuma')) {
              const ft = fabricTypes.find(f => f.name.toLowerCase() === val.toLowerCase());
              obj.fabric_type_id = ft ? ft.id : 0;
            }
            else if (h.includes('sıkl')) obj.density = val;
            else if (h.includes('birim')) obj.unit = val;
            else if (h.includes('tedarik')) obj.supplier = val;
            else if (h.includes('komp')) obj.composition = val;
          });
          return obj;
        }).filter(o => o.code && o.name);

        if (!data.length) {
          toast('Geçerli veri bulunamadı. Lütfen kolon başlıklarını kontrol edin.', 'warning');
          return;
        }

        // Native confirm yerine özel modal açalım (Tarayıcı engellemesini önlemek için)
        openModal('İçe Aktarma Önizleme', `
          <div style="margin-bottom:15px; font-size:13px; color:var(--text2)">
            Toplam <strong>${data.length}</strong> ürün bulundu. Yüklemek istediğinizden emin misiniz?
          </div>
          <div style="max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; margin-bottom:15px">
            <table style="width:100%; font-size:11px">
              <thead style="position:sticky; top:0; background:var(--surface2)">
                <tr><th>Kod</th><th>Ad</th><th>Kumaş</th></tr>
              </thead>
              <tbody>
                ${data.slice(0, 10).map(o => `<tr><td>${o.code}</td><td>${o.name}</td><td>${o.density || '-'}</td></tr>`).join('')}
                ${data.length > 10 ? `<tr><td colspan="3" style="text-align:center; color:var(--accent)">... ve ${data.length - 10} ürün daha</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">İptal</button>
            <button class="btn btn-primary" id="confirmBulkImport">Onayla ve Yükle</button>
          </div>
        `);

        document.getElementById('confirmBulkImport').onclick = async () => {
          const btn = document.getElementById('confirmBulkImport');
          btn.disabled = true;
          btn.textContent = 'Yükleniyor...';
          try {
            await api('products_bulk', { data: JSON.stringify(data) }, 'POST');
            closeModal();
            toast('Ürünler başarıyla yüklendi.');
            loadProducts();
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
async function previewCustomerReport(customerId) {
  try {
    const c = customers.find(x => x.id === customerId);
    if (!c) return;

    openModal(`${c.name} — Cari Hesap Özeti`, `
      <div style="padding:20px; text-align:center"><div class="spinner"></div><br>Veriler gruplanıyor...</div>
    `, '1000px');

    const res = await api('customer_summary', { id: customerId });
    const { entries, shipments } = res;

    // Gruplama Fonksiyonu (Tarih ve Ürüne göre)
    const groupData = (list, dateField) => {
      const groups = {};
      list.forEach(item => {
        const dateRaw = item[dateField] || '';
        const dateStr = dateRaw ? new Date(dateRaw).toLocaleDateString('tr-TR') : '-';
        const key = `${dateStr}|${item.product_name}`;
        if (!groups[key]) {
          groups[key] = {
            date: dateStr,
            product: item.product_name,
            total_m: 0,
            total_kg: 0,
            count: 0
          };
        }
        groups[key].total_m += parseFloat(item.length_m || 0);
        groups[key].total_kg += parseFloat(item.weight_kg || 0);
        groups[key].count++;
      });
      return Object.values(groups).sort((a, b) => {
        const da = a.date.split('.').reverse().join('');
        const db = b.date.split('.').reverse().join('');
        return db.localeCompare(da); // Son tarihler üstte
      });
    };

    const groupedEntries = groupData(entries, 'control_date');
    const groupedShipments = groupData(shipments, 'shipment_date');

    let html = `
      <div class="report-container" id="printableCariReport" style="background:white; color:#333; padding:40px; font-family:sans-serif">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #333; padding-bottom:15px; margin-bottom:20px">
          <div>
            <h2 style="margin:0; color:#000">${c.name}</h2>
            <p style="margin:5px 0; color:#666">Cari Hesap ve Stok Özeti (Tarih Bazlı Özet)</p>
          </div>
          <div style="text-align:right">
            <p style="margin:0"><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
            <p style="margin:5px 0"><strong>Rapor No:</strong> CHR-${customerId}-${Date.now().toString().slice(-4)}</p>
          </div>
        </div>

        <div style="margin-bottom:30px">
          <h3 style="background:#f4f4f4; padding:8px; border-left:4px solid #7c5cfc; margin-bottom:10px">📥 GELEN ÜRÜN ÖZETİ (Girişler)</h3>
          <div style="overflow-x:auto">
            <table style="width:100%; border-collapse:collapse; font-size:14px; min-width:800px">
              <thead>
                <tr style="background:#eee">
                  <th style="border:1px solid #ddd; padding:10px; text-align:left">Tarih</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:left">Ürün Adı</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:center">Top Adedi</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:center">Toplam Metraj (MT)</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:center">Toplam Kilo (KG)</th>
                </tr>
              </thead>
              <tbody>
                ${groupedEntries.length ? groupedEntries.map(g => `
                  <tr>
                    <td style="border:1px solid #ddd; padding:10px">${g.date}</td>
                    <td style="border:1px solid #ddd; padding:10px"><strong>${g.product}</strong></td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center">${g.count} Adet</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center"><strong>${g.total_m.toFixed(1)} mt</strong></td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center">${g.total_kg.toFixed(1)} kg</td>
                  </tr>
                `).join('') : '<tr><td colspan="5" style="text-align:center; padding:15px">Giriş kaydı bulunamadı.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom:30px">
          <h3 style="background:#f4f4f4; padding:8px; border-left:4px solid #00d4aa; margin-bottom:10px">📤 GİDEN ÜRÜN ÖZETİ (Sevkiyatlar)</h3>
          <div style="overflow-x:auto">
            <table style="width:100%; border-collapse:collapse; font-size:14px; min-width:800px">
              <thead>
                <tr style="background:#eee">
                  <th style="border:1px solid #ddd; padding:10px; text-align:left">Sevkiyat Tarihi</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:left">Ürün Adı</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:center">Top Adedi</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:center">Toplam Metraj (MT)</th>
                  <th style="border:1px solid #ddd; padding:10px; text-align:center">Toplam Kilo (KG)</th>
                </tr>
              </thead>
              <tbody>
                ${groupedShipments.length ? groupedShipments.map(g => `
                  <tr>
                    <td style="border:1px solid #ddd; padding:10px">${g.date}</td>
                    <td style="border:1px solid #ddd; padding:10px"><strong>${g.product}</strong></td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center">${g.count} Adet</td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center"><strong>${g.total_m.toFixed(1)} mt</strong></td>
                    <td style="border:1px solid #ddd; padding:10px; text-align:center">${g.total_kg.toFixed(1)} kg</td>
                  </tr>
                `).join('') : '<tr><td colspan="5" style="text-align:center; padding:15px">Sevkiyat kaydı bulunamadı.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:50px; border-top:1px dashed #ccc; padding-top:20px; font-size:11px; color:#999; text-align:center">
          Bu rapor DokumaQC sistemi tarafından otomatik oluşturulmuştur.
        </div>
      </div>
      <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; padding:20px; background:#f9f9f9; border-top:1px solid #eee">
        <button class="btn btn-secondary" onclick="closeModal()">Kapat</button>
        <button class="btn btn-primary" onclick="printCariReport()">🖨️ PDF / Yazdır</button>
      </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
  } catch (e) {
    toast(e.message, 'error');
    closeModal();
  }
}

function printCariReport() {
  const content = document.getElementById('printableCariReport').innerHTML;
  const win = window.open('', '', 'height=700,width=900');
  win.document.write('<html><head><title>Cari Hareket Raporu</title>');
  win.document.write('<style>body{font-family:sans-serif;padding:20px} table{width:100%;border-collapse:collapse;margin-bottom:20px} th,td{border:1px solid #ddd;padding:10px;font-size:13px} th{background:#eee}</style>');
  win.document.write('</head><body>');
  win.document.write(content);
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

async function toggleWarpSpare(id) {
  try {
    const res = await api('toggle_warp_spare', { id }, 'POST');
    if (res.success) {
      toast(`Yedek Çözgü: ${res.new_status}`, 'success');
      loadLooms();
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleLoomStatus(id) {
  const labels = { 'çalışıyor': '🟢 AKTİF', 'durdu': '🔴 DURDU', 'bekliyor': '🟡 BEKLİYOR', 'arıza': '🟠 ARIZA' };
  try {
    const res = await api('toggle_loom_status', { id }, 'POST');
    if (res.success) {
      toast(`Tezgah Durumu: ${labels[res.new_status] || res.new_status}`, res.new_status === 'çalışıyor' ? 'success' : 'warning');
      loadLooms();
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════
//  GANTT PLANLAMA
// ═══════════════════════════════
async function loadLoomGantt() {
  const content = document.getElementById('contentArea');
  content.innerHTML = '<div class="spinner"></div>';

  try {
    const [lRes, oRes, pRes] = await Promise.all([api('looms'), api('orders'), api('products')]);
    const looms = lRes.data || [];
    const orders = oRes.data || [];

    if (!looms.length) {
      content.innerHTML = '<div style="text-align:center;padding:60px"><div style="font-size:48px;margin-bottom:12px">📊</div><div style="color:var(--text3)">Tezgah bulunamadı</div><button class="btn btn-primary" style="margin-top:12px" onclick="openLoomModal()">+ Yeni Tezgah</button></div>';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = 60;
    const dayWidth = 44;
    const leftPanelWidth = 420;
    const totalWidth = days * dayWidth;

    const headerDates = [];
    const headerWeekdays = [];
    const isWeekendArr = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      headerDates.push(d);
      headerWeekdays.push(d.toLocaleDateString('tr-TR', { weekday: 'short' }));
      isWeekendArr.push(d.getDay() === 0 || d.getDay() === 6);
    }

    const loomData = looms.map(l => {
      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, (l.warp_total || 0) - consumed);
      const density = parseFloat(l.product_density || 0);
      const rpm = parseFloat(l.rpm || 0);
      const workHours = parseFloat(l.work_hours || 24);

      let dailyProd = 0;
      if (rpm > 0 && density > 0) {
        const mph = (rpm * 60) / (density * 100);
        dailyProd = mph * workHours * 0.85;
      }

      let finishDays = 999;
      let finishDate = null;
      if (dailyProd > 0 && remaining > 0) {
        finishDays = Math.min(remaining / dailyProd, 999);
        finishDate = new Date(today);
        finishDate.setDate(finishDate.getDate() + Math.ceil(finishDays));
      }

      const progress = l.warp_total > 0 ? Math.min(100, (consumed / l.warp_total) * 100) : 0;
      const barLength = dailyProd > 0 ? Math.min(days, finishDays) : 0;

      let barColor = 'var(--text3)';
      let barBg = 'rgba(85,93,118,.2)';

      if (l.status === 'çalışıyor') {
        if (progress >= 100) {
          barColor = 'var(--accent)';
          barBg = 'rgba(0,212,170,.3)';
        } else if (finishDays <= 7) {
          barColor = 'var(--warning)';
          barBg = 'rgba(255,179,71,.3)';
        } else if (dailyProd > 0) {
          barColor = 'var(--accent)';
          barBg = 'rgba(0,212,170,.25)';
        }
      } else if (l.status === 'durdu' || l.status === 'arıza') {
        barColor = 'var(--danger)';
        barBg = 'rgba(255,92,108,.2)';
      } else if (l.status === 'bekliyor') {
        barColor = 'var(--text3)';
        barBg = 'rgba(85,93,118,.15)';
      }

      const order = orders.find(o => o.id == l.order_id);

      return {
        ...l,
        consumed,
        remaining,
        dailyProd,
        finishDays: finishDays >= 999 ? '∞' : finishDays.toFixed(1),
        finishDate: finishDate ? finishDate.toLocaleDateString('tr-TR') : '—',
        progress: progress.toFixed(0),
        barLength,
        barColor,
        barBg,
        orderNo: order ? order.order_no : '',
        orderCustomer: order ? order.customer_name : ''
      };
    });

    const summaryCards = loomData.filter(l => l.status === 'çalışıyor').map(l => {
      return `
        <div style="padding:10px 14px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);min-width:160px">
          <div style="font-size:9px;color:var(--text3);font-weight:700;margin-bottom:4px">${l.name}</div>
          <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px">${l.product_code || '—'} ${l.product_name || ''}</div>
          <div style="font-size:10px;color:var(--text2)">Kalan: <strong style="color:var(--warning)">${l.remaining.toFixed(0)} mt</strong></div>
          <div style="font-size:10px;color:var(--text2)">Günlük: <strong style="color:var(--accent)">${l.dailyProd.toFixed(0)} mt</strong></div>
          <div style="font-size:10px;color:var(--text2)">Bitiş: <strong style="color:${l.finishDays === '∞' ? 'var(--text3)' : 'var(--text)'}">${l.finishDate}</strong></div>
          ${l.orderNo ? `<div style="font-size:9px;color:var(--accent);margin-top:3px">📋 ${l.orderNo}</div>` : ''}
        </div>
      `;
    }).join('');

    let ganttHTML = '';
    ganttHTML += '<div style="min-width:' + (leftPanelWidth + totalWidth) + 'px">';

    ganttHTML += '<div style="display:flex;border-bottom:2px solid var(--border)">';
    ganttHTML += '<div style="width:' + leftPanelWidth + 'px;flex-shrink:0;padding:8px 12px;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;border-right:1px solid var(--border);background:var(--surface2)">TEZGAH</div>';
    ganttHTML += '<div style="flex:1">';
    ganttHTML += '<div style="display:flex">';
    for (let i = 0; i < days; i++) {
      const bg = isWeekendArr[i] ? 'rgba(255,92,108,.06)' : 'transparent';
      const clr = isWeekendArr[i] ? 'var(--danger)' : 'var(--text3)';
      const fw = i === 0 ? '800' : '600';
      const bdr = i === 0 ? 'var(--accent)' : 'var(--border)';
      ganttHTML += '<div style="width:' + dayWidth + 'px;flex-shrink:0;text-align:center;padding:6px 0;border-right:1px solid ' + bdr + ';background:' + bg + ';color:' + clr + ';font-weight:' + fw + '">';
      ganttHTML += '<div style="font-size:11px">' + headerDates[i].getDate() + '</div>';
      ganttHTML += '<div style="font-size:8px;opacity:.6">' + headerWeekdays[i] + '</div>';
      ganttHTML += '</div>';
    }
    ganttHTML += '</div></div></div>';

    const rows = loomData.map(l => {
      const barW = Math.max(4, l.barLength * dayWidth);

      let rowHTML = '';
      rowHTML += '<div style="display:flex;border-bottom:1px solid var(--border);min-height:38px">';

      rowHTML += '<div style="width:' + leftPanelWidth + 'px;flex-shrink:0;padding:6px 12px;display:flex;align-items:center;gap:8px;border-right:1px solid var(--border);background:' + (l.status !== 'çalışıyor' ? 'var(--surface)' : 'transparent') + '">';
      rowHTML += '<div style="flex:1;min-width:0">';
      rowHTML += '<div style="display:flex;align-items:center;gap:6px">';
      rowHTML += '<span style="font-weight:700;font-size:12px;color:var(--text)">' + l.name + '</span>';
      let dot = '●', dotClr = 'var(--accent)';
      if (l.status === 'durdu' || l.status === 'arıza') { dot = '■'; dotClr = 'var(--danger)'; }
      else if (l.status === 'bekliyor') { dot = '○'; dotClr = 'var(--text3)'; }
      rowHTML += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + dotClr.replace('var(--', 'rgba(').replace('accent)', '0,212,170,.15)').replace('danger)', '255,92,108,.15)').replace('text3)', '85,93,118,.15)') + ';color:' + dotClr + ';font-weight:600">' + dot + '</span>';
      rowHTML += '</div>';
      rowHTML += '<div style="font-size:10px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (l.product_code || '—') + ' ' + (l.product_name || '') + '</div>';
      rowHTML += '<div style="font-size:9px;color:var(--text3);margin-top:1px">Kalan: <strong style="color:var(--warning)">' + l.remaining.toFixed(0) + '</strong> | Bitiş: <strong style="color:' + (l.finishDays === '∞' ? 'var(--text3)' : 'var(--text)') + '">' + l.finishDate + '</strong></div>';
      rowHTML += '</div></div>';

      rowHTML += '<div style="flex:1;position:relative">';
      rowHTML += '<div style="display:flex;height:38px">';
      for (let i = 0; i < days; i++) {
        const bdr = isWeekendArr[i] ? 'rgba(42,48,64,.4)' : 'rgba(42,48,64,.2)';
        const bg = isWeekendArr[i] ? 'rgba(255,92,108,.04)' : 'transparent';
        rowHTML += '<div style="width:' + dayWidth + 'px;flex-shrink:0;border-right:1px solid ' + bdr + ';background:' + bg + '"></div>';
      }
      rowHTML += '</div>';
      rowHTML += '<div style="position:absolute;top:0;left:0;height:38px;display:flex;align-items:center;padding:0 8px;z-index:2">';
      rowHTML += '<div style="width:' + barW + 'px;height:20px;border-radius:4px;background:' + l.barBg + ';border:1px solid ' + l.barColor + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:' + l.barColor + ';overflow:hidden;white-space:nowrap">';
      rowHTML += (l.remaining > 0 ? l.progress + '%' : '✓') + '</div>';
      rowHTML += '</div>';
      rowHTML += '<div style="position:absolute;top:0;left:0;width:1px;height:38px;background:var(--accent);opacity:.4;z-index:3"></div>';
      rowHTML += '</div></div>';

      return rowHTML;
    }).join('');

    ganttHTML += rows;
    ganttHTML += '</div>';

    content.innerHTML = `
      <div class="filter-bar">
        <button class="btn btn-secondary btn-sm" onclick="loadLooms()">⬅ Kart Görünümü</button>
        <div style="font-size:13px;color:var(--text3);font-weight:500;margin-left:10px">📊 Gantt Planlama — 60 Gün</div>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(0,212,170,.15);color:var(--accent)">● Çalışıyor</span>
          <span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(255,179,71,.15);color:var(--warning)">● 7 Günden Az</span>
          <span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(255,92,108,.15);color:var(--danger)">■ Durdu/Arıza</span>
          <span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(85,93,118,.15);color:var(--text3)">○ Bekliyor</span>
        </div>
      </div>
      
      <div style="display:flex;gap:12px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">
        ${summaryCards}
      </div>
      
      <div class="panel" style="padding:0">
        <div style="overflow-x:auto;max-height:calc(100vh - 280px);overflow-y:auto;border:1px solid var(--border);border-radius:8px" id="ganttScroll">
          ${ganttHTML}
        </div>
      </div>
    `;

    const ganttScroll = document.getElementById('ganttScroll');
    if (ganttScroll) {
      ganttScroll.scrollLeft = Math.max(0, leftPanelWidth - 60);
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ── Program Alıcıları Fonksiyonları (Sadece Süper Admin) ──
async function loadProgramBuyers() {
  try {
    const res = await api('program_buyers');
    const list = document.getElementById('programBuyerList');
    if (!res.data || !res.data.length) {
      list.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Kayıtlı program alıcısı yok</td></tr>';
      return;
    }
    list.innerHTML = res.data.map(b => `
      <tr>
        <td style="font-weight:500;color:var(--text)">${b.customer_name}</td>
        <td style="font-family:monospace;color:var(--accent)">${b.internal_barcode_start || '-'}</td>
        <td style="font-family:monospace;color:var(--warning)">${b.external_barcode_start || '-'}</td>
        <td style="font-size:11px;color:var(--text2)">${b.sale_date || '-'}</td>
        <td style="font-size:11px;color:var(--text3)">${b.notes || '-'}</td>
        <td style="text-align:right">
          <div style="display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn-sm btn-secondary" onclick="editProgramBuyer(${b.id}, '${b.customer_name}', '${b.internal_barcode_start || ''}', '${b.external_barcode_start || ''}', '${b.sale_date || ''}', '${b.notes || ''}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProgramBuyer(${b.id})">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function saveProgramBuyer(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('pbId').value;
    const data = {
      customer_name: document.getElementById('pbCustomerName').value,
      internal_barcode_start: document.getElementById('pbInternalStart').value,
      external_barcode_start: document.getElementById('pbExternalStart').value,
      sale_date: document.getElementById('pbSaleDate').value,
      notes: document.getElementById('pbNotes').value
    };
    if (id) data.id = id;
    await api('program_buyers', data, 'POST');
    toast('✅ Kaydedildi');
    resetProgramBuyerForm();
    loadProgramBuyers();
  } catch (e) { toast(e.message, 'error'); }
}

function editProgramBuyer(id, name, internal, external, saleDate, notes) {
  document.getElementById('pbId').value = id;
  document.getElementById('pbCustomerName').value = name;
  document.getElementById('pbInternalStart').value = internal;
  document.getElementById('pbExternalStart').value = external;
  document.getElementById('pbSaleDate').value = saleDate;
  document.getElementById('pbNotes').value = notes;
  document.getElementById('pbCustomerName').focus();
}

function resetProgramBuyerForm() {
  document.getElementById('pbId').value = '';
  document.getElementById('pbCustomerName').value = '';
  document.getElementById('pbInternalStart').value = '';
  document.getElementById('pbExternalStart').value = '';
  document.getElementById('pbSaleDate').value = '';
  document.getElementById('pbNotes').value = '';
}

async function deleteProgramBuyer(id) {
  if (!confirm('Bu program alıcısını silmek istediğinize emin misiniz?')) return;
  try {
    await api('program_buyer_delete', { id }, 'POST');
    toast('🗑 Silindi');
    loadProgramBuyers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteTransaction(id, customerId) {
  if (!confirm('Bu işlemi silmek istediğinizden emin misiniz? \n(Fatura silinirse bağlı çeki listeleri tekrar boşa çıkar)')) return;

  try {
    await api('delete_transaction', { id }, 'POST');
    toast('İşlem başarıyla silindi', 'success');
    openCustomerFinances(customerId);
    loadCustomers();
  } catch (e) { toast(e.message, 'error'); }
}

function printCustomerStatement(customerId) {
  const c = customers.find(x => x.id === customerId);
  const name = c ? c.name : 'Cari';

  const tbody = document.getElementById('customerTxBody');
  if (!tbody) return toast('Tablo bulunamadı.', 'error');

  let rows = Array.from(tbody.querySelectorAll('tr')).map(tr => {
    let clone = tr.cloneNode(true);
    let lastTd = clone.querySelector('td:last-child');
    if (lastTd && lastTd.querySelector('button')) lastTd.innerHTML = '';
    return clone.innerHTML;
  }).join('</tr><tr>');

  if (!rows || rows.includes('Henüz bir')) {
    return toast('Yazdırılacak hareket bulunmuyor.', 'info');
  }

  // Bakiyeleri hesapla
  const balances = {};
  tbody.querySelectorAll('tr').forEach(tr => {
    const amountTd = tr.querySelector('td:nth-last-child(2)');
    if (!amountTd) return;
    const txt = amountTd.innerText; // Örn: "+1.250,00 $"
    const amount = parseFloat(txt.replace(/[^-0-9,]/g, '').replace(',', '.'));
    const cur = txt.split(' ').pop(); // $, €, ₺

    if (!balances[cur]) balances[cur] = 0;
    balances[cur] += amount;
  });

  let balancesHTML = '';
  Object.keys(balances).forEach(cur => {
    const val = balances[cur];
    balancesHTML += `
      <div class="balance-box" style="margin-left:10px">
        <div class="balance-label">${cur} Bakiyesi</div>
        <div class="balance-val">${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(Math.abs(val))} ${cur} ${val > 0 ? '(B)' : val < 0 ? '(A)' : ''}</div>
      </div>
    `;
  });

  let win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Ekstre - ${name}</title>
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7c5cfc; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 28px; font-weight: 900; color: #7c5cfc; }
          .customer-info { margin-top: 10px; font-size: 16px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th { background: #f8f9fa; text-align: left; padding: 12px; border-bottom: 2px solid #dee2e6; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .footer { margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
          .balance-box { background: #f8f9fa; padding: 10px 20px; border-radius: 8px; border: 1px solid #dee2e6; text-align: right; min-width: 150px; }
          .balance-label { font-size: 10px; color: #666; margin-bottom: 2px; text-transform: uppercase; }
          .balance-val { font-size: 16px; font-weight: 800; color: #7c5cfc; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">CARİ EKSTRE</div>
            <div class="customer-info">${name}</div>
          </div>
          <div style="text-align:right; font-size: 11px; color: #666">
            Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}<br>
            DokumaQC Takip Sistemi
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Tarih</th><th>İşlem Tipi</th><th>Araç</th><th>Açıklama</th><th style="text-align:right">Tutar</th><th style="width:10px"></th></tr>
          </thead>
          <tbody>
            <tr>${rows}</tr>
          </tbody>
        </table>
        <div class="footer">
          ${balancesHTML}
        </div>
        <div class="no-print" style="margin-top:40px; text-align:center">
          <button onclick="window.print()" style="padding:12px 30px; background:#7c5cfc; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(124,92,252,0.3)">🖨️ Sayfayı Yazdır</button>
        </div>
      </body>
    </html>
  `);
  win.document.close();
}

async function printLoomProductionReport() {
  try {
    const [lRes, oRes] = await Promise.all([api('looms'), api('orders')]);
    const looms = lRes.data || [];
    const orders = oRes.data || [];

    if (!looms.length) {
      toast('Yazdırılacak tezgah verisi bulunamadı', 'warning');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalEff = 0, effCount = 0, totalDaily = 0, totalRemainingWarp = 0, activeCount = 0;

    const loomData = looms.map(l => {
      const density = parseFloat(l.product_density || 0);
      const rpm = parseFloat(l.rpm || 0);
      const workHours = parseFloat(l.work_hours || 24);
      const minsPassed = Math.max(1, l.mins_passed || 1);

      let effValue = 0, theoretical = 0;
      if (l.last_efficiency !== null) {
        effValue = parseFloat(l.last_efficiency);
        if (rpm > 0 && density > 0) theoretical = (rpm * minsPassed) / (density * 100);
      } else if (rpm > 0 && density > 0) {
        theoretical = (rpm * minsPassed) / (density * 100);
        effValue = theoretical > 0 ? Math.min(100, (parseFloat(l.daily_meters || 0) / theoretical) * 100) : 0;
      }

      if (l.status === 'çalışıyor') { totalEff += effValue; effCount++; activeCount++; }
      totalDaily += parseFloat(l.daily_meters || 0);

      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, l.warp_total - consumed);
      totalRemainingWarp += remaining;

      let dailyProd = 0;
      if (rpm > 0 && density > 0) {
        dailyProd = ((rpm * 60) / (density * 100)) * workHours * 0.85;
      }

      let finishDays = null, finishDate = null;
      if (dailyProd > 0 && remaining > 0) {
        finishDays = remaining / dailyProd;
        const fd = new Date(today);
        fd.setDate(fd.getDate() + Math.ceil(finishDays));
        finishDate = fd;
      }

      let warpYarnDisplay = l.warp_yarn || '-', weftYarnDisplay = l.weft_yarn || '-';
      if (l.product_tech) {
        try {
          const td = JSON.parse(l.product_tech);
          if (td.warpList && td.warpList.length) warpYarnDisplay = td.warpList.join(', ');
          if (td.weftList && td.weftList.length) weftYarnDisplay = td.weftList.join(', ');
        } catch (e) {}
      }

      const order = orders.find(o => o.id == l.order_id);
      const orderNo = order ? order.order_no : '-';
      const orderQty = order ? parseFloat(order.quantity_m || 0) : 0;
      const orderProduced = order ? (parseFloat(order.shipped_m || 0) + parseFloat(order.ready_m || 0)) : 0;

      return { ...l, _eff: effValue, _theoretical: theoretical, _consumed: consumed, _remaining: remaining, _dailyProd: dailyProd, _finishDays: finishDays, _finishDate: finishDate, _warpYarn: warpYarnDisplay, _weftYarn: weftYarnDisplay, _orderNo: orderNo, _orderQty: orderQty, _orderProduced: orderProduced, _orderRemaining: Math.max(0, orderQty - orderProduced), _density: density };
    });

    const avgEff = effCount > 0 ? totalEff / effCount : 0;

    const activeOrders = orders.filter(o => o.status === 'Açık' && loomData.some(l => l.order_id == o.id));
    const orderSummaryRows = activeOrders.map(o => {
      const assigned = loomData.filter(l => l.order_id == o.id);
      const produced = parseFloat(o.shipped_m || 0) + parseFloat(o.ready_m || 0);
      const remaining = Math.max(0, parseFloat(o.quantity_m || 0) - produced);
      const pct = o.quantity_m > 0 ? ((produced / o.quantity_m) * 100).toFixed(1) : 0;
      return '<tr><td style="padding:4px 8px;font-weight:700;color:#7c5cfc">' + o.order_no + '</td><td style="padding:4px 8px">' + (o.customer_name || '-') + '</td><td style="padding:4px 8px">' + (o.product_code || '-') + '</td><td style="padding:4px 8px">' + assigned.map(l => l.name).join(', ') + '</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + fmt(produced, 0) + ' mt</td><td style="padding:4px 8px;text-align:right;color:' + (remaining > 0 ? '#e6a800' : '#00d4aa') + '">' + fmt(remaining, 0) + ' mt (%' + pct + ')</td></tr>';
    }).join('');

    const loomCards = loomData.map(l => {
      const effColor = l._eff >= 85 ? '#00d4aa' : (l._eff >= 70 ? '#e6a800' : '#ff5c6c');
      const statusLabel = l.status === 'çalışıyor' ? 'AKTİF' : (l.status === 'durdu' ? 'DURDU' : (l.status === 'arıza' ? 'ARIZA' : 'BEKLİYOR'));
      const statusColor = l.status === 'çalışıyor' ? '#00d4aa' : (l.status === 'durdu' ? '#ff5c6c' : '#888');
      const warpPct = l.warp_total > 0 ? ((l._consumed / l.warp_total) * 100).toFixed(1) : 0;
      const spareIcon = l.warp_spare_status === 'Hazır' ? '✅' : (l.warp_spare_status === 'Hazırlanıyor' ? '⏳' : '❌');
      const spareColor = l.warp_spare_status === 'Hazır' ? '#00d4aa' : (l.warp_spare_status === 'Hazırlanıyor' ? '#e6a800' : '#888');
      const orderPct = l._orderQty > 0 ? Math.min(100, (l._orderProduced / l._orderQty) * 100) : 0;
      const finishLabel = l._finishDate ? l._finishDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
      const finishExtra = l._finishDays !== null ? ' (' + l._finishDays.toFixed(1) + ' gün)' : '';
      const finishColor = l._finishDays !== null && l._finishDays <= 3 ? '#ff5c6c' : '#00d4aa';

      return '<div class="lcard" style="page-break-inside:avoid;border:1px solid #ddd;border-radius:4px;margin-bottom:0;overflow:hidden">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:#f8f9fc;border-bottom:2px solid ' + statusColor + '">'
        + '<div style="display:flex;align-items:center;gap:4px">'
        + '<span style="font-size:10px;font-weight:900;color:#1a1a2e">' + l.name + '</span>'
        + '<span style="font-size:7px;font-weight:800;padding:1px 4px;border-radius:3px;background:' + statusColor + '20;color:' + statusColor + '">' + statusLabel + '</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:4px">'
        + '<span style="font-size:10px;font-weight:800;color:' + effColor + '">%' + l._eff.toFixed(1) + '</span>'
        + '<span style="font-size:6px;color:#888">Rd</span>'
        + '</div></div>'

        + '<div style="padding:3px 6px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:7px">'

        + '<div>'
        + '<div><span style="color:#888;font-weight:600">Kalite:</span> <span style="font-weight:700">' + (l.product_code || '-') + ' ' + (l.product_name ? l.product_name.substring(0, 12) : '') + '</span></div>'
        + '<div><span style="color:#888;font-weight:600">Lot:</span> <span style="font-weight:700;color:#e6a800">' + (l.lot_no || '-') + '</span></div>'
        + '<div><span style="color:#888;font-weight:600">Musteri:</span> <span style="font-weight:700">' + (l.customer_name || '-') + '</span></div>'
        + '<div><span style="color:#888;font-weight:600">Siparis:</span> <span style="font-weight:700;color:#7c5cfc">' + l._orderNo + '</span></div>'
        + '</div>'

        + '<div>'
        + '<div><span style="color:#888;font-weight:600">Hiz/Siklik:</span> <span style="font-weight:700">' + (l.rpm || 0) + '/' + (l._density || 0) + '</span></div>'
        + '<div><span style="color:#888;font-weight:600">En:</span> <span style="font-weight:700">' + (l.width || 0) + ' cm</span></div>'
        + '<div><span style="color:#888;font-weight:600">Cozgu:</span> <span style="font-weight:700;font-size:6.5px">' + l._warpYarn + '</span></div>'
        + '<div><span style="color:#888;font-weight:600">Atki:</span> <span style="font-weight:700;font-size:6.5px">' + l._weftYarn + '</span></div>'
        + '</div></div>'

        + '<div style="padding:2px 6px;border-top:1px solid #eee;display:flex;flex-wrap:wrap;gap:2px 8px;font-size:6.5px">'
        + '<span><span style="color:#888">Cozgu:</span> <span style="font-weight:700">' + fmt(l.warp_total,0) + ' mt</span> <span style="color:#888">|</span> <span style="color:#888">Kalan:</span> <span style="font-weight:700;color:' + (l._remaining < 200 ? '#ff5c6c' : '#1a1a2e') + '">' + fmt(l._remaining,0) + ' mt</span> <span style="color:#888">(%' + warpPct + ')</span></span>'
        + '<span><span style="color:#888">Yedek:</span> <span style="font-weight:700;color:' + spareColor + '">' + spareIcon + ' ' + (l.warp_spare_status || 'Yok') + '</span></span>'
        + '<span><span style="color:#888">Bugun:</span> <span style="font-weight:700">' + fmt(l.daily_meters,0) + '</span> <span style="color:#888">/</span> <span style="font-weight:700;color:#888">' + fmt(l._theoretical,0) + ' mt</span></span>'
        + '<span><span style="color:#888">Bitis:</span> <span style="font-weight:700;color:' + finishColor + '">' + finishLabel + finishExtra + '</span></span>'
        + '</div>'

        + (l._orderQty > 0 ? '<div style="padding:2px 6px;border-top:1px solid #eee;display:flex;align-items:center;gap:4px;font-size:6.5px">'
          + '<span style="color:#888;font-weight:600;white-space:nowrap">Siparis:</span>'
          + '<span style="font-weight:600">' + fmt(l._orderProduced,0) + '/' + fmt(l._orderQty,0) + ' mt</span>'
          + '<span style="color:#888">Kaldi:</span><span style="font-weight:700;color:' + (l._orderRemaining > 0 ? '#e6a800' : '#00d4aa') + '">' + fmt(l._orderRemaining,0) + ' mt</span>'
          + '<div style="flex:1;height:5px;background:#eee;border-radius:3px;overflow:hidden;max-width:60px">'
          + '<div style="background:#7c5cfc;height:100%;width:' + orderPct + '%;border-radius:3px"></div></div>'
          + '<span style="color:#888">%' + orderPct.toFixed(1) + '</span>'
          + '</div>' : '')

        + (l.next_product_name ? '<div style="padding:2px 6px;background:#fff8e6;border-top:1px dashed #e6a800;font-size:6.5px">'
          + '<span style="color:#888;font-weight:600">📅 Sıradaki:</span>'
          + '<span style="font-weight:700;color:#1a1a2e"> ' + (l.next_product_code || '') + ' ' + l.next_product_name + '</span>'
          + (l.next_order_no ? '<span style="color:#888"> | ' + l.next_order_no + '</span>' : '')
          + (l.next_customer_name ? '<span style="color:#888"> | ' + l.next_customer_name + '</span>' : '')
          + '</div>' : '')

        + '</div>';
    }).join('');

    const reportDate = new Date().toLocaleDateString('tr-TR');
    const reportTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
      toast('Pop-up engellendi. Lutfen tarayici pop-up engelleyicisini devre disi birakin.', 'warning');
      return;
    }

    win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tezgah Uretim Raporu</title>'
      + '<style>'
      + '@page { size: A4 landscape; margin: 5mm; }'
      + '* { box-sizing: border-box; margin: 0; padding: 0; }'
      + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 8px; color: #1a1a2e; background: #fff; padding: 0; margin: 0; }'
      + '.header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #1a1a2e; color: #fff; border-radius: 4px 4px 0 0; margin-bottom: 5px; }'
      + '.header h1 { font-size: 13px; font-weight: 800; letter-spacing: 1px; }'
      + '.header .date { font-size: 8px; color: rgba(255,255,255,0.7); }'
      + '.loom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }'
      + '.kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 5px; }'
      + '.kpi-box { padding: 4px 6px; background: #f8f9fc; border-radius: 4px; border: 1px solid #eee; text-align: center; }'
      + '.kpi-box .kpi-label { font-size: 6px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }'
      + '.kpi-box .kpi-val { font-size: 12px; font-weight: 900; margin-top: 1px; }'
      + '.kpi-box .kpi-sub { font-size: 6px; color: #888; }'
      + '.sec-title { font-size: 8px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 1px; padding: 3px 0 2px 0; border-bottom: 2px solid #1a1a2e; margin-bottom: 4px; margin-top: 5px; }'
      + '.order-table { width: 100%; border-collapse: collapse; font-size: 7px; margin-bottom: 6px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }'
      + '.order-table th { background: #f0f1f5; padding: 3px 6px; text-align: left; font-size: 6px; font-weight: 700; text-transform: uppercase; color: #888; border-bottom: 2px solid #ddd; }'
      + '.order-table td { padding: 2px 6px; border-bottom: 1px solid #eee; }'
      + '.order-table tr:last-child td { border-bottom: none; }'
      + '.footer { text-align: center; padding: 6px; font-size: 6px; color: #aaa; border-top: 1px solid #eee; margin-top: 6px; }'
      + '.np { display: block; text-align: center; margin-top: 10px; padding: 10px; }'
      + '.np button { padding: 8px 24px; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }'
      + '.np .btn-print { background: #7c5cfc; color: #fff; margin-right: 10px; }'
      + '.np .btn-close { background: #f0f1f5; color: #666; }'
      + '@media print { .np { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
      + '</style></head><body>'

      + '<div class="header"><div><h1>DOKUMA URETIM RAPORU</h1></div><div class="date">' + reportDate + ' ' + reportTime + '</div></div>'

      + '<div class="kpi-row">'
      + '<div class="kpi-box"><div class="kpi-label">Toplam Tezgah</div><div class="kpi-val">' + looms.length + '</div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Aktif / Duran</div><div class="kpi-val"><span style="color:#00d4aa">' + activeCount + '</span><span style="color:#888"> / </span><span style="color:#ff5c6c">' + (looms.length - activeCount) + '</span></div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Ort. Randiman</div><div class="kpi-val" style="color:' + (avgEff >= 85 ? '#00d4aa' : (avgEff >= 70 ? '#e6a800' : '#ff5c6c')) + '">%' + avgEff.toFixed(1) + '</div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Gunluk Uretim</div><div class="kpi-val">' + fmt(totalDaily, 0) + '</div><div class="kpi-sub">metre</div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Kalan Cozgu</div><div class="kpi-val">' + fmt(totalRemainingWarp, 0) + '</div><div class="kpi-sub">metre</div></div>'
      + '</div>'

      + (activeOrders.length > 0 ? '<div class="sec-title">SIPARIS OZETI</div>'
        + '<table class="order-table"><thead><tr><th>Siparis No</th><th>Musteri</th><th>Urun</th><th>Tezgahlar</th><th style="text-align:right">Uretilen</th><th style="text-align:right">Kalan</th></tr></thead><tbody>'
        + orderSummaryRows + '</tbody></table>' : '')

      + '<div class="sec-title">TEZGAH DETAYLARI</div>'
      + '<div class="loom-grid">' + loomCards + '</div>'

      + '<div class="footer">DokumaQC Takip Sistemi &mdash; ' + reportDate + ' ' + reportTime + '</div>'

      + '<div class="np">'
      + '<button class="btn-print" onclick="window.print()"> Yazdir</button>'
      + '<button class="btn-close" onclick="window.close()"> Kapat</button>'
      + '</div>'

      + '</body></html>');
    win.document.close();
  } catch (e) {
    toast('Rapor olusturulurken hata: ' + e.message, 'error');
  }
}

function choosePrintFormat() {
  openModal('🖨️ Yazdırma Görünümü', '<div style="display:flex;gap:16px;padding:10px 0">'
    + '<button onclick="closeModal();printLoomProductionReport()" style="flex:1;padding:28px 16px;background:var(--surface2);border:2px solid var(--border);border-radius:12px;cursor:pointer;text-align:center;font-family:inherit" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.background=\'var(--surface3)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--surface2)\'">'
    + '<div style="font-size:40px;margin-bottom:10px">🃏</div>'
    + '<div style="font-size:15px;font-weight:700;color:var(--text)">Kart Görünümü</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.4">2 sütunlu kompakt kart tasarımı<br>Görsel detaylı, renkli çıktı</div>'
    + '</button>'
    + '<button onclick="closeModal();printLoomProductionReportTable()" style="flex:1;padding:28px 16px;background:var(--surface2);border:2px solid var(--border);border-radius:12px;cursor:pointer;text-align:center;font-family:inherit" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.background=\'var(--surface3)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--surface2)\'">'
    + '<div style="font-size:40px;margin-bottom:10px">📋</div>'
    + '<div style="font-size:15px;font-weight:700;color:var(--text)">Tablo Görünümü</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.4">Tek sayfaya tüm tezgahlar<br>Kompakt tablo, az kağıt</div>'
    + '</button>'
    + '</div>'
    + '<div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text3)">'
    + '<a href="#" onclick="closeModal()" style="color:var(--text3);text-decoration:none;border-bottom:1px solid var(--text3)">İptal</a>'
    + '</div>', '500px');
}

async function printLoomProductionReportTable() {
  try {
    const [lRes, oRes] = await Promise.all([api('looms'), api('orders')]);
    const looms = lRes.data || [];
    const orders = oRes.data || [];

    if (!looms.length) {
      toast('Yazdırılacak tezgah verisi bulunamadı', 'warning');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalEff = 0, effCount = 0, totalDaily = 0, totalRemainingWarp = 0, activeCount = 0;

    const loomData = looms.map(l => {
      const density = parseFloat(l.product_density || 0);
      const rpm = parseFloat(l.rpm || 0);
      const workHours = parseFloat(l.work_hours || 24);
      const minsPassed = Math.max(1, l.mins_passed || 1);

      let effValue = 0, theoretical = 0;
      if (l.last_efficiency !== null) {
        effValue = parseFloat(l.last_efficiency);
        if (rpm > 0 && density > 0) theoretical = (rpm * minsPassed) / (density * 100);
      } else if (rpm > 0 && density > 0) {
        theoretical = (rpm * minsPassed) / (density * 100);
        effValue = theoretical > 0 ? Math.min(100, (parseFloat(l.daily_meters || 0) / theoretical) * 100) : 0;
      }

      if (l.status === 'çalışıyor') { totalEff += effValue; effCount++; activeCount++; }
      totalDaily += parseFloat(l.daily_meters || 0);

      const consumed = getWarpConsumed(l);
      const remaining = Math.max(0, l.warp_total - consumed);
      totalRemainingWarp += remaining;

      let dailyProd = 0;
      if (rpm > 0 && density > 0) {
        dailyProd = ((rpm * 60) / (density * 100)) * workHours * 0.85;
      }

      let finishDays = null, finishDate = null;
      if (dailyProd > 0 && remaining > 0) {
        finishDays = remaining / dailyProd;
        const fd = new Date(today);
        fd.setDate(fd.getDate() + Math.ceil(finishDays));
        finishDate = fd;
      }

      let warpYarnDisplay = l.warp_yarn || '-', weftYarnDisplay = l.weft_yarn || '-', totalTel = null;
      if (l.product_tech) {
        try {
          const td = JSON.parse(l.product_tech);
          if (td.warpList && td.warpList.length) warpYarnDisplay = td.warpList.join(', ');
          if (td.weftList && td.weftList.length) weftYarnDisplay = td.weftList.join(', ');
          if (td.totalTel) totalTel = td.totalTel;
        } catch (e) {}
      }

      const order = orders.find(o => o.id == l.order_id);
      const orderNo = order ? order.order_no : '-';
      const orderQty = order ? parseFloat(order.quantity_m || 0) : 0;
      const orderProduced = order ? (parseFloat(order.shipped_m || 0) + parseFloat(order.ready_m || 0)) : 0;

      return { ...l, _eff: effValue, _theoretical: theoretical, _consumed: consumed, _remaining: remaining, _dailyProd: dailyProd, _finishDays: finishDays, _finishDate: finishDate, _warpYarn: warpYarnDisplay, _weftYarn: weftYarnDisplay, _totalTel: totalTel, _orderNo: orderNo, _orderQty: orderQty, _orderProduced: orderProduced, _orderRemaining: Math.max(0, orderQty - orderProduced), _density: density };
    });

    const avgEff = effCount > 0 ? totalEff / effCount : 0;

    const tableRows = loomData.map((l, i) => {
      const effColor = l._eff >= 85 ? '#00d4aa' : (l._eff >= 70 ? '#e6a800' : '#ff5c6c');
      const statusLabel = l.status === 'çalışıyor' ? 'AKTİF' : (l.status === 'durdu' ? 'DURDU' : (l.status === 'arıza' ? 'ARIZA' : 'BEKLİYOR'));
      const statusColor = l.status === 'çalışıyor' ? '#00d4aa' : (l.status === 'durdu' ? '#ff5c6c' : '#888');
      const warpPct = l.warp_total > 0 ? ((l._consumed / l.warp_total) * 100).toFixed(1) : '0';
      const spareIcon = l.warp_spare_status === 'Hazır' ? '✅' : (l.warp_spare_status === 'Hazırlanıyor' ? '⏳' : '❌');
      const spareColor = l.warp_spare_status === 'Hazır' ? '#00d4aa' : (l.warp_spare_status === 'Hazırlanıyor' ? '#e6a800' : '#888');
      const finishLabel = l._finishDate ? l._finishDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '-';
      const finishColor = l._finishDays !== null && l._finishDays <= 3 ? '#ff5c6c' : '#888';
      const orderPct = l._orderQty > 0 ? Math.min(100, (l._orderProduced / l._orderQty) * 100) : 0;
      const orderBar = l._orderQty > 0 ? '<span style="display:inline-block;width:28px;height:4px;background:#eee;border-radius:2px;overflow:hidden;vertical-align:middle"><span style="display:block;height:100%;width:' + orderPct + '%;background:#7c5cfc;border-radius:2px"></span></span> %' + orderPct.toFixed(0) : '-';
      const productNameShort = l.product_name ? l.product_name.substring(0, 10) : '';
      const bg = i % 2 === 0 ? '#fff' : '#f5f7fa';
      const border = i === looms.length - 1 ? '' : 'border-bottom:1px solid #e8ecf2;';

      return '<tr style="background:' + bg + '">'
        + '<td style="padding:2px 3px;text-align:center;font-size:6px;color:#999;' + border + 'width:16px">' + (i + 1) + '</td>'

        + '<td style="padding:2px 3px;font-size:7px;font-weight:700;color:#1a1a2e;' + border + 'white-space:nowrap">' + l.name + '</td>'

        + '<td style="padding:2px 3px;font-size:5.5px;' + border + 'white-space:nowrap"><span style="display:inline-block;padding:0 3px;border-radius:2px;font-weight:700;background:' + statusColor + '18;color:' + statusColor + '">' + statusLabel + '</span></td>'

        + '<td style="padding:2px 3px;font-size:6.5px;font-weight:700;color:' + effColor + ';' + border + 'white-space:nowrap">%' + l._eff.toFixed(1) + '</td>'

        + '<td style="padding:2px 3px;font-size:6px;' + border + 'white-space:nowrap"><span style="font-weight:600">' + (l.product_code || '-') + '</span> <span style="color:#888">' + productNameShort + '</span><br><span style="color:#b8860b">' + (l.lot_no || '-') + '</span> <span style="color:#888">|</span> <span style="color:#666">' + (l.customer_name || '-').substring(0,10) + '</span></td>'

        + '<td style="padding:2px 3px;font-size:6px;color:#7c5cfc;font-weight:600;' + border + 'white-space:nowrap">' + l._orderNo + '</td>'

        + '<td style="padding:2px 3px;font-size:6px;' + border + 'white-space:nowrap">' + (l.rpm || 0) + '/' + (l._density || 0) + '/' + (l.width || 0) + (l._totalTel ? '<br><span style="font-size:5px;color:#888">T:' + fmt(l._totalTel, 0) + '</span>' : '') + '</td>'

        + '<td style="padding:2px 3px;font-size:5.5px;color:#555;' + border + 'max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + l._warpYarn + ' / ' + l._weftYarn + '">' + l._warpYarn.substring(0, 10) + ' / ' + l._weftYarn.substring(0, 6) + '</td>'

        + '<td style="padding:2px 3px;font-size:6px;' + border + 'white-space:nowrap"><span style="font-weight:600">' + fmt(l.warp_total, 0) + '</span><span style="color:#888">→</span><span style="font-weight:600;color:' + (l._remaining < 200 ? '#ff5c6c' : '#1a1a2e') + '">' + fmt(l._remaining, 0) + '</span> <span style="color:#999">(%' + warpPct + ')</span></td>'

        + '<td style="padding:2px 3px;font-size:6px;text-align:center;' + border + 'width:14px">' + spareIcon + '</td>'

        + '<td style="padding:2px 3px;font-size:6px;' + border + 'white-space:nowrap"><span style="font-weight:600">' + fmt(l.daily_meters, 0) + '</span><span style="color:#999">/' + fmt(l._theoretical, 0) + '</span> <span style="color:' + finishColor + ';font-size:5.5px">' + finishLabel + '</span></td>'

        + '<td style="padding:2px 3px;font-size:5.5px;' + border + 'white-space:nowrap">' + orderBar + (l.next_product_name ? '<br><span style="color:#b8860b;font-size:5px">▶ ' + (l.next_product_code || '') + ' ' + l.next_product_name.substring(0, 6) + '</span>' : '') + '</td>'

        + '</tr>';
    }).join('');

    const reportDate = new Date().toLocaleDateString('tr-TR');
    const reportTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
      toast('Pop-up engellendi. Lutfen tarayici pop-up engelleyicisini devre disi birakin.', 'warning');
      return;
    }

    win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tezgah Tablo Raporu</title>'
      + '<style>'
      + '@page { size: A4 landscape; margin: 4mm; }'
      + '* { box-sizing: border-box; margin: 0; padding: 0; }'
      + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 7.5px; color: #1a1a2e; background: #fff; padding: 0; margin: 0; }'
      + '.header { display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; background: linear-gradient(135deg,#1a1a2e,#2a2a4e); color: #fff; margin-bottom: 4px; }'
      + '.header h1 { font-size: 12px; font-weight: 800; letter-spacing: 1px; }'
      + '.header .date { font-size: 7px; color: rgba(255,255,255,0.7); }'
      + '.kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; margin-bottom: 4px; }'
      + '.kpi-box { padding: 3px 6px; background: linear-gradient(135deg,#f8f9fc,#eef0f5); border-radius: 3px; border: 1px solid #e0e4ec; text-align: center; }'
      + '.kpi-box .kpi-label { font-size: 5.5px; color: #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }'
      + '.kpi-box .kpi-val { font-size: 11px; font-weight: 800; }'
      + 'table { width: 100%; border-collapse: collapse; font-size: 6px; }'
      + 'thead th { background: linear-gradient(135deg,#1a1a2e,#2a2a4e); color: #fff; padding: 3px 4px; text-align: left; font-size: 5.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }'
      + 'tbody td { vertical-align: top; }'
      + 'tr:hover td { background: rgba(0,212,170,0.04); }'
      + '.footer { text-align: center; padding: 3px; font-size: 5.5px; color: #aaa; border-top: 1px solid #eee; margin-top: 3px; }'
      + '.np { display: block; text-align: center; margin-top: 6px; padding: 6px; }'
      + '.np button { padding: 5px 18px; border: none; border-radius: 4px; font-size: 9px; font-weight: 700; cursor: pointer; }'
      + '.np .btn-print { background: #7c5cfc; color: #fff; margin-right: 6px; }'
      + '.np .btn-close { background: #f0f1f5; color: #666; }'
      + '@media print { .np { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
      + '</style></head><body>'

      + '<div class="header"><div><h1>DOKUMA URETIM RAPORU &mdash; TABLO</h1></div><div class="date">' + reportDate + ' ' + reportTime + '</div></div>'

      + '<div class="kpi-row">'
      + '<div class="kpi-box"><div class="kpi-label">Toplam Tezgah</div><div class="kpi-val">' + looms.length + '</div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Aktif / Duran</div><div class="kpi-val"><span style="color:#00d4aa">' + activeCount + '</span><span style="color:#888">/</span><span style="color:#ff5c6c">' + (looms.length - activeCount) + '</span></div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Ort. Randiman</div><div class="kpi-val" style="color:' + (avgEff >= 85 ? '#00d4aa' : (avgEff >= 70 ? '#e6a800' : '#ff5c6c')) + '">%' + avgEff.toFixed(1) + '</div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Gunluk Uretim</div><div class="kpi-val">' + fmt(totalDaily, 0) + ' mt</div></div>'
      + '<div class="kpi-box"><div class="kpi-label">Kalan Cozgu</div><div class="kpi-val">' + fmt(totalRemainingWarp, 0) + ' mt</div></div>'
      + '</div>'

      + '<table><thead><tr>'
      + '<th style="text-align:center;width:16px">#</th><th>Tezgah</th><th>St</th><th>%Rd</th><th>Urun / Lot / Musteri</th><th>Siparis</th><th>R/S/E/T</th><th>Cozgu/Atki Iplik</th><th>Cozgu T→K(%)</th><th style="text-align:center">Y</th><th>Gunluk/Teo/Bitis</th><th>Sip.% / Sonraki</th>'
      + '</tr></thead><tbody>' + tableRows + '</tbody></table>'

      + '<div class="footer">DokumaQC Takip Sistemi &mdash; ' + reportDate + ' ' + reportTime + '</div>'

      + '<div class="np">'
      + '<button class="btn-print" onclick="window.print()"> Yazdir</button>'
      + '<button class="btn-close" onclick="window.close()"> Kapat</button>'
      + '</div>'

      + '</body></html>');
    win.document.close();
  } catch (e) {
    toast('Rapor olusturulurken hata: ' + e.message, 'error');
  }
}

function printLoomListViewReport() {
  const looms = allLoomsList;
  if (!looms || !looms.length) {
    toast('Yazdirilacak tezgah verisi bulunamadi', 'warning');
    return;
  }

  let rows = looms.map(l => {
    let density = parseFloat(l.product_density || 0);
    let warpYarn = l.warp_yarn || '-';
    let weftYarn = l.weft_yarn || '-';

    if (l.product_tech) {
      try {
        const td = JSON.parse(l.product_tech);
        if (td.warpList && td.warpList.length) warpYarn = td.warpList.join(', ');
        if (td.weftList && td.weftList.length) weftYarn = td.weftList.join(', ');
      } catch (e) { }
    }

    const consumed = getWarpConsumed(l);
    const remaining = Math.max(0, l.warp_total - consumed);

    let remainingDays = '-';
    if (l.rpm > 0 && density > 0 && remaining > 0) {
      const mph = (parseFloat(l.rpm) * 60) / (density * 100);
      const realMpd = mph * (l.work_hours || 24) * 0.85;
      remainingDays = (remaining / realMpd).toFixed(1) + ' gun';
    }

    let eff = 0;
    const mins = Math.max(1, l.mins_passed || 1);
    if (l.last_efficiency !== null) eff = parseFloat(l.last_efficiency);
    else if (l.rpm > 0 && density > 0) {
      const theoretical = (parseFloat(l.rpm) * mins) / (density * 100);
      eff = theoretical > 0 ? Math.min(100, (parseFloat(l.daily_meters || 0) / theoretical) * 100) : 0;
    }
    const effColor = eff >= 85 ? '#00d4aa' : (eff >= 70 ? '#e6a800' : '#ff5c6c');
    const statusColor = l.status === 'çalışıyor' ? '#00d4aa' : (l.status === 'durdu' ? '#ff5c6c' : '#888');
    const statusBg = l.status === 'çalışıyor' ? 'rgba(0,212,170,0.12)' : (l.status === 'durdu' ? 'rgba(255,92,108,0.12)' : 'rgba(136,136,136,0.12)');
    const remainingWarn = remaining < 100 ? '#ff5c6c' : '#1a1a2e';

    const border = 'border-bottom:1px solid #e8ecf2;';

    return '<tr>'
      + '<td style="padding:3px 5px;font-size:8px;font-weight:700;color:#1a1a2e;' + border + 'white-space:nowrap">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">'
      + '<span>' + l.name + '</span>'
      + '<span style="font-size:7px;font-weight:800;color:' + effColor + '">%' + eff.toFixed(1) + '</span>'
      + '</div>'
      + '<div style="font-size:7px;color:#888;font-weight:600">' + (l.rpm || 0) + ' RPM</div>'
      + '</td>'
      + '<td style="padding:3px 5px;font-size:8px;' + border + '">'
      + '<div style="font-weight:700">' + (l.product_name || '-') + '</div>'
      + '<div style="display:flex;align-items:center;gap:4px;margin-top:1px">'
      + '<span style="font-size:7px;color:#888;font-weight:600">' + (l.product_code || '') + '</span>'
      + '<span style="font-size:7px;font-weight:700;color:#00d4aa;background:rgba(0,212,170,0.1);padding:1px 4px;border-radius:3px">' + density + ' TEL</span>'
      + '</div>'
      + '</td>'
      + '<td style="padding:3px 5px;font-size:8px;' + border + '">'
      + (l._orderNo
        ? '<div style="font-weight:700;color:#7c5cfc">' + l._orderNo + '</div><div style="font-size:7px;color:#888">' + (l.customer_name || '-') + '</div>'
        : '<span style="color:#999">Yok</span>')
      + '</td>'
      + '<td style="padding:3px 5px;font-size:8px;font-weight:700;color:#b8860b;' + border + '">' + (l.lot_no || '-') + '</td>'
      + '<td style="padding:3px 5px;font-size:7px;line-height:1.3;' + border + '">'
      + '<div style="color:#555">C: ' + warpYarn + '</div>'
      + '<div style="color:#888">A: ' + weftYarn + '</div>'
      + '</td>'
      + '<td style="padding:3px 5px;font-size:8px;text-align:right;font-weight:600;' + border + '">' + (l.warp_total || 0) + ' m</td>'
      + '<td style="padding:3px 5px;font-size:8px;text-align:right;color:#00d4aa;font-weight:600;' + border + '">' + (l.current_meters || 0) + ' m</td>'
      + '<td style="padding:3px 5px;font-size:8px;text-align:right;font-weight:700;color:' + remainingWarn + ';' + border + '">' + remaining.toFixed(1) + ' m</td>'
      + '<td style="padding:3px 5px;font-size:8px;text-align:center;font-weight:600;color:#7c5cfc;' + border + '">' + remainingDays + '</td>'
      + '<td style="padding:3px 5px;text-align:center;' + border + '">'
      + '<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:7px;font-weight:700;background:' + statusBg + ';color:' + statusColor + '">' + l.status.toUpperCase() + '</span>'
      + '</td>'
      + '<td style="padding:3px 5px;font-size:7px;color:#555;' + border + 'max-width:120px">' + (l.notes || '') + '</td>'
      + '</tr>';
  }).join('');

  const totals = looms.reduce((acc, l) => {
    const consumed = getWarpConsumed(l);
    const remaining = Math.max(0, l.warp_total - consumed);
    acc.warp += parseFloat(l.warp_total || 0);
    acc.woven += parseFloat(l.current_meters || 0);
    acc.remaining += remaining;
    return acc;
  }, { warp: 0, woven: 0, remaining: 0 });

  const footerRow = '<tr style="background:#f0f2f5;font-weight:800;border-top:2px solid #d0d4dc">'
    + '<td colspan="5" style="text-align:right;padding:4px 10px;font-size:8px">GENEL TOPLAM:</td>'
    + '<td style="text-align:right;padding:4px 5px;font-size:8px">' + totals.warp.toFixed(0) + ' m</td>'
    + '<td style="text-align:right;padding:4px 5px;font-size:8px;color:#00d4aa">' + totals.woven.toFixed(0) + ' m</td>'
    + '<td style="text-align:right;padding:4px 5px;font-size:8px;color:#b8860b">' + totals.remaining.toFixed(0) + ' m</td>'
    + '<td colspan="3" style="padding:4px 5px"></td>'
    + '</tr>';

  const reportDate = new Date().toLocaleDateString('tr-TR');
  const reportTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    toast('Pop-up engellendi. Lutfen tarayici pop-up engelleyicisini devre disi birakin.', 'warning');
    return;
  }

  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tezgah Liste Raporu</title>'
    + '<style>'
    + '@page { size: A4 landscape; margin: 5mm; }'
    + '* { box-sizing: border-box; margin: 0; padding: 0; }'
    + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 8px; color: #1a1a2e; background: #fff; padding: 0; margin: 0; }'
    + '.header { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: linear-gradient(135deg,#1a1a2e,#2a2a4e); color: #fff; margin-bottom: 4px; }'
    + '.header h1 { font-size: 13px; font-weight: 800; letter-spacing: 1px; }'
    + '.header .date { font-size: 7px; color: rgba(255,255,255,0.7); }'
    + 'table { width: 100%; border-collapse: collapse; font-size: 7.5px; }'
    + 'thead th { background: linear-gradient(135deg,#1a1a2e,#2a2a4e); color: #fff; padding: 4px 5px; text-align: left; font-size: 6.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }'
    + 'thead th.right { text-align: right; }'
    + 'thead th.center { text-align: center; }'
    + 'tbody td { vertical-align: middle; }'
    + 'tr:nth-child(even) td { background: #f8f9fc; }'
    + '.footer { text-align: center; padding: 4px; font-size: 5.5px; color: #aaa; border-top: 1px solid #eee; margin-top: 4px; }'
    + '.np { display: block; text-align: center; margin-top: 8px; padding: 6px; }'
    + '.np button { padding: 5px 18px; border: none; border-radius: 4px; font-size: 9px; font-weight: 700; cursor: pointer; }'
    + '.np .btn-print { background: #7c5cfc; color: #fff; margin-right: 6px; }'
    + '.np .btn-close { background: #f0f1f5; color: #666; }'
    + '@media print { .np { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
    + '</style></head><body>'

    + '<div class="header"><div><h1>DOKUMA LISTE RAPORU</h1></div><div class="date">' + reportDate + ' ' + reportTime + '</div></div>'

    + '<table><thead><tr>'
    + '<th style="width:80px">TEZGAH / HIZ</th>'
    + '<th>KALITE / SIKLIK</th>'
    + '<th>SIPARIS</th>'
    + '<th>LOT NO</th>'
    + '<th>IPLIK DETAYLARI (C / A)</th>'
    + '<th class="right">COZGU MT</th>'
    + '<th class="right">DOKUNAN MT</th>'
    + '<th class="right">KALAN MT</th>'
    + '<th class="center">KALAN GUN</th>'
    + '<th class="center">DURUM</th>'
    + '<th>NOTLAR</th>'
    + '</tr></thead><tbody>' + rows + '</tbody>'
    + '<tfoot>' + footerRow + '</tfoot>'
    + '</table>'

    + '<div class="footer">DokumaQC Takip Sistemi &mdash; Liste Goruntuleme &mdash; ' + reportDate + ' ' + reportTime + '</div>'

    + '<div class="np">'
    + '<button class="btn-print" onclick="window.print()"> Yazdir</button>'
    + '<button class="btn-close" onclick="window.close()"> Kapat</button>'
    + '</div>'

    + '</body></html>');
  win.document.close();
}
