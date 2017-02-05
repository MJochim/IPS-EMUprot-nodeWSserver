'use strict';

const nodegit = require('nodegit');

const FilenameHelper = require('../../core/filename-helper.class').FilenameHelper;
const lock = require('../../core/lock');

exports.listTags = function (project, database) {
	return new Promise((resolve, reject) => {
		lock.lockDatabase(project, database)
			.then((lockID) => {
				let databasePath = FilenameHelper.databaseDirectory(project, database);

				nodegit.Repository.open(databasePath)
					.then((repo) => {
						return nodegit.Tag.list(repo);
					})
					.then((tagList) => {
						lock.unlockDatabase(project, database, lockID);
						resolve(tagList);
					})
					.catch((error) => {
						lock.unlockDatabase(project, database, lockID);
						reject(error);
					});
			})
			.catch((error) => {
				reject(error);
			});
	});
};
