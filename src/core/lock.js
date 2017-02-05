"use strict";

const LockError = require('./errors/lock-error.class').LockError;

let lockID = 0;

// Lock individual databases
let lockedDatabases = {};

// Lock entire projects
let lockedProjects = {};

exports.lockDatabase = function (project, database, retries = 2, retryInterval = 1000) {
	if (typeof project !== 'string' || typeof database !== 'string') {
		return Promise.reject();
	}

	return new Promise((resolve, reject) => {
		if (
			lockedProjects.hasOwnProperty(project) ||
			(lockedDatabases.hasOwnProperty(project) && lockedDatabases[project].hasOwnProperty(database))
		) {
			if (retries > 0) {
				setTimeout(() => {
					resolve(exports.lockDatabase(project, database, retries - 1, retryInterval));
				}, retryInterval);
			} else {
				reject(new LockError());
			}
		} else {
			++lockID;
			if (!lockedDatabases[project]) {
				lockedDatabases[project] = {};
			}
			lockedDatabases[project][database] = lockID;
			resolve(lockID);
		}
	});
};

exports.unlockDatabase = function (project, database, lockID) {
	if (typeof project !== 'string' || typeof database !== 'string' || typeof lockID !== 'number') {
		return Promise.reject();
	}

	return new Promise((resolve, reject) => {
		if (
			lockedDatabases.hasOwnProperty(project) &&
			lockedDatabases[project].hasOwnProperty(database) &&
			lockedDatabases[project][database] === lockID
		) {
			delete lockedDatabases[project][database];
			if (Object.keys(lockedDatabases[project]).length === 0) {
				delete lockedDatabases[project];
			}
			resolve();
		} else {
			reject();
		}
	});
}

exports.lockProject = function (project, retries = 2, retryInterval = 1000) {
	if (typeof project !== 'string') {
		return Promise.reject();
	}

	return new Promise((resolve, reject) => {
		if (
			lockedProjects.hasOwnProperty(project) ||
			lockedDatabases.hasOwnProperty(project)
		) {
			if (retries > 0) {
				setTimeout(() => {
					resolve(exports.lockProject(project, retries - 1, retryInterval));
				}, retryInterval);
			} else {
				reject(new LockError());
			}
		} else {
			++lockID;
			lockedProjects[project] = lockID;
			resolve(lockID);
		}
	});
};

exports.unlockProject = function (project, lockID) {
	if (typeof project !== 'string' || typeof lockID !== 'number') {
		return Promise.reject();
	}

	return new Promise((resolve, reject) => {
		if (
			lockedProjects.hasOwnProperty(project) &&
			lockedProjects[project] === lockID
		) {
			delete lockedProjects[project];
			resolve();
		} else {
			reject();
		}
	});
}

exports.getLockInfo = function () {
	// @todo this should really make a deep copy
	return {
		projects: lockedProjects,
		databases: lockedDatabases
	};
};