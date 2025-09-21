# ClarifyCoder VS Code Extension

Clarification-first assistant that surfaces questions for ambiguous requirements directly in your code, powered by your deployed API.

## Features
- Sidebar (Activity Bar) view: ClarifyCoder Chat
- Buttons: Analyze Active File, Summarize Findings
- Dialogue chat with persistent log
- Generate Code with "Insert into Editor"
- Project Memory (save/list)
- Diagnostics list with hints and status bar count

## Screenshots

![ClarifyCoder Sidebar Panel](PIctures/Screenshot%20from%202025-09-17%2014-39-39.png)

![Analyze Active File](PIctures/Screenshot%20from%202025-09-17%2016-16-20.png)

![Dialogue Chat Interface](PIctures/Screenshot%20from%202025-09-17%2016-18-32.png)

![Generate Code Feature](PIctures/Screenshot%20from%202025-09-17%2016-20-54.png)

## Open the sidebar panel
- Click the ClarifyCoder icon in the Activity Bar (left sidebar).
- Use Analyze, Dialogue, Generate Code, and Project Memory. Logs appear at the bottom of the panel.

## Right-click / editor actions
- Select text → Right-click → "ClarifyCoder: Analyze Selection"
- Editor title → "ClarifyCoder: Analyze Active File"

## Settings
- `clarifycoder.serviceUrl`: defaults to `https://api.clarifycoder.pappuraj.com`
- `clarifycoder.enableAutoAnalyze`: default `true`
- `clarifycoder.analyzeOnSave`: default `true`
- `clarifycoder.maxQuestions`: default `3`
