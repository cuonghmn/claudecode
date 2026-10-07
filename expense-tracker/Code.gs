/**
 * Sổ chi tiêu cá nhân — Google Sheets + Apps Script + Claude
 *
 * Sheet "GiaoDich": mỗi dòng là 1 khoản chi.
 * Sheet "DanhMuc":  danh mục, icon, ngân sách tháng, từ khóa nhận diện (sửa trực tiếp trên Sheet được).
 *
 * Script Properties (Project Settings → Script properties):
 *   ANTHROPIC_API_KEY  (tùy chọn) bật nhập liệu tự nhiên + nhận xét tháng bằng Claude.
 *                      Không có key thì app dùng bộ tách quy tắc (offline) — vẫn chạy bình thường.
 *   CLAUDE_MODEL       (tùy chọn) mặc định claude-opus-5-5.
 */

const SHEET_TX = 'GiaoDich';
const SHEET_CAT = 'DanhMuc';
const TX_HEADERS = ['ID', 'Ngày', 'Số tiền', 'Danh mục', 'Mô tả', 'Phương thức', 'Ghi chú', 'Tạo lúc'];
const CAT_HEADERS = ['Danh mục', 'Icon', 'Ngân sách tháng', 'Từ khóa (cách nhau bởi dấu phẩy)'];
const METHODS = ['Chuyển khoản', 'Thẻ', 'Tiền mặt', 'Ví điện tử'];
const DEFAULT_METHOD = 'Chuyển khoản';
const DEFAULT_MODEL = 'claude-opus-5-5';
// Các model hỗ trợ fallbacks "default" (tự chuyển model khi bị bộ lọc an toàn từ chối nhầm).
// Khoản >= ngưỡng này coi là khoản lớn/cố định (tiền nhà, tiết kiệm…): không ngoại suy khi dự báo cuối tháng.
const BIG_ITEM_THRESHOLD = 1000000;
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

const DEFAULT_CATEGORIES = [
  ['Ăn uống', '🍜', 4000000, 'ăn,phở,bún,cơm,mì,bánh mì,trưa,tối,sáng,cafe,cà phê,coffee,trà sữa,trà,nước,nhậu,bia,lẩu,nướng,highland,starbucks,phúc long,grabfood,shopeefood,đi chợ,siêu thị,winmart,bách hóa xanh,trái cây'],
  ['Đi lại', '🛵', 1000000, 'grab,be,xanh sm,taxi,xăng,gửi xe,vé xe,xe buýt,bus,metro,máy bay,vé máy bay,rửa xe,sửa xe,thay nhớt,cầu đường'],
  ['Nhà ở & Hóa đơn', '🏠', 6000000, 'tiền nhà,thuê nhà,điện,tiền điện,tiền nước,internet,wifi,cước,điện thoại,4g,gas,phí quản lý,chung cư'],
  ['Mua sắm', '🛍️', 2000000, 'mua,quần,áo,giày,dép,túi,shopee,lazada,tiki,tiktok shop,đồ dùng,mỹ phẩm,cắt tóc'],
  ['Sức khỏe', '💊', 500000, 'thuốc,khám,bệnh viện,phòng khám,nha khoa,gym,yoga,bảo hiểm,vitamin'],
  ['Học tập', '📚', 500000, 'sách,khóa học,course,học phí,udemy,coursera,học'],
  ['Giải trí', '🎬', 800000, 'phim,xem phim,cgv,netflix,spotify,youtube,game,karaoke,du lịch,khách sạn,vé xem'],
  ['Gia đình & Hiếu hỉ', '🎁', 1000000, 'biếu,mừng,đám cưới,cưới,đám,sinh nhật,quà,gửi mẹ,gửi bố,gia đình,lì xì'],
  ['Tiết kiệm & Đầu tư', '💰', 3000000, 'tiết kiệm,gửi tiết kiệm,đầu tư,chứng khoán,cổ phiếu,vàng,quỹ,ccq'],
  ['Khác', '📌', 500000, '']
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
    .addItem('Thêm dữ liệu DEMO (2 tháng)', 'seedDemoData')
    .addItem('Xóa dữ liệu DEMO', 'removeDemoData')
    .addToUi();
}

