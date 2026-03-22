import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
 
// ═══════════════════════════════════════════════════════
// CONFIG — ganti dengan credentials Supabase kamu
// ═══════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://elxgqfbjxhdtijalihde.supabase.co'
const SUPABASE_ANON = 'sb_publishable_0FjGCdf_p8qOjKpUZtg1Pg_NaBsvVsl'
 
const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
 
// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let trades = []
let editingId = null
let currentOutcome = null
let currentImages = { H1: null, M15: null, M1: null }
let selectedTradeId = null
let currentView = 'form'
 
const g = id => document.getElementById(id)
 
// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
async function init() {
  setSyncStatus('connecting')
  try {
    await loadTrades()
    setSyncStatus('ok')
    buildForm()
    renderSidebar()
    renderMobileList()
    updateCount()
  } catch (err) {
    setSyncStatus('err')
    toast('❌ Gagal connect ke Supabase — cek URL & key')
    console.error(err)
  }
}
 
function setSyncStatus(state) {
  const el = g('syncStatus')
  if (!el) return
  if (state === 'ok') { el.textContent = '● Online'; el.className = 'sync-status ok' }
  else if (state === 'err') { el.textContent = '● Offline'; el.className = 'sync-status err' }
  else { el.textContent = '● Connecting...'; el.className = 'sync-status' }
}
 
// ═══════════════════════════════════════════════════════
// SUPABASE — TRADES
// ═══════════════════════════════════════════════════════
async function loadTrades() {
  const { data, error } = await sb.from('trades').select('*').order('date', { ascending: false })
  if (error) throw error
  trades = data || []
}
 
async function upsertTrade(t) {
  const { error } = await sb.from('trades').upsert(t, { onConflict: 'id' })
  if (error) throw error
}
 
async function removeTrade(id) {
  const { error } = await sb.from('trades').delete().eq('id', id)
  if (error) throw error
}
 
// ═══════════════════════════════════════════════════════
// SUPABASE — IMAGES (Storage)
// ═══════════════════════════════════════════════════════
async function uploadImage(tradeId, tf, dataUrl) {
  const blob = dataURLtoBlob(dataUrl)
  const path = `${tradeId}/${tf}.jpg`
  const { error } = await sb.storage.from('chart-images').upload(path, blob, {
    upsert: true, contentType: 'image/jpeg'
  })
  if (error) throw error
  return path
}
 
async function getImageUrl(tradeId, tf) {
  const path = `${tradeId}/${tf}.jpg`
  const { data } = sb.storage.from('chart-images').getPublicUrl(path)
  return data?.publicUrl || null
}
 
async function deleteImages(tradeId) {
  const paths = ['H1', 'M15', 'M1'].map(tf => `${tradeId}/${tf}.jpg`)
  await sb.storage.from('chart-images').remove(paths)
}
 
function dataURLtoBlob(dataUrl) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
 
// ═══════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════
window.showView = function(v, el) {
  currentView = v
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'))
  document.querySelectorAll('.vtab, .mnav-item').forEach(x => x.classList.remove('active'))
  g('view-' + v)?.classList.add('active')
  document.querySelectorAll(`[data-view="${v}"]`).forEach(x => x.classList.add('active'))
  if (v === 'history') renderHistory()
  if (v === 'stats') renderStats()
  if (v === 'detail' && selectedTradeId) renderDetail(selectedTradeId)
  if (v === 'list') renderMobileList()
}
 
