'use strict';

const bcryptjs = require('bcryptjs');
const pg = require('pg');
const sqlite3 = require('sqlite3');

const AuthenticationError = require ('./errors/authentication-error.class.js').AuthenticationError;
const config = require ('../config.js').config;
const User = require('./types/user.class.js').User;

/**
 * Check whether a given username/password combination is valid in an SQL
 * database.
 *
 * Returns a promise. If the username/password combination is found in the
 * database, the returned promise is resolved to a User object. It is rejected
 * with an AuthenticationError if the query runs fine but rejects the username/
 * password combination, or if no valid sql driver is specified. It is rejected
 * with an exception in case of a runtime error.
 */
exports.authenticateViaSQL = function (username, password) {
	if (config.sql.type === 'sqlite') {
		return authenticateViaSQLite (username, password);
	} else if (config.sql.type === 'postgresql') {
		return authenticateViaPgSQL (username, password);
	} else {
		return Promise.reject(new AuthenticationError());
	}
};

function authenticateViaPgSQL (username, password) {
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
				'SELECT * FROM users WHERE username=$1',
				[username],
				(error, result) => {
					if (error) {
						reject(error);
						return;
					}

					if (result.rows.length !== 1) {
						reject (new AuthenticationError());
						return;
					}

					client.end(function (err) {
						if (err) throw err;
					});

					if (checkPassword(password, result.rows[0]['password'])) {
						resolve(new User(username, result.rows[0]['email']));
					} else {
						reject(new AuthenticationError());
					}
				}
			);
		});
	});
}

function authenticateViaSQLite (username, password) {
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
					'SELECT * FROM users WHERE username=?',
					{1: username},
					(error, rows) => {
						if (error !== null) {
							reject(error);
							return;
						}

						if (rows.length !== 1) {
							reject(new AuthenticationError());
						} else {
							if (checkPassword(password, rows[0]['password'])) {
								resolve(new User(username, rows[0]['email']));
							} else {
								reject (new AuthenticationError());
							}
						}
					}
				);
			}
		);
	});
}

function checkPassword (givenPassword, databasePassword) {
	return bcryptjs.compareSync(givenPassword, databasePassword);
}
