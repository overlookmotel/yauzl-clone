/* --------------------
 * yauzl-clone module
 * Tests
 * ------------------*/

/* eslint-disable no-invalid-this */

'use strict';

// Modules
const chai = require('chai'),
	{expect} = chai,
	pathJoin = require('path').join,
	EventEmitter = require('events'),
	fs = require('fs'),
	fdSlicer = require('fd-slicer'),
	yauzlOriginal = require('yauzl'),
	cloner = require('../index.js');

// Init
chai.config.includeStack = true;

// Tests

/* global describe, it, beforeEach */

const PATH = pathJoin(__dirname, 'test.zip'),
	ENTRY_COUNT = 4,
	FILE_LENGTH = 648;

describe('.clone()', () => {
	describe('with default options', () => {
		it('clones yauzl object', () => {
			const yauzl = cloner.clone(yauzlOriginal);
			expect(yauzl).to.not.equal(yauzlOriginal);
		});

		it('copies yauzl properties', () => {
			const yauzl = cloner.clone(yauzlOriginal);

			for (const key in yauzlOriginal) {
				expect(yauzl[key]).to.equal(yauzlOriginal[key]);
			}
		});
	});

	describe('with options.clone = false', () => {
		it('clones yauzl object', () => {
			const yauzl = cloner.clone(yauzlOriginal, {clone: false});
			expect(yauzl).to.equal(yauzlOriginal);
		});
	});

	describe('with options.subclassZipFile = true', () => {
		beforeEach(function() {
			this.yauzl = cloner.clone(yauzlOriginal, {subclassZipFile: true});
		});

		it('subclasses ZipFile', function() {
			const {ZipFile} = this.yauzl;
			expect(ZipFile).to.not.equal(yauzlOriginal.ZipFile);

			const zipFile = Object.create(ZipFile.prototype);
			expect(zipFile).to.be.instanceof(ZipFile);
			expect(zipFile).to.be.instanceof(yauzlOriginal.ZipFile);
			expect(zipFile).to.be.instanceof(EventEmitter);
		});

		describe('methods callback with instance of ZipFile subclass', () => {
			beforeEach(function() {
				const {ZipFile} = this.yauzl;
				this.testFn = (zipFile, cb) => {
					expect(zipFile).to.be.instanceof(ZipFile);
					cb();
				};
			});

			it('`.open()`', function(cb) {
				testOpen(this.yauzl, cb, this.testFn);
			});

			it('`.fromFd()`', function(cb) {
				testFromFd(this.yauzl, cb, this.testFn);
			});

			it('`.fromBuffer()`', function(cb) {
				testFromBuffer(this.yauzl, cb, this.testFn);
			});

			it('`.fromRandomAccessReader()`', function(cb) {
				testFromRandomAccessReader(this.yauzl, cb, this.testFn);
			});
		});

		describe('ZipFile subclass instance emits entry events with lazyEntries option false', () => {
			// Tests for issue https://github.com/overlookmotel/yauzl-clone/issues/1
			beforeEach(function() {
				this.testFn = (zipFile, cb) => {
					let entries = 0;
					zipFile.on('entry', () => entries++);
					zipFile.on('end', () => {
						expect(entries).to.equal(ENTRY_COUNT);
						cb();
					});
				};
			});

			it('`.open()`', function(cb) {
				testOpen(this.yauzl, cb, this.testFn, true);
			});

			it('`.fromFd()`', function(cb) {
				testFromFd(this.yauzl, cb, this.testFn, true);
			});

			it('`.fromBuffer()`', function(cb) {
				testFromBuffer(this.yauzl, cb, this.testFn, true);
			});

			it('`.fromRandomAccessReader()`', function(cb) {
				testFromRandomAccessReader(this.yauzl, cb, this.testFn, true);
			});
		});
	});

	describe('with options.subclassEntry = true', () => {
		beforeEach(function() {
			this.yauzl = cloner.clone(yauzlOriginal, {subclassZipFile: true, subclassEntry: true});
		});

		it('subclasses Entry', function() {
			const {Entry} = this.yauzl;
			expect(Entry).to.not.equal(yauzlOriginal.Entry);

			const entry = Object.create(Entry.prototype);
			expect(entry).to.be.instanceof(Entry);
			expect(entry).to.be.instanceof(yauzlOriginal.Entry);
		});

		describe('`.readEntry()` emits \'entry\' event with instance of Entry subclass when called on zip file accessed with', () => {
			beforeEach(function() {
				const {Entry} = this.yauzl;
				this.testFn = (zipFile, cb) => {
					zipFile.on('error', cb);
					zipFile.on('entry', (entry) => {
						expect(entry).to.be.instanceof(Entry);
						cb();
					});
					zipFile.readEntry();
				};
			});

			it('`.open()`', function(cb) {
				testOpen(this.yauzl, cb, this.testFn);
			});

			it('`.fromFd()`', function(cb) {
				testFromFd(this.yauzl, cb, this.testFn);
			});

			it('`.fromBuffer()`', function(cb) {
				testFromBuffer(this.yauzl, cb, this.testFn);
			});

			it('`.fromRandomAccessReader()`', function(cb) {
				testFromRandomAccessReader(this.yauzl, cb, this.testFn);
			});
		});

		describe('`.readEntry()` emits \'entry\' event with `this` context of ZipFile subclass when called on zip file accessed with', () => {
			beforeEach(function() {
				const {ZipFile} = this.yauzl;
				this.testFn = (zipFile, cb) => {
					zipFile.on('error', cb);
					zipFile.on('entry', function() {
						expect(this).to.be.instanceof(ZipFile);
						cb();
					});
					zipFile.readEntry();
				};
			});

			it('`.open()`', function(cb) {
				testOpen(this.yauzl, cb, this.testFn);
			});

			it('`.fromFd()`', function(cb) {
				testFromFd(this.yauzl, cb, this.testFn);
			});

			it('`.fromBuffer()`', function(cb) {
				testFromBuffer(this.yauzl, cb, this.testFn);
			});

			it('`.fromRandomAccessReader()`', function(cb) {
				testFromRandomAccessReader(this.yauzl, cb, this.testFn);
			});
		});
	});

	describe('with options.eventsIntercept = true', () => {
		beforeEach(function() {
			this.yauzl = cloner.clone(yauzlOriginal, {subclassZipFile: true, eventsIntercept: true});
		});

		it('adds events-intercept intercept method to ZipFile prototype', function() {
			const {ZipFile} = this.yauzl;

			const zipFile = Object.create(ZipFile.prototype);
			expect(zipFile.intercept).to.be.a('function');

			const zipFileOriginal = Object.create(yauzlOriginal.ZipFile.prototype);
			expect(zipFileOriginal.intercept).to.be.undefined; // eslint-disable-line no-unused-expressions
		});
	});
});

