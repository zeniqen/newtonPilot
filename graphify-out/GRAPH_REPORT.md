# Graph Report - assignments-extension  (2026-11-21)

## Corpus Check
- 17 files · ~10,807 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 88 nodes · 98 edges · 11 communities (7 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cc119835`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- NewtonPilot 🚀 — AI-Powered Chrome Extension
- manifest.json
- package.json
- action
- popup.js
- extractor.test.js
- OllamaProvider
- GEMINI.md
- observer.js
- messaging.js

## God Nodes (most connected - your core abstractions)
1. `OllamaProvider` - 9 edges
2. `NewtonPilot 🚀 — AI-Powered Chrome Extension` - 8 edges
3. `renderQuestion()` - 5 edges
4. `runTests()` - 5 edges
5. `icons` - 4 edges
6. `action` - 4 edges
7. `default_icon` - 4 edges
8. `checkCachedExplanation()` - 4 edges
9. `checkTabAndInitialize()` - 4 edges
10. `5. Usage Guide` - 4 edges

## Surprising Connections (you probably didn't know these)
- `runTests()` --calls--> `OllamaProvider`  [EXTRACTED]
  newtonpilot/tests/ollama-provider.test.js → newtonpilot/services/ollama-provider.js

## Import Cycles
- None detected.

## Communities (11 total, 4 thin omitted)

### Community 0 - "NewtonPilot 🚀 — AI-Powered Chrome Extension"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Features, 2. Technology Stack, 3. Extension Directory Structure, 4. How to Load the Unpacked Extension in Chrome, 5. Usage Guide, 6. How to Provide Newton Portal DOM Structure for Selectors Fine-Tuning, 7. Known Limitations & Phase 2 Roadmap, Auto-Monitoring Dynamic Changes (+5 more)

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
Cohesion: 0.27
Nodes (10): checkCachedExplanation(), checkOllamaStatus(), checkTabAndInitialize(), formatTime(), formatTypeName(), renderExplanation(), renderQuestion(), setStatus() (+2 more)

### Community 5 - "extractor.test.js"
Cohesion: 0.33
Nodes (4): NewtonExtractor, assert, createMockElement(), walk()

### Community 6 - "OllamaProvider"
Cohesion: 0.26
Nodes (3): OllamaProvider, assert, runTests()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `action` connect `action` to `manifest.json`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `runTests()` (e.g. with `.buildPrompt()` and `.cleanJsonResponse()`) actually correct?**
  _`runTests()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `NewtonPilot 🚀 — AI-Powered Chrome Extension` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._