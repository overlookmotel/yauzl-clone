# Changelog

## 2.0.0

Breaking changes:

* Drop support for NodeJS < v16

Refactor:

* Add entry point in package root

No code:

* Reformat JSDoc comments

Tests:

* Run tests with Jest

Docs:

* Reformat docs + tweaks
* Add section on versioning
* Remove old badges from README
* Reverse order of changelog
* Update license year
* Remove license indentation

Dev:

* Replace JSHint with ESLint
* Use Github Actions for CI
* Update dev dependencies
* Add `package-lock.json`
* Replace `.npmignore` with `files` key in `package.json`
* Update editorconfig
* `.gitattributes` file
* Re-order `.gitignore`

## 1.0.4

* Run Travis CI tests on Node v10
* Update dev dependencies

## 1.0.3

* `.clone()` with `subclassZipFile` option forward all events to subclass instance
* Fix: Changelog
* Fix: README typo
* README formatting

## 1.0.2

* Fix: `.clone()` with `subclassZipFile` option breaks `lazyEntries: false` (closes #1)
* Remove unnecessary instanceof checks in patchers

## 1.0.1

* Fix: `.patch` method maintain `this` context in method calls
* README update
* README typo

## 1.0.0

* Initial release
