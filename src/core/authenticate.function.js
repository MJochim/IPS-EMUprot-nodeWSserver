"use strict";

const authenticateViaLDAP = require('./authenticate-via-ldap.function.js').authenticateViaLDAP;
const authenticateViaSQL = require('./authenticate-via-sql.function.js').authenticateViaSQL;
const AuthenticationError = require('./errors/authentication-error.class.js').AuthenticationError;

/**
 * Authentication: Checks whether the <password> for <username> is correct.
 *
 * Returns a promise.
 *
 * The promise is resolved to a User object if authentication succeeds via LDAP
 * or via SQL.
 *
 * The promise is rejected with an AuthenticationError if both the LDAP and the
 * SQL query function correctly but do not accept the username/password
 * combination.
 *
 * The promise is rejected with an exception if a runtime error occurs.
 */
exports.authenticate = function (username, password) {
	return authenticateViaLDAP (username, password)
		.catch((error) => {
			if (error instanceof AuthenticationError) {
				return authenticateViaSQL (username, password);
			} else {
				throw error;
			}
		});
}
