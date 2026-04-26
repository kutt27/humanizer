/* -------------------------------------------------------
   Text Humanizer (Groq API)
 ------------------------------------------------------- */

let serverHasKey = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('save-key-btn').addEventListener('click', saveApiKey);
  document.getElementById('humanize-btn').addEventListener('click', humanizeText);
  document.getElementById('insert-sample-btn').addEventListener('click', insertSampleText);

  fetch('/api/config')
    .then(r => r.json())
    .then(cfg => {
      serverHasKey = !!cfg.hasServerKey;
      if (serverHasKey) {
        document.getElementById('key-section').style.display = 'none';
        document.getElementById('key-status-server').textContent = '✓ API key loaded from server .env';
        document.getElementById('key-status-server').style.display = 'block';
      } else {
        const saved = localStorage.getItem('ch-api-key');
        if (saved) {
          document.getElementById('api-key').value = saved;
          document.getElementById('key-status').textContent = 'API key loaded.';
        }
      }
    })
    .catch(() => {
      const saved = localStorage.getItem('ch-api-key');
      if (saved) {
        document.getElementById('api-key').value = saved;
        document.getElementById('key-status').textContent = 'API key loaded.';
      }
    });
});

/* ---- API key ---- */
function saveApiKey() {
  const key = document.getElementById('api-key').value.trim();
  if (!key.startsWith('gsk_')) {
    setKeyStatus('Key should start with gsk_...', true);
    return;
  }
  localStorage.setItem('ch-api-key', key);
  setKeyStatus('Saved ✓');
}

function setKeyStatus(msg, isError = false) {
  const el = document.getElementById('key-status');
  el.textContent = msg;
  el.style.color = isError ? '#dc2626' : '#15803d';
}

function getApiKey() {
  if (serverHasKey) return '__server__';
  return localStorage.getItem('ch-api-key') || '';
}

/* ---- Sample text ---- */
const SAMPLE_AI_TEXT =
  'The integration of artificial intelligence into modern organizational workflows represents a paradigm shift — fundamentally transforming how enterprises navigate the rapidly evolving technological landscape. Furthermore, it is worth noting that robust and seamless automation tools leverage cutting-edge capabilities to foster unprecedented operational efficiency across vibrant, dynamic, and resilient teams. Moreover, this groundbreaking development serves as a testament to human ingenuity, underscoring its pivotal role in shaping the broader industry landscape and delivering seamless value at every crucial touchpoint.';

function insertSampleText() {
  document.getElementById('paste-area').value = SAMPLE_AI_TEXT;
  showToast('Sample text inserted');
}

