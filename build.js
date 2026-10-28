// Builds the single-file app: inlines pdf-lib, SheetJS, the core logic, the blank form and the photo reader.
// Usage: node build.js "<path to blank form.pdf>"
const fs = require('fs');
const read = (p) => fs.readFileSync(p, 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const tpl = read('src/app.html');
const pdflib = safe(read('node_modules/pdf-lib/dist/pdf-lib.min.js'));
const xlsx = safe(read('node_modules/xlsx/dist/xlsx.full.min.js'));
const core = read('src/core.js');
const pdf = fs.readFileSync(process.argv[2]).toString('base64');
// Photo reader: the main library, one worker script (engine + worker code) and the English language data.
const ocrMain = read('node_modules/tesseract.js/dist/tesseract.min.js');
const ocrWorker = read('node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js') + '\n;\n' + read('node_modules/tesseract.js/dist/worker.min.js');
const ocrLang = fs.readFileSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz').toString('base64');
for (const [n, s] of [['main', ocrMain], ['worker', ocrWorker]]) if (/<\/script|<!--/i.test(s)) throw new Error('Photo reader ' + n + ' contains text that would break the page');
const out = tpl.split('/*XLSX*/').join(xlsx).split('/*PDFLIB*/').join(pdflib).split('/*CORE*/').join(core).split('/*TEMPLATE*/').join(pdf)
  .split('/*OCRMAIN*/').join(ocrMain).split('/*OCRWORKER*/').join(ocrWorker).split('/*OCRLANG*/').join(ocrLang);
fs.writeFileSync('Nomination Form Filler.html', out);
console.log('Built "Nomination Form Filler.html"', (out.length / 1024 / 1024).toFixed(1) + ' MB');
