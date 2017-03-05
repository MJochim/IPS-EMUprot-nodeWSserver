'use strict';

const fs = require('fs');
const path = require('path');

const BundleList = require('./types/bundle-list.class').BundleList;
const Database = require('./types/database.class.js').Database;
const Download = require('./types/download.class').Download;
const FilenameHelper = require('./filename-helper.class').FilenameHelper;
const ProjectDataset = require('./types/project-dataset.class.js').ProjectDataset;
const Session = require('./types/session.class.js').Session;
const Upload = require('./types/upload.class.js').Upload;

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
	/**
	 *
	 * @param {string} project - Project identifier
	 * @returns {Promise<ProjectDataset, Error>}
	 */
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

	/**
	 * Traverse the databases directory of a project and return an array of
	 * {@link Database} objects.
	 *
	 * The databases directory usually contains a number of subdirectories
	 * called *_emuDB. All files with different names are ignored.
	 *
	 * @param {string} project - Project identifier
	 * @param {boolean} deep - If false, the elements of the resulting
	 * {@link Database}[] only have their {@link Database#name|name} field
	 * set. If true, they are filled out completely.
	 * @returns {Promise<Database[], Error>}
	 */
	static projectDatabasesDirectory(project, deep = true) {
		return new Promise((resolve, reject) => {
			let databasesPath = FilenameHelper.projectDatabasesDirectory(project);
			let result = [];

			//
			// Read the directory, only keep files named *_emuDB and then
			// cut off the _emuDB part
			//
			let files = fs.readdirSync(databasesPath);
			let databases = files
				.filter((e) => {
					return e.endsWith('_emuDB');
				})
				.map((e) => {
					return e.substr(0, e.length - '_emuDB'.length);
				});


			if (deep) {
				//
				// Each database is read asynchronously.
				//
				let promises = [];

				for (let i = 0; i < databases.length; ++i) {
					promises.push(
						DirectoryTraversal.databaseDirectory(project, databases[i])
							.then((currentDatabase) => {
								result.push(currentDatabase);
							})
					);
				}

				//
				// Only resolve once all async actions have been completed
				Promise.all(promises)
					.then(() => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			} else {
				//
				// Synchronously create an array of Database objects that
				// only have their name field properly set (other fields are
				// left empty)
				//
				for (let i = 0; i < databases.length; ++i) {
					let currentDatabase = new Database();
					currentDatabase.name = databases[i];
					result.push(currentDatabase);
				}
				resolve(result);
			}
		});
	}

	/**
	 * Traverse the uploads directory of a project and return an array of
	 * {@link Upload} objects.
	 *
	 * The uploads directory usually contains a number of subdirectories
	 * whose names are a UUIDv4.
	 *
	 * @param {string} project - Project identifier
	 * @param {boolean} deep - If false, the elements of the resulting
	 * {@link Upload}[] only have their {@link Upload#uuid|uuid} field set. If
	 * true, they are filled out completely.
	 * @returns {Promise<Upload[], Error>}
	 */
	static projectUploadsDirectory(project, deep = true) {
		return new Promise((resolve, reject) => {
			let uploadsPath = FilenameHelper.projectUploadsDirectory(project);
			let result = [];

			// Each directory corresponds to one upload. The dir's name is
			// expected to be a UUIDv4 (which however is not verified).
			let files = fs.readdirSync(uploadsPath);

			if (deep) {
				//
				// Each upload is read asynchronously.
				//
				let promises = [];

				for (let i = 0; i < files.length; ++i) {
					promises.push(
						DirectoryTraversal.uploadDirectory(project, files[i])
							.then((currentUpload) => {
								result.push(currentUpload);
							})
					);
				}


				//
				// Only resolve once all async actions have been completed
				Promise.all(promises)
					.then(() => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			} else {
				//
				// Synchronously create an array of {@link Upload} objects that
				// only have their name field properly set (other fields are
				// left empty)
				//
				for (let i = 0; i < files.length; ++i) {
					let currentUpload = new Upload();
					currentUpload.uuid = files[i];
					result.push(currentUpload);
				}
				resolve(result);
			}
		});
	}

	/**
	 * Traverse the downloads directory of a project and return an array of
	 * {@link Download} objects.
	 *
	 * The downloads directory usually contains a number of zip files whose
	 * names resemble <database>_emuDB.<treeish>.zip. All files with
	 * different names are ignored.
	 *
	 * @param {string} project - Project identifier
	 * @returns {Promise<Download[], Error>}
	 */
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

	/**
	 * Traverse a database directory and return a {@link Database} object.
	 *
	 * A database directory usually contains a file called
	 * <name>_DBconfig.json, a subdir called bundleLists and a number of
	 * subdirs called *_ses. All other files are ignored.
	 *
	 * @param {string} project - Project identifier
	 * @param {string} database - Database identifier
	 * @returns {Promise<Database, Error>}
	 */
	static databaseDirectory(project, database) {
		return new Promise((resolve, reject) => {
			let databasePath = FilenameHelper.databaseDirectory(project, database);
			let result = new Database();
			result.name = database;

			DirectoryTraversal.databaseBundleListsDirectory(project, database)
				.then((bundleLists) => {
					result.bundleLists = bundleLists;

					//
					// Synchronously get a list of all sessions
					//
					let files = fs.readdirSync(databasePath);
					let sessions = files
						.filter((e) => {
							return e.endsWith('_ses');
						})
						.map((e) => {
							return e.substr(0, e.length - '_ses'.length);
						});


					//
					// Asynchronously read all sessions
					//
					let promises = [];
					for (let i = 0; i < sessions.length; ++i) {
						promises.push(
							DirectoryTraversal.databaseSessionDirectory(project, database, sessions[i])
								.then((session) => {
									result.sessions.push(session);
								})
						);
					}

					//
					// Only resolve once all async actions have been completed
					return Promise.all(promises);
				})
				.then(() => {
					// Sessions have now been incorporated into result

					// Load _DBconfig.json
					let configPath = FilenameHelper.databaseConfigFile(project, database);
					let json = fs.readFileSync(configPath);

					return JSON.parse(json);
				})
				.then((configuration) => {
					result.dbConfig = configuration;

					resolve(result);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	/**
	 * Traverse a session directory inside a database and return a
	 * {@link Session} object.
	 *
	 * A session directory usually contains a number of subdirs called
	 * *_bndl. All files with different names are ignored.
	 *
	 * @param {string} project - Project identifier
	 * @param {string} database - Database name
	 * @param {string} session - Session name
	 * @returns {Promise<Session, Error>}
	 */
	static databaseSessionDirectory(project, database, session) {
		// eslint-disable-next-line no-unused-vars
		return new Promise((resolve, reject) => {
			let sessionPath = FilenameHelper.databaseSessionDirectory(project, database, session);
			let result = new Session();
			result.name = session;

			let files = fs.readdirSync(sessionPath);
			result.bundles = files
				.filter((e) => {
					return e.endsWith('_bndl');
				})
				.map ((e) => {
					return e.substr(0, e.length - '_bndl'.length);
				});

			resolve(result);
		});
	}

	/**
	 * Travers a bundle lists directory inside a database and return a
	 * {@link BundleList}[].
	 *
	 * A bundleLists directory usually contains a number of files called
	 * *_bundleList.json and a number of subdirs called *_archiveLabel,
	 * which in turn contain another set of *_bundleList.json. All other
	 * files are ignored.
	 *
	 * @param {string} project - Project identifier
	 * @param {string} database - Database name
	 * @returns {Promise<BundleList[], Error>}
	 */
	static databaseBundleListsDirectory(project, database) {
		return new Promise((resolve, reject) => {
			let bundleListsPath = FilenameHelper.databaseBundleListsDirectory(project, database);
			let result = [];
			let promises = [];

			//
			// Get a list of all bundle lists on the top level (with
			// archive label == '') and a list of all archive labels
			//
			let files;
			try {
				files = fs.readdirSync(bundleListsPath);
			} catch (error) {
				resolve(result);
				return;
			}

			let bundleLists = files
				.filter ((e) => {
					return e.endsWith('_bundleList.json');
				})
				.map((e) => {
					return e.substr(0, e.length - '_bundleList.json'.length);
				});

			let archiveLabels = files
				.filter((e) => {
					return e.endsWith('_archiveLabel');
				})
				.map((e) => {
					return e.substr(0, e.length - '_archiveLabel'.length);
				});

			//
			// Asynchronously read all bundle list on the top level
			//
			for (let i = 0; i < bundleLists.length; ++i) {
				promises.push(
					DirectoryTraversal.readBundleList(project, database, '', bundleLists[i])
						.then((bundleList) => {
							result.push(bundleList);
						})
				);
			}

			//
			// Asynchronously read all archive label dirs and the bundle
			// lists inside them
			//
			for (let i = 0; i < archiveLabels.length; ++i) {
				let archiveLabelPath = FilenameHelper.databaseArchiveLabelDirectory(project, database, archiveLabels[i]);
				let filesInSubdir = fs.readdirSync(archiveLabelPath);
				let bundleListsInSubdir = filesInSubdir
					.filter((e) => {
						return e.endsWith('_bundleList.json');
					})
					.map ((e) => {
						return e.substr(0, e.length - '_bundleList.json'.length);
					});

				for (let j = 0; j < bundleListsInSubdir.length; ++j) {
					promises.push(
						DirectoryTraversal.readBundleList(project, database, archiveLabels[i], bundleListsInSubdir[j])
							.then((bundleList) => {
								result.push(bundleList);
							})
					);
				}
			}

			//
			// Only complete once all async actions have been finished
			Promise.all(promises)
				.then(() => {
					resolve(result);
				})
				.catch ((error) => {
					reject(error);
				});
		});
	}

	/**
	 * Read a *_bundleList.json file and return its contents as a
	 * {@link BundleList} object.
	 *
	 * @param {string} project - Project identifier
	 * @param {string} database - Database name
	 * @param {string} archiveLabel - Archive label
	 * @param {string} bundleList - Bundle list name
	 * @returns {Promise<BundleList, Error>}
	 */
	static readBundleList (project, database, archiveLabel, bundleList) {
		// eslint-disable-next-line no-unused-vars
		return new Promise((resolve, reject) => {
			let bundleListPath = FilenameHelper.databaseBundleListFile(project, database, archiveLabel, bundleList);
			let result = new BundleList();
			result.name = bundleList;
			result.archiveLabel = archiveLabel;

			let file = fs.readFileSync(bundleListPath, 'utf8');
			result.items = JSON.parse(file);

			resolve(result);
		});
	}

	/**
	 * Traverse an upload directory and return an {@link Upload} object.
	 *
	 * @param {string} project - Project identifier
	 * @param {string} upload - Upload identifier
	 * @param {boolean} deep - If false, the resulting {@link Upload} object
	 * does not have its {@link Upload#sessions|session} field set. If true,
	 * it is filled out completely.
	 * @returns {Promise<Upload, Error>}
	 */
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

	/**
	 * Traverse the database directory of an upload and find the sessions in
	 * it. Returns their names (without the _ses part) as a string[].
	 * Filenames not ending in _ses are ignored.
	 *
	 * @param {string} project - Project identifier
	 * @param {string} upload - Upload identifier
	 * @param {string} database - Database name
	 * @returns {Promise<string[], Error>}
	 */
	static uploadDatabaseDirectory(project, upload, database) {
		// eslint-disable-next-line no-unused-vars
		return new Promise((resolve, reject) => {
			let databasePath = FilenameHelper.uploadDatabaseDirectory(project, upload, database);

			let files = fs.readdirSync(databasePath);

			let sessions = files
				.filter((e) => {
					return e.endsWith('_ses');
				})
				.map((e) => {
					return e.substr(0, e.length - '_ses'.length);
				});

			resolve(sessions);
		});
	}
};
