'use strict';

const nodegit = require('nodegit');

const FilenameHelper = require('../../core/filename-helper.class').FilenameHelper;
const GitCommit = require('../../core/types/git-commit.class').GitCommit;


exports.listCommits = function (project, database) {
	return new Promise((resolve, reject) => {
		let databasePath = FilenameHelper.databaseDirectory(project, database);
		let result = [];

		// Open the repository directory
		nodegit.Repository.open(databasePath)
			.then(function (repo) {
				// Open the master branch.
				return repo.getMasterCommit();
			})

			// Display information about commits on master.
			.then(function (firstCommitOnMaster) {
				// Create a new history event emitter.
				let history = firstCommitOnMaster.history();

				history.on('error', (error) => {
					reject(error);
				});

				// The onEnd event will fire only once. It will fire as soon
				// as all commits are known.
				history.on('end', (commits) => {
					try {
						commits.forEach((commit) => {
							let currentCommit = new GitCommit();

							currentCommit.commitID = commit.sha();
							currentCommit.date = commit.date();
							currentCommit.message = commit.message();

							result.push(currentCommit);
						});

						resolve(result);
					} catch (error) {
						reject(error);
					}
				});

				// Start emitting events
				history.start();
			})
			.catch((error) => {
				reject(error);
			});
	});
};