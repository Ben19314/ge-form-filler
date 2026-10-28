/* Core logic for the Great Eastern Nomination Form Filler.
   Form: NBZ-FNOMI-V07-082025 (Appointment / Change of Nominee(s) / Trustee(s)).
   Shared by the browser app and the Node test run. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FormCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORM_CODE = 'NBZ-FNOMI-V07-082025';
  const RELATIONSHIPS = ['husband', 'wife', 'son', 'daughter', 'father', 'mother', 'brother', 'sister', 'others'];
  const STATUSES = ['married', 'single', 'divorced', 'widowed'];
  const TRUSTEE_OPTIONS = ['appoint', 'additional', 'replace', 'revoke'];
  const TEL_TYPES = ['house', 'mobile', 'office'];

  // Fields the app writes. Used to check that a newly loaded form version still matches.
  const KEY_FIELDS = ['Proposer Name', 'Proposer NRIC', 'Proposal No', 'Policy No', 'N1 Name1', 'N1 NRIC',
    'N1 percent', 'N4 Name1', 'T1 Name1', 'T2 Name1', 'W1 Name', 'IAC No 1', 'Part 2', 'N1 Relationship',
    'Page 5 Consent1', 'Declaration Date'];

  // ---------- small helpers ----------
  const U = (s) => (s == null ? '' : String(s)).trim().toUpperCase().replace(/\s+/g, ' ');
  const normId = (s) => U(s).replace(/[\s\-\/]/g, '');
  const isIC = (id) => /^\d{12}$/.test(id);
  const isPassport = (id) => /[A-Z]/.test(id);
  const pad2 = (n) => String(n).padStart(2, '0');
  const blankPerson = () => ({ name: '', idNo: '', passportExpiry: '', gender: '', dob: '', nationality: '',
    nationalityOther: '', street: '', postcode: '', town: '', country: 'MALAYSIA' });

  function newCase() {
    return {
      id: 'c' + Date.now().toString(36),
      policy: { proposalNo: '', policyNo: '' },
      proposer: { name: '', nric: '', muslim: '', status: '', children: '', childrenCount: '' },
      nominees: [Object.assign(blankPerson(), { relationship: '', relationshipOther: '', share: '' })],
      trusteeOption: '',
      trustees: [],
      witness: { type: 'agent', name: '', iac: '', idNo: '', passportExpiry: '', dob: '', street: '', postcode: '', town: '', country: 'MALAYSIA' },
      consent: { needed: false, persons: [] },
      signDate: '',
      notes: ''
    };
  }
  const newNominee = () => Object.assign(blankPerson(), { relationship: '', relationshipOther: '', share: '' });
  const newTrustee = () => Object.assign(blankPerson(), { cob: '', cobOther: '', telNo: '', telCountry: 'MALAYSIA', telType: '' });

  // Malaysian IC: YYMMDD-PB-###G. Last digit odd = male, even = female.
  function icInfo(idRaw, today) {
    const id = normId(idRaw);
    if (!isIC(id)) return null;
    const yy = +id.slice(0, 2), mm = +id.slice(2, 4), dd = +id.slice(4, 6);
    const now = today || new Date();
    const year = yy > now.getFullYear() % 100 ? 1900 + yy : 2000 + yy;
    const d = new Date(Date.UTC(year, mm - 1, dd));
    if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return { valid: false };
    return { valid: true, dob: `${year}-${pad2(mm)}-${pad2(dd)}`, gender: (+id[11]) % 2 ? 'male' : 'female' };
  }

  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function ageOn(dobIso, today) {
    const b = parseISO(dobIso); if (!b) return null;
    const t = today || new Date();
    let a = t.getFullYear() - b.y;
    if (t.getMonth() + 1 < b.m || (t.getMonth() + 1 === b.m && t.getDate() < b.d)) a--;
    return a;
  }
  const ddmmyy = (iso) => { const p = parseISO(iso); return p ? `${pad2(p.d)}/${pad2(p.m)}/${pad2(p.y % 100)}` : ''; };
  const effDob = (p) => p.dob || (icInfo(p.idNo) || {}).dob || '';
  const effGender = (p) => p.gender || (icInfo(p.idNo) || {}).gender || '';

  // Split text into up to maxLines lines of at most maxLen characters, by whole words.
  function splitLines(text, maxLen, maxLines) {
    const words = U(text).split(' ').filter(Boolean);
    const lines = []; let cur = '';
    for (let w of words) {
      while (w.length > maxLen) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, maxLen)); w = w.slice(maxLen); }
      if (!cur) cur = w; else if ((cur + ' ' + w).length <= maxLen) cur += ' ' + w; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return { lines: lines.slice(0, maxLines), overflow: lines.length > maxLines };
  }

  // Common Malaysian address short forms, applied only when the address does not fit.
  const ADDRESS_ABBR = [
    [/\bJALAN\b/g, 'JLN'], [/\bTAMAN\b/g, 'TMN'], [/\bLORONG\b/g, 'LRG'], [/\bKAMPUNG\b/g, 'KG'],
    [/\bPERSIARAN\b/g, 'PSRN'], [/\bBANDAR\b/g, 'BDR'], [/\bSEKSYEN\b/g, 'SEK'], [/\bAPARTMENT\b/g, 'APT'],
    [/\bKONDOMINIUM\b|\bCONDOMINIUM\b/g, 'KONDO'], [/\bBLOK\b|\bBLOCK\b/g, 'BLK'], [/\bTINGKAT\b|\bFLOOR\b/g, 'TKT'],
    [/\bNOMBOR\b|\bNUMBER\b/g, 'NO'], [/\bLEBUH\b/g, 'LBH'], [/\bPANGSAPURI\b/g, 'PPURI'], [/\bRESIDENSI\b|\bRESIDENCE\b/g, 'RES']
  ];
  function fitAddress(street) {
    let s = U(street).replace(/\s*,\s*/g, ', ').replace(/,+/g, ',');
    let r = splitLines(s, 32, 3); const used = [];
    for (const [re, ab] of ADDRESS_ABBR) {
      if (!r.overflow) break;
      if (re.test(s)) { s = s.replace(re, ab); used.push(ab); r = splitLines(s, 32, 3); }
      re.lastIndex = 0;
    }
    return { lines: r.lines, overflow: r.overflow, abbreviated: used };
  }

  // Helvetica (WinAnsi) cannot print Chinese/Tamil etc. Names must be as per NRIC in Latin letters anyway.
  const nonLatin = (s) => /[^\x20-\x7E -ÿ]/.test(s || '');

  // ---------- validation ----------
  // Returns a list of { level: 'missing'|'error'|'warn'|'info', tab, text }
  function validate(c, today) {
    const out = [];
    const add = (level, tab, text) => out.push({ level, tab, text });
    const now = today || new Date();
    const P = c.proposer, pId = normId(P.nric);

    // Policy & proposer
    if (!U(c.policy.proposalNo) && !U(c.policy.policyNo)) add('missing', 'proposer', 'Policy No. or Proposal No. (at least one)');
    ['proposalNo', 'policyNo'].forEach((k) => {
      const v = normId(c.policy[k]);
      if (v && v.length > 10) add('error', 'proposer', `${k === 'policyNo' ? 'Policy' : 'Proposal'} No. is ${v.length} characters; the form allows 10.`);
    });
    if (!U(P.name)) add('missing', 'proposer', 'Proposer: full name as per NRIC/passport');
    else if (U(P.name).length > 28) add('warn', 'proposer', `Proposer name is ${U(P.name).length} characters; the form box is set for 28. The app fits it in smaller print, so check it is readable.`);
    if (!pId) add('missing', 'proposer', 'Proposer: NRIC / passport no.');
    else checkId(pId, 'Proposer', 'proposer');
    if (!P.muslim) add('missing', 'proposer', 'Proposer: Muslim? (Yes/No)');
    if (!P.status) add('missing', 'proposer', 'Proposer: marital status');
    if (!P.children) add('missing', 'proposer', 'Proposer: has children? (Yes/No)');
    if (P.children === 'yes' && !String(P.childrenCount).trim()) add('missing', 'proposer', 'Proposer: number of children');

    function checkId(id, who, tab) {
      if (/^\d+$/.test(id) && id.length !== 12) add('error', tab, `${who}: NRIC must be 12 digits (found ${id.length}).`);
      else if (isIC(id) && !icInfo(id, now).valid) add('error', tab, `${who}: NRIC ${id} does not start with a valid date of birth (YYMMDD).`);
      if (id.length > 12) add('error', tab, `${who}: ID no. is ${id.length} characters; the form allows 12.`);
    }

    function checkPerson(p, who, tab, opts) {
      const id = normId(p.idNo);
      if (!U(p.name)) add('missing', tab, `${who}: full name`);
      else {
        if (nonLatin(p.name)) add('error', tab, `${who}: name has non-English characters. Use the spelling on the NRIC/passport.`);
        if (opts.nameLines && splitLines(p.name, 28, opts.nameLines).overflow) add('error', tab, `${who}: name is too long for the form (${opts.nameLines} lines × 28 characters).`);
      }
      if (!id) add('missing', tab, `${who}: NRIC / passport no.`); else checkId(id, who, tab);
      if (id && isPassport(id) && !p.passportExpiry) add('missing', tab, `${who}: passport expiry date (needed because a passport no. is used)`);
      const ic = icInfo(id, now);
      if (!effDob(p)) add('missing', tab, `${who}: date of birth`);
      else if (ic && ic.valid && p.dob && p.dob !== ic.dob) add('warn', tab, `${who}: date of birth ${ddmmyy(p.dob)} does not match the IC (${ddmmyy(ic.dob)}). The PDF recalculates DOB from the IC when opened in Adobe.`);
      if (opts.gender !== false) {
        if (!effGender(p)) add('missing', tab, `${who}: gender`);
        else if (ic && ic.valid && p.gender && p.gender !== ic.gender) add('warn', tab, `${who}: gender is set to ${p.gender} but the IC's last digit indicates ${ic.gender}.`);
      }
      if (opts.nationality !== false) {
        if (!p.nationality) add('missing', tab, `${who}: nationality`);
        else if (p.nationality === 'other' && !U(p.nationalityOther)) add('missing', tab, `${who}: nationality (please state)`);
        if (p.nationality === 'other' && ic && ic.valid) add('warn', tab, `${who}: nationality is "Others" but a Malaysian IC no. was entered.`);
      }
      if (!U(p.street)) add('missing', tab, `${who}: mailing address`);
      else { const f = fitAddress(p.street); if (f.overflow) add('error', tab, `${who}: address is too long for 3 lines × 32 characters, even after short forms. Please shorten it.`); else if (f.abbreviated.length) add('info', tab, `${who}: address shortened to fit (${f.abbreviated.join(', ')}).`); }
      if (!/^\d{5}$/.test(U(p.postcode))) add(U(p.postcode) ? 'error' : 'missing', tab, `${who}: postcode${U(p.postcode) ? ' must be 5 digits' : ''}`);
      if (!U(p.town)) add('missing', tab, `${who}: town`); else if (U(p.town).length > 25) add('error', tab, `${who}: town is longer than 25 characters.`);
      if (!U(p.country)) add('missing', tab, `${who}: country`); else if (U(p.country).length > 10) add('error', tab, `${who}: country is longer than the form's 10 characters (e.g. use "UK").`);
    }

    // Nominees
    const noms = c.nominees || [];
    if (!noms.length) add('missing', 'nominees', 'At least one nominee');
    if (noms.length > 4) add('error', 'nominees', 'The form takes a maximum of 4 nominees.');
    let total = 0; const seen = {};
    const hasSpouseOrChild = P.status === 'married' || P.children === 'yes';
    let trustNominee = false, nonTrustNominee = false;
    noms.forEach((n, i) => {
      const who = `Nominee ${i + 1}`;
      checkPerson(n, who, 'nominees', { nameLines: 3 });
      if (!n.relationship) add('missing', 'nominees', `${who}: relationship`);
      else if (n.relationship === 'others' && !U(n.relationshipOther)) add('missing', 'nominees', `${who}: relationship (please state)`);
      const sh = parseFloat(n.share);
      if (!String(n.share).trim()) add('missing', 'nominees', `${who}: % of share`);
      else if (!(sh > 0 && sh <= 100)) add('error', 'nominees', `${who}: % of share must be between 0 and 100.`);
      else total += sh;
      const id = normId(n.idNo);
      if (id) { if (seen[id]) add('error', 'nominees', `${who} has the same ID no. as ${seen[id]}.`); seen[id] = who; }
      if (id && id === pId) add('error', 'nominees', `${who} has the same ID no. as the proposer.`);
      const g = effGender(n), r = n.relationship;
      if ((r === 'husband' || r === 'son' || r === 'father' || r === 'brother') && g === 'female') add('warn', 'nominees', `${who}: relationship "${r}" but gender is female.`);
      if ((r === 'wife' || r === 'daughter' || r === 'mother' || r === 'sister') && g === 'male') add('warn', 'nominees', `${who}: relationship "${r}" but gender is male.`);
      if ((r === 'husband' || r === 'wife') && P.status && P.status !== 'married') add('warn', 'nominees', `${who} is a ${r} but the proposer's status is ${P.status}.`);
      if ((r === 'son' || r === 'daughter') && P.children === 'no') add('warn', 'nominees', `${who} is a ${r} but the proposer says they have no children.`);
      const spouseChild = ['husband', 'wife', 'son', 'daughter'].includes(r);
      const parent = ['father', 'mother'].includes(r);
      if (r) { if (spouseChild || (parent && !hasSpouseOrChild)) trustNominee = true; else nonTrustNominee = true; }
      const age = ageOn(effDob(n), now);
      if (age !== null && age < 18) add('info', 'nominees', `${who} is under 18 (age ${age}). If no trustee is appointed, the parent other than the policyowner acts as trustee (Note 3).`);
    });
    if (noms.length && Math.abs(total - 100) > 0.001 && noms.every((n) => String(n.share).trim())) add('error', 'nominees', `Nominee shares add up to ${+total.toFixed(2)}%; they must total 100%.`);

    // Trust policy guidance (form Important Notice 1, 2 and 4)
    const trustees = c.trustees || [];
    const appointing = ['appoint', 'additional', 'replace'].includes(c.trusteeOption);
    if (P.muslim === 'yes') {
      add('info', 'nominees', 'Muslim policyowner: nominees receive the policy money as executor (wasi), not as beneficiary (Notes 1 & 4a).');
      if (trustees.length || appointing) add('warn', 'trustees', 'The form says a Muslim policyowner should NOT appoint a trustee (Note 4a).');
    } else if (P.muslim === 'no') {
      if (trustNominee) {
        add('info', 'trustees', 'Non-Muslim with a spouse/child (or parent) nominee: this becomes a trust policy. A trustee other than the policyowner should be appointed (Note 2).');
        if (!trustees.length && c.trusteeOption !== 'revoke') add('warn', 'trustees', 'No trustee entered for a trust policy. If none is appointed, the rules in Note 3 decide who the trustee is. Confirm this with the client.');
      }
      if (nonTrustNominee) add('info', 'nominees', 'Some nominees are not spouse/child/parent: they receive the money as executor, not beneficiary. Consider an assignment if the client wants them to benefit (Note 1).');
      if (nonTrustNominee && !trustNominee && trustees.length) add('warn', 'trustees', 'The form says not to appoint a trustee when the nominees are not spouse/child/parent (Note 4b).');
    }

    // Trustees (Part 2)
    if (trustees.length > 2) add('error', 'trustees', 'The form takes a maximum of 2 trustees.');
    if (trustees.length && !c.trusteeOption) add('missing', 'trustees', 'Part 2: choose an option (appoint / additional / revoke & appoint / revoke)');
    if (c.trusteeOption === 'revoke' && trustees.length) add('warn', 'trustees', 'Option "Revoke all existing trustees" is selected, so the trustee details entered will not be printed.');
    if (appointing && !trustees.length) add('missing', 'trustees', 'Part 2: trustee details (the option chosen appoints a trustee)');
    if (c.trusteeOption !== 'revoke') trustees.forEach((t, i) => {
      const who = `Trustee ${i + 1}`;
      checkPerson(t, who, 'trustees', { nameLines: 3 });
      if (!t.cob) add('missing', 'trustees', `${who}: country of birth`);
      else if (t.cob === 'other' && !U(t.cobOther)) add('missing', 'trustees', `${who}: country of birth (please state)`);
      if (!normId(t.telNo) || !U(t.telCountry) || !t.telType) add('missing', 'trustees', `${who}: tel no., its country and type (house / handphone / office)`);
      else if (!/^\d{6,12}$/.test(normId(t.telNo).replace(/^\+/, ''))) add('error', 'trustees', `${who}: tel no. should be 6–12 digits incl. country code, e.g. 60123456789.`);
      const id = normId(t.idNo);
      if (id && id === pId) add('error', 'trustees', `${who}: the policyowner cannot appoint themself as trustee.`);
      const age = ageOn(effDob(t), now);
      if (age !== null && age < 18) add('error', 'trustees', `${who} is under 18 (age ${age}); a trustee must be an adult.`);
    });

    // Witness
    const W = c.witness, wId = normId(W.idNo);
    if (W.type === 'agent') {
      if (!U(W.name)) add('missing', 'witness', 'Witness (agent): name. Set it once in Settings.');
      if (!/^\d{1,7}$/.test(String(W.iac || '').trim())) add(String(W.iac || '').trim() ? 'error' : 'missing', 'witness', 'Witness (agent): IAC no. (up to 7 digits)');
    } else {
      checkPerson(W, 'Witness', 'witness', { nameLines: 2, gender: false, nationality: false });
      const age = ageOn(effDob(W), now);
      if (age !== null && age < 18) add('error', 'witness', `Witness is under 18 (age ${age}).`);
      const clash = [[pId, 'the proposer']].concat(noms.map((n, i) => [normId(n.idNo), `Nominee ${i + 1}`]), trustees.map((t, i) => [normId(t.idNo), `Trustee ${i + 1}`]));
      clash.forEach(([id, who]) => { if (wId && id && wId === id) add('error', 'witness', `Witness cannot be the same person as ${who}.`); });
    }
    if (U(W.name)) {
      const names = [[U(P.name), 'the proposer']].concat(noms.map((n, i) => [U(n.name), `Nominee ${i + 1}`]), trustees.map((t, i) => [U(t.name), `Trustee ${i + 1}`]));
      names.forEach(([nm, who]) => { if (nm && nm === U(W.name)) add('error', 'witness', `Witness has the same name as ${who}.`); });
    }

    // Part 3 consent
    if (c.consent.needed) {
      const ps = c.consent.persons || [];
      if (!ps.length) add('missing', 'witness', 'Part 3: at least one existing nominee/trustee giving consent');
      if (ps.length > 4) add('error', 'witness', 'Part 3 takes a maximum of 4 consent persons.');
      ps.forEach((p, i) => {
        if (!U(p.name)) add('missing', 'witness', `Consent person ${i + 1}: name`);
        if (!normId(p.idNo)) add('missing', 'witness', `Consent person ${i + 1}: NRIC / passport no.`);
        else if (normId(p.idNo).length > 12) add('error', 'witness', `Consent person ${i + 1}: ID no. longer than 12 characters.`);
      });
    }
    return out;
  }

  // ---------- PDF filling ----------
  async function fillForm(PDFLib, templateBytes, c, opts) {
    opts = opts || {};
    const { PDFDocument, PDFName, StandardFonts } = PDFLib;
    const doc = await PDFDocument.load(templateBytes);
    const form = doc.getForm();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const report = { filled: 0, problems: [] };
    const has = (n) => { try { form.getField(n); return true; } catch (e) { return false; } };

    // Remove the on-screen "100.00" share totals, the red "Validate" button and the yellow "ENSURE" banner from every page.
    // The app runs its own checks, so these are not needed on the output.
    const REMOVE = ['Total %', 'Total 1', 'Button1', 'Button2']; // Button2 = yellow "ENSURE all warning messages" banner
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'));
    const co = acro && acro.lookup(PDFName.of('CO'));
    REMOVE.forEach((n) => {
      if (!has(n)) return;
      const f = form.getField(n);
      if (co && co.asArray) {
        const ref = f.ref;
        for (let i = co.size() - 1; i >= 0; i--) if (co.get(i) === ref) co.remove(i);
      }
      form.removeField(f);
    });

    function text(name, value, o) {
      const v = U(value);
      if (!v) return;
      if (!has(name)) { report.problems.push(`Form has no field "${name}"`); return; }
      const f = form.getTextField(name);
      const max = f.getMaxLength();
      if (max !== undefined && v.length > max) {
        if (o && o.relax) { if (f.isCombed()) f.disableCombing(); f.setMaxLength(undefined); }
        else { report.problems.push(`"${name}" left blank: "${v}" is longer than ${max} characters`); return; }
      }
      f.setText(v);
      // Shrink the print size when the text is wider than a (non-box) field.
      if (!f.isCombed()) {
        const da = /\/\w+\s+([\d.]+)\s+Tf/.exec(String(f.acroField.getDefaultAppearance() || ''));
        const size = da ? parseFloat(da[1]) : 10;
        const rects = f.acroField.getWidgets().map((w) => w.getRectangle());
        const width = Math.min.apply(null, rects.map((r) => r.width)) - 4;
        const height = Math.min.apply(null, rects.map((r) => r.height));
        // Boxes too short for two lines are treated as one line, even if marked multi-line.
        const oneLine = !f.isMultiline() || height < size * 2.2;
        if (size > 0 && oneLine && helv.widthOfTextAtSize(v, size) > width) {
          f.setFontSize(Math.max(5, Math.floor((width / helv.widthOfTextAtSize(v, 1)) * 10) / 10));
        }
      }
      report.filled++;
    }
    // Tick box n (1-based) of a multi-box group; boxes are named Choice1..ChoiceN left to right.
    function tick(name, n) {
      if (!n) return;
      if (!has(name)) { report.problems.push(`Form has no field "${name}"`); return; }
      const af = form.getCheckBox(name).acroField;
      const val = 'Choice' + n; let found = false;
      af.getWidgets().forEach((w) => {
        const on = w.getOnValue();
        const match = on && on.decodeText() === val;
        if (match) found = true;
        w.setAppearanceState(match ? on : PDFName.of('Off'));
      });
      if (!found) { report.problems.push(`"${name}" has no option ${n}`); return; }
      af.dict.set(PDFName.of('V'), PDFName.of(val));
      report.filled++;
    }
    const idx = (list, v) => { const i = list.indexOf(v); return i < 0 ? 0 : i + 1; };
    const yn = (v) => (v === 'no' ? 1 : v === 'yes' ? 2 : 0);
    const nat = (v) => (v === 'malaysian' ? 1 : v === 'other' ? 2 : 0);
    const gen = (v) => (v === 'male' ? 1 : v === 'female' ? 2 : 0);

    function names(prefix, name, lines) {
      const s = splitLines(name, 28, lines).lines;
      s.forEach((l, i) => text(`${prefix} Name${i + 1}`, l));
    }
    function address(prefix, p, mailing) {
      fitAddress(p.street).lines.forEach((l, i) => text(`${prefix} ${mailing}${i + 1}`, l));
      text(`${prefix} Postcode`, p.postcode); text(`${prefix} Town`, p.town); text(`${prefix} Country`, p.country);
    }
    function dob(prefix, p) {
      const d = parseISO(effDob(p)); if (!d) return;
      text(`${prefix} DOB Day`, pad2(d.d)); text(`${prefix} DOB Month`, pad2(d.m)); text(`${prefix} DOB Year`, pad2(d.y % 100));
    }
    function idAndPassport(prefix, p) {
      const id = normId(p.idNo); text(`${prefix} NRIC`, id);
      if (isPassport(id)) text(`${prefix} Passport`, ddmmyy(p.passportExpiry));
    }

    // Page 1 header and proposer
    const P = c.proposer;
    text('Proposal No', normId(c.policy.proposalNo));
    text('Policy No', normId(c.policy.policyNo));
    text('Proposer Name', P.name, { relax: true });
    text('Proposer NRIC', normId(P.nric));
    tick('Proposer Muslim', yn(P.muslim));
    tick('Proposer Status', idx(STATUSES, P.status));
    tick('Proposer Children', yn(P.children));
    if (P.children === 'yes') text('No. of Children', String(P.childrenCount));
    text('Proposer Name2', P.name); // name under the proposer's signature (pages 3 and 4)

    // Nominees 1-4
    let total = 0;
    (c.nominees || []).slice(0, 4).forEach((n, i) => {
      const k = `N${i + 1}`;
      names(k, n.name, 3);
      idAndPassport(k, n);
      tick(`${k} Gender`, gen(effGender(n)));
      dob(k, n);
      tick(`${k} Nationality`, nat(n.nationality));
      if (n.nationality === 'other') text(`${k} Nationality Others`, n.nationalityOther);
      tick(`${k} Relationship`, idx(RELATIONSHIPS, n.relationship));
      if (n.relationship === 'others') text(`${k} Relationship Others`, n.relationshipOther);
      const sh = parseFloat(n.share);
      if (sh > 0) { text(`${k} percent`, sh.toFixed(2)); total += sh; }
      address(k, n, 'Mailing');
    });

    // Signature dates (optional; usually written on the day of signing)
    const sd = parseISO(c.signDate);
    if (sd) text('Declaration Date', ddmmyy(c.signDate));

    // Witness (page 3 for Part 1; page 4/5 for Part 2)
    const W = c.witness, agent = W.type === 'agent';
    text('W1 Name', W.name);
    if (agent) text('IAC No 1', W.iac);
    else {
      names('W1', W.name, 2); idAndPassport('W1', W); dob('W1', W); address('W1', W, 'Mailing');
    }

    // Part 2 trustees
    const tOpt = idx(TRUSTEE_OPTIONS, c.trusteeOption);
    if (tOpt) {
      tick('Part 2', tOpt);
      if (c.trusteeOption !== 'revoke') {
        (c.trustees || []).slice(0, 2).forEach((t, i) => {
          const k = `T${i + 1}`;
          names(k, t.name, 3);
          text(`${k} Name`, t.name); // name under the trustee's signature
          idAndPassport(k, t);
          tick(`${k} Gender`, gen(effGender(t)));
          const d = parseISO(effDob(t));
          if (d) { text(`${k} DOB Day`, pad2(d.d)); text(`${k} DOB Month`, pad2(d.m)); text(`${k} DOB Year`, pad2(d.y % 100)); }
          tick(`${k} Nationality`, nat(t.nationality));
          if (t.nationality === 'other') text(`${k} Nationality Others`, t.nationalityOther);
          tick(`${k} Country of Birth`, nat(t.cob));
          if (t.cob === 'other') text(`${k} Country of Birth Others`, t.cobOther);
          text(`${k} Tel No`, normId(t.telNo).replace(/^\+/, ''));
          text(`${k} Tel Country`, t.telCountry);
          tick(`${k} Tels`, idx(TEL_TYPES, t.telType));
          address(k, t, 'Mailing');
        });
      }
      text('W2 Name', W.name);
      if (agent) text('IAC No 2', W.iac);
      else { names('W2', W.name, 2); idAndPassport('W2', W); dob('W2', W); address('W2', W, 'Mailing'); }
      if (sd) { text('Day2', pad2(sd.d)); text('Month2', pad2(sd.m)); text('Year2', pad2(sd.y % 100)); }
    }

    // Part 3 consent of existing nominees/trustees
    if (c.consent.needed) {
      (c.consent.persons || []).slice(0, 4).forEach((p, i) => {
        const n = i + 1;
        text(`Page 5 Consent${n}`, p.name);
        text(`Page 5 Consent1 NRIC${n}`, normId(p.idNo));
        if (sd) { text(`Day${n + 2}`, pad2(sd.d)); text(`Month${n + 2}`, pad2(sd.m)); text(`Year${n + 2}`, pad2(sd.y % 100)); }
        text(`Page 5 Witness ${n}`, W.name);
        if (agent) text(`Page 5 Witness IAC ${n}`, W.iac);
        else {
          text(`Page5_Witness_NRIC${n}`, normId(W.idNo));
          text(`Page 5 Witness DOB${n}`, ddmmyy(effDob(W)));
          if (isPassport(normId(W.idNo))) text(`Page 5 Witness Passport${n}`, ddmmyy(W.passportExpiry));
          text(`Page 5 Witness Add${n}`, U(W.street));
          text(`Page 5 Witness Postcode${n}`, W.postcode); text(`Page 5 Witness Town${n}`, W.town);
          text(`Page 5 Witness Country${n}`, W.country);
        }
      });
    }

    form.updateFieldAppearances(helv);
    doc.setModificationDate(new Date());
    const bytes = await doc.save();
    return { bytes, report };
  }

  // Check that a (new) form version still has the fields this app writes.
  async function checkTemplate(PDFLib, bytes) {
    const doc = await PDFLib.PDFDocument.load(bytes);
    const names = new Set(doc.getForm().getFields().map((f) => f.getName()));
    return KEY_FIELDS.filter((n) => !names.has(n));
  }

  // ---------- paste helper ----------
  // Pulls details out of a pasted WhatsApp message / notes. Everything it finds is shown for review.
  const REL_WORDS = [
    ['husband', /\b(husband|suami)\b|老公|丈夫/i], ['wife', /\b(wife|isteri|istri)\b|老婆|妻子|太太/i],
    ['son', /\b(son|anak lelaki)\b|儿子/i], ['daughter', /\b(daughter|anak perempuan)\b|女儿/i],
    ['father', /\b(father|dad|bapa|ayah|abah)\b|父亲|爸爸/i], ['mother', /\b(mother|mum|mom|ibu|emak|mak)\b|母亲|妈妈/i],
    ['brother', /\b(brother|abang|adik lelaki)\b|哥哥|弟弟/i], ['sister', /\b(sister|kakak|adik perempuan)\b|姐姐|妹妹/i]
  ];
  function parsePasted(raw) {
    const r = {}; const found = [];
    const textIn = String(raw || '');
    const lines = textIn.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const label = (re) => {
      for (let i = 0; i < lines.length; i++) {
        const m = new RegExp('^(?:' + re + ')\\s*[:：\\-=]\\s*(.*)$', 'i').exec(lines[i]);
        if (m) return { value: m[1].trim(), index: i };
      }
      return null;
    };
    const nm = label('full name|name|nama penuh|nama|姓名|名字');
    if (nm && nm.value) { r.name = U(nm.value); found.push('name'); }
    const ic = /\b(\d{6})[\s\-]?(\d{2})[\s\-]?(\d{4})\b/.exec(textIn);
    if (ic) { r.idNo = ic[1] + ic[2] + ic[3]; found.push('IC'); }
    else {
      const pp = /(?:passport|pasport)(?:\s*no\.?)?\s*[:\-]?\s*([A-Z]{1,2}\d{6,9})\b/i.exec(textIn);
      if (pp) { r.idNo = pp[1].toUpperCase(); found.push('passport no.'); }
    }
    const addr = label('mailing address|address|alamat|地址');
    if (addr) {
      let full = addr.value;
      for (let j = addr.index + 1; j < lines.length && !/^[A-Za-z %一-鿿]{2,25}\s*[:：=]/.test(lines[j]); j++) full = full.replace(/[,\s]+$/, '') + ', ' + lines[j];
      const pc = /\b(\d{5})\s+([A-Za-z .']+?)(?:,|$)/.exec(full);
      if (pc) {
        r.postcode = pc[1]; r.town = U(pc[2]); found.push('postcode', 'town');
        full = full.slice(0, pc.index).replace(/[,\s]+$/, '');
      }
      r.street = U(full); found.push('address');
    }
    const sh = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(textIn);
    if (sh) { r.share = sh[1]; found.push('share %'); }
    const relLine = (label('relationship|hubungan|关系') || {}).value || textIn;
    for (const [k, re] of REL_WORDS) if (re.test(relLine)) { r.relationship = k; found.push('relationship'); break; }
    if (/\b(female|perempuan|wanita)\b|女/i.test((label('gender|jantina|sex|性别') || {}).value || '')) { r.gender = 'female'; found.push('gender'); }
    else if (/\b(male|lelaki)\b|男/i.test((label('gender|jantina|sex|性别') || {}).value || '')) { r.gender = 'male'; found.push('gender'); }
    const tel = /(\+?6?0\d{1,2})[\s\-]?(\d{3,4})[\s\-]?(\d{4})\b/.exec(textIn.replace(/\b\d{6}[\s\-]?\d{2}[\s\-]?\d{4}\b/g, ''));
    if (tel) { let t = (tel[1] + tel[2] + tel[3]).replace(/^\+/, ''); if (t.startsWith('0')) t = '6' + t; r.telNo = t; found.push('phone'); }
    // No labels (an IC photo, or a message like "Tan Mei Ling / 880101-14-5678 / No 8 Jalan…"): read the line layout.
    if (!r.idNo) { const t = icTolerant(lines); if (t) { r.idNo = t.id; found.push('IC'); } }
    if (!r.name || !addr) {
      const lay = unlabelled(lines);
      if (!r.name && lay.name) { r.name = lay.name; found.push('name'); }
      if (!addr && lay.street) { r.street = lay.street; found.push('address'); }
      if (!addr && lay.postcode) { r.postcode = lay.postcode; r.town = lay.town; found.push('postcode', 'town'); }
      if (!r.gender && lay.gender) { r.gender = lay.gender; found.push('gender'); }
    }
    const info = icInfo(r.idNo || '');
    if (info && info.valid) { r.nationality = 'malaysian'; if (!r.gender) r.gender = info.gender; r.dob = info.dob; }
    return { values: r, found: Array.from(new Set(found)) };
  }

  // IC number as a photo reader may see it: O for 0, I / l / | for 1, odd dashes. Needs 9+ real digits.
  const IC_LOOSE = /(^|[^\w])([\dOIl|]{6})\s?[-~–—]?\s?([\dOIl|]{2})\s?[-~–—]?\s?([\dOIl|]{4})(?![\w])/;
  function icTolerant(lines) {
    for (let i = 0; i < lines.length; i++) {
      const m = IC_LOOSE.exec(lines[i]); if (!m) continue;
      const raw = m[2] + m[3] + m[4]; if ((raw.match(/\d/g) || []).length < 9) continue;
      const id = raw.replace(/O/g, '0').replace(/[Il|]/g, '1');
      if (icInfo(id).valid) return { id, index: i };
    }
    return null;
  }
  const CARD_WORDS = /KAD\s*PENGENALAN|IDENTITY\s*CARD|MYKAD|WARGANEGARA|\b(LELAKI|PEREMPUAN)\b/i;
  const NOISE_LINE = /KAD\s*PENGENALAN|IDENTITY\s*CARD|MYKAD|^MALAYSIA$|WARGANEGARA|^(LELAKI|PEREMPUAN|ISLAM|BUDDHA|KRISTIAN|HINDU)$|PENDAFTARAN|KETUA PENGARAH/i;
  const ADDR_START = /^(NO\b|NO\.|LOT\b|JALAN|JLN|TAMAN|TMN|KAMPUNG|KAMPONG|KG\b|LORONG|LRG|BLOK|BLK|BLOCK|UNIT|LEVEL|TINGKAT|APARTMENT|APT|PANGSAPURI|FLAT|RUMAH|BATU|PERSIARAN|LEBUH|SEKSYEN|BANDAR|KAWASAN|PPR|KONDOMINIUM|CONDO|RESIDENSI|PEKAN|LADANG|SIMPANG)\b/i;
  const CHAT_WORDS = /\b(hi|hello|boss|thanks|thank|terima kasih|nominee|nominees|penama|trustee|details?|maklumat|please|tolong|ic|address|alamat)\b/i;
  const isRel = (s) => REL_WORDS.some(([, re]) => re.test(s));
  const nameLike = (s, minWords) => /^[A-Za-z@'.\/\- ]{3,80}$/.test(s) && (s.match(/[A-Za-z]/g) || []).length >= 3 &&
    !ADDR_START.test(s) && !NOISE_LINE.test(s) && !CHAT_WORDS.test(s) && !isRel(s) && s.trim().split(/\s+/).length >= minWords;
  const PC_LINE = /(^|[\s,])(\d{5})\s+([A-Za-z][A-Za-z .']+?)\s*(?:,|$)/;
  function unlabelled(lines) {
    const out = {};
    const text = lines.join('\n');
    const card = CARD_WORDS.test(text);
    const icAt = icTolerant(lines);
    const ic = icAt ? icAt.index : -1;
    if (card && /\bPEREMPUAN\b/i.test(text)) out.gender = 'female'; else if (card && /\bLELAKI\b/i.test(text)) out.gender = 'male';
    // Name: on the IC card it is under the IC number; in a message it is usually just above it.
    let nameEnd = -1;
    if (ic >= 0) {
      if (card) {
        const parts = [];
        for (let j = ic + 1; j < lines.length && parts.length < 3; j++) {
          const s = lines[j];
          if (NOISE_LINE.test(s) || (s.match(/[A-Za-z]/g) || []).length < 3) { if (parts.length) break; continue; }
          if (nameLike(s, parts.length ? 1 : 2)) { parts.push(s); nameEnd = j; } else break;
        }
        if (parts.length) out.name = U(parts.join(' '));
      } else {
        for (const j of [ic - 1, ic - 2, ic + 1]) if (j >= 0 && j < lines.length && nameLike(lines[j], 2)) { out.name = U(lines[j]); nameEnd = Math.max(ic, j); break; }
      }
    }
    // Address: lines down to the "47300 PETALING JAYA" line.
    let pcAt = -1;
    for (let j = 0; j < lines.length; j++) if (j !== ic && PC_LINE.test(lines[j]) && !/%/.test(lines[j])) { pcAt = j; break; }
    if (pcAt >= 0) {
      const m = PC_LINE.exec(lines[pcAt]);
      out.postcode = m[2]; out.town = U(m[3]);
      const street = [];
      const before = lines[pcAt].slice(0, m.index + m[1].length).replace(/[,\s]+$/, '');
      let j = pcAt - 1;
      while (j > Math.max(ic, nameEnd) && street.length < 4) {
        const s = lines[j];
        if (NOISE_LINE.test(s) || /%/.test(s) || CHAT_WORDS.test(s) || isRel(s)) break;
        if (!card && !street.length && !(ADDR_START.test(s) || /\d/.test(s))) break;
        street.unshift(s); j--;
      }
      if (before) street.push(before);
      if (street.length) out.street = U(street.join(', ').replace(/,\s*,/g, ','));
    }
    return out;
  }

  // Several people in one message (or several photos): splits into one block per person, then reads each.
  function parseMany(raw) {
    const chunks = String(raw || '').split(/^\s*-{3,}\s*$/m);
    const HEADER = /^\s*(?:(?:nominee|penama|beneficiary|trustee|pemegang amanah)\s*\(?\d|受益人\s*\d|\d\s*[.)]\s*$)/i;
    const NAME_LABEL = /^\s*(?:full name|name|nama penuh|nama|姓名|名字)\s*[:：\-=]/i;
    const hasIC = (s) => !!icTolerant([s]) || /\b\d{6}[\s\-]?\d{2}[\s\-]?\d{4}\b/.test(s);
    const groups = [];
    for (const chunk of chunks) {
      let g = null;
      const start = () => { g = { lines: [], ic: false, name: false }; groups.push(g); };
      start();
      const lines = chunk.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i].trim(); if (!s) { g.lines.push(''); continue; }
        const ic = hasIC(s), nl = NAME_LABEL.test(s);
        if ((HEADER.test(s) && g.lines.some((x) => x)) || (ic && g.ic) || (nl && g.name)) {
          // A bare name just above the next IC belongs to the next person.
          const carry = [];
          if (ic && !nl) {
            let k = g.lines.length - 1; while (k >= 0 && !g.lines[k]) k--;
            if (k >= 0 && nameLike(g.lines[k], 2)) carry.push(g.lines.splice(k)[0]);
          }
          start(); g.lines.push(...carry); if (carry.length) g.name = true;
        }
        g.lines.push(s); if (ic) g.ic = true; if (nl) g.name = true;
      }
    }
    return groups.map((x) => parsePasted(x.lines.join('\n'))).filter((p) => p.values.name || p.values.idNo);
  }

  // ---------- Excel / CSV upload ----------
  // One row per person. Rows with the same Customer Ref (or Policy No.) make up one customer.
  const TEMPLATE_HEADERS = ['Customer Ref', 'Policy No', 'Proposal No', 'Role', 'Full Name', 'IC / Passport No',
    'Passport Expiry', 'Date of Birth', 'Gender', 'Nationality', 'Relationship', 'Share %', 'Address', 'Postcode',
    'Town', 'Country', 'Tel No', 'Tel Type', 'Country of Birth', 'Muslim', 'Marital Status', 'Has Children', 'No. of Children'];
  const HEADER_ALIASES = {
    ref: ['customerref', 'ref', 'customer', 'customerid', 'caseid', 'clientref', 'client'],
    policyNo: ['policyno', 'policynumber', 'nopolisi', 'policy'],
    proposalNo: ['proposalno', 'proposalnumber', 'nocadangan', 'proposal'],
    role: ['role', 'type', 'peranan', 'persontype'],
    name: ['fullname', 'name', 'nama', 'namapenuh', 'fullnameaspernricpassport', 'fullnameaspernric'],
    idNo: ['icpassportno', 'ic', 'icno', 'nric', 'nricno', 'nricpassportno', 'nricpassport', 'icpassport', 'passportno', 'mykad', 'nokp', 'idno'],
    passportExpiry: ['passportexpiry', 'passportexpirydate', 'tarikhlupuspasport'],
    dob: ['dateofbirth', 'dob', 'birthdate', 'tarikhlahir'],
    gender: ['gender', 'sex', 'jantina'],
    nationality: ['nationality', 'warganegara', 'kewarganegaraan'],
    relationship: ['relationship', 'relationshiptoproposer', 'hubungan'],
    share: ['share', 'shares', 'sharepercent', 'percent', 'ofshare', 'percentage'],
    street: ['address', 'mailingaddress', 'alamat', 'street', 'streetaddress'],
    postcode: ['postcode', 'poskod', 'postalcode', 'zip', 'zipcode'],
    town: ['town', 'city', 'bandar'],
    country: ['country', 'negara'],
    telNo: ['telno', 'tel', 'phone', 'phoneno', 'mobile', 'mobileno', 'handphone', 'hp', 'contactno'],
    telType: ['teltype', 'phonetype'],
    cob: ['countryofbirth', 'cob', 'negaralahir'],
    muslim: ['muslim', 'islam', 'ismuslim'],
    status: ['maritalstatus', 'status', 'statusperkahwinan', 'taraf'],
    children: ['haschildren', 'children', 'anak', 'adaanak'],
    childrenCount: ['noofchildren', 'numberofchildren', 'childrencount', 'bilangananak']
  };
  const headerKey = (h) => {
    const k = String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [field, list] of Object.entries(HEADER_ALIASES)) if (list.includes(k)) return field;
    return null;
  };
  const cellText = (v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();

  // Dates: Excel serial numbers, dd/mm/yyyy (Malaysian order), yyyy-mm-dd or "22 Mar 1987".
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function toISODate(v, today) {
    if (v == null || v === '') return { value: '' };
    const mk = (y, m, d) => {
      if (y < 100) y += y > (today || new Date()).getFullYear() % 100 ? 1900 : 2000;
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? { value: `${y}-${pad2(m)}-${pad2(d)}` } : { bad: true };
    };
    if (v instanceof Date) return { value: `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}` };
    if (typeof v === 'number') {
      if (v > 0 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return { value: d.toISOString().slice(0, 10) }; }
      return { bad: true };
    }
    const s = String(v).trim();
    let m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(s); if (m) return mk(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/.exec(s); if (m) return mk(+m[3], +m[2], +m[1]);
    m = /^(\d{1,2})[\s\-]+([A-Za-z]{3})[A-Za-z]*[\s\-,]+(\d{2}|\d{4})$/.exec(s);
    if (m && MONTHS.includes(m[2].toLowerCase())) return mk(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
    return { bad: true };
  }
  const pick = (v, table) => { const s = String(v || '').trim().toLowerCase(); if (!s) return ''; for (const [k, words] of table) if (words.includes(s)) return k; return null; };
  const GENDER_T = [['male', ['male', 'm', 'lelaki', 'l', '男']], ['female', ['female', 'f', 'perempuan', 'p', 'wanita', '女']]];
  const YN_T = [['yes', ['yes', 'y', 'ya', 'true', '1', '是']], ['no', ['no', 'n', 'tidak', 'tak', 'false', '0', '否']]];
  const STATUS_T = [['married', ['married', 'berkahwin', 'kahwin', '已婚']], ['single', ['single', 'bujang', '未婚', '单身']],
    ['divorced', ['divorced', 'bercerai', 'cerai', '离婚']], ['widowed', ['widowed', 'widow', 'widower', 'balu', 'duda', 'janda', '丧偶']]];
  const ROLE_T = [['proposer', ['proposer', 'policyowner', 'policy owner', 'owner', 'pencadang', 'pemegang polisi', 'insured']],
    ['nominee', ['nominee', 'penama', 'beneficiary']], ['trustee', ['trustee', 'pemegang amanah']],
    ['consent', ['consent', 'existing nominee', 'existing trustee', 'consent person']]];
  const TELTYPE_T = [['mobile', ['mobile', 'handphone', 'hp', 'cell']], ['house', ['house', 'home', 'rumah']], ['office', ['office', 'pejabat', 'work']]];
  const natOf = (v) => {
    const s = U(v); if (!s) return { nationality: '' };
    if (['MALAYSIAN', 'MALAYSIA', 'MY', 'MAS', 'WARGANEGARA'].includes(s)) return { nationality: 'malaysian' };
    return { nationality: 'other', nationalityOther: s };
  };
  function relOf(v) {
    const s = String(v || '').trim(); if (!s) return { relationship: '' };
    const lower = s.toLowerCase();
    if (RELATIONSHIPS.includes(lower)) return { relationship: lower };
    for (const [k, re] of REL_WORDS) if (re.test(s)) return { relationship: k };
    return { relationship: 'others', relationshipOther: U(s) };
  }
  // Excel turns IC numbers, postcodes and phone numbers into plain numbers and drops leading zeros.
  const idFromCell = (v) => (typeof v === 'number' ? String(Math.round(v)).padStart(12, '0') : normId(v));
  const postcodeFromCell = (v) => (typeof v === 'number' ? String(Math.round(v)).padStart(5, '0') : U(v));
  function telFromCell(v) {
    let t = typeof v === 'number' ? String(Math.round(v)) : String(v || '').replace(/[^\d+]/g, '');
    t = t.replace(/^\+/, '');
    if (!t) return '';
    if (t.startsWith('0')) t = '6' + t;             // 012-3456789 -> 60123456789
    else if (/^1\d{8,9}$/.test(t)) t = '60' + t;     // Excel dropped the 0 of 012...
    return t;
  }

  // rows: array of arrays (first non-empty row = headers). Returns customers plus a list of problems by row.
  function importRows(rows, today) {
    const problems = [];
    const note = (row, text) => problems.push({ row, text });
    const hi = rows.findIndex((r) => r && r.some((c) => cellText(c)));
    if (hi < 0) return { cases: [], problems: [{ row: 0, text: 'The file is empty.' }], ignored: [] };
    const header = rows[hi].map(headerKey);
    const ignored = rows[hi].filter((h, i) => cellText(h) && !header[i]).map(cellText);
    if (!header.includes('name') || !header.includes('role')) {
      return { cases: [], problems: [{ row: hi + 1, text: 'Could not find the "Role" and "Full Name" columns. Please use the template.' }], ignored };
    }
    const groups = new Map();
    for (let r = hi + 1; r < rows.length; r++) {
      const raw = rows[r] || [];
      if (!raw.some((c) => cellText(c))) continue;
      const row = r + 1; // Excel row number
      const get = (f) => { const i = header.indexOf(f); return i < 0 ? undefined : raw[i]; };
      const t = (f) => cellText(get(f));
      if (/^example/i.test(t('ref'))) continue; // template example rows
      const key = U(t('ref')) || normId(t('policyNo')) || normId(t('proposalNo'));
      if (!key) { note(row, 'Skipped: no Customer Ref or Policy No., so the app cannot tell which customer this person belongs to.'); continue; }
      const role = pick(t('role'), ROLE_T);
      if (!role) { note(row, `Skipped: Role "${t('role')}" not recognised. Use Proposer, Nominee, Trustee or Consent.`); continue; }
      if (!groups.has(key)) groups.set(key, { key, rows: [] });
      groups.get(key).rows.push({ row, role, get, t });
    }

    const cases = [];
    for (const g of groups.values()) {
      const c = newCase(); c.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      c.nominees = []; c.trustees = []; c.importedFrom = g.key;
      let proposerRows = 0;
      for (const { row, role, get, t } of g.rows) {
        ['policyNo', 'proposalNo'].forEach((k) => {
          const v = normId(t(k)); if (!v) return;
          if (c.policy[k] && c.policy[k] !== v) note(row, `${g.key}: different ${k === 'policyNo' ? 'Policy' : 'Proposal'} No. on this row (${v}); kept ${c.policy[k]}.`);
          else c.policy[k] = v;
        });
        const date = (f, label) => { const d = toISODate(get(f), today); if (d.bad) note(row, `${g.key}: ${label} "${t(f)}" not understood; left blank. Use dd/mm/yyyy.`); return d.value || ''; };
        const gender = pick(t('gender'), GENDER_T);
        if (gender === null) note(row, `${g.key}: gender "${t('gender')}" not understood; left blank.`);
        const person = {
          name: U(t('name')), idNo: idFromCell(get('idNo')), passportExpiry: date('passportExpiry', 'passport expiry'),
          dob: date('dob', 'date of birth'), gender: gender || '', street: U(t('street')), postcode: postcodeFromCell(get('postcode')),
          town: U(t('town')), country: U(t('country')) || 'MALAYSIA'
        };
        Object.assign(person, natOf(t('nationality')));
        const ic = icInfo(person.idNo, today);
        if (!person.nationality && ic && ic.valid) person.nationality = 'malaysian';
        if (role === 'proposer') {
          proposerRows++;
          if (proposerRows > 1) { note(row, `${g.key}: more than one Proposer row; only the first is used.`); continue; }
          const yn = (f, label) => { const v = pick(t(f), YN_T); if (v === null) note(row, `${g.key}: ${label} "${t(f)}" not understood; left blank.`); return v || ''; };
          const st = pick(t('status'), STATUS_T);
          if (st === null) note(row, `${g.key}: marital status "${t('status')}" not understood; left blank.`);
          c.proposer = { name: person.name, nric: person.idNo, muslim: yn('muslim', 'Muslim'), status: st || '',
            children: yn('children', 'Has Children'), childrenCount: t('childrenCount') };
          if (!c.proposer.children && /^\d+$/.test(c.proposer.childrenCount)) c.proposer.children = +c.proposer.childrenCount > 0 ? 'yes' : 'no';
        } else if (role === 'nominee') {
          if (c.nominees.length >= 4) { note(row, `${g.key}: more than 4 nominees; extra row skipped.`); continue; }
          const sh = get('share');
          c.nominees.push(Object.assign(newNominee(), person, relOf(t('relationship')),
            { share: sh == null || sh === '' ? '' : String(typeof sh === 'number' ? sh : parseFloat(String(sh).replace('%', '')) || '') }));
        } else if (role === 'trustee') {
          if (c.trustees.length >= 2) { note(row, `${g.key}: more than 2 trustees; extra row skipped.`); continue; }
          const cob = natOf(t('cob'));
          const tt = pick(t('telType'), TELTYPE_T);
          c.trustees.push(Object.assign(newTrustee(), person, {
            cob: cob.nationality || (person.nationality === 'malaysian' ? 'malaysian' : ''), cobOther: cob.nationalityOther || '',
            telNo: telFromCell(get('telNo')), telCountry: 'MALAYSIA', telType: tt || (telFromCell(get('telNo')).startsWith('601') ? 'mobile' : '')
          }));
        } else if (role === 'consent') {
          c.consent.needed = true;
          if (c.consent.persons.length >= 4) { note(row, `${g.key}: more than 4 consent persons; extra row skipped.`); continue; }
          c.consent.persons.push({ name: person.name, idNo: person.idNo });
        }
      }
      // Shares typed as Excel percentages arrive as 0.5 instead of 50.
      const shares = c.nominees.map((n) => parseFloat(n.share)).filter((x) => !isNaN(x));
      if (shares.length && shares.every((x) => x <= 1) && Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 0.001) {
        c.nominees.forEach((n) => { if (n.share !== '') n.share = String(+(parseFloat(n.share) * 100).toFixed(2)); });
      }
      if (!c.nominees.length) c.nominees.push(newNominee());
      if (c.trustees.length) c.trusteeOption = 'appoint';
      if (!proposerRows) note(g.rows[0].row, `${g.key}: no Proposer row; proposer details left blank.`);
      cases.push(c);
    }
    return { cases, problems, ignored };
  }

  // Rows for the downloadable Excel template (the example rows start with "EXAMPLE" and are skipped on upload).
  function templateRows() {
    return [TEMPLATE_HEADERS,
      ['EXAMPLE-1', '0123456789', '', 'Proposer', 'Tan Wei Ming', '850615-10-5523', '', '', '', '', '', '', '', '', '', '', '', '', '', 'No', 'Married', 'Yes', 2],
      ['EXAMPLE-1', '0123456789', '', 'Nominee', 'Lim Siew Ling', '870322-14-5678', '', '', 'Female', 'Malaysian', 'Wife', 50, 'No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah', '81200', 'Johor Bahru', 'Malaysia'],
      ['EXAMPLE-1', '0123456789', '', 'Nominee', 'Tan Jun Hao', '120910-01-1233', '', '', 'Male', 'Malaysian', 'Son', 50, 'No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah', '81200', 'Johor Bahru', 'Malaysia'],
      ['EXAMPLE-1', '0123456789', '', 'Trustee', 'Lim Siew Ling', '870322-14-5678', '', '', 'Female', 'Malaysian', '', '', 'No. 12, Jalan Bukit Indah 3/5, Taman Bukit Indah', '81200', 'Johor Bahru', 'Malaysia', '012-345 6789', 'Handphone', 'Malaysia']];
  }
  const TEMPLATE_GUIDE = [
    ['Column', 'What to enter', 'Allowed values / tips'],
    ['Customer Ref', 'Any short name or code that groups rows of one customer (optional if Policy No is filled)', 'Rows starting with EXAMPLE are ignored. Delete them or leave them.'],
    ['Policy No / Proposal No', 'At least one per customer', 'Up to 10 characters'],
    ['Role', 'Who this row is', 'Proposer, Nominee, Trustee, Consent (existing nominee/trustee giving consent)'],
    ['Full Name', 'As per NRIC / passport', ''],
    ['IC / Passport No', 'Type ICs WITH dashes (870322-14-5678) so Excel keeps them as text', 'Date of birth and gender are taken from the IC if left blank'],
    ['Passport Expiry', 'Only when a passport no. is used', 'dd/mm/yyyy'],
    ['Date of Birth', 'Only needed for passport holders', 'dd/mm/yyyy'],
    ['Gender', 'Optional for IC holders', 'Male / Female (or Lelaki / Perempuan)'],
    ['Nationality', 'Optional for IC holders', 'Malaysian, or the country name'],
    ['Relationship', 'Nominees only', 'Husband, Wife, Son, Daughter, Father, Mother, Brother, Sister, or anything else (printed under Others)'],
    ['Share %', 'Nominees only; must total 100 per customer', 'e.g. 50'],
    ['Address', 'Street part only', 'Postcode and town go in their own columns'],
    ['Postcode / Town / Country', '', 'Country defaults to Malaysia'],
    ['Tel No / Tel Type / Country of Birth', 'Trustees only', 'Tel type: Handphone, House or Office'],
    ['Muslim / Marital Status / Has Children / No. of Children', 'Proposer row only', 'Yes/No; Married, Single, Divorced, Widowed']
  ];

  return { FORM_CODE, RELATIONSHIPS, STATUSES, TRUSTEE_OPTIONS, TEL_TYPES, KEY_FIELDS,
    newCase, newNominee, newTrustee, icInfo, ageOn, ddmmyy, splitLines, fitAddress, normId, U,
    validate, fillForm, checkTemplate, parsePasted, parseMany, importRows, templateRows, TEMPLATE_GUIDE, TEMPLATE_HEADERS };
});
