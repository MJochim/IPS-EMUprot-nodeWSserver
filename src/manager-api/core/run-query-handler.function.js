'use strict';

const EmuError = require('../../core/emu-error.class.js').EmuError;
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
				userInput.gitTagLabel
			);
			break;

		case 'createArchive':
			promise = createArchive(
				userInput.project,
				userInput.databaseName,
				userInput.gitTreeish
			);
			break;

		case 'deleteBundleList':
			promise = deleteBundleList(
				userInput.project,
				userInput.databaseName,
				userInput.bundleListName,
				userInput.archiveLabel
			);
			break;

		case 'deleteUpload':
			promise = deleteUpload(
				userInput.project,
				userInput.uploadUUID
			);
			break;

		case 'downloadDatabase':
			promise = downloadDatabase(
				userInput.project,
				userInput.databaseName,
				userInput.gitTreeish
			);
			break;

		case 'editBundleList':
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

		case 'listTags':
			promise = listTags(
				userInput.project,
				userInput.databaseName
			);
			break;

		case 'login':
			promise = Promise.resolve(null);
			break;

		case 'mergeUpload':
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

		case 'renameDB':
			promise = renameDB(
				userInput.project,
				userInput.oldDatabaseName,
				userInput.newDatabaseName
			);
			break;

		case 'saveBundleList':
			promise = saveBundleList(
				userInput.project,
				userInput.databaseName,
				userInput.bundleListName,
				userInput.bundleListObject
			);
			break;

		case 'saveUpload':
			promise = saveUpload(
				userInput.project,
				userInput.uploadUUID,
				userInput.databaseName
			);
			break;

		case 'setDatabaseConfiguration':
			promise = setDatabaseConfiguration(
				userInput.project,
				userInput.databaseName,
				userInput.bundleComments,
				userInput.bundleFinishedEditing
			);
			break;

		case 'upload':
			promise = upload(
				userInput.project
			);
			break;

		default:
			promise = Promise.reject(new EmuError('E_INVALID_QUERY', true));
	}

	return promise;
};