/** Chạy 1 lần: tạo 2 sheet, tiêu đề, danh mục mặc định, lưu ID file. An toàn khi chạy lại. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Hãy mở Apps Script từ Google Sheet (Tiện ích mở rộng → Apps Script) rồi chạy setup.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  let tx = ss.getSheetByName(SHEET_TX);
  if (!tx) tx = ss.insertSheet(SHEET_TX);
  tx.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  tx.setFrozenRows(1);
  tx.getRange('B:B').setNumberFormat('dd/MM/yyyy');
  tx.getRange('C:C').setNumberFormat('#,##0');
  tx.getRange('H:H').setNumberFormat('dd/MM/yyyy HH:mm');
  tx.setColumnWidth(1, 110); tx.setColumnWidth(5, 260);

  let cat = ss.getSheetByName(SHEET_CAT);
  if (!cat) {
    cat = ss.insertSheet(SHEET_CAT);
    cat.getRange(2, 1, DEFAULT_CATEGORIES.length, 4).setValues(DEFAULT_CATEGORIES);
  }
  cat.getRange(1, 1, 1, CAT_HEADERS.length).setValues([CAT_HEADERS])
    .setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  cat.setFrozenRows(1);
  cat.getRange('C:C').setNumberFormat('#,##0');
  cat.setColumnWidth(4, 480);

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
  return sh.getRange(2, 1, n, 4).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({
      name: String(r[0]).trim(),
      icon: String(r[1] || '•'),
      budget: Number(r[2]) || 0,
      keywords: String(r[3] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    }));
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
      description: String(r[4] || ''),
      method: String(r[5] || ''),
      note: String(r[6] || ''),
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
    categories: cats.map(c => ({ name: c.name, icon: c.icon, budget: c.budget })),
    methods: METHODS,
    defaultMethod: DEFAULT_METHOD,
    today: todayStr_(),
    hasClaude: !!prop_('ANTHROPIC_API_KEY'),
    sheetUrl: ss_().getUrl()
  };
}

function getTransactions(month, category, query) {
  const q = String(query || '').trim().toLowerCase();
  const list = readTx_().filter(t =>
    (!month || t.date.slice(0, 7) === month) &&
    (!category || t.category === category) &&
    (!q || (t.description + ' ' + t.note + ' ' + t.category).toLowerCase().indexOf(q) >= 0));
  return sortTx_(list);
}

function getRecent(limit) {
  const all = sortTx_(readTx_());
  const today = todayStr_();
  return {
    todayTotal: all.filter(t => t.date === today).reduce((s, t) => s + t.amount, 0),
    items: all.slice(0, limit || 6)
  };
}

function getDashboard(month) {
  const cats = getCategories_();
  const all = readTx_();
  const prev = prevMonth_(month);
  const cur = all.filter(t => t.date.slice(0, 7) === month);
  const prevTx = all.filter(t => t.date.slice(0, 7) === prev);
  const total = cur.reduce((s, t) => s + t.amount, 0);
  const prevTotal = prevTx.reduce((s, t) => s + t.amount, 0);
  const budget = cats.reduce((s, c) => s + c.budget, 0);

  const today = todayStr_();
  const days = daysInMonth_(month);
  const elapsed = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : (month < today.slice(0, 7) ? days : 0);

  const byCatMap = {};
  cats.forEach(c => { byCatMap[c.name] = { name: c.name, icon: c.icon, budget: c.budget, amount: 0, prev: 0, count: 0 }; });
  const ensure = name => byCatMap[name] || (byCatMap[name] = { name: name, icon: '•', budget: 0, amount: 0, prev: 0, count: 0 });
  cur.forEach(t => { const c = ensure(t.category); c.amount += t.amount; c.count++; });
  prevTx.forEach(t => { ensure(t.category).prev += t.amount; });

  // Dự báo = đã chi + (chi thường ngày TB × số ngày còn lại). Khoản lớn không bị nhân lên.
  const routine = cur.filter(t => t.amount < BIG_ITEM_THRESHOLD).reduce((s, t) => s + t.amount, 0);
  const avgRoutine = elapsed ? routine / elapsed : 0;

  const daily = [];
  for (let d = 1; d <= days; d++) daily.push(0);
  cur.forEach(t => { daily[Number(t.date.slice(8, 10)) - 1] += t.amount; });

  return {
    month: month,
    total: total,
    prevTotal: prevTotal,
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
    top: cur.slice().sort((a, b) => b.amount - a.amount).slice(0, 5)
  };
}

/* ============================ Ghi / sửa / xóa ============================ */

