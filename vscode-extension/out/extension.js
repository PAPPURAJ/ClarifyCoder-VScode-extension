"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const panel_1 = require("./panel");
function detectAmbiguities(text) {
    const hints = [];
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
let diagnostics;
let statusBarItem;
let output;
async function analyzeActiveEditor(showPanel = false) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const doc = editor.document;
    const text = doc.getText();
    const cfg = vscode.workspace.getConfiguration('clarifycoder');
    const baseUrl = cfg.get('serviceUrl', 'https://api.clarifycoder.pappuraj.com');
    const maxQuestions = cfg.get('maxQuestions', 3);
    try {
        const resp = await (0, node_fetch_1.default)(`${baseUrl}/v1/analyze_context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, artifact_type: 'code-or-text', mode: 'ide' })
        });
        const data = await resp.json();
        const ambiguities = Array.isArray(data?.ambiguities) ? data.ambiguities.slice(0, maxQuestions) : [];
        const diags = ambiguities.map((a) => {
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
            const items = ambiguities.map((a) => ({ label: `${a.category}: ${a.message}` }));
            const panel = vscode.window.createQuickPick();
            panel.items = items;
            panel.title = 'ClarifyCoder: Suggested Questions';
            panel.onDidHide(() => panel.dispose());
            panel.show();
        }
    }
    catch (e) {
        statusBarItem.text = `$(warning) Clarify: error`;
        output.appendLine(`[analyze:error] ${e.message}`);
    }
}
function activate(context) {
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
            const baseUrl = cfg.get('serviceUrl', 'http://localhost:8000');
            const resp = await (0, node_fetch_1.default)(`${baseUrl}/v1/analyze_context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, artifact_type: 'code-or-text', mode: 'ide' })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data?.ambiguities) && data.ambiguities.length > 0) {
                    ambiguities = data.ambiguities.map((a) => ({ category: a.category, message: a.message }));
                }
            }
        }
        catch (err) {
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
        const current = cfg.get('enableAutoAnalyze', true);
        await cfg.update('enableAutoAnalyze', !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`ClarifyCoder auto analyze ${!current ? 'enabled' : 'disabled'}`);
    });
    const cfg = vscode.workspace.getConfiguration('clarifycoder');
    const enableAuto = cfg.get('enableAutoAnalyze', true);
    if (enableAuto) {
        if (vscode.window.activeTextEditor) {
            analyzeActiveEditor(false);
        }
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => analyzeActiveEditor(false)));
        if (cfg.get('analyzeOnSave', true)) {
            context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => analyzeActiveEditor(false)));
        }
    }
    context.subscriptions.push(disposable, analyzeActiveCmd, toggle, diagnostics, statusBarItem, output);
    const provider = new panel_1.ClarifyViewProvider();
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('clarifycoder.panel', provider));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map