'use strict';

describe('authorize (based on SQLite)', () => {

	//
	// Dependencies and stubs
	//
	const proxyquire = require('proxyquire');
	const AuthorizationError = require('../../core/errors/authorization-error.class.js').AuthorizationError;

	let configStub = {};
	configStub.config = {
		sql: {
			type: 'sqlite'
		}
	};

	const authorize = proxyquire('./authorize.function.js', {'../../config.js': configStub}).authorize;


	//
	// Set up
	//

	beforeEach(() => {
		configStub.config.sql.filename = 'spec/emu-server.DB';
	});


	//
	// The actual tests
	//

	it('should return a promise', () => {
		let promise = authorize('alice', 'projectInfo', 'sample-project');
		expect(promise instanceof Promise).toBe(true);
	});

	it('should reject its promise in case of runtime error', (done) => {
		configStub.config.sql.filename = 'spec/invalid.filename';
		authorize('alice', 'projectInfo', 'sample-project')
			.then(() => {
				done.fail('Promise should have been rejected');
			})
			.catch((error) => {
				expect(error instanceof Error).toBe(true);
				done();
			});
	});

	it('should accept some users', (done) => {
		authorize('alice', 'renameDatabase', 'sample-project')
			.then((v) => {
				expect(v).toBeUndefined;
				return authorize('bob', 'projectInfo', 'sample-project');
			})
			.then((v) => {
				expect(v).toBeUndefined;
				done();
			})
			.catch(() => {
				done.fail('A user was wrongly rejected');
			});
	});

	it('should reject some users', (done) => {
		authorize('eve', 'projectInfo', 'sample-project')
			.then(() => {
				done.fail('eve was wrongly admitted');
			})
			.catch((error) => {
				if (!(error instanceof AuthorizationError)) {
					done.fail('Rejection reason for eve should have been AuthorizationError');
				} else {
					return authorize('bob', 'renameDatabase', 'sample-project');
				}
			})
			.then(() => {
				done.fail('bob was wrongly admitted');
			})
			.catch((error) => {
				if (!(error instanceof AuthorizationError)) {
					done.fail('Rejection reason for bob should have been AuthorizationError');
				} else {
					done();
				}
			});
	});
});
