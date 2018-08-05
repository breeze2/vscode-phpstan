import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface PhpStanOuput {
  totals: {
    errors: number;
    files: number;
  };
  files: {
    [propName: string]: {
      error: number;
      messages: {
        message: string;
        line: number | null;
        ignorable: boolean;
      }[];
    };
  };
  errors: any;
}

interface PhpStanArgs {
  autoload_file?: string;
  configuration?: string;
  level?: number|string;
  memory_limit?: string;
  no_progress?: boolean;
  path?: string;
}

export class PhpStanController {
  static is_analysing: boolean = false;
  protected _phpstan: string = 'phpstan';
  protected _diagnosticCollection: vscode.DiagnosticCollection;
  protected _worksapce: string = '';

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
            let line = el.line - 1;
            let range:vscode.Range;
            let message = el.message;
            if (document && document.uri.toString() === file_uri) {
              range = new vscode.Range(line, 0, line, document.lineAt(line).range.end.character + 1);
              let text = document.getText(range);
              let result = /^(\s*).*(\s*)$/.exec(text);
              if(result) {
                range = new vscode.Range(line, result[1].length, line, text.length-result[2].length);
              } else {
                range = new vscode.Range(line, 0, line, 1);
              }
            } else {
              range = new vscode.Range(line, 0, line, 1);
            }
            diagnostics.push(new vscode.Diagnostic(range, message));
          }
        });
        this._diagnosticCollection.set(uri, diagnostics);
      }
    }
  }

  protected analyse(the_path: string) {
    let args:PhpStanArgs = {path: the_path};
    let cwd: string = '';
    let options:{cwd?: string} = {};
    args.configuration = this.upFindConfiguration(the_path);
    if (args.configuration) {
      cwd = path.dirname(args.configuration);
    } else {
      args.autoload_file = this.upFindAutoLoadFile(the_path);
    }
    if(args.autoload_file) {
      cwd = path.dirname(args.autoload_file);
      cwd = path.dirname(cwd);
    }
    if(cwd) {
      options.cwd = cwd;
    }
    let that = this;
    let phpstan = child_process.spawn(this._phpstan, this.makeCommandArgs(args), options);
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

  protected makeCommandArgs(args: PhpStanArgs) {
    let result: string[] = [];
    result.push('analyse');
    result.push('--errorFormat=json');
    result.push('--level=max');
    if (args.level) {
      result.push('--level=' + args.level);
    }
    if (args.no_progress) {
      result.push('--no-progress');
    }
    if(args.memory_limit) {
      result.push('--memory-limit=' + args.memory_limit);
    }
    if(args.configuration) {
      result.push('--configuration=' + args.configuration);
    }
    if (args.autoload_file) {
      result.push('--autoload-file=' + args.autoload_file);
    }
    if (args.path) {
      result.push(args.path);
    }
    console.log(result);
    return result;
  }

  protected setCommandOptions(){

  }

  protected upFindAutoLoadFile(basedir: string) {
    let basename: string;
    let parentname: string;
    let autoload: string;
    basename = basedir;
    parentname = path.dirname(basename);
    autoload = path.join(basename, 'vendor/autoload.php');
    while (1) {
      if (fs.existsSync(autoload)) {
        return autoload;
      } else if (basename === parentname) {
        return '';
      } else {
        basename = parentname;
        parentname = path.dirname(basename);
        autoload = path.join(basename, 'vendor/autoload.php');
      }
    }
  }

  protected upFindConfiguration(basedir: string) {
    let basename: string;
    let parentname:string;
    let config1: string;
    let config2: string;
    basename = basedir;
    parentname = path.dirname(basename);
    config1 = path.join(basename, 'phpstan.neon');
    config2 = path.join(basename, 'phpstan.neon.dist');
    while(1) {
      if(fs.existsSync(config1)) {
        return config1;
      } else if(fs.existsSync(config2)) {
        return config2;
      } else if(basename === parentname) {
        return '';
      } else {
        basename = parentname;
        parentname = path.dirname(basename);
        config1 = path.join(basename, 'phpstan.neon');
        config2 = path.join(basename, 'phpstan.neon.dist');
      }
    }
  }
}