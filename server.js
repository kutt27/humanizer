require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'src')));

app.get('/', (req, res) => res.redirect('/panel.html'));

const { generateSystemPrompt } = require('./lib/methodology');

const SYSTEM_PROMPT = generateSystemPrompt();

const ENV_KEY = (process.env.GROQ_API_KEY || '').startsWith('gsk_')
  ? process.env.GROQ_API_KEY
  : null;

app.get('/api/config', (req, res) => {
  res.json({ hasServerKey: !!ENV_KEY });
});

app.post('/api/humanize', async (req, res) => {
  const { text, format, output } = req.body;

  if (!ENV_KEY) {
    return res.status(500).json({ error: 'Server API key is not configured' });
  }

  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }

  let userPrompt = text;
  let systemPrompt = SYSTEM_PROMPT;

  if (format === 'points') {
    systemPrompt += '\n\nIMPORTANT: Convert the content into clear bullet points or numbered list items.';
  }

  if (output === 'formatted') {
    systemPrompt += '\n\nIMPORTANT: Use markdown formatting. Use **bold** for important keywords or key phrases. Use *italic* sparingly for emphasis. Structure the output with proper headings if needed.';
  } else {
    systemPrompt += '\n\nIMPORTANT: Return plain text only. No markdown, no bold, no italic formatting.';
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message || JSON.stringify(data.error) || 'Groq API error';
      return res.status(response.status).json({ error: msg });
    }

    const result = data.choices?.[0]?.message?.content?.trim();
    if (!result) {
      return res.status(500).json({ error: 'Empty response from Groq' });
    }

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai-score', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  if (!ENV_KEY) return res.status(500).json({ error: 'Server API key is not configured' });

  const prompt = `You are an AI text detector. Analyze this text and estimate the probability it was written by AI.

Text: ${text}

Return ONLY valid JSON with this structure:
{"score": <number 0-100, higher = more likely AI>, "summary": "<1 sentence>"}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ENV_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text },
        ],
        max_tokens: 256,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const msg = data.error?.message || JSON.stringify(data.error) || 'Groq API error';
      return res.status(response.status).json({ error: msg });
    }

    const result = data.choices?.[0]?.message?.content?.trim();
    if (!result) return res.status(500).json({ error: 'Empty response' });

    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      return res.status(500).json({ error: 'Failed to parse scoring response', raw: result });
    }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Humanizer running at http://localhost:${PORT}`);
  console.log('  Open the panel: http://localhost:' + PORT + '/panel.html');
  console.log('  Server-side API key:', ENV_KEY ? '✓ loaded from .env' : '✗ not set (enter key in browser panel)');
});