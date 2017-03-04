"use strict";

const EmuError = require('./emu-error.class.js').EmuError;

exports.GitError = class extends EmuError {
	constructor (internalInfo) {
		super ('E_GIT', true, true);
		this.internalInfo = internalInfo;
	}
};
