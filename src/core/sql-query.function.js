'use strict';

const pg = require('pg');
const sqlite3 = require('sqlite3');

const GenericSQLError = require('./errors/generic-sql-error.class').GenericSQLError;
const config = require('../config').config;
const SQLInvalidParametersError = require('./errors/sql-invalid-parameters-error.class').SQLInvalidParametersError;
const SQLUnknownDatabaseTypeError = require('./errors/sql-unknown-database-type-error.class').SQLUnknownDatabaseTypeError;

/**
 * Execute an SQL query and return the result array.
 *
 * Queries often comprise a dynamic and a static part: In
 * INSERT INTO table SET fieldA='wow' WHERE id=15
 * the number 15 and the string 'wow' are (usually) the dynamic parts, possibly
 * user-supplied.
 *
 * Construct the query as an array of strings that represent the static parts.
 * Pass in the dynamic parts as an array (the type of which can be mixed).
 * For the above example, call:
 *
 * sqlQuery([
 *      'INSERT INTO table SET fieldA =',
 *      'WHERE ID ='
 * ], [
 *      'wow',
 *      15
 * ]);
 *
 * This function will then exploit the database driver's binding mechanism
 * to connect the static and the dynamic parts.
 *
 * DO NOT CONCATENATE STATIC PARTS AND USER-SUPPLIED VALUES IN THE CALLER.
 * SQL INJECTION!
 *
 * If different database systems call for specific queries, then instead
 * of passing in one string array for the static parts, you pass in an
 * object containing one string array for each database system instead:
 *
 * sqlQuery({sqlite: ['...', '...'], pgsql: ['...', '...']}, ['wow', 15]);
 *
 * @param query The static parts of the query, either a string array or an
 * object of string arrays.
 * @param parameters The dynamic parts of the query.
 * @returns {Promise<Array>}
 */
exports.sqlQuery = function (query, parameters) {
	let specificQuery = query;

	if (typeof query === 'object') {
		if (query.hasOwnProperty(config.sql.type)) {
			specificQuery = query[config.sql.type];
		} else {
			return Promise.reject(new SQLInvalidParametersError());
		}
	}

	if (typeof specificQuery !== 'string') {
		return Promise.reject(new SQLInvalidParametersError());
	}

	if (config.sql.type === 'sqlite') {
		return sqliteQuery(specificQuery, parameters);
	} else if (config.sql.type === 'postgresql') {
		return pgsqlQuery(specificQuery, parameters);
	} else {
		return Promise.reject(new SQLUnknownDatabaseTypeError(config.sql.type));
	}
};

let pgsqlQuery = function (query, parameters) {
	return new Promise((resolve, reject) => {
		let client;
		try {
			client = new pg.Client({
				host: config.sql.host,
				port: config.sql.port,
				user: config.sql.user,
				password: config.sql.password,
				database: config.sql.database,
				ssl: 'require'
			});
		} catch (error) {
			reject (new GenericSQLError(error));
			return;
		}

		client.connect((error) => {
			if (error) {
				reject(new GenericSQLError(error));
				return;
			}

			//
			// Compose query
			//
			if (
				!Array.isArray(query)
				|| !Array.isArray(parameters)
				|| (query.length !== parameters.length && query.length !== parameters.length + 1)
			) {
				reject(new SQLInvalidParametersError());
				return;
			}

			let composedQuery = '';

			for (let i = 0; i < query.length; ++i) {
				composedQuery += query[i];
				if (i < parameters.length) {
					composedQuery += '$' + (i + 1);
				}
			}

			client.query(
				composedQuery,
				[parameters],
				(error, result) => {
					if (error) {
						reject(new GenericSQLError(error));
						return;
					}

					client.end((error) => {
						if (error) {
							reject(new GenericSQLError(error));
						} else  {
							resolve (result.rows);
						}
					});
				}
			);
		});
	});
};

let sqliteQuery = function (query, parameters) {
	return new Promise((resolve, reject) => {
		let db = new sqlite3.Database(
			config.sql.filename,
			sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
			(error) => {
				if (error !== null) {
					reject(new GenericSQLError(error));
					return;
				}

				//
				// Compose query
				//
				if (
					!Array.isArray(query)
					|| !Array.isArray(parameters)
					|| (query.length !== parameters.length && query.length !== parameters.length + 1)
				) {
					reject(new SQLInvalidParametersError());
					return;
				}

				let composedQuery = '';

				for (let i = 0; i < query.length; ++i) {
					composedQuery += query[i];
					if (i < parameters.length) {
						composedQuery += '?';
					}
				}

				let composedParameters = {};

				for (let i = 0; i < parameters.length; ++i) {
					composedParameters[i + 1] = parameters[i];
				}

				db.all(
					composedQuery,
					composedParameters,
					(error, rows) => {
						if (error !== null) {
							reject(new GenericSQLError(error));
							return;
						}

						resolve(rows);
					}
				);
			}
		);
	});
};
