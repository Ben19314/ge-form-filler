(async()=>{const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const {createCanvas}=require('@napi-rs/canvas');const fs=require('fs');
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),disableFontFace:true,standardFontDataUrl:require("path").join(process.cwd(),"node_modules/pdfjs-dist/standard_fonts/").replace(/\\/g,"/")+"/"}).promise;
const pages=(process.argv[4]||'1,2,3,4').split(',').map(Number);
for(const i of pages){const p=await doc.getPage(i);const vp=p.getViewport({scale:1.6});const cv=createCanvas(vp.width,vp.height);const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,vp.width,vp.height);
await p.render({canvasContext:ctx,viewport:vp,annotationMode:pdfjs.AnnotationMode.ENABLE}).promise;fs.writeFileSync(`${process.argv[3]}-p${i}.png`,cv.toBuffer('image/png'));}
console.log('ok')})().catch(e=>{console.error(e);process.exit(1)});

