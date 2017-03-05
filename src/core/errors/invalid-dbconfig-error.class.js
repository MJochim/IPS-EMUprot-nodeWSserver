'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.InvalidDBConfigError = class extends EmuError {
	constructor(project, databaseName) {
		super('E_INVALID_DBCONFIG', true, true);
		this.additionalInfo = [
			project,
			databaseName
		];
	}
};
