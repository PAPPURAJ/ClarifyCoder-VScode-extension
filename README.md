# ClarifyCoder: VS Code Extension Development with API Integration

A comprehensive guide documenting the complete development cycle of the ClarifyCoder VS Code extension, from API design to deployment and extension development.

##  Live Backend API

**Production API Endpoint:** `https://api.clarifycoder.pappuraj.com`

The ClarifyCoder backend is deployed and running on a custom server setup with:
- **Public IP:** Custom Linux server with public domain
- **Docker Container:** FastAPI service running on port 8001
- **Nginx Reverse Proxy:** SSL/HTTPS configuration
- **Auto-restart:** Production-ready with monitoring

## Project Overview

ClarifyCoder is a clarification-first development assistant that helps developers identify ambiguities in their code and requirements. This project demonstrates the full cycle of:

1. **Backend API Development** - FastAPI service with Docker deployment
2. **VS Code Extension Development** - TypeScript extension with webview integration
3. **API Integration** - Real-time communication between extension and backend
4. **Deployment** - Production-ready setup with custom server configuration



## Development Cycle

### Phase 1: Backend API Development

#### 1.1 FastAPI Service Setup

**Technology Stack:**
- Python 3.10
- FastAPI framework
- Pydantic for data validation
- Uvicorn ASGI server

**Core API Endpoints:**

```python
# Health Check
GET /health
Response: {"status": "ok", "version": "0.0.1"}

# Context Analysis
POST /v1/analyze_context
Request: {"text": "string"}
Response: {"ambiguities": [{"category": "string", "message": "string"}]}

# Multi-turn Dialogue
POST /v1/dialogue
Request: {"thread_id": "string", "turn": {"role": "string", "content": "string"}}
Response: {"response": "string", "questions": ["string"]}

# Code Generation
POST /v1/generate_code
Request: {"goal": "string", "context": "string"}
Response: {"code": "string", "rationale": "string", "tests": "string"}

# Project Memory Management
GET /v1/memory/{project_id}
POST /v1/memory/{project_id}
Request: {"key": "string", "value": "string"}

# Findings Summary
POST /v1/summarize_findings
Request: {"project_id": "string"}
Response: {"summary": "string"}
```

#### 1.2 Docker Containerization

**Dockerfile:**
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  clarify-service:
    build: .
    ports:
      - "8001:8001"
    restart: unless-stopped
```

#### 1.3 Production Deployment Configuration

**Custom Server Setup:**
- **Server Type:** Custom Linux server with public IP
- **Containerization:** Docker and Docker Compose installed
- **Reverse Proxy:** Nginx configuration for SSL/HTTPS
- **Domain:** `api.clarifycoder.pappuraj.com`
- **Port Mapping:** Internal port 8001 exposed to public domain
- **Auto-restart:** Production-ready with `restart: unless-stopped`

**Production Deployment Commands:**
```bash
# Build and deploy to production server
docker-compose up -d --build

# Health check - verify API is running
curl https://api.clarifycoder.pappuraj.com/health

# Monitor logs
docker-compose logs -f clarify-service
```

**Production API Endpoints:**
- Health Check: `GET https://api.clarifycoder.pappuraj.com/health`
- Context Analysis: `POST https://api.clarifycoder.pappuraj.com/v1/analyze_context`
- Dialogue: `POST https://api.clarifycoder.pappuraj.com/v1/dialogue`
- Code Generation: `POST https://api.clarifycoder.pappuraj.com/v1/generate_code`
- Memory Management: `GET/POST https://api.clarifycoder.pappuraj.com/v1/memory/{project_id}`
- Summarize Findings: `POST https://api.clarifycoder.pappuraj.com/v1/summarize_findings`

### Phase 2: VS Code Extension Development

#### 2.1 Extension Structure

```
vscode-extension/
├── package.json          # Extension manifest
├── src/
│   ├── extension.ts      # Main extension logic
│   └── panel.ts         # Webview panel implementation
├── media/
│   └── icon.svg         # Extension icon
└── out/                 # Compiled JavaScript
```

#### 2.2 Extension Manifest (package.json)

