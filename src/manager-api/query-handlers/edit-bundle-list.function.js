'use strict';

const fs = require('fs');
const path = require('path');

const BundleListExistsError = require('../../core/errors/bundle-list-exists-error.class.js').BundleListExistsError;
const FilenameHelper = require('../../core/filename-helper.class').FilenameHelper;
const gitCommit = require('../../core/git/git-commit.function').gitCommit;
const gitGetFile = require('../../core/git/git-get-file.function.js').gitGetFile;
const gitOpenRepository = require('../../core/git/git-open-repository.function.js').gitOpenRepository;
const lock = require('../../core/lock');
const NoBundleListError = require('../../core/errors/no-bundle-list-error.class').NoBundleListError;


exports.editBundleList = function (project,
                                   databaseName,
                                   oldArchiveLabel,
                                   oldBundleListName,
                                   newArchiveLabel,
                                   newBundleListName,
                                   gitAuthor,
                                   gitCommitter) {
	return new Promise((resolve, reject) => {
		let paths = {
			db: FilenameHelper.databaseDirectory(project, databaseName),
			blNewAbs: FilenameHelper.databaseBundleListFile(project, databaseName, newArchiveLabel, newBundleListName),
			blNewRel: FilenameHelper.databaseBundleListFile(project, databaseName, newArchiveLabel, newBundleListName, false),
			blOldAbs: FilenameHelper.databaseBundleListFile(project, databaseName, oldArchiveLabel, oldBundleListName),
			blOldRel: FilenameHelper.databaseBundleListFile(project, databaseName, oldArchiveLabel, oldBundleListName, false),
		};
		let index;
		let lockID;
		let repository;

		lock.lockDatabase(project, databaseName)
			.then((_lockID) => {
				lockID = _lockID;

				if (!fs.existsSync(paths.blOldAbs)) {
					throw new NoBundleListError(project, databaseName, oldBundleListName, oldArchiveLabel);
				}
				if (fs.existsSync(paths.blNewAbs)) {
					throw new BundleListExistsError(project, databaseName, newBundleListName, newArchiveLabel);
				}

				return gitOpenRepository(paths.db);
			})
			.then((_repositoryInfo) => {
				repository = _repositoryInfo.repository;
				index = _repositoryInfo.index;

				// Check whether the old file exists in git's index
				return gitGetFile(repository, paths.blOldRel);
			})
			// eslint-disable-next-line no-unused-vars
			.then((_entry) => {
				// Make sure the new bundle list DOES NOT exist in git's index
				return gitGetFile(repository, paths.blNewRel)
				// eslint-disable-next-line no-unused-vars
					.catch((_error) => {
						// We want this error to occur, so we discard it silently.

						// This error should be a 'file not found' error
						// from nodegit, but these are not machine-readable,
						// so we cannot be certain.

						// We take the risk of silently dropping a different
						// error.
					});
			})
			// eslint-disable-next-line no-unused-vars
			.then((_entry) => {
				// Make sure the target directory exists
				let dir = path.dirname(paths.blNewAbs);
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(path.dirname(paths.blNewAbs));
				}

				// Move the bundle list file
				fs.renameSync(paths.blOldAbs, paths.blNewAbs);

				return index.removeByPath(paths.blOldRel);
			})
			.then(() => {
				return index.addByPath(paths.blNewRel);
			})
			.then(() => {
				return gitCommit(repository, index, gitAuthor, gitCommitter, 'Changed editor and/or archive label of bundle list');
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