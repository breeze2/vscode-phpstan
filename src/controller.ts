import * as child_process from 'child_process';
import * as vscode from 'vscode';
// import { basename } from 'path';

interface PhpStanOuput {
  totals: {
    errors: number;
    files: number;
  };
  files: {
    [propName: string]: {
      error: number;
      messages: PhpStanOutputFileMessage[];
    };
  };
  errors: any;
}

interface PhpStanOutputFileMessage {
  message: string;
  line: number|null;
  ignorable: boolean;
}

export class PhpStanController {
  static is_analysing: boolean = false;
  protected _phpstan: string = 'phpstan';
  protected _diagnosticCollection: vscode.DiagnosticCollection;

  public constructor() {
    this._diagnosticCollection = vscode.languages.createDiagnosticCollection("error");
  }

  public analyseFile(file: string) {
    this.analyse(file);
  }

  public analyseDir(dir: string) {

  }

  protected setDiagnostics(data: PhpStanOuput) {
    if(data.files) {
      let editor = vscode.window.activeTextEditor;
      let document:vscode.TextDocument|null = editor ? editor.document : null;
      for (let file in data.files) {
        let output_files = data.files[file];
        let output_messages = output_files.messages;
        let diagnostics: vscode.Diagnostic[] = [];
        let file_uri = vscode.Uri.file(file).toString();
        let uri = vscode.Uri.parse(file_uri);
        output_messages.forEach(el => {
          if (el.line) {
            let range:vscode.Range;
            let message = el.message;
            if (document && document.uri.toString() === file_uri) {
              range = new vscode.Range(el.line - 1, 0, el.line - 1, document.lineAt(el.line - 1).range.end.character + 1);
              let text = document.getText(range);
              let result = /^(\s*).*(\s*)$/.exec(text);
              if(result) {
                range = new vscode.Range(el.line - 1, result[1].length, el.line-1, text.length-result[2].length);
              } else {
                range = new vscode.Range(el.line-1, 0, el.line-1, 1);
              }
            } else {
              range = new vscode.Range(el.line - 1, 0, el.line - 1, 1);
            }
            diagnostics.push(new vscode.Diagnostic(range, message));
          }
        });
        this._diagnosticCollection.set(uri, diagnostics);
      }
    }
  }

  protected analyse(file: string) {
    let args = [];
    let options: {cwd?: string} = {};
    let that = this;
    args.push('analyse');
    args.push('--level=max');
    args.push('--errorFormat=json');
    args.push(file);
    options.cwd = '/Users/Breeze/Workspace/Laravel/lumen5.6';
    let phpstan = child_process.spawn(this._phpstan, args, options);
    let result = '';
    phpstan.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
    phpstan.stdout.on('data', (data) => {
      if(data instanceof Buffer) {
        data = data.toString('utf8');
      }
      result += data;
    });
    phpstan.on('exit', (code) => {
      let data = JSON.parse(result);
      that.setDiagnostics(data);
    });
  }

  protected findAutoLoadFile(file: string) {

  }

  protected findConfigFile(file: string) {

  }

}