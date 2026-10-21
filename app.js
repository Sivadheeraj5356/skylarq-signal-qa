(function (root) {
  function parseCsv(text) {
    const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(',').map((cell) => cell.trim());
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    });
  }

  function parseRows(text) {
    const input = String(text || '').trim();
    if (!input) return [];
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === 'object') : [];
    } catch (_) {
      return parseCsv(input);
    }
  }

  function isDomain(value) {
    return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(String(value || '').trim());
  }

  function audit(rows) {
    const issues = [];
    const seenCompanies = new Map();
    const seenPeople = new Map();
    let stale = 0;
    rows.forEach((row, index) => {
      const line = index + 1;
      const company = String(row.company || row.account || '').trim().toLowerCase();
      const person = String(row.person || row.name || '').trim().toLowerCase();
      const domain = String(row.domain || row.website || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const title = String(row.title || row.role || '').trim();
      const updated = Date.parse(row.updated_at || row.enriched_at || row.last_seen || '');
      if (!company && !person) issues.push({ severity: 'high', issue: `Row ${line} has neither a company nor a person`, action: 'Remove the record or route it back to discovery.' });
      if (domain && !isDomain(domain)) issues.push({ severity: 'medium', issue: `Row ${line} domain "${domain}" is not a valid domain`, action: 'Normalize the website before enrichment.' });
      if (person && !title) issues.push({ severity: 'medium', issue: `Row ${line} person is missing a title`, action: 'Enrich role and seniority before agent outreach.' });
      if (company) {
        if (seenCompanies.has(company)) issues.push({ severity: 'high', issue: `Company "${company}" appears on rows ${seenCompanies.get(company)} and ${line}`, action: 'Merge duplicates before syncing to the agent platform.' });
        seenCompanies.set(company, line);
      }
      if (person) {
        if (seenPeople.has(person)) issues.push({ severity: 'medium', issue: `Person "${person}" appears on rows ${seenPeople.get(person)} and ${line}`, action: 'Check whether these are distinct people or duplicate identities.' });
        seenPeople.set(person, line);
      }
      if (!Number.isNaN(updated)) {
        const ageDays = (Date.now() - updated) / 86400000;
        if (ageDays > 180) {
          stale += 1;
          issues.push({ severity: 'medium', issue: `Row ${line} enrichment is ${Math.round(ageDays)} days old`, action: 'Refresh the record before a production workflow uses it.' });
        }
      }
    });
    const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.severity === 'high' ? 18 : 8), 0));
    return { rowCount: rows.length, stale, score, issues };
  }

  function render(result) {
    const output = document.querySelector('#results');
    if (!output) return;
    if (!result.rowCount) {
      output.innerHTML = '<p class="empty-state">Paste enriched company or people records to audit them.</p>';
      return;
    }
    const issueItems = result.issues.length ? result.issues.map((issue) => `<li><strong>${issue.severity.toUpperCase()}:</strong> ${issue.issue}<br><span>${issue.action}</span></li>`).join('') : '<li>No blocking data-quality issues found.</li>';
    output.innerHTML = `<article><div class="score-row"><h4>Signal QA score</h4><span class="score">${result.score}/100</span></div><p>${result.rowCount} records inspected. ${result.stale} stale records found.</p><ul>${issueItems}</ul></article>`;
  }

  function boot() {
    const input = document.querySelector('#recordInput');
    const button = document.querySelector('#auditButton');
    if (!input || !button) return;
    button.addEventListener('click', () => render(audit(parseRows(input.value))));
  }

  const api = { audit, parseRows, parseCsv, isDomain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) root.SkylarqSignalQA = api;
  if (root.document) root.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
