// (c) 2016 Markus Jochim <markusjochim@phonetik.uni-muenchen.de>

/**
 * This is a dummy plugin for the IPS-EMUprot-nodeWSserver. It serves as
 * an example for plugin authors.
 *
 * Technically, a plugin is a nodejs module that exports a number of functions.
 * The functions serve as handlers for specific client requests and override
 * the server's default handlers. All handlers are expected to send a reply
 * to the server via main.sendMessage(). Some handlers are required to
 * perform request-specific actions.
 *
 * It is possible to override handlers for all request types. The request
 * types defined in the protocol (version 0.0.2) are:
 *
 * * GETPROTOCOL,
 * * GETDOUSERMANAGEMENT,
 * * LOGONUSER,
 * * GETGLOBALDBCONFIG,
 * * GETBUNDLELIST,
 * * GETBUNDLE,
 * * SAVEBUNDLE, and
 * * DISCONNECTWARNING.
 */

/**
 * Some init code can be placed here, if at all necessary.
 */

var fs = require('fs');

var somethingOfGlobalImportance = 'foobar';
// ...


/**
 * Export your functions here. The main object must be named
 * exports.pluginMessageHandlers. Its properties must be functions and their
 * keys must match a protocol command, such as GETBUNDLE, SAVEBUNDLE, etc. It
 * is *not* necessary to override all request handlers - just do not include
 * the properties then.
 *
 * The handler functions will be passed two parameters:
 *
 * * mJSO The client's message as a Javsascript object.
 * * wsConnect An object representing the client's WebSocket connection.
 *
 * Clients' messages are objects with three properties:
 *
 * * type (one of the protocol commands, e.g. GETBUNDLE)
 * * callbackID (a UUID that must be included in the response)
 * * data (the content of data depends on type)
 *
 */
exports.pluginMessageHandlers = {
	GETBUNDLELIST: pluginHandlerGetBundleList,
	GETBUNDLE: pluginHandlerGetBundle,
	SAVEBUNDLE: pluginHandlerSaveBundle
};

// @todo Some request handlers are required to perform some specific
// actions, such as write the property wsConnet.dbConfig. These specific
// requirements must be documented here.


function pluginHandlerGetBundleList (mJSO, wsConnect) {
	var exampleBundleList = [{
		session: "0000",
		name: "msajc003"
	}, {
		session: "0000",
		name: "msajc010"
	}];

	main.sendMessage(wsConnect, mJSO.callbackID, true, '', exampleBundleList);
}

function pluginHandlerGetBundle (mJSO, wsConnect) {
	main.sendMessage(wsConnect, mJSO.callbackID, false, 'GETBUNDLE is not' +
		' implemented in this plugin.');

}

function pluginHandlerSaveBundle (mJSO, wsConnect) {
	main.sendMessage(wsConnect, mJSO.callbackID, false, 'SAVEBUNDLE is not' +
		' implemented in this plugin.');
}
