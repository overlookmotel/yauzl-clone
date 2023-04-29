/* --------------------
 * yauzl-clone module
 * Clone yauzl module so it can be modified without affecting original
 * ------------------*/

'use strict';

// Modules
const util = require('util'),
	eventsIntercept = require('events-intercept');

// Exports

module.exports = {
	clone,
	patch,
	patchAll
};

/**
 * Clone `yauzl` object and optionally subclass `yauzl.ZipFile` + `yauzl.Entry`.
 *
 * If ZipFile is subclassed, all access methods (`.open()`, `.fromFd()` etc) are
 * patched to callback with an instance of the ZipFile subclass.
 *
 * If Entry is subclassed, emitted 'entry' events are intercepted and re-emitted
 * so entries are instance of the entry subclass.
 *
 * @param {Object} yauzl - yauzl module object
 * @param {Object} [options] - options object
 * @param {boolean} [options.clone=true] - If true, creates clone of `yauzl` object
 * @param {boolean} [options.subclassZipFile=false] - If true, creates subclass of
 *   `yauzl.ZipFile` and saves to `yauzl` object
 * @param {boolean} [options.subclassEntry=false] - If true, creates subclass of
 *   `yauzl.Entry` and saves to `yauzl` object
 * @param {boolean} [options.eventsIntercept=false] - If true, patches prototype of
 *   `yauzl.ZipFile` to support event interception using events-intercept module
 * @returns {Object} - Cloned yauzl module object
 */
function clone(yauzl, options) {
	// Conform options
	options = {
		clone: true,
		subclassZipFile: false,
		subclassEntry: false,
		eventsIntercept: false,
		...options
	};
	if (options.subclassEntry) options.eventsIntercept = true;

	// Clone main object
	if (options.clone) yauzl = {...yauzl};

	// Subclass ZipFile
	if (options.subclassZipFile) {
		// Subclass ZipFile
		const original = yauzl.ZipFile;
		yauzl.ZipFile = function ZipFile(...args) {
			original.apply(this, args);
		};
		util.inherits(yauzl.ZipFile, original);

		// Patch access methods to callback with instance of ZipFile subclass
		// eslint-disable-next-line no-shadow
		patchAll(yauzl, original => zipFilePatcher(original, yauzl.ZipFile));
	}

	// Patch ZipFile prototype with events-intercept methods
	if (options.eventsIntercept) {
		const ZipFileProto = yauzl.ZipFile.prototype;
		if (!ZipFileProto.intercept) {
			eventsIntercept.patch(ZipFileProto);
			['_events', '_eventsCount', '_interceptors'].forEach(key => delete ZipFileProto[key]);
		}
	}

	// Subclass Entry
	if (options.subclassEntry) {
		// Subclass Entry
		const original = yauzl.Entry;
		yauzl.Entry = function Entry(...args) {
			original.apply(this, args);
		};
		util.inherits(yauzl.Entry, original);

		// Patch access methods to add 'entry' event interceptor
		// which re-emits instances of Entry subclass
		// eslint-disable-next-line no-shadow
		patchAll(yauzl, original => entryPatcher(original, yauzl.Entry));
	}

	// Return cloned copy of yauzl
	return yauzl;
}

/**
 * Patch all access methods with patcher function `fn`.
 *
 * Patcher function will be called with arguments `(original)` which is original
 * method (see below for complications).
 *
 * @param {Object} yauzl - yauzl module object
 * @param {Function} fn - Patcher function
 * @returns {undefined}
 */
function patchAll(yauzl, fn) {
	patch(yauzl, 'open', fn);
	patch(yauzl, 'fromFd', fn);
	patch(yauzl, 'fromBuffer', fn);
	patch(yauzl, 'fromRandomAccessReader', fn);
}

