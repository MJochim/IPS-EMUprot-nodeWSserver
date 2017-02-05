'use strict';

const DirectoryTraversal = require('../../core/directory-traversal.class').DirectoryTraversal;
const lock = require('../../core/lock');

/**
 * Compile a ProjectDataset object containing info about all databases,
 * uploads and downloads of a given project, as well as the project's name
 * and description.
 *
 * @param project The name of the project.
 * @returns {Promise}
 */
exports.projectInfo = function (project) {
	return new Promise((resolve, reject) => {
		lock.lockProject(project)
			.then((lockID) => {
				// Find all things in the project directory
				DirectoryTraversal.projectDirectory(project)
					.then((projectObject) => {
						projectObject.name = project;
						lock.unlockProject(project, lockID);
						resolve(projectObject);
					})
					.catch((error) => {
						lock.unlockProject(project, lockID);
						reject(error);
					});
			})
			.catch((error) => {
				reject(error);
			});

	});
};