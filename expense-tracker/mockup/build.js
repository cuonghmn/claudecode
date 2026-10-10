/**
 * Tạo bản mockup chạy độc lập (không cần Google) từ chính Index.html + Code.gs.
 *   node expense-tracker/mockup/build.js
 * → expense-tracker/mockup/index.html
 *
 * Google Sheet được giả lập trong trình duyệt (lưu localStorage), nên mọi nút
 * trong mockup chạy đúng logic của app thật. AI chưa bật (chế độ offline).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');

const between = (s, a, b) => s.slice(s.indexOf(a) + a.length, s.indexOf(b, s.indexOf(a)));
const fontLink = index.match(/<link[^>]+fonts\.googleapis[^>]+>/)[0];
const style = between(index, '<style>', '</style>');
const body = between(index, '<body>', '</body>');

const API = ['getInitData', 'getTransactions', 'getRecent', 'getDashboard', 'getMonthTotals', 'addTransactions',
  'updateTransaction', 'deleteTransaction', 'deleteTransactions', 'saveBudgets', 'setMonthBudget', 'applyMonthAsDefault', 'getCategoryList', 'saveCategory', 'deleteCategory', 'parseInput', 'monthlyReview'];

const mockStyle = `
  .mock-bar { max-width: 720px; margin: 0 auto; padding: 10px 16px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .mock-tag { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--warn); border: 1px solid currentColor; border-radius: 6px; padding: 2px 7px; }
  .mock-bar .muted { flex: 1; min-width: 160px; font-size: 12px; }
  .mock-bar button { padding: 6px 10px; font-size: 13px; }
  .fb-item { padding: 12px 0; border-bottom: 1px solid var(--line); }
  .fb-item:last-child { border-bottom: 0; }
  .fb-q { font-weight: 600; }
  .fb-hint { font-size: 12px; color: var(--muted); margin: 2px 0 8px; }
  .seg { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .seg button { padding: 6px 10px; font-size: 13px; background: var(--bg); color: var(--muted); border: 1px solid var(--line); font-weight: 500; }
  .seg button.on { background: var(--brand-soft); color: var(--brand); border-color: var(--brand); font-weight: 600; }
  .fb-item textarea { min-height: 44px; font-size: 14px; }
  #fbOut { min-height: 160px; font-size: 13px; }
`;

/**
 * Lớp giả lập Google Sheet + google.script.run.
 * opts.key: khóa localStorage; opts.latency: độ trễ (ms); opts.alwaysReset: luôn nạp lại dữ liệu mẫu khi mở.
 */
const mockScriptFor = opts => `
/* ===== Giả lập Google Apps Script trong trình duyệt ===== */
const MOCK_KEY = '${opts.key}';
const Backend = (function () {
  function Sheet(d) { this.d = d || []; }
  Sheet.prototype.getLastRow = function () { return this.d.length; };
  Sheet.prototype.getRange = function (r, c, nr, nc) {
    const sh = this;
    if (typeof r === 'string') {
      return {
        createTextFinder: v => ({ matchEntireCell: () => ({ findNext: () => {
          const i = sh.d.findIndex(x => String(x[0]) === v); return i < 0 ? null : { getRow: () => i + 1 }; } }) }),
        setNumberFormat() { return this; }
      };
    }
    nr = nr || 1; nc = nc || 1;
    const R = {
      getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = sh.d[r - 1 + i] || [];
        o.push(Array.from({ length: nc }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return o; },
      setValues: v => { v.forEach((row, i) => { sh.d[r - 1 + i] = sh.d[r - 1 + i] || [];
        row.forEach((x, j) => { sh.d[r - 1 + i][c - 1 + j] = x; }); }); persist(); return R; },
      clearContent: () => { for (let i = 0; i < nr; i++) sh.d[r - 1 + i] = [];
        while (sh.d.length && !sh.d[sh.d.length - 1].length) sh.d.pop(); persist(); return R; },
      setFontWeight: () => R, setBackground: () => R, setFontColor: () => R, setNumberFormat: () => R
    };
    return R;
  };
  Sheet.prototype.deleteRow = function (r) { this.d.splice(r - 1, 1); persist(); };
  Sheet.prototype.setFrozenRows = Sheet.prototype.setColumnWidth = function () {};

  let sheets = {};
  const ss = { getId: () => 'mock', getUrl: () => '', getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = new Sheet()), getSheets: () => Object.values(sheets), deleteSheet() {} };
  function persist() {
    try {
      const raw = {}; Object.keys(sheets).forEach(k => { raw[k] = sheets[k].d; });
      localStorage.setItem(MOCK_KEY, JSON.stringify(raw, (k, v) => v));
    } catch (e) { /* trình duyệt chặn lưu: mockup vẫn chạy, chỉ không nhớ sau khi tải lại */ }
  }
  function restore() {
    try {
      const raw = JSON.parse(localStorage.getItem(MOCK_KEY) || 'null');
      if (!raw) return false;
      const iso = /^\\d{4}-\\d{2}-\\d{2}T/;
      Object.keys(raw).forEach(k => { sheets[k] = new Sheet(raw[k].map(r => r.map(v => typeof v === 'string' && iso.test(v) ? new Date(v) : v))); });
      return true;
    } catch (e) { return false; }
  }
  const pad = n => String(n).padStart(2, '0');
  const SpreadsheetApp = { getActiveSpreadsheet: () => ss, openById: () => ss };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) };
  const Session = { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' };
  const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  const Utilities = {
    getUuid: () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16),
    formatDate: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  };

  /* ---- Code.gs (nguyên bản) ---- */
${code}
  /* ---- hết Code.gs ---- */

  function reset() {
    sheets = {}; try { localStorage.removeItem(MOCK_KEY); } catch (e) {}
    setup(); seedDemoData(); persist();
  }
  if (${opts.alwaysReset ? 'true' : 'false'} || !restore()) reset(); else setup(); // setup an toàn khi chạy lại: nâng cấp dữ liệu cũ (vd thêm cột Loại)
  return { ${API.join(', ')}, reset };
})();

window.google = { script: { get run() {
  let ok = () => {}, err = () => {};
  const px = new Proxy({}, { get(t, k) {
    if (k === 'withSuccessHandler') return f => { ok = f; return px; };
    if (k === 'withFailureHandler') return f => { err = f; return px; };
    return (...a) => setTimeout(() => {
      try { ok(JSON.parse(JSON.stringify(Backend[k].apply(null, JSON.parse(JSON.stringify(a)))))); }
      catch (e) { err(e); }
    }, ${opts.latency}); // giả lập độ trễ của Apps Script
  } });
  return px;
} } };
`;
const mockScript = mockScriptFor({ key: 'so-chi-tieu-mockup-v1', latency: 500, alwaysReset: false });

