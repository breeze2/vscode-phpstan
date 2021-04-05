import {
  commands,
  languages,
  workspace,
  window,
  Disposable,
  Diagnostic,
  DiagnosticCollection,
  Range,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  Uri
} from "vscode";
import * as utils from "./utils";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as process from "process";

interface PhpStanOutput {
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
  autoloadFile?: string;
  configuration?: string;
  level?: number | string;
  memoryLimit?: string;
  noProgress?: boolean;
  path?: string;
  binPath?: bool | string;
}

export class PhpStanController {
  private _analyzing: boolean = false;
  private _phpstan: string = "phpstan";
  private _diagnosticCollection: DiagnosticCollection;
  private _disposable: Disposable;
  private _statusBarItem: StatusBarItem;
  private _commandForFile: Disposable;
  private _commandForFolder: Disposable;
  private _config: PhpStanArgs = {};

  public shouldAnalyseFile = utils.debounce(this._shouldAnalyseFile.bind(this), 2000);
  public constructor() {
    const subscriptions: Disposable[] = [];
    workspace.onDidChangeConfiguration(this._initConfig, this, subscriptions);
    workspace.onDidSaveTextDocument(
      this._shouldAnalyseFile,
      this,
      subscriptions
    );
    workspace.onDidOpenTextDocument(
      this._shouldAnalyseFile,
      this,
      subscriptions
    );
    // NOTE: not analyse onDidChangeTextEditorSelection anymore
    // window.onDidChangeTextEditorSelection(
    //   () => this.shouldAnalyseFile(),
    //   this,
    //   subscriptions
    // );
    window.onDidChangeWindowState(
      () => this.shouldAnalyseFile(),
      this,
      subscriptions
    );
    this._disposable = Disposable.from(...subscriptions);
    this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right);
    this._commandForFile = commands.registerCommand(
      "extension.phpstanLintThisFile",
      this._shouldAnalyseFile.bind(this),
    );
    this._commandForFolder = commands.registerCommand(
      "extension.phpstanLintThisFolder",
      (resource: any) => {
        this._shouldAnalyseFolder(resource);
      }
    );
    this._diagnosticCollection = languages.createDiagnosticCollection(
      "phpstan_error"
    );
    this._initConfig();
    this.shouldAnalyseFile();
  }

  public dispose() {
    this._diagnosticCollection.dispose();
    this._commandForFolder.dispose();
    this._commandForFile.dispose();
    this._statusBarItem.dispose();
    this._disposable.dispose();
  }

  private _initConfig() {
    let workspace_config = workspace.getConfiguration();
    this._config.autoloadFile = workspace_config.get(
      "phpstan.autoloadFile",
      undefined
    );
    this._config.configuration = workspace_config.get(
      "phpstan.configuration",
      undefined
    );
    this._config.level = workspace_config.get("phpstan.level", "max");
    this._config.memoryLimit = workspace_config.get(
      "phpstan.memoryLimit",
      "256M"
    );
    this._config.noProgress = workspace_config.get("phpstan.noProgress", true);
    this._config.binPath = workspace_config.get("phpstan.binPath", false);
    this._phpstan = this._config.binPath ? "phpstan" : this._config.binPath;
  }

  private _shouldAnalyseFile(document?: TextDocument) {
    if (!document || !document.fileName) {
      let editor = window.activeTextEditor;
      if (editor) {
        document = editor.document;
      } else {
        return;
      }
    }
    if (document.languageId === "php") {
      this.analyseFile(document.fileName);
    } else {
      this._statusBarItem.hide();
    }
  }

  private _shouldAnalyseFolder(resource: any) {
    if (resource && resource.fsPath) {
      this.analyseFolder(resource.fsPath);
    } else {
      let editor = window.activeTextEditor;
      if (editor) {
        this.analyseFolder(path.dirname(editor.document.fileName));
      } else {
        this._statusBarItem.hide();
      }
    }
  }

  public analyseFile(file: string) {
    this.analyse(file);
  }

  public analyseFolder(dir: string) {
    this.analyse(dir);
  }

  protected setDiagnostics(data: PhpStanOutput) {
    if (data.files) {
      let editor = window.activeTextEditor;
      let document: TextDocument | null = editor ? editor.document : null;
      for (let file in data.files) {
        let output_files = data.files[file];
        let output_messages = output_files.messages;
        let diagnostics: Diagnostic[] = [];
        let uri = Uri.file(file);
        let uri_string = uri.toString();
        this._diagnosticCollection.delete(uri);
        output_messages.forEach(el => {
          let line = (el.line || 1) - 1;
          let range: Range;
          let message = el.message;
          if (document && document.uri.toString() === uri_string) {
            range = new Range(
              line,
              0,
              line,
              document.lineAt(line).range.end.character + 1
            );
            let text = document.getText(range);
            let result = /^(\s*).*(\s*)$/.exec(text);
            if (result) {
              range = new Range(
                line,
                result[1].length,
                line,
                text.length - result[2].length
              );
            } else {
              range = new Range(line, 0, line, 1);
            }
          } else {
            range = new Range(line, 0, line, 1);
          }
          diagnostics.push(new Diagnostic(range, "[phpstan] " + message));
        });
        this._diagnosticCollection.set(uri, diagnostics);
      }
    }
  }

  protected analyse(the_path: string) {
    if (this._analyzing) {
      return null;
    }
    this._analyzing = true;
    this._statusBarItem.text = "[phpstan] analyzing...";
    this._statusBarItem.show();
    let args: PhpStanArgs = { ...this._config };
    let cwd: string = "";
    let stats = fs.statSync(the_path);
    let basedir: string = "";
    if (stats.isFile()) {
      basedir = path.dirname(the_path);
      this._diagnosticCollection.delete(Uri.file(the_path));
    } else if (stats.isDirectory()) {
      basedir = the_path;
    } else {
      return null;
    }
    args.path = the_path;
    if (!args.configuration && !args.autoloadFile) {
      args.configuration = this.upFindConfiguration(basedir);
      if (args.configuration) {
        cwd = path.dirname(args.configuration);
      } else {
        args.autoloadFile = this.upFindAutoLoadFile(basedir);
      }
      if (args.autoloadFile) {
        cwd = path.dirname(args.autoloadFile);
        cwd = path.dirname(cwd);
      }
      if (!cwd && stats.isDirectory()) {
        cwd = this.downFindRealWorkPath(basedir);
      }
    } else {
      cwd = this.getCurrentWorkPath(basedir);
    }

    let phpstan = child_process.spawn(
      this.makeCommandPath(cwd),
      this.makeCommandArgs(args),
      this.setCommandOptions(cwd)
    );
    let result = "";
    let errMsg = "";
    phpstan.stderr.on("data", data => (errMsg += data.toString()));
    phpstan.stdout.on("data", data => (result += data.toString()));
    phpstan.on("exit", code => {
      this._analyzing = false;
      this._statusBarItem.show();

      if (code === 0) {
        // no error
        this._statusBarItem.text = "[phpstan] passed";
      } else if (errMsg) {
        // phpstan failed
        console.error(`[phpstan] failed: ${errMsg}`);
        this._statusBarItem.text = "[phpstan] failed";
        // window.showErrorMessage(errMsg);
      } else if (result) {
        // phpstan error
        console.log(`[phpstan] error: ${result}`);
        const index = result.indexOf('{"totals":');
        if (index > -1) {
          result = result.substring(index);
        }
        const data = JSON.parse(result);
        this.setDiagnostics(data);
        this._statusBarItem.text = "[phpstan] error " + data.totals.file_errors;
      } else {
        this._statusBarItem.text = "[phpstan] unknown";
      }
    });
  }

  protected makeCommandPath(cwd: string) {
    let binDir = "vendor/bin";
    const basename = process.platform === "win32" ? "phpstan.bat" : "phpstan";
    try {
      binDir = child_process.execSync("composer config bin-dir", {cwd}).toString().trim();
    } catch (err) {}
    const binary = path.resolve(cwd, binDir, basename);
    try {
      fs.accessSync(binary, fs.constants.X_OK);
      return binary;
    } catch (err) {
      return this._phpstan;
    }
  }

  protected makeCommandArgs(args: PhpStanArgs) {
    let result: string[] = [];
    result.push("analyse");
    result.push("--error-format=json");
    if (args.level === "config") {
      // set level in config file
    } else if (args.level) {
      result.push("--level=" + args.level);
    } else {
      result.push("--level=max");
    }
    if (args.noProgress) {
      result.push("--no-progress");
    }
    if (args.memoryLimit) {
      result.push("--memory-limit=" + args.memoryLimit);
    }
    if (args.configuration) {
      result.push("--configuration=" + args.configuration);
    }
    if (args.autoloadFile) {
      result.push("--autoload-file=" + args.autoloadFile);
    }
    if (args.path) {
      result.push(args.path);
    }
    return result;
  }

  protected setCommandOptions(cwd: string) {
    let result: { cwd?: string } = {};
    if (cwd) {
      result.cwd = cwd;
    }
    return result;
  }

  protected getCurrentWorkPath(basedir: string) {
    let work_path = "";
    let similarity = 0;
    let folders = workspace.workspaceFolders;
    if (folders) {
      folders.forEach((el, i) => {
        if (
          el.uri.fsPath.length > similarity &&
          basedir.indexOf(el.uri.fsPath) === 0
        ) {
          work_path = el.uri.fsPath;
          similarity = work_path.length;
        }
      });
      return work_path;
    }
    return "";
  }

  protected downFindRealWorkPath(basedir: string) {
    return this.tryFindRealWorkPath(
      basedir,
      ["src", "source", "sources"],
      ["phpstan.neon", "phpstan.neon.dist", "vendor/autoload.php"]
    );
  }

  protected tryFindRealWorkPath(
    basedir: string,
    dirs: string[],
    targets: string[]
  ) {
    let work_path;
    let temp_path;
    for (let i in dirs) {
      work_path = path.join(basedir, dirs[i]);
      if (fs.existsSync(work_path)) {
        for (let j in targets) {
          temp_path = path.join(work_path, targets[j]);
          if (fs.existsSync(temp_path)) {
            return work_path;
          }
        }
      }
    }
    return "";
  }

  protected upFindAutoLoadFile(basedir: string) {
    let basename: string;
    let parentName: string;
    let autoload: string;
    basename = basedir;
    parentName = path.dirname(basename);
    autoload = path.join(basename, "vendor/autoload.php");
    while (1) {
      if (fs.existsSync(autoload)) {
        return autoload;
      } else if (basename === parentName) {
        return "";
      } else {
        basename = parentName;
        parentName = path.dirname(basename);
        autoload = path.join(basename, "vendor/autoload.php");
      }
    }
  }

  protected upFindConfiguration(basedir: string) {
    let basename: string;
    let parentName: string;
    let config1: string;
    let config2: string;
    basename = basedir;
    parentName = path.dirname(basename);
    config1 = path.join(basename, "phpstan.neon");
    config2 = path.join(basename, "phpstan.neon.dist");
    while (1) {
      if (fs.existsSync(config1)) {
        return config1;
      } else if (fs.existsSync(config2)) {
        return config2;
      } else if (basename === parentName) {
        return "";
      } else {
        basename = parentName;
        parentName = path.dirname(basename);
        config1 = path.join(basename, "phpstan.neon");
        config2 = path.join(basename, "phpstan.neon.dist");
      }
    }
  }
}
