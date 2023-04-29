/* --------------------
 * yauzl-clone module
 * Tests
 * ------------------*/

/* eslint-disable jest/no-done-callback */
/* eslint jest/expect-expect: ["error", {"assertFunctionNames": [
	"expect", "testOpen", "testFromFd", "testFromBuffer", "testFromRandomAccessReader"
]}] */

'use strict';

// Modules
const pathJoin = require('path').join,
	EventEmitter = require('events'),
	fs = require('fs'),
	fdSlicer = require('fd-slicer'),
	yauzlOriginal = require('yauzl'),
	cloner = require('yauzl-clone');

// Tests

const PATH = pathJoin(__dirname, 'test.zip'),
	ENTRY_COUNT = 4,
	FILE_LENGTH = 648;

describe('.clone()', () => {
	describe('with default options', () => {
		it('clones yauzl object', () => {
			const yauzl = cloner.clone(yauzlOriginal);
			expect(yauzl).not.toBe(yauzlOriginal);
		});

		it('copies yauzl properties', () => {
			const yauzl = cloner.clone(yauzlOriginal);

			for (const key in yauzlOriginal) {
				expect(yauzl[key]).toBe(yauzlOriginal[key]);
			}
		});
	});

	describe('with options.clone = false', () => {
		it('clones yauzl object', () => {
			const yauzl = cloner.clone(yauzlOriginal, {clone: false});
			expect(yauzl).toBe(yauzlOriginal);
		});
	});

	describe('with options.subclassZipFile = true', () => {
		let yauzl;
		beforeEach(() => {
			yauzl = cloner.clone(yauzlOriginal, {subclassZipFile: true});
		});

		it('subclasses ZipFile', () => {
			const {ZipFile} = yauzl;
			expect(ZipFile).not.toBe(yauzlOriginal.ZipFile);

			const zipFile = Object.create(ZipFile.prototype);
			expect(zipFile).toBeInstanceOf(ZipFile);
			expect(zipFile).toBeInstanceOf(yauzlOriginal.ZipFile);
			expect(zipFile).toBeInstanceOf(EventEmitter);
		});

		describe('methods callback with instance of ZipFile subclass', () => {
			let testFn;
			beforeEach(() => {
				const {ZipFile} = yauzl;
				testFn = (zipFile, cb) => {
					expect(zipFile).toBeInstanceOf(ZipFile);
					cb();
				};
			});

			it('`.open()`', (cb) => {
				testOpen(yauzl, cb, testFn);
			});

			it('`.fromFd()`', (cb) => {
				testFromFd(yauzl, cb, testFn);
			});

			it('`.fromBuffer()`', (cb) => {
				testFromBuffer(yauzl, cb, testFn);
			});

			it('`.fromRandomAccessReader()`', (cb) => {
				testFromRandomAccessReader(yauzl, cb, testFn);
			});
		});

		describe('zipFile subclass instance emits entry events with lazyEntries option false', () => {
			// Tests for issue https://github.com/overlookmotel/yauzl-clone/issues/1
			let testFn;
			beforeEach(() => {
				testFn = (zipFile, cb) => {
					let entries = 0;
					zipFile.on('entry', () => entries++);
					zipFile.on('end', () => {
						try {
							expect(entries).toBe(ENTRY_COUNT); // eslint-disable-line jest/no-standalone-expect
							cb();
						} catch (err) {
							cb(err);
						}
					});
				};
			});

			it('`.open()`', (cb) => {
				testOpen(yauzl, cb, testFn, true);
			});

			it('`.fromFd()`', (cb) => {
				testFromFd(yauzl, cb, testFn, true);
			});

			it('`.fromBuffer()`', (cb) => {
				testFromBuffer(yauzl, cb, testFn, true);
			});

			it('`.fromRandomAccessReader()`', (cb) => {
				testFromRandomAccessReader(yauzl, cb, testFn, true);
			});
		});
	});

	describe('with options.subclassEntry = true', () => {
		let yauzl;
		beforeEach(() => {
			yauzl = cloner.clone(yauzlOriginal, {subclassZipFile: true, subclassEntry: true});
		});

		it('subclasses Entry', () => {
			const {Entry} = yauzl;
			expect(Entry).not.toBe(yauzlOriginal.Entry);

			const entry = Object.create(Entry.prototype);
			expect(entry).toBeInstanceOf(Entry);
			expect(entry).toBeInstanceOf(yauzlOriginal.Entry);
		});

		describe('`.readEntry()` emits \'entry\' event with instance of Entry subclass when called on zip file accessed with', () => {
			let testFn;
			beforeEach(() => {
				const {Entry} = yauzl;
				testFn = (zipFile, cb) => {
					zipFile.on('error', cb);
					zipFile.on('entry', (entry) => {
						try {
							expect(entry).toBeInstanceOf(Entry);
							cb();
						} catch (err) {
							cb(err);
						}
					});
					zipFile.readEntry();
				};
			});

			it('`.open()`', (cb) => {
				testOpen(yauzl, cb, testFn);
			});

			it('`.fromFd()`', (cb) => {
				testFromFd(yauzl, cb, testFn);
			});

			it('`.fromBuffer()`', (cb) => {
				testFromBuffer(yauzl, cb, testFn);
			});

			it('`.fromRandomAccessReader()`', (cb) => {
				testFromRandomAccessReader(yauzl, cb, testFn);
			});
		});

		describe('`.readEntry()` emits \'entry\' event with `this` context of ZipFile subclass when called on zip file accessed with', () => {
			let testFn;
			beforeEach(() => {
				const {ZipFile} = yauzl;
				testFn = (zipFile, cb) => {
					zipFile.on('error', cb);
					zipFile.on('entry', function() {
						try {
							expect(this).toBeInstanceOf(ZipFile); // eslint-disable-line no-invalid-this
							cb();
						} catch (err) {
							cb(err);
						}
					});
					zipFile.readEntry();
				};
			});

			it('`.open()`', (cb) => {
				testOpen(yauzl, cb, testFn);
			});

			it('`.fromFd()`', (cb) => {
				testFromFd(yauzl, cb, testFn);
			});

			it('`.fromBuffer()`', (cb) => {
				testFromBuffer(yauzl, cb, testFn);
			});

			it('`.fromRandomAccessReader()`', (cb) => {
				testFromRandomAccessReader(yauzl, cb, testFn);
			});
		});
	});

	describe('with options.eventsIntercept = true', () => {
		it('adds events-intercept intercept method to ZipFile prototype', () => {
			const {ZipFile} = cloner.clone(yauzlOriginal, {subclassZipFile: true, eventsIntercept: true});

			const zipFile = Object.create(ZipFile.prototype);
			expect(zipFile.intercept).toBeFunction();

			const zipFileOriginal = Object.create(yauzlOriginal.ZipFile.prototype);
			expect(zipFileOriginal.intercept).toBeUndefined();
		});
	});
});

