'use strict';

const nodegit = require('nodegit');

const GitError = require("../errors/git-error.class.js").GitError;

exports.gitGetFile = function (repository, filePath) {
	return new Promise((resolve, reject) => {
		nodegit.Reference.nameToId(repository, 'HEAD')
			.then((headID) => {
				return repository.getCommit(headID);
			})
			.then((headCommit) => {
				return headCommit.getTree();
			})
			.then((tree) => {
				return tree.entryByPath(filePath);
			})
			.then((entry) => {
				resolve(entry);
			})
			.catch((error) => {
				reject(new GitError(error.message));
			});
	});
};
