'use strict';

const addTag = require('../query-handlers/add-tag.function').addTag;
const EmuError = require('../../core/errors/emu-error.class.js').EmuError;
const listCommits = require('../query-handlers/list-commits.function.js').listCommits;
const listProjects = require('../query-handlers/list-projects.function.js').listProjects;
const listTags = require('../query-handlers/list-tags.function.js').listTags;
const projectInfo = require('../query-handlers/project-info.function.js').projectInfo;

/**
 * This function only looks at <userInput.query> (a client-supplied string) and
 * calls the appropriate function.
 *
 * IMPORTANT: userInput must be validated, and the user must be authenticated
 * and authorized before calling this function.
 */
exports.runQueryHandler = function (userInput, userInputFiles) {
	let promise;

	switch (userInput.query) {
		case 'addTag':
			promise = addTag(
				userInput.project,
				userInput.databaseName,
				userInput.gitCommitID,
				userInput.gitTagLabel,
				userInput.username
			);
			break;

		case 'createArchive':
			// eslint-disable-next-line no-undef
			promise = createArchive(
				userInput.project,
				userInput.databaseName,
				userInput.gitTreeish
			);
			break;

		case 'deleteBundleList':
			// eslint-disable-next-line no-undef
			promise = deleteBundleList(
				userInput.project,
				userInput.databaseName,
				userInput.bundleListName,
				userInput.archiveLabel
			);
			break;

		case 'deleteUpload':
			// eslint-disable-next-line no-undef
			promise = deleteUpload(
				userInput.project,
				userInput.uploadUUID
			);
			break;

		case 'downloadDatabase':
			// eslint-disable-next-line no-undef
			promise = downloadDatabase(
				userInput.project,
				userInput.databaseName,
				userInput.gitTreeish
			);
			break;

		case 'editBundleList':
			// eslint-disable-next-line no-undef
			promise = editBundleList(
				userInput.project,
				userInput.databaseName,
				userInput.oldArchiveLabel,
				userInput.oldBundleListName,
				userInput.newArchiveLabel,
				userInput.newBundleListName
			);
			break;

		case 'fastForward':
			// eslint-disable-next-line no-undef
			promise = fastForward(
				userInput.project,
				userInput.uploadUUID,
				userInput.databaseName
			);
			break;

		case 'listCommits':
			promise = listCommits(
				userInput.project,
				userInput.databaseName
			);
			break;

		case 'listProjects':
			promise = listProjects(
				userInput.username
			);
			break;

		case 'listTags':
			promise = listTags(
				userInput.project,
				userInput.databaseName
			);
			break;

		case 'mergeUpload':
			// eslint-disable-next-line no-undef
			promise = mergeUpload(
				userInput.project,
				userInput.uploadUUID,
				userInput.databaseName
			);
			break;

		case 'projectInfo':
			promise = projectInfo(
				userInput.project
			);
			break;

		case 'renameDatabase':
			// eslint-disable-next-line no-undef
			promise = renameDatabase(
				userInput.project,
				userInput.oldDatabaseName,
				userInput.newDatabaseName
			);
			break;

		case 'saveBundleList':
			// eslint-disable-next-line no-undef
			promise = saveBundleList(
				userInput.project,
				userInput.databaseName,
				userInput.bundleListName,
				userInput.bundleListObject
			);
			break;

		case 'saveUpload':
			// eslint-disable-next-line no-undef
			promise = saveUpload(
				userInput.project,
				userInput.uploadUUID,
				userInput.databaseName
			);
			break;

		case 'setDatabaseConfiguration':
			// eslint-disable-next-line no-undef
			promise = setDatabaseConfiguration(
				userInput.project,
				userInput.databaseName,
				userInput.bundleComments,
				userInput.bundleFinishedEditing
			);
			break;

		case 'upload':
			// eslint-disable-next-line no-undef
			promise = upload(
				userInput.project,
				userInputFiles
			);
			break;

		default:
			promise = Promise.reject(new EmuError('E_INVALID_QUERY', true));
	}

	return promise;
};