// ═══════════════════════════════════════════════════════
// BUILD FORM HTML (called once)
// ═══════════════════════════════════════════════════════
function buildForm() {
  g('formContent').innerHTML = `
  <!-- META -->
  <div class="form-section">
    <div class="grid g4">
      <div class="field"><label>Trade #</label><input id="f_num" type="text" placeholder="BT-001"></div>
      <div class="field"><label>Date</label><input id="f_date" type="date"></div>
      <div class="field"><label>Session</label>
        <select id="f_session">
          <option>London</option><option>New York</option>
          <option>Asian</option><option>London/NY Overlap</option>
        </select>
      </div>
      <div class="field"><label>Bias</label>
        <select id="f_bias">
          <option value="LONG">LONG 📈</option>
          <option value="SHORT">SHORT 📉</option>
        </select>
      </div>
    </div>
  </div>
 
  <!-- SECTION 1: H1 -->
  <div class="form-section">
    <div class="sec-head"><div class="sec-num">1</div><h3>H1 WAVE MAPPING</h3><span>structure · dual scenario</span></div>
    <div class="grid g3" style="margin-bottom:10px;">
      <div class="field span3">
        <label>Wave yang sedang terjadi</label>
        <div class="wave-row" id="waveSelector">
          ${['W1','W2','W3','W4','W5'].map(w=>`<div class="wbtn" data-w="${w}" data-type="impulse" onclick="toggleWave(this)">${w}</div>`).join('')}
          ${['WA','WB','WC'].map(w=>`<div class="wbtn" data-w="${w}" data-type="correct" onclick="toggleWave(this)">${w}</div>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Sub-wave</label>
        <select id="f_subwave">
          <option value="">—</option>
          <option>(i)</option><option>(ii)</option><option>(iii)</option><option>(iv)</option><option>(v)</option>
        </select>
      </div>
      <div class="field">
        <label>H1 Context</label>
        <select id="f_h1ctx">${h1CtxOptions()}</select>
      </div>
      <div class="field">
        <label>H1 Pattern</label>
        <select id="f_h1pat"><option value="">— Pilih —</option>${h1PatOptions()}</select>
      </div>
    </div>
    <div class="grid g2" style="margin-bottom:10px;">
      <div class="field"><label>Swing High</label><input id="f_swingHigh" type="number" step="0.01" placeholder="3350.00"></div>
      <div class="field"><label>Swing Low</label><input id="f_swingLow" type="number" step="0.01" placeholder="3280.00"></div>
    </div>
    <div class="scenario-grid" style="margin-bottom:10px;">
      <div class="scenario-box sb-primary">
        <span class="sb-label">◈ SKENARIO PRIMER</span>
        <div class="field" style="margin-bottom:8px;"><textarea id="f_s1" rows="2" placeholder="e.g. W4 selesai, expecting W5..."></textarea></div>
        <div class="field"><label>Invalidasi</label><input id="f_inv1" type="number" step="0.01" placeholder="3280.00"></div>
      </div>
      <div class="scenario-box sb-alt">
        <span class="sb-label">◌ SKENARIO ALTERNATIF</span>
        <div class="field" style="margin-bottom:8px;"><textarea id="f_s2" rows="2" placeholder="e.g. ABC flat jika break below..."></textarea></div>
        <div class="field"><label>Invalidasi</label><input id="f_inv2" type="number" step="0.01" placeholder="3250.00"></div>
      </div>
    </div>
    <div class="field">${uploadZoneHTML('H1','📊','Screenshot H1','Drag & drop atau klik')}</div>
  </div>
 
  <!-- SECTION 2: ZONE -->
  <div class="form-section">
    <div class="sec-head"><div class="sec-num">2</div><h3>ZONE H1 · M15 & FIBONACCI</h3><span>fibo · confluence · pattern</span></div>
    <div class="autocalc-box" style="margin-bottom:12px;">
      <div class="autocalc-label">AUTO-CALC FIBO</div>
      <div class="grid g4">
        <div class="field"><label>High</label><input id="ac_high" type="number" step="0.01" placeholder="3350.00" oninput="autoFibo()"></div>
        <div class="field"><label>Low</label><input id="ac_low" type="number" step="0.01" placeholder="3280.00" oninput="autoFibo()"></div>
        <div class="field"><label>Arah</label>
          <select id="ac_dir" onchange="autoFibo()">
            <option value="bull">Bullish (retrace ↓)</option>
            <option value="bear">Bearish (retrace ↑)</option>
          </select>
        </div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn btn-gold" style="width:100%;padding:7px;justify-content:center;" onclick="autoFibo()">↻ Hitung</button>
        </div>
      </div>
    </div>
    <div class="fibo-wrap">${fiboTableHTML()}</div>
    <div class="grid g3" style="margin-bottom:12px;">
      <div class="field"><label>M15 Pattern</label><select id="f_m15pat">${m15PatOptions()}</select></div>
      <div class="field"><label>M15 Context</label>
        <select id="f_m15ctx">
          <option>W2 pullback</option><option>W4 correction</option>
          <option>ABC selesai</option><option>(ii) retrace dari (i)</option>
          <option>(iv) retrace dari (iii)</option>
        </select>
      </div>
      <div class="field"><label>Zone Strength</label>
        <select id="f_zonestr">
          <option>Strong — 3+ confluence</option>
          <option>Medium — 2 confluence</option>
          <option>Weak — 1 confluence</option>
        </select>
      </div>
    </div>
    <div class="field">${uploadZoneHTML('M15','📈','Screenshot M15','Tandai zone fibo + pattern')}</div>
  </div>
 
  <!-- SECTION 3: ENTRY -->
  <div class="form-section">
    <div class="sec-head"><div class="sec-num">3</div><h3>ENTRY M1 — 3 KONFIRMASI</h3><span>choch · rejection · candle</span></div>
    <div id="chkList" style="margin-bottom:12px;">
      ${[
        ['Fractal CHoCH Break Confirmed','M1 structure shift — HH/LL broken'],
        ['Price Rejection at H1 Fibo 0.618','Pin bar / engulfing di zona aman'],
        ['Candle Confirmation at Cluster Zone','Close beyond signal candle']
      ].map(([t,s])=>`
        <div class="chk-item" onclick="toggleChk(this)">
          <div class="chk-box"></div>
          <div class="chk-text"><strong>${t}</strong><span>${s}</span></div>
        </div>`).join('')}
    </div>
    <div class="grid g3" style="margin-bottom:10px;">
      <div class="field"><label>Entry Price</label><input id="f_entry" type="number" step="0.01" placeholder="3312.50" oninput="calcRR()"></div>
      <div class="field"><label>Entry Time (WIB)</label><input id="f_time" type="time"></div>
      <div class="field"><label>Entry Zone</label>
        <select id="f_ezone"><option>M1 Aggressive</option><option>M15 Conservative</option></select>
      </div>
      <div class="field"><label>Candle Konfirmasi</label><select id="f_candle">${candleOptions()}</select></div>
      <div class="field"><label>Lot Size</label><input id="f_lot" type="number" step="0.01" placeholder="0.10"></div>
      <div class="field"><label>Fractal Count</label><input id="f_fractal" type="text" placeholder="e.g. Fractal 3 of (ii)"></div>
      <div class="field span3"><label>Scaling Plan</label><input id="f_scaling" type="text" placeholder="e.g. Entry 1: 0.1 lot @ 3312, Entry 2: 0.05 lot @ 3308"></div>
    </div>
    <div class="field">${uploadZoneHTML('M1','🎯','Screenshot M1','Tandai CHoCH, fractal, entry candle')}</div>
  </div>
 
  <!-- SECTION 4: TP & SL -->
  <div class="form-section">
    <div class="sec-head"><div class="sec-num">4</div><h3>TP · SL · INVALIDASI</h3><span>target · risk · r:r</span></div>
    <div class="grid g4" style="margin-bottom:10px;">
      <div class="field"><label>SL Price</label><input id="f_sl" type="number" step="0.01" placeholder="3300.00" oninput="calcRR()"></div>
      <div class="field"><label>TP-1 (1.272)</label><input id="f_tp1" type="number" step="0.01" placeholder="3340.00" oninput="calcRR()"></div>
      <div class="field"><label>TP-2 (1.618)</label><input id="f_tp2" type="number" step="0.01" placeholder="3360.00"></div>
      <div class="field"><label>TP-3 / Full</label><input id="f_tp3" type="number" step="0.01" placeholder="3380.00"></div>
    </div>
    <div class="grid g4" style="margin-bottom:10px;">
      <div class="rr-box"><div class="rr-lbl">R:R RATIO</div><div class="rr-val" id="rrVal">—</div></div>
      <div class="field"><label>Risk (pips)</label><input id="f_riskpips" type="text" readonly style="opacity:.6;cursor:default;"></div>
      <div class="field"><label>Reward TP-1 (pips)</label><input id="f_rewpips" type="text" readonly style="opacity:.6;cursor:default;"></div>
      <div class="field"><label>SL Basis</label>
        <select id="f_slbasis">
          <option>Last M15 swing</option><option>H1 structure pivot</option>
          <option>Below W2 start</option><option>Manual level</option>
        </select>
      </div>
    </div>
    <div class="grid g2">
      <div class="field"><label>Wave Count Invalidation</label><input id="f_wcinv" type="text" placeholder="e.g. W2 retrace >100% W1 → below 3280"></div>
      <div class="field"><label>H1 Scenario Invalidation</label><input id="f_h1inv" type="text" placeholder="e.g. Break above 3360 invalidates count"></div>
    </div>
  </div>
 
  <!-- POST TRADE -->
  <div class="form-section">
    <div class="sec-head"><div class="sec-num">✓</div><h3>POST-TRADE REVIEW</h3><span>outcome · lessons</span></div>
    <div class="outcome-row">
      <div class="out-btn win" onclick="setOutcome('WIN',this)">WIN</div>
      <div class="out-btn loss" onclick="setOutcome('LOSS',this)">LOSS</div>
      <div class="out-btn be" onclick="setOutcome('BE',this)">BREAK EVEN</div>
      <div class="field" style="flex:1;min-width:100px;">
        <label>P&L (Pips)</label>
        <input id="f_pnl" type="number" step="0.1" placeholder="+85">
      </div>
    </div>
    <div class="grid g2">
      <div class="field"><label>Yang berhasil</label><textarea id="f_good" rows="3" placeholder="Wave count terbukti benar..."></textarea></div>
      <div class="field"><label>Yang perlu diperbaiki</label><textarea id="f_bad" rows="3" placeholder="Entry terlalu awal..."></textarea></div>
      <div class="field span2"><label>Rule / Pattern baru ditemukan</label><textarea id="f_rule" rows="2" placeholder="e.g. Pada W3 XAUUSD, fibo 0.618 selalu direspek di London session..."></textarea></div>
    </div>
  </div>
 
  <div class="form-actions">
    <button class="btn btn-ghost" onclick="resetForm()">🗑 Clear</button>
    <button class="btn btn-gold" id="saveBtn" onclick="saveTrade()">💾 Simpan Trade</button>
  </div>
  `
 
  // init upload zones
  ;['H1','M15','M1'].forEach(tf => initUploadZone(tf))
 
  resetForm()
}
 
// ── Option generators ──
function h1CtxOptions() {
  return `
    <optgroup label="── IMPULSE CONTEXT ──">
      <option>W1 — Initial impulse leg</option>
      <option>W2 — Retracement (fibo 0.500–0.786)</option>
      <option>W2→W3 (Entry impulse)</option>
      <option>W3 — Extended impulse in progress</option>
      <option>W3→W4 (Correction incoming)</option>
      <option>W4 — Shallow correction</option>
      <option>W4→W5 (Continuation)</option>
      <option>W5 — Final push in progress</option>
      <option>W5 ending / reversal approaching</option>
      <option>W5 Truncation (gagal new high/low)</option>
    </optgroup>
    <optgroup label="── DIAGONAL ──">
      <option>Leading Diagonal (W1 atau WA)</option>
      <option>Ending Diagonal (W5 atau WC)</option>
    </optgroup>
    <optgroup label="── CORRECTION CONTEXT ──">
      <option>WA — Correction leg A</option>
      <option>WB — Correction rebound</option>
      <option>WB→WC (WC imminent)</option>
      <option>WC — Final correction leg</option>
      <option>ABC ZigZag selesai</option>
      <option>Flat correction selesai</option>
      <option>Triangle WXY (menunggu breakout)</option>
      <option>Double Three WXY in progress</option>
      <option>Complex correction — re-count needed</option>
    </optgroup>`
}
 
function h1PatOptions() {
  return `
    <optgroup label="── IMPULSE ──">
      <option>Impulsive 5-wave standard</option>
      <option>Leading Diagonal (W1/WA)</option>
      <option>Ending Diagonal (W5/WC)</option>
      <option>Extended Wave 3</option>
      <option>Extended Wave 5</option>
    </optgroup>
    <optgroup label="── FLAT ──">
      <option>Flat — Regular</option>
      <option>Flat — Expanded (B > A)</option>
      <option>Flat — Running (B > start)</option>
    </optgroup>
    <optgroup label="── ZIGZAG ──">
      <option>ZigZag — Simple (ABC)</option>
      <option>ZigZag — Double (WXY)</option>
      <option>ZigZag — Triple (WXYXZ)</option>
    </optgroup>
    <optgroup label="── TRIANGLE ──">
      <option>Triangle — Contracting</option>
      <option>Triangle — Ascending</option>
      <option>Triangle — Descending</option>
      <option>Triangle — Expanding</option>
    </optgroup>
    <optgroup label="── COMPLEX ──">
      <option>Double Three (WXY)</option>
      <option>Triple Three (WXYXZ)</option>
      <option>Combination correction</option>
    </optgroup>`
}
 
function m15PatOptions() {
  return `
    <optgroup label="── IMPULSE ──">
      <option>5-wave impulse</option>
      <option>Leading Diagonal</option>
      <option>Ending Diagonal</option>
    </optgroup>
    <optgroup label="── SIMPLE CORRECTION ──">
      <option>3-wave ZigZag (ABC)</option>
      <option>Flat — Regular</option>
      <option>Flat — Expanded</option>
      <option>Flat — Running</option>
      <option>ABCDE correction</option>
    </optgroup>
    <optgroup label="── COMPLEX CORRECTION ──">
      <option>Double Three (WXY)</option>
      <option>Triple Three (WXYXZ)</option>
      <option>WXY ZigZag</option>
    </optgroup>
    <optgroup label="── TRIANGLE ──">
      <option>Triangle — Contracting</option>
      <option>Triangle — Ascending</option>
      <option>Triangle — Descending</option>
      <option>Triangle — Expanding</option>
    </optgroup>
    <optgroup label="── CHART PATTERN ──">
      <option>Flag / Pennant</option>
      <option>Wedge — Rising</option>
      <option>Wedge — Falling</option>
      <option>Double Bottom</option>
      <option>Double Top</option>
      <option>Head & Shoulders</option>
      <option>Inverse Head & Shoulders</option>
    </optgroup>`
}
 
function candleOptions() {
  return `
    <optgroup label="── ENGULFING ──">
      <option>Engulfing Bullish</option>
      <option>Engulfing Bearish</option>
    </optgroup>
    <optgroup label="── PIN BAR ──">
      <option>Pin Bar Bullish (Hammer)</option>
      <option>Pin Bar Bearish (Shooting Star)</option>
      <option>Inverted Hammer</option>
      <option>Hanging Man</option>
    </optgroup>
    <optgroup label="── INSIDE BAR ──">
      <option>Inside Bar Bullish</option>
      <option>Inside Bar Bearish</option>
    </optgroup>
    <optgroup label="── DOJI ──">
      <option>Doji + Bullish Follow Through</option>
      <option>Doji + Bearish Follow Through</option>
      <option>Dragonfly Doji</option>
      <option>Gravestone Doji</option>
    </optgroup>
    <optgroup label="── MULTI-CANDLE ──">
      <option>Morning Star</option>
      <option>Evening Star</option>
      <option>Tweezer Bottom</option>
      <option>Tweezer Top</option>
      <option>Three White Soldiers</option>
      <option>Three Black Crows</option>
      <option>Marubozu Bullish</option>
      <option>Marubozu Bearish</option>
    </optgroup>
    <optgroup label="── STRUCTURE ──">
      <option>BOS Candle (Break of Structure)</option>
      <option>CHoCH Candle</option>
      <option>Other</option>
    </optgroup>`
}
 
function fiboTableHTML() {
  const rows = [
    ['0.236','','Early retest',''],
    ['0.382','','Shallow pull',''],
    ['0.500','','Mid pivot',''],
    ['0.618','row-safe','ZONA AMAN ↓',''],
    ['0.786','row-safe','ZONA AMAN ↑ / EXTREM ↓',''],
    ['1.000','row-sl','SL Zone / Full retrace',''],
    ['1.272','row-tp','TP-1 Projection',''],
    ['1.618','row-tp','TP-2 Projection',''],
  ]
  return `<table class="fibo-tbl">
    <thead><tr><th>LEVEL</th><th>PRICE</th><th>TIPE ZONA</th><th>CONFLUENCE</th></tr></thead>
    <tbody>${rows.map(([l,cls,zone])=>`
      <tr class="${cls}">
        <td><span class="badge ${cls==='row-tp'?'badge-green':cls==='row-sl'?'badge-red':cls==='row-safe'?'badge-gold':'badge-muted'}">${l}</span></td>
        <td><input class="fi" data-l="${l}" type="number" step="0.01" placeholder="—"></td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--muted2);white-space:nowrap;">${zone}</td>
        <td><input type="text" class="fi-conf" style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:10px;width:110px;padding:2px 0;outline:none;" placeholder="—"></td>
      </tr>`).join('')}
    </tbody>
  </table>`
}
 
function uploadZoneHTML(tf, icon, label, sub) {
  return `<label style="font-family:var(--mono);font-size:9px;letter-spacing:1.5px;color:var(--muted2);text-transform:uppercase;display:block;margin-bottom:4px;">${label}</label>
  <div class="upload-zone" id="uz_${tf}">
    <input type="file" id="fi_${tf}" accept="image/*">
    <div class="uz-overlay" id="uzov_${tf}" style="display:none;">
      <button class="uz-btn uz-btn-del" type="button">✕ Hapus</button>
      <button class="uz-btn uz-btn-full" type="button">⤢ Full</button>
    </div>
    <div class="uz-icon" id="uzico_${tf}">${icon}</div>
    <div class="uz-text" id="uztxt_${tf}">${sub.toUpperCase()}</div>
    <div class="uz-sub" id="uzsub_${tf}">PNG · JPG · drag & drop</div>
    <img id="uzimg_${tf}" style="display:none;" alt="${tf} chart">
  </div>`
}
 
function initUploadZone(tf) {
  const uz   = g('uz_'+tf)
  const fi   = g('fi_'+tf)
  const ovDel = uz.querySelector('.uz-btn-del')
  const ovFull = uz.querySelector('.uz-btn-full')
 
  uz.addEventListener('click', e => {
    if (!currentImages[tf]) fi.click()
  })
  uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('dragover') })
  uz.addEventListener('dragleave', () => uz.classList.remove('dragover'))
  uz.addEventListener('drop', e => {
    e.preventDefault(); uz.classList.remove('dragover')
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) readImg(file, tf)
  })
  fi.addEventListener('change', () => { if (fi.files[0]) readImg(fi.files[0], tf) })
  ovDel.addEventListener('click', e => { e.stopPropagation(); clearUpload(tf) })
  ovFull.addEventListener('click', e => {
    e.stopPropagation()
    if (currentImages[tf]) { g('lbImg').src = currentImages[tf]; g('lightbox').classList.add('show') }
  })
}
 
function readImg(file, tf) {
  const reader = new FileReader()
  reader.onload = e => { currentImages[tf] = e.target.result; showUpload(tf, e.target.result) }
  reader.readAsDataURL(file)
}
 
function showUpload(tf, src) {
  const uz = g('uz_'+tf)
  g('uzimg_'+tf).src = src; g('uzimg_'+tf).style.display = 'block'
  g('uzico_'+tf).style.display = 'none'
  g('uztxt_'+tf).style.display = 'none'
  g('uzsub_'+tf).style.display = 'none'
  g('uzov_'+tf).style.display = 'flex'
  uz.classList.add('has-img')
}
 
function clearUpload(tf) {
  const uz = g('uz_'+tf)
  currentImages[tf] = null
  g('uzimg_'+tf).src = ''; g('uzimg_'+tf).style.display = 'none'
  g('uzico_'+tf).style.display = ''
  g('uztxt_'+tf).style.display = ''
  g('uzsub_'+tf).style.display = ''
  g('uzov_'+tf).style.display = 'none'
  g('fi_'+tf).value = ''
  uz.classList.remove('has-img')
}
 
// ═══════════════════════════════════════════════════════
// FORM HELPERS
// ═══════════════════════════════════════════════════════
window.toggleWave = function(el) {
  const cls = 'sel-' + el.dataset.type
  el.classList.toggle(cls)
}
function getWaves() { return [...document.querySelectorAll('.wbtn.sel-impulse,.wbtn.sel-correct')].map(e=>e.dataset.w).join(',') }
function setWaves(str) {
  document.querySelectorAll('.wbtn').forEach(b => b.classList.remove('sel-impulse','sel-correct'))
  if (!str) return
  str.split(',').filter(Boolean).forEach(w => {
    const btn = document.querySelector(`.wbtn[data-w="${w}"]`)
    if (btn) btn.classList.add('sel-'+btn.dataset.type)
  })
}
 
window.toggleChk = function(el) { el.classList.toggle('checked') }
function getChks() { return [...document.querySelectorAll('.chk-item')].map(e=>e.classList.contains('checked')?'1':'0').join('') }
function setChks(str) {
  document.querySelectorAll('.chk-item').forEach((el,i) => el.classList.toggle('checked', !!(str && str[i]==='1')))
}
 
function getFibo() {
  const r = {}
  document.querySelectorAll('.fi').forEach(i => { if (i.value) r[i.dataset.l] = i.value })
  return r
}
function setFibo(obj) {
  document.querySelectorAll('.fi').forEach(i => { i.value = (obj && obj[i.dataset.l]) || '' })
}
 
window.setOutcome = function(val, btn) {
  currentOutcome = val
  document.querySelectorAll('.out-btn').forEach(b => b.classList.remove('sel'))
  btn.classList.add('sel')
}
 
window.autoFibo = function() {
  const high = parseFloat(g('ac_high').value)
  const low  = parseFloat(g('ac_low').value)
  const dir  = g('ac_dir').value
  if (!high || !low || high <= low) return
  const diff = high - low
  const levels = [0.236,0.382,0.500,0.618,0.786,1.000,1.272,1.618]
  document.querySelectorAll('.fi').forEach((inp, i) => {
    const l = levels[i]
    inp.value = dir === 'bull'
      ? (l <= 1 ? (high - diff*l).toFixed(2) : (high + diff*(l-1)).toFixed(2))
      : (l <= 1 ? (low  + diff*l).toFixed(2) : (low  - diff*(l-1)).toFixed(2))
  })
}
 
window.calcRR = function() {
  const entry = parseFloat(g('f_entry')?.value)
  const sl    = parseFloat(g('f_sl')?.value)
  const tp1   = parseFloat(g('f_tp1')?.value)
  if (!entry || !sl) return
  const risk = Math.abs(entry - sl) * 10
  if (g('f_riskpips')) g('f_riskpips').value = risk.toFixed(1)
  if (tp1) {
    const rew = Math.abs(tp1 - entry) * 10
    if (g('f_rewpips')) g('f_rewpips').value = rew.toFixed(1)
    const rr = rew / risk
    const el = g('rrVal')
    el.textContent = `1:${rr.toFixed(2)}`
    el.style.color = rr >= 2 ? 'var(--green)' : rr >= 1 ? 'var(--gold)' : 'var(--red)'
  }
}
 
function sv(id, val) {
  const el = g(id)
  if (!el) return
  el.value = val || ''
}
 
window.resetForm = function() {
  editingId = null; currentOutcome = null
  g('editBanner').style.display = 'none'
  if (g('saveBtn')) g('saveBtn').textContent = '💾 Simpan Trade'
 
  const fields = ['f_num','f_date','f_session','f_bias','f_subwave','f_h1ctx','f_h1pat',
    'f_swingHigh','f_swingLow','f_s1','f_inv1','f_s2','f_inv2',
    'f_m15pat','f_m15ctx','f_zonestr','f_entry','f_time','f_ezone',
    'f_candle','f_lot','f_fractal','f_scaling','f_sl','f_tp1','f_tp2','f_tp3',
    'f_riskpips','f_rewpips','f_slbasis','f_wcinv','f_h1inv','f_pnl','f_good','f_bad','f_rule',
    'ac_high','ac_low']
  fields.forEach(id => sv(id, ''))
 
  setWaves(''); setChks(''); setFibo({})
  document.querySelectorAll('.out-btn').forEach(b => b.classList.remove('sel'))
  const rrEl = g('rrVal'); if (rrEl) { rrEl.textContent = '—'; rrEl.style.color = 'var(--gold)' }
  ;['H1','M15','M1'].forEach(tf => { clearUpload(tf); currentImages[tf] = null })
 
  if (g('f_date')) g('f_date').value = new Date().toISOString().slice(0,10)
  if (g('f_num'))  g('f_num').value  = 'BT-' + String(trades.length + 1).padStart(3,'0')
}
 
window.cancelEdit = function() { resetForm() }
window.newTrade   = function() { showView('form'); resetForm() }
 
// ═══════════════════════════════════════════════════════
// SAVE TRADE
// ═══════════════════════════════════════════════════════
window.saveTrade = async function() {
  const btn = g('saveBtn')
  btn.textContent = '⏳ Menyimpan...'
  btn.disabled = true
 
  try {
    const id = editingId || ('BT-' + Date.now())
    const t = {
      id, num: g('f_num').value, date: g('f_date').value || null,
      session: g('f_session').value, bias: g('f_bias').value,
      waves: getWaves(), subwave: g('f_subwave').value,
      h1ctx: g('f_h1ctx').value, h1pat: g('f_h1pat').value,
      swing_high: parseFloat(g('f_swingHigh').value) || null,
      swing_low:  parseFloat(g('f_swingLow').value)  || null,
      scenario1: g('f_s1').value, inv1: parseFloat(g('f_inv1').value) || null,
      scenario2: g('f_s2').value, inv2: parseFloat(g('f_inv2').value) || null,
      fibo: getFibo(), m15pat: g('f_m15pat').value, m15ctx: g('f_m15ctx').value,
      zonestr: g('f_zonestr').value, checks: getChks(),
      entry: parseFloat(g('f_entry').value) || null,
      entry_time: g('f_time').value, ezone: g('f_ezone').value,
      candle: g('f_candle').value, lot: parseFloat(g('f_lot').value) || null,
      fractal: g('f_fractal').value, scaling: g('f_scaling').value,
      sl: parseFloat(g('f_sl').value) || null,
      tp1: parseFloat(g('f_tp1').value) || null,
      tp2: parseFloat(g('f_tp2').value) || null,
      tp3: parseFloat(g('f_tp3').value) || null,
      slbasis: g('f_slbasis').value, wcinv: g('f_wcinv').value, h1inv: g('f_h1inv').value,
      outcome: currentOutcome, pnl: parseFloat(g('f_pnl').value) || null,
      good: g('f_good').value, bad: g('f_bad').value, rule: g('f_rule').value,
      updated_at: new Date().toISOString()
    }
 
    // Upload images — skip '__existing__' (not changed during edit)
    for (const tf of ['H1','M15','M1']) {
      if (currentImages[tf] && currentImages[tf] !== '__existing__') {
        await uploadImage(id, tf, currentImages[tf])
      }
    }
 
    await upsertTrade(t)
    await loadTrades()
    selectedTradeId = id
    renderSidebar()
    renderMobileList()
    updateCount()
    toast(editingId ? '✅ Trade diupdate!' : '✅ Trade disimpan!')
    showView('detail')
    await renderDetail(id)
    resetForm()
  } catch (err) {
    console.error(err)
    toast('❌ Gagal simpan: ' + err.message)
  } finally {
    btn.textContent = editingId ? '💾 Update Trade' : '💾 Simpan Trade'
    btn.disabled = false
  }
}
 
// ═══════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════
window.renderSidebar = function() {
  const q  = (g('searchBox')?.value || '').toLowerCase()
  const fo = g('filterOutcome')?.value || ''
  const list = trades.filter(t => {
    if (fo && t.outcome !== fo) return false
    if (q && !JSON.stringify(t).toLowerCase().includes(q)) return false
    return true
  })
  const el = g('tradeList')
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="empty-icon">📋</div><p>Tidak ada trade.</p></div>'; return }
  el.innerHTML = list.map(t => tradeCardHTML(t)).join('')
}
 
window.renderMobileList = function() {
  const q  = (g('mSearchBox')?.value || '').toLowerCase()
  const fo = g('mFilterOutcome')?.value || ''
  const list = trades.filter(t => {
    if (fo && t.outcome !== fo) return false
    if (q && !JSON.stringify(t).toLowerCase().includes(q)) return false
    return true
  })
  const el = g('mobileTradeList')
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Tidak ada trade.</p></div>'; return }
  el.innerHTML = list.map(t => tradeCardHTML(t)).join('')
}
 
function tradeCardHTML(t) {
  const oc  = t.outcome || ''
  const cls = oc==='WIN'?'win':oc==='LOSS'?'loss':oc==='BE'?'be':''
  const bCls = oc==='WIN'?'badge-green':oc==='LOSS'?'badge-red':oc==='BE'?'badge-blue':'badge-muted'
  const p   = t.pnl || 0
  const isA = t.id === selectedTradeId ? ' active' : ''
  return `<div class="trade-card ${cls}${isA}" id="tc_${t.id}">
    <div onclick="selectTrade('${t.id}')" style="cursor:pointer;">
      <div class="tc-top">
        <span class="tc-id">${t.num||t.id}</span>
        <span class="badge ${bCls}">${oc||'OPEN'}</span>
      </div>
      <div class="tc-date">${t.date||'—'} · ${t.session||''}</div>
      <div class="tc-wave">${t.waves||'—'} ${t.subwave||''} · ${t.bias||''}</div>
      ${t.pnl !== null && t.pnl !== undefined ? `<div class="tc-pips" style="color:${p>=0?'var(--green)':'var(--red)'}">${p>0?'+':''}${t.pnl} pips</div>` : ''}
    </div>
    <div class="tc-actions">
      <div class="tc-btn tc-btn-edit" onclick="editTrade('${t.id}')">✏ EDIT</div>
      <div class="tc-btn tc-btn-del" onclick="deleteTrade('${t.id}')">🗑</div>
    </div>
  </div>`
}
 
function updateCount() {
  const wins  = trades.filter(t=>t.outcome==='WIN').length
  const total = trades.filter(t=>t.outcome).length
  const wr    = total ? Math.round(wins/total*100) : 0
  const el    = g('tradeCount')
  if (el) el.textContent = `${trades.length} trades · ${wr}% WR`
}
 
// ═══════════════════════════════════════════════════════
// SELECT → DETAIL
// ═══════════════════════════════════════════════════════
window.selectTrade = function(id) {
  selectedTradeId = id
  document.querySelectorAll('.trade-card').forEach(c => c.classList.remove('active'))
  document.querySelectorAll(`#tc_${id}`).forEach(c => c.classList.add('active'))
  showView('detail')
}
 
