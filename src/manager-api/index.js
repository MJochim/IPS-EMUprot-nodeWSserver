//////////////////////////////////////////////////
//
// HTTP server to provide the emuDB Manager API
//
// In this file we do this:
// - Client is authenticated and authorized
// - Client-provided data is validated
// - Client request is passed on to a handler function
//
//////////////////////////////////////////////////

'use strict';

const formidable = require('formidable');
const http = require('http');

const authenticate = require('../core/authenticate.function.js').authenticate;
const authorize = require('./core/authorize.function.js').authorize;
const config = require('../config.js').config;
const EmuError = require('../core/errors/emu-error.class.js').EmuError;
const identify = require('../core/identify.function.js').identify;
const runQueryHandler = require('./core/run-query-handler.function.js').runQueryHandler;
const User = require('../core/types/user.class.js').User;
const validateUserInput = require('./core/validate-user-input.function.js').validateUserInput;

function httpConnectionCallback(request, response) {
	response.setHeader('Access-Control-Allow-Origin', '*');
	// @todo  handle request.onError and response.onError

	let userInputAuthentication;
	let userInputFiles;
	let userInputParameters;
	let userInputQuery;

	let authenticatedUser = new User();

	//
	// The Formidable library parses the HTTP body for us (POST and files).
	// It is not Promise-based, so we need to transform it ourselves.
	//
	let formidablePromise = new Promise((resolve, reject) => {
		let form = new formidable.IncomingForm();

		form.parse(request, (error, fields, files) => {
			if (error !== null) {
				reject(error);
				return;
			}

			try {
				userInputParameters = fields;
				userInputFiles = files;
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	});

	formidablePromise
		.then(() => {
			//////////////////////
			// Validate user input
			let result = validateUserInput(userInputParameters);
			userInputParameters = result.parameters;
			userInputAuthentication = result.authentication;
			userInputQuery = result.query;

			////////////////////
			// Authenticate user
			if (userInputAuthentication.authToken !== undefined) {
				// Get information of the user who is identified by <authToken>
				return identify(userInputAuthentication.authToken);
			} else {
				// Check whether <password> is right for <username>
				return authenticate(userInputAuthentication.username, userInputAuthentication.password);
			}
		})
		.then((user) => {
			authenticatedUser = user;
			// Check whether <username> is allowed to perform <query> on <project>
			return authorize(authenticatedUser.username, userInputQuery, userInputParameters.project);
		})
		.then(() => {
			// Perform the actual stuff
			return runQueryHandler(authenticatedUser, userInputQuery, userInputParameters, userInputFiles);
		})
		.then((queryResult) => {
			response.write(JSON.stringify({
				success: true,
				data: queryResult
			}, null, '\t' ));
			response.end();
		})
		.catch((error) => {
			if (error instanceof EmuError) {
				if (error.visibleToClient) {
					response.write(JSON.stringify({
						success: false,
						error: {
							code: error.message,
							info: error.additionalInfo
						}
					}));
					response.end();
				}

				if (error.writeToLogfile) {
					// @todo properly log this error
					// eslint-disable-next-line no-console
					console.log(error.name, error.message, error.internalInfo, error.additionalInfo);
				}
			} else {
				// @todo properly log this error
				// eslint-disable-next-line no-console
				console.log(error.stack);

				response.write(JSON.stringify({
					success: false,
					error: {
						code: 'E_INTERNAL_SERVER_ERROR'
					}
				}));
				response.end();
			}
		});
}


//
// Start up the server
//
let server = http.createServer(httpConnectionCallback);

server.listen(config.managerAPI.port, () => {
	// eslint-disable-next-line no-console
	console.log('Server listening on: http://localhost:%s' + config.managerAPI.port);
});
