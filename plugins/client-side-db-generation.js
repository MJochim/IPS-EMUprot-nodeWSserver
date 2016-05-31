// (c) 2016 Markus Jochim <markusjochim@phonetik.uni-muenchen.de>

/**
 * @todo this plugin has been forked from the bas plugin. documentation has
 * to be rewritten. This plugin allows clients to create new bundles and
 * sessions, and to upload media files.
 */

exports.pluginMessageHandlers = {
	GETGLOBALDBCONFIG: pluginHandlerGetGlobalDBConfig,
	GETDOUSERMANAGEMENT: pluginHandlerGetDoUserManagement,

	SAVEBUNDLE: pluginHandlerSaveBundle,
	LOGONUSER: emptySuccessResponse

	// Not overridden:
	// - GETBUNDLE
	// - GETBUNDLELIST
	// - DISCONNECTWARNING
};

var main = require.main.exports;

var path = require('path');
var fs = require('fs');
var Q = require('q');

function emptySuccessResponse(mJSO, wsConnect) {
	main.sendMessage(wsConnect, mJSO.callbackID, true);
}

function emptyErrorResponse(mJSO, wsConnect) {
	main.sendMessage(wsConnect, mJSO.callbackID, false);
}

function pluginHandlerSaveBundle(mJSO, wsConnect) {
	main.log.info('Saving: ' + mJSO.data.annotation.name,
		'; clientID:', wsConnect.connectionID,
		'; clientIP:', wsConnect._socket.remoteAddress);

	// User input is escaped via path.normalize(); this way, ".." cannot
	// be used to break out of the directory set by cfg.path2emuDBs
	var sessionPath = path.join(
		wsConnect.path2db,
		path.normalize(mJSO.data.session + '_ses')
	);
	var bundleName = path.normalize(mJSO.data.annotation.name);

	writeBundleToDisk(sessionPath, bundleName, mJSO.data, wsConnect).then(
		function () {
			main.sendMessage(wsConnect, mJSO.callbackID, true);
		},
		function (reason) {
			main.log.error('caught this in event handler', reason);
			main.sendMessage(wsConnect, mJSO.callbackID, false, reason);
		}
	)
}

function writeBundleToDisk(sessionPath, bundleName, data, wsConnect) {
	var deferred = Q.defer();
	main.log.info('wbtd()');
	for (i in data) {
		main.log.info('Data has', i);
	}

	// save annotation
	var bundlePath = path.join(
		sessionPath,
		bundleName + '_bndl'
	);
	var annotJSONpath = path.join(
		bundlePath,
		path.normalize(bundleName + '_annot.json')
	);
	var mediaFilePath = path.join(
		sessionPath,
		bundleName + '_bndl',
		path.normalize(bundleName + '.' + wsConnect.dbConfig.mediafileExtension)
	);

	try {
		fs.mkdirSync(sessionPath);
	} catch (error) {
		if (error.code !== "EEXIST") {
			deferred.reject(error);
			return deferred.promise;
		}
	}

	try {
		fs.mkdirSync(bundlePath);
	} catch (error) {
		if (error.code !== "EEXIST") {
			deferred.reject(error);
			return deferred.promise;
		}
	}

	fs.writeFile(annotJSONpath, JSON.stringify(data.annotation, undefined, 2), function (err) {
		if (err) {
			deferred.reject('Error writing annotation ' + err);
		} else {
			try {
				if (data.mediaFile) {
					var wave = new Buffer(data.mediaFile.data, 'base64');
					fs.writeFileSync(mediaFilePath, wave);
				}

				deferred.resolve();

				if (main.cfg.use_git_if_repo_found) {
					main.commitToGitRepo(wsConnect.path2db, wsConnect.ID, data.annotation.name, wsConnect.connectionID, wsConnect._socket.remoteAddress)
						.then(function (value) {
							deferred.resolve();
						})
						.catch(function (reason) {
							deferred.reject(reason);
						});
				} else {
					deferred.resolve();
				}
			} catch (error) {
				deferred.reject(error);
			}
		}
	});

	return deferred.promise;
}

function pluginHandlerGetDoUserManagement(mJSO, wsConnect) {
	var authToken = wsConnect.urlQuery.authToken;
	if (authToken === undefined) {
		authToken = '';
	}
	var bundleListPath = path.join(
		wsConnect.path2db,
		path.normalize(authToken + '_bundleList.json')
	);

	fs.readFile(bundleListPath, 'utf8', function (err, data) {
		if (err) {
			main.sendMessage(wsConnect, mJSO.callbackID, false, 'Invalid auth' +
				' token');
		} else {

			main.log.info('Accepting auth token:', authToken, 'in:', wsConnect.path2db,
				'; clientID:', wsConnect.connectionID,
				'; clientIP:', wsConnect._socket.remoteAddress);

			try {
				// safely parse data:
				var parsedData = jsonlint.parse(data);
				wsConnect.bndlList = parsedData;
				wsConnect.bndlListPath = bundleListPath;
				wsConnect.authorised = true;

				main.sendMessage(wsConnect, mJSO.callbackID, true, '', 'NO');
			} catch (error) {
				main.sendMessage(wsConnect, mJSO.callbackID, false, 'Error' +
					' parsing _bundleList.json: ' + error);
			}
		}
	});
}

function pluginHandlerGetGlobalDBConfig(mJSO, wsConnect) {
	var dbConfigPath = path.normalize(path.join(wsConnect.path2db, wsConnect.dbName + '_DBconfig.json'));

	main.readGlobalDBConfigFromDisk(dbConfigPath, wsConnect).then(
		function (value) {
			// Disable save buttons for bundles
			wsConnect.dbConfig.EMUwebAppConfig.activeButtons.saveBundle = false;

			// Send configuration object to client
			main.sendMessage(wsConnect, mJSO.callbackID, true, '', wsConnect.dbConfig);
		},
		function (reason) {
			main.sendMessage(wsConnect, mJSO.callbackID, false, reason);
		}
	);
}
