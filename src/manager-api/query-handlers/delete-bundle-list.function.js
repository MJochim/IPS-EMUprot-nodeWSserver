'use strict';

const fs = require('fs');

const FilenameHelper = require('../../core/filename-helper.class').FilenameHelper;
const gitCommit = require('../../core/git/git-commit.function').gitCommit;
const gitGetFile = require('../../core/git/git-get-file.function.js').gitGetFile;
const gitOpenRepository = require('../../core/git/git-open-repository.function.js').gitOpenRepository;
const lock = require('../../core/lock');
const NoBundleListError = require('../../core/errors/no-bundle-list-error.class').NoBundleListError;


exports.deleteBundleList = function (project, databaseName, bundleListName, archiveLabel, gitAuthor, gitCommitter) {
	return new Promise((resolve, reject) => {
		let bundleListPath = FilenameHelper.databaseBundleListFile(project, databaseName, archiveLabel, bundleListName);
		let bundleListPathRelative = FilenameHelper.databaseBundleListFile(project, databaseName, archiveLabel, bundleListName, false);
		let databasePath = FilenameHelper.databaseDirectory(project, databaseName);
		let index;
		let lockID;
		let repository;

		lock.lockDatabase(project, databaseName)
			.then((_lockID) => {
				lockID = _lockID;

				if (!fs.existsSync(bundleListPath)) {
					throw new NoBundleListError(project, databaseName, bundleListName, archiveLabel);
				}

				return gitOpenRepository(databasePath);
			})
			.then((_repositoryInfo) => {
				repository = _repositoryInfo.repository;
				index = _repositoryInfo.index;

				// Check whether the file exists in git's index
				return gitGetFile(repository, bundleListPathRelative);
			})
			// eslint-disable-next-line no-unused-vars
			.then((_entry) => {
				return index.removeByPath(bundleListPathRelative);
			})
			.then(() => {
				return gitCommit(repository, index, gitAuthor, gitCommitter, 'Deleted bundle list');
			})
			// eslint-disable-next-line no-unused-vars
			.then((commitID) => {
				fs.unlinkSync(bundleListPath);
			})
			.then(() => {
				lock.unlockDatabase(project, databaseName, lockID);
				resolve();
			})
			.catch((error) => {
				lock.unlockDatabase(project, databaseName, lockID);

				reject(error);
			});
	});
};