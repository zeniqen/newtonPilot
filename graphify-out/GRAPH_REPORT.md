# Graph Report - assignments-extension  (2026-11-20)

## Corpus Check
- 13 files · ~6,768 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 79 nodes · 77 edges · 13 communities (7 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e7e009e5`
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
- icons
- GEMINI.md
- observer.js
- messaging.js

## God Nodes (most connected - your core abstractions)
1. `NewtonPilot 🚀 — AI-Powered Chrome Extension` - 8 edges
2. `OllamaProvider` - 5 edges
3. `renderQuestion()` - 4 edges
4. `checkTabAndInitialize()` - 4 edges
5. `5. Usage Guide` - 4 edges
6. `action` - 4 edges
7. `default_icon` - 4 edges
8. `icons` - 4 edges
9. `walk()` - 3 edges
10. `7. Known Limitations & Phase 2 Roadmap` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (13 total, 6 thin omitted)

### Community 0 - "NewtonPilot 🚀 — AI-Powered Chrome Extension"
Cohesion: 0.14
Nodes (13): 1. Project Overview & Features, 2. Technology Stack, 3. Extension Directory Structure, 4. How to Load the Unpacked Extension in Chrome, 5. Usage Guide, 6. How to Provide Newton Portal DOM Structure for Selectors Fine-Tuning, 7. Known Limitations & Phase 2 Roadmap, Auto-Monitoring Dynamic Changes (+5 more)

### Community 1 - "manifest.json"
Cohesion: 0.18
Nodes (10): background, service_worker, type, content_scripts, description, host_permissions, manifest_version, name (+2 more)

### Community 2 - "package.json"
Cohesion: 0.22
Nodes (8): author, description, keywords, license, name, scripts, test, version

### Community 3 - "action"
Cohesion: 0.29
Nodes (7): action, default_icon, default_popup, default_title, 128, 16, 48

### Community 4 - "popup.js"
Cohesion: 0.36
Nodes (6): checkTabAndInitialize(), formatTime(), formatTypeName(), renderQuestion(), setStatus(), showLoading()

### Community 5 - "extractor.test.js"
Cohesion: 0.33
Nodes (4): NewtonExtractor, assert, createMockElement(), walk()

### Community 7 - "icons"
Cohesion: 0.50
Nodes (4): icons, 128, 16, 48

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `action` connect `action` to `manifest.json`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `NewtonPilot 🚀 — AI-Powered Chrome Extension` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._