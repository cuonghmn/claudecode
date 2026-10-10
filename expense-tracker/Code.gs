/**
 * Sổ chi tiêu cá nhân — Google Sheets + Apps Script + AI (Gemini free hoặc Claude)
 *
 * Sheet "GiaoDich": mỗi dòng là 1 khoản chi.
 * Sheet "DanhMuc":  danh mục, icon, ngân sách tháng, từ khóa nhận diện (sửa trực tiếp trên Sheet được).
 *
 * Script Properties (Project Settings → Script properties):
 *   AI_PROVIDER        gemini | claude | off. Bỏ trống: tự chọn theo key đang có (ưu tiên Gemini).
 *   GEMINI_API_KEY     key miễn phí từ Google AI Studio (aistudio.google.com → Get API key).
 *   GEMINI_MODEL       (tùy chọn) mặc định gemini-flash-latest.
 *   ANTHROPIC_API_KEY  key Claude (platform.claude.com) — khi chuyển sang Claude.
 *   CLAUDE_MODEL       (tùy chọn) mặc định claude-opus-5-5.
 * Không có key nào thì app dùng bộ tách quy tắc (offline) — vẫn chạy bình thường.
 */

const SHEET_TX = 'GiaoDich';
const SHEET_CAT = 'DanhMuc';
const SHEET_BUD = 'NganSachThang'; // hạn mức riêng từng tháng (chỉ các tháng có chỉnh khác mặc định)
const BUD_HEADERS = ['Tháng (yyyy-MM)', 'Danh mục', 'Hạn mức'];
const TX_HEADERS = ['ID', 'Ngày', 'Số tiền', 'Danh mục', 'Mô tả', 'Phương thức', 'Ghi chú', 'Tạo lúc'];
const CAT_HEADERS = ['Danh mục', 'Icon', 'Ngân sách tháng', 'Từ khóa (cách nhau bởi dấu phẩy)', 'Loại'];
// Loại danh mục: "Chi tiêu" tính vào tổng chi; "Để dành" (tiết kiệm, đầu tư…) là phân bổ tiền,
// không tính vào tổng chi/ngân sách chi, theo dõi riêng so với mục tiêu.
const KIND_SPEND = 'Chi tiêu';
const KIND_SAVE = 'Để dành';
const METHODS = ['Chuyển khoản', 'Thẻ', 'Tiền mặt', 'Ví điện tử'];
const DEFAULT_METHOD = 'Chuyển khoản';
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
// Các model hỗ trợ fallbacks "default" (tự chuyển model khi bị bộ lọc an toàn từ chối nhầm).
// Khoản >= ngưỡng này coi là khoản lớn/cố định (tiền nhà, tiết kiệm…): không ngoại suy khi dự báo cuối tháng.
const BIG_ITEM_THRESHOLD = 1000000;
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

const DEFAULT_CATEGORIES = [
  ['Ăn uống', '🍜', 4000000, 'ăn,phở,bún,cơm,mì,bánh mì,trưa,tối,sáng,cafe,cà phê,coffee,trà sữa,trà,nước,nhậu,bia,lẩu,nướng,highland,starbucks,phúc long,grabfood,shopeefood,đi chợ,siêu thị,winmart,bách hóa xanh,trái cây', KIND_SPEND],
  ['Đi lại', '🛵', 1000000, 'grab,be,xanh sm,taxi,xăng,gửi xe,vé xe,xe buýt,bus,metro,máy bay,vé máy bay,rửa xe,sửa xe,thay nhớt,cầu đường', KIND_SPEND],
  ['Nhà ở & Hóa đơn', '🏠', 6000000, 'tiền nhà,thuê nhà,điện,tiền điện,tiền nước,internet,wifi,cước,điện thoại,4g,gas,phí quản lý,chung cư', KIND_SPEND],
  ['Mua sắm', '🛍️', 2000000, 'mua,quần,áo,giày,dép,túi,shopee,lazada,tiki,tiktok shop,đồ dùng,mỹ phẩm,cắt tóc', KIND_SPEND],
  ['Sức khỏe', '💊', 500000, 'thuốc,khám,bệnh viện,phòng khám,nha khoa,gym,yoga,bảo hiểm,vitamin', KIND_SPEND],
  ['Học tập', '📚', 500000, 'sách,khóa học,course,học phí,udemy,coursera,học', KIND_SPEND],
  ['Giải trí', '🎬', 800000, 'phim,xem phim,cgv,netflix,spotify,youtube,game,karaoke,du lịch,khách sạn,vé xem', KIND_SPEND],
  ['Gia đình & Hiếu hỉ', '🎁', 1000000, 'biếu,mừng,đám cưới,cưới,đám,sinh nhật,quà,gửi mẹ,gửi bố,gia đình,lì xì', KIND_SPEND],
  ['Tiết kiệm & Đầu tư', '💰', 3000000, 'tiết kiệm,gửi tiết kiệm,đầu tư,chứng khoán,cổ phiếu,vàng,quỹ,ccq', KIND_SAVE],
  ['Khác', '📌', 500000, '', KIND_SPEND]
];

/* ============================ Web app & menu ============================ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sổ chi tiêu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💰 Chi tiêu')
    .addItem('1. Khởi tạo / sửa cấu trúc Sheet', 'setup')
    .addSeparator()
    .addItem('Thêm dữ liệu DEMO (6 tháng)', 'seedDemoData')
    .addItem('Xóa dữ liệu DEMO', 'removeDemoData')
    .addToUi();
}

/** Chạy 1 lần: tạo 3 sheet (GiaoDich, DanhMuc, NganSachThang), tiêu đề, danh mục mặc định, lưu ID file. An toàn khi chạy lại. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Hãy mở Apps Script từ Google Sheet (Tiện ích mở rộng → Apps Script) rồi chạy setup.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  let tx = ss.getSheetByName(SHEET_TX);
  if (!tx) tx = ss.insertSheet(SHEET_TX);
  tx.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  tx.setFrozenRows(1);
  tx.getRange('A:A').setNumberFormat('@');   // ID là chữ: không để Sheets tự đổi "01234567"/"12345e67" thành số
  tx.getRange('B:B').setNumberFormat('dd/MM/yyyy');
  tx.getRange('C:C').setNumberFormat('#,##0');
  tx.getRange('H:H').setNumberFormat('dd/MM/yyyy HH:mm');
  tx.setColumnWidth(1, 110); tx.setColumnWidth(5, 260);

  let cat = ss.getSheetByName(SHEET_CAT);
  if (!cat) {
    cat = ss.insertSheet(SHEET_CAT);
    cat.getRange(2, 1, DEFAULT_CATEGORIES.length, 5).setValues(DEFAULT_CATEGORIES);
  }
  // Nâng cấp sheet cũ (chưa có cột Loại): điền mặc định, danh mục tiết kiệm/đầu tư là "Để dành".
  const nCat = cat.getLastRow() - 1;
  if (nCat > 0) {
    const r = cat.getRange(2, 1, nCat, 5), v = r.getValues();
    let changed = false;
    v.forEach(row => {
      if (row[0] && row[4] !== KIND_SPEND && row[4] !== KIND_SAVE) {
        row[4] = /tiết kiệm|đầu tư/i.test(String(row[0])) ? KIND_SAVE : KIND_SPEND; changed = true;
      }
    });
    if (changed) r.setValues(v);
  }
  cat.getRange(1, 1, 1, CAT_HEADERS.length).setValues([CAT_HEADERS])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  cat.setFrozenRows(1);
  cat.getRange('C:C').setNumberFormat('#,##0');
  cat.setColumnWidth(4, 480);

  const bud = budSheet_();
  bud.getRange(1, 1, 1, BUD_HEADERS.length).setValues([BUD_HEADERS])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  bud.setFrozenRows(1);
  bud.getRange('A:A').setNumberFormat('@');
  bud.getRange('C:C').setNumberFormat('#,##0');

  const sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (sheet1 && sheet1.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(sheet1);
  return 'OK';
}

/* ============================ Helpers ============================ */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Chưa khởi tạo. Mở Apps Script và chạy hàm setup trước.');
  return active;
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy sheet "' + name + '". Hãy chạy setup.');
  return sh;
}

