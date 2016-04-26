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

	// @todo is it acceptable that these functions do not even send a reply?
	SAVEBUNDLE: function () {},
	LOGONUSER: function () {}

	// Not overridden:
	// - GETBUNDLE
	// - GETBUNDLELIST
	// - DISCONNECTWARNING
};

function pluginHandlerGetProtocol (mJSO, wsConnect) {
	// check authorization token in wsConnect.query.authToken
	// ...

	// Call original event handler
	defaultHandlerGetProtocol(mJSO, wsConnect);
}

function pluginHandlerGetDoUserManagement (mJSO, wsConnect) {
	wsConnect.send(JSON.stringify({
		'callbackID': mJSO.callbackID,
		'data': 'NO',
		'status': {
			'type': 'SUCCESS',
			'message': ''
		}
	}), undefined, 0);
}


function pluginHandlerGetGlobalDBConfig (mJSO, wsConnect) {
	var dbConfigPath = path.normalize(path.join(wsConnect.path2db, wsConnect.dbName + '_DBconfig.json'));
	fs.readFile(dbConfigPath, 'utf8', function (err, data) {
		if (err) {

			log.info('Error reading _DBconfig: ' + err,
				'; clientID:', wsConnect.connectionID,
				'; clientIP:', wsConnect._socket.remoteAddress);

			wsConnect.send(JSON.stringify({
				'callbackID': mJSO.callbackID,
				'status': {
					'type': 'ERROR',
					'message': err
				}
			}), undefined, 0);

			return;

		} else {

			wsConnect.dbConfig = JSON.parse(data);

			// figure out which SSFF files should be sent with each bundle
			wsConnect.allTrackDefsNeededByEMUwebApp = findAllTracksInDBconfigNeededByEMUwebApp(wsConnect.dbConfig);

			// Disable save buttons for bundles
			wsConnect.dbConfig.EMUwebAppConfig.activeButtons.saveBundle = false;

			wsConnect.send(JSON.stringify({
				'callbackID': mJSO.callbackID,
				'data': wsConnect.dbConfig,
				'status': {
					'type': 'SUCCESS',
					'message': ''
				}
			}), undefined, 0);

		}
	});
}
