## ClarifyCoder: Bridging to Real-World Developer Workflows

This document proposes a practical, end-to-end path to reduce the gap between ClarifyCoder and real-world developer needs, and outlines concrete extensions to developer-facing environments (IDEs, GitHub issue triage) and to Computing Education. It covers product design, architecture, data/training/evaluation strategy, deployment and safety/telemetry considerations.


### 1) Problem Framing and Goals
- **Gap today**: LLMs often generate code despite ambiguous requirements. ClarifyCoder’s clarify-first behavior is promising but needs tight integration into developer tools and workflows.
- **Goals**:
  - **G1 Clarify-in-context**: Ask targeted questions at the moment and place where ambiguity occurs (editor, PR, issue, assignment).
  - **G2 Minimal friction**: Reduce cognitive and interaction cost; avoid over-asking by prioritizing high-value clarifications.
  - **G3 Measurable impact**: Improve task success rate, reduce rework, and shorten feedback loops.
  - **G4 Safety and privacy**: Respect data boundaries, provide offline/on-prem options, and expose transparent controls.


### 2) Product Extensions Overview
- **VS Code extension**: Clarify-aware assistant that detects ambiguity during code edits, refactors, test-writing, and code review comments.
- **GitHub Issue Triage app**: Clarification bot that comments with missing details and labels issues/PRs, escalating only when high impact.
- **Computing Education**: ClarifyTutor for Jupyter/Notebooks, LMS, and autograders to prompt for specification gaps and formative dialogue.


### 3) Core Design Principles
- **Context-first grounding**: Always bind clarifications to concrete artifacts: selected code, diff hunk, test failure, issue template field.
- **Evidence-based questioning**: Trigger questions only when ambiguity scores exceed thresholds; show why the question is asked.
- **One-tap resolution**: Offer suggestion chips and autofill templates to minimize typing.
- **Human-in-the-loop**: Let users confirm assumptions and lock decisions into context memory for subsequent steps.
- **Quiet by default**: Rate-limit questions; summarize multiple low-severity ambiguities into a single bundle.


### 4) System Architecture

- **Clients**
  - VS Code Extension (TypeScript): inline code actions, sidebar thread, and hover diagnostics for ambiguity hints.
  - GitHub App: webhooks for issues/PRs, status checks, comments, labels, and form fields.
  - Edu Integrations: JupyterLab/VS Code for EDU, LMS LTI tool, autograder plugin.

- **Gateway/API**
  - Clarify Service API (FastAPI/HTTP+WebSocket):
    - /analyze_context: return ambiguity detections and suggested clarifying questions
    - /dialogue: maintain multi-turn clarify-then-code threads
    - /generate_code: code generation after clarifications are resolved
    - /summarize_findings: produce concise ambiguity summaries
    - /telemetry (opt-in): privacy-preserving aggregated metrics
    - Streaming events for real-time hints

- **Engines**
  - Clarify Engine: runs a ClarifyCoder model to identify ambiguities and produce targeted questions.
  - Code Engine: general coding model; composed with Clarify Engine via policy routing (clarify-first; override by user preference).
  - Ranker/Policy: determines when to ask, how many questions, and their priority.

- **Context Providers**
  - Repo context: files, diffs, blame, tests, CI logs
  - IDE context: cursor range, diagnostics, symbols, tests-in-scope
  - Issue/PR context: templates, labels, reproduction steps, CI checks
  - EDU context: assignment rubric, starter code, constraints, common misconceptions

- **Persistence**
  - Conversation state: project-scoped, encrypted at rest
  - Project memory: resolved assumptions, decisions, conventions
  - Config store: thresholds, rate limits, privacy modes

- **Deployment**
  - SaaS multi-tenant and self-hosted (on-prem/Air-gapped). GPU-backed inference service with autoscaling.


### 5) IDE Integration (VS Code)

- **Key user flows**
  - Inline suggestion: When generating a function with incomplete spec, show a subtle hint: “2 potential ambiguities” → click reveals top question(s).
  - Fix-by-clarify: Before auto-fix/refactor, the extension asks: “Target version? Min supported Node? Expected perf?” with chips and defaults.
  - Test-driven: On failing tests, ask clarifying questions about expected behavior or edge cases; propose minimal code or test updates.
  - Code review mode: On diff hunks, flag ambiguous names/specs/comments and offer quick-ask to the author.

- **Minimal UI spec**
  - Status bar indicator (quiet/normal/active)
  - Diagnostics collection “Clarifications” with severity levels
  - Multi-turn chat pinned to file/selection

- **Latency budget**
  - <150ms for lightweight static ambiguity heuristics (local)
  - <1.5s for server-side clarify ranking and question generation (streamed)


### 6) GitHub Issue Triage and PR Assistant

- **Issue intake**
  - On new issues, detect missing fields (repro steps, expected vs actual, environment). Comment with a structured checklist; allow 1-click autofill from CI artifacts.
  - Label with ambiguity categories: environment-missing, version-unknown, undefined-scope, insufficient-logs.