function tz_() { return Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh'; }
function todayStr_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function toDate_(ymd) {
  const p = String(ymd).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

/** Cộng ngày trên chuỗi yyyy-MM-dd (thuần, không phụ thuộc múi giờ). */
function addDays_(ymd, n) {
  const p = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

/** Ngày yyyy-MM-dd có thật không (loại 31/02, 31/04, 29/02 năm không nhuận…). */
function isValidYmd_(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd)) && addDays_(String(ymd), 0) === String(ymd);
}

function prevMonth_(ym) {
  const p = ym.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 2, 1));
  return d.toISOString().slice(0, 7);
}

function daysInMonth_(ym) {
  const p = ym.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ============================ Đọc dữ liệu ============================ */

function getCategories_() {
  const sh = sheet_(SHEET_CAT);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 5).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({
      name: String(r[0]).trim(),
      icon: String(r[1] || '•'),
      budget: Number(r[2]) || 0,
      keywords: String(r[3] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      kind: String(r[4]).trim() === KIND_SAVE ? 'save' : 'spend'
    }));
}

/* ---------- Ngân sách theo tháng: mặc định (DanhMuc) + chỉnh riêng (NganSachThang) ---------- */

function budSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_BUD);
  if (!sh) {
    sh = ss.insertSheet(SHEET_BUD);
    sh.getRange(1, 1, 1, BUD_HEADERS.length).setValues([BUD_HEADERS]);
    sh.getRange('A:A').setNumberFormat('@');
  }
  return sh;
}

function ymOf_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM');
  const m = String(v || '').trim().match(/^(\d{4})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}

/** { 'yyyy-MM': { 'Danh mục': hạn mức } } */
function readOverrides_() {
  const sh = budSheet_();
  const n = sh.getLastRow() - 1;
  const map = {};
  if (n < 1) return map;
  sh.getRange(2, 1, n, 3).getValues().forEach(r => {
    const ym = ymOf_(r[0]), c = String(r[1] || '').trim();
    if (ym && c) (map[ym] = map[ym] || {})[c] = Math.max(0, Math.round(Number(r[2]) || 0));
  });
  return map;
}

function writeOverrides_(map) {
  const sh = budSheet_();
  const rows = [];
  Object.keys(map).sort().forEach(ym => Object.keys(map[ym]).sort().forEach(c => rows.push([ym, c, map[ym][c]])));
  const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 3).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

/** Danh mục với hạn mức áp dụng cho tháng ym: budget = hạn mức của tháng, defaultBudget = mặc định. */
function budgetsFor_(cats, ov, ym) {
  const m = ov[ym] || {};
  return cats.map(c => Object.assign({}, c, {
    defaultBudget: c.budget,
    budget: c.name in m ? m[c.name] : c.budget,
    overridden: c.name in m
  }));
}

/**
 * Trước khi đổi hạn mức MẶC ĐỊNH (áp dụng từ tháng fromYm): ghi hạn mức cũ vào các tháng trước đó
 * (từ tháng có giao dịch sớm nhất) chưa có chỉnh riêng — để số liệu lịch sử không bị tính lại.
 */
function preserveHistory_(ov, name, oldBudget, fromYm) {
  let first = '';
  readTx_().forEach(t => { const ym = t.date.slice(0, 7); if (!first || ym < first) first = ym; });
  if (!first) return;
  for (let ym = prevMonth_(fromYm); ym >= first; ym = prevMonth_(ym)) {
    if (!(ov[ym] && name in ov[ym])) (ov[ym] = ov[ym] || {})[name] = oldBudget;
  }
}

function setDefaultBudget_(name, budget) {
  const sh = sheet_(SHEET_CAT);
  const n = sh.getLastRow() - 1;
  const names = sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim());
  const idx = names.indexOf(name);
  if (idx >= 0) sh.getRange(idx + 2, 3, 1, 1).setValues([[budget]]);
}

/** Đặt hạn mức riêng cho 1 danh mục trong 1 tháng. Bằng mặc định thì bỏ phần chỉnh riêng. */
function setMonthBudget(month, name, amount) {
  month = ymOf_(month);
  if (!month) throw new Error('Tháng không hợp lệ.');
  amount = Math.max(0, Math.round(Number(amount) || 0));
  return withLock_(() => {
    const cat = getCategories_().filter(c => c.name === name)[0];
    if (!cat) throw new Error('Không tìm thấy danh mục "' + name + '".');
    const ov = readOverrides_();
    if (amount === cat.budget) { if (ov[month]) delete ov[month][name]; }
    else (ov[month] = ov[month] || {})[name] = amount;
    writeOverrides_(ov);
    return { name: name, budget: amount, defaultBudget: cat.budget, overridden: amount !== cat.budget };
  });
}

/** "Dùng cho các tháng sau": các hạn mức chỉnh riêng của tháng này thành mặc định mới (từ tháng này trở đi). */
function applyMonthAsDefault(month) {
  month = ymOf_(month);
  return withLock_(() => {
    const ov = readOverrides_();
    const m = ov[month] || {};
    const cats = getCategories_();
    let k = 0;
    Object.keys(m).forEach(name => {
      const cat = cats.filter(c => c.name === name)[0];
      if (!cat) return;
      preserveHistory_(ov, name, cat.budget, month);
      setDefaultBudget_(name, m[name]);
      delete m[name]; k++;
    });
    writeOverrides_(ov);
    return k;
  });
}

function readTx_() {
  const sh = sheet_(SHEET_TX);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, TX_HEADERS.length).getValues()
    .filter(r => r[0])
    .map(r => ({
      id: String(r[0]),
      date: fmtDate_(r[1]),
      amount: Number(r[2]) || 0,
      category: String(r[3] || 'Khác'),
      description: fromSheetText_(r[4]),
      method: String(r[5] || ''),
      note: fromSheetText_(r[6]),
      createdAt: r[7] instanceof Date ? r[7].getTime() : 0
    }));
}

