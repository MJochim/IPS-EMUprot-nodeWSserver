'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.NoBundleListError = class extends EmuError {
	constructor(project, databaseName, bundleListName, archiveLabel) {
		super('E_NO_BUNDLE_LIST', true, true);
		this.additionalInfo = [
			project,
			databaseName,
			bundleListName,
			archiveLabel
		];
	}
};
