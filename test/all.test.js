/* --------------------
 * yauzl-clone module
 * Tests
 * ------------------*/

'use strict';

// Modules
const chai = require('chai'),
	{expect} = chai,
	pathJoin = require('path').join,
	EventEmitter = require('events'),
	fs = require('fs'),
	fdSlicer = require('fd-slicer'),
	yauzlOriginal = require('yauzl'),
	cloner = require('../lib/');

// Init
chai.config.includeStack = true;

// Tests

/* jshint expr: true */
/* global describe, it, beforeEach */

const PATH = pathJoin(__dirname, 'test.zip'),
	FILE_LENGTH = 648;

describe('.clone()', function() {
	describe('with default options', function() {
		it('clones yauzl object', function() {
			const yauzl = cloner.clone(yauzlOriginal);
			expect(yauzl).to.not.equal(yauzlOriginal);
		});

		it('copies yauzl properties', function() {
			const yauzl = cloner.clone(yauzlOriginal);

			for (let key in yauzlOriginal) {
				expect(yauzl[key]).to.equal(yauzlOriginal[key]);
			}
		});
	});

	describe('with options.clone = false', function() {
		it('clones yauzl object', function() {
			const yauzl = cloner.clone(yauzlOriginal, {clone: false});
			expect(yauzl).to.equal(yauzlOriginal);
		});
	});

	describe('with options.subclassZipFile = true', function() {
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

		describe('methods callback with instance of ZipFile subclass', function() {
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
	});

	describe('with options.subclassEntry = true', function() {
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

		describe('`.readEntry()` emits \'entry\' event with instance of Entry subclass when called on zip file accessed with', function() {
			beforeEach(function() {
				const {Entry} = this.yauzl;
				this.testFn = (zipFile, cb) => {
					zipFile.on('error', cb);
					zipFile.on('entry', entry => {
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

		describe('`.readEntry()` emits \'entry\' event with `this` context of ZipFile subclass when called on zip file accessed with', function() {
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

	describe('with options.eventsIntercept = true', function() {
		beforeEach(function() {
			this.yauzl = cloner.clone(yauzlOriginal, {subclassZipFile: true, eventsIntercept: true});
		});

		it('adds events-intercept intercept method to ZipFile prototype', function() {
			const {ZipFile} = this.yauzl;

			const zipFile = Object.create(ZipFile.prototype);
			expect(zipFile.intercept).to.be.a('function');

			const zipFileOriginal = Object.create(yauzlOriginal.ZipFile.prototype);
			expect(zipFileOriginal.intercept).to.be.undefined;
		});
	});
});

describe('.patch()', function() {
	beforeEach(function() {
		this.yauzl = cloner.clone(yauzlOriginal);

		let calledWith = null;
		this.patcher = original => {
			return (arg1, arg2, options, callback) => {
				calledWith = {
					arg1,
					arg2,
					options: options ? Object.assign({}, options) : options,
					callback
				};

				original(arg1, arg2, options, (err, zipFile) => {
					if (err) return callback(err);
					zipFile._mutated = true;
					callback(null, zipFile);
				});
			};
		};

		this.testFn = (zipFile, cb) => {
			expect(calledWith).to.be.ok;
			if (this.expectedArg1Type == 'buffer') {
				expect(calledWith.arg1).to.be.instanceof(Buffer);
			} else {
				expect(calledWith.arg1).to.be.a(this.expectedArg1Type);
			}
			expect(calledWith.arg2).to.equal(this.expectedArg2);
			expect(calledWith.options).to.deep.equal({lazyEntries: true});
			expect(zipFile._mutated).to.be.true;
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

describe('.patchAll()', function() {
	beforeEach(function() {
		this.yauzl = cloner.clone(yauzlOriginal);

		let calledWith = null;
		this.patcher = original => {
			return (arg1, arg2, options, callback) => {
				calledWith = {
					arg1,
					arg2,
					options: options ? Object.assign({}, options) : options,
					callback
				};

				original(arg1, arg2, options, (err, zipFile) => {
					if (err) return callback(err);
					zipFile._mutated = true;
					callback(null, zipFile);
				});
			};
		};

		this.testFn = (zipFile, cb) => {
			expect(calledWith).to.be.ok;
			if (this.expectedArg1Type == 'buffer') {
				expect(calledWith.arg1).to.be.instanceof(Buffer);
			} else {
				expect(calledWith.arg1).to.be.a(this.expectedArg1Type);
			}
			expect(calledWith.arg2).to.equal(this.expectedArg2);
			expect(calledWith.options).to.deep.equal({lazyEntries: true});
			expect(zipFile._mutated).to.be.true;
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
function testOpen(yauzl, cb, fn) {
	fn = errorToCb(fn);
	yauzl.open(PATH, {lazyEntries: true}, function(err, zipFile) {
		if (err) return cb(err);
		fn(zipFile, err => {
			if (err) return cb(err);
			closeZip(zipFile, cb);
		});
	});
}

function testFromFd(yauzl, cb, fn) {
	fn = errorToCb(fn);
	fs.open(PATH, 'r', (err, fd) => {
		if (err) return cb(err);

		yauzl.fromFd(fd, {lazyEntries: true}, function(err, zipFile) {
			if (err) return cb(err);
			fn(zipFile, err => {
				if (err) return cb(err);
				closeZip(zipFile, cb);
			});
		});
	});
}

function testFromBuffer(yauzl, cb, fn) {
	fn = errorToCb(fn);
	fs.readFile(PATH, (err, buffer) => {
		if (err) return cb(err);

		yauzl.fromBuffer(buffer, {lazyEntries: true}, function(err, zipFile) {
			if (err) return cb(err);
			fn(zipFile, cb);
		});
	});
}

function testFromRandomAccessReader(yauzl, cb, fn) {
	fn = errorToCb(fn);
	fs.readFile(PATH, (err, buffer) => {
		if (err) return cb(err);

		const reader = fdSlicer.createFromBuffer(buffer);

		yauzl.fromRandomAccessReader(reader, buffer.length, {lazyEntries: true}, function(err, zipFile) {
			if (err) return cb(err);
			fn(zipFile, cb);
		});
	});
}

function errorToCb(fn) {
	return function() {
		try {
			return fn.apply(this, arguments);
		} catch (err) {
			arguments[arguments.length - 1](err);
		}
	};
}

function closeZip(zipFile, cb) {
	zipFile.on('close', () => cb());
	zipFile.on('error', cb);
	zipFile.close();
}