function sortTx_(list) {
  return list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt));
}

/* ============================ API cho giao diện ============================ */

function getInitData() {
  const cats = getCategories_();
  return {
    categories: cats.map(c => ({ name: c.name, icon: c.icon, budget: c.budget, kind: c.kind })),
    methods: METHODS,
    defaultMethod: DEFAULT_METHOD,
    today: todayStr_(),
    aiName: aiName_(),
    sheetUrl: ss_().getUrl()
  };
}

/** Lọc theo tháng (yyyy-MM) HOẶC theo khoảng ngày from..to (yyyy-MM-dd, tính cả 2 đầu). */
function getTransactions(month, category, query, from, to) {
  const q = String(query || '').trim().toLowerCase();
  if (from && to && from > to) { const x = from; from = to; to = x; }
  const byRange = !!(from || to);
  const list = readTx_().filter(t =>
    (byRange ? (!from || t.date >= from) && (!to || t.date <= to) : (!month || t.date.slice(0, 7) === month)) &&
    (!category || t.category === category) &&
    (!q || (t.description + ' ' + t.note + ' ' + t.category).toLowerCase().indexOf(q) >= 0));
  return sortTx_(list);
}

/**
 * Khoản chi gần đây theo khoảng thời gian (tính cả hôm nay):
 * '3d' = 3 ngày, '5d' = 5 ngày, 'week' = từ thứ 2 tuần này, 'month' = từ ngày 1 tháng này.
 */
function getRecent(range) {
  const today = todayStr_();
  let start;
  if (range === '5d') start = addDays_(today, -4);
  else if (range === 'week') start = addDays_(today, -((toDate_(today).getDay() + 6) % 7));
  else if (range === 'month') start = today.slice(0, 7) + '-01';
  else { range = '3d'; start = addDays_(today, -2); }
  const all = readTx_();
  const isSave = saveNames_(getCategories_());
  const items = sortTx_(all.filter(t => t.date >= start && t.date <= today));
  return {
    range: range,
    start: start,
    todayTotal: all.filter(t => t.date === today && !isSave[t.category]).reduce((s, t) => s + t.amount, 0),
    total: items.filter(t => !isSave[t.category]).reduce((s, t) => s + t.amount, 0),
    saved: items.filter(t => isSave[t.category]).reduce((s, t) => s + t.amount, 0),
    items: items,
    quick: quickPicks_(all, today)
  };
}

/**
 * "Ghi lại nhanh": tối đa 4 khoản hay ghi nhất trong 60 ngày gần đây (cùng mô tả + danh mục),
 * kèm số tiền của lần ghi gần nhất.
 */
function quickPicks_(all, today) {
  const since = addDays_(today, -60);
  const groups = {};
  sortTx_(all.filter(t => t.date >= since && t.date <= today && t.description)).forEach(t => {
    const k = t.description.trim().toLowerCase() + '|' + t.category;
    if (!groups[k]) groups[k] = { description: t.description.trim(), category: t.category, method: t.method, amount: t.amount, n: 0 };
    groups[k].n++;
  });
  return Object.keys(groups).map(k => groups[k]).filter(g => g.n >= 2)
    .sort((a, b) => b.n - a.n).slice(0, 4)
    .map(g => ({ description: g.description, category: g.category, method: g.method, amount: g.amount }));
}

/** Chi ở danh mục chưa có ngân sách (ngân sách = 0) trong tháng. */
function offBudget_(byCatMap) {
  const cats = Object.keys(byCatMap).map(k => byCatMap[k]).filter(c => !c.budget && c.amount)
    .sort((a, b) => b.amount - a.amount);
  return { total: cats.reduce((s, c) => s + c.amount, 0), categories: cats.map(c => ({ name: c.name, amount: c.amount })) };
}

/**
 * Tổng CHI (không gồm để dành) của từng tháng, từ tháng cũ nhất có dữ liệu (ít nhất 6 tháng gần nhất,
 * tối đa 24 tháng) đến tháng hiện tại. Dùng cho dải chọn tháng.
 */
function monthTotals_(allTx, isSave, today, from) {
  const cur = today.slice(0, 7);
  let start = cur;
  for (let i = 0; i < 5; i++) start = prevMonth_(start);                  // ít nhất 6 tháng gần nhất
  allTx.forEach(t => { const ym = t.date.slice(0, 7); if (ym < start) start = ym; });
  let cap = cur;
  for (let i = 0; i < 23; i++) cap = prevMonth_(cap);
  if (start < cap) start = cap;                                            // tối đa 24 tháng
  if (from && /^\d{4}-\d{2}$/.test(from) && from >= '2000-01' && from < start) start = from; // đang xem tháng cũ hơn: kéo dải tới đó
  const sums = {};
  allTx.forEach(t => { if (!isSave[t.category]) { const ym = t.date.slice(0, 7); sums[ym] = (sums[ym] || 0) + t.amount; } });
  const list = [];
  for (let ym = cur; ym >= start; ym = prevMonth_(ym)) list.unshift({ ym: ym, spend: sums[ym] || 0 });
  return list;
}

/** from (tùy chọn, yyyy-MM): bảo đảm dải tháng kéo dài tới tháng này. */
function getMonthTotals(from) {
  return monthTotals_(readTx_(), saveNames_(getCategories_()), todayStr_(), from);
}

/** Tên các danh mục loại "Để dành". */
function saveNames_(cats) {
  const m = {}; cats.forEach(c => { if (c.kind === 'save') m[c.name] = true; }); return m;
}