window.renderDetail = async function(id) {
  const t = trades.find(x => x.id === id)
  if (!t) return
 
  // Get image URLs from Supabase Storage
  const imgUrls = {}
  for (const tf of ['H1','M15','M1']) {
    imgUrls[tf] = await getImageUrl(id, tf)
  }
 
  const oc = t.outcome || 'OPEN'
  const ocColor = oc==='WIN'?'var(--green)':oc==='LOSS'?'var(--red)':oc==='BE'?'var(--blue)':'var(--muted2)'
  const p = t.pnl || 0
 
  g('detailContent').innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-title">${t.num||t.id} · ${t.waves||'—'} ${t.subwave||''}</div>
        <div class="detail-meta">
          <span class="badge ${oc==='WIN'?'badge-green':oc==='LOSS'?'badge-red':oc==='BE'?'badge-blue':'badge-muted'}">${oc}</span>
          <span class="badge badge-muted">${t.bias||'—'}</span>
          <span class="badge badge-muted">${t.date||'—'}</span>
          <span class="badge badge-muted">${t.session||'—'}</span>
          ${t.pnl !== null ? `<span class="badge" style="background:transparent;border:1px solid ${ocColor};color:${ocColor}">${p>0?'+':''}${t.pnl} pips</span>` : ''}
        </div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="editTrade('${t.id}')">✏ Edit</button>
    </div>
 
    <div class="img-grid">
      ${['H1','M15','M1'].map(tf => `
        <div class="img-box" onclick="${imgUrls[tf]?`openImgLightbox('${imgUrls[tf]}')`:''}" style="${!imgUrls[tf]?'cursor:default':''}">
          ${imgUrls[tf]
            ? `<img src="${imgUrls[tf]}" alt="${tf}" loading="lazy"><div class="img-label">${tf} CHART</div>`
            : `<div class="no-img">📷<br>${tf}<br><span style="opacity:.5">No screenshot</span></div>`}
        </div>`).join('')}
    </div>
 
    <div class="data-grid">
      ${[
        ['Entry', t.entry||'—'], ['SL', t.sl||'—'], ['TP-1', t.tp1||'—'],
        ['TP-2', t.tp2||'—'], ['TP-3', t.tp3||'—'], ['Lot', t.lot||'—'],
        ['M15 Pattern', t.m15pat||'—'], ['M15 Context', t.m15ctx||'—'],
        ['H1 Context', t.h1ctx||'—'], ['H1 Pattern', t.h1pat||'—'],
        ['Zone Strength', t.zonestr||'—'], ['Candle', t.candle||'—'],
      ].map(([l,v]) => `
        <div class="data-cell">
          <div class="data-cell-label">${l}</div>
          <div class="data-cell-val">${v}</div>
        </div>`).join('')}
    </div>
 
    ${t.scenario1||t.scenario2 ? `
    <div class="scenario-grid">
      <div class="scenario-box sb-primary">
        <span class="sb-label">◈ SKENARIO PRIMER</span>
        <p style="font-size:12px;line-height:1.7;">${(t.scenario1||'—').replace(/\n/g,'<br>')}</p>
        ${t.inv1 ? `<div style="font-family:var(--mono);font-size:10px;color:var(--red);margin-top:6px;">Inv: ${t.inv1}</div>` : ''}
      </div>
      <div class="scenario-box sb-alt">
        <span class="sb-label">◌ SKENARIO ALTERNATIF</span>
        <p style="font-size:12px;line-height:1.7;">${(t.scenario2||'—').replace(/\n/g,'<br>')}</p>
        ${t.inv2 ? `<div style="font-family:var(--mono);font-size:10px;color:var(--red);margin-top:6px;">Inv: ${t.inv2}</div>` : ''}
      </div>
    </div>` : ''}
 
    ${t.good||t.bad||t.rule ? `
    <div class="review-box">
      <div class="review-box-title">POST-TRADE REVIEW</div>
      ${t.good ? `<div class="review-row"><div class="review-row-label good">✓ YANG BERHASIL</div><p>${t.good.replace(/\n/g,'<br>')}</p></div>` : ''}
      ${t.bad  ? `<div class="review-row"><div class="review-row-label bad">✗ YANG PERLU DIPERBAIKI</div><p>${t.bad.replace(/\n/g,'<br>')}</p></div>` : ''}
      ${t.rule ? `<div class="review-row"><div class="review-row-label rule">◈ RULE BARU</div><p>${t.rule.replace(/\n/g,'<br>')}</p></div>` : ''}
    </div>` : ''}
  `
}
 
window.openImgLightbox = function(url) {
  g('lbImg').src = url
  g('lightbox').classList.add('show')
}
window.closeLightbox = function() { g('lightbox').classList.remove('show') }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox() })
 
// ═══════════════════════════════════════════════════════
// EDIT TRADE
// ═══════════════════════════════════════════════════════
window.editTrade = async function(id) {
  const t = trades.find(x => x.id === id)
  if (!t) return
  editingId = id
  showView('form')
  resetForm()
  editingId = id
 
  sv('f_num', t.num); sv('f_date', t.date); sv('f_session', t.session); sv('f_bias', t.bias)
  sv('f_subwave', t.subwave); sv('f_h1ctx', t.h1ctx); sv('f_h1pat', t.h1pat)
  sv('f_swingHigh', t.swing_high); sv('f_swingLow', t.swing_low)
  sv('f_s1', t.scenario1); sv('f_inv1', t.inv1)
  sv('f_s2', t.scenario2); sv('f_inv2', t.inv2)
  sv('f_m15pat', t.m15pat); sv('f_m15ctx', t.m15ctx); sv('f_zonestr', t.zonestr)
  sv('f_entry', t.entry); sv('f_time', t.entry_time); sv('f_ezone', t.ezone)
  sv('f_candle', t.candle); sv('f_lot', t.lot); sv('f_fractal', t.fractal); sv('f_scaling', t.scaling)
  sv('f_sl', t.sl); sv('f_tp1', t.tp1); sv('f_tp2', t.tp2); sv('f_tp3', t.tp3)
  sv('f_slbasis', t.slbasis); sv('f_wcinv', t.wcinv); sv('f_h1inv', t.h1inv)
  sv('f_pnl', t.pnl); sv('f_good', t.good); sv('f_bad', t.bad); sv('f_rule', t.rule)
 
  setWaves(t.waves); setChks(t.checks); setFibo(t.fibo)
  if (t.outcome) {
    currentOutcome = t.outcome
    document.querySelector(`.out-btn.${t.outcome.toLowerCase()}`)?.classList.add('sel')
  }
  calcRR()
 
  // Load images from Supabase Storage
  for (const tf of ['H1','M15','M1']) {
    const url = await getImageUrl(id, tf)
    if (url) {
      // Show as img src from URL (not base64)
      const img = g('uzimg_'+tf)
      if (img) {
        img.src = url; img.style.display = 'block'
        g('uzico_'+tf).style.display = 'none'
        g('uztxt_'+tf).style.display = 'none'
        g('uzsub_'+tf).style.display = 'none'
        g('uzov_'+tf).style.display = 'flex'
        g('uz_'+tf).classList.add('has-img')
        // mark as existing (don't re-upload if not changed)
        currentImages[tf] = '__existing__'
      }
    }
  }
 
  g('editBanner').style.display = 'flex'
  g('editLabel').textContent = `${t.num||id} · ${t.waves||'?'} ${t.subwave||''}`
  g('saveBtn').textContent = '💾 Update Trade'
}
 
// ═══════════════════════════════════════════════════════
// DELETE TRADE
// ═══════════════════════════════════════════════════════
window.deleteTrade = async function(id) {
  const t = trades.find(x => x.id === id)
  if (!confirm(`Hapus ${t?.num||id}? Tidak bisa dibatalkan.`)) return
  try {
    await deleteImages(id)
    await removeTrade(id)
    await loadTrades()
    if (selectedTradeId === id) {
      selectedTradeId = null
      g('detailContent').innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><p>Pilih trade dari sidebar.</p></div>'
    }
    renderSidebar(); renderMobileList(); updateCount()
    toast('🗑 Trade dihapus.')
  } catch(err) {
    toast('❌ Gagal hapus: ' + err.message)
  }
}
 
// ═══════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════
function renderHistory() {
  if (!trades.length) { g('histContent').innerHTML = '<div class="empty-state"><div class="empty-icon">≡</div><p>Belum ada data.</p></div>'; return }
  const rows = trades.map(t => {
    const oc = t.outcome||'—'
    const cls = oc==='WIN'?'badge-green':oc==='LOSS'?'badge-red':oc==='BE'?'badge-blue':'badge-muted'
    const p = t.pnl||0
    const isA = t.id===selectedTradeId ? ' class="active-row"' : ''
    return `<tr${isA} onclick="selectTrade('${t.id}')">
      <td style="font-family:var(--mono);color:var(--muted2)">${t.num||t.id}</td>
      <td>${t.date||'—'}</td>
      <td>${t.session||'—'}</td>
      <td><span class="badge ${t.bias==='LONG'?'badge-green':'badge-red'}">${t.bias||'—'}</span></td>
      <td style="font-family:var(--mono)">${t.waves||'—'} ${t.subwave||''}</td>
      <td style="font-family:var(--mono)">${t.entry||'—'}</td>
      <td style="font-family:var(--mono)">${t.sl||'—'}</td>
      <td style="font-family:var(--mono)">${t.tp1||'—'}</td>
      <td><span class="badge ${cls}">${oc}</span></td>
      <td style="font-family:var(--mono);color:${p>0?'var(--green)':p<0?'var(--red)':'var(--muted2)'}">${t.pnl!==null?(p>0?'+':'')+t.pnl:'—'}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--muted2);max-width:140px;overflow:hidden;text-overflow:ellipsis;">${t.m15pat||'—'}</td>
    </tr>`
  }).join('')
  g('histContent').innerHTML = `
    <div class="hist-wrap">
      <table class="hist-tbl">
        <thead><tr><th>ID</th><th>DATE</th><th>SESSION</th><th>BIAS</th><th>WAVE</th><th>ENTRY</th><th>SL</th><th>TP1</th><th>OUTCOME</th><th>PIPS</th><th>M15 PATTERN</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}
 
