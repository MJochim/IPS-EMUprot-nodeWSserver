'use strict';

const ldapjs = require('ldapjs');

const AuthenticationError = require ('./errors/authentication-error.class.js').AuthenticationError;
const config = require ('../config.js').config;
const User = require('./types/user.class.js').User;

/**
 * Check whether a given username/password combination is valid in an LDAP
 * directory.
 *
 * Returns a promise. Tries to bind against the LDAP directory and if that
 * succeeds, the returned promise is resolved to a User object. It is rejected
 * in all other cases.
 */
exports.authenticateViaLDAP = function (username, password) {
	return new Promise ((resolve, reject) => {
		if (!config.ldap.enabled) {
			reject (new AuthenticationError());
			return;
		}

		if (!password) {
			reject (new AuthenticationError());
			return;
		}

		// Construct the DN (distinguished name) to bind to the directory server
		// with
		let bindDN = config.ldap.bindDNLeft + username + config.ldap.bindDNRight;

		let ldapClient = ldapjs.createClient({
			url: config.ldap.address
			// log: log // @todo the nodejs-ws-server includes Bunyan. Do we, too?
		});

		ldapClient.on('error', (event) => {
			reject(event);
		});

		// @todo check ldapClient.bind() timeout!!!
		// Try to bind
		ldapClient.bind(bindDN, password, function (error) {
			if (error) {
				ldapClient.unbind();
				if (error instanceof ldapjs.InvalidCredentialsError) {
					reject(new AuthenticationError());
				} else {
					reject(error);
				}
			} else {
				ldapClient.unbind();
				resolve(new User(username, 'email-na@example.com'));
			}
		});
	});
};