- **PR flow**
  - Run clarify check as a status: if ambiguity score > threshold, fail with actionable comment listing 1–3 questions. Provide templates to resolve.

- **Safety/etiquette**
  - Rate-limit to avoid spam, back off after 1 unanswered prompt, do not re-post.


### 7) Computing Education (ClarifyTutor)

- **Student workflow**
  - While solving an assignment, tutor asks questions tied to rubric constraints and common misconceptions.
  - When students request code, tutor first verifies understanding via short clarifying prompts; then reveals hints or solution skeletons based on policy.

- **Instructor tooling**
  - Rubric compiler: ingest assignment spec and produce a clarification map (expected inputs/outputs, constraints, test scaffolds, edge cases).
  - Analytics: identify frequent ambiguities and iterate on assignment wording.

- **Assessment**
  - Autograder plugin: when tests fail, generate clarifying Qs and allow student to answer to unlock targeted hints.


### 8) Data, Training, and Evaluation Strategy

- **Data**
  - Augment with ambiguity-focused synthetic data (per ClarifyCoder) grounded in real artifacts: diffs, issues, test failures, PR templates.
  - Curate real-world dialogues from IDE telemetry and GitHub bot interactions (opt-in, anonymized, de-identified).
  - EDU: instructor-authored clarification maps; student-tutor dialogues (consented, privacy-preserving).

- **Training**
  - Multi-task objective: clarify-detection, question synthesis, follow-up planning, and post-clarify code generation.
  - Preference optimization (DPO) to favor high-utility, low-friction questions over verbose or redundant ones.
  - Controllability: system prompts and adapters for domain (IDE, GitHub, EDU); small LoRA heads to steer style and verbosity.

- **Evaluation**
  - Offline: ambiguity detection precision/recall; question utility via human rating; code task success on HumanEval/MBPP/real repos with injected ambiguity.
  - Online: A/B in IDE and GitHub—measure task completion time, back-and-forth count, revert rate, and PR cycle time.
  - EDU: learning gains, time-to-correct, rubric coverage, and student satisfaction.


### 9) Inference Policy and Ranking

- **Signals**: lexical indicators, undefined identifiers, inconsistent types, missing preconditions, TODOs, flaky tests, vague issue text.
- **Scoring**: ambiguity score with category and confidence; ask if score × impact > threshold.
- **Bundling**: group related ambiguities; at most 3 questions per burst; escalate only on user request.
- **Memory**: store resolved assumptions and reuse; avoid re-asking.


### 10) Safety, Privacy, and Governance

- **Privacy modes**: local-only (on-device heuristics), redaction (strip secrets/PII), and full context with org consent.
- **Data governance**: do not retain code by default; opt-in for telemetry; secure storage with rotation; per-project keys.
- **Abuse prevention**: never spam comments; respect repo permissions; EDU safeguards against providing full solutions prematurely.


### 11) Deployment Plan

- **Phased rollout**
  - P0: VS Code extension MVP + SaaS API; IDE-only clarify hints and questions.
  - P1: GitHub App for triage and PR checks; org-level controls.
  - P2: EDU tutor integrations; autograder plugin.

- **Infrastructure**
  - GPU inference service (Triton/FastAPI), autoscaling via KEDA; Redis for queues; Postgres for state; object store for logs.
  - Observability: OpenTelemetry traces, red-team dashboards, user-configurable logging levels.

- **On-prem**
  - Helm charts, air-gapped model delivery; admin console for policy and thresholds.


### 12) API Sketch

- POST /v1/analyze_context
  - input: { artifact_type, text, code_span, repo_meta, mode }
  - output: { ambiguities: [ { category, span, message, score } ], suggestions: [questions] }

- POST /v1/dialogue
  - input: { thread_id, turn, artifacts }
  - output: { replies, next_actions, memory_updates }

- POST /v1/generate_code
  - input: { thread_id, goal, constraints }
  - output: { code, rationale, tests }


### 13) Evaluation Plan (Operational)

- Weekly scorecards by integration:
  - IDE: time-to-commit, rework rate, hint acceptance rate
  - GitHub: mean time to first response, fix rate after first clarification
  - EDU: time-to-correct, rubric coverage, hint-to-solution ratio


### 14) Roadmap Risks and Mitigations

- Over-questioning: tune thresholds with DPO and online feedback; add a one-click “Ask less” slider.
- Latency: cache embeddings, partial local inference, streaming; prefetch on idle.
- Privacy concerns: default redaction and local mode; transparent data contracts.
- Adoption: start with high-signal flows (PR checks, failing tests) where value is immediate.


### 15) Success Criteria

- 20–30% reduction in PR cycle time on sampled repos.
- 15–25% increase in first-try task success in IDE coding sessions.
- EDU cohorts show improved correctness on edge cases and reduced hint usage over time.


### Appendix: Implementation Notes

- Reuse ClarifyCoder fine-tuning approach and extend data synthesis to IDE/Issue/EDU artifacts.
- Provide simple SDK clients for JS/TS and Python with streaming support.
- Offer model slots: open models (self-host) and proprietary endpoints (where allowed), selectable per project.
