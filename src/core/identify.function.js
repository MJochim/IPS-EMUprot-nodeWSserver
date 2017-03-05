"use strict";

const pg = require('pg');
const sqlite3 = require('sqlite3');

const AuthenticationError = require ('./errors/authentication-error.class.js').AuthenticationError;
const config = require ('../config.js').config;
const User = require('./types/user.class.js').User;

/**
 * Check if a given secret authToken exists and if it does, return a User
 * object to identify the account associated with the token.
 *
 * Returns a promise. If the authToken is valid, the promise is resolved to
 * a User object. It is rejected with an AuthenticationError if the token
 * does not exist, or if no valid sql driver is specified. It is rejected
 * with an exception in case of a runtime error.
 */
exports.identify = function (authToken) {
	if (config.sql.type === 'sqlite') {
		return identifyViaSQLite (authToken);
	} else if (config.sql.type === 'postgresql') {
		return identifyViaPgSQL (authToken);
	} else {
		return Promise.reject(new AuthenticationError());
	}
};

function identifyViaPgSQL (authToken) {
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
				'SELECT * FROM authTokens WHERE token=$1', // @todo regard validUntil
				[authToken],
				(error, result) => {
					if (error) {
						reject(error);
						return;
					}

					if (result.rows.length < 1) {
						reject (new AuthenticationError());
						return;
					}

					client.end(function (err) {
						if (err) throw err;
					});

					resolve(new User(result.rows[0].userID, result.rows[0].email));
				}
			);
  		});
	});
}

function identifyViaSQLite (authToken) {
	return new Promise ((resolve, reject) => {
		let db = new sqlite3.Database(
			config.sql.filename,
			sqlite3.OPEN_READONLY,
			(error) => {
				if (error !== null) {
					reject(error);
					return;
				}

				db.all("SELECT * FROM authTokens WHERE token=?", {1: authToken}, (error, rows) => { // @todo regard validUntil
					if (error !== null) {
						reject(error);
						return;
					}

					if (rows.length < 1) {
						reject(new AuthenticationError());
					} else {
						resolve(new User(rows[0]['userID'], rows[0]['email']));
					}
				});
			}
		);
	});
}
