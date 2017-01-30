"use strict";

const DirectoryTraversal = require('../../core/directory-traversal.class').DirectoryTraversal;

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
		// @todo lock project

		// Find all things in the project directory
		let result = DirectoryTraversal.projectDirectory(project);

		// Project name and description
		result.name = project;

		resolve(result);
	});
};