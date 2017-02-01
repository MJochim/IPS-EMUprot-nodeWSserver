"use strict";

const path = require('path');

const config = require('../config.js').config;

exports.FilenameHelper = class FilenameHelper {
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