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

"use strict";

const http = require('http');
const url = require('url');

const authenticate = require('../core/authenticate.function.js').authenticate;
const authorize = require('./core-functions/authorize.function.js').authorize;
const config = require('../config.js').config;
const EmuError = require('../core/emu-error.class.js').EmuError;
const runQueryHandler = require('./core-functions/run-query-handler.function.js').runQueryHandler;
const validateUserInput = require('./core-functions/validate-user-input.function.js').validateUserInput;

function httpConnectionCallback (request, response) {
	//
	// Parse and validate user input
	//
	// The validator DOES guarantee that all properties present on userInput
	// are safe, but it DOES NOT guarantee that all required properties are
	// present.
	//

	var userInput = url.parse(request.url, true).query;
	var userInputValid = validateUserInput(userInput);
	
	if (!userInputValid) {
		response.write(JSON.stringify({
			success: false,
			data: 'E_INVALID_USER_INPUT',
			message: ''
		}));
		response.end();
		return;
	}

	//
	// Check whether <password> is right for <username>
	//
	authenticate (userInput.username, userInput.password)
		.then (() => {
			// Check whether <username> is allowed to perform <query> on <project>
			return authorize (userInput.username, userInput.query, userInput.project);
		})
		.then (() => {
			return runQueryHandler (userInput);
		})
		.then ((queryResult) => {
			response.write(JSON.stringify(queryResult));
			response.end();
		})
		.catch ((error) => {
			if (error instanceof EmuError) {
				if (error.visibleToClient) {
					response.write(JSON.stringify({
						success: false,
						data: error.message,
						message: ''
					}));
					response.end();
				}

				if (error.writeToLogfile) {
					// @todo properly log this error
					console.log(error.name, error.message);
				}
			} else {
				// @todo properly log this error
				console.log(error.name, error.message);

				response.write(JSON.stringify({
					success: false,
					data: 'E_INTERNAL_SERVER_ERROR',
					message: ''
				}));
				response.end();
			}
		});
}


//
// Start up the server
//

var server = http.createServer(httpConnectionCallback);

server.listen(config.managerAPI.port, () => {
	console.log("Server listening on: http://localhost:%s", config.managerAPI.port);
});
