/* ================================================
   TestCase Generator – Application Logic
   Pure Vanilla JavaScript, no external libraries
   ================================================ */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tcgen_testcases';
const STATUSES = ['Not Run', 'Passed', 'Failed', 'Blocked'];

// ── State ──────────────────────────────────────────────────────────────────

let testCases = [];          // master list
let filteredCases = [];      // currently displayed
let pendingDeleteId = null;  // ID awaiting confirm-delete

// ── Initialization ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  document.getElementById('generatorForm').addEventListener('submit', handleGenerate);
  renderDashboard();
  renderTable();
  showView('dashboard');
});

// ── Storage ────────────────────────────────────────────────────────────────

/** Persist test cases to localStorage */
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(testCases));
}

/** Load test cases from localStorage */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    testCases = raw ? JSON.parse(raw) : [];
  } catch {
    testCases = [];
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────

/**
 * Switch the visible content view and update the nav highlight.
 * @param {'dashboard'|'generator'|'testcases'} viewId
 */
function showView(viewId) {
  const views = ['dashboard', 'generator', 'testcases'];
  const titles = { dashboard: 'Dashboard', generator: 'Generate Test Cases', testcases: 'All Test Cases' };

  views.forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== viewId);
  });

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active-nav', el.dataset.nav === viewId);
  });

  document.getElementById('pageTitle').textContent = titles[viewId];

  // Refresh content when switching
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'testcases') { applyFilters(); }

  // Close mobile sidebar
  if (window.innerWidth < 1024) closeSidebar();
}

/** Toggle mobile sidebar visibility */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Test Case ID Generator ─────────────────────────────────────────────────

/**
 * Generate a sequential TC ID string, e.g. TC-0042
 * @param {number} index - 0-based index within a batch
 * @returns {string}
 */
function generateId(index) {
  const existingNums = testCases.map(tc => parseInt(tc.id.replace('TC-', ''), 10)).filter(n => !isNaN(n));
  const nextBase = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  const num = String(nextBase + index).padStart(4, '0');
  return `TC-${num}`;
}

// ── Test Case Generation Logic ─────────────────────────────────────────────

/**
 * Core generator: produces `count` test case objects for a given feature/type.
 * Uses deterministic templates enriched with the user's input.
 *
 * @param {Object} opts
 * @param {string} opts.featureName
 * @param {string} opts.featureDesc
 * @param {string} opts.testType  – 'Functional'|'Negative'|'Boundary'|'Validation'
 * @param {string} opts.priority
 * @param {number} opts.count
 * @returns {Array<Object>}
 */
function generateTestCases({ featureName, featureDesc, testType, priority, count }) {
  const templates = getTemplates(featureName, featureDesc, testType);
  const results = [];

  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length];
    // Rotate variants so repeated templates differ slightly
    const variant = Math.floor(i / templates.length);

    results.push({
      id:             generateId(i),
      featureName,
      featureDesc,
      testType,
      priority,
      status:         'Not Run',
      scenario:       buildScenario(tpl, featureName, variant),
      title:          buildTitle(tpl, featureName, variant),
      preconditions:  buildPreconditions(featureName, testType),
      steps:          buildSteps(tpl, featureName, variant),
      testData:       buildTestData(tpl, testType, variant),
      expectedResult: buildExpected(tpl, featureName, variant),
      actualResult:   '',
      createdAt:      new Date().toISOString(),
    });
  }

  return results;
}

// ── Template Definitions ───────────────────────────────────────────────────

/**
 * Returns an array of template descriptors based on test type.
 * Each template carries semantic keys used by build* functions.
 */