/* ---- Humanize text ---- */
async function humanizeText() {
  if (!getApiKey()) { showToast('Enter your Groq API key first — or set GROQ_API_KEY in .env', true); return; }

  const btn = document.getElementById('humanize-btn');
  const text = document.getElementById('paste-area').value.trim();

  if (!text || text.length < 10) {
    showToast('Paste some text first (at least 10 characters)', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Humanizing...';
  showCard(text);

  try {
    const response = await fetch('/api/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, apiKey: getApiKey() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error');
    updateCard(data.result);
  } catch (err) {
    showToast('Error: ' + err.message, true);
    setCardError();
  }

  resetBtn('humanize-btn', 'Humanize Text');
}

/* ---- Humanizer score (heuristic, 0–94, higher = more human) ---- */
function humanScore(text) {
  const t = text.toLowerCase();
  let penalties = 0;
  const flags = [];

  const banned = [
    'delve', 'leverage', 'robust', 'seamless', 'pivotal',
    'testament', 'tapestry', 'vibrant', 'foster',
    'furthermore', 'moreover', 'additionally', 'groundbreaking',
    'underscore', 'realm', 'navigate', 'landscape',
  ];
  const foundWords = [];
  banned.forEach(w => {
    const hits = (t.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length;
    if (hits) { penalties += hits * 10; foundWords.push(w); }
  });
  if (foundWords.length) flags.push({ key: 'vocab', label: `AI words: ${foundWords.slice(0, 4).join(', ')}${foundWords.length > 4 ? ` +${foundWords.length - 4}` : ''}` });

  const emDashes = (text.match(/—/g) || []).length;
  if (emDashes) {
    penalties += emDashes * 12;
    flags.push({ key: 'emdash', label: `em dash${emDashes > 1 ? ` ×${emDashes}` : ''}` });
  }

  const phraseList = [
    'marks a pivotal moment',
    'serves as a testament',
    'represents a paradigm shift',
    'it is worth noting',
    'underscoring its',
    'highlighting the need',
  ];
  phraseList.forEach(p => {
    if (t.includes(p)) {
      penalties += 15;
      flags.push({ key: `phrase:${p}`, label: `"${p}"` });
    }
  });

  return { score: Math.max(7, Math.min(94, 100 - penalties)), flags };
}

function scoreBadgeHtml(score, id) {
  const cls = score >= 71 ? 'score-green' : score >= 41 ? 'score-amber' : 'score-red';
  return `<span class="score-badge ${cls}" id="${id}">${score}</span>`;
}

function reasonsHtml(flags) {
  if (!flags.length) return '<span class="reason-clear">No AI patterns detected</span>';
  return flags.map(f => `<span class="reason-flag">${escapeHtml(f.label)}</span>`).join('');
}

function improvementsHtml(beforeFlags, afterFlags) {
  const afterKeys = new Set(afterFlags.map(f => f.key));
  const fixed = beforeFlags.filter(f => !afterKeys.has(f.key));
  if (!fixed.length) return '<span class="reason-clear">Score already clean</span>';
  return fixed.map(f => `<span class="reason-fixed">✓ ${escapeHtml(f.label)}</span>`).join('');
}

/* ---- Card UI ---- */
function showCard(originalText) {
  const before = humanScore(originalText);
  const area = document.getElementById('card-area');
  area.innerHTML = `
    <div class="result-card" id="result-card">
      <div class="score-row">
        <div class="score-col">
          <div class="score-label">AI Score</div>
          ${scoreBadgeHtml(before.score, 'score-before')}
        </div>
        <div class="score-arrow">→</div>
        <div class="score-col">
          <div class="score-label">Human Score</div>
          <span class="score-badge score-pending" id="score-after">—</span>
        </div>
      </div>
      <div class="score-reasons" id="score-reasons">${reasonsHtml(before.flags)}</div>
      <div class="score-reasons hidden" id="score-improvements"></div>
      <div class="card-label">Original</div>
      <div class="original-text">${escapeHtml(originalText)}</div>
      <div class="card-label suggestion-label hidden">Rewrite</div>
      <div class="suggestion hidden" id="suggestion-text"></div>
      <div class="spinner" id="spinner">
        <div class="spin-dot"></div><div class="spin-dot"></div><div class="spin-dot"></div>
      </div>
      <div class="actions hidden" id="card-actions">
        <button class="btn-accept" id="btn-accept">Copy to Clipboard</button>
        <button class="btn-skip" id="btn-dismiss">Dismiss</button>
      </div>
    </div>
  `;

  const card = document.getElementById('result-card');
  card._humanized = null;
  card._beforeFlags = before.flags;

  document.getElementById('btn-accept').addEventListener('click', acceptResult);
  document.getElementById('btn-dismiss').addEventListener('click', dismissResult);
}

function updateCard(humanizedText) {
  const card = document.getElementById('result-card');
  if (!card) return;
  card._humanized = humanizedText;

  const after = humanScore(humanizedText);
  const afterEl = document.getElementById('score-after');
  if (afterEl) {
    afterEl.textContent = after.score;
    afterEl.className = 'score-badge ' + (after.score >= 71 ? 'score-green' : after.score >= 41 ? 'score-amber' : 'score-red');
  }

  const improveEl = document.getElementById('score-improvements');
  if (improveEl) {
    improveEl.innerHTML = improvementsHtml(card._beforeFlags || [], after.flags);
    improveEl.classList.remove('hidden');
  }
  document.getElementById('score-reasons')?.classList.add('hidden');

  document.getElementById('spinner').classList.add('hidden');
  document.getElementById('suggestion-text').textContent = humanizedText;
  document.getElementById('suggestion-text').classList.remove('hidden');
  card.querySelector('.suggestion-label').classList.remove('hidden');
  document.getElementById('card-actions').classList.remove('hidden');
}

function setCardError() {
  const spinner = document.getElementById('spinner');
  if (spinner) spinner.innerHTML = '<p style="color:#dc2626;font-size:12px">Error — try again</p>';
}

/* ---- Accept / Dismiss ---- */
async function acceptResult() {
  const card = document.getElementById('result-card');
  if (!card || !card._humanized) return;

  const btn = document.getElementById('btn-accept');
  btn.disabled = true;
  btn.textContent = 'Copying...';

  try {
    await navigator.clipboard.writeText(card._humanized);
    document.getElementById('card-area').innerHTML = '<div class="done-msg">✓ Copied to clipboard</div>';
    showToast('Done ✓');
  } catch (err) {
    showToast('Error: ' + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Copy to Clipboard';
  }
}

function dismissResult() {
  document.getElementById('card-area').innerHTML = '';
}

function resetBtn(id, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = label;
}

/* ---- Toast ---- */
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}