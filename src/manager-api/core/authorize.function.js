'use strict';

const pg = require('pg');
const sqlite3 = require('sqlite3');

const AuthorizationError = require('../../core/errors/authorization-error.class.js').AuthorizationError;
const config = require('../../config.js').config;
const queryTable = require('./query-table.json');

/**
 * Authorization: Checks whether <username> is allowed to perform <query> on <project>.
 *
 * Returns a promise. The promise is resolved, without a value, if authorization
 * passes. The promise is rejected with an AuthorizationError if authorization
 * does not pass. The promise is rejected with an exception in case of a runtime
 * error.
 *
 * Note that for a few (very few) <queries>, <project> is left undefined.
 */
exports.authorize = function (username, query, project) {
	return new Promise((resolve, reject) => {
		if (!queryTable.queries[query]) {
			return new AuthorizationError();
		}
		let requiredPermission = queryTable.queries[query].requiredPermission;

		if (requiredPermission === null) {
			resolve();
			return;
		}

		let promise;

		if (config.sql.type === 'sqlite') {
			promise = authorizeViaSQLite (username, project);
		} else if (config.sql.type === 'postgresql') {
			promise = authorizeViaPgSQL (username, project);
		}

		promise.then((permissions) => {
			if (permissions.includes(requiredPermission)) {
				resolve();
			} else {
				reject(new AuthorizationError());
			}
		})
		.catch((error) => {
			reject(error);
		});
	});
};

function authorizeViaPgSQL (username, project) {
	return new Promise ((resolve, reject) => {
		let client = new pg.Client({
			host: config.sql.host,
			port: config.sql.port,
			user: config.sql.user,
			password: config.sql.password,
			database: config.sql.database
		});

		client.connect((error) => {
			if (error) {
				reject(error);
				return;
			}

			client.query(
                'SELECT permission FROM permissions ' +
                'JOIN projects ON projects.id=permissions.project ' +
                'WHERE username=$1 AND projects.name=$2',
				[username, project],
				(error, result) => {
					if (error) {
						reject(error);
						return;
					}

					if (result.rows.length < 1) {
						reject (new AuthorizationError());
						return;
					}

					client.end(function (err) {
						if (err) throw err;
					});

					resolve (result.rows.map(x => x.permission));
				}
			);
		});
	});
}

function authorizeViaSQLite (username, project) {
	return new Promise ((resolve, reject) => {
		let db = new sqlite3.Database(
			config.sql.filename,
			sqlite3.OPEN_READONLY,
			(error) => {
				if (error !== null) {
					reject(error);
					return;
				}


				db.all(
					'SELECT permission FROM permissions ' +
					'JOIN projects ON projects.id=permissions.project ' +
                    'WHERE username=? AND projects.name=?',
					{1: username, 2: project},
					(error, rows) => {
						if (error !== null) {
							reject(error);
							return;
						}

						if (rows.length < 1) {
							reject(new AuthorizationError());
						} else {
							resolve(rows.map(x => x.permission));
						}
					}
				);
			}
		);
	});
}