/**
 * Patch access method with patcher function `fn`.
 *
 * Patcher function will be called with arguments `(original)` which is original
 * method.
 *
 * EXCEPT: Arguments are conformed so they're the same for all 4 access methods.
 * This involves adding a dummy extra argument to `.open()`, `.fromFd()` and
 * `.fromBuffer()`.
 * Rationale is to make it easier to use the same patching function for all 4
 * methods so no need to conform arguments in the patching function.
 *
 * e.g.:
 * ```js
 * patchMethod(yauzl, 'open', function(original) {
 *   return function(path, _, options, callback) {
 *     original.call(path, _, options, function(err, zipFile) {
 *       // Do something to modify zipFile
 *       callback(err, zipFile);
 *     });
 *   });
 * });
 * ```
 *
 * @param {Object} yauzl - yauzl module object
 * @param {string} methodName - Name of method to patch
 * @param {Function} fn - Patcher function
 * @returns {Function} - Patched function
 */
function patch(yauzl, methodName, fn) {
	// Convert original function to function which takes 4 arguments
	// i.e. open(path, options, cb) -> open(path, _, options, cb)
	// So same shimming function can be used on all 4 methods.
	const original = yauzl[methodName];
	if (methodName === 'fromRandomAccessReader') {
		const shimmed = fn(original);

		yauzl.fromRandomAccessReader = function(reader, totalSize, options, callback) {
			if (typeof options === 'function') {
				callback = options;
				options = {};
			} else if (!options) {
				options = {};
			}

			return shimmed.call(this, reader, totalSize, options, callback);
		};
	} else {
		const shimmed = fn(function(path, unused, options, callback) {
			return original.call(this, path, options, callback); // eslint-disable-line no-invalid-this
		});

		yauzl[methodName] = function(path, options, callback) {
			if (typeof options === 'function') {
				callback = options;
				options = {};
			} else if (!options) {
				options = {};
			}

			return shimmed.call(this, path, null, options, callback);
		};
	}

	// Return shimmed function
	return yauzl[methodName];
}

/**
 * Patcher to make all access methods callback with instance of ZipFile subclass
 * (rather than original yauzl.ZipFile class).
 * @param {Function} original - Original function
 * @param {Function} ZipFile - `ZipFile` subclass
 * @returns {Function} - Patched function
 */
function zipFilePatcher(original, ZipFile) {
	return function(path, totalSize, options, callback) {
		// Set `lazyEntries` option to prevent `._readEntry()` being called on
		// internal zipFile object. Needs to be called on subclass instance instead.
		const {lazyEntries} = options,
			hasLazyEntries = Object.prototype.hasOwnProperty.call(options, 'lazyEntries');
		if (!lazyEntries) options.lazyEntries = true;

		// Call original method
		// eslint-disable-next-line no-invalid-this
		return original.call(this, path, totalSize, options, (err, zipFile) => {
			if (err) {
				callback(err);
				return;
			}

			// Convert to instance of subclass
			const zipFileInternal = zipFile;
			zipFile = Object.assign(Object.create(ZipFile.prototype), zipFile);

			// Forward events from internal ZipFile to exposed one
			zipFileInternal.emit = zipFile.emit.bind(zipFile);

			// If lazyEntries option was modified, restore to previous setting
			// and call `._readEntry()` on subclass instance
			if (!lazyEntries) {
				if (hasLazyEntries) {
					options.lazyEntries = lazyEntries;
				} else {
					delete options.lazyEntries;
				}

				zipFile.lazyEntries = false;
				zipFileInternal.lazyEntries = false;

				zipFile._readEntry();
			}

			// Callback with subclass instance
			callback(null, zipFile);
		});
	};
}

/**
 * Patcher to make all access methods attach event interceptor to zipFiles
 * which intercept 'entry' events and re-emit entries from Entry subclass.
 * @param {Function} original - Original function
 * @param {Function} Entry - `Entry` subclass
 * @returns {Function} - Patched function
 */
function entryPatcher(original, Entry) {
	return function(path, totalSize, options, callback) {
		// eslint-disable-next-line no-invalid-this
		return original.call(this, path, totalSize, options, (err, zipFile) => {
			if (err) {
				callback(err);
				return;
			}

			zipFile.intercept('entry', (entry, cb) => {
				entry = Object.assign(Object.create(Entry.prototype), entry);
				cb(null, entry);
			});

			callback(null, zipFile);
		});
	};
}
