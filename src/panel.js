/* -------------------------------------------------------
   Humanizer — Premium Text Humanizer
------------------------------------------------------- */

let currentFormat = 'regular';
let currentMD = 'unformatted';
let lastResult = '';

document.addEventListener('DOMContentLoaded', () => {
  // --- Tab Logic ---
  setupTabs('format-tabs', (val) => currentFormat = val);
  setupTabs('markdown-tabs', (val) => {
    currentMD = val;
    refreshOutputDisplay();
  });

  // --- Actions ---
  document.getElementById('humanize-btn').addEventListener('click', humanizeText);
  document.getElementById('insert-sample-btn').addEventListener('click', insertSampleText);
  document.getElementById('copy-btn').addEventListener('click', copyToClipboard);

  const inputArea = document.getElementById('input-area');
  let timer;
  inputArea.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (inputArea.value.trim().length > 0) updateScore(inputArea.value);
    }, 500);
  });
});

function setupTabs(groupId, callback) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const buttons = group.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callback(btn.dataset.value);
    });
  });
}

/* ---- Humanize Logic ---- */
async function humanizeText() {
  const inputArea = document.getElementById('input-area');
  const text = inputArea.value.trim();

  if (!text || text.length < 10) {
    showToast('Please enter at least 10 characters', true);
    return;
  }

  const btn = document.getElementById('humanize-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Humanizing...';

  try {
    const response = await fetch('/api/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        format: currentFormat,
        output: currentMD
      }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error');
    
    lastResult = data.result;
    refreshOutputDisplay();
    updateScore(lastResult);
    
    document.getElementById('copy-btn').disabled = false;
    showToast('Text humanized! ✓');
  } catch (err) {
    showToast('Error: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h.01" /><path d="M17.8 6.2 19 5" /><path d="M3 21l9-9" /><path d="M12.2 6.2 11 5" />
      </svg>
      humanize text
    `;
  }
}

function refreshOutputDisplay() {
  const outputArea = document.getElementById('output-area');
  if (!lastResult) return;

  if (currentMD === 'formatted') {
    outputArea.innerHTML = lastResult.split('\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<br>').join('');
  } else {
    outputArea.textContent = lastResult;
  }
}

function updateScore(text) {
  const human = calculateScore(text);
  fetchAiScore(text, human);
}

async function fetchAiScore(text, human) {
  try {
    const response = await fetch('/api/ai-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error('AI score failed');
    const data = await response.json();

    const aiScore = Math.max(0, Math.min(100, Math.round(data.score || 0)));
    renderScores(human, aiScore);
  } catch (err) {
    renderScores(human, 100 - human);
  }
}

function renderScores(human, aiScore) {
  const panel = document.getElementById('score-panel');
  if (!panel) return;
  panel.classList.remove('hidden');

  const hColor = human >= 80 ? '#10b981' : human >= 50 ? '#f59e0b' : '#ef4444';
  const aColor = aiScore >= 80 ? '#ef4444' : aiScore >= 50 ? '#f59e0b' : '#10b981';

  panel.innerHTML = `
    <span class="score-label">human:</span>
    <span class="score-badge" style="color: ${hColor}; background: ${human >= 80 ? '#ecfdf5' : human >= 50 ? '#fffbeb' : '#fef2f2'}">${human}</span>
    <span class="score-divider">|</span>
    <span class="score-label">ai:</span>
    <span class="score-badge" style="color: ${aColor}; background: ${aiScore >= 80 ? '#fef2f2' : aiScore >= 50 ? '#fffbeb' : '#ecfdf5'}">${aiScore}</span>
  `;
}

function calculateScore(text) {
  const t = text.toLowerCase();
  let score = 100;

  ['delve', 'leverage', 'robust', 'navigate', 'seamless', 'pivotal', 'testament',
   'landscape', 'underscore', 'tapestry', 'vibrant', 'foster', 'crucial', 'realm',
   'think', 'utilize', 'comprehensive'].forEach(w => {
    const hits = (t.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length;
    if (hits > 0) score -= hits * 4;
  });

  ['furthermore', 'moreover', 'additionally', 'consequently', 'groundbreaking',
   'in conclusion', 'to summarize'].forEach(w => {
    const hits = (t.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length;
    if (hits > 0) score -= hits * 5;
  });

  ['experts say', 'industry observers', 'it is worth noting', 'many believe',
   "it's important to remember"].forEach(w => {
    if (t.includes(w)) score -= 8;
  });

  ['paradigm shift', 'game-changer', 'transformative', 'serves as a testament',
   'marks a pivotal moment'].forEach(w => {
    if (t.includes(w)) score -= 10;
  });

  const emDashes = (text.match(/—/g) || []).length;
  if (emDashes > 2) score -= (emDashes - 2) * 8;

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    const stdDevPct = (Math.sqrt(variance) / avg) * 100;
    if (stdDevPct < 20) score -= 12;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function copyToClipboard() {
  if (!lastResult) return;
  const btn = document.getElementById('copy-btn');
  const originalHtml = btn.innerHTML;
  
  try {
    await navigator.clipboard.writeText(lastResult);
    btn.innerHTML = '✓ copied!';
    showToast('Copied to clipboard');
    setTimeout(() => btn.innerHTML = originalHtml, 2000);
  } catch (err) {
    showToast('Failed to copy', true);
  }
}

/* ---- Utilities ---- */
function insertSampleText() {
  const SAMPLE = "The integration of artificial intelligence into modern organizational workflows represents a paradigm shift — fundamentally transforming how enterprises navigate the rapidly evolving technological landscape. Furthermore, it is worth noting that robust and seamless automation tools leverage cutting-edge capabilities to foster unprecedented operational efficiency.";
  document.getElementById('input-area').value = SAMPLE;
  showToast('Sample text inserted');
  updateScore(SAMPLE);
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}