function getDashboard(month) {
  const allCats = budgetsFor_(getCategories_(), readOverrides_(), month); // hạn mức của đúng tháng đang xem
  const isSave = saveNames_(allCats);
  const cats = allCats.filter(c => c.kind !== 'save');      // mọi số liệu "chi" chỉ tính danh mục Chi tiêu
  const saveCats = allCats.filter(c => c.kind === 'save');
  const allTx = readTx_();
  const all = allTx.filter(t => !isSave[t.category]);
  const prev = prevMonth_(month);
  const cur = all.filter(t => t.date.slice(0, 7) === month);
  const prevTx = all.filter(t => t.date.slice(0, 7) === prev);
  const total = cur.reduce((s, t) => s + t.amount, 0);
  const prevTotal = prevTx.reduce((s, t) => s + t.amount, 0);
  const budget = cats.reduce((s, c) => s + c.budget, 0);

  // Để dành trong tháng, so với mục tiêu (= "ngân sách" của danh mục Để dành)
  const savedTx = allTx.filter(t => isSave[t.category] && t.date.slice(0, 7) === month);
  const savings = {
    total: savedTx.reduce((s, t) => s + t.amount, 0),
    target: saveCats.reduce((s, c) => s + c.budget, 0),
    categories: saveCats.map(c => ({
      name: c.name, icon: c.icon, target: c.budget,
      amount: savedTx.filter(t => t.category === c.name).reduce((s, t) => s + t.amount, 0)
    })).filter(c => c.amount || c.target)
  };

  const today = todayStr_();
  const days = daysInMonth_(month);
  const elapsed = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : (month < today.slice(0, 7) ? days : 0);

  const byCatMap = {};
  cats.forEach(c => { byCatMap[c.name] = { name: c.name, icon: c.icon, budget: c.budget, amount: 0, prev: 0, count: 0 }; });
  // (danh mục Để dành không có trong byCatMap vì giao dịch của chúng đã được lọc khỏi "all")
  const ensure = name => byCatMap[name] || (byCatMap[name] = { name: name, icon: '•', budget: 0, amount: 0, prev: 0, count: 0 });
  cur.forEach(t => { const c = ensure(t.category); c.amount += t.amount; c.count++; });
  prevTx.forEach(t => { ensure(t.category).prev += t.amount; });

  // So cùng kỳ: ngày 1..N tháng này với ngày 1..N tháng trước (N = số ngày đã qua).
  // Tháng đã kết thúc thì so cả tháng trước (kể cả ngày 31 khi tháng này chỉ có 30 ngày)
  const prevSamePeriod = elapsed >= days ? prevTotal
    : prevTx.filter(t => Number(t.date.slice(8, 10)) <= elapsed).reduce((s, t) => s + t.amount, 0);

  // Dự báo = đã chi + (chi thường ngày TB × số ngày còn lại). Khoản lớn không bị nhân lên.
  const routine = cur.filter(t => t.amount < BIG_ITEM_THRESHOLD).reduce((s, t) => s + t.amount, 0);
  const avgRoutine = elapsed ? routine / elapsed : 0;

  const daily = [], dailyRoutine = [];
  for (let d = 1; d <= days; d++) { daily.push(0); dailyRoutine.push(0); }
  cur.forEach(t => {
    const i = Number(t.date.slice(8, 10)) - 1;
    daily[i] += t.amount;
    if (t.amount < BIG_ITEM_THRESHOLD) dailyRoutine[i] += t.amount;
  });
  const big = cur.filter(t => t.amount >= BIG_ITEM_THRESHOLD);

  return {
    month: month,
    total: total,
    prevTotal: prevTotal,
    prevSamePeriod: prevSamePeriod,
    budget: budget,
    count: cur.length,
    daysInMonth: days,
    daysElapsed: elapsed,
    avgPerDay: Math.round(avgRoutine),
    forecast: elapsed ? Math.round(total + avgRoutine * (days - elapsed)) : 0,
    byCategory: Object.keys(byCatMap).map(k => byCatMap[k])
      .filter(c => c.amount || c.budget)
      .sort((a, b) => b.amount - a.amount),
    daily: daily,
    dailyRoutine: dailyRoutine,           // chỉ chi thường ngày, để biểu đồ không bị khoản lớn lấn át
    bigItems: { count: big.length, total: big.reduce((s, t) => s + t.amount, 0), threshold: BIG_ITEM_THRESHOLD },
    top: cur.slice().sort((a, b) => b.amount - a.amount).slice(0, 5),
    offBudget: offBudget_(byCatMap),
    savings: savings,
    months: monthTotals_(allTx, isSave, today, month)
  };
}

/* ============================ Ghi / sửa / xóa ============================ */

function normalizeItem_(it, catNames, today) {
  const amount = Math.round(Number(String(it.amount).replace(/[^\d.-]/g, '')));
  if (!amount || amount <= 0) throw new Error('Số tiền không hợp lệ: ' + it.amount);
  const date = isValidYmd_(it.date) ? String(it.date) : today;   // ngày sai (vd 31/02) thì dùng hôm nay
  return {
    date: date,
    amount: amount,
    category: catNames.indexOf(it.category) >= 0 ? it.category : FALLBACK_CATEGORY,
    description: String(it.description || '').trim().slice(0, 200),
    method: METHODS.indexOf(it.method) >= 0 ? it.method : DEFAULT_METHOD,
    note: String(it.note || '').trim().slice(0, 300)
  };
}

/** Lưu các khoản chi, trả về danh sách ID vừa tạo (để giao diện có thể Hoàn tác). */
function addTransactions(items) {
  if (!items || !items.length) return [];
  const catNames = getCategories_().map(c => c.name);
  const today = todayStr_();
  const now = new Date();
  const rows = items.map(it => {
    const t = normalizeItem_(it, catNames, today);
    return [newId_(), toDate_(t.date), t.amount, t.category, sheetText_(t.description), t.method, sheetText_(t.note), now];
  });
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    const r0 = sh.getLastRow() + 1;
    sh.getRange(r0, 1, rows.length, 1).setNumberFormat('@');
    sh.getRange(r0, 1, rows.length, TX_HEADERS.length).setValues(rows);
    return rows.map(r => r[0]);
  });
}

/** ID giao dịch luôn bắt đầu bằng chữ "t" để Google Sheets không hiểu nhầm thành số. */
function newId_() { return 't' + Utilities.getUuid().replace(/-/g, '').slice(0, 7); }

/** Chữ bắt đầu bằng = + - @ sẽ bị Sheets hiểu là công thức → thêm dấu ' ở đầu (Sheets ẩn dấu này khi hiển thị). */
function sheetText_(v) { v = String(v || ''); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function fromSheetText_(v) { v = String(v || ''); return /^'[=+\-@]/.test(v) ? v.slice(1) : v; }

function findRow_(sh, id) {
  const cell = sh.getRange('A:A').createTextFinder(String(id)).matchEntireCell(true).findNext();
  if (!cell) throw new Error('Không tìm thấy giao dịch ' + id);
  return cell.getRow();
}

function updateTransaction(tx) {
  const catNames = getCategories_().map(c => c.name);
  const t = normalizeItem_(tx, catNames, todayStr_());
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    const row = findRow_(sh, tx.id);
    sh.getRange(row, 2, 1, 6).setValues([[toDate_(t.date), t.amount, t.category, sheetText_(t.description), t.method, sheetText_(t.note)]]);
    return true;
  });
}

/** Xóa 1 khoản, trả về chính khoản đó (để giao diện có thể Hoàn tác). */
function deleteTransaction(id) {
  const tx = readTx_().filter(t => t.id === String(id))[0];
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    sh.deleteRow(findRow_(sh, id));
    return tx || null;
  });
}

/** Xóa nhiều khoản theo ID (dùng khi Hoàn tác thao tác vừa lưu). */
function deleteTransactions(ids) {
  const set = {};
  (ids || []).forEach(id => { set[String(id)] = true; });
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    const n = sh.getLastRow() - 1;
    if (n < 1) return 0;
    const col = sh.getRange(2, 1, n, 1).getValues();
    let removed = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (set[String(col[i][0])]) { sh.deleteRow(i + 2); removed++; }
    }
    return removed;
  });
}

