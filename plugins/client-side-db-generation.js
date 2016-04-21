// (c) 2016 Markus Jochim <markusjochim@phonetik.uni-muenchen.de>

/**
 * This is the first plugin for the IPS-EMUprot-nodeWSserver. It serves as
 * an example for plugin authors.
 *
 * Technically, a plugin is a node module that exports a number of functions.
 * The functions serve as handlers for specific EMUprot events and override the
 * server's default handlers.
 *
 * It is only possible to override the handlers for:
 *
 * * GETBUNDLELIST,
 * * GETBUNDLE, and
 * * SAVEBUNDLE.
 *
 * That is, when a client sends a message with its type set to one of those
 * just mentioned, the respective function is called and it is expected to
 * send a response to the client.
 *
 */

/**
 * Some init code can be placed here, if at all necessary.
 */

// ...


/**
 * Export your functions here. The main object must be named
 * exports.pluginMessageHandlers. It can have one or more of the properties
 * GETBUNDLELIST, GETBUNDLE, and SAVEBUNDLE (it is *not* necessary to
 * override all of them - just do not include the properties then). The
 * value of each must be a function (or function pointer) that accepts two
 * parameters:
 *
 * * mJSO The client's message as a Javsascript object. See protocol
 *        specification for details on how these are structured.
 * * wsConnect An object representing the client's WebSocket connection.
 */
exports.pluginMessageHandlers = {
	GETBUNDLELIST: pluginHandlerGetBundleList,
	GETBUNDLE: pluginHandlerGetBundle,
	SAVEBUNDLE: pluginHandlerSaveBundle
};


function pluginHandlerGetBundleList (mJSO, wsConnect) {

}

function pluginHandlerGetBundle (mJSO, wsConnect) {

}

function pluginHandlerSaveBundle (mJSO, wsConnect) {

}
