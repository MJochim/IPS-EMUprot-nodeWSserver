'use strict';

const nodegit = require('nodegit');

const GitError = require('../errors/git-error.class.js').GitError;

/**
 * Create a commit for a changed index and point HEAD to the new commit.
 *
 * @param repository
 * @param index
 * @param author
 * @param committer
 * @returns {Promise}
 */
exports.gitCommit = function (repository, index, author, committer, message) {
	return new Promise((resolve, reject) => {
		let oid;

		index.write()
			.then(() => {
				return index.writeTree();
			})
			.then((_oid) => {
				oid = _oid;
				return nodegit.Reference.nameToId(repository, 'HEAD');
			})
			.then((head) => {
				return repository.getCommit(head);
			})
			.then((parent) => {
				return repository.createCommit('HEAD', author, committer, message, oid, [parent]);
			})
			.then((commitID) => {
				resolve(commitID);
			})
			.catch((error) => {
				reject(new GitError(error.message));
			});
	});
};