/** Đổi hạn mức MẶC ĐỊNH (áp dụng từ tháng này); các tháng trước giữ nguyên hạn mức cũ. */
function saveBudgets(list) {
  return withLock_(() => {
    const sh = sheet_(SHEET_CAT);
    const n = sh.getLastRow() - 1;
    if (n < 1) return 0;
    const names = sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim());
    const map = {};
    list.forEach(b => { map[b.name] = Math.max(0, Math.round(Number(b.budget) || 0)); });
    const cur = todayStr_().slice(0, 7), ov = readOverrides_();
    const old = sh.getRange(2, 3, n, 1).getValues();
    const vals = old.map((r, i) => {
      if (!(names[i] in map)) return [r[0]];
      if ((Number(r[0]) || 0) !== map[names[i]]) preserveHistory_(ov, names[i], Number(r[0]) || 0, cur);
      return [map[names[i]]];
    });
    sh.getRange(2, 3, n, 1).setValues(vals);
    writeOverrides_(ov);
    return Object.keys(map).length;
  });
}

/* ============================ Quản lý danh mục ============================ */

const FALLBACK_CATEGORY = 'Khác'; // khoản không rõ danh mục sẽ vào đây, nên không cho xóa/đổi tên

/** Danh mục kèm từ khóa và số khoản chi đang thuộc danh mục (cho màn quản lý). */
function getCategoryList(month) {
  month = ymOf_(month) || todayStr_().slice(0, 7);
  const counts = {};
  readTx_().forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
  return budgetsFor_(getCategories_(), readOverrides_(), month).map(c => ({
    name: c.name, icon: c.icon, kind: c.kind, month: month,
    budget: c.budget, defaultBudget: c.defaultBudget, overridden: c.overridden,
    keywords: c.keywords.join(', '), count: counts[c.name] || 0
  }));
}

/** Thêm mới (không có oldName) hoặc sửa danh mục. Đổi tên thì cập nhật luôn các khoản chi cũ. */
function saveCategory(c) {
  const name = String(c.name || '').trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Hãy nhập tên danh mục.');
  if (name.length > 40) throw new Error('Tên danh mục tối đa 40 ký tự.');
  const icon = String(c.icon || '').trim().slice(0, 8) || '📌';
  const budget = Math.max(0, Math.round(Number(c.budget) || 0));
  const keywords = String(c.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean).join(', ');
  const oldName = String(c.oldName || '').trim();
  const kind = c.kind === 'save' ? KIND_SAVE : KIND_SPEND;
  if (kind === KIND_SAVE && (name === FALLBACK_CATEGORY || oldName === FALLBACK_CATEGORY)) {
    throw new Error('Danh mục "' + FALLBACK_CATEGORY + '" phải là loại Chi tiêu.');
  }

  return withLock_(() => {
    const sh = sheet_(SHEET_CAT);
    const n = Math.max(0, sh.getLastRow() - 1);
    const names = n ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim()) : [];
    const dup = names.findIndex(x => x.toLowerCase() === name.toLowerCase());

    if (!oldName) {
      if (dup >= 0) throw new Error('Đã có danh mục "' + names[dup] + '".');
      sh.getRange(n + 2, 1, 1, 5).setValues([[name, icon, budget, keywords, kind]]);
      return { name: name, created: true };
    }
    const idx = names.indexOf(oldName);
    if (idx < 0) throw new Error('Không tìm thấy danh mục "' + oldName + '".');
    if (dup >= 0 && dup !== idx) throw new Error('Đã có danh mục "' + names[dup] + '".');
    if (oldName === FALLBACK_CATEGORY && name !== FALLBACK_CATEGORY) {
      throw new Error('Không đổi tên được danh mục "' + FALLBACK_CATEGORY + '" vì app dùng nó cho khoản chưa rõ danh mục.');
    }
    const oldBudget = Number(sh.getRange(idx + 2, 3, 1, 1).getValues()[0][0]) || 0;
    sh.getRange(idx + 2, 1, 1, 5).setValues([[name, icon, budget, keywords, kind]]);
    const moved = name !== oldName ? renameTxCategory_(oldName, name) : 0;
    // Ngân sách theo tháng: đổi tên khóa; đổi mặc định thì giữ nguyên các tháng trước
    const ov = readOverrides_();
    if (name !== oldName) Object.keys(ov).forEach(ym => { if (oldName in ov[ym]) { ov[ym][name] = ov[ym][oldName]; delete ov[ym][oldName]; } });
    if (oldBudget !== budget) preserveHistory_(ov, name, oldBudget, todayStr_().slice(0, 7));
    writeOverrides_(ov);
    return { name: name, renamed: moved };
  });
}

/** Xóa danh mục. Nếu đang có khoản chi thì bắt buộc chọn danh mục để chuyển sang (moveTo). */
function deleteCategory(name, moveTo) {
  if (name === FALLBACK_CATEGORY) throw new Error('Không xóa được danh mục "' + FALLBACK_CATEGORY + '".');
  return withLock_(() => {
    const sh = sheet_(SHEET_CAT);
    const n = Math.max(0, sh.getLastRow() - 1);
    const names = n ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim()) : [];
    const idx = names.indexOf(name);
    if (idx < 0) throw new Error('Không tìm thấy danh mục "' + name + '".');
    const count = readTx_().filter(t => t.category === name).length;
    let moved = 0;
    if (count) {
      if (!moveTo || moveTo === name || names.indexOf(moveTo) < 0) {
        throw new Error('Danh mục đang có ' + count + ' khoản chi, hãy chọn danh mục để chuyển sang.');
      }
      moved = renameTxCategory_(name, moveTo);
    }
    sh.deleteRow(idx + 2);
    const ov = readOverrides_();
    Object.keys(ov).forEach(ym => { delete ov[ym][name]; });
    writeOverrides_(ov);
    return { deleted: name, moved: moved };
  });
}

function renameTxCategory_(from, to) {
  const sh = sheet_(SHEET_TX);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const range = sh.getRange(2, 4, n, 1);
  const vals = range.getValues();
  let k = 0;
  vals.forEach(r => { if (String(r[0]) === from) { r[0] = to; k++; } });
  if (k) range.setValues(vals);
  return k;
}

/* ============================ Tách câu nhập tự nhiên ============================ */

/** Trả về danh sách khoản chi để người dùng xác nhận (CHƯA lưu). */
function parseInput(text) {
  text = String(text || '').trim();
  if (!text) return { items: [], source: 'none' };
  const cats = getCategories_();
  const today = todayStr_();
  const provider = aiProvider_();
  if (provider) {
    try {
      return { items: parseWithAI_(text, cats, today), source: provider };
    } catch (e) {
      return { items: parseLocal_(text, cats, today), source: 'local', warning: aiName_() + ' lỗi, đã dùng bộ tách offline: ' + e.message };
    }
  }
  return { items: parseLocal_(text, cats, today), source: 'local' };
}

