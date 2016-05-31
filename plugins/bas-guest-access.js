// (c) 2016 Markus Jochim <markusjochim@phonetik.uni-muenchen.de>

/**
 * This plugin allows databases to be accessed read-only via an
 * authorization token instead of a username and password. It was designed
 * for BAS to offer simple preview browsing of speech databases.
 *
 * The plugin does three things:
 * - Override any protocol functions that offer writing capabilities to the
 *   client.
 * - Modify the database configuration before it is sent to the client to
 *   disable the save button for bundles.
 * - Implement the authorization token to access databases.
 *
 */

exports.pluginMessageHandlers = {
	GETGLOBALDBCONFIG: pluginHandlerGetGlobalDBConfig,
	GETDOUSERMANAGEMENT: pluginHandlerGetDoUserManagement,
	GETPROTOCOL: pluginHandlerGetProtocol,

	SAVEBUNDLE: pluginHandlerSaveBundle,
	LOGONUSER: pluginHandlerLogonUser

	// Not overridden:
	// - GETBUNDLE
	// - GETBUNDLELIST
	// - DISCONNECTWARNING
};

var main = require.main.exports;

var path = require('path');
var fs = require('fs');

function pluginHandlerSaveBundle(mJSO, wsConnect) {
	main.log.info('Attempted to save a bundle with BAS guest access. DB:' +
			wsConnect.path2db +
			'; clientID:', wsConnect.connectionID,
			'; clientIP:', wsConnect._socket.remoteAddress);

	main.sendMessage(wsConnect, mJSO.callbackID, false, 'Attempted to save a bundle with BAS guest access');
}

function pluginHandlerLogonUser(mJSO, wsConnect) {
	main.log.info('Attempted to log in with username and password, but this' +
		' is a BAS guest access enabled database. . DB:' +
			wsConnect.path2db +
			'; clientID:', wsConnect.connectionID,
			'; clientIP:', wsConnect._socket.remoteAddress);

	main.sendMessage(wsConnect, mJSO.callbackID, false,
		'Attempted to log in with username and password, but this' +
		' is a BAS guest access enabled database.');
}

function pluginHandlerGetProtocol(mJSO, wsConnect) {
	var status = main.authoriseNewConnection(mJSO, wsConnect);
	if (!status) {
		return;
	}

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

				// Call original event handler
				main.defaultHandlerGetProtocol(mJSO, wsConnect);
			} catch (error) {
				main.sendMessage(wsConnect, mJSO.callbackID, false, 'Error' +
					' parsing _bundleList.json: ' + error);
			}
		}
	});
}

function pluginHandlerGetDoUserManagement(mJSO, wsConnect) {
	main.sendMessage(wsConnect, mJSO.callbackID, true, '', 'NO');
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
