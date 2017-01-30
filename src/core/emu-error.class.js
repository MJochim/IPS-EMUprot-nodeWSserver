"use strict";

exports.EmuError = class extends Error {
	constructor(errorType, visibleToClient = false, writeToLogfile = true) {
		super();
		this.name = 'EmuError';
		this.message = errorType;

		this.visibleToClient = visibleToClient;
		this.writeToLogfile = writeToLogfile;
	}
};
