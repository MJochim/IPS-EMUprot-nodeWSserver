'use strict';

//const pg = require('pg');
const sqlite3 = require('sqlite3');

const config = require('../../config.js').config;

let isHigherPermission = function (a, b) {
	if (
		b === undefined
		||
		a === 'admin'
		||
		(a === 'write' && b === 'read')
	) {
		return true;
	} else {
		return false;
	}
};

exports.listProjects = function (authenticatedUser,
                                 gitAuthor,
                                 gitCommitter,
                                 userInputFiles) { // eslint-disable-line no-unused-vars
	return new Promise ((resolve, reject) => {
		// @todo implement postgres version
		if (config.sql.type === 'postgresql') {
			reject(new Error());
			return;
		}

		let db = new sqlite3.Database(
			config.sql.filename,
			sqlite3.OPEN_READONLY,
			(error) => {
				if (error !== null) {
					reject(error);
					return;
				}


				db.all(
					'SELECT projects.name, permissions.permission ' +
					'FROM permissions ' +
					'JOIN projects ON projects.id=permissions.project ' +
                    'WHERE username=?',
					{1: authenticatedUser.username},
					(error, rows) => {
						if (error !== null) {
							reject(error);
							return;
						}

						let result = [];
						let permissions = {};

						for (let row of rows) {
							if (isHigherPermission(row.permission, permissions[row.name])) {
								permissions[row.name] = row.permission;
							}
						}

						for (let projectName of Object.keys(permissions)) {
							result.push({
								name: projectName,
								permission: permissions[projectName]
							})
						}

						resolve(result);
					}
				);
			}
		);
	});
};