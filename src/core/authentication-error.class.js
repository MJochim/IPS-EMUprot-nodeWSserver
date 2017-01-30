"use strict";

const EmuError = require('./emu-error.class.js').EmuError;

exports.AuthenticationError = class extends EmuError {
	constructor () {
		super ('E_AUTHENTICATION', true, true);
	}
}