/** Bộ tách theo quy tắc — chạy không cần API. Hiểu: 45k, 1tr2, 1.200.000, 2,5tr, hôm qua, 05/10. */
function parseLocal_(text, cats, today) {
  // Tách khoản: xuống dòng, ";", " + ", " và ", dấu phẩy. Dấu phẩy nằm GIỮA 2 chữ số (2,5tr · 1,200,000) là số, không tách.
  const segments = String(text).split(/\n|;|,(?!\d)|(?<=[^\d\s]),(?=\d)|\s\+\s|\svà\s/i).map(s => s.trim()).filter(Boolean);
  const out = [];
  let carryDate = null;
  segments.forEach(seg => {
    let s = ' ' + seg.toLowerCase() + ' ';
    // Ngày
    let date = null;
    const rel = [[/hôm kia/, -2], [/hôm qua/, -1], [/hôm nay/, 0]];
    for (let i = 0; i < rel.length; i++) {
      if (rel[i][0].test(s)) { date = addDays_(today, rel[i][1]); s = s.replace(rel[i][0], ' '); break; }
    }
    const dm = s.match(/(?:ngày\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (!date && dm) {
      let y = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4));
      if (y < 100) y += 2000;
      const m = Number(dm[2]), d = Number(dm[1]);
      const ymd = y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
      if (isValidYmd_(ymd)) { date = ymd; s = s.replace(dm[0], ' '); }   // 31/02 không hợp lệ → bỏ qua, dùng hôm nay
    }
    if (date) carryDate = date;

    // Số tiền
    let amount = 0, m;
    const END = '(?=[^a-zà-ỹ]|$)';
    // Thứ tự ưu tiên: "1tr2" (phần lẻ dính liền, 1–3 chữ số) → "5tr" → "45k" → "2m" (m có thể là mét nên xét sau k) → số trơn
    if ((m = s.match(new RegExp('(\\d+)\\s*(?:tr|triệu)(\\d{1,3})(?![\\d.,])' + END)))) {
      amount = parseFloat(m[1] + '.' + m[2]) * 1e6;
    } else if ((m = s.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:tr|triệu)' + END)))) {
      amount = parseFloat(m[1].replace(',', '.')) * 1e6;
    } else if ((m = s.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:k|nghìn|ngàn|n)' + END)))) {
      amount = parseFloat(m[1].replace(',', '.')) * 1e3;
    } else if ((m = s.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*m' + END)))) {
      amount = parseFloat(m[1].replace(',', '.')) * 1e6;
    } else if ((m = s.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|d|vnd|vnđ|đồng)?(?=[^a-zà-ỹ\d]|$)/))) {
      amount = Number(m[1].replace(/[.,]/g, ''));
      if (amount > 0 && amount < 1000) amount *= 1000; // "phở 55" → 55.000
    }
    if (!m || !amount) return;
    s = s.replace(m[0], ' ');

    // Phương thức
    let method = DEFAULT_METHOD;
    // \b của JS không hiểu chữ có dấu → tự bắt ranh giới bằng khoảng trắng/dấu câu.
    const word = alt => new RegExp('(?:^|[\\s,.;])(?:' + alt + ')(?=[\\s,.;!?]|$)');
    const methodRules = [
      [word('chuyển khoản|ck'), 'Chuyển khoản'], [word('thẻ|visa|master|credit'), 'Thẻ'],
      [word('tiền mặt|tm|cash'), 'Tiền mặt'], [word('momo|zalopay|zalo pay|vnpay|shopeepay|ví'), 'Ví điện tử']
    ];
    for (let i = 0; i < methodRules.length; i++) {
      if (methodRules[i][0].test(s)) { method = methodRules[i][1]; s = s.replace(methodRules[i][0], ' '); break; }
    }

    const desc = s.replace(/(^|\s)(tiền|hết|mất|trả|chi)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({
      date: date || carryDate || today,
      amount: Math.round(amount),
      category: guessCategory_(seg.toLowerCase(), cats),
      description: desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : seg,
      method: method
    });
  });
  return out;
}

/**
 * Chọn danh mục có từ khóa khớp DÀI NHẤT (vd "mua cafe" → Ăn uống, không phải Mua sắm).
 * Trùng độ dài thì danh mục đứng SAU thắng: danh mục người dùng tự thêm (nằm cuối) được ưu tiên hơn mặc định.
 */
function guessCategory_(text, cats) {
  let best = FALLBACK_CATEGORY, bestLen = 0;
  cats.forEach(c => c.keywords.forEach(k => {
    if (k.length >= bestLen && hasWord_(text, k)) { best = c.name; bestLen = k.length; }
  }));
  return best;
}

/** Có từ/cụm từ k đứng riêng trong text không (không khớp "ăn" bên trong "căn", "be" trong "beer"). */
function hasWord_(text, k) {
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '(?=$|[^\\p{L}\\p{N}])', 'u').test(text);
}

/* ============================ AI: Gemini (free) hoặc Claude ============================ */

/** Nhà cung cấp AI đang dùng: 'gemini' | 'claude' | '' (offline). */
function aiProvider_() {
  const p = String(prop_('AI_PROVIDER') || '').trim().toLowerCase();
  if (p === 'gemini' && prop_('GEMINI_API_KEY')) return 'gemini';
  if (p === 'claude' && prop_('ANTHROPIC_API_KEY')) return 'claude';
  if (p === 'off') return '';
  if (prop_('GEMINI_API_KEY')) return 'gemini';
  if (prop_('ANTHROPIC_API_KEY')) return 'claude';
  return '';
}

function aiName_() {
  return { gemini: 'Gemini', claude: 'Claude' }[aiProvider_()] || '';
}

/**
 * Gọi AI đang bật. task = { system, user, schema (JSON Schema, tùy chọn), effort: 'low'|'medium' }.
 * Có schema thì trả về object đã parse, không có thì trả về text.
 */
function callAI_(task) {
  const provider = aiProvider_();
  if (provider === 'gemini') return callGemini_(task);
  if (provider === 'claude') return callClaude_(task);
  throw new Error('Chưa cấu hình AI');
}

function safeJson_(text) { try { return JSON.parse(text); } catch (e) { return null; } }

/** Lỗi HTTP từ AI → câu dễ hiểu cho người dùng (kèm mã để tra cứu). */
function aiHttpError_(name, code, json) {
  const detail = json && json.error && json.error.message ? ' (' + String(json.error.message).slice(0, 120) + ')' : '';
  if (code === 429) return name + ' hết hạn mức (quá nhiều lượt), thử lại sau [429]';
  if (code === 400 || code === 401 || code === 403) return name + ': API key không hợp lệ hoặc chưa có quyền, kiểm tra lại key trong Script properties [' + code + ']' + detail;
  if (code >= 500) return name + ' đang quá tải hoặc gián đoạn, thử lại sau ít phút [' + code + ']';
  return name + ' báo lỗi [' + code + ']' + detail;
}