describe('.patch()', () => {
	let yauzl, patcher, testFn, expectedArg1Type, expectedArg2;
	beforeEach(() => {
		yauzl = cloner.clone(yauzlOriginal);

		let calledWith = null;
		patcher = original => (arg1, arg2, options, callback) => {
			calledWith = {
				arg1,
				arg2,
				options: options ? ({...options}) : options,
				callback
			};

			original(arg1, arg2, options, (err, zipFile) => {
				if (err) {
					callback(err);
					return;
				}
				zipFile._mutated = true;
				callback(null, zipFile);
			});
		};

		testFn = (zipFile, cb) => {
			expect(calledWith).toBeObject();
			if (expectedArg1Type === 'buffer') {
				expect(calledWith.arg1).toBeInstanceOf(Buffer);
			} else {
				expect(typeof calledWith.arg1).toBe(expectedArg1Type);
			}
			expect(calledWith.arg2).toBe(expectedArg2);
			expect(calledWith.options).toEqual({lazyEntries: true});
			expect(zipFile._mutated).toBeTrue();
			cb();
		};
	});

	it('works with `.open()`', (cb) => {
		cloner.patch(yauzl, 'open', patcher);

		expectedArg1Type = 'string';
		expectedArg2 = null;
		testOpen(yauzl, cb, testFn);
	});

	it('works with `.fromFd()`', (cb) => {
		cloner.patch(yauzl, 'fromFd', patcher);

		expectedArg1Type = 'number';
		expectedArg2 = null;
		testFromFd(yauzl, cb, testFn);
	});

	it('works with `.fromBuffer()`', (cb) => {
		cloner.patch(yauzl, 'fromBuffer', patcher);

		expectedArg1Type = 'buffer';
		expectedArg2 = null;
		testFromBuffer(yauzl, cb, testFn);
	});

	it('works with `.fromRandomAccessReader()`', (cb) => {
		cloner.patch(yauzl, 'fromRandomAccessReader', patcher);

		expectedArg1Type = 'object';
		expectedArg2 = FILE_LENGTH;
		testFromRandomAccessReader(yauzl, cb, testFn);
	});
});

