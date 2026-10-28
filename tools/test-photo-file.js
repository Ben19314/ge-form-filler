// Opens the built app straight from disk (file://, the way it is normally used) in a throwaway Chrome profile,
// feeds it a made-up IC picture and prints what the photo reader filled in. Usage: node tools/test-photo-file.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'formfiller-test-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile });
  try {
    const page = await browser.newPage();
    const external = [];
    page.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) external.push(r.url()); });
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await page.goto('file:///' + path.resolve(__dirname, '..', 'Nomination Form Filler.html').replace(/\\/g, '/'));
    await page.click('[data-tab="nominees"]');
    const result = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 1000; c.height = 630; const g = c.getContext('2d');
      g.fillStyle = '#cfe3f2'; g.fillRect(0, 0, 1000, 630); g.fillStyle = '#1a1a1a';
      g.font = 'bold 30px Arial'; g.fillText('KAD PENGENALAN MALAYSIA', 40, 60);
      g.font = 'bold 38px Arial'; g.fillText('760808-08-5577', 40, 170);
      g.font = 'bold 28px Arial'; ['WONG KAR WAI', 'NO 22 LORONG IPOH GARDEN 1', '31400 IPOH', 'PERAK'].forEach((l, i) => g.fillText(l, 40, 240 + i * 40));
      g.font = 'bold 24px Arial'; g.fillText('WARGANEGARA', 700, 540); g.fillText('LELAKI', 720, 580);
      const f = await new Promise((r) => c.toBlob((b) => r(new File([b], 'ic.png', { type: 'image/png' }))));
      const inp = document.querySelector('input[data-photo="nominees.0"]'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 1000)); if (/Found|Could not|Nothing/.test(document.getElementById('pm-nominees-0').textContent)) break; }
      return { msg: document.getElementById('pm-nominees-0').textContent,
        values: [...document.querySelectorAll('[data-path^="nominees.0."]')].filter((x) => x.value && x.type !== 'radio').map((x) => x.dataset.path.slice(11) + '=' + x.value) };
    });
    console.log(result.msg); console.log(result.values.join('\n'));
    console.log('Internet requests:', external.length ? external : 'none');
  } finally { await browser.close(); fs.rmSync(profile, { recursive: true, force: true }); }
})();
