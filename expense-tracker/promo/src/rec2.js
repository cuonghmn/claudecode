const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const dir = __dirname, V = process.argv[2] || '15';
const APP = 'file:///home/user/claudecode/expense-tracker/docs/src/app-tour.html';
fs.writeFileSync(path.join(dir,'sq.html'), fs.readFileSync(path.join(dir,'square.html'),'utf8').replace('APP_URL', APP));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 }, recordVideo: { dir: path.join(dir,'raw'+V), size: { width: 1080, height: 1080 } } });
  const tCreate = Date.now();
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(dir,'sq.html'));
  const fr = page.frameLocator('#app');
  await fr.locator('#quick').waitFor();
  const appFrame = page.frames().find(f => f.url().includes('app-tour'));
  // Nhận xét minh họa kiểu AI, dựng từ số liệu mẫu thật của app (môi trường quay không gọi được Gemini)
  await appFrame.evaluate(() => {
    const orig = window.api;
    window.api = function (fn, ...a) {
      if (fn !== 'monthlyReview') return orig.apply(this, arguments);
      return orig('getDashboard', a[0]).then(d => {
        const f = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
        const r = n => Math.round(n / 100000) * 100000;
        const cats = d.byCategory.filter(c => c.amount > 0);
        const top = cats[0], over = cats.filter(c => c.budget && c.amount > c.budget), near = cats.filter(c => c.budget && c.amount <= c.budget && c.amount >= c.budget * 0.8);
        const L = ['## Tóm tắt', 'Sau ' + d.daysElapsed + '/' + d.daysInMonth + ' ngày, bạn đã chi **' + f(d.total) + '**, bằng ' + Math.round(d.total / (d.budget || 1) * 100) + '% ngân sách ' + f(d.budget) + '. Giữ tốc độ này, cuối tháng sẽ vào khoảng **' + f(d.forecast) + '**' + (d.forecast > d.budget ? ', vượt ' + f(d.forecast - d.budget) + '.' : ', vẫn trong ngân sách.'),
          '## Điểm đáng chú ý',
          '- **' + top.name + '** chiếm ' + Math.round(top.amount / d.total * 100) + '% tổng chi (' + f(top.amount) + ').'];
        over.slice(0, 1).forEach(c => L.push('- **' + c.name + '** đã vượt hạn mức: ' + f(c.amount) + ' / ' + f(c.budget) + '.'));
        near.slice(0, 1).forEach(c => L.push('- **' + c.name + '** đã dùng ' + Math.round(c.amount / c.budget * 100) + '% hạn mức.'));
        if (d.savings && d.savings.total) L.push('- Để dành ' + f(d.savings.total) + ', điểm cộng tháng này.');
        const second = cats.find(c => c !== top && c.budget) || cats[1];
        L.push('## Hành động tháng tới',
          '- Giữ **' + second.name + '** dưới ' + f(r(Math.min(second.amount, second.budget || second.amount) * 0.9)) + (/ăn uống/i.test(second.name) ? ', tối đa 2 lần ăn ngoài mỗi tuần.' : '.'),
          '- Đặt hạn mức cho các khoản đang ngoài ngân sách để không bị bất ngờ.',
          '- Mỗi tối dành 1 phút xem Gần đây, dừng các khoản nhỏ lặp lại.');
        return new Promise(res => setTimeout(() => res(L.join('\n')), 900));
      });
    };
  });
  await sleep(800);
  const t0 = Date.now();
  const P = (fn, ...a) => page.evaluate(([fn, a]) => window[fn](...a), [fn, a]);
  const tap = async (loc) => {
    const el = loc.first(); await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    await page.evaluate(([x, y]) => { const c = document.getElementById('cur'); c.style.opacity = 1; c.style.left = x + 'px'; c.style.top = y + 'px'; }, [b.x + b.width / 2, b.y + b.height / 2]);
    await sleep(500);
    await page.evaluate(() => document.getElementById('cur').classList.add('tap')); await sleep(130);
    await el.click();
    await page.evaluate(() => document.getElementById('cur').classList.remove('tap'));
  };
  const hideCur = () => page.evaluate(() => document.getElementById('cur').style.opacity = 0);
  const scrollTo = (loc) => loc.first().evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  const rmToast = () => fr.locator('.toast').evaluateAll(els => els.forEach(e => e.remove()));
  const LONG = V === '30';

  // ---- Mở đầu ----
  if (LONG) {
    await P('dim', true);
    await P('scene', { eb: 'Vấn đề của mình', title: 'Cuối tháng nào cũng hỏi:<br>tiền đi đâu hết?' }); await sleep(3000);
    await P('scene', { eb: 'Vấn đề của mình', title: 'App thì nhiều,<br>nhưng chưa cái nào vừa ý', sub: 'Rườm rà, không đúng cách mình chi tiêu' }); await sleep(3200);
    await P('scene', { eb: 'Thử cách khác', title: 'Tự làm bằng Claude.<br>Không cần biết code.' }); await sleep(2000);
    await P('dim', false); await sleep(1000);
  } else {
    await P('scene', { eb: 'Dự án cá nhân', title: '<span class="nw">Không biết code.</span><br>Vẫn tự làm app cho mình.' }); await sleep(2000);
  }
  // ---- 1. Nhập bằng AI ----
  await P('scene', { eb: '1 · Nhập bằng AI', title: 'Gõ một câu,<br>AI tự bóc tách', steps: ['Gõ như nhắn tin', 'AI tách khoản, chọn danh mục', 'Xem lại và bấm Lưu'] });
  await sleep(LONG ? 1000 : 400); await P('step', 0); await tap(fr.locator('#quick'));
  await fr.locator('#quick').pressSequentially('trưa phở 55k, grab 32k', { delay: LONG ? 70 : 40 });
  await P('step', 0, true); await P('step', 1);
  await tap(fr.locator('#btnParse')); await fr.locator('#previewList .preview').first().waitFor();
  await P('step', 1, true); await P('step', 2);
  await hideCur(); await sleep(200);
  await fr.locator('#previewList').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(LONG ? 900 : 700);
  const pb = await fr.locator('#previewList').boundingBox();
  await page.evaluate(b => ring(b, '✨ AI tự bóc tách'), pb);
  if (LONG) {
    const items = await appFrame.evaluate(() => S.preview.map(x => '<div style="margin:4px 0">' + x.description + ' · <b>' + x.amount.toLocaleString('vi-VN') + 'đ</b> → ' + x.category + '</div>').join(''));
    await P('card', 'AI tách được 2 khoản', items); await sleep(3400);
  } else await sleep(1500);
  await page.evaluate(() => ring(null)); await sleep(300);
  await tap(fr.locator('#btnSave')); await fr.locator('.toast').first().waitFor();
  await P('step', 2, true); await hideCur();
  if (LONG) { await P('card', 'Đã lưu. Lỡ tay?', 'Bấm <b>Hoàn tác</b> trong 5 giây'); await scrollTo(fr.locator('#recentRange')); await sleep(2200); }
  else await sleep(700);
  await rmToast();
  // ---- 2. Ngân sách ----
  await P('scene', { eb: '2 · Ngân sách', title: 'Ngân sách tháng<br>cho từng mục', steps: LONG ? ['Hạn mức riêng mỗi danh mục', 'Tháng nào chi nhiều, nâng riêng tháng đó', 'Vượt mức là có cảnh báo'] : ['Hạn mức riêng mỗi danh mục', 'Mỗi tháng một mức khác nhau'] });
  await tap(fr.locator('nav [data-tab="budget"]')); await fr.locator('#budgetList .cat-row').first().waitFor(); await hideCur();
  await P('step', 0, true); await sleep(LONG ? 1200 : 600);
  if (LONG) {
    await P('step', 1);
    const nx = fr.locator('#budStrip .mchip.now + .mchip');
    await tap(nx); await sleep(700);
    const inp = fr.locator('#budgetList .cat-row', { hasText: 'Gia đình' }).locator('input');
    await tap(inp); await inp.fill(''); await inp.pressSequentially('5000000', { delay: 60 }); await inp.evaluate(e => { e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); });
    await hideCur(); await P('step', 1, true); await P('card', 'Ví dụ', 'Tháng sau có đám cưới: <b>Gia đình &amp; Hiếu hỉ 5.000.000đ</b>, chỉ áp dụng tháng đó');
    await sleep(2600); await P('step', 2, true); await sleep(1000);
  } else { await P('step', 1, true); await sleep(900); }
  // ---- 3. Dashboard + AI ----
  await P('scene', { eb: '3 · Dashboard + AI', title: 'Bấm <span class="nw" style="color:#fcd34d">Tạo nhận xét</span><br>để AI khuyến nghị', steps: LONG ? ['Tổng quan chi tiêu cả tháng', 'AI đọc số liệu của bạn', 'Gợi ý cụ thể để giữ ngân sách'] : [] });
  await tap(fr.locator('nav [data-tab="dash"]')); await fr.locator('#dash .kpis').waitFor(); await hideCur();
  if (LONG) {
    await sleep(500); await P('step', 0, true); await sleep(800);
    await scrollTo(fr.locator('.card', { hasText: 'Cơ cấu chi tiêu' })); await sleep(2000);
    await P('step', 1);
  } else await sleep(400);
  await tap(fr.locator('#btnReview')); await fr.locator('#review h3').first().waitFor(); await hideCur();
  await scrollTo(fr.locator('#review')); await sleep(500);
  const tip = await fr.locator('#review').evaluate(el => { const hs = [...el.querySelectorAll('h3')]; const h = hs.find(x => /Hành động/.test(x.textContent)); const ul = h && h.nextElementSibling; return ul && ul.querySelector('li') ? ul.querySelector('li').innerHTML : ''; });
  if (LONG) { await P('step', 1, true); await P('step', 2, true); }
  await P('card', 'AI gợi ý', tip); await sleep(LONG ? 4000 : 2100);
  // ---- Kết ----
  await P('end', LONG ? 'Vấn đề nhỏ hằng ngày của bạn,<br>bạn cũng tự làm được.' : 'Vấn đề hằng ngày của mình,<br>tự làm app cho mình.');
  await sleep(LONG ? 3000 : 2000);
  const rawLen = (Date.now() - t0) / 1000;
  await ctx.close(); await browser.close();
  fs.writeFileSync(path.join(dir, 'meta' + V + '.json'), JSON.stringify({ offset: (t0 - tCreate) / 1000, rawLen, tip }));
  console.log(V, 'raw', rawLen.toFixed(2), 'tip:', tip);
})();
