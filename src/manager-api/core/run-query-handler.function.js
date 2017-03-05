'use strict';

const nodegit = require('nodegit');

const config = require('../../config').config;
const EmuError = require('../../core/errors/emu-error.class.js').EmuError;
const queryTable = require('./query-table.json');

const queryHandlers = {
	addTag: require('../query-handlers/add-tag.function').addTag,
	//createArchive
	deleteBundleList: require('../query-handlers/delete-bundle-list.function').deleteBundleList,
	//deleteUpload
	//downloadDatabase
	editBundleList: require('../query-handlers/edit-bundle-list.function.js').editBundleList,
	//fastForward
	listCommits: require('../query-handlers/list-commits.function.js').listCommits,
	listProjects: require('../query-handlers/list-projects.function.js').listProjects,
	listTags: require('../query-handlers/list-tags.function.js').listTags,
	//mergeUpload
	projectInfo: require('../query-handlers/project-info.function.js').projectInfo,
	renameDatabase: require('../query-handlers/rename-database.function.js').renameDatabase,
	//saveBundleList
	//saveUpload
	setDatabaseConfiguration: require('../query-handlers/set-database-configuration.function.js').setDatabaseConfiguration,
	//upload
};

/**
 * This function only looks at the query (a client-supplied string) and
 * calls the appropriate function.
 *
 * IMPORTANT: userInput must be validated, and the user must be authenticated
 * and authorized before calling this function.
 */
exports.runQueryHandler = function (authenticatedUser, query, parameters, userInputFiles) {
	////////////////////////////////////
	// Prepare signatures for git commit
	//
	let author;
	let committer;

	try {
		author = nodegit.Signature.now(authenticatedUser.username, authenticatedUser.email);
		committer = nodegit.Signature.now(config.git.committerName, config.git.committerEmail);
	} catch (error) {
		return Promise.reject(error);
	}

	if (author === null || committer === null) {
		return Promise.reject(new Error('Creating commit signatures failed.'));
	}


	/////////////////////////////
	// Get query handler function
	//
	let queryInfo = queryTable.queries[query];
	if (!queryInfo) {
		return Promise.reject(new EmuError('E_INVALID_QUERY', true));
	}

	let handlerFunction = queryHandlers[query].bind(
		null,
		authenticatedUser,
		author,
		committer,
		userInputFiles
	);

	for (let param of queryInfo.parameters) {
		handlerFunction = handlerFunction.bind(null, parameters[param.name]);
	}

	return handlerFunction();
};
