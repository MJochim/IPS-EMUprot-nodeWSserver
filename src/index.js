"use strict";

const managerAPI = require('./manager-api/index.js');
const lock = require ('./core/lock.js');
/*
setInterval(function() {
	if (lock.lockResource('mine')) {
		console.log('Lock successful');

		setTimeout(function() {
			console.log('Unlocking');
			lock.unlockResource('mine');
		}, 8000);
	} else {
		console.log('Lock not successful');
	}
}, 3000);
*/
