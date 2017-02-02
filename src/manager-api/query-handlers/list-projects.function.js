'use strict';

const pg = require('pg');
const sqlite3 = require('sqlite3');

const config = require('../../config.js').config;

exports.listProjects = function (username) {
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
					'SELECT projects.name, authorizations.level FROM authorizations ' +
					'JOIN projects ON projects.id=authorizations.project ' +
                    'WHERE username=?',
					{1: username},
					(error, rows) => {
						if (error !== null) {
							reject(error);
							return;
						}
						
						resolve(rows);
					}
				);
			}
		);
	});
}
