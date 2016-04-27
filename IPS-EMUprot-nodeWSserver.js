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
 * @author Raphael Winkelmann
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
	var bcrypt = require('bcrypt');
	var sqlite3 = require('sqlite3').verbose();
	var async = require('async');
	var Q = require('q');
	var jsonlint = require('jsonlint');
	var url = require('url');

	// for authentication to work
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


	// create logger
	var log = bunyan.createLogger({
		name: "nodeEmuWS"
	});

	log.info("starting server...");

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
	// set up certs and keys for secure connection


	var httpServ = (cfg.ssl) ? require('https') : require('http');

	var WebSocketServer = require('ws').Server;

	var app = null;

	// dummy request processing
	var processRequest = function (req, res) {

		res.writeHead(200);
		res.end("All glory to WebSockets!\n");
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
	 * These are callbacks functions for specific request types.
	 *
	 * When a message is received from a client, the message's type field is
	 * checked to see if there is a handler for it. If there is not, the
	 * message is rejected as invalid. If there is, the respective handler
	 * function is called.
	 *
	 * Plugins are allowed to override the handler functions for a number of
	 * request types.
	 */
	var defaultMessageHandlers = {
		GETPROTOCOL: defaultHandlerGetProtocol,
		DISCONNECTWARNING: defaultHandlerDisconnectWarning,
		GETDOUSERMANAGEMENT: defaultHandlerGetDoUserManagement,
		LOGONUSER: defaultHandlerLogonUser,
		GETGLOBALDBCONFIG: defaultHandlerGetGlobalDBConfig,

		// The following can be overridden by plugins
		// @todo finalise this list
		GETBUNDLELIST: defaultHandlerGetBundleList,
		GETBUNDLE: defaultHandlerGetBundle,
		SAVEBUNDLE: defaultHandlerSaveBundle
	};

	/**
	 * Look for a plugin configuration file in database and load the plugins.
	 *
	 * The file must be named nodejs_server_plugins.json and reside at the
	 * db's top level directory. It must contain a JSON array of strings.
	 *
	 * @throws When plugin configuration cannot be found or is corrupt.
	 * @throws When loadPlugin() fails for one of the plugins.
	 * @param wsConnect The connection object to attach the plugin to.
	 */
	function loadAllPlugins(wsConnect) {
		// Read plugin configuration file
		var pluginConfigPath = path.join(wsConnect.path2db, 'nodejs_server_plugins.json');

		try {
			var file = fs.readFileSync(pluginConfigPath);
			var pluginList = JSON.parse();
		} catch (err) {
			// ENOENT means that the file has not been found, which in turn
			// means that no plugins have been configured. This is not critical.
			if (err.code === 'ENONENT') {
				return;
			}

			// Every other error is critical and should lead to the DB not
			// being accessible
			throw new Error('Plugin config file could not be read: ', +pluginConfigPath);
		}

		// Load plugins
		if (pluginList instanceof Array) {
			for (var i = 0; i < pluginList.length; ++i) {
				if (typeof pluginList[i] === 'string') {
					// loadPlugin might throw but this is deliberately not
					// caught at this point
					loadPlugin(wsConnect, pluginList[i]);
				} else {
					throw new Error('Plugin config file is corrupt: ' + pluginConfigPath);
				}
			}
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
		try {
			var plugin = require(path.join('.', 'plugins', pluginName));

			var pluginMessageHandlers = plugin.pluginMessageHandlers;

			if (typeof pluginMessageHandlers !== 'object') {
				throw new Error('Plugin does not export pluginMessageHandlers object');
			}
		} catch (error) {
			log.info('Could not load plugin:', pluginName, '; reason:', error.message);
			throw error;
		}

		try {
			// @todo adapt this to finalised list of overridable functions
			if (typeof pluginMessageHandlers.GETBUNDLELIST === 'function') {
				wsConnect.messageHandlers.GETBUNDLELIST = pluginMessageHandlers.GETBUNDLELIST;
			}

			if (typeof pluginMessageHandlers.GETBUNDLE === 'function') {
				wsConnect.messageHandlers.GETBUNDLE = pluginMessageHandlers.GETBUNDLE;
			}

			if (typeof pluginMessageHandlers.SAVEBUNDLE === 'function') {
				wsConnect.messageHandlers.SAVEBUNDLE = pluginMessageHandlers.SAVEBUNDLE;
			}
		} catch (error) {
			log.info('Error loading plugin (it may have been loaded' +
				' partially:', pluginName, '; reason:', error.message);
			throw error;
		}
	}

	/**
	 * Parse a URL into path and query string. This is used whenever a
	 * connection is established. Additionally, check whether the path
	 * resolves to a readable directory. (It is not checked whether
	 * the directory actually contains a database.)
	 *
	 * Returns an object with the properties path2db and query. path2db is
	 * the combination of cfg.path2emuDBs and the URL's path component.
	 * query is an object containing the key value pairs from the URL's
	 * query string.
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
		var dbName = urlObj.pathname;

		// Make sure the requested DB path has no .. or . in it, so it
		// cannot escape from our database directory
		dbName = path.normalize(dbName);

		// Construct path to requested database
		var path2db = path.normalize(path.join(cfg.path2emuDBs, dbName));

		// Make sure we are not trying to point at the root dir of all
		// databases
		if (path2db === path.normalize(cfg.path2emuDBs)) {
			throw new Error('Invalid database specified');
		}

		// This will throw if we cannot Read and eXecute the db path
		fs.accessSync(path2db, fs.R_OK | fs.X_OK);

		return {
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
	 *
	 */
	function updateBndlListEntry(bndlListPath, entry) {
		var deferred = Q.defer();

		fs.readFile(bndlListPath, function (err, data) {
			if (err) {
				deffered.reject(new Error(err));
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


	// keep track of clients
	var clients = [];

	////////////////////////////////
	// handle ws server connections

	wss.on('connection', function (wsConnect) {
		// generate uuid for connection
		wsConnect.connectionID = generateUUID();

		// log connection
		log.info('new client connected',
			'; clientID:', wsConnect.connectionID,
			'; clientIP:', wsConnect._socket.remoteAddress);

		// Has the user been authorised to use the database they requested?
		wsConnect.authorised = false;

		// Parse URL and save which database the client requests to access.
		// Also save any query parameters. WARNING The query parameters are
		// stored in wsConnect.urlQuery WITHOUT BEING ESCAPED OR VALIDATED.
		try {
			var urlParams = parseURL(wsConnect.upgradeReq.url);
		} catch (error) {
			// @todo is it okay to send empty callbackID?
			sendMessage(wsConnect, '', false, 'The requested database is not readable');
			wsConnect.terminate();
			return;
		}
		wsConnect.path2db = urlParams.path2db;
		wsConnect.urlQuery = urlParams.query;
		// Extract last component of path2db - this is the db's name
		wsConnect.dbName = path.basename(urlParams.path2db);

		// A set of pointers to event handler functions.
		// They initially reflect default behaviour and may be
		// changed when database-specific plugins are loaded.
		wsConnect.messageHandlers = {};
		Object.assign(wsConnect.handlers, defaultMessageHandlers);

		// load database-specific plugins
		try {
			loadAllPlugins(wsConnect);
		} catch (error) {
			// It was not possible to load all configured plugins
			// @todo is it okay to send empty callbackID?
			sendMessage(wsConnect, '', false, 'The requested database could not be loaded');
			wsConnect.terminate();
			return;
		}

		// @todo offer onConnect hook for plugins? - otherwise GETPROTOCOL will be misused for the reason

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
				try {
					// Call handler
					(wsConnect.messageHandlers[mJSO.type])(mJSO, wsConnect);
				} catch (err) {
					log.error('Error in handling request of type: ', mJSO.type,
						'; error message: ', err.message);
				}
			} else {
				sendMessage(wsConnect, mJSO.callbackID, false, 'Sent request' +
					' type that is unknown to server! Request type was: ' + mJSO.type);
			}
		});
	});


	function defaultHandlerGetProtocol(mJSO, wsConnect) {
		log.info('Following URL path (i.e. DB) was requested: ', wsConnect.upgradeReq.url,
			'; clientID:', wsConnect.connectionID,
			'; clientIP:', wsConnect._socket.remoteAddress);

		sendMessage(wsConnect, mJSO.callbackID, true, '', {
			'protocol': 'EMU-webApp-websocket-protocol',
			'version': '0.0.2'
		});
	}

	function defaultHandlerGetDoUserManagement(mJSO, wsConnect) {
		sendMessage(wsConnect, mJSO.callbackID, true, '', 'YES');
	}

	function defaultHandlerLogonUser(mJSO, wsConnect) {
		fs.readFile(path.join(wsConnect.path2db, mJSO.userName + '_bundleList.json'), 'utf8', function (err, data) {
			if (err) {

				log.info('error reading _bundleList:', err,
					'; clientID:', wsConnect.connectionID,
					'; clientIP:', wsConnect._socket.remoteAddress);

				// handle wrong user name
				// @todo is this indeed a success?
				sendMessage(wsConnect, mJSO.callbackID, true, '', 'BADUSERNAME');
			} else {

				var parsedData;
				// safely parse data:
				try {
					parsedData = jsonlint.parse(data);
				} catch (e) {
					sendMessage(wsConnect, mJSO.callbackID, false, 'Error' +
						' parsing _bundleList.json: ' + e);

					console.log(e);

					return;
				}

				log.info('found _bndlList.json for user: ', mJSO.userName, ' in: ', wsConnect.upgradeReq.url,
					'; clientID:', wsConnect.connectionID,
					'; clientIP:', wsConnect._socket.remoteAddress);

				// test if user is can bind to LDAP
				var binddn = cfg.binddn_left + mJSO.userName + cfg.binddn_right;

				var ldapClient = ldap.createClient({
					url: cfg.ldap_address,
					log: log
				});

				if (cfg.use_ldap) {
					ldapClient.bind(binddn, mJSO.pwd, function (err) {
						if (err) {
							log.info('user', mJSO.userName, 'failed to bind to LDAP with error:', JSON.stringify(err, undefined, 0),
								'; clientID:', wsConnect.connectionID,
								'; clientIP:', wsConnect._socket.remoteAddress);

							ldapClient.unbind();

							// check if in SQLiteDB
							checkCredentialsInSQLiteDB(mJSO.userName, mJSO.pwd, function (res) {
								if (res) {

									log.info("user found in SQLiteDB",
										'; clientID:', wsConnect.connectionID,
										'; clientIP:', wsConnect._socket.remoteAddress);

									// mark connection as authorised for the
									// requested db
									wsConnect.authorised = true;
									// add ID to connection object
									wsConnect.ID = mJSO.userName;
									// add bndlList to connection object
									if (cfg.filter_bndlList_for_finishedEditing) {
										wsConnect.bndlList = filterBndlList(parsedData);
									} else {
										wsConnect.bndlList = parsedData;
									}
									wsConnect.bndlListPath = path.join(wsConnect.path2db, mJSO.userName + '_bundleList.json');

									sendMessage(wsConnect, mJSO.callbackID, true, '', 'LOGGEDON');
								} else {
									log.info("user not found in SQLiteDB",
										'; clientID:', wsConnect.connectionID,
										'; clientIP:', wsConnect._socket.remoteAddress);

									// @todo is this indeed a success?
									// @todo data should be in message is it
									//       is not machine-readable, i'd say
									sendMessage(wsConnect, mJSO.callbackID, true, '', 'Can\'t log on with given credentials');
								}
							});


						} else {
							ldapClient.unbind();

							log.info('User', mJSO.userName, 'was able to bind to LDAP',
								'; clientID:', wsConnect.connectionID,
								'; clientIP:', wsConnect._socket.remoteAddress);

							// mark connection as authorised for the
							// requested db
							wsConnect.authorised = true;
							// add ID to connection object
							wsConnect.ID = mJSO.userName;
							// add bndlList to connection object
							if (cfg.filter_bndlList_for_finishedEditing) {
								wsConnect.bndlList = filterBndlList(parsedData);
							} else {
								wsConnect.bndlList = parsedData;
							}
							wsConnect.bndlListPath = path.join(wsConnect.path2db, mJSO.userName + '_bundleList.json');

							// reply
							sendMessage(wsConnect, mJSO.callbackID, true, '', 'LOGGEDON');
						}
					});
				} else {
					// SIC!!! redundant code from above... should wrap in func...
					// check if in SQLiteDB
					checkCredentialsInSQLiteDB(mJSO.userName, mJSO.pwd, function (res) {
						if (res) {

							log.info("user found in SQLiteDB",
								'; clientID:', wsConnect.connectionID,
								'; clientIP:', wsConnect._socket.remoteAddress);

							// mark connection as authorised for the
							// requested db
							wsConnect.authorised = true;
							// add ID to connection object
							wsConnect.ID = mJSO.userName;
							// add bndlList to connection object
							wsConnect.bndlList = JSON.parse(data);

							sendMessage(wsConnect, mJSO.callbackID, true, '', 'LOGGEDON');
						} else {

							log.info("user not found in SQLiteDB",
								'; clientID:', wsConnect.connectionID,
								'; clientIP:', wsConnect._socket.remoteAddress);

							// @todo is this indeed a success?
							sendMessage(wsConnect, mJSO.callbackID, true, '', 'Can\'t log on with given credentials');
						}
					});
				}
			}
		});
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
				sendMessage(wsConnect, mJSO.callbackID, false, 'Error' +
					' reading bundle components');
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
			path.normalize(mJSO.session + '_ses')
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
}());