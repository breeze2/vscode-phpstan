# VSCode PhpStan README

A vscode extension for [phpstan](https://github.com/phpstan/phpstan).
Github: [https://github.com/breeze2/vscode-phpstan](https://github.com/breeze2/vscode-phpstan)

## Features

auto lint your php code, or use the command:

* `PhpStan: Lint this file`
* `PhpStan: Lint this folder`

## Requirements

* php >= 7.1
* phpstan >= 0.10

### Install phpstan

```bash
composer global require phpstan/phpstan
```

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issues

* May need more memory when linting too many files

## Release Notes

### 1.0.0

Initial release of vscode-phpstan

-----------------------------------------------------------------------------------------------------------

**Enjoy!**
