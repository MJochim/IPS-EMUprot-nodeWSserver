'use strict';

const nodegit = require('nodegit');

const GitError = require("../errors/git-error.class.js").GitError;

/**
 * Create a commit for a changed index and point HEAD to the new commit.
 *
 * @param repository
 * @param index
 * @param name
 * @param email
 * @param message
 * @param time
 * @param offset
 * @returns {Promise}
 */
exports.gitCommit = function (repository, index, name, email, message, time, offset) {
	return new Promise((resolve, reject) => {
		let now = new Date();
		let oid;

		if (time === undefined) {
			time = Math.floor(now.getTime() / 1000);
		}

		if (offset === undefined) {
			offset = -1 * now.getTimezoneOffset();
		}

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
				let author = nodegit.Signature.create(name, email, time, offset);
				let committer = nodegit.Signature.create(name, email, time, offset);

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
