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
const ValidUserInput = require("./core-functions/valid-user-input.class.js").ValidUserInput;

function httpConnectionCallback(request, response) {
	//
	// Parse and validate user input
	//
	let realUserInput = url.parse(request.url, true).query;
	let validUserInput = new ValidUserInput();

	// The ValidUserInput class is synchronous, but we need it async
	let userInputAsync = new Promise((resolve) => {
		resolve(validUserInput.update(realUserInput));
	});

	userInputAsync
		.then(() => {
			// Check whether <password> is right for <username>
			return authenticate(validUserInput.username, validUserInput.password)
		})
		.then(() => {
			// Check whether <username> is allowed to perform <query> on <project>
			return authorize(validUserInput.username, validUserInput.query, validUserInput.project);
		})
		.then(() => {
			// Perform the actual stuff
			return runQueryHandler(validUserInput);
		})
		.then((queryResult) => {
			response.write(JSON.stringify(queryResult));
			response.end();
		})
		.catch((error) => {
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

let server = http.createServer(httpConnectionCallback);

server.listen(config.managerAPI.port, () => {
	console.log("Server listening on: http://localhost:%s", config.managerAPI.port);
});
