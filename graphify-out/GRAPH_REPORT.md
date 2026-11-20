# Graph Report - assignments-extension  (2026-11-21)

## Corpus Check
- 21 files · ~17,488 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 140 nodes · 159 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a2e102b6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- NewtonPilot
- manifest.json
- package.json
- action
- popup.js
- NewtonPilot
- OllamaProvider
- agent.test.js
- GEMINI.md
- observer.js
- messaging.js
- commands
- 2. Operating Modes
- 2. Operating Modes

## God Nodes (most connected - your core abstractions)
1. `OllamaProvider` - 11 edges
2. `NewtonPilot` - 10 edges
3. `NewtonPilot` - 10 edges
4. `runTests()` - 6 edges
5. `renderQuestion()` - 5 edges
6. `Step-by-Step Setup Guide` - 4 edges
7. `How to Use` - 4 edges
8. `2. Operating Modes` - 4 edges
9. `Troubleshooting` - 4 edges
10. `Step-by-Step Setup Guide` - 4 edges

## Surprising Connections (you probably didn't know these)
- `runTests()` --calls--> `OllamaProvider`  [EXTRACTED]
  newtonpilot/tests/ollama-provider.test.js → newtonpilot/services/ollama-provider.js

## Import Cycles
- None detected.

## Communities (15 total, 4 thin omitted)

### Community 0 - "NewtonPilot"
Cohesion: 0.12
Nodes (15): 1. Ollama Connection Error (`HTTP 403 Forbidden` or `Offline`), 2. "No Question Detected", 3. Agent Clicks the Wrong Option, Architecture Overview, Directory Structure, Disclaimer, Keyboard Shortcuts, NewtonPilot (+7 more)

### Community 1 - "manifest.json"
Cohesion: 0.13
Nodes (14): background, service_worker, type, content_scripts, description, host_permissions, icons, 128 (+6 more)

### Community 2 - "package.json"
Cohesion: 0.22
Nodes (8): author, description, keywords, license, name, scripts, test, version

### Community 3 - "action"
Cohesion: 0.29
Nodes (7): action, default_icon, default_popup, default_title, 128, 16, 48

### Community 4 - "popup.js"
Cohesion: 0.23
Nodes (14): checkCachedExplanation(), checkOllamaStatus(), checkTabAndInitialize(), fetchAgentStatus(), formatTime(), formatTypeName(), renderExplanation(), renderQuestion() (+6 more)

### Community 5 - "NewtonPilot"
Cohesion: 0.12
Nodes (15): 1. Ollama Connection Error (`HTTP 403 Forbidden` or `Offline`), 2. "No Question Detected", 3. Agent Clicks the Wrong Option, Architecture Overview, Directory Structure, Disclaimer, Keyboard Shortcuts, NewtonPilot (+7 more)

### Community 6 - "OllamaProvider"
Cohesion: 0.26
Nodes (3): OllamaProvider, assert, runTests()

### Community 7 - "agent.test.js"
Cohesion: 0.18
Nodes (7): NewtonAgent, NewtonExecutor, NewtonExtractor, assert, assert, createMockElement(), walk()

### Community 12 - "commands"
Cohesion: 0.28
Nodes (9): commands, step_question, toggle_pilot, description, suggested_key, default, mac, description (+1 more)

### Community 13 - "2. Operating Modes"
Cohesion: 0.29
Nodes (7): 1. Log in to Newton School, 2. Operating Modes, 3. Diagram and Multimodal Image Questions, How to Use, Mode A: Question View & Local AI Concept Tutor, Mode B: Step-by-Step Semi-Autonomous Solving, Mode C: Fully Autonomous Speedrun Auto-Pilot

### Community 14 - "2. Operating Modes"
Cohesion: 0.29
Nodes (7): 1. Log in to Newton School, 2. Operating Modes, 3. Diagram and Multimodal Image Questions, How to Use, Mode A: Question View & Local AI Concept Tutor, Mode B: Step-by-Step Semi-Autonomous Solving, Mode C: Fully Autonomous Speedrun Auto-Pilot

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NewtonPilot` connect `NewtonPilot` to `2. Operating Modes`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `runTests()` (e.g. with `.buildPrompt()` and `.cleanJsonResponse()`) actually correct?**
  _`runTests()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `NewtonPilot` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `NewtonPilot` connect `NewtonPilot` to `2. Operating Modes`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Why does `commands` connect `commands` to `manifest.json`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `NewtonPilot` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._