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
  const score = calculateHeuristicScore(text);
  const indicator = document.getElementById('score-indicator');
  const valueEl = document.getElementById('score-value');
  
  indicator.classList.remove('hidden');
  valueEl.textContent = score;
  
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const bg = score >= 80 ? '#ecfdf5' : score >= 50 ? '#fffbeb' : '#fef2f2';
  valueEl.style.color = color;
  valueEl.style.backgroundColor = bg;
}

function calculateHeuristicScore(text) {
  const t = text.toLowerCase();
  let penalties = 0;
  const banned = ['delve', 'leverage', 'robust', 'seamless', 'pivotal', 'testament', 'tapestry', 'vibrant', 'foster'];
  banned.forEach(w => {
    const hits = (t.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length;
    penalties += hits * 8;
  });
  return Math.max(10, Math.min(98, 100 - penalties));
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