'use strict';

exports.User = class {
	constructor(username = '', email = '') {
		this.username = username;
		this.email = email;
	}
};