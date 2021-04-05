[![GitHub Release](https://img.shields.io/github/release/breeze2/vscode-phpstan)](https://github.com/breeze2/vscode-phpstan/releases)
[![Build Status](https://travis-ci.org/breeze2/vscode-phpstan.svg?branch=master)](https://travis-ci.org/breeze2/vscode-phpstan)

# VSCode PhpStan README

A vscode extension for [phpstan](https://github.com/phpstan/phpstan).

Github link: [https://github.com/breeze2/vscode-phpstan](https://github.com/breeze2/vscode-phpstan)

## Features

auto lint your php code, or use the command:

* `PhpStan: Lint this file`
* `PhpStan: Lint this folder`

## Requirements

* php >= 7.1
* phpstan >= 0.11

### Install phpstan

```bash
composer global require phpstan/phpstan
```

## Extension Settings

For example:

This extension contributes the following settings:

* `phpstan.level`: rule levels 0-7, default max
* `phpstan.noProgress`: no progress output, default true
* `phpstan.memoryLimit`: memory limit, default 512M
* `phpstan.configuration`: path of configuration
* `phpstan.autoloadFile`: path of autoload file
* `phpstan.binPath`: path to the phpstan executable, default phpstan

## Known Issues

* May need more memory when linting too many files

## Release Notes

### 1.1.0
* Adapt to PhpStan 0.11, use `--error-format` instead of `--errorFormat`

### 1.0.6
* Auto find the local phpstan

### 1.0.5
* Fix phpstan stderr handler
* Add phpstan error handler
* Fix editor change hanler

### 1.0.1
* Support Windows

### 1.0.0
* Initial release of vscode-phpstan

