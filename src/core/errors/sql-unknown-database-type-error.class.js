'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.SQLUnknownDatabaseTypeError = class extends EmuError {
	constructor (databaseType) {
		super ('E_SQL_UNKNOWN_DATABASE_TYPE', false, true);
		this.internalInfo = databaseType;
	}
};