function getTemplates(featureName, featureDesc, testType) {
  const fn = featureName;
  const fd = featureDesc;

  const types = {
    Functional: [
      { key: 'happy',      action: 'with valid inputs',             outcome: 'works correctly' },
      { key: 'submit',     action: 'by submitting the form',        outcome: 'processes successfully' },
      { key: 'display',    action: 'correct data is displayed',     outcome: 'data is accurate' },
      { key: 'navigate',   action: 'user navigates to the feature', outcome: 'feature loads properly' },
      { key: 'update',     action: 'user updates existing data',    outcome: 'changes are saved' },
      { key: 'delete',     action: 'user removes a record',         outcome: 'record is deleted' },
      { key: 'search',     action: 'user searches for data',        outcome: 'results are returned' },
      { key: 'session',    action: 'session is maintained',         outcome: 'session persists correctly' },
    ],
    Negative: [
      { key: 'empty',      action: 'with empty/blank inputs',       outcome: 'shows validation error' },
      { key: 'invalid',    action: 'with invalid format data',      outcome: 'rejects invalid input' },
      { key: 'overflow',   action: 'with data exceeding limits',    outcome: 'handles overflow gracefully' },
      { key: 'special',    action: 'with special characters',       outcome: 'sanitizes input correctly' },
      { key: 'sql',        action: 'with SQL injection attempt',    outcome: 'blocks malicious input' },
      { key: 'xss',        action: 'with script tag injection',     outcome: 'renders safely' },
      { key: 'missing',    action: 'with missing required fields',  outcome: 'prompts for required fields' },
      { key: 'duplicate',  action: 'with duplicate entry',          outcome: 'prevents duplicate creation' },
    ],
    Boundary: [
      { key: 'min',        action: 'at minimum allowed value',      outcome: 'accepts minimum value' },
      { key: 'max',        action: 'at maximum allowed value',      outcome: 'accepts maximum value' },
      { key: 'below-min',  action: 'below minimum allowed value',   outcome: 'rejects below-minimum value' },
      { key: 'above-max',  action: 'above maximum allowed value',   outcome: 'rejects above-maximum value' },
      { key: 'zero',       action: 'with zero as input',            outcome: 'handles zero input' },
      { key: 'negative',   action: 'with negative number input',    outcome: 'handles negative input' },
      { key: 'max-length', action: 'at maximum character length',   outcome: 'accepts max-length input' },
      { key: 'max+1',      action: 'one character over max length', outcome: 'truncates or rejects overlength input' },
    ],
    Validation: [
      { key: 'format',     action: 'with incorrect data format',    outcome: 'displays format error' },
      { key: 'type',       action: 'with wrong data type',          outcome: 'rejects wrong type' },
      { key: 'range',      action: 'with out-of-range value',       outcome: 'shows range error message' },
      { key: 'required',   action: 'leaving required field blank',  outcome: 'highlights required field' },
      { key: 'pattern',    action: 'with pattern mismatch',         outcome: 'shows pattern hint' },
      { key: 'length',     action: 'with too short input',          outcome: 'shows minimum length warning' },
      { key: 'whitespace', action: 'with leading/trailing spaces',  outcome: 'trims or flags whitespace' },
      { key: 'numeric',    action: 'with letters in numeric field', outcome: 'rejects non-numeric input' },
    ],
  };

  return types[testType] || types.Functional;
}

// ── Content Builders ───────────────────────────────────────────────────────

function buildScenario(tpl, featureName, variant) {
  const scenarios = [
    `Verify that ${featureName} behaves as expected ${tpl.action}`,
    `Ensure ${featureName} ${tpl.outcome} when tested ${tpl.action}`,
    `Test ${featureName} for scenario: ${tpl.action}`,
    `Validate the behaviour of ${featureName} ${tpl.action}`,
  ];
  return scenarios[variant % scenarios.length];
}

function buildTitle(tpl, featureName, variant) {
  const suffixes = ['', ' – Scenario ' + (variant + 1), ' (Case ' + (variant + 1) + ')'];
  const base = `${featureName} – ${capitalise(tpl.action)}`;
  return base + (variant > 0 ? suffixes[variant % suffixes.length] : '');
}

function buildPreconditions(featureName, testType) {
  const base = [
    `Application is running and accessible.`,
    `User has a valid account (if authentication required).`,
    `${featureName} module is reachable from the main navigation.`,
  ];
  if (testType === 'Negative' || testType === 'Boundary') {
    base.push('Test environment is isolated from production data.');
  }
  return base.join('\n');
}

