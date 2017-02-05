'use strict';

const nodegit = require('nodegit');

const config = require('../../config').config;
const FilenameHelper = require('../../core/filename-helper.class').FilenameHelper;
const lock = require('../../core/lock');

exports.addTag = function (project, databaseName, gitCommitID, gitTagLabel, username) {
	return new Promise((resolve, reject) => {
		lock.lockDatabase(project, databaseName)
			.then((lockID) => {
				let databasePath = FilenameHelper.databaseDirectory(project, databaseName);

				nodegit.Repository.open(databasePath)
					.then((repo) => {
						return nodegit.Commit.lookup(repo, gitCommitID)
							.then((commit) => {
								let signature = nodegit.Signature.now(username, config.git.committerEmail);
								return nodegit.Tag.create(repo, gitTagLabel, commit, signature, 'Created by emuDB Manager', 0);
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