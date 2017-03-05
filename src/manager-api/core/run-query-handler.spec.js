'use strict';

describe('runQueryHandler', () => {

	//
	// Dependencies and stubs
	//
	const config = require('../../config').config;
	const nodegit = require('nodegit');
	const proxyquire = require('proxyquire');

	let listTagsStub = {};
	listTagsStub.listTags = function () {
		return Promise.resolve();
	};

	let runQueryHandler;


	//
	// Set up
	//

	beforeEach(() => {
		spyOn(listTagsStub, 'listTags').and.callThrough();
		runQueryHandler = proxyquire('./run-query-handler.function.js', {'../query-handlers/list-tags.function.js': listTagsStub}).runQueryHandler;
	});


	//
	// The actual tests
	//

	it('should return a promise', () => {
		let promise = runQueryHandler({}, 'listTags', {}, []);
		expect(promise instanceof Promise).toBe(true);
		promise = runQueryHandler({}, []);
		expect(promise instanceof Promise).toBe(true);
	});

	it('should call the correct query handler and pass the correct parameters', () => {
		let authenticatedUser = {
			username: 'alice',
			email: 'alice@example.com'
		};
		let author = nodegit.Signature.now(authenticatedUser.username, authenticatedUser.email);
		let committer = nodegit.Signature.now(config.git.committerName, config.git.committerEmail);

		runQueryHandler(
			authenticatedUser,
			'listTags',
			{project: 'sample-project', databaseName: 'myDB'},
			[]
		);
		expect(listTagsStub.listTags).toHaveBeenCalledWith(
			authenticatedUser,
			author,
			committer,
			[],
			'sample-project',
			'myDB'
		);
	});

	it('should reject unknown queries', (done) => {
		runQueryHandler({username: 'alice', email: 'alice@example.com'}, 'someQuery', {}, [])
			.then(() => {
				done.fail('Unknown query was accepted.');
			})
			.catch((error) => {
				expect(error.message).toBe('E_INVALID_QUERY');
				done();
			});
	});
});