function buildSteps(tpl, featureName, variant) {
  const stepSets = {
    happy: [
      '1. Open the application and navigate to the ' + featureName + ' page.',
      '2. Enter all required fields with valid data.',
      '3. Click the primary action button (Submit / Save / Proceed).',
      '4. Observe the system response.',
    ],
    submit: [
      '1. Open the ' + featureName + ' form.',
      '2. Fill in all mandatory fields correctly.',
      '3. Review the entered data.',
      '4. Click the Submit button.',
      '5. Observe the confirmation message.',
    ],
    display: [
      '1. Log in and navigate to ' + featureName + '.',
      '2. Observe the data displayed on the page.',
      '3. Compare displayed values with expected source data.',
    ],
    navigate: [
      '1. Open the application home page.',
      '2. Click the navigation link/button for ' + featureName + '.',
      '3. Wait for the page to fully load.',
      '4. Confirm the correct page is displayed.',
    ],
    update: [
      '1. Navigate to ' + featureName + ' and select an existing record.',
      '2. Click Edit / Update.',
      '3. Modify the relevant fields.',
      '4. Save the changes.',
      '5. Verify the updated data is reflected.',
    ],
    delete: [
      '1. Navigate to ' + featureName + ' and select an existing record.',
      '2. Click Delete / Remove.',
      '3. Confirm the deletion in the dialog.',
      '4. Verify the record no longer appears.',
    ],
    search: [
      '1. Navigate to ' + featureName + '.',
      '2. Enter a keyword in the search input.',
      '3. Click Search or press Enter.',
      '4. Review the returned results.',
    ],
    session: [
      '1. Log in and navigate to ' + featureName + '.',
      '2. Perform an action, then refresh the browser.',
      '3. Verify the session/data is still intact.',
    ],
    empty: [
      '1. Open the ' + featureName + ' form.',
      '2. Leave all required fields blank.',
      '3. Click Submit.',
      '4. Observe the validation error messages.',
    ],
    invalid: [
      '1. Open the ' + featureName + ' form.',
      '2. Enter data with an invalid format (e.g., letters in a numeric field).',
      '3. Click Submit.',
      '4. Check for appropriate error messages.',
    ],
    overflow: [
      '1. Open the ' + featureName + ' input.',
      '2. Enter a string/number far exceeding the allowed limit.',
      '3. Attempt to submit.',
      '4. Observe system behavior.',
    ],
    special: [
      '1. Open the ' + featureName + ' form.',
      '2. Enter special characters (e.g., <, >, /, \\, @) into text fields.',
      '3. Submit the form.',
      '4. Verify the output is safe and sanitized.',
    ],
    sql: [
      "1. Navigate to " + featureName + ".",
      "2. In an input field, type: ' OR '1'='1 or similar SQL injection string.",
      '3. Submit the form.',
      '4. Verify no unauthorized data access occurs.',
    ],
    xss: [
      '1. Navigate to ' + featureName + '.',
      '2. Enter <script>alert("xss")</script> in a text input.',
      '3. Submit and observe the rendered output.',
      '4. Confirm script does not execute.',
    ],
    missing: [
      '1. Open the ' + featureName + ' form.',
      '2. Fill optional fields but leave one required field empty.',
      '3. Click Submit.',
      '4. Confirm the required field is highlighted.',
    ],
    duplicate: [
      '1. Create a record in ' + featureName + ' with unique data.',
      '2. Attempt to create another record with the identical data.',
      '3. Click Submit.',
      "4. Observe the system's response.",
    ],
    min: [
      '1. Open the ' + featureName + ' input.',
      '2. Enter the exact minimum allowed value.',
      '3. Submit the form.',
      '4. Verify the system accepts the value.',
    ],
    max: [
      '1. Open the ' + featureName + ' input.',
      '2. Enter the exact maximum allowed value.',
      '3. Submit the form.',
      '4. Verify the system accepts the value.',
    ],
    'below-min': [
      '1. Open the ' + featureName + ' input.',
      '2. Enter a value one unit below the minimum.',
      '3. Submit the form.',
      '4. Verify an error or rejection occurs.',
    ],
    'above-max': [
      '1. Open the ' + featureName + ' input.',
      '2. Enter a value one unit above the maximum.',
      '3. Submit the form.',
      '4. Verify an error or rejection occurs.',
    ],
    zero: [
      '1. Open the ' + featureName + ' numeric input.',
      '2. Enter 0.',
      '3. Submit the form.',
      '4. Observe how the system handles zero.',
    ],
    negative: [
      '1. Open the ' + featureName + ' numeric input.',
      '2. Enter a negative number (e.g., -1).',
      '3. Submit the form.',
      '4. Verify the system responds correctly.',
    ],
    'max-length': [
      '1. Open the ' + featureName + ' text input.',
      '2. Type exactly the maximum number of characters allowed.',
      '3. Submit the form.',
      '4. Confirm the value is accepted.',
    ],
    'max+1': [
      '1. Open the ' + featureName + ' text input.',
      '2. Type one character more than the maximum allowed.',
      '3. Attempt to submit.',
      '4. Verify input is capped or rejected.',
    ],
    format: [
      '1. Open the ' + featureName + ' form.',
      '2. Enter data in an incorrect format (e.g., date as text).',
      '3. Attempt to submit.',
      '4. Confirm a format error is displayed.',
    ],
    type: [
      '1. Open the ' + featureName + ' form.',
      '2. Enter a value of the wrong type (e.g., text where a number is expected).',
      '3. Submit.',
      '4. Verify the field is flagged with a type error.',
    ],
    range: [
      '1. Open the ' + featureName + ' numeric field.',
      '2. Enter a value outside the accepted range.',
      '3. Submit.',
      '4. Confirm a range validation message is shown.',
    ],
    required: [
      '1. Open the ' + featureName + ' form.',
      '2. Skip all required fields.',
      '3. Click Submit.',
      '4. Confirm required fields are highlighted in red.',
    ],
    pattern: [
      '1. Open the ' + featureName + ' form.',
      '2. Enter a value that does not match the expected pattern (e.g., phone without country code).',
      '3. Submit.',
      '4. Confirm a pattern hint is displayed.',
    ],
    length: [
      '1. Open the ' + featureName + ' text field.',
      '2. Enter fewer characters than the minimum required.',
      '3. Submit.',
      '4. Verify a minimum length warning appears.',
    ],
    whitespace: [
      '1. Open the ' + featureName + ' form.',
      '2. Enter "   valid input   " (with leading/trailing spaces) in a text field.',
      '3. Submit.',
      '4. Verify spaces are trimmed or flagged.',
    ],
    numeric: [
      '1. Open the ' + featureName + ' numeric input.',
      '2. Type alphabetical characters (e.g., "abc").',
      '3. Submit.',
      '4. Confirm a non-numeric rejection message is shown.',
    ],
  };

  const steps = stepSets[tpl.key] || stepSets.happy;
  return steps.join('\n');
}

