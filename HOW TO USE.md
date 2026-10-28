# Nomination Form Filler — How to use

Fills the Great Eastern **Appointment / Change of Nominee(s) / Trustee(s)** form (NBZ-FNOMI-V07-082025) from details you enter or paste once.

## Start
Double-click **`Nomination Form Filler.html`**. It opens in Chrome or Edge, needs no internet or install, and uploads nothing.

## First time only
**Settings** → enter your agent name and IAC no. → **Save settings**. You will then be the witness on every new form.

## Each customer (about 5 minutes)
1. **New customer**.
2. **Tab 1, Policy & proposer:** policy no. (or proposal no.), name, IC, Muslim / status / children.
3. **Tab 2, Nominees:** use **Fill all nominees at once** at the top:
   - **WhatsApp message:** paste the whole message, with all the nominees in it, and click **Fill all nominees**.
   - **Photos:** click **📷 Read IC photos / screenshots** and choose the front of each IC, or WhatsApp screenshots. You can pick several photos at once, one per person.
   - Each nominee also has their own paste box and **📷 Read from photo** button, for adding or fixing one person.
   - Photos are read on this PC and nothing is uploaded. The first photo takes a few seconds.
   - **Photo reading can misread letters and digits.** Compare the name, IC number and address with the IC every time.
   - For best results, take the photo upright, sharp and without glare. iPhone HEIC photos can't be opened; send them through WhatsApp first, or take a screenshot.
   - Date of birth and gender come from the IC automatically.
   - **Split equally** sets the shares; **Same address as Nominee 1** copies the address.
4. **Tab 3, Trustees:** only if needed. Choose the Part 2 option, then **Copy from Nominee** if the spouse is the trustee.
5. **Tab 4, Witness & consent:** your details are already there. Tick Part 3 only when changing nominees on an existing trust policy.
6. Clear the **Checklist** on the right:
   - **Red (must fix)** — the form would be wrong, e.g. shares not 100%, bad IC, witness is a nominee.
   - **Amber (missing / check)** — blank items or mismatches.
   - **Blue (notes)** — the form's own trust rules, e.g. Muslim → no trustee, non-Muslim + spouse/child → trust policy.
7. **Generate PDF** → open it from Downloads, check it, print it.
8. **Save** to keep the customer for next time.

## Upload many customers from Excel
1. **Saved customers → Download Excel template**.
2. Fill one row per person: the proposer, each nominee and each trustee. Rows with the same **Customer Ref** (or Policy No) belong to one customer.
   - Type ICs **with dashes** (870322-14-5678) so Excel keeps them as text.
   - Malay words work too (Pencadang, Penama, Ya, Berkahwin, isteri, anak lelaki…).
3. Click **Upload customers** (top bar) and choose the file (.xlsx, .xls or .csv).
4. The upload result lists each customer with its checklist status, plus any rows it skipped and why. Click **Open** → check → **Generate PDF**.

The app repairs common Excel problems: lost leading zeros in IC, postcode and phone numbers, and shares typed as 0.5 instead of 50. Anything it can't understand is listed for you to fix, not guessed.

If you generate with items still missing, the file is named `DRAFT - …` and those boxes stay blank. The app never guesses.

## Stays manual
- Signatures and signature dates (you can pre-fill the date in tab 4 if you are sure of it)
- Checking printed values against the NRIC
- Submitting the form to Great Eastern

## Good to know
- **Saved customers** and the **Run log** are kept in this browser on this PC. Use **Export all** for a backup. Clearing browser data deletes them.
- The run log has no IC numbers. It records date, customer, policy no., boxes filled and issues found.
- The form's limits are applied automatically: capitals, 28 characters per name line, 32 per address line, 12-digit IC with no dashes. Long addresses are shortened only if needed (JALAN → JLN, TAMAN → TMN…) and the checklist tells you when that happens.
- **New form version from GE?** Go to Settings → **Load a new form PDF**. The app checks the boxes still match before using it.

## For maintenance (optional)
`src/core.js` holds the field mapping and rules, and `src/app.html` is the screen. To rebuild after edits:
```
npm install
node build.js "<blank form>.pdf"
node test-run.js "<blank form>.pdf"
node test-parse.js
node tools/test-photo-file.js
```
The photo reader is Tesseract.js 5.1.1 (Apache-2.0) with the English language data. It is packed into the HTML file, which is why the file is about 9.5 MB.
