// Parser test with made-up people: one WhatsApp message holding several nominees, plus IC-card text
// as a photo reader returns it. Usage: node test-parse.js
const Core = require('./src/core.js');
const show = (title, list) => {
  console.log('\n== ' + title + ': ' + list.length + ' person(s)');
  list.forEach((p, i) => console.log(`  ${i + 1}.`, JSON.stringify(p.values), '| found:', p.found.join(', ')));
};

show('Labelled message, 2 nominees', Core.parseMany(`Hi boss, here are the nominee details
Nominee 1
Name: Tan Mei Ling
IC: 880101-14-5678
Relationship: wife
Share: 60%
Address: No 8, Jalan SS2/24, 47300 Petaling Jaya

Nominee 2
Name: Tan Jun Hao
IC 100505-14-0123
Son 40%
Address: No 8, Jalan SS2/24
47300 Petaling Jaya`));

show('Unlabelled message, 3 people', Core.parseMany(`Lim Siew Ling
900202-10-5566
wife 50%
No 12 Jalan Bukit 3
Taman Bukit Indah
81200 Johor Bahru

Lim Kai Wen
150707-01-1234
son 25%

Lim Kai Xin
170909-01-1246
daughter 25%`));

show('IC card photo text (with reader noise)', Core.parseMany(`KAD PENGENALAN ee
MALAYSIA
IDENTITY CARD
88O101-14-5678 | Sq
NUR AISYAH BINTI
AHMAD FAIZAL
NO 8 JALAN SS2/24
TAMAN SEA
47300 PETALING JAYA
SELANGOR
WARGANEGARA
PEREMPUAN`));

show('Two IC photos', Core.parseMany(`KAD PENGENALAN MALAYSIA
800101-14-5011
AHMAD FAIZAL BIN HASSAN
LOT 22 KAMPUNG BARU
43000 KAJANG
SELANGOR
WARGANEGARA LELAKI
---
MYKAD
820505-10-5432
SITI HAJAR BINTI OMAR
LOT 22 KAMPUNG BARU
43000 KAJANG
SELANGOR
PEREMPUAN`));
