// Fetches a single named tab from the Google Sheet as CSV (works for any
// publicly-viewable sheet, no API key/auth needed) and returns it as a
// clean 2D JSON array. GET /api/sheet?name=Statement

module.exports = async (req, res) => {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      res.status(500).json({ error: 'GOOGLE_SHEET_ID environment variable is not set.' });
      return;
    }
    const name = req.query.name;
    if (!name) {
      res.status(400).json({ error: 'Missing ?name= query parameter.' });
      return;
    }

    const url = 'https://docs.google.com/spreadsheets/d/' + sheetId +
      '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name);
    const r = await fetch(url);
    if (!r.ok) {
      res.status(502).json({ error: 'Could not fetch sheet "' + name + '" (HTTP ' + r.status + '). Is the sheet shared as "Anyone with the link can view"?' });
      return;
    }
    const csvText = await r.text();
    const rows = parseCsv(csvText);
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json({ name: name, rows: rows });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};

// Minimal RFC4180 CSV parser (handles quoted fields, embedded commas/
// quotes/newlines) — Google's gviz CSV export follows this format.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell !== ''));
}
