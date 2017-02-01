"use strict";

const fs = require('fs');
const path = require('path');
var Upload = require("./upload.class.js").Upload;

const Download = require('./download.class').Download;
const FilenameHelper = require('./filename-helper.class').FilenameHelper;
const ProjectDataset = require("./project-dataset.class.js").ProjectDataset;

/**
 * A collection of asynchronous functions that recursively traverse a certain
 * kind of directory (e.g. a directory containing a database, or a session).
 *
 * Some of them have an option deep which, if set to false, prevents
 * recursing down the directory tree. In that case, only the information
 * visible in the top level directory is returned.
 *
 * @type {DirectoryTraversal}
 */
exports.DirectoryTraversal = class DirectoryTraversal {
	static projectDirectory(project) {
		return new Promise((resolve, reject) => {
			let result = new ProjectDataset();

			DirectoryTraversal.projectDatabasesDirectory(project)
				.then((databases) => {
					result.databases = databases;
					return DirectoryTraversal.projectUploadsDirectory(project);
				})
				.then((uploads) => {
					result.uploads = uploads;
					return DirectoryTraversal.projectDownloadsDirectory(project);
				})
				.then((downloads) => {
					result.downloads = downloads;
					resolve(result);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	static projectDatabasesDirectory(project) {
		return Promise.resolve([]);
	}

	static projectUploadsDirectory(project, deep = true) {
		return new Promise((resolve, reject) => {
			let uploadsPath = FilenameHelper.projectUploadsDirectory(project);
			let result = [];

			// Each directory corresponds to one upload. The dir's name is
			// expected to be a UUIDv4 (which however is not verified).
			let files = fs.readdirSync(uploadsPath);

			if (deep) {
				let promises = [];

				for (let i = 0; i < files.length; ++i) {
					promises.push(
						DirectoryTraversal.uploadDirectory(project, files[i])
							.then((currentUpload) => {
								result.push(currentUpload);
							})
					);
				}

				Promise.all(promises)
					.then(() => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			} else {
				for (let i = 0; i < files.length; ++i) {
					let currentUpload = new Upload();
					currentUpload.uuid = files[i];
					result.push(currentUpload);
				}
				resolve(result);
			}
		});
	}

	static projectDownloadsDirectory(project) {
		return new Promise((resolve, reject) => {
			let downloadsPath = FilenameHelper.projectDownloadsDirectory(project);
			let result = [];

			fs.readdir(downloadsPath, (error, files) => {
				try {
					if (error !== null) {
						reject(error);
						return;
					}

					// Each zip file in the directory corresponds to one download.
					// The file names are made up of three components (database
					// name, tree-ish, extension)
					for (let i = 0; i < files.length; ++i) {
						// none of the three components can contain a dot
						let nameComponents = files[i].split('.');

						if (nameComponents.length !== 3) {
							continue;
						}

						let dbName = nameComponents[0];
						let treeish = nameComponents[1];
						let extension = nameComponents[2];

						if (extension !== 'zip') {
							continue;
						}

						if (!dbName.endsWith('_emuDB')) {
							continue;
						}

						let currentDownload = new Download();
						currentDownload.database = dbName.substr(0, dbName.length - 6);
						currentDownload.treeish = treeish;

						let stat = fs.statSync(path.join(
							downloadsPath,
							files[i]
						));

						currentDownload.size = stat.size;
						// @todo ensure proper format of date
						currentDownload.date = stat.mtime.toString();

						result.push(currentDownload);
					}

					resolve(result);
				} catch (error) {
					reject(error);
				}
			});
		});
	}

	static uploadDirectory(project, upload, deep = true) {
		return new Promise((resolve, reject) => {
			let uploadDataPath = FilenameHelper.uploadDataDirectory(project, upload);
			let result = new Upload();
			result.uuid = upload;

			//
			// uploadDataPath contains everything that was in the user's
			// uploaded zip file. Normally, this should only be one subdir
			// which is an emuDB.
			//
			let files;
			try {
				files = fs.readdirSync(uploadDataPath);
			} catch (error) {
				result.error = 'E_DATA_DIR';
				resolve(result);
				return;
			}


			//
			// We are looking for exactly one sub-directory whose
			// name ends with _emuDB
			//
			let databaseName = null;

			for (let i = 0; i < files.length; ++i) {
				if (files[i].endsWith('_emuDB')) {
					if (databaseName !== null) {
						result.error = 'E_MULTIPLE_DATABASES';
						resolve(result);
						return;
					}

					databaseName = files[i];
					databaseName = databaseName.substr(0, databaseName.length - '_emuDB'.length);
				}
			}

			if (databaseName === null) {
				result.error = 'E_NO_DATABASE';
				resolve(result);
				return;
			}

			//
			// We can now be sure that the upload contains exactly
			// one emuDB, whose name is saved in databaseName.
			//

			result.name = databaseName;

			let stat = fs.statSync(FilenameHelper.uploadDatabaseDirectory(project, upload, result.name));

			// @todo ensure proper format of date
			result.date = stat.mtime.toString();

			if (deep) {
				DirectoryTraversal.uploadDatabaseDirectory(project, upload, databaseName)
					.then((sessions) => {
						result.sessions = sessions;
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			} else {
				resolve(result);
			}
		});
	}

	//@todo maybe this and databaseDirectory() should share the same code base
	static uploadDatabaseDirectory(project, upload, database) {
		return new Promise((resolve, reject) => {
			let databasePath = FilenameHelper.uploadDatabaseDirectory(project, upload, database);

			let files = fs.readdirSync(databasePath);

			let sessions = files
				.filter((e) => {
					return e.endsWith('_ses');
				})
				.map((e) => {
					return e.substr(0, e.length - '_ses'.length)
				});

			resolve(sessions);
		});
	}
};