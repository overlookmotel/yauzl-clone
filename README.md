[![NPM version](https://img.shields.io/npm/v/yauzl-clone.svg)](https://www.npmjs.com/package/yauzl-clone)
[![Build Status](https://img.shields.io/github/actions/workflow/status/overlookmotel/yauzl-clone/test.yml?branch=master)](https://github.com/overlookmotel/yauzl-clone/actions)
[![Coverage Status](https://img.shields.io/coveralls/overlookmotel/yauzl-clone/master.svg)](https://coveralls.io/r/overlookmotel/yauzl-clone)

# Clone `yauzl` for patching

## Purpose

This module contains tools to help with creating modules that modify [yauzl](https://www.npmjs.com/package/yauzl) unzipping library in some way.

[yauzl-promise](https://www.npmjs.com/package/yauzl-promise) and [yauzl-crc](https://www.npmjs.com/package/yauzl-crc), for example, use this module internally.

When monkey-patching a module, it is good practice to clone the original module first so as not to alter the result of calling `require('yauzl')` somewhere else in your application (perhaps inside a dependency).

This module provides some helper methods for creating cloned versions of [yauzl](https://www.npmjs.com/package/yauzl) for later modification.

## Usage

### `.clone( yauzl [, options ] )`

Options are as follows (defaults shown):

```js
{
  clone: true,
  subclassZipFile: false,
  subclassEntry: false,
  eventsIntercept: false
}
```

#### `clone`

Clones the yauzl object. Equivalent to `Object.assign({}, yauzl)`.

```js
const yauzl = require('yauzl');
const yauzlClone = require('yauzlClone');

const clone = yauzlClone(yauzl);
```

#### `subclassZipFile`

Creates a subclass of `yauzl.ZipFile`. The prototype of `yauzl.ZipFile` can then be altered without affecting the original.

This option also monkey-patches the access methods (`.open()`, `.fromFd()`, `.fromBuffer()`, `.testFromRandomAccessReader()`) to callback with instances of this `ZipFile` subclass.

#### `subclassEntry`

Creates a subclass of `yauzl.Entry` (same idea as `subclassZipFile`).

This option also monkey-patches the access methods in order to intercept emitted 'entry' events and modify the emitted values to instances of the `Entry` subclass. [events-intercept](https://www.npmjs.com/package/events-intercept) module is used internally for event interception.

#### `eventsIntercept`

Adds [events-intercept](https://www.npmjs.com/package/events-intercept) methods to `ZipFile` prototype. This option is automatically set to `true` if `subclassEntry` option is `true`.

### `.patch( yauzl, methodName, wrapper )`

Patches an access method. `wrapper` is called with the original method `original` and should return the replacement method. This API is identical to [shimmer](https://www.npmjs.com/package/shimmer).

```js
const yauzl = require('yauzl');
const yauzlClone = require('yauzlClone');

yauzlClone.patch( yauzl, 'fromRandomAccessReader', function(original) {
  return function(reader, totalSize, options, callback) {
    original(reader, totalSize, options, function(err, zipFile) {
      if (err) return callback(err);
      // Do something to zipFile
      callback(null, zipFile);
    });
  };
});
```

This method also does a couple of other useful things:

##### 1. Arguments passed into the patched method are conformed to standard form

i.e. if no options are provided in the original call, an empty `options` object is created. There is no need to check for whether the 2nd or 3rd argument is the callback.

##### 2. Always 4 arguments passed in to the patched method

`.open()`, `.fromFd()` and `.fromBuffer()` take 3 arguments, `.fromRandomAccessReader()` takes 4.

To allow patching all methods simply using the same wrapper function, the patched method will be called for `.open()`, `.fromFd()` and `.fromBuffer()` with an extra empty argument. `original` should also be called with an extra argument.

```js
yauzlClone.patch( yauzl, 'open', function(original) {
  return function(path, _unused, options, callback) {
    // NB Notice `_unused` argument above
    original(reader, null, options, function(err, zipFile) {
      if (err) return callback(err);
      // Do something to zipFile
      callback(null, zipFile);
    });
  };
});
```

### `.patchAll( yauzl, wrapper )`

Convenience method to patch all 4 access methods at once.

```js
yauzlClone.patchAll( yauzl, wrapper );

// ...is equivalent to:
yauzlClone.patch( yauzl, 'open', wrapper );
yauzlClone.patch( yauzl, 'fromFd', wrapper );
yauzlClone.patch( yauzl, 'fromBuffer', wrapper );
yauzlClone.patch( yauzl, 'fromRandomAccessReader', wrapper );
```

## Versioning

This module follows [semver](https://semver.org/). Breaking changes will only be made in major version updates.

All active NodeJS release lines are supported (v16+ at time of writing). After a release line of NodeJS reaches end of life according to [Node's LTS schedule](https://nodejs.org/en/about/releases/), support for that version of Node may be dropped at any time, and this will not be considered a breaking change. Dropping support for a Node version will be made in a minor version update (e.g. 1.2.0 to 1.3.0). If you are using a Node version which is approaching end of life, pin your dependency of this module to patch updates only using tilde (`~`) e.g. `~1.2.3` to avoid breakages.

## Tests

Use `npm test` to run the tests. Use `npm run cover` to check coverage.

## Changelog

See [changelog.md](https://github.com/overlookmotel/yauzl-clone/blob/master/changelog.md)

## Issues

If you discover a bug, please raise an issue on Github. https://github.com/overlookmotel/yauzl-clone/issues

## Contribution

Pull requests are very welcome. Please:

* ensure all tests pass before submitting PR
* add tests for new features
* document new functionality/API additions in README
* do not add an entry to Changelog (Changelog is created when cutting releases)
