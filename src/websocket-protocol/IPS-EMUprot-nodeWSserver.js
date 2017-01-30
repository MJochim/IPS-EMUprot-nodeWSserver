/**
 * node server that implements the EMU-webApp-websocket-protocol (version 0.0.2)
 *
 * to install dependencies:
 *
 *  > npm install
 *
 * to run:
 *
 *  > node IPS-EMUprot-nodeWSserver.js server_config.json | node_modules/bunyan/bin/bunyan
 *
 * "server_config.json":
 *
 *     JSON file with the following attributes:
 *
 *    {
 *        "path2emuDBs": 'emuDBs', // path to folder containing the emuDBs
 *        "ssl": true, // true if you want to use ssl (it is highly recommended that you do!!!)
 *        "port": 17890, // port you want the websocket server to run on
 *        "ssl_key": "certs/server.key", // path to ssl_key
 *        "ssl_cert": "certs/server.crt", // path to ssl_cert
 *        "use_ldap": true, // true if you want to try to bind to ldap
 *        "ldap_address": "ldaps://ldap.phonetik.uni-muenchen.de:636", // ldap address
 *        "binddn_left": "uid=", // left side of binddn (resulting binddn_left + username + binddn_right)
 *        "binddn_right": ",ou=People,dc=phonetik,dc=uni-muenchen,dc=de", // right side of binddn (resulting binddn_left + username + binddn_right)
 *        "sqlite_db": "IPS-EMUprot-nodeWSserver.DB", // sqlite_db containing users table
 *        "use_git_if_repo_found": true, // automatically commit to git repo in database
 *        "filter_bndlList_for_finishedEditing": true // remove all bundles form bundleList where finishedEditing = true returning it to the EMU-webApp
 *    }
 *
 */


 (function () {

 	"use strict";

	// load deps
	var fs = require('fs');
	var assert = require('assert');
	var path = require('path');
	var os = require('os');
	// var filewalker = require('filewalker');
	var bunyan = require('bunyan');
	var ldap = require('ldapjs');
	var exec = require('child_process').exec;
	var bcrypt = require('bcryptjs');
	var sqlite3 = require('sqlite3').verbose();
	var pg = require('pg');
	var async = require('async');
	var Q = require('q');
	var jsonlint = require('jsonlint');
	var url = require('url');
	var domain = require('domain');
	
	var https = require('https');
	var JSONLint = require('json-lint');
	var tv4 = require('tv4');


	// for authentication to work
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


	// create logger
	var log = bunyan.createLogger({
		name: "nodeEmuWS"
	});

	log.info('starting server...');

	// read in config file
	var cfg;

	////////////////////////////////////////////////
	// parse args

	if (process.argv.length === 3) {
		cfg = JSON.parse(fs.readFileSync(process.argv[2]));
	} else {
		log.error('ERROR: server_config.json has to be given as an argument!!');
		process.exit(1);
	}

	// load  SQLiteDB
	var usersDB = new sqlite3.Database(cfg.sqlite_db, function () {
		log.info('finished loading SQLiteDB');
	});

	////////////////////////////////////////////////
	// get schema files
	var lastSchemaUpdate;
	var schemasData = [];
	var schemaURLs = [
	'https://raw.githubusercontent.com/IPS-LMU/EMU-webApp/master/app/schemaFiles/annotationFileSchema.json',
	'https://raw.githubusercontent.com/IPS-LMU/EMU-webApp/master/app/schemaFiles/DBconfigFileSchema.json',
	'https://raw.githubusercontent.com/IPS-LMU/EMU-webApp/master/app/schemaFiles/emuwebappConfigSchema.json'];

	function updateSchemas(){

		function getSchemaFromURL(schemaURL, schemasDataIdx){
			https.get(schemaURL, function(res) {
				var body = '';

				res.on('data', function(chunk) {
					body += chunk;
				});

				res.on('end', function() {
					schemasData[schemasDataIdx] = JSON.parse(body);
				if(schemasDataIdx === 2){ // add emuwebappConfigSchema to tv4 as it is ref. in DBconfigFileSchema
					tv4.addSchema('https://raw.githubusercontent.com/IPS-LMU/EMU-webApp/master/app/schemaFiles/emuwebappConfigSchema.json', schemasData[2]);
					lastSchemaUpdate = Date.now() / 1000;
				}

				log.info('Finished loading schemaURL:' + schemaURLs[schemasDataIdx]);
			});

			}).on('error', function(e) {
				log.error("Got error while getting schemas files: ", e);
			});
		}

		// loop through schema files and get them from GitHub
		for(var i = 0; i < schemaURLs.length; i++){
			getSchemaFromURL(schemaURLs[i], i);
		}

	}

	updateSchemas();

	////////////////////////////////////////////////
	// set up certs and keys for secure connection


	var httpServ = (cfg.ssl) ? require('https') : require('http');

	var WebSocketServer = require('ws').Server;

	var app = null;

	// request processing (handles validation of annotJSON and DBconfigJSON)
	var processRequest = function (req, res) {

		if (req.method === 'GET') {
			res.writeHead(200);
			res.end("not processing GET requests!\n");
		}
		if (req.method === 'POST') {
		// the body of the POST is JSON payload.
		var queryData = url.parse(req.url, true).query;
		// console.log(request.url);
		var data = '';
		req.addListener('data', function (chunk) {
			data += chunk;
		});
		req.addListener('end', function () {
			var lint = JSONLint(data);
			var mess = {};
			if (lint.error) {
				mess.type = 'ERROR';
				mess.from = 'JSLINT (means badly formated json)';
				mess.ERROR_MESSAGE = lint.error;
				mess.ERROR_LINE = lint.line;
				mess.ERROR_CHARACTER = lint.character;

				res.writeHead(200, {
					'content-type': 'text/plain'
				});
				res.end(JSON.stringify(mess, null, 2));
			} else {
				var validRes;
				var validRequest;
				// check if schema files should be updated (update if last update is over 3600 seconds == 1 hour ago)
				if(lastSchemaUpdate - Date.now() / 1000 >= 3600){
					updateSchemas();
				}

				if (req.url === '/_annot') {
					validRequest = true;

					validRes = tv4.validate(JSON.parse(data), schemasData[0]);

				} else if (req.url === '/_DBconfig') {
					validRequest = true;
					validRes = tv4.validate(JSON.parse(data), schemasData[1]);

				} else {
					validRequest = false;
				}

				if (!validRequest){
					mess.type = 'ERROR';
					mess.message = 'Bad request URL! Only supported files to validate are _annot and _DBconfig (see server README.md for working examples)';
					res.writeHead(400, {
						'content-type': 'text/plain'
					});

					res.end(JSON.stringify(mess, null, 2));

				} else if (validRes) {
					mess.type = 'SUCCESS';
					res.writeHead(200, {
						'content-type': 'text/plain'
					});
					res.end(JSON.stringify(mess, null, 2));
				} else {
					mess.type = 'ERROR';
					mess.from = 'JSONSCHEMA (means does not comply to schema)';
					mess.ERRORS = tv4.error;

					res.writeHead(200, {
						'content-type': 'text/plain'
					});
					res.end(JSON.stringify(mess, null, 2));
				}


			}
		});
}
};

if (cfg.ssl) {

	app = httpServ.createServer({

			// providing server with  SSL key/cert
			key: fs.readFileSync(cfg.ssl_key),
			cert: fs.readFileSync(cfg.ssl_cert)

		}, processRequest).listen(cfg.port);

} else {

	app = httpServ.createServer(processRequest).listen(cfg.port);
}

	// passing or reference to web server so WS would knew port and SSL capabilities
	var wss = new WebSocketServer({
		server: app
	});


	/**
	 * This function is called by the GETPROTOCOL handler.
	 * It loads the client-requested and the corresponding plugin.
	 *
	 * @returns boolean to indicate if an error occurred (-> false) or all
	 * went well and we're all happy (-> true)
	 */
	 function authoriseNewConnection(mJSO, wsConnect) {
		// Parse URL and save which database the client requests to access.
		// Also save any query parameters. WARNING The query parameters are
		// stored in wsConnect.urlQuery WITHOUT BEING ESCAPED OR VALIDATED.
		try {
			var urlParams = parseURL(wsConnect.upgradeReq.url);
		} catch (error) {
			sendMessage(wsConnect, mJSO.callbackID, false, 'The requested database is not readable');
			log.info('parseURL failed, closing connection.', 'clientID:', wsConnect.connectionID, '; error:', error);
			wsConnect.close();
			return false;
		}
		wsConnect.path2db = urlParams.path2db;
		wsConnect.urlQuery = urlParams.query;
		// Extract last component of path2db - this is the db's name
		wsConnect.dbName = urlParams.dbName;


		// load database-specific plugins
		try {
			loadPluginConfiguration(wsConnect);
		} catch (error) {
			// It was not possible to load the configured plugin
			sendMessage(wsConnect, mJSO.callbackID, false, 'The requested database could not be loaded');
			log.info('Plugin loader failed, closing connection.', 'clientID:', wsConnect.connectionID, '; Reason: ', error.message);
			wsConnect.close();
			return false;
		}

		return true;
	}

	/**
	 * These are callbacks functions for specific request types.
	 *
	 * When a message is received from a client, the message's type field is
	 * checked to see if there is a handler for it. If there is not, the
	 * message is rejected as invalid. If there is, the respective handler
	 * function is called.
	 *
	 * Plugins are allowed to override the handler functions for all request
	 * types but GETPROTOCOL.
	 */
	 var defaultMessageHandlers = {
	 	GETPROTOCOL: defaultHandlerGetProtocol,
	 	GETDOUSERMANAGEMENT: defaultHandlerGetDoUserManagement,
	 	LOGONUSER: defaultHandlerLogonUser,
	 	GETGLOBALDBCONFIG: defaultHandlerGetGlobalDBConfig,
	 	GETBUNDLELIST: defaultHandlerGetBundleList,
	 	GETBUNDLE: defaultHandlerGetBundle,
	 	SAVEBUNDLE: defaultHandlerSaveBundle,
	 	DISCONNECTWARNING: defaultHandlerDisconnectWarning
	 };

	/**
	 * Look for a plugin configuration file in database and load the plugin
	 * specified there.
	 *
	 * The file must be named nodejs_server_plugins.json and reside at the
	 * db's top level directory. It must contain a JSON object with the
	 * string property `pluginName`.
	 *
	 * @throws When plugin configuration cannot be found or is corrupt.
	 * @throws When loadPlugin() fails for one of the plugins.
	 * @param wsConnect The connection object to attach the plugin to.
	 */
	 function loadPluginConfiguration(wsConnect) {
		// Read plugin configuration file
		var pluginConfigPath = path.join(wsConnect.path2db, 'nodejs_server_plugins.json');

		try {
			var file = fs.readFileSync(pluginConfigPath);
			var pluginConfig = JSON.parse(file);
		} catch (err) {
			// ENOENT means that the file has not been found, which in turn
			// means that no plugins have been configured. This is not critical.
			if (err.code === 'ENOENT') {
				log.info('No plugin configration file in ', pluginConfigPath, '; clientID: ', wsConnect.connectionID);
				return;
			}

			// Every other error is critical and should lead to the DB not
			// being accessible
			throw new Error('Plugin config file could not be read: ' + pluginConfigPath + '. Error was: ' + err);
		}

		// Load plugins
		if (pluginConfig instanceof Object && typeof pluginConfig.pluginName === 'string') {
			loadPlugin(wsConnect, pluginConfig.pluginName);
		} else {
			throw new Error('Plugin config file is corrupt: ' + pluginConfigPath);
		}
	}

	/**
	 * Load a specific named plugin and attach the event handlers it exports
	 * to a given connection.
	 *
	 * @throws When plugin cannot be loaded.
	 * @param wsConnect The connection to attach the plugin's event handlers to
	 * @param pluginName The name of the plugin to be loaded
	 */
	 function loadPlugin(wsConnect, pluginName) {
	 	log.info('Loading plugin:', pluginName, '; DB:', wsConnect.path2db);

	 	try {
	 		var pluginPath = './' + path.join('plugins', pluginName);

			// Delete plugin from require.cache so we can actually load the
			// current version of it
			delete require.cache[require.resolve(pluginPath)];

			// Load current version
			var plugin = require(pluginPath);

			var pluginMessageHandlers = plugin.pluginMessageHandlers;

			if (typeof pluginMessageHandlers !== 'object') {
				throw new Error('Plugin does not export pluginMessageHandlers object');
			}
		} catch (error) {
			throw new Error('Could not load plugin: ' + pluginName + '; reason: ' + error.message);
		}

		try {
			if (typeof pluginMessageHandlers.GETDOUSERMANAGEMENT === 'function') {
				wsConnect.messageHandlers.GETDOUSERMANAGEMENT = pluginMessageHandlers.GETDOUSERMANAGEMENT;
			}
			if (typeof pluginMessageHandlers.LOGONUSER === 'function') {
				wsConnect.messageHandlers.LOGONUSER = pluginMessageHandlers.LOGONUSER;
			}
			if (typeof pluginMessageHandlers.GETGLOBALDBCONFIG === 'function') {
				wsConnect.messageHandlers.GETGLOBALDBCONFIG = pluginMessageHandlers.GETGLOBALDBCONFIG;
			}
			if (typeof pluginMessageHandlers.GETBUNDLELIST === 'function') {
				wsConnect.messageHandlers.GETBUNDLELIST = pluginMessageHandlers.GETBUNDLELIST;
			}
			if (typeof pluginMessageHandlers.GETBUNDLE === 'function') {
				wsConnect.messageHandlers.GETBUNDLE = pluginMessageHandlers.GETBUNDLE;
			}

			if (typeof pluginMessageHandlers.SAVEBUNDLE === 'function') {
				wsConnect.messageHandlers.SAVEBUNDLE = pluginMessageHandlers.SAVEBUNDLE;
			}

			if (typeof pluginMessageHandlers.DISCONNECTWARNING === 'function') {
				wsConnect.messageHandlers.DISCONNECTWARNING = pluginMessageHandlers.DISCONNECTWARNING;
			}
		} catch (error) {
			throw new Error('Error loading plugin (it may have been loaded' +
				' partially: ' + pluginName + '; reason: ' + error.message);
		}
	}

	/**
	 * Parse a URL into path and query string. This is used whenever a
	 * connection is established (by the GETPROTOCOL handler). Additionally,
	 * check whether the path resolves to a readable directory. (It is not
	 * checked whether the directory actually contains a database.)
	 *
	 * Returns an object with the properties dbName, path2db and query.
	 * dbName is the URL's path component, in normalised form.
	 * path2db is the combination of cfg.path2emuDBs, the URL's path
	 * component, and the suffix _emuDB.
	 * query is an object containing the key value pairs from the URL's query string.
	 *
	 * WARNING The parameters in query are not escaped or otherwise validated.
	 *
	 * @throws When the path specified in `urlString` points to a
	 * non-existent or non-readable directory.
	 * @throws When the path specified in `urlString` uses ".." to point
	 * outside of the root dir for databases.
	 * @param urlString The URL to parse
	 * @returns {"path2db": string, "query": object}
	 */
	 function parseURL(urlString) {
	 	var urlObj = url.parse(urlString, true);
	 	var path2db = urlObj.pathname;

		// Make sure the requested DB path has no .. or . in it, so it
		// cannot escape from our database directory
		path2db = path.normalize(path2db);

		// Construct path to requested database
		path2db = path.normalize(path.join(cfg.path2emuDBs, path2db));

		// Extract name
		var dbName = path.basename(urlObj.pathname);
		path2db += '_emuDB';

		// Make sure we are not trying to point at the root dir of all
		// databases
		if (path2db === path.normalize(cfg.path2emuDBs)) {
			throw new Error('Invalid database specified');
		}

		// This will throw if we cannot Read and eXecute the db path
		fs.accessSync(path2db, fs.R_OK | fs.X_OK);

		return {
			dbName: dbName,
			path2db: path2db,
			query: urlObj.query
		};
	}

	/**
	 * Send a well-formed (as per the protocol) message to a client.
	 *
	 * @param wsConnect Connection object of the client to be addressed.
	 * @param callbackID Reference ID of the client's message we're
	 *                    responding to
	 * @param success Boolean to indicate successful outcome
	 * @param message Human-readable message text
	 * @param data Machine-readable data
	 */
	 function sendMessage(wsConnect, callbackID, success, message, data) {
	 	var type = 'ERROR';
	 	if (success) {
	 		type = 'SUCCESS';
	 	}
		// @todo is it okay to always send data and message, even if they're
		// null or empty string?
		wsConnect.send(JSON.stringify({
			'callbackID': callbackID,
			'data': data,
			'status': {
				'type': type,
				'message': message
			}
		}), undefined, 0);
	}

	/**
	 *
	 */
	 function onlyUnique(value, index, self) {
	 	return self.indexOf(value) === index;
	 }

	/**
	 *
	 */
	 function findAllTracksInDBconfigNeededByEMUwebApp(DBconfig) {
	 	var allTracks = [];

		// anagestConfig ssffTracks
		DBconfig.levelDefinitions.forEach(function (ld) {
			if (ld.anagestConfig !== undefined) {
				allTracks.push(ld.anagestConfig.verticalPosSsffTrackName);
				allTracks.push(ld.anagestConfig.velocitySsffTrackName);
			}
		});


		DBconfig.EMUwebAppConfig.perspectives.forEach(function (p) {
			// tracks in signalCanvases.order
			p.signalCanvases.order.forEach(function (sco) {
				allTracks.push(sco);
			});
			// tracks in signalCanvases.assign
			if (p.signalCanvases.assign !== undefined) {
				p.signalCanvases.assign.forEach(function (sca) {
					allTracks.push(sca.ssffTrackName);
				});
			}
			// tracks in twoDimCanvases.twoDimDrawingDefinitions
			if (p.twoDimCanvases !== undefined) {
				if (p.twoDimCanvases.twoDimDrawingDefinitions !== undefined) {
					p.twoDimCanvases.twoDimDrawingDefinitions.forEach(function (tddd) {
						tddd.dots.forEach(function (dot) {
							allTracks.push(dot.xSsffTrack);
							allTracks.push(dot.ySsffTrack);
						});
					});
				}
			}
		});
		// uniq tracks
		allTracks = allTracks.filter(onlyUnique);
		// # remove OSCI and SPEC tracks
		var osciIdx = allTracks.indexOf('OSCI');
		if (osciIdx > -1) {
			allTracks.splice(osciIdx, 1);
		}
		var specIdx = allTracks.indexOf('SPEC');
		if (specIdx > -1) {
			allTracks.splice(specIdx, 1);
		}

		// get corresponding ssffTrackDefinitions
		var allTrackDefs = [];
		DBconfig.ssffTrackDefinitions.forEach(function (std) {
			if (allTracks.indexOf(std.name) > -1) {
				allTrackDefs.push(std);
			}
		});

		return (allTrackDefs);

	}


	/**
	 *
	 */
	 function generateUUID() {
	 	function rand(s) {
	 		var p = (Math.random().toString(16) + '000000000').substr(2, 8);
	 		return s ? '-' + p.substr(0, 4) + '-' + p.substr(4, 4) : p;
	 	}

	 	return rand() + rand(true) + rand(true) + rand();
	 }

	/**
	 *
	 */
	 function checkCredentialsInSQLiteDB(username, pwd, callback) {
	 	usersDB.all("SELECT * FROM users WHERE username='" + username + "'", function (err, rows) {
	 		if (err !== null) {
	 			log.error('SQLite database error: ', err);
	 			callback(false);
	 			return;
	 		}

	 		if (rows.length !== 1) {
	 			callback(false);
	 		} else {
	 			var res = bcrypt.compareSync(pwd, rows[0].password);
	 			if (res) {
	 				callback(true);
	 			} else {
	 				callback(false);
	 			}
	 		}
	 	});
	 }


	/**
	 * Check if a given user may access a given database.
	 * This does *NOT* involve checking their password. It only checks
	 * whether there is a bundle list for the user. The database is given
	 * via the wsConnect object.
	 */
	 function authorizeViaBundleList(username, wsConnect) {
	 	var deferred = Q.defer();

	 	var bundleListPath = path.join(
	 		wsConnect.path2db,
	 		'bundleLists',
	 		path.normalize(username + '_bundleList.json')
	 		);

	 	fs.readFile(bundleListPath, 'utf8', function (err, data) {
	 		if (err) {
	 			log.info('error reading _bundleList:', err,
	 				'; clientID:', wsConnect.connectionID,
	 				'; clientIP:', wsConnect._socket.remoteAddress);

				// handle wrong user name
				deferred.reject();
				return;
			} else {
				log.info('found _bndlList.json for user: ', username, ' in: ', wsConnect.upgradeReq.url,
					'; clientID:', wsConnect.connectionID,
					'; clientIP:', wsConnect._socket.remoteAddress);

				var parsedData;
				// safely parse data:
				try {
					parsedData = jsonlint.parse(data);
				} catch (e) {
					log.info('failed to parse bundle list for user: ', username, ' in: ', wsConnect.upgradeReq.url,
						'; clientID:', wsConnect.connectionID,
						'; clientIP:', wsConnect._socket.remoteAddress);
					deferred.reject();
					return;
				}

				deferred.resolve({
					parsedData: parsedData,
					path: bundleListPath
				});
			}
		});

	 	return deferred.promise;
	 }

	 function authenticateViaSqlOrLdap(username, password, wsConnect) {
	 	var deferred = Q.defer();

	 	if (cfg.use_ldap) {
			// test if user can bind to LDAP
			var binddn = cfg.binddn_left + username + cfg.binddn_right;

			var ldapClient = ldap.createClient({
				url: cfg.ldap_address,
				log: log
			});

			ldapClient.bind(binddn, password, function (err) {
				if (err) {
					log.info('user', username, 'failed to bind to LDAP with' +
						' error:', JSON.stringify(err, undefined, 0),
						'; clientID:', wsConnect.connectionID,
						'; clientIP:', wsConnect._socket.remoteAddress);

					ldapClient.unbind();

					// check if in SQLiteDB
					checkCredentialsInSQLiteDB(username, password, function (res) {
						if (res) {
							log.info("user found in SQLiteDB",
								'; username:', username,
								'; clientID:', wsConnect.connectionID,
								'; clientIP:', wsConnect._socket.remoteAddress);

							deferred.resolve();
						} else {
							log.info("user not found in SQLiteDB",
								'; username:', username,
								'; clientID:', wsConnect.connectionID,
								'; clientIP:', wsConnect._socket.remoteAddress);

							deferred.reject();
						}
					});
				} else {
					ldapClient.unbind();

					log.info('User', username, 'was able to bind to LDAP',
						'; clientID:', wsConnect.connectionID,
						'; clientIP:', wsConnect._socket.remoteAddress);

					deferred.resolve();
				}
			});
} else {
	checkCredentialsInSQLiteDB(username, password, function (res) {
		if (res) {
			log.info("user found in SQLiteDB",
				'; clientID:', wsConnect.connectionID,
				'; clientIP:', wsConnect._socket.remoteAddress);

			deferred.resolve();
		} else {
			log.info("user not found in SQLiteDB",
				'; clientID:', wsConnect.connectionID,
				'; clientIP:', wsConnect._socket.remoteAddress);

			deferred.reject();
		}
	});
}

return deferred.promise;
}

	/**
	 *
	 */
	 function updateBndlListEntry(bndlListPath, entry) {
	 	var deferred = Q.defer();

	 	fs.readFile(bndlListPath, function (err, data) {
	 		if (err) {
	 			deferred.reject(new Error(err));
	 		} else {
	 			var curBndlList = JSON.parse(data);

	 			var foundEntry = false;
	 			for (var i = 0; i < curBndlList.length; i++) {
	 				if (curBndlList[i].name === entry.name && curBndlList[i].session === entry.session) {
	 					curBndlList[i] = entry;
	 					foundEntry = true;
	 					break;
	 				}
	 			}

	 			if (foundEntry) {
	 				fs.writeFile(bndlListPath, JSON.stringify(curBndlList, undefined, 2), function (err) {
	 					if (err) {
	 						deferred.reject(new Error(err));
	 					} else {
	 						deferred.resolve();
	 					}
	 				});
	 			} else {
	 				deferred.reject();
	 			}
	 		}
	 	});

	 	return deferred.promise;
	 }

	/**
	 *
	 */
	 function filterBndlList(bndlList) {

	 	var filtBndlList = [];

	 	for (var i = 0; i < bndlList.length; i++) {
	 		if (bndlList[i].finishedEditing !== true) {
	 			filtBndlList.push(bndlList[i]);
	 		}
	 	}

	 	return filtBndlList;

	 }

	/**
	 *
	 */
	 function commitToGitRepo(path2db, ID, bundleName, connectionID, remoteAddress) {
	 	var deferred = Q.defer();

	 	fs.exists(path.join(path2db, '.git'), function (exists) {
	 		if (exists) {
	 			var commitMessage = 'EMU-webApp auto save commit; User: ' + ID + '; DB: ' + path2db + '; Bundle: ' + bundleName;
	 			var gitCommand = 'git --git-dir=' + path.join(path2db, '.git') + ' --work-tree=' + path2db + ' commit -am "' + commitMessage + '"';

	 			log.info('Commit to dbs git repo with command: ' + gitCommand,
	 				'; clientID:', connectionID,
	 				'; clientIP:', remoteAddress);

	 			exec(gitCommand, function (error, stdout, stderr) {
	 				if (error !== null) {
	 					log.info('Error commiting to git repo',
	 						'; clientID:', connectionID,
	 						'; clientIP:', remoteAddress);
	 					deferred.resolve();
	 				}
	 				deferred.resolve();
	 			});
	 		} else {
	 			log.info('no .git directory found',
	 				'; clientID:', connectionID,
	 				'; clientIP:', remoteAddress);
	 			deferred.resolve();
	 		}
	 	});

	 	return deferred.promise;
	 }


	/**
	 * Read all files pertaining to a bundle from disk and return a promise
	 * resolving to that bunch of files.
	 *
	 * The params are expected to have been escaped.
	 *
	 * @param sessionPath Full path to the session directory
	 * @param bundleName Name of the bundle, without _bndl suffix.
	 * @param wsConnect The connection that requested the bundle.
	 * @returns A promise resolving to a a "bundle bunch of files".
	 */
	 function readBundleFromDisk(sessionPath, bundleName, wsConnect) {
	 	var deferred = Q.defer();

	 	var bundlePath = path.join(sessionPath, bundleName + '_bndl');

	 	var bundle = {};
	 	bundle.ssffFiles = [];

	 	var allFilePaths = [];

		// add media file path
		var mediaFilePath = path.join(bundlePath, bundleName + '.' + wsConnect.dbConfig.mediafileExtension);
		allFilePaths.push(mediaFilePath);

		// add annotation file path
		var annotFilePath = path.join(bundlePath, bundleName + '_annot.json');
		allFilePaths.push(annotFilePath);

		// add ssff file paths
		var ssffFilePaths = [];
		wsConnect.allTrackDefsNeededByEMUwebApp.forEach(function (td) {
			var ssffFilePath = path.join(bundlePath, bundleName + '.' + td.fileExtension);
			allFilePaths.push(ssffFilePath);
			ssffFilePaths.push(ssffFilePath);
		});

		// read in files using async.map
		async.map(allFilePaths, fs.readFile, function (err, results) {
			if (err) {
				log.error('reading bundle components:', err,
					'; clientID:', wsConnect.connectionID,
					'; clientIP:', wsConnect._socket.remoteAddress);

				deferred.reject();
			} else {
				var fileIdx;

				// set media file
				fileIdx = allFilePaths.indexOf(mediaFilePath);
				bundle.mediaFile = {
					encoding: 'BASE64',
					data: results[fileIdx].toString('base64')
				};

				// set annotation file
				fileIdx = allFilePaths.indexOf(annotFilePath);
				bundle.annotation = JSON.parse(results[fileIdx].toString('utf8'));

				// set ssffTracks
				ssffFilePaths.forEach(function (sfp) {
					fileIdx = allFilePaths.indexOf(sfp);
					// extract file ext
					var fileExt = path.extname(sfp).split('.').pop();
					bundle.ssffFiles.push({
						fileExtension: fileExt,
						encoding: 'BASE64',
						data: results[fileIdx].toString('base64')
					});
				});

				log.info('Finished reading bundle components. Now returning them.',
					'; clientID:', wsConnect.connectionID,
					'; clientIP:', wsConnect._socket.remoteAddress);

				deferred.resolve(bundle);
			}
		});

return deferred.promise;
}

	/**
	 * Write a bundle to disk and return a promise to indicate success.
	 *
	 * @param sessionPath Full path to the session directory
	 * @param bundleName Name of the bundle, without _bndl suffix.
	 * @param wsConnect The connection that requested the bundle.
	 * @param data The data part of the SAVEBUNDLE request.
	 * @param wsConnect The connection that sent the request.
	 * @returns A promise that is rejected with a message string or resolves
	 *           to null.
	 */
	 function writeBundleToDisk(sessionPath, bundleName, data, wsConnect) {
	 	var deferred = Q.defer();

		// update bundleList
		updateBndlListEntry(wsConnect.bndlListPath, {
			'name': data.annotation.name,
			'session': data.session,
			'finishedEditing': data.finishedEditing,
			'comment': data.comment
		}).then(function () {
			// save annotation
			var annotJSONpath = path.join(
				sessionPath,
				bundleName + '_bndl',
				path.normalize(bundleName + '_annot.json')
				);
			var fmsPath = path.join(
				sessionPath,
				bundleName + '_bndl',
				path.normalize(bundleName + '.fms')
				);

			fs.writeFile(annotJSONpath, JSON.stringify(data.annotation, undefined, 2), function (err) {
				if (err) {
					deferred.reject('Error writing annotation ' + err);
				} else {
					// save FORMANTS track (if defined for DB)
					var foundFormantsDef = false;
					for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
						if (wsConnect.dbConfig.ssffTrackDefinitions[i].name === 'FORMANTS') {
							foundFormantsDef = true;
						}
					}

					if (foundFormantsDef) {
						// write SSFF stored in data.ssffFiles[0] back to
						// file (expects FORMANTS files to have .fms as extentions)
						fs.writeFile(fmsPath, data.ssffFiles[0].data, 'base64', function (err) {
							// git commit
							if (cfg.use_git_if_repo_found) {
								commitToGitRepo(wsConnect.path2db, wsConnect.ID, data.annotation.name, wsConnect.connectionID, wsConnect._socket.remoteAddress).then(function (resp) {
									deferred.resolve();
								});
							} else {
								deferred.resolve();
							}
						});
					} else {
						// git commit SIC redundant
						if (cfg.use_git_if_repo_found) {
							commitToGitRepo(wsConnect.path2db, wsConnect.ID, data.annotation.name, wsConnect.connectionID, wsConnect._socket.remoteAddress).then(function (resp) {
								deferred.resolve();
							});
						} else {
							deferred.resolve();
						}
					}
				}
			});

}, function (err) {
	deferred.reject('Error updating bundleList: ' + err);
});

return deferred.promise;
}

	/**
	 * Read database configuration from disk and return a promise resolving
	 * to the parsed object.
	 *
	 * @param path Full path to DBConfig.json file.
	 * @param wsConnect The connection that requested the configuration.
	 * @returns A promise resolving to a DBConfig object.
	 */
	 function readGlobalDBConfigFromDisk(path, wsConnect) {
	 	var deferred = Q.defer();

	 	fs.readFile(path, 'utf8', function (err, data) {
	 		if (err) {
	 			log.info('Error reading _DBconfig: ' + err,
	 				'; clientID:', wsConnect.connectionID,
	 				'; clientIP:', wsConnect._socket.remoteAddress);

	 			deferred.reject(err);
	 		} else {
	 			wsConnect.dbConfig = JSON.parse(data);

				// figure out which SSFF files should be sent with each bundle
				wsConnect.allTrackDefsNeededByEMUwebApp = findAllTracksInDBconfigNeededByEMUwebApp(wsConnect.dbConfig);

				deferred.resolve(wsConnect.dbConfig);
			}
		});

	 	return deferred.promise;
	 }

	//
	// End of helper functions
	//////////////////////////


	////////////////////////////////////////////////////////////////
	// Default event handlers for messages received from the client.
	// Each message type has a handler function associated with it.
	//

	function defaultHandlerGetProtocol(mJSO, wsConnect) {
		// if authoriseNewConnection() returns false, that means:
		// - the function has failed
		// - and it has already sent a reply to the client using mJSO.callbackID

		var status = authoriseNewConnection(mJSO, wsConnect);

		if (status) {
			sendMessage(wsConnect, mJSO.callbackID, true, '', {
				'protocol': 'EMU-webApp-websocket-protocol',
				'version': '0.0.2'
			});
		}
	}

	function defaultHandlerGetDoUserManagement(mJSO, wsConnect) {
		// IF the user did not send a secretToken, we ask them for
		// username/password. Otherwise, we check the secret token.
		if (!wsConnect.urlQuery.hasOwnProperty('secretToken')) {
			sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
		} else {
			var secretToken = wsConnect.urlQuery.secretToken;

			// Validate input
			let regex = /[a-fA-F0-9]+/;
			if (!regex.test(secretToken)) {
				// Error in secretToken handling - tell the webapp to do normal user management
				sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
			}

			// ask postgres for secretToken
			try {
				var client = new pg.Client({
					host: cfg.sql.host,
					port: cfg.sql.port,
					user: cfg.sql.user,
					password: cfg.sql.password,
					database: cfg.sql.database,
					ssl: cfg.sql.ssl
				});

				client.connect(function (error) {
					if (error) {
						// Error in secretToken handling - tell the webapp to do normal user management
						sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
						return;
					}

					client.query(
						"SELECT * FROM authtokens WHERE token = $1 AND" +
						" validuntil > current_timestamp",
						[secretToken],
						function (error, result) {
							if (error) {
								// Error in secretToken handling - tell the webapp to do normal user management
								sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
								return;
							}

							client.end();

							if (result.rows.length === 0) {
								// Error in secretToken handling - tell the webapp to do normal user management
								sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
								return;
							}

							var username = result.rows[0].userid;

							authorizeViaBundleList(username, wsConnect).then(
								function(bundleListInfo) {
									// mark connection as authorised for the
									// requested db
									wsConnect.authorised = true;
									// add ID to connection object
									wsConnect.ID = username;
									// add bndlList to connection object
									if (cfg.filter_bndlList_for_finishedEditing) {
										wsConnect.bndlList = filterBndlList(bundleListInfo.parsedData);
									} else {
										wsConnect.bndlList = bundleListInfo.parsedData;
									}
									wsConnect.bndlListPath = bundleListInfo.path;

									sendMessage(wsConnect, mJSO.callbackID, true, '', 'NO');
								},
								function (reason) {
									// Error in secretToken handling - tell the webapp to do normal user management
									sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
								}
								);
						}
						);
});
} catch (error) {
				// Error in secretToken handling - tell the webapp to do normal user management
				sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
			}
		}
	}

	function defaultHandlerLogonUser(mJSO, wsConnect) {
		authorizeViaBundleList(mJSO.userName, wsConnect).then(
			function (bundleListInfo) {
				authenticateViaSqlOrLdap(mJSO.userName, mJSO.pwd, wsConnect).then(
					function (value) {
						// mark connection as authorised for the
						// requested db
						wsConnect.authorised = true;
						// add ID to connection object
						wsConnect.ID = mJSO.userName;
						// add bndlList to connection object
						if (cfg.filter_bndlList_for_finishedEditing) {
							wsConnect.bndlList = filterBndlList(bundleListInfo.parsedData);
						} else {
							wsConnect.bndlList = bundleListInfo.parsedData;
						}
						wsConnect.bndlListPath = bundleListInfo.path;

						sendMessage(wsConnect, mJSO.callbackID, true, '', 'LOGGEDON');
					},
					function (reason) {
						// @todo this string ('cant login ..') should be in message rather than data I'd say, since it is not machine-readable
						sendMessage(wsConnect, mJSO.callbackID, true, '', 'Can\'t log on with given credentials');
					}
					);
			},
			function (reason) {
				// There is no bundle list for the user -> reject them
				sendMessage(wsConnect, mJSO.callbackID, true, '', 'BADUSERNAME');
			}
			);
}

function defaultHandlerGetGlobalDBConfig(mJSO, wsConnect) {
	var dbConfigPath = path.normalize(path.join(wsConnect.path2db, wsConnect.dbName + '_DBconfig.json'));

	readGlobalDBConfigFromDisk(dbConfigPath, wsConnect).then(
		function (value) {
			sendMessage(wsConnect, mJSO.callbackID, true, '', wsConnect.dbConfig);
		},
		function (reason) {
			sendMessage(wsConnect, mJSO.callbackID, false, reason);
		}
		);
}

function defaultHandlerGetBundleList(mJSO, wsConnect) {
	sendMessage(wsConnect, mJSO.callbackID, true, '', wsConnect.bndlList);
}

function defaultHandlerGetBundle(mJSO, wsConnect) {
	log.info('GETBUNDLE session: ' + mJSO.session + '; GETBUNDLE name: ' + mJSO.name,
		'; clientID:', wsConnect.connectionID,
		'; clientIP:', wsConnect._socket.remoteAddress);

		// User input is escaped via path.normalize(); this way, ".." cannot
		// be used to break out of the directory set by cfg.path2emuDBs
		var sessionPath = path.join(
			wsConnect.path2db,
			path.normalize(mJSO.session + '_ses')
			);
		var bundleName = path.normalize(mJSO.name);

		// Read bundle from disk and send it back to the client
		readBundleFromDisk(sessionPath, bundleName, wsConnect).then(
			function (value) {
				sendMessage(wsConnect, mJSO.callbackID, true, '', value);
			},
			function (reason) {
				// Previous version did send data: bundle despite errors.
				// @todo Does anybody depend on this behaviour?
				sendMessage(wsConnect, mJSO.callbackID, false, 'Error reading bundle components');
			}
			);
	}

	function defaultHandlerSaveBundle(mJSO, wsConnect) {
		log.info('Saving: ' + mJSO.data.annotation.name,
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
				sendMessage(wsConnect, mJSO.callbackID, true);
			},
			function (reason) {
				sendMessage(wsConnect, mJSO.callbackID, false, reason);
			}
			)
	}

	function defaultHandlerDisconnectWarning(mJSO, wsConnect) {
		sendMessage(wsConnect, mJSO.callbackID, true);
	}

	module.exports = {
		cfg: cfg,
		log: log,

		defaultHandlerGetProtocol: defaultHandlerGetProtocol,
		defaultHandlerGetDoUserManagement: defaultHandlerGetDoUserManagement,
		defaultHandlerLogonUser: defaultHandlerLogonUser,
		defaultHandlerGetGlobalDBConfig: defaultHandlerGetGlobalDBConfig,
		defaultHandlerGetBundleList: defaultHandlerGetBundleList,
		defaultHandlerGetBundle: defaultHandlerGetBundle,
		defaultHandlerSavebundle: defaultHandlerSaveBundle,
		defaultHandlerDisconnectWarning: defaultHandlerDisconnectWarning,

		sendMessage: sendMessage,
		onlyUnique: onlyUnique,
		findAllTracksInDBconfigNeededByEMUwebApp: findAllTracksInDBconfigNeededByEMUwebApp,
		generateUUID: generateUUID,
		checkCredentialsInSQLiteDB: checkCredentialsInSQLiteDB,
		updateBndlListEntry: updateBndlListEntry,
		filterBndlList: filterBndlList,
		commitToGitRepo: commitToGitRepo,
		readBundleFromDisk: readBundleFromDisk,
		writeBundleToDisk: writeBundleToDisk,
		readGlobalDBConfigFromDisk: readGlobalDBConfigFromDisk,
		authoriseNewConnection: authoriseNewConnection
	};
	//
	// End of default event handlers
	////////////////////////////////


	////////////////////////////////
	// handle ws server connections
	// a.k.a. "main loop"
	//

	// keep track of clients
	var clients = [];

	wss.on('connection', function (wsConnect) {
		// generate uuid for connection
		wsConnect.connectionID = generateUUID();

		// log connection
		log.info('new client connected',
			'; clientID:', wsConnect.connectionID,
			'; clientIP:', wsConnect._socket.remoteAddress,
			'; URL:', wsConnect.upgradeReq.url
			);

		// Has the user been authorised to use the database they requested?
		wsConnect.authorised = false;

		// A set of pointers to event handler functions.
		// They initially reflect default behaviour and may be
		// changed when database-specific plugins are loaded.
		wsConnect.messageHandlers = {};
		for (var i in defaultMessageHandlers) {
			wsConnect.messageHandlers[i] = defaultMessageHandlers[i];
		}

		// append new connection to client list
		clients.push(wsConnect);

		/////////////////////////////////////
		// connection-specific event handlers

		// close event
		wsConnect.on('close', function (message) {
			log.info('closing connection',
				'; clientID:', wsConnect.connectionID,
				'; clientIP:', 'NA on close');

			// remove client
			for (var i = 0; i < clients.length; i++) {
				if (clients[i].connectionID === wsConnect.connectionID) {
					clients.splice(i);
					break;
				}
			}
		});

		// message event
		wsConnect.on('message', function (message) {
			var mJSO = JSON.parse(message);

			log.info('request/message type:', mJSO.type,
				'; clientID:', wsConnect.connectionID,
				'; clientIP:', wsConnect._socket.remoteAddress);

			// If the connection has not been authorised to use a database,
			// allow only generic protocol functions to be used.
			if (wsConnect.authorised !== true) {
				if (
					mJSO.type !== 'GETPROTOCOL'
					&& mJSO.type !== 'LOGONUSER'
					&& mJSO.type !== 'GETDOUSERMANAGEMENT'
					) {
					sendMessage(wsConnect, mJSO.callbackID, false, 'Sent' +
						' request type that is only allowed after logon!' +
						' Request type was: ' + mJSO.type);
				return;
			}
		}


			// Check whether mJSO.type is valid and call the respective handler
			if (
				wsConnect.messageHandlers.hasOwnProperty(mJSO.type)
				&& typeof wsConnect.messageHandlers[mJSO.type] === 'function'
				) {
				// Call the event handler but make sure we catch *all* errors
				// try .. catch would not catch any errors the event handler
				// throws asynchronously. That is why why we use domains.

				var pluginDomain = domain.create();
				pluginDomain.on('error', function (error) {
					log.error(
						'Uncaught exception in handling request of type:', mJSO.type,
						'; error message:', error.message,
						'; database:', wsConnect.path2db,
						'; clientIP:', wsConnect._socket.remoteAddress,
						error
						);

					sendMessage(
						wsConnect, mJSO.callbackID, false,
						'Unknown error in server or a database plugin.' +
						' Technical error message: ' + error.message
						);

					// @todo kill respective connection?

				});
				pluginDomain.run(function () {
					// Call handler
					(wsConnect.messageHandlers[mJSO.type])(mJSO, wsConnect);
				});
			} else {
				sendMessage(wsConnect, mJSO.callbackID, false, 'Sent request' +
					' type that is unknown to server! Request type was: ' + mJSO.type);
			}
		});
});
}());
