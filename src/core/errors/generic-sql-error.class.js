'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.GenericSQLError = class extends EmuError {
	constructor (previousError) {
		super ('E_SQL', false, true);
		this.internalInfo = previousError;
	}
};
