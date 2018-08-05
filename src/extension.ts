'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PhpStanController } from './controller';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let phpstan = new PhpStanController();
    let disposable = vscode.commands.registerCommand('extension.phpstanLintThisFile', () => {
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            let file = editor.document.fileName;
            phpstan.analyseFile(file);
        }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}