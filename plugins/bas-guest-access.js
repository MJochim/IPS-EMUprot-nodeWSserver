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

	SAVEBUNDLE: emptySuccessResponse,
	LOGONUSER: emptySuccessResponse

	// Not overridden:
	// - GETBUNDLE
	// - GETBUNDLELIST
	// - DISCONNECTWARNING
};

function emptySuccessResponse(mJSO, wsConnect) {
	sendMessage(wsConnect, mJSO.callbackID, true);
}

function emptyErrorResponse(mJSO, wsConnect) {
	sendMessage(wsConnect, mJSO.callbackID, false);
}

function pluginHandlerGetProtocol(mJSO, wsConnect) {
	// check authorization token in wsConnect.query.authToken
	// ...
	// and set wsConnect.authorised = true


	// Call original event handler
	defaultHandlerGetProtocol(mJSO, wsConnect);
}

function pluginHandlerGetDoUserManagement(mJSO, wsConnect) {
	sendMessage(wsConnect, mJSO.callbackID, true, '', 'NO');
}


function pluginHandlerGetGlobalDBConfig(mJSO, wsConnect) {
	var dbConfigPath = path.normalize(path.join(wsConnect.path2db, wsConnect.dbName + '_DBconfig.json'));

	readGlobalDBConfigFromDisk(dbConfigPath, wsConnect).then(
		function (value) {
			// Disable save buttons for bundles
			wsConnect.dbConfig.EMUwebAppConfig.activeButtons.saveBundle = false;

			// Send configuration object to client
			sendMessage(wsConnect, mJSO.callbackID, true, '', wsConnect.dbConfig);
		},
		function (reason) {
			sendMessage(wsConnect, mJSO.callbackID, false, reason);
		}
	);
}
