# NewtonPilot

NewtonPilot is an autonomous AI Chrome Extension (Manifest V3) and pedagogical study companion engineered specifically for Newton School's practice MCQ assessment portal (`https://my.newtonschool.co/`).

It pairs dynamic React DOM extraction and synthetic event dispatching with a local Ollama LLM backend to deliver instant question explanations, single-step question assistance, and full-loop autonomous assessment solving for practice and mock speedrunning environments.

---

## Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │       Newton School Assessment Portal        │
                               │         (https://my.newtonschool.co)         │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      │ (DOM Extraction & Synthetic Events)
                                                      ▼
┌─────────────────────────┐             ┌─────────────────────────────────────────────┐
│      Local Ollama       │◄────────────┤                 NewtonPilot                 │
│  (http://localhost:11434)│ (CORS DNR)  │         Chrome Extension (MV3)              │
│                         ├────────────►│                                             │
│ • qwen2.5-coder:7b      │             │  • DOM Extractor (Multi-tier fallback)      │
│ • llava:7b (Vision)     │             │  • Action Executor (React event dispatch)   │
│ • llama3.2:1b (Fast)    │             │  • Autonomous State Loop (9-step machine)   │
└─────────────────────────┘             │  • Live Sync & Global Chrome Hotkeys        │
                                        └─────────────────────────────────────────────┘
```

---

## Prerequisites

Before installing the extension, ensure your device has:

1. **Google Chrome** (or any Chromium browser such as Brave, Arc, Edge).
2. **Ollama** installed on your system:
   - **macOS**: `brew install ollama` (or download from [ollama.com](https://ollama.com/download))
   - **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
   - **Windows**: Download installer from [ollama.com/download](https://ollama.com/download)
3. **Node.js** (v18+) *[Optional]*: Only required if you want to run the automated unit test suite.

---

## Step-by-Step Setup Guide

### Step 1: Install and Configure Ollama Models

Open your terminal and pull the recommended models:

```bash
# 1. Primary code & reasoning model (High accuracy on Python/programming syntax)
ollama pull qwen2.5-coder:7b

# 2. Vision model (Required for questions containing diagrams, figures, or code screenshots)
ollama pull llava:7b

# 3. Optional: Lightweight model (For fast responses or lower-spec machines)
ollama pull llama3.2:1b
```

### Step 2: Start the Ollama Local Daemon

Start Ollama with cross-origin requests enabled so the extension can communicate with it:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

> **Note**: Keep this terminal window open while using the extension. To verify Ollama is responding, open another terminal and run:
> ```bash
> curl http://localhost:11434/api/tags
> ```
> You should see a JSON listing of your installed models.

---

### Step 3: Install NewtonPilot in Chrome

1. Clone or download this repository to your machine:
   ```bash
   git clone https://github.com/your-username/assignments-extension.git
   cd assignments-extension
   ```
2. Open Google Chrome and enter `chrome://extensions/` in the URL address bar.
3. In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker, select the `newtonpilot` folder (inside `assignments-extension/newtonpilot`).
6. Click **Select** / **Open**.
7. NewtonPilot will appear in your extensions list. Click the puzzle icon in Chrome's top toolbar and click the pin icon next to **NewtonPilot** for quick access.

---

## How to Use

### 1. Log in to Newton School
1. Navigate to [my.newtonschool.co](https://my.newtonschool.co/) and log in.
2. Open any active practice quiz or assessment (e.g. `https://my.newtonschool.co/course/.../assessment/...`).

---

### 2. Operating Modes

Open the extension popup by clicking the NewtonPilot icon in your Chrome toolbar.

#### Mode A: Question View & Local AI Concept Tutor
- **Live Sync**: The toolbar displays `Live Sync: Passive`. This automatically extracts the question statement, format, options, and diagrams whenever a new question is loaded.
- **Inspect**: Click **Inspect** (or press `⌥I` / `Alt+I`) to manually refresh extraction at any moment.
- **Explain**: Click **Explain** to trigger deep reasoning. Local Ollama will return:
  - Suggested answer letter with confidence rating.
  - Core conceptual summary.
  - Pedagogical walkthrough explaining why the answer is correct.
  - Collapsible **Option Breakdown** analyzing each distractor option.

#### Mode B: Step-by-Step Semi-Autonomous Solving
- Click **Step 1 Q** (or press `⌥S` / `Alt+Shift+S`).
- NewtonPilot will:
  1. Extract the active question.
  2. Send it to Ollama for evaluation.
  3. Locate the predicted option element and dispatch simulated pointer down, mouse down, and click events.
  4. Leave you on the question so you can verify the selection before proceeding.

#### Mode C: Fully Autonomous Speedrun Auto-Pilot
- Click the **Auto-Pilot** tab in the popup.
- Select your desired pacing:
  - `0.8s (Fast)`: For mock exam speedruns.
  - `1.5s (Balanced)`: Default recommended speed.
  - `2.5s (Careful)`: High-latency network buffer.
- Click **Start Auto-Pilot** (or press `⌥P` / `Alt+Shift+P`).
- The agent loop runs continuously:
  - It extracts the current question.
  - Evaluates the answer with Ollama.
  - Clicks the option.
  - Clicks the `Next >` button.
  - Automatically halts when it reaches the final question or detects completion.
- Click **Pause Auto-Pilot** or hit the emergency stop button at any point to halt execution.

---

### 3. Diagram and Multimodal Image Questions

Some questions on Newton School include screenshots, syntax diagrams, or flowcharts.
- When an image is detected in the question statement, NewtonPilot surfaces a **Diagram Detected** badge.
- If you have `llava:7b` (or any model containing `vision`, `llava`, or `vl`) installed in Ollama, NewtonPilot will automatically switch to it and pass the image data to Ollama as base64 for multimodal visual analysis.
- If no vision model is found, the banner reminds you to run `ollama pull llava:7b`.

---

## Keyboard Shortcuts

NewtonPilot registers global Chrome hotkeys so you can operate without opening the popup:

| Shortcut (macOS) | Shortcut (Windows/Linux) | Action | Scope |
|---|---|---|---|
| `Alt + Shift + S` | `Alt + Shift + S` | Step 1 Question (Extract &rarr; Reason &rarr; Click) | Global (on active portal tab) |
| `Alt + Shift + P` | `Alt + Shift + P` | Toggle Auto-Pilot (Start / Pause) | Global (on active portal tab) |
| `S` | `S` | Step 1 Question | Inside popup |
| `P` | `P` | Start / Pause Auto-Pilot | Inside popup |
| `I` | `I` | Inspect active question | Inside popup |
| `1` / `2` / `3` | `1` / `2` / `3` | Switch between Question, Auto-Pilot, and JSON tabs | Inside popup |

---

## Running Automated Tests

To verify that the DOM extractor, Ollama client, and autonomous agent state machine are functioning properly on your system:

```bash
cd newtonpilot
npm test
```

Expected output:
```text
✓ Test 1: Single choice MCQ extraction passed
✓ Test 2: Multi-choice checkbox extraction passed
✓ Test 3: Newton School actual portal structure passed perfectly
All extractor unit tests passed successfully!

✓ Test 1: Default configuration passed
✓ Test 2: Prompt structure generation passed
✓ Test 3: Markdown JSON code-fence cleaning passed
✓ Test 4: Explanation parsing and schema mapping passed
✓ Test 5: Multimodal vision payload passed
All OllamaProvider tests passed successfully!

✓ Test 1: Completion detector logic passed
✓ Test 2: Option element resolution passed
✓ Test 3: Agent state machine transitions passed
All Autonomous Agent tests passed successfully!
```

---

## Troubleshooting

### 1. Ollama Connection Error (`HTTP 403 Forbidden` or `Offline`)
- Make sure Ollama is running in your terminal:
  ```bash
  OLLAMA_ORIGINS="*" ollama serve
  ```
- If the popup says "Checking..." or "Offline", click the **Refresh** button in the popup toolbar.
- Note: NewtonPilot's Manifest V3 background service worker includes a dynamic Declarative Net Request header rewrite rule that rewrites the `Origin` header to `http://localhost`, circumventing browser CORS restrictions.

### 2. "No Question Detected"
- Confirm you are on an active quiz URL (`https://my.newtonschool.co/course/.../assessment/...`).
- If the page just finished loading via React SPA routing, click **Inspect** (`⌥I`) to trigger extraction.

### 3. Agent Clicks the Wrong Option
- Smaller models (such as `1B` parameter models) can occasionally misread subtle Python slicing or recursion questions.
- Switch the active model in the popup dropdown to `qwen2.5-coder:7b`, which is specifically fine-tuned for code evaluation and syntax accuracy.

---

## Directory Structure

```text
newtonpilot/
├── manifest.json              # Chrome Manifest V3 configuration & commands
├── popup/
│   ├── popup.html             # UI container (Arthakram System B theme)
│   ├── popup.css              # Custom styled paper palette tokens
│   └── popup.js               # UI controller, hotkey listeners & Ollama sync
├── scripts/
│   ├── extractor.js           # Multi-tier DOM question extractor & image renderer
│   ├── executor.js            # Synthetic event dispatcher & portal navigation
│   ├── agent.js               # 9-step autonomous state machine loop
│   ├── observer.js            # Debounced MutationObserver for React transitions
│   └── content.js             # Content script coordinator & messaging bridge
├── services/
│   └── ollama-provider.js     # Multimodal Ollama API client & prompt builder
├── background/
│   └── service-worker.js      # DeclarativeNetRequest rules & hotkey forwarder
├── utils/
│   └── messaging.js           # Standardized Chrome runtime message schemas
├── tests/
│   ├── extractor.test.js      # Portal DOM extraction test suite
│   ├── ollama-provider.test.js# Prompt generation & multimodal payload tests
│   └── agent.test.js          # State transitions & executor test suite
├── assets/
│   └── icons/                 # Extension toolbar icons (16px, 48px, 128px)
└── package.json
```

---

## Disclaimer

This project is created for educational study, practice assessments, and mock environment speedrunning where students are encouraged to exercise coding, browser automation, and problem-solving skills. Use responsibly and in accordance with your institution's guidelines.

---

<p align="center">
  <sub>Made by <b>zeniqen</b> for <b>jagrati</b></sub>
</p>
