"use strict";

const path = require('path');

const config = require('../config.js').config;

exports.FilenameHelper = class FilenameHelper {
	//
	// Paths that belong to the whole project
	//
	static projectDirectory(project, absolute = true) {
		if (absolute) {
			return path.join(
				config.dataDirectory,
				project
			);
		} else {
			return '';
		}
	}

	static projectDatabasesDirectory(project, absolute = true) {
		return path.join(
			FilenameHelper.projectDirectory(project, absolute),
			'databases'
		);
	}

	static projectUploadsDirectory(project, absolute = true) {
		return path.join(
			FilenameHelper.projectDirectory(project, absolute),
			'uploads'
		);
	}

	static projectDownloadsDirectory(project, absolute = true) {
		return path.join(
			FilenameHelper.projectDirectory(project, absolute),
			'downloads'
		);
	}

	//
	// Paths that belong to a given database
	//
	static databaseDirectory(project, database, absolute = true) {
		if (absolute) {
			return path.join(
				FilenameHelper.projectDatabasesDirectory(project),
				database + '_emuDB'
			);
		} else {
			return '';
		}
	}

	static databaseConfigFile(project, database, absolute = true) {
		return path.join(
			FilenameHelper.databaseDirectory(project, database, absolute),
			database + '_DBconfig.json'
		);
	}

	static databaseBundleListsDirectory(project, database, absolute = true) {
		return path.join(
			FilenameHelper.databaseDirectory(project, database, absolute),
			'bundleLists'
		);
	}

	static databaseArchiveLabelDirectory(project, database, archiveLabel, absolute = true) {
		if (archiveLabel) {
			return path.join(
				FilenameHelper.databaseBundleListsDirectory(project, database, absolute),
				archiveLabel + '_archiveLabel'
			);
		} else {
			return FilenameHelper.databaseBundleListsDirectory(project, database, absolute);
		}
	}

	static databaseBundleListFile(project, database, archiveLabel, bundleList, absolute = true) {
		return path.join(
			FilenameHelper.databaseArchiveLabelDirectory(project, database, archiveLabel, absolute),
			bundleList + '_bundleList.json'
		)
	}

	static databaseSessionDirectory(project, database, session, absolute = true) {
		return path.join(
			FilenameHelper.databaseDirectory(project, database, absolute),
			session + '_ses'
		);
	}

	static databaseBundleDirectory(project, database, session, bundle, absolute = true) {
		return path.join(
			FilenameHelper.databaseSessionDirectory(project, database, session, absolute),
			bundle + '_bndl'
		);
	}

	//
	// Paths that belong to a given upload
	//
	static uploadDirectory(project, upload, absolute = true) {
		if (absolute) {
			return path.join(
				FilenameHelper.projectUploadsDirectory(project),
				upload
			);
		} else {
			return '';
		}
	}

	static uploadDataDirectory(project, upload, absolute = true) {
		return path.join(
			FilenameHelper.uploadDirectory(project, upload, absolute),
			'data'
		);
	}

	static uploadDatabaseDirectory(project, upload, database, absolute = true) {
		return path.join(
			FilenameHelper.uploadDataDirectory(project, upload, absolute),
			database + '_emuDB'
		)
	}
};