function callGemini_(task) {
  const model = prop_('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
  const body = {
    systemInstruction: { parts: [{ text: task.system }] },
    contents: [{ role: 'user', parts: [{ text: task.user }] }],
    generationConfig: { temperature: 0.2 }
  };
  if (task.schema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = toGeminiSchema_(task.schema);
  }
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': prop_('GEMINI_API_KEY') },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const json = safeJson_(res.getContentText());
  if (code !== 200) throw new Error(aiHttpError_('Gemini', code, json));
  if (!json) throw new Error('Gemini trả về dữ liệu không đọc được, thử lại sau');
  const cand = (json.candidates || [])[0];
  if (!cand || !cand.content) throw new Error('Gemini không trả kết quả (' + (cand && cand.finishReason || (json.promptFeedback && json.promptFeedback.blockReason) || 'không rõ') + ')');
  if (cand.finishReason === 'MAX_TOKENS') throw new Error('Phản hồi bị cắt do quá dài');
  const text = cand.content.parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
  if (!task.schema) return text;
  const obj = safeJson_(text);
  if (!obj) throw new Error('Gemini trả về dữ liệu không đọc được, thử lại sau');
  return obj;
}

/** Gemini dùng tập con OpenAPI: bỏ additionalProperties, kiểu viết hoa. */
function toGeminiSchema_(s) {
  const out = {};
  Object.keys(s).forEach(k => {
    if (k === 'additionalProperties') return;
    if (k === 'type') out.type = String(s.type).toUpperCase();
    else if (k === 'properties') {
      out.properties = {};
      Object.keys(s.properties).forEach(p => { out.properties[p] = toGeminiSchema_(s.properties[p]); });
    } else if (k === 'items') out.items = toGeminiSchema_(s.items);
    else out[k] = s[k];
  });
  return out;
}

function callClaude_(task) {
  const model = prop_('CLAUDE_MODEL') || DEFAULT_CLAUDE_MODEL;
  const headers = { 'x-api-key': prop_('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' };
  const body = {
    model: model, max_tokens: 4000, system: task.system,
    messages: [{ role: 'user', content: task.user }]
  };
  // effort chỉ áp dụng cho các model đời mới (Opus/Sonnet/Fable 5.x); Haiku 4.5 không hỗ trợ.
  if (!/haiku/.test(model)) body.output_config = { effort: task.effort || 'medium' };
  if (task.schema) {
    body.output_config = body.output_config || {};
    body.output_config.format = { type: 'json_schema', schema: task.schema };
  }
  if (FALLBACK_MODELS.indexOf(model) >= 0) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const json = safeJson_(res.getContentText());
  if (code !== 200) throw new Error(aiHttpError_('Claude', code, json));
  if (!json) throw new Error('Claude trả về dữ liệu không đọc được, thử lại sau');
  if (json.stop_reason === 'refusal') throw new Error('Claude từ chối xử lý yêu cầu này');
  if (json.stop_reason === 'max_tokens') throw new Error('Phản hồi bị cắt do quá dài');
  const text = (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!task.schema) return text;
  const obj = safeJson_(text);
  if (!obj) throw new Error('Claude trả về dữ liệu không đọc được, thử lại sau');
  return obj;
}

function parseWithAI_(text, cats, today) {
  const catNames = cats.map(c => c.name);
  const weekday = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][toDate_(today).getDay()];
  const system = [
    'Bạn tách ghi chú chi tiêu tiếng Việt thành danh sách giao dịch.',
    'Hôm nay là ' + today + ' (' + weekday + '). Đơn vị tiền: VND, trả về số nguyên.',
    'Quy ước: 45k = 45000; 1tr2 = 1200000; 2,5tr = 2500000; "1.200.000" = 1200000; số trơn dưới 1000 hiểu là nghìn (phở 55 = 55000).',
    'Ngày dạng yyyy-MM-dd. Hiểu "hôm qua", "hôm kia", "thứ 2 tuần trước", "05/10". Không nhắc ngày thì dùng hôm nay; một ngày được nhắc áp dụng cho các khoản liền sau nó.',
    'Danh mục chỉ được chọn trong danh sách sau (kèm từ khóa gợi ý):',
    cats.map(c => '- ' + c.name + (c.keywords.length ? ': ' + c.keywords.slice(0, 15).join(', ') : '')).join('\n'),
    'Phương thức: ' + METHODS.join(', ') + '. Không nhắc thì dùng "' + DEFAULT_METHOD + '". "ck" = Chuyển khoản, momo/zalopay = Ví điện tử.',
    'Mô tả: ngắn gọn, viết hoa chữ đầu, bỏ số tiền và ngày. Bỏ qua nội dung không phải khoản chi. Không có khoản nào thì trả về items rỗng.'
  ].join('\n');

  const schema = {
    type: 'object', additionalProperties: false, required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['date', 'amount', 'category', 'description', 'method'],
          properties: {
            date: { type: 'string' },
            amount: { type: 'integer' },
            category: { type: 'string', enum: catNames },
            description: { type: 'string' },
            method: { type: 'string', enum: METHODS }
          }
        }
      }
    }
  };

  const out = callAI_({ system: system, user: text, schema: schema, effort: 'low' });
  return (out.items || []).map(it => normalizeItem_(it, catNames, today));
}

/** Nhận xét tháng: dùng AI nếu đã bật, nếu không (hoặc AI lỗi) thì tạo nhận xét theo quy tắc. */
function monthlyReview(month) {
  const d = getDashboard(month);
  if (!d.count) return '## Chưa có dữ liệu\nTháng ' + month + ' chưa có khoản chi nào.';
  if (!aiProvider_()) return localReview_(d);

  const summary = {
    thang: month,
    tong_chi: d.total, tong_ngan_sach: d.budget, thang_truoc: d.prevTotal,
    cung_ky_thang_truoc: d.prevSamePeriod,
    so_ngay_da_qua: d.daysElapsed, so_ngay_trong_thang: d.daysInMonth,
    du_bao_cuoi_thang: d.forecast,
    theo_danh_muc: d.byCategory.map(c => ({ danh_muc: c.name, chi: c.amount, ngan_sach: c.budget, thang_truoc: c.prev, so_giao_dich: c.count })),
    khoan_lon_nhat: d.top.map(t => ({ ngay: t.date, so_tien: t.amount, danh_muc: t.category, mo_ta: t.description })),
    chi_theo_ngay: d.daily,
    chi_ngoai_ngan_sach: d.offBudget,
    de_danh: d.savings
  };
  try {
    return callAI_({
      effort: 'medium',
      system: 'Bạn là cố vấn tài chính cá nhân, thực dụng, nói thẳng. Viết tiếng Việt, xưng "bạn". ' +
        'Dựa hoàn toàn vào số liệu được cung cấp, không bịa thêm. Định dạng tiền kiểu 1.250.000đ. ' +
        'Lưu ý: tong_chi KHÔNG gồm tiền để dành (de_danh: tiết kiệm/đầu tư so với mục tiêu); để dành là điểm tích cực, không phải chi tiêu. ' +
        'Trả lời đúng cấu trúc Markdown sau, tổng dưới 250 từ:\n' +
        '## Tóm tắt\n(2-3 câu: tổng chi so với ngân sách và so với CÙNG KỲ tháng trước (cung_ky_thang_truoc), dự báo cuối tháng nếu tháng chưa hết)\n' +
        '## Điểm đáng chú ý\n(3 gạch đầu dòng, mỗi dòng có con số cụ thể: danh mục vượt/sắp vượt, chi ngoài ngân sách (chi_ngoai_ngan_sach) nếu có, thay đổi lớn, khoản bất thường)\n' +
        '## Hành động tháng tới\n(3 gạch đầu dòng, cụ thể và đo được, vd "Giới hạn Ăn uống 3.500.000đ, tối đa 2 lần ăn ngoài/tuần")',
      user: 'Số liệu chi tiêu:\n' + JSON.stringify(summary)
    });
  } catch (e) {
    return localReview_(d) + '\n- (' + aiName_() + ' lỗi: ' + e.message + '. Đang hiển thị nhận xét offline.)';
  }
}

