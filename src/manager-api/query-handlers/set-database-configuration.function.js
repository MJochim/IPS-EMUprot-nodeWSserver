'use strict';

const fs = require('fs');

const FilenameHelper = require('../../core/filename-helper.class.js').FilenameHelper;
const gitCommit = require('../../core/git/git-commit.function.js').gitCommit;
const gitGetFile = require('../../core/git/git-get-file.function.js').gitGetFile;
const gitOpenRepository = require('../../core/git/git-open-repository.function.js').gitOpenRepository;
const InvalidDBConfigError = require('../../core/errors/invalid-dbconfig-error.class.js').InvalidDBConfigError;
const lock = require('../../core/lock');
const NoDatabaseError = require('../../core/errors/no-database-error.class.js').NoDatabaseError;

exports.setDatabaseConfiguration = function (authenticatedUser,
                                             gitAuthor,
                                             gitCommitter,
                                             userInputFiles,
                                             project,
                                             databaseName,
                                             bundleComments,
                                             bundleFinishedEditing) {
	let index;
	let lockID;
	let paths = {
		config: FilenameHelper.databaseConfigFile(project, databaseName),
		configRel: FilenameHelper.databaseConfigFile(project, databaseName, false),
		database: FilenameHelper.databaseDirectory(project, databaseName)
	};
	let repository;

	return lock.lockProject(project)
		.then((_lockID) => {
			lockID = _lockID;
		})
		.then(() => {
			if (!fs.existsSync(paths.database)) {
				throw new NoDatabaseError(project, databaseName);
			}

			return gitOpenRepository(paths.database);
		})
		.then((_repositoryInfo) => {
			repository = _repositoryInfo.repository;
			index = _repositoryInfo.index;

			// Make sure the config file exists in git's index
			return gitGetFile(repository, paths.configRel);
		})
		// eslint-disable-next-line no-unused-vars
		.then((_entry) => {
		})
		.then(() => {
			// Read the configuration file
			let configObject;

			try {
				let json = fs.readFileSync(paths.config);
				configObject = JSON.parse(json);
			} catch (error) {
				if (error instanceof SyntaxError || error.code === 'ENOENT') {
					throw new InvalidDBConfigError(project, databaseName);
				} else {
					throw error;
				}
			}


			// Modify the configuration object
			if (!configObject.hasOwnProperty('EMUwebAppConfig')) {
				configObject.EMUwebAppConfig = {};
			} else {
				if (typeof configObject.EMUwebAppConfig !== 'object') {
					throw new InvalidDBConfigError(project, databaseName);
				}
			}

			if (!configObject.EMUwebAppConfig.hasOwnProperty('restrictions')) {
				configObject.EMUwebAppConfig.restrictions = {};
			} else {
				if (typeof configObject.EMUwebAppConfig.restrictions !== 'object') {
					throw new InvalidDBConfigError(project, databaseName);
				}
			}

			configObject.EMUwebAppConfig.restrictions.bundleComments = bundleComments;
			configObject.EMUwebAppConfig.restrictions.bundleFinishedEditing =  bundleFinishedEditing;

			fs.writeFileSync(paths.config, JSON.stringify(configObject, null, 2));
		})
		.then(() => {
			return index.addByPath(paths.configRel);
		})
		.then(() => {
			return gitCommit(
				repository, index, gitAuthor, gitCommitter,
				'Updated database configuration' +
				' (bundleComment/bundleFinishedEditing)'
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
