"use strict";

const EmuError = require('./emu-error.class.js').EmuError;

exports.UserInputError = class extends EmuError {
	constructor (additionalInfo) {
		super ('E_USER_INPUT', true, true);
		this.additionalInfo = additionalInfo;
	}
};
