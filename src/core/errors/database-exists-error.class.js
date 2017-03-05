'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.DatabaseExistsError = class extends EmuError {
	constructor(project, databaseName) {
		super('E_DATABASE_EXISTS', true, true);
		this.additionalInfo = [
			project,
			databaseName
		];
	}
};