describe('.patchAll()', () => {
	let yauzl, patcher, testFn, expectedArg1Type, expectedArg2;
	beforeEach(() => {
		yauzl = cloner.clone(yauzlOriginal);

		let calledWith = null;
		patcher = original => (arg1, arg2, options, callback) => {
			calledWith = {
				arg1,
				arg2,
				options: options ? ({...options}) : options,
				callback
			};

			original(arg1, arg2, options, (err, zipFile) => {
				if (err) {
					callback(err);
					return;
				}
				zipFile._mutated = true;
				callback(null, zipFile);
			});
		};

		testFn = (zipFile, cb) => {
			expect(calledWith).toBeObject();
			if (expectedArg1Type === 'buffer') {
				expect(calledWith.arg1).toBeInstanceOf(Buffer);
			} else {
				expect(typeof calledWith.arg1).toBe(expectedArg1Type);
			}
			expect(calledWith.arg2).toBe(expectedArg2);
			expect(calledWith.options).toEqual({lazyEntries: true});
			expect(zipFile._mutated).toBeTrue();
			cb();
		};

		cloner.patchAll(yauzl, patcher);
	});

	it('works with `.open()`', (cb) => {
		expectedArg1Type = 'string';
		expectedArg2 = null;
		testOpen(yauzl, cb, testFn);
	});

	it('works with `.fromFd()`', (cb) => {
		expectedArg1Type = 'number';
		expectedArg2 = null;
		testFromFd(yauzl, cb, testFn);
	});

	it('works with `.fromBuffer()`', (cb) => {
		expectedArg1Type = 'buffer';
		expectedArg2 = null;
		testFromBuffer(yauzl, cb, testFn);
	});

	it('works with `.fromRandomAccessReader()`', (cb) => {
		expectedArg1Type = 'object';
		expectedArg2 = FILE_LENGTH;
		testFromRandomAccessReader(yauzl, cb, testFn);
	});
});

/*
 * Helper functions
 */
function testOpen(yauzl, cb, fn, noLazyEntries) {
	fn = errorToCb(fn);
	yauzl.open(PATH, {lazyEntries: !noLazyEntries}, (err, zipFile) => {
		if (err) {
			cb(err);
			return;
		}
		fn(zipFile, (err) => { // eslint-disable-line no-shadow
			if (err) {
				cb(err);
				return;
			}
			closeZip(zipFile, cb);
		});
	});
}

function testFromFd(yauzl, cb, fn, noLazyEntries) {
	fn = errorToCb(fn);
	fs.open(PATH, 'r', (err, fd) => {
		if (err) {
			cb(err);
			return;
		}

		yauzl.fromFd(fd, {lazyEntries: !noLazyEntries}, (err, zipFile) => { // eslint-disable-line no-shadow
			if (err) {
				cb(err);
				return;
			}

			fn(zipFile, (err) => { // eslint-disable-line no-shadow
				if (err) {
					cb(err);
					return;
				}
				closeZip(zipFile, cb);
			});
		});
	});
}

function testFromBuffer(yauzl, cb, fn, noLazyEntries) {
	fn = errorToCb(fn);
	fs.readFile(PATH, (err, buffer) => {
		if (err) {
			cb(err);
			return;
		}

		yauzl.fromBuffer(
			buffer, {lazyEntries: !noLazyEntries},
			(err, zipFile) => { // eslint-disable-line no-shadow
				if (err) {
					cb(err);
					return;
				}
				fn(zipFile, cb);
			}
		);
	});
}

function testFromRandomAccessReader(yauzl, cb, fn, noLazyEntries) {
	fn = errorToCb(fn);
	fs.readFile(PATH, (err, buffer) => {
		if (err) {
			cb(err);
			return;
		}

		const reader = fdSlicer.createFromBuffer(buffer);

		yauzl.fromRandomAccessReader(
			reader, buffer.length, {lazyEntries: !noLazyEntries},
			(err, zipFile) => { // eslint-disable-line no-shadow
				if (err) {
					cb(err);
					return;
				}
				fn(zipFile, cb);
			}
		);
	});
}

function errorToCb(fn) {
	return function(...args) {
		try {
			return fn.apply(this, args); // eslint-disable-line no-invalid-this
		} catch (err) {
			args[args.length - 1](err);
			return undefined;
		}
	};
}

function closeZip(zipFile, cb) {
	zipFile.on('close', () => cb());
	zipFile.on('error', cb);
	zipFile.close();
}
