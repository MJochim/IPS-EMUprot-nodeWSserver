"use strict";

/**
 * This is the place where all dangerous user input gets rejected.
 * 
 * This function DOES guarantee that all properties of userInput are safe.
 * This function DOES NOT guarantee that all required properties are present.
 */
exports.validateUserInput = function (userInput) {
	//
	// These regular expressions do not allow empty strings.
	//
	let plainCharactersRegExp       = /^[a-zA-Z0-9\-_]+$/;
	let plainCharactersAndDotRegExp = /^[a-zA-Z0-9\-_\.]+$/;
	let hexStringRegExp             = /^[a-f0-9]+$/;
	// @todo Check whether a-z is locale-specific on the server

	for (let i in userInput) {
		if (typeof userInput[i] !== 'string') {
			return false;
		}

		switch (i) {
			case 'project':
			case 'query':
			
			case 'databaseName':
			case 'newDatabaseName':
			case 'oldDatabaseName':

			case 'archiveLabel':
			case 'newArchiveLabel':
			case 'oldArchiveLabel':
			
			case 'gitTagLabel':
			case 'gitTreeish':
			case 'uploadUUID':
				if (typeof userInput[i] !== 'string') {
					return false;
				}

				if (userInput[i].search(plainCharactersRegExp) !== 0) {
					return false;
				}
				break;

			case 'bundleListName':
			case 'newBundleListName':
			case 'oldBundleListName':
			case 'username':
				if (userInput[i].search(plainCharactersAndDotRegExp) !== 0) {
					return false;
				}
				break;

			case 'bundleComments':
			case 'bundleFinishedEditing':
				if (userInput[i] === 'true') {
					userInput[i] = true;
				} else {
					userInput[i] = false;
				}
				break;

			case 'gitCommitID':
				if (userInput[i].search(hexStringRegExp) !== 0) {
					return false;
				}
				break;

			case 'password':
				break;

			case 'bundleListObject':
				try {
					JSON.parse(userInput[i]);
				} catch (e) {
					if (e instanceof SyntaxError) {
						return false;
					} else {
						throw (e);
					}
				}
				break;

			default:
				return false;
		}
	}
	
	return true;
}