function normalizeItem_(it, catNames, today) {
  const amount = Math.round(Number(String(it.amount).replace(/[^\d.-]/g, '')));
  if (!amount || amount <= 0) throw new Error('Số tiền không hợp lệ: ' + it.amount);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(it.date)) ? String(it.date) : today;
  return {
    date: date,
    amount: amount,
    category: catNames.indexOf(it.category) >= 0 ? it.category : 'Khác',
    description: String(it.description || '').trim().slice(0, 200),
    method: METHODS.indexOf(it.method) >= 0 ? it.method : DEFAULT_METHOD,
    note: String(it.note || '').trim().slice(0, 300)
  };
}

function addTransactions(items) {
  if (!items || !items.length) return 0;
  const catNames = getCategories_().map(c => c.name);
  const today = todayStr_();
  const now = new Date();
  const rows = items.map(it => {
    const t = normalizeItem_(it, catNames, today);
    return [Utilities.getUuid().slice(0, 8), toDate_(t.date), t.amount, t.category, t.description, t.method, t.note, now];
  });
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, TX_HEADERS.length).setValues(rows);
    return rows.length;
  });
}

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
    sh.getRange(row, 2, 1, 6).setValues([[toDate_(t.date), t.amount, t.category, t.description, t.method, t.note]]);
    return true;
  });
}

function deleteTransaction(id) {
  return withLock_(() => {
    const sh = sheet_(SHEET_TX);
    sh.deleteRow(findRow_(sh, id));
    return true;
  });
}

function saveBudgets(list) {
  return withLock_(() => {
    const sh = sheet_(SHEET_CAT);
    const n = sh.getLastRow() - 1;
    if (n < 1) return 0;
    const names = sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim());
    const map = {};
    list.forEach(b => { map[b.name] = Math.max(0, Math.round(Number(b.budget) || 0)); });
    const vals = sh.getRange(2, 3, n, 1).getValues().map((r, i) => [names[i] in map ? map[names[i]] : r[0]]);
    sh.getRange(2, 3, n, 1).setValues(vals);
    return Object.keys(map).length;
  });
}

/* ============================ Tách câu nhập tự nhiên ============================ */

/** Trả về danh sách khoản chi để người dùng xác nhận (CHƯA lưu). */
function parseInput(text) {
  text = String(text || '').trim();
  if (!text) return { items: [], source: 'none' };
  const cats = getCategories_();
  const today = todayStr_();
  if (prop_('ANTHROPIC_API_KEY')) {
    try {
      return { items: parseWithClaude_(text, cats, today), source: 'claude' };
    } catch (e) {
      return { items: parseLocal_(text, cats, today), source: 'local', warning: 'Claude lỗi, đã dùng bộ tách offline: ' + e.message };
    }
  }
  return { items: parseLocal_(text, cats, today), source: 'local' };
}

