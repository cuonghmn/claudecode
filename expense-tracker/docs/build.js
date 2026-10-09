/**
 * Tạo bộ tài liệu từ code app hiện tại:
 *   node expense-tracker/mockup/build.js   (tạo docs/src/app-tour.html)
 *   node expense-tracker/docs/build.js
 * → docs/index.html, docs/huong-dan-cai-dat.html, docs/huong-dan-su-dung.html
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const app = f => fs.readFileSync(path.join(root, f), 'utf8');
// Nhúng chuỗi an toàn vào <script>: không để lọt "</script>" hay ký tự xuống dòng đặc biệt
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const js = s => JSON.stringify(s).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
const out = (name, html) => {
  fs.writeFileSync(path.join(__dirname, name), html);
  console.log('Đã tạo docs/' + name + ' (' + Math.round(html.length / 1024) + ' KB)');
};

const swap = (html, marker, value) => {
  if (html.indexOf(marker) < 0) throw new Error('Thiếu ' + marker);
  return html.split(marker).join(value);
};

out('index.html', src('index.html'));

let install = src('install.html');
install = swap(install, "/*__CODE_GS__*/''", js(app('Code.gs')));
install = swap(install, "/*__INDEX_HTML__*/''", js(app('Index.html')));
install = swap(install, "/*__MANIFEST__*/''", js(app('appsscript.json')));
out('huong-dan-cai-dat.html', install);

out('huong-dan-su-dung.html', swap(src('tour.html'), '/*__APP_HTML__*/null', js(src('app-tour.html'))));
