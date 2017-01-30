"use strict";

exports.listTags = function (authToken, databaseName) {
	/*
	console.log (query.query, query.project, lock.getLockInfo());

	var locked = lock.lockResource(query.project);
	console.log ('HTTP client requested lock for resource', query.project, locked);
	if (locked === false) {
		return Promise.reject({
			success: false,
			data: 'E_RESOURCE_LOCKED',
			message: ''
		});
	}

	also unlock!
	*/

	return new Promise (function (resolve, reject) {
		//setTimeout(function () { resolve('aer'+Date.now()); }, 5000);
		resolve('yes');
	});
}
