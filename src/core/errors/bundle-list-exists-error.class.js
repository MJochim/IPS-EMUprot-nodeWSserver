'use strict';

const EmuError = require('./emu-error.class.js').EmuError;

exports.BundleListExistsError = class extends EmuError {
	constructor(project, databaseName, bundleListName, archiveLabel) {
		super('E_BUNDLE_LIST_EXISTS', true, true);
		this.additionalInfo = [
			project,
			databaseName,
			bundleListName,
			archiveLabel
		];
	}
};