/** Bộ tách theo quy tắc — chạy không cần API. Hiểu: 45k, 1tr2, 1.200.000, 2,5tr, hôm qua, 05/10. */
function parseLocal_(text, cats, today) {
  const segments = String(text).split(/\n|;|,(?!\d)|\s\+\s|\svà\s/i).map(s => s.trim()).filter(Boolean);
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
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        date = y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
        s = s.replace(dm[0], ' ');
      }
    }
    if (date) carryDate = date;

    // Số tiền
    let amount = 0, m;
    const END = '(?=[^a-zà-ỹ]|$)';
    if ((m = s.match(new RegExp('(\\d+)\\s*(?:tr|triệu|m)\\s*(\\d+)' + END)))) {
      amount = parseFloat(m[1] + '.' + m[2]) * 1e6;
    } else if ((m = s.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:tr|triệu|m)' + END)))) {
      amount = parseFloat(m[1].replace(',', '.')) * 1e6;
    } else if ((m = s.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:k|nghìn|ngàn|n)' + END)))) {
      amount = parseFloat(m[1].replace(',', '.')) * 1e3;
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

/** Chọn danh mục có từ khóa khớp DÀI NHẤT (vd "mua cafe" → Ăn uống, không phải Mua sắm). */
function guessCategory_(text, cats) {
  let best = 'Khác', bestLen = 0;
  cats.forEach(c => c.keywords.forEach(k => {
    if (k.length > bestLen && text.indexOf(k) >= 0) { best = c.name; bestLen = k.length; }
  }));
  return best;
}

/* ============================ Claude API ============================ */

function callClaude_(payload) {
  const model = prop_('CLAUDE_MODEL') || DEFAULT_MODEL;
  const headers = { 'x-api-key': prop_('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' };
  const body = Object.assign({ model: model }, payload);
  if (FALLBACK_MODELS.indexOf(model) >= 0) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const json = JSON.parse(res.getContentText());
  if (code !== 200) throw new Error('HTTP ' + code + ' — ' + (json.error && json.error.message || res.getContentText().slice(0, 200)));
  if (json.stop_reason === 'refusal') throw new Error('Claude từ chối xử lý yêu cầu này');
  if (json.stop_reason === 'max_tokens') throw new Error('Phản hồi bị cắt do quá dài');
  return json.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function parseWithClaude_(text, cats, today) {
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

  const out = callClaude_({
    max_tokens: 4000,
    system: system,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: schema } },
    messages: [{ role: 'user', content: text }]
  });
  const items = JSON.parse(out).items || [];
  return items.map(it => normalizeItem_(it, catNames, today));
}

/** Nhận xét tháng: dùng Claude nếu có key, nếu không thì tạo nhận xét theo quy tắc. */
function monthlyReview(month) {
  const d = getDashboard(month);
  if (!d.count) return '## Chưa có dữ liệu\nTháng ' + month + ' chưa có khoản chi nào.';
  if (!prop_('ANTHROPIC_API_KEY')) return localReview_(d);

  const summary = {
    thang: month,
    tong_chi: d.total, tong_ngan_sach: d.budget, thang_truoc: d.prevTotal,
    so_ngay_da_qua: d.daysElapsed, so_ngay_trong_thang: d.daysInMonth,
    du_bao_cuoi_thang: d.forecast,
    theo_danh_muc: d.byCategory.map(c => ({ danh_muc: c.name, chi: c.amount, ngan_sach: c.budget, thang_truoc: c.prev, so_giao_dich: c.count })),
    khoan_lon_nhat: d.top.map(t => ({ ngay: t.date, so_tien: t.amount, danh_muc: t.category, mo_ta: t.description })),
    chi_theo_ngay: d.daily
  };
  return callClaude_({
    max_tokens: 4000,
    output_config: { effort: 'medium' },
    system: 'Bạn là cố vấn tài chính cá nhân, thực dụng, nói thẳng. Viết tiếng Việt, xưng "bạn". ' +
      'Dựa hoàn toàn vào số liệu được cung cấp, không bịa thêm. Định dạng tiền kiểu 1.250.000đ. ' +
      'Trả lời đúng cấu trúc Markdown sau, tổng dưới 250 từ:\n' +
      '## Tóm tắt\n(2-3 câu: tổng chi so với ngân sách và tháng trước, dự báo cuối tháng nếu tháng chưa hết)\n' +
      '## Điểm đáng chú ý\n(3 gạch đầu dòng, mỗi dòng có con số cụ thể: danh mục vượt/sắp vượt, thay đổi lớn, khoản bất thường)\n' +
      '## Hành động tháng tới\n(3 gạch đầu dòng, cụ thể và đo được, vd "Giới hạn Ăn uống 3.500.000đ, tối đa 2 lần ăn ngoài/tuần")',
    messages: [{ role: 'user', content: 'Số liệu chi tiêu:\n' + JSON.stringify(summary) }]
  });
}

function localReview_(d) {
  const f = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
  const lines = ['## Tóm tắt'];
  lines.push('Tổng chi **' + f(d.total) + '** / ngân sách ' + f(d.budget) + ' (' + Math.round(d.total / (d.budget || 1) * 100) + '%).' +
    (d.prevTotal ? ' So với tháng trước: ' + (d.total >= d.prevTotal ? '+' : '') + Math.round((d.total - d.prevTotal) / d.prevTotal * 100) + '%.' : '') +
    (d.daysElapsed < d.daysInMonth ? ' Dự báo cuối tháng: ' + f(d.forecast) + '.' : ''));
  lines.push('## Điểm đáng chú ý');
  const over = d.byCategory.filter(c => c.budget && c.amount > c.budget);
  const near = d.byCategory.filter(c => c.budget && c.amount <= c.budget && c.amount >= c.budget * 0.8);
  if (d.byCategory[0]) lines.push('- Chi nhiều nhất: **' + d.byCategory[0].name + '** ' + f(d.byCategory[0].amount) + '.');
  over.forEach(c => lines.push('- Vượt ngân sách **' + c.name + '**: ' + f(c.amount) + ' / ' + f(c.budget) + '.'));
  near.forEach(c => lines.push('- Sắp chạm ngân sách **' + c.name + '** (' + Math.round(c.amount / c.budget * 100) + '%).'));
  if (d.top[0]) lines.push('- Khoản lớn nhất: ' + d.top[0].description + ' — ' + f(d.top[0].amount) + '.');
  lines.push('## Gợi ý');
  lines.push('- Thêm ANTHROPIC_API_KEY trong Script properties để Claude phân tích sâu và đề xuất hành động.');
  return lines.join('\n');
}

/* ============================ Dữ liệu DEMO ============================ */

function seedDemoData() {
  const today = todayStr_();
  const cur = today.slice(0, 7), prev = prevMonth_(cur);
  const samples = [
    ['Ăn uống', 'Phở bò', 55000], ['Ăn uống', 'Cà phê Highlands', 49000], ['Ăn uống', 'Cơm trưa văn phòng', 45000],
    ['Ăn uống', 'Đi siêu thị WinMart', 650000], ['Ăn uống', 'Trà sữa', 38000], ['Ăn uống', 'Lẩu cuối tuần', 420000],
    ['Đi lại', 'Grab đi làm', 62000], ['Đi lại', 'Đổ xăng', 90000], ['Đi lại', 'Gửi xe tháng', 150000],
    ['Mua sắm', 'Áo sơ mi Shopee', 289000], ['Giải trí', 'Netflix', 260000], ['Giải trí', 'Xem phim CGV', 180000],
    ['Sức khỏe', 'Thuốc cảm', 120000], ['Học tập', 'Sách PMP', 350000], ['Gia đình & Hiếu hỉ', 'Mừng đám cưới', 1000000]
  ];
  const rows = [], now = new Date();
  [[prev, daysInMonth_(prev)], [cur, Number(today.slice(8, 10))]].forEach(([ym, lastDay]) => {
    const add = (day, cat, desc, amt, method) =>
      rows.push([Utilities.getUuid().slice(0, 8), toDate_(ym + '-' + ('0' + day).slice(-2)), amt, cat, desc, method, 'DEMO', now]);
    add(1, 'Nhà ở & Hóa đơn', 'Tiền thuê nhà', 5000000, 'Chuyển khoản');
    if (lastDay >= 5) add(5, 'Nhà ở & Hóa đơn', 'Tiền điện', 780000, 'Chuyển khoản');
    add(Math.min(lastDay, 10), 'Tiết kiệm & Đầu tư', 'Gửi tiết kiệm', 3000000, 'Chuyển khoản');
    for (let d = 1; d <= lastDay; d++) {
      const k = 1 + (d * 7) % 3;
      for (let j = 0; j < k; j++) {
        const s = samples[(d * 5 + j * 3) % samples.length];
        if (s[2] >= 1000000 && d % 9) continue;
        add(d, s[0], s[1], Math.round(s[2] * (0.85 + ((d + j) % 4) * 0.1) / 1000) * 1000, ['Thẻ', 'Ví điện tử', 'Tiền mặt', 'Chuyển khoản'][(d + j) % 4]);
      }
    }
  });
  withLock_(() => {
    const sh = sheet_(SHEET_TX);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, TX_HEADERS.length).setValues(rows);
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
