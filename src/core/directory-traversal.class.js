"use strict";

const fs = require('fs');
const path = require('path');

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
		return Promise.resolve([]);
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