function buildTestData(tpl, testType, variant) {
  const sets = {
    Functional: ['Valid username: "testuser@example.com", Password: "SecureP@ss1"',
                 'Name: "John Doe", Email: "john.doe@mail.com", Phone: "+1-555-0100"',
                 'ID: 1001, Status: Active, Role: User'],
    Negative:   ['Empty string: ""', 'Invalid email: "not-an-email"', "SQL injection: ' OR 1=1 --",
                 '<script>alert("xss")</script>', 'Value: 9999999999999 (overflow)'],
    Boundary:   ['Min value: 0', 'Max value: 255', 'Below min: -1', 'Above max: 256',
                 'Exact limit string: "AAAA…" (max chars)', 'Overlength: "AAAA…" (max+1 chars)'],
    Validation: ['Invalid format: "2024/31/13" (wrong date)', 'Text in numeric: "abc"',
                 'Out of range: 9999', 'Missing required: { name: "", email: "x@x.com" }'],
  };
  const pool = sets[testType] || sets.Functional;
  return pool[variant % pool.length];
}

function buildExpected(tpl, featureName, variant) {
  const expectations = [
    `The system accepts the input and ${tpl.outcome}.`,
    `${featureName} ${tpl.outcome} without any errors.`,
    `A success message is displayed confirming the operation completed.`,
    `The UI reflects the updated state immediately after the action.`,
  ];
  return expectations[variant % expectations.length];
}

