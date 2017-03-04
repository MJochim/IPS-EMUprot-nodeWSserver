'use strict';

const nodegit = require('nodegit');

const FilenameHelper = require('../../core/filename-helper.class').FilenameHelper;
const lock = require('../../core/lock');

exports.addTag = function (project, databaseName, gitCommitID, gitTagLabel, username, gitAuthor) {
	return new Promise((resolve, reject) => {
		lock.lockDatabase(project, databaseName)
			.then((lockID) => {
				let databasePath = FilenameHelper.databaseDirectory(project, databaseName);

				nodegit.Repository.open(databasePath)
					.then((repo) => {
						return nodegit.Commit.lookup(repo, gitCommitID)
							.then((commit) => {
								return nodegit.Tag.create(repo, gitTagLabel, commit, gitAuthor, 'Created by emuDB Manager', 0);
							});
					})
					.then(() => {
						lock.unlockDatabase(project, databaseName, lockID);
						resolve();
					})
					.catch((error) => {
						lock.unlockDatabase(project, databaseName, lockID);
						reject(error);
					});
			})
			.catch((error) => {
				reject(error);
			});
	});
};