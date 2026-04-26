# Humanizer

Humanizer is a web service that rewrites AI-generated text to sound natural and human. It uses the Groq API to remove common AI writing patterns.

---

## Features

- Detects AI vocabulary patterns (delve, leverage, robust, pivotal, etc.)
- Removes em dashes and inflated language
- Shows before/after readability scores
- One-click copy to clipboard

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- A free [Groq API key](https://console.groq.com) (starts with `gsk_`)

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/kutt27/text-humanizer.git
cd text-humanizer
npm install
```

### 2. Configure your API key

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3001
GROQ_API_KEY=your-groq-api-key
```

### 3. Run the server

```bash
npm start
```

The panel opens at `http://localhost:3001`.

### 4. Use

1. Paste AI-generated text into the text area
2. Click **Humanize Text**
3. Review the score and rewrite
4. Click **Copy to Clipboard**