function localReview_(d) {
  const f = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
  const lines = ['## Tóm tắt'];
  lines.push('Tổng chi **' + f(d.total) + '** / ngân sách ' + f(d.budget) + ' (' + Math.round(d.total / (d.budget || 1) * 100) + '%).' +
    (d.prevSamePeriod ? (d.daysElapsed >= d.daysInMonth ? ' So với tháng trước: ' : ' So với cùng kỳ tháng trước (ngày 1–' + d.daysElapsed + '): ') + (d.total >= d.prevSamePeriod ? '+' : '') +
      Math.round((d.total - d.prevSamePeriod) / d.prevSamePeriod * 100) + '%.' : '') +
    (d.daysElapsed < d.daysInMonth ? ' Dự báo cuối tháng: ' + f(d.forecast) + '.' : ''));
  if (d.savings && (d.savings.total || d.savings.target)) {
    lines.push('Để dành **' + f(d.savings.total) + '**' + (d.savings.target ? ' / mục tiêu ' + f(d.savings.target) +
      ' (' + Math.round(d.savings.total / d.savings.target * 100) + '%)' : '') + ', không tính vào tổng chi.');
  }
  lines.push('## Điểm đáng chú ý');
  if (d.offBudget && d.offBudget.total) {
    lines.push('- Chi ngoài ngân sách **' + f(d.offBudget.total) + '** ở ' + d.offBudget.categories.length + ' danh mục (' +
      d.offBudget.categories.map(c => c.name).join(', ') + '). Cân nhắc đặt hạn mức nếu chi thường xuyên.');
  }
  const over = d.byCategory.filter(c => c.budget && c.amount > c.budget);
  const near = d.byCategory.filter(c => c.budget && c.amount <= c.budget && c.amount >= c.budget * 0.8);
  if (d.byCategory[0]) lines.push('- Chi nhiều nhất: **' + d.byCategory[0].name + '** ' + f(d.byCategory[0].amount) + '.');
  over.forEach(c => lines.push('- Vượt ngân sách **' + c.name + '**: ' + f(c.amount) + ' / ' + f(c.budget) + '.'));
  near.forEach(c => lines.push('- Sắp chạm ngân sách **' + c.name + '** (' + Math.round(c.amount / c.budget * 100) + '%).'));
  if (d.top[0]) lines.push('- Khoản lớn nhất: ' + d.top[0].description + ' — ' + f(d.top[0].amount) + '.');
  lines.push('## Gợi ý');
  lines.push('- Bật AI (thêm GEMINI_API_KEY miễn phí trong Script properties) để có phân tích sâu và đề xuất hành động.');
  return lines.join('\n');
}

/* ============================ Dữ liệu DEMO ============================ */

function seedDemoData() {
  const today = todayStr_();
  const cur = today.slice(0, 7);
  // 6 tháng: 5 tháng trước (đủ ngày) + tháng này (đến hôm nay), mỗi tháng mức chi hơi khác nhau
  const months = [cur];
  for (let i = 0; i < 5; i++) months.unshift(prevMonth_(months[0]));
  const factors = [0.92, 1.08, 0.97, 1.15, 1.03, 1];
  const samples = [
    ['Ăn uống', 'Phở bò', 55000], ['Ăn uống', 'Cà phê Highlands', 49000], ['Ăn uống', 'Cơm trưa văn phòng', 45000],
    ['Ăn uống', 'Đi siêu thị WinMart', 650000], ['Ăn uống', 'Trà sữa', 38000], ['Ăn uống', 'Lẩu cuối tuần', 420000],
    ['Đi lại', 'Grab đi làm', 62000], ['Đi lại', 'Đổ xăng', 90000], ['Đi lại', 'Gửi xe tháng', 150000],
    ['Mua sắm', 'Áo sơ mi Shopee', 289000], ['Giải trí', 'Netflix', 260000], ['Giải trí', 'Xem phim CGV', 180000],
    ['Sức khỏe', 'Thuốc cảm', 120000], ['Học tập', 'Sách PMP', 350000], ['Gia đình & Hiếu hỉ', 'Mừng đám cưới', 1000000]
  ];
  const rows = [], now = new Date();
  months.forEach((ym, mi) => {
    const lastDay = ym === cur ? Number(today.slice(8, 10)) : daysInMonth_(ym);
    const f = factors[mi];
    const add = (day, cat, desc, amt, method) =>
      rows.push([newId_(), toDate_(ym + '-' + ('0' + day).slice(-2)), amt, cat, desc, method, 'DEMO', now]);
    add(1, 'Nhà ở & Hóa đơn', 'Tiền thuê nhà', 5000000, 'Chuyển khoản');
    if (lastDay >= 5) add(5, 'Nhà ở & Hóa đơn', 'Tiền điện', 780000, 'Chuyển khoản');
    add(Math.min(lastDay, 10), 'Tiết kiệm & Đầu tư', 'Gửi tiết kiệm', 3000000, 'Chuyển khoản');
    for (let d = 1; d <= lastDay; d++) {
      const k = 1 + ((d + mi) * 7) % 3;
      for (let j = 0; j < k; j++) {
        const s = samples[((d + mi) * 5 + j * 3) % samples.length];
        if (s[2] >= 1000000 && (d + mi) % 9) continue;
        add(d, s[0], s[1], Math.round(s[2] * f * (0.85 + ((d + j) % 4) * 0.1) / 1000) * 1000, ['Thẻ', 'Ví điện tử', 'Tiền mặt', 'Chuyển khoản'][(d + j) % 4]);
      }
    }
  });
  withLock_(() => {
    const sh = sheet_(SHEET_TX);
    const r0 = sh.getLastRow() + 1;
    sh.getRange(r0, 1, rows.length, 1).setNumberFormat('@');
    sh.getRange(r0, 1, rows.length, TX_HEADERS.length).setValues(rows);
  });
  return rows.length;
}

function removeDemoData() {
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    const n = sh.getLastRow() - 1;
    if (n < 1) return 0;
    const range = sh.getRange(2, 1, n, TX_HEADERS.length);
    const keep = range.getValues().filter(r => r[6] !== 'DEMO');
    range.clearContent();
    if (keep.length) sh.getRange(2, 1, keep.length, TX_HEADERS.length).setValues(keep);
    return n - keep.length;
  });
}
