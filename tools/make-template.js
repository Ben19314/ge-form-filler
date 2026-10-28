const XLSX=require('xlsx');const C=require('../src/core.js');
const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(C.templateRows());
const tc=['IC / Passport No','Postcode','Tel No','Policy No','Proposal No'].map(h=>C.TEMPLATE_HEADERS.indexOf(h));
for(let r=1;r<=200;r++)tc.forEach(ci=>{const ref=XLSX.utils.encode_cell({r,c:ci});if(!ws[ref])ws[ref]={t:'s',v:''};ws[ref].t='s';ws[ref].v=String(ws[ref].v);ws[ref].z='@';});
ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:200,c:C.TEMPLATE_HEADERS.length-1}});
ws['!cols']=C.TEMPLATE_HEADERS.map(h=>({wch:h==='Address'?45:Math.max(12,h.length+2)}));
XLSX.utils.book_append_sheet(wb,ws,'Customers');const g=XLSX.utils.aoa_to_sheet(C.TEMPLATE_GUIDE);g['!cols']=[{wch:34},{wch:60},{wch:70}];XLSX.utils.book_append_sheet(wb,g,'How to fill');
XLSX.writeFile(wb,'Nomination customer upload template.xlsx');
const back=XLSX.utils.sheet_to_json(XLSX.readFile('Nomination customer upload template.xlsx').Sheets.Customers,{header:1,raw:true,defval:''});console.log('template re-read:',JSON.stringify(C.importRows(back)).slice(0,120));