const FEEDBACK = [
  ['entry', 'Ghi nhanh bằng câu tự nhiên', 'Thử gõ "trưa phở 55k, grab 32k" → Phân tích → Lưu. Có đủ nhanh để ghi mỗi ngày không?'],
  ['categories', '10 danh mục chi tiêu', 'Ăn uống, Đi lại, Nhà ở & Hóa đơn, Mua sắm, Sức khỏe, Học tập, Giải trí, Gia đình & Hiếu hỉ, Tiết kiệm & Đầu tư, Khác. Thiếu/thừa gì?'],
  ['method', 'Phương thức thanh toán', 'Chuyển khoản / Thẻ / Tiền mặt / Ví điện tử. Có cần ghi rõ thẻ nào, tài khoản nào không?'],
  ['dashboard', 'Tổng quan tháng', '4 KPI, cảnh báo dự báo vượt ngân sách, chi theo danh mục, theo ngày, top 5 khoản. Đúng thứ Rio cần nhìn?'],
  ['budget', 'Ngân sách theo danh mục', 'Mức mẫu: 16,3 triệu chi tiêu + 3 triệu mục tiêu để dành mỗi tháng. Cách đặt theo từng danh mục có phù hợp?'],
  ['history', 'Lịch sử & sửa/xóa', 'Lọc theo tháng, danh mục, tìm kiếm; bấm vào khoản để sửa/xóa.'],
  ['review', 'Nhận xét cuối tháng', 'Bản mockup dùng nhận xét theo quy tắc; bật AI (Gemini/Claude) sẽ có phân tích và 3 hành động cụ thể.']
];
const WISHES = ['Theo dõi thu nhập', 'Khoản chi định kỳ tự động', 'Mục tiêu tiết kiệm', 'Dùng chung với gia đình',
  'Nhiều ví / tài khoản', 'Chụp hóa đơn', 'Email tổng kết hằng tháng', 'Xuất báo cáo'];