// ═══════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════
function renderStats() {
  const closed = trades.filter(t => t.outcome)
  const wins   = closed.filter(t => t.outcome==='WIN')
  const losses = closed.filter(t => t.outcome==='LOSS')
  const wr     = closed.length ? (wins.length/closed.length*100).toFixed(1) : '—'
  const totalPips = closed.reduce((s,t) => s+(t.pnl||0), 0)
 
  const avgRR = (() => {
    const rrs = trades.filter(t=>t.sl&&t.entry&&t.tp1).map(t=>{
      const r=Math.abs(t.entry-t.sl); const rw=Math.abs(t.tp1-t.entry)
      return r>0?rw/r:0
    }).filter(x=>x>0)
    return rrs.length ? (rrs.reduce((a,b)=>a+b,0)/rrs.length).toFixed(2) : '—'
  })()
 
  const makeMap = key => {
    const m = {}
    closed.forEach(t => {
      const v = t[key]||'?'
      if (!m[v]) m[v]={w:0,l:0}
      if (t.outcome==='WIN') m[v].w++
      else if (t.outcome==='LOSS') m[v].l++
    })
    return m
  }
 
  const barRow = (label, w, l) => {
    const tot=w+l; const pct=tot?Math.round(w/tot*100):0
    const color = pct>=50?'var(--green)':'var(--red)'
    return `<div class="bar-row">
      <div class="bar-label" title="${label}">${label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-pct" style="color:${color}">${pct}%</div>
      <div class="bar-counts">${w}W/${l}L</div>
    </div>`
  }
 
  const wvMap = makeMap('waves')
  const ssMap = makeMap('session')
  const m15Map = makeMap('m15pat')
 
  g('statsContent').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><label>TOTAL TRADES</label><div class="stat-val" style="color:var(--gold)">${trades.length}</div><div class="stat-sub">${closed.length} closed</div></div>
      <div class="stat-box ${parseFloat(wr)>=50?'green':'red'}"><label>WIN RATE</label><div class="stat-val" style="color:${parseFloat(wr)>=50?'var(--green)':'var(--red)'}">${wr}${wr!=='—'?'%':''}</div><div class="stat-sub">${wins.length}W · ${losses.length}L</div></div>
      <div class="stat-box ${totalPips>=0?'green':'red'}"><label>TOTAL P&L</label><div class="stat-val" style="color:${totalPips>=0?'var(--green)':'var(--red)'}">${totalPips>=0?'+':''}${totalPips.toFixed(0)}</div><div class="stat-sub">pips</div></div>
      <div class="stat-box"><label>AVG R:R</label><div class="stat-val" style="color:var(--gold)">1:${avgRR}</div><div class="stat-sub">dari entry+sl+tp1</div></div>
    </div>
    <div class="grid g2">
      <div class="chart-box">
        <div class="chart-box-title">BY WAVE</div>
        ${Object.entries(wvMap).map(([w,v])=>barRow(w,v.w,v.l)).join('')||'<p style="font-size:11px;color:var(--muted2);">—</p>'}
      </div>
      <div class="chart-box">
        <div class="chart-box-title">BY SESSION</div>
        ${Object.entries(ssMap).map(([s,v])=>barRow(s,v.w,v.l)).join('')||'<p style="font-size:11px;color:var(--muted2);">—</p>'}
      </div>
      <div class="chart-box span2">
        <div class="chart-box-title">BY M15 PATTERN</div>
        ${Object.entries(m15Map).map(([s,v])=>barRow(s,v.w,v.l)).join('')||'<p style="font-size:11px;color:var(--muted2);">—</p>'}
      </div>
    </div>`
}
 
// ═══════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════
window.exportCSV = function() {
  if (!trades.length) { toast('Belum ada data.'); return }
  const cols = ['num','date','session','bias','waves','subwave','h1ctx','h1pat','entry','sl','tp1','tp2','tp3','m15pat','m15ctx','zonestr','outcome','pnl','good','bad','rule']
  const rows = [cols.join(','), ...trades.map(t => cols.map(c=>`"${(t[c]||'').toString().replace(/"/g,'""')}"`).join(','))]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([rows.join('\n')], {type:'text/csv'}))
  a.download = `EW_Journal_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}
 
// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
window.toast = function(msg) {
  const el = g('toast')
  el.textContent = msg; el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2800)
}
 
// ── BOOT ──
init()
 