// ── Utility ────────────────────────────────────────────────────────────────

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function sanitise(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escapeCSV(val) {
  if (val == null) return '';
  const s = String(val).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString();
}

// ── Form Handling ──────────────────────────────────────────────────────────

/** Validate all generator form fields; returns true if valid */
function validateForm() {
  let valid = true;

  const fields = [
    { id: 'featureName', errId: 'err-featureName', test: v => v.trim().length > 0 },
    { id: 'featureDesc', errId: 'err-featureDesc', test: v => v.trim().length > 0 },
    { id: 'testType',    errId: 'err-testType',    test: v => v !== '' },
    { id: 'priority',    errId: 'err-priority',    test: v => v !== '' },
    { id: 'tcCount',     errId: 'err-tcCount',     test: v => { const n = parseInt(v,10); return !isNaN(n) && n >= 1 && n <= 20; } },
  ];

  fields.forEach(({ id, errId, test }) => {
    const el = document.getElementById(id);
    const errEl = document.getElementById(errId);
    const ok = test(el.value);
    el.classList.toggle('error', !ok);
    errEl.classList.toggle('hidden', ok);
    if (!ok) valid = false;
  });

  return valid;
}

/** Handle generator form submission */
function handleGenerate(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const featureName = document.getElementById('featureName').value.trim();
  const featureDesc = document.getElementById('featureDesc').value.trim();
  const testType    = document.getElementById('testType').value;
  const priority    = document.getElementById('priority').value;
  const count       = Math.min(20, Math.max(1, parseInt(document.getElementById('tcCount').value, 10)));

  const generated = generateTestCases({ featureName, featureDesc, testType, priority, count });
  testCases.push(...generated);
  saveToStorage();

  showToast(`✓ Generated ${count} test case${count > 1 ? 's' : ''} for "${featureName}"`, 'success');
  resetForm();
  showView('testcases');
}

/** Reset the generator form */
function resetForm() {
  document.getElementById('generatorForm').reset();
  ['featureName','featureDesc','testType','priority','tcCount'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
  ['err-featureName','err-featureDesc','err-testType','err-priority','err-tcCount'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

/** Refresh all dashboard stats and recent table */
function renderDashboard() {
  const total   = testCases.length;
  const passed  = testCases.filter(tc => tc.status === 'Passed').length;
  const failed  = testCases.filter(tc => tc.status === 'Failed').length;
  const notrun  = testCases.filter(tc => tc.status === 'Not Run').length;

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-passed').textContent = passed;
  document.getElementById('stat-failed').textContent = failed;
  document.getElementById('stat-notrun').textContent = notrun;

  const pct = n => total > 0 ? Math.round((n / total) * 100) : 0;
  document.getElementById('bar-passed').style.width  = pct(passed) + '%';
  document.getElementById('bar-failed').style.width  = pct(failed) + '%';
  document.getElementById('bar-notrun').style.width  = pct(notrun) + '%';

  document.getElementById('headerTotalBadge').textContent =
    `${total} Test Case${total !== 1 ? 's' : ''}`;

  // Recent 5 test cases
  const container = document.getElementById('recentTable');
  const recent = [...testCases].reverse().slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-12">No test cases yet. <button onclick="showView('generator')" class="text-primary-light hover:underline">Generate your first one →</button></p>`;
    return;
  }

  container.innerHTML = `
    <table class="w-full text-sm">
      <thead class="bg-slate-50 border-b border-border">
        <tr>
          <th class="th-cell w-28">TC ID</th>
          <th class="th-cell">Title</th>
          <th class="th-cell w-28">Type</th>
          <th class="th-cell w-24">Priority</th>
          <th class="th-cell w-28">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        ${recent.map(tc => `
          <tr class="tr-row cursor-pointer" onclick="openDetailModal('${tc.id}')">
            <td class="td-cell font-mono font-semibold text-primary-light text-xs">${sanitise(tc.id)}</td>
            <td class="td-cell max-w-xs"><span class="truncate-2">${sanitise(tc.title)}</span></td>
            <td class="td-cell text-slate-500 text-xs">${sanitise(tc.testType)}</td>
            <td class="td-cell">${priorityBadge(tc.priority)}</td>
            <td class="td-cell">${statusBadge(tc.status)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Test Cases Table ───────────────────────────────────────────────────────

/** Apply search + filter and re-render the test case table */
function applyFilters() {
  const search   = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const priority = document.getElementById('filterPriority')?.value || '';
  const status   = document.getElementById('filterStatus')?.value || '';

  filteredCases = testCases.filter(tc => {
    const matchSearch   = !search   || tc.id.toLowerCase().includes(search) || tc.title.toLowerCase().includes(search);
    const matchPriority = !priority || tc.priority === priority;
    const matchStatus   = !status   || tc.status === status;
    return matchSearch && matchPriority && matchStatus;
  });

  renderTable();
}

/** Render the main test case table from filteredCases */
function renderTable() {
  // If applyFilters hasn't run yet, show all
  if (!filteredCases.length && testCases.length) {
    filteredCases = [...testCases];
  } else if (!testCases.length) {
    filteredCases = [];
  }

  const tbody    = document.getElementById('testCaseTableBody');
  const empty    = document.getElementById('emptyState');
  const footer   = document.getElementById('tableFooter');
  const emptyMsg = document.getElementById('emptyStateMsg');

  if (!tbody) return;

  if (filteredCases.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    emptyMsg.textContent = testCases.length === 0
      ? 'No test cases yet. Generate your first one!'
      : 'No test cases match the current filters.';
    footer.textContent = `Showing 0 of ${testCases.length} test cases`;
    return;
  }

  empty.classList.add('hidden');
  footer.textContent = `Showing ${filteredCases.length} of ${testCases.length} test cases`;

  tbody.innerHTML = filteredCases.map(tc => `
    <tr class="tr-row animate-in">
      <td class="td-cell font-mono font-semibold text-primary-light text-xs whitespace-nowrap">${sanitise(tc.id)}</td>
      <td class="td-cell max-w-xs">
        <div class="font-medium text-slate-700 truncate-2">${sanitise(tc.title)}</div>
        <div class="text-xs text-slate-400 mt-0.5">${sanitise(tc.featureName)}</div>
      </td>
      <td class="td-cell text-slate-500 text-xs whitespace-nowrap">${sanitise(tc.testType)}</td>
      <td class="td-cell">${priorityBadge(tc.priority)}</td>
      <td class="td-cell">
        <div class="relative">
          <select onchange="updateStatus('${tc.id}', this.value)"
                  class="status-select badge ${statusClass(tc.status)} px-2 py-0.5 cursor-pointer">
            ${STATUSES.map(s => `<option value="${s}" ${tc.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </td>
      <td class="td-cell">
        <div class="flex items-center justify-center gap-1">
          <button class="btn-icon" title="View Detail" onclick="openDetailModal('${tc.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="btn-icon btn-edit" title="Edit" onclick="openEditModal('${tc.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-copy" title="Duplicate" onclick="duplicateTestCase('${tc.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" title="Delete" onclick="confirmDelete('${tc.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Badge Helpers ──────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = { 'Passed': 'badge-passed', 'Failed': 'badge-failed', 'Blocked': 'badge-blocked', 'Not Run': 'badge-notrun' };
  return `<span class="badge ${map[status] || 'badge-notrun'}">${sanitise(status)}</span>`;
}

function statusClass(status) {
  const map = { 'Passed': 'badge-passed', 'Failed': 'badge-failed', 'Blocked': 'badge-blocked', 'Not Run': 'badge-notrun' };
  return map[status] || 'badge-notrun';
}

function priorityBadge(priority) {
  const map = { 'High': 'badge-high', 'Medium': 'badge-medium', 'Low': 'badge-low' };
  return `<span class="badge ${map[priority] || ''}">${sanitise(priority)}</span>`;
}

// ── CRUD Operations ────────────────────────────────────────────────────────

/** Update the status of a single test case */
function updateStatus(id, newStatus) {
  const tc = testCases.find(t => t.id === id);
  if (!tc) return;
  tc.status = newStatus;
  saveToStorage();
  renderDashboard();
  applyFilters();
  showToast(`Status updated to "${newStatus}"`, 'info');
}

/** Open the read-only detail modal */
function openDetailModal(id) {
  const tc = testCases.find(t => t.id === id);
  if (!tc) return;

  document.getElementById('modalTitle').textContent = `${tc.id} – Detail`;

  const fields = [
    ['Test Case ID',    tc.id],
    ['Feature Name',    tc.featureName],
    ['Test Scenario',   tc.scenario],
    ['Title',           tc.title],
    ['Test Type',       tc.testType],
    ['Priority',        tc.priority],
    ['Status',          tc.status],
    ['Preconditions',   tc.preconditions],
    ['Test Steps',      tc.steps],
    ['Test Data',       tc.testData],
    ['Expected Result', tc.expectedResult],
    ['Actual Result',   tc.actualResult || '(not recorded)'],
    ['Created At',      formatDate(tc.createdAt)],
  ];

  document.getElementById('modalBody').innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${fields.map(([label, value]) => `
        <div class="detail-field ${label === 'Test Steps' || label === 'Preconditions' ? 'sm:col-span-2' : ''}">
          <p class="detail-label">${sanitise(label)}</p>
          <div class="detail-value">${sanitise(String(value))}</div>
        </div>`).join('')}
    </div>`;

  document.getElementById('modalFooter').innerHTML = `
    <button onclick="openEditModal('${tc.id}')" class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
      Edit
    </button>
    <button onclick="closeModal()" class="border border-border text-slate-600 hover:bg-slate-50 text-sm font-medium px-5 py-2 rounded-lg transition-colors">
      Close
    </button>`;

  document.getElementById('tcModal').classList.remove('hidden');
}

/** Open the editable modal for an existing test case */
function openEditModal(id) {
  const tc = testCases.find(t => t.id === id);
  if (!tc) return;

  document.getElementById('modalTitle').textContent = `Edit – ${tc.id}`;

  const editableFields = [
    { key: 'title',          label: 'Title',           type: 'input'    },
    { key: 'scenario',       label: 'Test Scenario',   type: 'textarea' },
    { key: 'preconditions',  label: 'Preconditions',   type: 'textarea' },
    { key: 'steps',          label: 'Test Steps',      type: 'textarea' },
    { key: 'testData',       label: 'Test Data',       type: 'textarea' },
    { key: 'expectedResult', label: 'Expected Result', type: 'textarea' },
    { key: 'actualResult',   label: 'Actual Result',   type: 'textarea' },
  ];

  const statusOpts = STATUSES.map(s =>
    `<option value="${s}" ${tc.status === s ? 'selected' : ''}>${s}</option>`).join('');

  const priorityOpts = ['High','Medium','Low'].map(p =>
    `<option value="${p}" ${tc.priority === p ? 'selected' : ''}>${p}</option>`).join('');

  document.getElementById('modalBody').innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="detail-label">Priority</label>
          <select id="edit-priority" class="form-input">${priorityOpts}</select>
        </div>
        <div>
          <label class="detail-label">Status</label>
          <select id="edit-status" class="form-input">${statusOpts}</select>
        </div>
      </div>
      ${editableFields.map(f => `
        <div>
          <label class="detail-label">${sanitise(f.label)}</label>
          ${f.type === 'input'
            ? `<input id="edit-${f.key}" class="form-input" value="${sanitise(tc[f.key] || '')}" />`
            : `<textarea id="edit-${f.key}" class="form-input edit-textarea resize-none" rows="3">${sanitise(tc[f.key] || '')}</textarea>`}
        </div>`).join('')}
    </div>`;

  document.getElementById('modalFooter').innerHTML = `
    <button onclick="saveEdit('${tc.id}')" class="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
      Save Changes
    </button>
    <button onclick="closeModal()" class="border border-border text-slate-600 hover:bg-slate-50 text-sm font-medium px-5 py-2 rounded-lg transition-colors">
      Cancel
    </button>`;

  document.getElementById('tcModal').classList.remove('hidden');
}

/** Save the edits made in the edit modal */
function saveEdit(id) {
  const tc = testCases.find(t => t.id === id);
  if (!tc) return;

  tc.priority       = document.getElementById('edit-priority').value;
  tc.status         = document.getElementById('edit-status').value;
  tc.title          = document.getElementById('edit-title').value.trim();
  tc.scenario       = document.getElementById('edit-scenario').value.trim();
  tc.preconditions  = document.getElementById('edit-preconditions').value.trim();
  tc.steps          = document.getElementById('edit-steps').value.trim();
  tc.testData       = document.getElementById('edit-testData').value.trim();
  tc.expectedResult = document.getElementById('edit-expectedResult').value.trim();
  tc.actualResult   = document.getElementById('edit-actualResult').value.trim();

  saveToStorage();
  closeModal();
  renderDashboard();
  applyFilters();
  showToast(`✓ Test case ${id} updated successfully`, 'success');
}

/** Duplicate a test case with a new ID and status 'Not Run' */
function duplicateTestCase(id) {
  const tc = testCases.find(t => t.id === id);
  if (!tc) return;

  const copy = {
    ...tc,
    id:           generateId(0),
    status:       'Not Run',
    actualResult: '',
    createdAt:    new Date().toISOString(),
    title:        tc.title + ' (Copy)',
  };

  testCases.push(copy);
  saveToStorage();
  renderDashboard();
  applyFilters();
  showToast(`✓ Test case duplicated as ${copy.id}`, 'info');
}

/** Prompt the delete confirmation modal */
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirmModal').classList.remove('hidden');
  document.getElementById('confirmDeleteBtn').onclick = executeDelete;
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  pendingDeleteId = null;
}

/** Perform the actual deletion */
function executeDelete() {
  if (!pendingDeleteId) return;
  const idx = testCases.findIndex(t => t.id === pendingDeleteId);
  if (idx !== -1) testCases.splice(idx, 1);
  saveToStorage();
  closeConfirmModal();
  renderDashboard();
  applyFilters();
  showToast('Test case deleted.', 'error');
}

/** Delete ALL test cases after confirmation */
function clearAllTestCases() {
  if (testCases.length === 0) { showToast('No test cases to clear.', 'info'); return; }
  if (!confirm(`Are you sure you want to delete all ${testCases.length} test case(s)? This cannot be undone.`)) return;
  testCases = [];
  filteredCases = [];
  saveToStorage();
  renderDashboard();
  renderTable();
  showToast('All test cases cleared.', 'error');
}

// ── Modal Helpers ──────────────────────────────────────────────────────────

function closeModal() {
  document.getElementById('tcModal').classList.add('hidden');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  const tcModal      = document.getElementById('tcModal');
  const confirmModal = document.getElementById('confirmModal');
  if (e.target === tcModal)      closeModal();
  if (e.target === confirmModal) closeConfirmModal();
});

// ── CSV Export ─────────────────────────────────────────────────────────────

/** Export all test cases to a downloadable CSV file */
function exportCSV() {
  if (testCases.length === 0) {
    showToast('No test cases to export.', 'info');
    return;
  }

  const headers = [
    'TC ID', 'Feature Name', 'Test Type', 'Test Scenario', 'Title',
    'Preconditions', 'Test Steps', 'Test Data', 'Expected Result',
    'Actual Result', 'Priority', 'Status', 'Created At',
  ];

  const rows = testCases.map(tc => [
    tc.id, tc.featureName, tc.testType, tc.scenario, tc.title,
    tc.preconditions, tc.steps, tc.testData, tc.expectedResult,
    tc.actualResult, tc.priority, tc.status, formatDate(tc.createdAt),
  ].map(escapeCSV).join(','));

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `testcases_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`✓ Exported ${testCases.length} test case(s) to CSV`, 'success');
}

// ── Toast Notification ─────────────────────────────────────────────────────

let toastTimer = null;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
  const toast   = document.getElementById('toast');
  const iconEl  = document.getElementById('toastIcon');
  const msgEl   = document.getElementById('toastMsg');

  const icons = {
    success: '<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>',
    error:   '<svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    info:    '<svg class="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  };

  iconEl.innerHTML = icons[type] || icons.info;
  msgEl.textContent = message;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
