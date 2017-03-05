'use strict';

const nodegit = require('nodegit');

const addTag = require('../query-handlers/add-tag.function').addTag;
const config = require('../../config').config;
const deleteBundleList  = require('../query-handlers/delete-bundle-list.function').deleteBundleList;
const editBundleList = require('../query-handlers/edit-bundle-list.function.js').editBundleList;
const EmuError = require('../../core/errors/emu-error.class.js').EmuError;
const listCommits = require('../query-handlers/list-commits.function.js').listCommits;
const listProjects = require('../query-handlers/list-projects.function.js').listProjects;
const listTags = require('../query-handlers/list-tags.function.js').listTags;
const projectInfo = require('../query-handlers/project-info.function.js').projectInfo;
const renameDatabase = require('../query-handlers/rename-database.function.js').renameDatabase;
const setDatabaseConfiguration = require('../query-handlers/set-database-configuration.function.js').setDatabaseConfiguration;

/**
 * This function only looks at the query (a client-supplied string) and
 * calls the appropriate function.
 *
 * IMPORTANT: userInput must be validated, and the user must be authenticated
 * and authorized before calling this function.
 */
exports.runQueryHandler = function (authentication, query, parameters, userInputFiles) {
	let author;
	let committer;
	let promise;

	// Create signatures for git commit
	try {
		author = nodegit.Signature.now(authentication.username, authentication.email);
		committer = nodegit.Signature.now(config.git.committerName, config.git.committerEmail);
	} catch (error) {
		return Promise.reject(error);
	}

	if (author === null || committer === null) {
		return Promise.reject(new Error('Creating commit signatures failed.'));
	}

	switch (query) {
		case 'addTag':
			promise = addTag(
				parameters.project,
				parameters.databaseName,
				parameters.gitCommitID,
				parameters.gitTagLabel,
				author
			);
			break;

		case 'createArchive':
			// eslint-disable-next-line no-undef
			promise = createArchive(
				parameters.project,
				parameters.databaseName,
				parameters.gitTreeish
			);
			break;

		case 'deleteBundleList':
			promise = deleteBundleList(
				parameters.project,
				parameters.databaseName,
				parameters.bundleListName,
				parameters.archiveLabel,
				author,
				committer
			);
			break;

		case 'deleteUpload':
			// eslint-disable-next-line no-undef
			promise = deleteUpload(
				parameters.project,
				parameters.uploadUUID
			);
			break;

		case 'downloadDatabase':
			// eslint-disable-next-line no-undef
			promise = downloadDatabase(
				parameters.project,
				parameters.databaseName,
				parameters.gitTreeish
			);
			break;

		case 'editBundleList':
			promise = editBundleList(
				parameters.project,
				parameters.databaseName,
				parameters.oldArchiveLabel,
				parameters.oldBundleListName,
				parameters.newArchiveLabel,
				parameters.newBundleListName,
				author,
				committer
			);
			break;

		case 'fastForward':
			// eslint-disable-next-line no-undef
			promise = fastForward(
				parameters.project,
				parameters.uploadUUID,
				parameters.databaseName
			);
			break;

		case 'listCommits':
			promise = listCommits(
				parameters.project,
				parameters.databaseName
			);
			break;

		case 'listProjects':
			promise = listProjects(
				authentication.username
			);
			break;

		case 'listTags':
			promise = listTags(
				parameters.project,
				parameters.databaseName
			);
			break;

		case 'mergeUpload':
			// eslint-disable-next-line no-undef
			promise = mergeUpload(
				parameters.project,
				parameters.uploadUUID,
				parameters.databaseName
			);
			break;

		case 'projectInfo':
			promise = projectInfo(
				parameters.project
			);
			break;

		case 'renameDatabase':
			promise = renameDatabase(
				parameters.project,
				parameters.oldDatabaseName,
				parameters.newDatabaseName,
				author,
				committer
			);
			break;

		case 'saveBundleList':
			// eslint-disable-next-line no-undef
			promise = saveBundleList(
				parameters.project,
				parameters.databaseName,
				parameters.bundleListName,
				parameters.bundleListObject
			);
			break;

		case 'saveUpload':
			// eslint-disable-next-line no-undef
			promise = saveUpload(
				parameters.project,
				parameters.uploadUUID,
				parameters.databaseName
			);
			break;

		case 'setDatabaseConfiguration':
			promise = setDatabaseConfiguration(
				parameters.project,
				parameters.databaseName,
				parameters.bundleComments,
				parameters.bundleFinishedEditing,
				author,
				committer
			);
			break;

		case 'upload':
			// eslint-disable-next-line no-undef
			promise = upload(
				parameters.project,
				userInputFiles
			);
			break;

		default:
			promise = Promise.reject(new EmuError('E_INVALID_QUERY', true));
	}

	return promise;
};
