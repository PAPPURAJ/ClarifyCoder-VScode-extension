import * as vscode from 'vscode';
import fetch from 'node-fetch';

export class ClarifyViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'clarifycoder.panel';
  private _view?: vscode.WebviewView;
  private _threadId: string | undefined;
  private _log: { role: string; content: string }[] = [];

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this._getHtml();

    view.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'analyze') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const text = editor.document.getText();
        const cfg = vscode.workspace.getConfiguration('clarifycoder');
        const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
        try {
          const resp = await fetch(`${baseUrl}/v1/analyze_context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, artifact_type: 'code-or-text', mode: 'ide' })
          });
          const data: any = await resp.json();
          view.webview.postMessage({ type: 'results', payload: (data && data.ambiguities) ? data.ambiguities : [] });
        } catch (e: any) {
          view.webview.postMessage({ type: 'error', payload: String(e) });
        }
      } else if (msg.type === 'dialogue') {
        const cfg = vscode.workspace.getConfiguration('clarifycoder');
        const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
        try {
          const body = {
            thread_id: this._threadId,
            turn: { role: 'user', content: msg.content || '' },
            project_id: 'default'
          };
          const resp = await fetch(`${baseUrl}/v1/dialogue`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
          const data: any = await resp.json();
          this._threadId = data?.thread_id || this._threadId;
          const replies = Array.isArray(data?.replies) ? data.replies : [];
          this._log.push({ role: 'user', content: msg.content || '' });
          for (const r of replies) { this._log.push({ role: r.role, content: r.content }); }
          view.webview.postMessage({ type: 'dialogue_result', payload: { thread_id: this._threadId, log: this._log } });
        } catch (e: any) {
          view.webview.postMessage({ type: 'error', payload: String(e) });
        }
      } else if (msg.type === 'generate') {
        const cfg = vscode.workspace.getConfiguration('clarifycoder');
        const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
        try {
          const body = {
            thread_id: this._threadId || 'ad-hoc',
            goal: msg.goal || 'Generate code',
            constraints: msg.constraints || {}
          };
          const resp = await fetch(`${baseUrl}/v1/generate_code`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
          const data: any = await resp.json();
          view.webview.postMessage({ type: 'generate_result', payload: data });
        } catch (e: any) {
          view.webview.postMessage({ type: 'error', payload: String(e) });
        }
      } else if (msg.type === 'insert_code') {
        const editor = vscode.window.activeTextEditor;
        if (editor && typeof msg.code === 'string') {
          await editor.edit(builder => {
            const sel = editor.selection;
            if (!sel.isEmpty) {
              builder.replace(sel, msg.code);
            } else {
              builder.insert(sel.start, msg.code);
            }
          });
        }
      } else if (msg.type === 'summarize') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const text = editor.document.getText();
        const cfg = vscode.workspace.getConfiguration('clarifycoder');
        const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
        try {
          const resp = await fetch(`${baseUrl}/v1/summarize_findings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
          });
          const data: any = await resp.json();
          view.webview.postMessage({ type: 'summarize_result', payload: data });
        } catch (e: any) {
          view.webview.postMessage({ type: 'error', payload: String(e) });
        }
      } else if (msg.type === 'memory_list') {
        const cfg = vscode.workspace.getConfiguration('clarifycoder');
        const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
        try {
          const resp = await fetch(`${baseUrl}/v1/memory?project_id=default`);
          const data: any = await resp.json();
          view.webview.postMessage({ type: 'memory_result', payload: data });
        } catch (e: any) {
          view.webview.postMessage({ type: 'error', payload: String(e) });
        }
      } else if (msg.type === 'memory_upsert') {
        const cfg = vscode.workspace.getConfiguration('clarifycoder');
        const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
        try {
          const resp = await fetch(`${baseUrl}/v1/memory`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: 'default', key: msg.key, value: msg.value })
          });
          const data: any = await resp.json();
          view.webview.postMessage({ type: 'memory_result', payload: data });
        } catch (e: any) {
          view.webview.postMessage({ type: 'error', payload: String(e) });
        }
      }
    });
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: sans-serif; padding: 8px; }
    button { margin-bottom: 8px; }
    .item { padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; margin: 6px 0; }
    .cat { font-weight: bold; }
    .row { display: flex; gap: 8px; margin: 6px 0; }
    textarea, input { width: 100%; }
    #code { white-space: pre; background: #111; color: #e6e6e6; padding: 8px; border-radius: 6px; overflow: auto; }
    #chat { max-height: 35vh; overflow: auto; border: 1px solid #ddd; border-radius: 6px; padding: 8px; background: #fafafa; }
    #logs { max-height: 20vh; overflow: auto; border: 1px solid #ddd; border-radius: 6px; padding: 8px; background: #f5f5f5; }
    .msg { margin: 6px 0; }
    .user { color: #005a9e; }
    .assistant { color: #0a7f00; }
  </style>
</head>
<body>
  <div class="row">
    <button id="analyze">Analyze Active File</button>
    <button id="summarize">Summarize Findings</button>
  </div>
  <div id="out"></div>
  <hr/>
  <div>
    <h3>ClarifyCoder Chat</h3>
    <div id="chat"></div>
    <div class="row"><input id="dlgInput" placeholder="Ask about your code or clarify details"/></div>
    <button id="dlgSend">Send</button>
  </div>
  <hr/>
  <div>
    <h3>Generate Code</h3>
    <div class="row"><input id="genGoal" placeholder="Goal (e.g., create function to parse JSON safely)"/></div>
    <button id="genBtn">Generate</button>
    <button id="insertBtn">Insert into Editor</button>
    <pre id="code"></pre>
  </div>
  <hr/>
  <div>
    <h3>Project Memory</h3>
    <div class="row"><input id="memKey" placeholder="Key"/><input id="memVal" placeholder="Value"/></div>
    <button id="memUpsert">Save</button>
    <button id="memList">Refresh</button>
    <div id="memOut"></div>
  </div>
  <hr/>
  <div>
    <h3>Logs</h3>
    <div id="logs"></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('analyze').addEventListener('click', () => {
      vscode.postMessage({ type: 'analyze' });
      document.getElementById('out').innerHTML = 'Analyzing...';
    });
    document.getElementById('dlgSend').addEventListener('click', () => {
      const v = (document.getElementById('dlgInput').value || '').toString();
      vscode.postMessage({ type: 'dialogue', content: v });
      const el = document.getElementById('chat');
      el.innerHTML += '<div class="msg user">[user] ' + v + '</div>';
    });
    document.getElementById('genBtn').addEventListener('click', () => {
      const goal = (document.getElementById('genGoal').value || '').toString();
      vscode.postMessage({ type: 'generate', goal });
      document.getElementById('code').textContent = 'Generating...';
    });
    document.getElementById('insertBtn').addEventListener('click', () => {
      const code = document.getElementById('code').textContent || '';
      vscode.postMessage({ type: 'insert_code', code });
    });
    document.getElementById('memUpsert').addEventListener('click', () => {
      const key = (document.getElementById('memKey').value || '').toString();
      const value = (document.getElementById('memVal').value || '').toString();
      vscode.postMessage({ type: 'memory_upsert', key, value });
    });
    document.getElementById('memList').addEventListener('click', () => {
      vscode.postMessage({ type: 'memory_list' });
    });
    document.getElementById('summarize').addEventListener('click', () => {
      vscode.postMessage({ type: 'summarize' });
      document.getElementById('out').innerHTML = 'Summarizing...';
    });
    window.addEventListener('message', (event) => {
      const { type, payload } = event.data || {};
      if (type === 'results') {
        const list = (payload || []).map(a => '<div class="item"><div class="cat">' + a.category + '</div><div>' + a.message + '</div></div>').join('');
        document.getElementById('out').innerHTML = list || 'No suggestions.';
        const ts = new Date().toLocaleTimeString();
        document.getElementById('logs').innerHTML += '<div>[' + ts + '] analyze: ' + ((payload || []).length) + ' suggestion(s)</div>';
      } else if (type === 'error') {
        document.getElementById('out').innerHTML = 'Error: ' + payload;
        const ts = new Date().toLocaleTimeString();
        document.getElementById('logs').innerHTML += '<div>[' + ts + '] error: ' + payload + '</div>';
      } else if (type === 'dialogue_result') {
        const log = (payload && payload.log) ? payload.log : [];
        const list = log.map(r => '<div class="msg ' + (r.role === 'user' ? 'user' : 'assistant') + '">[' + r.role + '] ' + r.content + '</div>').join('');
        document.getElementById('chat').innerHTML = list || 'No messages yet.';
        const ts = new Date().toLocaleTimeString();
        document.getElementById('logs').innerHTML += '<div>[' + ts + '] dialogue turn</div>';
      } else if (type === 'generate_result') {
        const code = (payload && payload.code) ? payload.code : '';
        document.getElementById('code').textContent = code;
        const ts = new Date().toLocaleTimeString();
        document.getElementById('logs').innerHTML += '<div>[' + ts + '] code generated</div>';
      } else if (type === 'summarize_result') {
        const items = (payload && payload.summary) ? payload.summary : [];
        const list = items.map(it => '<div class="item"><div class="cat">' + it.category + '</div><div>' + it.message + ' (' + it.count + ')</div></div>').join('');
        document.getElementById('out').innerHTML = list || 'No summary.';
        const ts = new Date().toLocaleTimeString();
        document.getElementById('logs').innerHTML += '<div>[' + ts + '] summarize done</div>';
      } else if (type === 'memory_result') {
        const items = (payload && payload.items) ? payload.items : [];
        const list = items.map(it => '<div class="item"><div class="cat">' + it.key + '</div><div>' + it.value + '</div></div>').join('');
        document.getElementById('memOut').innerHTML = list || 'No memory.';
        const ts = new Date().toLocaleTimeString();
        document.getElementById('logs').innerHTML += '<div>[' + ts + '] memory updated/listed</div>';
      }
    });
  </script>
</body>
</html>`;
  }
}


