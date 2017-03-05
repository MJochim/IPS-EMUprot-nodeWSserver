'use strict';

const queryTable = require('./query-table.json');
const UserInputError = require('../../core/errors/user-input-error.class.js').UserInputError;

/**
 * Inspects a client-supplied parameters object and makes sure they are all
 * valid.
 *
 * If any parameter is invalid, or if an unused parameter is
 * supplied, a UserInputError is thrown.
 *
 * If everything is fine, an object with the fields authentication, query,
 * and parameters is returned.
 *
 * @param parameters
 */
exports.validateUserInput = function (parameters) {

	////////////////////////////
	// Authentication parameters
	//
	let authentication = {};

	for (let allowedParam of queryTable.authenticationParameters) {
		if (parameters.hasOwnProperty(allowedParam.name)) {
			// This will throw an exception and we will not catch it.
			authentication[allowedParam.name] = validateParameter(parameters[allowedParam.name], allowedParam.type, allowedParam.name);
			delete parameters[allowedParam.name];
		}
	}


	////////////////////////////
	// Query-specific parameters
	//
	let query = validateParameter(parameters.query, queryTable.regexForQuery, 'query');
	delete parameters.query;

	if (!queryTable.queries[query]) {
		throw new UserInputError('query');
	}

	let validParameters = {};
	let requiredParameters = queryTable.queries[query].parameters;
	for (let requiredParam of requiredParameters) {
		if (!parameters.hasOwnProperty(requiredParam.name)) {
			throw new UserInputError(requiredParam.name);
		}

		validParameters[requiredParam.name] = validateParameter(parameters[requiredParam.name], requiredParam.type, requiredParam.name);
		delete parameters[requiredParam.name];
	}


	/////////////////////////
	// Superfluous parameters
	//
	if (Object.keys(parameters).length > 0) {
		throw new UserInputError(Object.keys(parameters)[0]);
	}


	return {
		authentication: authentication,
		query: query,
		parameters: validParameters
	};
};

/**
 * Check whether the given value matches the given type.
 *
 * Returns the value (possibly after transforming it) or throws a UserInputError
 *
 * The name is only used to feed it into the UserInputError.
 */
let validateParameter = function (value, type, name) {
	let regex;

	switch (type) {
		case 'BOOL':
			// convert string to boolean
			return (value === 'true');

		case 'JSON':
			try {
				JSON.parse(value);
				return value;
			} catch (error) {
				if (error instanceof SyntaxError) {
					throw new UserInputError(name);
				} else {
					throw error;
				}
			}

		default:
			if (typeof value !== 'string') {
				throw new UserInputError(name);
			}

			regex = new RegExp(queryTable.regex[type]);
			if (value.search(regex) === 0) {
				return value;
			} else {
				throw new UserInputError(name);
			}
	}
};
