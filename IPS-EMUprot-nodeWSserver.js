/**
 * node server that implements the EMU-webApp-websocket-protocol (version 0.0.2)
 *
 * to install dependencies:
 *
 *  > bower install
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
 * author: Raphael Winkelmann
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
    console.error('ERROR: server_config.json has to be given as an argument!!');
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


  // keep track of clients
  var clients = [];

  ////////////////////////////////
  // handle ws server connections

  wss.on('connection', function (wsConnect) {

    // append to clients
    wsConnect.connectionID = generateUUID();
    clients.push(wsConnect);
    log.info('new client connected',
      '; clientID:', wsConnect.connectionID,
      '; clientIP:', wsConnect._socket.remoteAddress);


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
      var res = fs.existsSync(cfg.path2emuDBs + wsConnect.upgradeReq.url);

      var mJSO = JSON.parse(message);

      log.info('request/message type:', mJSO.type,
        '; clientID:', wsConnect.connectionID,
        '; clientIP:', wsConnect._socket.remoteAddress);

      if (res && wsConnect.upgradeReq.url !== '/') {
        wsConnect.path2db = path.normalize(path.join(cfg.path2emuDBs, wsConnect.upgradeReq.url));
      } else {
        log.info('requested DB does not exist!',
          '; clientID:', wsConnect.connectionID,
          '; clientIP:', wsConnect._socket.remoteAddress);

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'status': {
            'type': 'ERROR',
            'message': 'Requested DB does not exist! The DB has to be specified in the URL: ws://exampleServer:17890/nameOfDB'
          }
        }), undefined, 0);
        return;
      }

      switch (mJSO.type) {

        // GETPROTOCOL method
      case 'GETPROTOCOL':

        log.info('Following URL path (i.e. DB) was requested: ', wsConnect.upgradeReq.url,
          '; clientID:', wsConnect.connectionID,
          '; clientIP:', wsConnect._socket.remoteAddress);

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'data': {
            'protocol': 'EMU-webApp-websocket-protocol',
            'version': '0.0.2'
          },
          'status': {
            'type': 'SUCCESS',
            'message': ''
          }
        }), undefined, 0);

        break;

        // GETDOUSERMANAGEMENT method
      case 'GETDOUSERMANAGEMENT':

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'data': 'YES',
          'status': {
            'type': 'SUCCESS',
            'message': ''
          }
        }), undefined, 0);

        break;

        // LOGONUSER method
      case 'LOGONUSER':
        fs.readFile(path.join(wsConnect.path2db, mJSO.userName + '_bundleList.json'), 'utf8', function (err, data) {
          if (err) {

            log.info('error reading _bundleList:', err,
              '; clientID:', wsConnect.connectionID,
              '; clientIP:', wsConnect._socket.remoteAddress);

            // handle wrong user name
            wsConnect.send(JSON.stringify({
              'callbackID': mJSO.callbackID,
              'data': 'BADUSERNAME',
              'status': {
                'type': 'SUCCESS',
                'message': ''
              }
            }), undefined, 0);

          } else {

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

                      // add ID to connection object
                      wsConnect.ID = mJSO.userName;
                      // add bndlList to connection object
                      if (cfg.filter_bndlList_for_finishedEditing) {
                        wsConnect.bndlList = filterBndlList(JSON.parse(data));
                      } else {
                        wsConnect.bndlList = JSON.parse(data);
                      }
                      wsConnect.bndlListPath = path.join(wsConnect.path2db, mJSO.userName + '_bundleList.json');

                      wsConnect.send(JSON.stringify({
                        'callbackID': mJSO.callbackID,
                        'data': 'LOGGEDON',
                        'status': {
                          'type': 'SUCCESS',
                          'message': ''
                        }
                      }), undefined, 0);

                    } else {

                      log.info("user not found in SQLiteDB",
                        '; clientID:', wsConnect.connectionID,
                        '; clientIP:', wsConnect._socket.remoteAddress);

                      wsConnect.send(JSON.stringify({
                        'callbackID': mJSO.callbackID,
                        'data': 'Can\'t log on with given credentials',
                        'status': {
                          'type': 'SUCCESS',
                          'message': ''
                        }
                      }), undefined, 0);
                    }
                  });



                } else {
                  ldapClient.unbind();

                  log.info('User', mJSO.userName, 'was able to bind to LDAP',
                    '; clientID:', wsConnect.connectionID,
                    '; clientIP:', wsConnect._socket.remoteAddress);

                  // add ID to connection object
                  wsConnect.ID = mJSO.userName;
                  // add bndlList to connection object
                  if (cfg.filter_bndlList_for_finishedEditing) {
                    wsConnect.bndlList = filterBndlList(JSON.parse(data));
                  } else {
                    wsConnect.bndlList = JSON.parse(data);
                  }
                  wsConnect.bndlListPath = path.join(wsConnect.path2db, mJSO.userName + '_bundleList.json');

                  // reply
                  wsConnect.send(JSON.stringify({
                    'callbackID': mJSO.callbackID,
                    'data': 'LOGGEDON',
                    'status': {
                      'type': 'SUCCESS',
                      'message': ''
                    }
                  }), undefined, 0);

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

                  // add ID to connection object
                  wsConnect.ID = mJSO.userName;
                  // add bndlList to connection object
                  wsConnect.bndlList = JSON.parse(data);

                  wsConnect.send(JSON.stringify({
                    'callbackID': mJSO.callbackID,
                    'data': 'LOGGEDON',
                    'status': {
                      'type': 'SUCCESS',
                      'message': ''
                    }
                  }), undefined, 0);

                } else {

                  log.info("user not found in SQLiteDB",
                    '; clientID:', wsConnect.connectionID,
                    '; clientIP:', wsConnect._socket.remoteAddress);

                  wsConnect.send(JSON.stringify({
                    'callbackID': mJSO.callbackID,
                    'data': 'Can\'t log on with given credentials',
                    'status': {
                      'type': 'SUCCESS',
                      'message': ''
                    }
                  }), undefined, 0);
                }
              });
            }
          }
        });

        break;

        // GETGLOBALDBCONFIG method
      case 'GETGLOBALDBCONFIG':

        var dbConfigPath = path.normalize(path.join(wsConnect.path2db, wsConnect.upgradeReq.url + '_DBconfig.json'));
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

        break;

        // GETBUNDLELIST method
      case 'GETBUNDLELIST':
        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'data': wsConnect.bndlList,
          'status': {
            'type': 'SUCCESS',
            'message': ''
          }
        }), undefined, 0);

        break;


        // GETBUNDLE method
      case 'GETBUNDLE':

        log.info('GETBUNDLE session: ' + mJSO.session + '; GETBUNDLE name: ' + mJSO.name,
          '; clientID:', wsConnect.connectionID,
          '; clientIP:', wsConnect._socket.remoteAddress);

        var path2bndl = path.normalize(path.join(wsConnect.path2db, mJSO.session + '_ses', mJSO.name + '_bndl'));

        var bundle = {};
        bundle.ssffFiles = [];

        var allFilePaths = [];

        // add media file path
        var mediaFilePath = path.join(path2bndl, mJSO.name + '.' + wsConnect.dbConfig.mediafileExtension);
        allFilePaths.push(mediaFilePath);

        // add annotation file path
        var annotFilePath = path.join(path2bndl, mJSO.name + '_annot.json');
        allFilePaths.push(annotFilePath);

        // add ssff file paths
        var ssffFilePaths = [];
        wsConnect.allTrackDefsNeededByEMUwebApp.forEach(function (td) {
          var ssffFilePath = path.join(path2bndl, mJSO.name + '.' + td.fileExtension);
          allFilePaths.push(ssffFilePath);
          ssffFilePaths.push(ssffFilePath);
        });

        console.log(allFilePaths);
        // read in files using async.map
        async.map(allFilePaths, fs.readFile, function (err, results) {
          if (err) {
            log.error('reading bundle components:', err,
              '; clientID:', wsConnect.connectionID,
              '; clientIP:', wsConnect._socket.remoteAddress);

            wsConnect.send(JSON.stringify({
              'callbackID': mJSO.callbackID,
              'data': bundle,
              'status': {
                'type': 'ERROR',
                'message': 'reading bundle components'
              }
            }), undefined, 0);

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

            wsConnect.send(JSON.stringify({
              'callbackID': mJSO.callbackID,
              'data': bundle,
              'status': {
                'type': 'SUCCESS',
                'message': ''
              }
            }), undefined, 0);
          }
        });

        // get bundle files
        // filewalker(path2bndl)
        //   .on('dir', function () {}).on('file', function (p) {
        //     var pattMedia = new RegExp(wsConnect.dbConfig.mediafileExtension + '$');
        //     var pattAnnot = new RegExp('_annot.json' + '$');

        //     // set media file path
        //     if (pattMedia.test(p)) {
        //       bundle.mediaFile = {};
        //       bundle.mediaFile.encoding = 'BASE64';
        //       bundle.mediaFile._filePath = path.join(path2bndl, p);
        //       allFilePaths.push(path.join(path2bndl, p));
        //     }

        //     // set annotation file path
        //     if (pattAnnot.test(p)) {
        //       bundle.annotation = {};
        //       bundle.annotation._filePath = path.join(path2bndl, p);
        //       allFilePaths.push(path.join(path2bndl, p));
        //     }

        //     // set ssffTrack paths for tracks in ssffTrackDefinitions
        //     for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
        //       var pattTrack = new RegExp(wsConnect.dbConfig.ssffTrackDefinitions[i].fileExtension + '$');
        //       if (pattTrack.test(p)) {
        //         bundle.ssffFiles.push({
        //           ssffTrackName: wsConnect.dbConfig.ssffTrackDefinitions[i].name,
        //           encoding: 'BASE64',
        //           _filePath: path.join(path2bndl, p)
        //         });

        //         allFilePaths.push(path.join(path2bndl, p));
        //       }
        //     }
        //   }).on('error', function (err) {
        //     wsConnect.send(JSON.stringify({
        //       'callbackID': mJSO.callbackID,
        //       'status': {
        //         'type': 'ERROR',
        //         'message': 'Error getting bundle! Request type was: ' + mJSO.type + ' Error is: ' + err
        //       }
        //     }), undefined, 0);
        //   }).on('done', function () {

        //     // check if correct number of files where found
        //     if (allFilePaths.length !== 2 + wsConnect.dbConfig.ssffTrackDefinitions.length) {
        //       wsConnect.send(JSON.stringify({
        //         'callbackID': mJSO.callbackID,
        //         'data': bundle,
        //         'status': {
        //           'type': 'ERROR',
        //           'message': 'Did not find all files belonging to bundle'
        //         }
        //       }), undefined, 0);

        //     } else {
        //       // read in files using async.map
        //       async.map(allFilePaths, fs.readFile, function (err, results) {
        //         if (err) {
        //           log.error('reading bundle components:', err,
        //             '; clientID:', wsConnect.connectionID,
        //             '; clientIP:', wsConnect._socket.remoteAddress);

        //           wsConnect.send(JSON.stringify({
        //             'callbackID': mJSO.callbackID,
        //             'data': bundle,
        //             'status': {
        //               'type': 'ERROR',
        //               'message': 'reading bundle components'
        //             }
        //           }), undefined, 0);

        //         } else {
        //           var fileIdx;

        //           // set media file
        //           fileIdx = allFilePaths.indexOf(bundle.mediaFile._filePath);
        //           bundle.mediaFile.data = results[fileIdx].toString('base64');
        //           delete bundle.mediaFile._filePath;

        //           // set annotation file
        //           fileIdx = allFilePaths.indexOf(bundle.annotation._filePath);
        //           bundle.annotation = JSON.parse(results[fileIdx].toString('utf8'));
        //           delete bundle.annotation._filePath;

        //           // set ssffTracks
        //           for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
        //             fileIdx = allFilePaths.indexOf(bundle.ssffFiles[i]._filePath);
        //             bundle.ssffFiles[i].data = results[fileIdx].toString('base64');
        //             delete bundle.ssffFiles[i]._filePath;
        //           }


        //           log.info('Finished reading bundle components. Now returning them.',
        //             '; clientID:', wsConnect.connectionID,
        //             '; clientIP:', wsConnect._socket.remoteAddress);

        //           wsConnect.send(JSON.stringify({
        //             'callbackID': mJSO.callbackID,
        //             'data': bundle,
        //             'status': {
        //               'type': 'SUCCESS',
        //               'message': ''
        //             }
        //           }), undefined, 0);
        //         }
        //       });
        //     }
        //   }).walk();

        break;

        // SAVEBUNDLE method
      case 'SAVEBUNDLE':

        log.info('Saving: ' + mJSO.data.annotation.name,
          '; clientID:', wsConnect.connectionID,
          '; clientIP:', wsConnect._socket.remoteAddress);

        var path2bndl2save = path.normalize(path.join(wsConnect.path2db, mJSO.data.session + '_ses', mJSO.data.annotation.name + '_bndl'));

        // update bundleList 
        updateBndlListEntry(wsConnect.bndlListPath, {
          'name': mJSO.data.annotation.name,
          'session': mJSO.data.session,
          'finishedEditing': mJSO.data.finishedEditing,
          'comment': mJSO.data.comment
        }).then(function () {

          // save annotation
          fs.writeFile(path.normalize(path.join(path2bndl2save, mJSO.data.annotation.name + '_annot.json')), JSON.stringify(mJSO.data.annotation, undefined, 2), function (err) {
            if (err) {
              wsConnect.send(JSON.stringify({
                'callbackID': mJSO.callbackID,
                'status': {
                  'type': 'ERROR',
                  'message': 'Error writing annotation: ' + err
                }
              }), undefined, 0);
            } else {

              // save FORMANTS track (if defined for DB)
              var foundFormantsDef = false;
              for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
                if (wsConnect.dbConfig.ssffTrackDefinitions[i].name === 'FORMANTS') {
                  foundFormantsDef = true;
                }
              }

              if (foundFormantsDef) {
                // write SSFF stored in mJSO.data.ssffFiles[0] back to file (expects FORMANTS files to have .fms as extentions)
                fs.writeFile(path.normalize(path.join(path2bndl2save, mJSO.data.annotation.name + '.fms')), mJSO.data.ssffFiles[0].data, 'base64', function (err) {
                  // git commit
                  if (cfg.use_git_if_repo_found) {
                    commitToGitRepo(wsConnect.path2db, wsConnect.ID, mJSO.data.annotation.name, wsConnect.connectionID, wsConnect._socket.remoteAddress).then(function (resp) {

                      wsConnect.send(JSON.stringify({
                        'callbackID': mJSO.callbackID,
                        'status': {
                          'type': 'SUCCESS'
                        }
                      }), undefined, 0);

                    });
                  } else {
                    wsConnect.send(JSON.stringify({
                      'callbackID': mJSO.callbackID,
                      'status': {
                        'type': 'SUCCESS'
                      }
                    }), undefined, 0);
                  }
                });
              } else {
                // git commit SIC redundant
                if (cfg.use_git_if_repo_found) {
                  commitToGitRepo(wsConnect.path2db, wsConnect.ID, mJSO.data.annotation.name, wsConnect.connectionID, wsConnect._socket.remoteAddress).then(function (resp) {
                    wsConnect.send(JSON.stringify({
                      'callbackID': mJSO.callbackID,
                      'status': {
                        'type': 'SUCCESS'
                      }
                    }), undefined, 0);

                  });
                } else {
                  wsConnect.send(JSON.stringify({
                    'callbackID': mJSO.callbackID,
                    'status': {
                      'type': 'SUCCESS'
                    }
                  }), undefined, 0);
                }
              }
            }
          });

        }, function (err) {
          wsConnect.send(JSON.stringify({
            'callbackID': mJSO.callbackID,
            'status': {
              'type': 'ERROR',
              'message': 'Error reading updating bundleList: ' + err
            }
          }), undefined, 0);
        });

        break;

        // DISCONNECTING method
      case 'DISCONNECTWARNING':

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'status': {
            'type': 'SUCCESS',
            'message': ''
          }
        }), undefined, 0);

        break;

      default:
        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'status': {
            'type': 'ERROR',
            'message': 'Sent request type that is unknown to server! Request type was: ' + mJSO.type
          }
        }), undefined, 0);
      }

    });

  });

}());