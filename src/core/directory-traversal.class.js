"use strict";

const fs = require('fs');
const path = require('path');
var Upload = require("./upload.class.js").Upload;

const Download = require('./download.class').Download;
const FilenameHelper = require('./filename-helper.class').FilenameHelper;
const ProjectDataset = require("./project-dataset.class.js").ProjectDataset;

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

	static projectUploadsDirectory(project) {
		return new Promise.resolve((resolve, reject) => {
			let uploadsPath = FilenameHelper.projectUploadsDirectory(project);
			let result = [];

			fs.readdir(uploadsPath, (error, files) => {
				try {
					if (error !== null) {
						reject(error);
						return;
					}

					// Each directory corresponds to one upload. The dir's name is
					// expected to be a UUIDv4 (which however is not verified).
					for (let i = 0; i < files.length; ++i) {
						let currentUpload = new Upload();
						currentUpload.uuid = files[i];

						let stat = fs.statSync(path.join(
							uploadsPath,
							files[i]
						));
						// @todo does fs.statSync() return or throw on error?

						// @todo ensure proper format of date
						currentUpload.date = stat.mtime.toString();

						/*
						 $databaseName = findDatabaseInUpload($directory . '/' . $entry);

						 if ($databaseName->success !== true) {
						 $upload->name = 'INVALID_UPLOAD_' . $databaseName->data;
						 $upload->sessions = array();
						 } else {
						 $upload->name = $databaseName->data;
						 $databaseDir = $directory . '/' . $entry . '/data/' .
						 $upload->name . '_emuDB';

						 // Read the sessions contained in the upload
						 $db = readDatabase($databaseDir);
						 if ($db->success !== true) {
						 $upload->name = 'INVALID_UPLOAD';
						 $upload->sessions = array();
						 } else {
						 $upload->sessions = $db->data->sessions;
						 }
						 }

						 */

						result.push(currentUpload);
					}

					resolve(result);
				} catch (error) {
					reject(error);
				}
			});
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
						// @todo does fs.statSync() return or throw on error?

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
};