describe('.patch()', () => {
	beforeEach(function() {
		this.yauzl = cloner.clone(yauzlOriginal);

		let calledWith = null;
		this.patcher = original => (arg1, arg2, options, callback) => {
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

		this.testFn = (zipFile, cb) => {
			expect(calledWith).to.be.ok; // eslint-disable-line no-unused-expressions
			if (this.expectedArg1Type === 'buffer') {
				expect(calledWith.arg1).to.be.instanceof(Buffer);
			} else {
				expect(calledWith.arg1).to.be.a(this.expectedArg1Type);
			}
			expect(calledWith.arg2).to.equal(this.expectedArg2);
			expect(calledWith.options).to.deep.equal({lazyEntries: true});
			expect(zipFile._mutated).to.be.true; // eslint-disable-line no-unused-expressions
			cb();
		};
	});

	it('works with `.open()`', function(cb) {
		cloner.patch(this.yauzl, 'open', this.patcher);

		this.expectedArg1Type = 'string';
		this.expectedArg2 = null;
		testOpen(this.yauzl, cb, this.testFn);
	});

	it('works with `.fromFd()`', function(cb) {
		cloner.patch(this.yauzl, 'fromFd', this.patcher);

		this.expectedArg1Type = 'number';
		this.expectedArg2 = null;
		testFromFd(this.yauzl, cb, this.testFn);
	});

	it('works with `.fromBuffer()`', function(cb) {
		cloner.patch(this.yauzl, 'fromBuffer', this.patcher);

		this.expectedArg1Type = 'buffer';
		this.expectedArg2 = null;
		testFromBuffer(this.yauzl, cb, this.testFn);
	});

	it('works with `.fromRandomAccessReader()`', function(cb) {
		cloner.patch(this.yauzl, 'fromRandomAccessReader', this.patcher);

		this.expectedArg1Type = 'object';
		this.expectedArg2 = FILE_LENGTH;
		testFromRandomAccessReader(this.yauzl, cb, this.testFn);
	});
});

describe('.patchAll()', () => {
	beforeEach(function() {
		this.yauzl = cloner.clone(yauzlOriginal);

		let calledWith = null;
		this.patcher = original => (arg1, arg2, options, callback) => {
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

		this.testFn = (zipFile, cb) => {
			expect(calledWith).to.be.ok; // eslint-disable-line no-unused-expressions
			if (this.expectedArg1Type === 'buffer') {
				expect(calledWith.arg1).to.be.instanceof(Buffer);
			} else {
				expect(calledWith.arg1).to.be.a(this.expectedArg1Type);
			}
			expect(calledWith.arg2).to.equal(this.expectedArg2);
			expect(calledWith.options).to.deep.equal({lazyEntries: true});
			expect(zipFile._mutated).to.be.true; // eslint-disable-line no-unused-expressions
			cb();
		};

		cloner.patchAll(this.yauzl, this.patcher);
	});

	it('works with `.open()`', function(cb) {
		this.expectedArg1Type = 'string';
		this.expectedArg2 = null;
		testOpen(this.yauzl, cb, this.testFn);
	});

	it('works with `.fromFd()`', function(cb) {
		this.expectedArg1Type = 'number';
		this.expectedArg2 = null;
		testFromFd(this.yauzl, cb, this.testFn);
	});

	it('works with `.fromBuffer()`', function(cb) {
		this.expectedArg1Type = 'buffer';
		this.expectedArg2 = null;
		testFromBuffer(this.yauzl, cb, this.testFn);
	});

	it('works with `.fromRandomAccessReader()`', function(cb) {
		this.expectedArg1Type = 'object';
		this.expectedArg2 = FILE_LENGTH;
		testFromRandomAccessReader(this.yauzl, cb, this.testFn);
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
			return fn.apply(this, args);
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
