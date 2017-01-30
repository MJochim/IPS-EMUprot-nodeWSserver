"use strict";

exports.lockResource = lockResource;
exports.unlockResource = unlockResource;
exports.getLockInfo = getLockInfo;

var lockID = 0;
var lockedResources = {};

function lockResource (resourceID) {
	if (lockedResources.hasOwnProperty(resourceID)) {
		return false;
	} else {
		++lockID;
		lockedResources[resourceID] = lockID;
		return lockID;
	}
}

function unlockResource (resourceID) {
	if (lockedResources.hasOwnProperty(resourceID)) {
		delete lockedResources[resourceID];
	} else {
		return false;
	}
}

function getLockInfo () {
	var result = {};
	for (i in lockedResources) {
		result[i] = lockedResources[i];
	}
	return result;
}

