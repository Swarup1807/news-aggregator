# Copilot instructions for this repository

This repository currently has no detected source files or existing AI guidance files. These instructions give an immediate, pragmatic workflow for an AI coding agent to become productive while the project is developed.

Keep this file concise: 20-50 lines of actionable guidance.

## Quick discovery steps (what to run first)
- Look for top-level manifests: `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`.
- Search for common entry points: `src/`, `app/`, `main.py`, `server.js`, `index.tsx`, `cmd/`.
- If no code is present, open `README.md` at project root for goals and architecture notes.

## Big-picture guidance for AI agents
- If no code is present yet, ask the user what language/framework to scaffold. Offer templates (Node/Express, Python/FastAPI, React + Vite) and include minimal commands to bootstrap.
- When files exist, prefer reading `README.md` and the build manifest (example: `package.json` scripts) before editing.

## Project-specific patterns (discoverable examples)
- No patterns detected. Use the discovery steps above; when you find `src/` or `app/` inspect the following files for conventions:
  - `src/index.(js|ts|py|go)` — application entry
  - `src/routes/` or `api/` — HTTP endpoints
  - `src/services/` or `lib/` — domain logic
  - `tests/` or `__tests__/` — testing layout

## Build and test hints
- If `package.json` exists, run `npm ci` then `npm test` or inspect `scripts`.
- If Python detected, create a venv and run `pip install -r requirements.txt` then `pytest`.
- If no build system is found, prompt the user for the intended runtime.

## Pull request and commit guidance
- Keep changes minimal and focused per PR. Add tests when you add behavior. Use existing test runner (if found).

## When to ask the user
- If the codebase is empty or ambiguous about the main language/framework, ask: "Which language/framework should I use to scaffold?"
- If you need credentials, API keys, or access tokens, request them explicitly and do not attempt to guess or fetch them.

---

If you'd like, I can now try to auto-detect languages or scaffold a minimal project (Node/Python/Go/React) — tell me which you'd prefer or provide the existing code to analyze.