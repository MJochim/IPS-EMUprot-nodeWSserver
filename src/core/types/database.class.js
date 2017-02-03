"use strict";

exports.Database = class {
	constructor() {
		this.name = '';
		this.dbConfig = {};
		this.bundleLists = [];
		this.sessions = [];
	}
};