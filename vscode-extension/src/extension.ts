import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { ClarifyViewProvider } from './panel';

type Ambiguity = {
  category: string;
  message: string;
  range?: vscode.Range;
};

function detectAmbiguities(text: string): Ambiguity[] {
  const hints: Ambiguity[] = [];
  const lower = text.toLowerCase();

  const vagueWords = [
    'quick', 'fast', 'soon', 'later', 'optimize', 'clean up', 'handle', 'support',
    'should', 'maybe', 'probably', 'etc', 'tbd', 'todo', 'edge case', 'some', 'many'
  ];
  for (const w of vagueWords) {
    if (lower.includes(w)) {
      hints.push({ category: 'vagueness', message: `Vague term detected: "${w}". What is the precise expectation?` });
    }
  }

  if (/\b(min|max|limit|timeout|retries)\b/i.test(text) && !/\b\d+\b/.test(text)) {
    hints.push({ category: 'unspecified-constraint', message: 'Constraint mentioned without a concrete value. What value should be used?' });
  }

  if (/\bperformance|latency|throughput|memory\b/i.test(text) && !/\bms|s|mb|gb|rps\b/i.test(text)) {
    hints.push({ category: 'non-functional', message: 'Non-functional requirement without units. Provide target and units (e.g., 200ms).' });
  }

  if (/\bcompatible|support\b/i.test(text) && /\bnode|python|java|browser\b/i.test(text) && !/\b\d+\.?\d*\b/.test(text)) {
    hints.push({ category: 'compatibility', message: 'Compatibility mentioned without versions. Which versions must be supported?' });
  }

  if (/\berror|exception|fail\b/i.test(text) && !/\bretry|fallback|log|return|throw\b/i.test(text)) {
    hints.push({ category: 'error-handling', message: 'Error scenario mentioned without behavior. What should happen on failure?' });
  }

  if (hints.length === 0) {
    hints.push({ category: 'none', message: 'No obvious ambiguities detected. Proceed or request specific details if needed.' });
  }

  return hints;
}

let diagnostics: vscode.DiagnosticCollection | undefined;
let statusBarItem: vscode.StatusBarItem;
let output: vscode.OutputChannel;

async function analyzeActiveEditor(showPanel: boolean = false) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { return; }
  const doc = editor.document;
  const text = doc.getText();
  const cfg = vscode.workspace.getConfiguration('clarifycoder');
  const baseUrl = cfg.get<string>('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
  const maxQuestions = cfg.get<number>('maxQuestions', 3);
  try {
    const resp = await fetch(`${baseUrl}/v1/analyze_context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, artifact_type: 'code-or-text', mode: 'ide' })
    });
    const data: any = await resp.json();
    const ambiguities = Array.isArray(data?.ambiguities) ? data.ambiguities.slice(0, maxQuestions) : [];
    const diags: vscode.Diagnostic[] = ambiguities.map((a: any) => {
      const range = new vscode.Range(0, 0, 0, 0);
      const d = new vscode.Diagnostic(range, `${a.category}: ${a.message}`, vscode.DiagnosticSeverity.Hint);
      d.source = 'ClarifyCoder';
      return d;
    });
    diagnostics = diagnostics || vscode.languages.createDiagnosticCollection('clarifycoder');
    diagnostics.set(doc.uri, diags);
    statusBarItem.text = `$(question) Clarify: ${diags.length}`;
    statusBarItem.tooltip = 'ClarifyCoder suggestions';
    statusBarItem.show();
    output.appendLine(`[analyze] ${doc.uri.fsPath}: ${diags.length} suggestion(s)`);
    if (showPanel && diags.length > 0) {
      const items = ambiguities.map((a: any) => ({ label: `${a.category}: ${a.message}` }));
      const panel = vscode.window.createQuickPick();
      panel.items = items;
      panel.title = 'ClarifyCoder: Suggested Questions';
      panel.onDidHide(() => panel.dispose());
      panel.show();
    }
  } catch (e) {
    statusBarItem.text = `$(warning) Clarify: error`;
    output.appendLine(`[analyze:error] ${(e as Error).message}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  diagnostics = vscode.languages.createDiagnosticCollection('clarifycoder');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'clarifycoder.toggleAutoAnalyze';
  output = vscode.window.createOutputChannel('ClarifyCoder');

  const disposable = vscode.commands.registerCommand('clarifycoder.analyzeSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open a file to analyze a selection.');
      return;
    }
    const selection = editor.selection;
    const text = editor.document.getText(selection.isEmpty ? new vscode.Range(0, 0, editor.document.lineCount, 0) : selection);

    let ambiguities = detectAmbiguities(text);

    try {
      const cfg = vscode.workspace.getConfiguration('clarifycoder');
      const baseUrl = cfg.get<string>('serviceUrl', 'http://localhost:8000');
      const resp = await fetch(`${baseUrl}/v1/analyze_context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, artifact_type: 'code-or-text', mode: 'ide' })
      });
      if (resp.ok) {
        const data: any = await resp.json();
        if (Array.isArray(data?.ambiguities) && data.ambiguities.length > 0) {
          ambiguities = data.ambiguities.map((a: any) => ({ category: a.category, message: a.message }));
        }
      }
    } catch (err) {
    }
    const items = ambiguities.map(a => ({ label: `${a.category}: ${a.message}` }));

    const panel = vscode.window.createQuickPick();
    panel.items = items;
    panel.matchOnDescription = true;
    panel.matchOnDetail = true;
    panel.title = 'ClarifyCoder: Suggested Questions';
    panel.onDidHide(() => panel.dispose());
    panel.show();
  });

  const analyzeActiveCmd = vscode.commands.registerCommand('clarifycoder.analyzeActiveFile', async () => {
    await analyzeActiveEditor(true);
  });

  const toggle = vscode.commands.registerCommand('clarifycoder.toggleAutoAnalyze', async () => {
    const cfg = vscode.workspace.getConfiguration('clarifycoder');
    const current = cfg.get<boolean>('enableAutoAnalyze', true);
    await cfg.update('enableAutoAnalyze', !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`ClarifyCoder auto analyze ${!current ? 'enabled' : 'disabled'}`);
  });

  const cfg = vscode.workspace.getConfiguration('clarifycoder');
  const enableAuto = cfg.get<boolean>('enableAutoAnalyze', true);
  if (enableAuto) {
    if (vscode.window.activeTextEditor) {
      analyzeActiveEditor(false);
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => analyzeActiveEditor(false)));
    if (cfg.get<boolean>('analyzeOnSave', true)) {
      context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => analyzeActiveEditor(false)));
    }
  }

  context.subscriptions.push(disposable, analyzeActiveCmd, toggle, diagnostics, statusBarItem, output);

  const provider = new ClarifyViewProvider();
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('clarifycoder.panel', provider));
}

export function deactivate() {}


