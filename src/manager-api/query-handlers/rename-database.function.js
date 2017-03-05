'use strict';

const fs = require('fs');

const DatabaseExistsError = require('../../core/errors/database-exists-error.class.js').DatabaseExistsError;
const FilenameHelper = require('../../core/filename-helper.class.js').FilenameHelper;
const gitCommit = require('../../core/git/git-commit.function.js').gitCommit;
const gitGetFile = require('../../core/git/git-get-file.function.js').gitGetFile;
const gitOpenRepository = require('../../core/git/git-open-repository.function.js').gitOpenRepository;
const InvalidDBConfigError = require('../../core/errors/invalid-dbconfig-error.class.js').InvalidDBConfigError;
const lock = require('../../core/lock');
const NoDatabaseError = require('../../core/errors/no-database-error.class.js').NoDatabaseError;

exports.renameDatabase = function (project, oldDatabaseName, newDatabaseName, gitAuthor, gitCommitter) {
	let configObject;
	let index;
	let lockID;
	let paths = {
		configNew: FilenameHelper.databaseConfigFile(project, newDatabaseName),
		configNewRel: FilenameHelper.databaseConfigFile(project, newDatabaseName, false),
		configOld: FilenameHelper.databaseConfigFile(project, oldDatabaseName),
		configOldRel: FilenameHelper.databaseConfigFile(project, oldDatabaseName, false),
		dbNew: FilenameHelper.databaseDirectory(project, newDatabaseName),
		dbOld: FilenameHelper.databaseDirectory(project, oldDatabaseName),
	};
	let repository;

	return lock.lockProject(project)
		.then((_lockID) => {
			lockID = _lockID;
		})
		.then(() => {
			// Make sure the given database exists
			if (!fs.existsSync(paths.dbOld)) {
				throw new NoDatabaseError(project, oldDatabaseName);
			}

			// Make sure the new name does not yet exist
			if (fs.existsSync(paths.dbNew)) {
				throw new DatabaseExistsError(project, newDatabaseName);
			}

			// Read the configuration file and make sure its name attribute
			// matches the database name
			try {
				let json = fs.readFileSync(paths.configOld);
				configObject = JSON.parse(json);
			} catch (error) {
				if (error.code === 'ENOENT') {
					throw new InvalidDBConfigError(project, oldDatabaseName);
				} else {
					throw error;
				}
			}

			if (configObject.name !== oldDatabaseName) {
				throw new InvalidDBConfigError(project, oldDatabaseName);
			}
		})
		.then(() => {
			return gitOpenRepository(paths.dbOld);
		})
		.then((_repositoryInfo) => {
			repository = _repositoryInfo.repository;
			index = _repositoryInfo.index;

			// Make sure the config file exists in git's index
			return gitGetFile(repository, paths.configOldRel);
		})
		// eslint-disable-next-line no-unused-vars
		.then((_entry) => {
		})
		.then(() => {
			// Move the database directory and then delete the old config file
			fs.unlinkSync(paths.configOld);
			fs.renameSync(paths.dbOld, paths.dbNew);

			// Adapt and write the new config file
			configObject.name = newDatabaseName;
			fs.writeFileSync(paths.configNew, JSON.stringify(configObject, null, 2));
		})
		.then(() => {
			return gitOpenRepository(paths.dbNew);
		})
		.then((_repositoryInfo) => {
			repository = _repositoryInfo.repository;
			index = _repositoryInfo.index;

			return index.removeByPath(paths.configOldRel);
		})
		.then(() => {
			return index.addByPath(paths.configNewRel);
		})
		.then(() => {
			return gitCommit(
				repository, index, gitAuthor, gitCommitter,
				'Renamed database (' + oldDatabaseName + ' -> ' + newDatabaseName + ')'
			);
		})
		.then(() => {
			lock.unlockProject(project, lockID);
		})
		.catch((error) => {
			lock.unlockProject(project, lockID);
			throw error;
		});
};
