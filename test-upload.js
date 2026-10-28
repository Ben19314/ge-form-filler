// Upload test: builds a messy Excel file with made-up customers, reads it back the same way the app does,
// and prints what was imported. Usage: node test-upload.js
const XLSX = require('xlsx');
const Core = require('./src/core.js');

const H = Core.TEMPLATE_HEADERS;
const row = (o) => H.map((h) => (h in o ? o[h] : ''));
const rows = [H,
  // Customer A: Malay words, IC typed as a number (Excel dropped the leading zero), shares as 0.6 / 0.4
  row({ 'Customer Ref': 'Ahmad', 'Policy No': '0987654321', Role: 'Pencadang', 'Full Name': 'Ahmad Faizal bin Hassan', 'IC / Passport No': '800101-14-5011', Muslim: 'Ya', 'Marital Status': 'Berkahwin', 'Has Children': 'Ya', 'No. of Children': 1 }),
  row({ 'Customer Ref': 'Ahmad', Role: 'Penama', 'Full Name': 'Nur Aisyah binti Ahmad Faizal', 'IC / Passport No': 50607140256, Relationship: 'anak perempuan', 'Share %': 0.6, Address: 'No. 8, Jalan SS2/24', Postcode: 47300, Town: 'Petaling Jaya' }),
  row({ 'Customer Ref': 'Ahmad', Role: 'Penama', 'Full Name': 'Siti Hajar binti Omar', 'IC / Passport No': '820505-10-5432', Relationship: 'isteri', 'Share %': 0.4, Address: 'No. 8, Jalan SS2/24', Postcode: '47300', Town: 'Petaling Jaya' }),
  // Customer B: passport holder nominee, dates as dd/mm/yyyy, trustee with phone missing its 0
  row({ 'Customer Ref': 'Wong', 'Policy No': '1122334455', Role: 'Proposer', 'Full Name': 'Wong Kar Wai', 'IC / Passport No': '760808-08-5577', Muslim: 'No', 'Marital Status': 'Married', 'Has Children': 'No' }),
  row({ 'Customer Ref': 'Wong', Role: 'Nominee', 'Full Name': 'Chen Mei Ling', 'IC / Passport No': 'E12345678', 'Passport Expiry': '15/09/2030', 'Date of Birth': '03/02/1980', Gender: 'F', Nationality: 'Taiwan', Relationship: 'Wife', 'Share %': 100, Address: 'Unit 5-3, Residensi Kenanga, Persiaran Kenanga Indah, Seksyen 13', Postcode: '40100', Town: 'Shah Alam' }),
  row({ 'Customer Ref': 'Wong', Role: 'Trustee', 'Full Name': 'Wong Kar Leung', 'IC / Passport No': '790101-08-5123', Address: '22, Lorong Ipoh Garden 1', Postcode: 31400, Town: 'Ipoh', 'Tel No': 165551234 }),
  // Problem rows
  row({ Role: 'Nominee', 'Full Name': 'No Ref Person' }),
  row({ 'Customer Ref': 'Wong', Role: 'Cousin', 'Full Name': 'Wrong Role' }),
  row({ 'Customer Ref': 'EXAMPLE-1', Role: 'Proposer', 'Full Name': 'Example should be ignored' })
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Customers');
XLSX.writeFile(wb, 'TEST upload (dummy customers).xlsx');

// Read back exactly like the app
const back = XLSX.readFile('TEST upload (dummy customers).xlsx', { raw: true });
const aoa = XLSX.utils.sheet_to_json(back.Sheets.Customers, { header: 1, raw: true, defval: '' });
const res = Core.importRows(aoa);
for (const c of res.cases) {
  const iss = Core.validate(c);
  console.log(`\n== ${c.importedFrom}: ${c.proposer.name} | policy ${c.policy.policyNo} | muslim=${c.proposer.muslim} status=${c.proposer.status} children=${c.proposer.children}/${c.proposer.childrenCount}`);
  c.nominees.forEach((n, i) => console.log(`  N${i + 1}: ${n.name} | id ${n.idNo} | ${n.relationship}${n.relationshipOther ? '(' + n.relationshipOther + ')' : ''} | ${n.share}% | nat ${n.nationality}${n.nationalityOther ? '(' + n.nationalityOther + ')' : ''} | dob ${n.dob || '(from IC)'} | pp exp ${n.passportExpiry || '-'} | ${n.postcode} ${n.town}`));
  c.trustees.forEach((t, i) => console.log(`  T${i + 1}: ${t.name} | id ${t.idNo} | tel ${t.telNo} (${t.telType}) | cob ${t.cob} | ${t.postcode} ${t.town}`));
  console.log('  part2:', c.trusteeOption || '-', '| checklist:', ['error', 'missing', 'warn'].map((l) => l + '=' + iss.filter((x) => x.level === l).length).join(' '));
  iss.filter((x) => x.level !== 'info').forEach((x) => console.log('   -', x.level, x.text));
}
console.log('\nRow problems:'); res.problems.forEach((p) => console.log(`  row ${p.row}: ${p.text}`));
