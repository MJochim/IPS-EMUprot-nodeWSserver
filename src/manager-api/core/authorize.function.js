'use strict';

const pg = require('pg');
const sqlite3 = require('sqlite3');

const AuthorizationError = require('../../core/authorization-error.class.js').AuthorizationError;
const config = require('../../config.js').config;

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
		if (query === 'listProjects') {
			resolve();
			return;
		}

		let promise;

		if (config.sql.type === 'sqlite') {
			promise = authorizeViaSQLite (username, project);
		} else if (config.sql.type === 'postgresql') {
			promise = authorizeViaPgSQL (username, project);
		}

		promise
			.then((level) => {
				switch (query) {
					case 'downloadDatabase':
					case 'listCommits':
					case 'listTags':
					case 'login':
					case 'projectInfo':
						if (level === 'rw' || level === 'ro') {
							resolve();
						} else {
							reject(new AuthorizationError());
						}

						break;

					case 'addTag':
					case 'createArchive':
					case 'deleteBundleList':
					case 'deleteUpload':
					case 'editBundleList':
					case 'fastForward':
					case 'mergeUpload':
					case 'renameDatabase':
					case 'saveBundleList':
					case 'setDatabaseConfiguration':
					case 'saveUpload':
					case 'upload':
						if (level === 'rw') {
							resolve();
						} else {
							reject(new AuthorizationError());
						}

						break;

					default:
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
                'SELECT * FROM authorizations ' +
                'JOIN projects ON projects.id=authorizations.project ' +
                'WHERE username=$1 AND projects.name=$2',
				[username, project],
				(error, result) => {
					if (error) {
						reject(error);
						return;
					}

					if (result.rows.length !== 1) {
						reject (new AuthorizationError());
						return;
					}

					client.end(function (err) {
						if (err) throw err;
					});

					resolve (result.rows[0]['level']);
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
					'SELECT * FROM authorizations ' +
					'JOIN projects ON projects.id=authorizations.project ' +
                    'WHERE username=? AND projects.name=?',
					{1: username, 2: project},
					(error, rows) => {
						if (error !== null) {
							reject(error);
							return;
						}

						if (rows.length !== 1) {
							reject(new AuthorizationError());
						} else {
							resolve(rows[0]['level']);
						}
					}
				);
			}
		);
	});
}
