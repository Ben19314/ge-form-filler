// Live test run: fills the real Great Eastern form with a made-up customer and prints the checklist.
// Usage: node test-run.js "<path to blank form.pdf>"
const fs = require('fs');
const PDFLib = require('pdf-lib');
const Core = require('./src/core.js');

const templatePath = process.argv[2];
const c = Core.newCase();
c.policy = { proposalNo: '', policyNo: '0123456789' };
c.proposer = { name: 'Tan Wei Ming', nric: '850615-10-5523', muslim: 'no', status: 'married', children: 'yes', childrenCount: '2' };

// Nominee details as they might arrive on WhatsApp
const wa1 = `Name: Lim Siew Ling
IC: 870322-14-5678
Relationship: wife
Share 50%
Address: No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah, 81200 Johor Bahru, Johor`;
const wa2 = `nama: Tan Jun Hao
ic 120910-01-1233
anak lelaki 30%
alamat: No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah, 81200 Johor Bahru`;
const p1 = Core.parsePasted(wa1), p2 = Core.parsePasted(wa2);
console.log('Paste 1 found:', p1.found.join(', '));
console.log('Paste 2 found:', p2.found.join(', '));
c.nominees = [
  Object.assign(Core.newNominee(), p1.values),
  Object.assign(Core.newNominee(), p2.values),
  Object.assign(Core.newNominee(), { name: 'Tan Xin Yi', idNo: '150204-01-0846', relationship: 'daughter', share: '20',
    street: 'No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah', postcode: '81200', town: 'Johor Bahru', nationality: 'malaysian' })
];
c.nominees.forEach((n) => { n.country = 'MALAYSIA'; });

c.trusteeOption = 'appoint';
c.trustees = [Object.assign(Core.newTrustee(), {
  name: 'Lim Siew Ling', idNo: '870322145678', nationality: 'malaysian', cob: 'malaysian',
  telNo: '012-345 6789', telType: 'mobile', street: 'No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah',
  postcode: '81200', town: 'Johor Bahru' })];
c.trustees[0].telNo = '60123456789';

c.witness = Object.assign(c.witness, { type: 'agent', name: 'Agent Sample Name', iac: '1234567' });
c.consent = { needed: false, persons: [] };

(async () => {
  const issues = Core.validate(c);
  const by = (l) => issues.filter((i) => i.level === l);
  console.log('\nMUST FIX:', by('error').length, by('error').map((i) => '\n  - ' + i.text).join(''));
  console.log('MISSING:', by('missing').length, by('missing').map((i) => '\n  - ' + i.text).join(''));
  console.log('CHECK:', by('warn').length, by('warn').map((i) => '\n  - ' + i.text).join(''));
  console.log('NOTES:', by('info').length, by('info').map((i) => '\n  - ' + i.text).join(''));

  const { bytes, report } = await Core.fillForm(PDFLib, fs.readFileSync(templatePath), c);
  const out = 'Sample - Filled Nomination Form (TEST DATA).pdf';
  fs.writeFileSync(out, bytes);
  console.log(`\nFilled ${report.filled} fields. Problems: ${report.problems.length ? report.problems.join('; ') : 'none'}`);
  console.log('Saved:', out);
})();
