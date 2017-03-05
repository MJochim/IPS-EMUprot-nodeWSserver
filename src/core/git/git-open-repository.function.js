'use strict';

const nodegit = require('nodegit');

const GitError = require('../errors/git-error.class.js').GitError;

exports.gitOpenRepository = function (path) {
	return new Promise((resolve, reject) => {
		let repository;

		nodegit.Repository.open(path)
			.then((_repository) => {
				repository = _repository;
				return repository.refreshIndex();
			})
			.then((_index) => {
				resolve({
					index: _index,
					repository: repository
				});
			})
			.catch((error) => {
				reject(new GitError(error.message));
			});
	});
};