**Key Configurations:**
```json
{
  "name": "clarifycoder-vscode",
  "displayName": "ClarifyCoder",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:clarifycoder.analyzeSelection",
    "onView:clarifycoder.panel"
  ],
  "contributes": {
    "commands": [
      {
        "command": "clarifycoder.analyzeSelection",
        "title": "ClarifyCoder: Analyze Selection"
      }
    ],
    "webviewViews": [
      {
        "id": "clarifycoder.panel",
        "name": "ClarifyCoder Chat"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "clarifycoder.analyzeSelection",
          "when": "editorHasSelection"
        }
      ]
    }
  }
}
```

#### 2.3 Core Extension Logic (extension.ts)

**Key Features Implemented:**

1. **API Integration:**
```typescript
const serviceUrl = vscode.workspace.getConfiguration('clarifycoder').get('serviceUrl', 'https://api.clarifycoder.pappuraj.com');

async function callAPI(endpoint: string, data: any) {
  const response = await fetch(`${serviceUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}
```

2. **Diagnostics Integration:**
```typescript
// Show ambiguities as problems in VS Code
const diagnostics = vscode.languages.createDiagnosticCollection('clarifycoder');
diagnostics.set(editor.document.uri, diagnosticArray);
```

3. **Status Bar Integration:**
```typescript
// Display ambiguity count in status bar
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
statusBarItem.text = `$(question) ${ambiguities.length} ambiguities`;
statusBarItem.show();
```

4. **Auto-Analysis:**
```typescript
// Analyze on file open/save
vscode.workspace.onDidOpenTextDocument(analyzeDocument);
vscode.workspace.onDidSaveTextDocument(analyzeDocument);
```

#### 2.4 Webview Panel Implementation (panel.ts)

**Interactive GUI Features:**

1. **HTML/CSS/JavaScript Integration:**
```typescript
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); }
    #chat { max-height: 35vh; overflow: auto; }
    #logs { max-height: 20vh; overflow: auto; }
  </style>
</head>
<body>
  <div id="app">
    <button id="analyzeBtn">Analyze Active File</button>
    <div id="chat"></div>
    <div id="logs"></div>
  </div>
  <script>
    // Webview communication logic
  </script>
</body>
</html>`;
```

2. **Message Handling:**
```typescript
webviewView.webview.onDidReceiveMessage(async (message) => {
  switch (message.command) {
    case 'analyze':
      const result = await callAPI('/v1/analyze_context', { text: message.text });
      webviewView.webview.postMessage({ command: 'analysisResult', data: result });
      break;
    case 'dialogue':
      const response = await callAPI('/v1/dialogue', { thread_id: message.threadId, turn: message.turn });
      webviewView.webview.postMessage({ command: 'dialogueResponse', data: response });
      break;
  }
});
```

### Phase 3: API Integration Patterns

#### 3.1 Error Handling

```typescript
try {
  const response = await fetch(apiUrl, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return await response.json();
} catch (error) {
  vscode.window.showErrorMessage(`ClarifyCoder API Error: ${error.message}`);
  return null;
}
```

#### 3.2 Configuration Management

```typescript
// User-configurable settings - Production API endpoint
const config = vscode.workspace.getConfiguration('clarifycoder');
const serviceUrl = config.get('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
const enableAutoAnalyze = config.get('enableAutoAnalyze', true);
const maxQuestions = config.get('maxQuestions', 3);
```

**Default Production Configuration:**
- **Service URL:** `https://api.clarifycoder.pappuraj.com` (Production endpoint)
- **Auto Analysis:** Enabled by default
- **Max Questions:** 3 per analysis
- **Analyze on Save:** Enabled for real-time feedback

#### 3.3 State Management

```typescript
// Persistent conversation threads
const conversations = new Map<string, any[]>();

// Project memory storage
const projectMemory = new Map<string, Map<string, any>>();
```

### Phase 4: Development Workflow

#### 4.1 Local Development

```bash
# Backend development
cd clarify-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000

# Extension development
cd vscode-extension
npm install
npm run compile
F5 # Launch Extension Development Host
```

#### 4.2 Testing Strategy

1. **API Testing:**
   - Postman collection for endpoint validation
   - Unit tests for individual functions
   - Integration tests for full workflows

