'use strict';

describe('runQueryHandler', () => {

	//
	// Dependencies and stubs
	//
	const proxyquire = require('proxyquire');

	let listProjectsStub = {};
	listProjectsStub.listProjects = function () {
		return Promise.resolve();
	};

	let runQueryHandler;


	//
	// Set up
	//

	beforeEach(() => {
		spyOn(listProjectsStub, 'listProjects').and.callThrough();
		runQueryHandler = proxyquire('./run-query-handler.function.js', {'../query-handlers/list-projects.function.js': listProjectsStub}).runQueryHandler;
	});


	//
	// The actual tests
	//

	it('should return a promise', () => {
		let promise = runQueryHandler({query: 'listProjects'}, []);
		expect(promise instanceof Promise).toBe(true);
		promise = runQueryHandler({}, []);
		expect(promise instanceof Promise).toBe(true);
	});

	it('should call the correct query handler and pass the correct parameters', () => {
		runQueryHandler({query: 'listProjects', username: 'alice'}, []);
		expect(listProjectsStub.listProjects).toHaveBeenCalledWith('alice');
	});

	it('should reject unknown queries', (done) => {
		runQueryHandler({query: 'someQuery'}, [])
			.then(() => {
				done.fail('Unknown query was accepted.');
			})
			.catch((error) => {
				expect(error.message).toBe('E_INVALID_QUERY');
				done();
			});
	});
});
