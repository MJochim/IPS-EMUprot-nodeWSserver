'use strict';

const UserInputError = require('../../core/errors/user-input-error.class.js').UserInputError;

/**
 * This class is the place where all dangerous user input gets rejected.
 *
 * Use it like this:
 *
 * a = new ValidUserInput() - Creates an object with all fields the user is
 * allowed to transmit initialised to empty string or false.
 *
 * a.update(realUserInput) - Makes sure the realUserInput is valid and harmless.
 *
 * name = a.databaseName - Retrieve the fields from this object - they are
 * guaranteed to be defined and harmless.
 *
 */
exports.ValidUserInput = class {
	constructor() {
		//
		// These regular expressions do not allow empty strings.
		//
		this.plainCharactersRegExp = /^[a-zA-Z0-9\-_]+$/;
		this.plainCharactersAndDotRegExp = /^[a-zA-Z0-9\-_\.]+$/;
		this.hexStringRegExp = /^[a-f0-9]+$/;
		// @todo Check whether a-zA-Z is locale-specific on the server

		//
		// Set all fields to empty string
		//
		this.project = '';
		this.query = '';

		this.databaseName = '';
		this.newDatabaseName = '';
		this.oldDatabaseName = '';

		this.archiveLabel = '';
		this.newArchiveLabel = '';
		this.oldArchiveLabel = '';

		this.gitTagLabel = '';
		this.gitTreeish = '';
		this.uploadUUID = '';

		this.bundleListName = '';
		this.newBundleListName = '';
		this.oldBundleListName = '';
		this.username = '';
		this.bundleComments = false;
		this.bundleFinishedEditing = false;
		this.gitCommitID = '';
		this.password = '';
		this.bundleListObject = '[]';
	}

	/**
	 * Validates all properties on <newUserInput> and if they are all okay,
	 * saves them to the internal variables. Either saves all variables or none.
	 *
	 * @throws UserInputError If any property on <newUserInput> is found to be
	 * disallowed.
	 *
	 * @param newUserInput
	 */
	update(newUserInput) {
		this.makeValid(newUserInput);

		for (let i in newUserInput) {
			this[i] = newUserInput[i];
		}
	}

	/**
	 * Check all properties of <newUserInput> for validity.
	 *
	 * The argument <newUserInput> is changed inside this function:
	 * All properties of <newUserInput> are expected to be strings; however,
	 * some represent booleans. These are converted to real booleans.
	 *
	 * @throws UserInputError If any property on <newUserInput> is found to be
	 * disallowed.
	 *
	 * @param newUserInput The input to be validated. The value is changed
	 * inside the function.
	 */
	makeValid(newUserInput) {
		for (let i in newUserInput) {
			if (typeof newUserInput[i] !== 'string') {
				throw new UserInputError(i);
			}

			switch (i) {
				case 'project':
				case 'query':
				//
				case 'databaseName':
				case 'newDatabaseName':
				case 'oldDatabaseName':
				//
				case 'archiveLabel':
				case 'newArchiveLabel':
				case 'oldArchiveLabel':
				//
				case 'gitTagLabel':
				case 'gitTreeish':
				case 'uploadUUID':
					if (newUserInput[i].search(this.plainCharactersRegExp) !== 0) {
						throw new UserInputError(i);
					}
					break;

				case 'bundleListName':
				case 'newBundleListName':
				case 'oldBundleListName':
				case 'username':
					if (newUserInput[i].search(this.plainCharactersAndDotRegExp) !== 0) {
						throw new UserInputError(i);
					}
					break;

				case 'bundleComments':
				case 'bundleFinishedEditing':
					if (newUserInput[i] === 'true') {
						newUserInput[i] = true;
					} else {
						newUserInput[i] = false;
					}
					break;

				case 'gitCommitID':
					if (newUserInput[i].search(this.hexStringRegExp) !== 0) {
						throw new UserInputError(i);
					}
					break;

				case 'password':
					break;

				case 'bundleListObject':
					let value;
					try {
						value = JSON.parse(newUserInput[i]);
					} catch (e) {
						if (e instanceof SyntaxError) {
							throw new UserInputError(i);
						} else {
							throw (e);
						}
					}
					if (!Array.isArray(value)) {
						throw new UserInputError(i);
					}
					break;

				default:
					throw new UserInputError(i);
			}
		}
	}
};
