'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.AuthorizationError = class extends EmuError {
	constructor () {
		super ('E_AUTHORIZATION', true, true);
	}
};
