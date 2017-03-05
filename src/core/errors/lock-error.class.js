'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.LockError = class extends EmuError {
	constructor () {
		super ('E_LOCK', true, true);
	}
};