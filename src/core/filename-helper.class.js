"use strict";

const path = require('path');

const config = require('../config.js').config;

exports.FilenameHelper = class FilenameHelper {
	//
	// Paths that belong to the whole project
	//
	static projectDirectory(project) {
		return path.join(
			config.dataDirectory,
			project
		);
	}

	static projectDatabasesDirectory (project) {
		return path.join(
			FilenameHelper.projectDirectory(project),
			'databases'
		);
	}

	static projectUploadsDirectory (project) {
		return path.join(
			FilenameHelper.projectDirectory(project),
			'uploads'
		);
	}

	static projectDownloadsDirectory (project) {
		return path.join(
			FilenameHelper.projectDirectory(project),
			'downloads'
		);
	}

	//
	// Paths that belong to a given database
	//
	static databaseDirectory (project, database) {
		return path.join(
			FilenameHelper.projectDatabasesDirectory(project),
			database + '_emuDB'
		);
	}

	static databaseConfigFile (project, database) {
		return path.join(
			FilenameHelper.databaseDirectory (project, database),
			database + '_DBconfig.json'
		);
	}

	static databaseBundleListsDirectory (project, database) {
		return path.join(
			FilenameHelper.databaseDirectory(project, database),
			'bundleLists'
		);
	}

	static databaseArchiveLabelDirectory (project, database, archiveLabel) {
		if (archiveLabel) {
			return path.join(
				FilenameHelper.databaseBundleListsDirectory(project, database),
				archiveLabel + '_archiveLabel'
			);
		} else {
			return FilenameHelper.databaseBundleListsDirectory(project, database);
		}
	}

	static databaseBundleListFile (project, database, archiveLabel, bundleList) {
		return path.join(
			FilenameHelper.databaseArchiveLabelDirectory(project, database, archiveLabel),
			bundleList + 'bundleList.json'
		)
	}

	static databaseSessionDirectory (project, database, session) {
		return path.join(
			FilenameHelper.databaseDirectory (project, database),
			session + '_ses'
		);
	}

	static databaseBundleDirectory (project, database, session, bundle) {
		return path.join(
			FilenameHelper.databaseSessionDirectory (project, database, session),
			bundle + '_bndl'
		);
	}

	//
	// Paths that belong to a given upload
	//
	static uploadDirectory (project, upload) {
		return path.join(
			FilenameHelper.projectUploadsDirectory(project),
			upload
		);
	}

	static uploadDataDirectory (project, upload) {
		return path.join(
			FilenameHelper.uploadDirectory(project, upload),
			'data'
		);
	}

	static uploadDatabaseDirectory (project, upload, database) {
		return path.join(
			FilenameHelper.uploadDataDirectory(project, upload),
			database + '_emuDB'
		)
	}
};