const feedbackScript = `
/* ===== Bảng góp ý mockup ===== */
const FB = ${JSON.stringify(FEEDBACK)};
const WISHES = ${JSON.stringify(WISHES)};
const FB_KEY = 'so-chi-tieu-feedback-v1';
let fb = {};
try { fb = JSON.parse(localStorage.getItem(FB_KEY) || '{}'); } catch (e) {}
const saveFb = () => { try { localStorage.setItem(FB_KEY, JSON.stringify(fb)); } catch (e) {} };

function openFeedback() {
  fb.wish = fb.wish || [];
  const seg = (id, v) => ['Ổn', 'Cần chỉnh', 'Bỏ'].map(o =>
    '<button class="' + (v === o ? 'on' : '') + '" onclick="setFb(\\'' + id + '\\',\\'' + o + '\\',this)">' + o + '</button>').join('');
  openModal('<div class="row"><h2 class="grow" style="margin:0">Góp ý cho mockup</h2><button class="ghost" onclick="closeModal()">Đóng</button></div>' +
    '<p class="muted">Đánh giá từng phần, ghi chú chỗ cần chỉnh, rồi bấm <b>Copy góp ý</b> và dán vào chat với Claude.</p>' +
    FB.map(([id, q, hint]) => '<div class="fb-item"><div class="fb-q">' + esc(q) + '</div><div class="fb-hint">' + esc(hint) + '</div>' +
      '<div class="seg" id="seg-' + id + '">' + seg(id, (fb[id] || {}).v) + '</div>' +
      '<textarea id="note-' + id + '" placeholder="Ghi chú (không bắt buộc)" oninput="noteFb(\\'' + id + '\\',this.value)">' + esc((fb[id] || {}).n || '') + '</textarea></div>').join('') +
    '<div class="fb-item"><div class="fb-q">Muốn có thêm</div><div class="fb-hint">Chọn những tính năng Rio thấy cần.</div><div class="seg" id="wish">' +
      WISHES.map((w, i) => '<button class="' + (fb.wish.indexOf(w) >= 0 ? 'on' : '') + '" onclick="toggleWish(' + i + ',this)">' + esc(w) + '</button>').join('') +
    '</div><textarea id="note-other" placeholder="Ý khác…" oninput="noteFb(\\'other\\',this.value)">' + esc((fb.other || {}).n || '') + '</textarea></div>' +
    '<div class="row" style="margin-top:12px"><span class="grow"></span><button class="primary" onclick="copyFb()">Copy góp ý</button></div>' +
    '<textarea id="fbOut" class="hidden" readonly></textarea>');
}
function setFb(id, v, el) {
  fb[id] = fb[id] || {}; fb[id].v = fb[id].v === v ? '' : v; saveFb();
  el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === fb[id].v));
}
function noteFb(id, v) { fb[id] = fb[id] || {}; fb[id].n = v; saveFb(); }
function toggleWish(i, el) {
  const w = WISHES[i], k = fb.wish.indexOf(w);
  if (k >= 0) fb.wish.splice(k, 1); else fb.wish.push(w);
  el.classList.toggle('on', k < 0); saveFb();
}
function fbText() {
  const lines = ['GÓP Ý MOCKUP SỔ CHI TIÊU'];
  FB.forEach(([id, q]) => { const x = fb[id] || {}; if (x.v || x.n) lines.push('- ' + q + ': ' + (x.v || '—') + (x.n ? ' | ' + x.n : '')); });
  if (fb.wish && fb.wish.length) lines.push('- Muốn thêm: ' + fb.wish.join(', '));
  if (fb.other && fb.other.n) lines.push('- Ý khác: ' + fb.other.n);
  if (lines.length === 1) lines.push('(chưa có góp ý)');
  return lines.join('\\n');
}
function copyFb() {
  const t = fbText(), out = $('fbOut');
  out.value = t; out.classList.remove('hidden');
  const done = () => toast('Đã copy, dán vào chat với Claude nhé');
  const fallback = () => { out.focus(); out.select(); toast('Hãy chọn và copy đoạn bên dưới'); };
  try { navigator.clipboard.writeText(t).then(done, fallback); } catch (e) { fallback(); }
}
function resetMock() {
  const b = $('btnReset');
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Bấm lần nữa'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Đặt lại dữ liệu'; }, 3000); return; }
  Backend.reset(); delete b.dataset.armed; b.textContent = 'Đặt lại dữ liệu';
  toast('Đã nạp lại dữ liệu mẫu'); refreshCurrent();
}
`;

const bar = `<div class="mock-bar">
  <span class="mock-tag">Mockup</span>
  <span class="muted">Dữ liệu mẫu · chế độ offline</span>
  <button class="ghost" id="btnReset" onclick="resetMock()">Đặt lại dữ liệu</button>
  <button onclick="openFeedback()">📝 Góp ý</button>
</div>`;

const out = `<title>Sổ chi tiêu cá nhân</title>
${fontLink}
<style>${style}${mockStyle}</style>
<script>${mockScript}</script>
${bar}
${body.replace(/<script>/, '<script>' + feedbackScript)}
`;

fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log('Đã tạo mockup/index.html (' + Math.round(out.length / 1024) + ' KB)');

// Bản app cho "Hướng dẫn sử dụng tự diễn": luôn bắt đầu từ dữ liệu mẫu sạch, độ trễ ngắn, không có thanh mockup.
const tourApp = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${fontLink}
<style>${style}</style>
<script>${mockScriptFor({ key: 'so-chi-tieu-tour-v1', latency: 180, alwaysReset: true })}</script>
</head><body>${body}</body></html>`;
const tourDir = path.join(root, 'docs', 'src');
fs.mkdirSync(tourDir, { recursive: true });
fs.writeFileSync(path.join(tourDir, 'app-tour.html'), tourApp);
console.log('Đã tạo docs/src/app-tour.html (' + Math.round(tourApp.length / 1024) + ' KB)');
