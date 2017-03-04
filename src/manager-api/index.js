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
const runQueryHandler = require('./core/run-query-handler.function.js').runQueryHandler;
const ValidUserInput = require('./core/valid-user-input.class.js').ValidUserInput;

function httpConnectionCallback(request, response) {
	response.setHeader('Access-Control-Allow-Origin', '*');
	// @todo  handle request.onError and response.onError

	//
	// This object will later hold the real user input
	//
	let validUserInput = new ValidUserInput();

	let userInputFiles = [];

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

			// Validate user input
			try {
				validUserInput.update(fields);
				userInputFiles = files;
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	});

	formidablePromise
		.then(() => {
			// Check whether <password> is right for <username>
			return authenticate(validUserInput.username, validUserInput.password);
		})
		.then(() => {
			// Check whether <username> is allowed to perform <query> on <project>
			return authorize(validUserInput.username, validUserInput.query, validUserInput.project);
		})
		.then(() => {
			let authInfo = {
				username: validUserInput.username,
				email: 'no-reply@example.com'
			};
			// Perform the actual stuff
			return runQueryHandler(authInfo, validUserInput, userInputFiles);
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