2. **Extension Testing:**
   - Manual testing in Extension Development Host
   - User scenario testing
   - Cross-platform compatibility

#### 4.3 Packaging and Distribution

```bash
# Build VSIX package
cd vscode-extension
npm run compile
npx @vscode/vsce package --out clarifycoder-vscode-final.vsix

# Install extension
code --install-extension clarifycoder-vscode-final.vsix
```

### Phase 5: Production Deployment

#### 5.1 Server Configuration

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl;
    server_name api.clarifycoder.pappuraj.com;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Docker Deployment:**
```bash
# Production deployment
docker-compose up -d --build
docker-compose logs -f clarify-service
```

#### 5.2 Monitoring and Maintenance

- Health check endpoint: `/health`
- Log monitoring with Docker logs
- Automatic restart with `restart: unless-stopped`
- SSL certificate management

## Key Technical Achievements

### 1. Real-time API Integration
- Seamless communication between VS Code extension and FastAPI backend
- Error handling and fallback mechanisms
- Configuration management for different environments

### 2. User Experience Design
- Intuitive sidebar panel with chat-like interface
- Context-aware analysis with diagnostics integration
- Auto-analysis on file operations
- Visual feedback through status bar and notifications

### 3. Production Deployment
- Docker containerization for consistent deployment
- Custom server setup with public domain
- SSL/HTTPS configuration for secure communication
- Auto-restart and monitoring capabilities

### 4. Extensibility
- Modular architecture for easy feature additions
- Configuration-driven behavior
- Plugin-like command system
- Webview-based GUI for non-technical users

## Screenshots

![ClarifyCoder Extension - Sidebar Panel](PIctures/Screenshot%20from%202025-09-17%2014-39-39.png)
*Main ClarifyCoder sidebar showing Analyze, Chat, Generate Code, Memory, and Logs sections*

![ClarifyCoder Extension - Analysis Results](PIctures/Screenshot%20from%202025-09-17%2016-16-20.png)
*Analysis results showing ambiguity suggestions and diagnostics*

![ClarifyCoder Extension - Chat Interface](PIctures/Screenshot%20from%202025-09-17%2016-18-32.png)
*Interactive chat for clarification questions and responses*

![ClarifyCoder Extension - Code Generation](PIctures/Screenshot%20from%202025-09-17%2016-20-54.png)
*Code generation with context and insert functionality*

## Installation and Usage

### For End Users

1. **Install Extension:**
   ```bash
   code --install-extension clarifycoder-vscode-final.vsix
   ```

2. **Configure API Endpoint:**
   - Open VS Code Settings
   - Search for "ClarifyCoder"
   - Set `Service URL` to your API endpoint

3. **Use Extension:**
   - Click ClarifyCoder icon in Activity Bar
   - Use "Analyze Active File" for automatic analysis
   - Right-click selected text for context analysis
   - Use chat interface for clarification questions

### For Developers

1. **Clone Repository:**
   ```bash
   git clone <repository-url>
   cd ClarifyCoder
   ```

2. **Setup Backend:**
   ```bash
   cd clarify-service
   docker-compose up -d
   ```

3. **Develop Extension:**
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   F5 # Launch Extension Development Host
   ```

##  Production Deployment Summary

**Live Production System:**
- **Backend API:** `https://api.clarifycoder.pappuraj.com` (Custom server deployment)
- **VS Code Extension:** Available as VSIX package with production API integration
- **Infrastructure:** Custom Linux server with Docker, Nginx, and SSL
- **Monitoring:** Auto-restart and health check endpoints
- **Security:** HTTPS/SSL encryption for all API communications

## Conclusion

This project demonstrates a complete development cycle from API design to production deployment, showcasing:

- **Backend Development:** FastAPI with Docker containerization
- **Frontend Development:** VS Code extension with TypeScript
- **Integration:** Real-time API communication with production endpoint
- **Deployment:** Production-ready custom server configuration
- **User Experience:** Intuitive GUI for non-technical users

The ClarifyCoder extension successfully bridges the gap between research concepts and practical developer tools, providing a real-world implementation of clarification-first development assistance with a fully functional production backend at `https://api.clarifycoder.pappuraj.com`.