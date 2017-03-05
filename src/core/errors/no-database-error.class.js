'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.NoDatabaseError = class extends EmuError {
	constructor(project, databaseName) {
		super('E_NO_DATABASE', true, true);
		this.additionalInfo = [
			project,
			databaseName
		];
	}
};
