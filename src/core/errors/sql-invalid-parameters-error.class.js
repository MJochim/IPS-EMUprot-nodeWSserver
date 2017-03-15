'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.SQLInvalidParametersError = class extends EmuError {
	constructor () {
		super ('E_SQL_INVALID_PARAMETERS', false, true);
	}
};
