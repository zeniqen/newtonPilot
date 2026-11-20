# NewtonPilot 🚀 — AI-Powered Chrome Extension

**NewtonPilot** is a Chrome extension (Manifest V3) designed as a learning and review companion for practice MCQ quizzes and assessments on Newton School's student portal (`https://my.newtonschool.co/`).

> **Ethical & Safety Notice**: NewtonPilot is built exclusively as an interactive learning, study, and review companion. It does **not** perform unattended quiz solving, automatic assessment submission, or bypass any portal security or proctoring controls.

---

## 1. Project Overview & Features

- **Dynamic Question Extraction**: Parses active questions, options, selection states, question format (single-choice, multi-select, true/false), and diagrams.
- **SPA & Mutation Observer**: Detects question changes and route navigation on Newton School's React-based portal with debounced deduplication.
- **Raycast/Linear-Inspired Dark UI**: Polished, modern popup interface displaying live question previews, badges, selection states, and developer diagnostics.
- **Local JSON Diagnostics**: Allows one-click copying of extracted structured JSON for debugging and portal verification.
- **Phase 2 Ready**: Includes decoupled Ollama integration interfaces (`services/ollama-provider.js`) for concept explanations in Phase 2.

---

## 2. Technology Stack

- **Platform**: Google Chrome (Manifest V3)
- **Frontend**: Vanilla HTML5, Modern CSS3 (CSS Variables, Flexbox), Vanilla JavaScript (ES2022)
- **DOM Observation**: Native `MutationObserver` + HTML5 History API interceptor
- **Icons**: Custom scalable SVG and multi-resolution PNGs (16px, 48px, 128px)
- **AI Backend (Phase 2)**: Local Ollama client (`http://localhost:11434`)

---

## 3. Extension Directory Structure

```text
newtonpilot/
├── manifest.json              # Chrome Manifest V3 configuration
├── popup/
│   ├── popup.html             # Compact dark-themed popup view
│   ├── popup.css              # Linear/Raycast design system
│   └── popup.js               # Popup controller & state renderer
├── scripts/
│   ├── content.js             # Content script coordinator
│   ├── extractor.js           # Multi-tier DOM question extraction engine
│   └── observer.js            # Debounced MutationObserver for React SPA
├── background/
│   └── service-worker.js      # Background service worker & storage cache
├── services/
│   └── ollama-provider.js     # Prepared local Ollama integration interface
├── utils/
│   └── messaging.js           # Standardized Chrome runtime messaging protocol
├── assets/
│   └── icons/                 # Generated extension icons (16, 48, 128px + SVG)
└── README.md
```

---

## 4. How to Load the Unpacked Extension in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the URL bar.
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. In the file picker, select the `newtonpilot` folder:
   `/Users/zeniqen/Documents/assignments-extension/newtonpilot`
6. Click **Select** / **Open**.
7. Pin **NewtonPilot** to your Chrome toolbar by clicking the puzzle icon in Chrome.

---

## 5. Usage Guide

### Inspecting a Question
1. Log in to `https://my.newtonschool.co/`.
2. Open a practice course quiz or assessment (e.g. `https://my.newtonschool.co/course/.../assessment/...`).
3. Click the **NewtonPilot** icon in your toolbar.
4. The extension automatically queries the active tab. You can click **Inspect** at any time to re-run extraction on demand.

### Auto-Monitoring Dynamic Changes
- Use the **Auto-Monitor Quiz** toggle at the top of the popup.
- When enabled, `NewtonObserver` automatically listens for DOM mutations as you navigate between questions or click options, updating the popup in real time.

### Developer Diagnostics & Copying JSON
1. Click **Developer Diagnostics** at the bottom of the popup to expand the debug panel.
2. View the parsed payload and content hash.
3. Click **Copy JSON** to copy the complete extracted data to your clipboard.

---

## 6. How to Provide Newton Portal DOM Structure for Selectors Fine-Tuning

Because Newton School requires authentication, you can help fine-tune portal-specific selectors by:

1. Opening an active assessment question on `https://my.newtonschool.co/`.
2. Opening Chrome DevTools (`Cmd + Option + I` on macOS or `F12`).
3. Inspecting the main question card/container element.
4. Right-clicking the container element in the Elements tab -> **Copy** -> **Copy outerHTML** (or copying relevant snippets).
5. Pasting that snippet into the conversation or saving it into a `.html` file.
6. Alternatively, click **Developer Diagnostics** -> **Copy JSON** in NewtonPilot and share the output.

---

## 7. Known Limitations & Phase 2 Roadmap

### Limitations (Phase 1)
- **Portal Login Required**: Cannot access behind-the-login assessment questions without an active user session in the browser.
- **Dynamic React Lazy Loading**: If questions load over slow networks, click **Inspect** once the question renders.

### Phase 2 Roadmap
- **Local Ollama Explanations**: Enable one-click pedagogical breakdown and conceptual explanation using local Ollama (`llama3`, `mistral`, or `deepseek-r1`).
- **Review Notes Export**: Export question sets and explanations to Markdown or Anki flashcards for revision.
