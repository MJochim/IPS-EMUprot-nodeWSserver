'use strict';

describe('ValidUserInput', () => {

	//
	// Dependencies
	//
	const UserInputError = require('../../core/errors/user-input-error.class.js').UserInputError;
	const ValidUserInput = require('./valid-user-input.class.js').ValidUserInput;


	//
	// The actual tests
	//

	it ('should accept valid values', () => {
		let input = new ValidUserInput();

		expect(() => {
			input.update({
				'username': 'alice'
			});
		}).not.toThrow(new UserInputError());

		expect(() => {
			input.update({
				'bundleListObject': '[]'
			});
		}).not.toThrow(new UserInputError());
	});

	it ('should reject invalid values', () => {
		let input = new ValidUserInput();

		// Empty strings are not allowed
		expect(() => {
			input.update({
				'username': ''
			});
		}).toThrow(new UserInputError());

		// Dots are not allowed
		expect(() => {
			input.update({
				'databaseName': 'My.Database'
			});
		}).toThrow(new UserInputError());

		// Umlauts are not allowed
		expect(() => {
			input.update({
				'databaseName': 'Öl'
			});
		}).toThrow(new UserInputError());

		// Spaces are not allowed
		expect(() => {
			input.update({
				'databaseName': 'My database'
			});
		}).toThrow(new UserInputError());

		// Unknown options are not allowed
		expect(() => {
			input.update({
				'someOtherOption': 'value'
			});
		}).toThrow(new UserInputError());

		// bundleListObject must be a JSON array
		expect(() => {
			input.update({
				'bundleListObject': 'json'
			});
		}).toThrow(new UserInputError());
		expect(() => {
			input.update({
				'bundleListObject': '{}'
			});
		}).toThrow(new UserInputError());
	});

	it ('should provide default values', () => {
		let input = new ValidUserInput();
		expect(input.archiveLabel).not.toBeUndefined();
		expect(input.bundleComments).not.toBeUndefined();
		expect(input.bundleFinishedEditing).not.toBeUndefined();
		expect(input.bundleListName).not.toBeUndefined();
		expect(input.bundleListObject).not.toBeUndefined();
		expect(input.databaseName).not.toBeUndefined();
		expect(input.gitCommitID).not.toBeUndefined();
		expect(input.gitTagLabel).not.toBeUndefined();
		expect(input.gitTreeish).not.toBeUndefined();
		expect(input.newArchiveLabel).not.toBeUndefined();
		expect(input.newBundleListName).not.toBeUndefined();
		expect(input.newDatabaseName).not.toBeUndefined();
		expect(input.oldArchiveLabel).not.toBeUndefined();
		expect(input.oldBundleListName).not.toBeUndefined();
		expect(input.oldDatabaseName).not.toBeUndefined();
		expect(input.password).not.toBeUndefined();
		expect(input.project).not.toBeUndefined();
		expect(input.query).not.toBeUndefined();
		expect(input.uploadUUID).not.toBeUndefined();
		expect(input.username).not.toBeUndefined();
	});
});
