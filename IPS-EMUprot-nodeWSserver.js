/**
 * node server that implements the EMU-webApp-websocket-protocol (version 0.0.1)
 *
 *
 * to run:
 *  > node IPS-EMUprot-nodeWSserver.js /path/2/emuDBs
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
  var filewalker = require('filewalker');
  var bunyan = require('bunyan');
  var ldap = require('ldapjs');
  var exec = require('child_process').exec;

  // for authentication to work
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  // create logger
  var log = bunyan.createLogger({
    name: "nodeEmuWS"
  });
  log.info("starting server...");

  // vars
  var path2emuDBs;

  ////////////////////////////////////////////////
  // parse args

  if (process.argv.length === 3) {
    path2emuDBs = process.argv[2];
  } else {
    console.error('ERROR: path to emuDBs has to be given as an argument!!');
    process.exit(1);
  }

  ////////////////////////////////////////////////
  // set up certs and keys for secure connection

  // you'll probably load configuration from config
  var cfg = {
    ssl: false,
    port: 17890,
    ssl_key: 'certs/server.key',
    ssl_cert: 'certs/server.crt',
    ldap_address: 'ldaps://ldap.phonetik.uni-muenchen.de:636'
  };

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



    //
  function generateUUID() {
    function rand(s) {
      var p = (Math.random().toString(16) + '000000000').substr(2, 8);
      return s ? '-' + p.substr(0, 4) + '-' + p.substr(4, 4) : p;
    }
      return rand() + rand(true) + rand(true) + rand();
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
      for(var i = 0; i < clients.length; i++) {
        if(clients[i].connectionID === wsConnect.connectionID) {
          clients.splice(i);
          break;
        }
      }
    });

    // message event
    wsConnect.on('message', function (message) {
      var res = fs.existsSync(path2emuDBs + wsConnect.upgradeReq.url);

      var mJSO = JSON.parse(message);

      log.info('request/message type:', mJSO.type,
               '; clientID:', wsConnect.connectionID,
               '; clientIP:', wsConnect._socket.remoteAddress);

      if (res && wsConnect.upgradeReq.url !== '/') {
        wsConnect.path2db = path.normalize(path.join(path2emuDBs, wsConnect.upgradeReq.url));
      } else {
        log.info('requested DB does not exist!',
                 '; clientID:', wsConnect.connectionID,
                 '; clientIP:', wsConnect._socket.remoteAddress);

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'status': {
            'type': 'ERROR',
            'message': 'Requested DB does not exist!'
          }
        }), undefined, 0);
        return;
      }

      switch (mJSO.type) {

        // GETPROTOCOL method
      case 'GETPROTOCOL':

        log.info('Following URL path (i.e. DB) was requested: ', wsConnect.upgradeReq.url);

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'data': {
            'protocol': 'EMU-webApp-websocket-protocol',
            'version': '0.0.1'
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
            log.info('user NOT THERE');
            log.info(err);
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
            log.info('Found _bndlList.json for user: ', mJSO.userName, ' in: ', wsConnect.upgradeReq.url);

            // test if user is can bind to LDAP
            var binddn = 'uid=' + mJSO.userName + ',ou=People,dc=phonetik,dc=uni-muenchen,dc=de';

            var ldapClient = ldap.createClient({
              url: cfg.ldap_address,
              log: log
            });

            ldapClient.bind(binddn, mJSO.pwd, function (err) {
              if (err) {
                console.log('###############');
                console.log(err);
                log.info('User', mJSO.userName, 'invalid ldap bind attempt');

                ldapClient.unbind();

                wsConnect.send(JSON.stringify({
                  'callbackID': mJSO.callbackID,
                  'data': 'Can\'t bind to LDAP with given crentials',
                  'status': {
                    'type': 'SUCCESS',
                    'message': ''
                  }
                }), undefined, 0);


              } else {
                ldapClient.unbind();

                log.info('User', mJSO.userName, 'was able to bind to LDAP');

                // add ID to connection object
                wsConnect.ID = mJSO.userName;
                // add bndlList to connection object
                wsConnect.bndlList = JSON.parse(data);

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
          }
        });

        break;

        // GETGLOBALDBCONFIG method
      case 'GETGLOBALDBCONFIG':

        var dbConfigPath = path.normalize(path.join(wsConnect.path2db, wsConnect.upgradeReq.url + '_DBconfig.json'));
        fs.readFile(dbConfigPath, 'utf8', function (err, data) {
          if (err) {
            log.info('Error: ' + err);
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

        log.info('GETBUNDLE session: ' + mJSO.session + '; GETBUNDLE name: ' + mJSO.name);

        var path2ses = path.normalize(path.join(wsConnect.path2db, mJSO.session + '_ses'));

        var bundle = {};
        bundle.ssffFiles = [];

        // get files bundle files
        filewalker(path2ses)
          .on('dir', function () {}).on('file', function (p) {

            var pattMedia = new RegExp(mJSO.name + '_bndl' + '/[^/]+' + wsConnect.dbConfig.mediafileExtension + '$');

            var pattAnnot = new RegExp(mJSO.name + '_bndl' + '/[^/]+' + '_annot.json' + '$');

            // set media file path
            if (pattMedia.test(p)) {
              bundle.mediaFile = {};
              bundle.mediaFile.encoding = 'BASE64';
              bundle.mediaFile._filePath = p;
            }

            // set annotation file path
            if (pattAnnot.test(p)) {
              bundle.annotation = {};
              bundle.annotation._filePath = p;
            }

            // set ssffTrack paths for tracks in ssffTrackDefinitions
            for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
              var pattTrack = new RegExp(mJSO.name + '_bndl' + '/[^/]+' + wsConnect.dbConfig.ssffTrackDefinitions[i].fileExtension + '$');
              if (pattTrack.test(p)) {
                bundle.ssffFiles.push({
                  ssffTrackName: wsConnect.dbConfig.ssffTrackDefinitions[i].name,
                  encoding: 'BASE64',
                  _filePath: p
                });
              }
            }
          }).on('error', function (err) {
            wsConnect.send(JSON.stringify({
              'callbackID': mJSO.callbackID,
              'status': {
                'type': 'ERROR',
                'message': 'Error getting bundle! Request type was: ' + mJSO.type + ' Error is: ' + err
              }
            }), undefined, 0);
          }).on('done', function () {
            // read mediaFile
            bundle.mediaFile.data = fs.readFileSync(path.join(path2ses, bundle.mediaFile._filePath), 'base64');
            delete bundle.mediaFile._filePath;

            // read annotation file
            bundle.annotation = JSON.parse(fs.readFileSync(path.join(path2ses, bundle.annotation._filePath), 'utf8'));
            delete bundle.annotation._filePath;

            for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
              bundle.ssffFiles[i].data = fs.readFileSync(path.join(path2ses, bundle.ssffFiles[i]._filePath), 'base64');
              delete bundle.ssffFiles[i].filePath;
            }
            log.info('Finished reading bundle components. Now returning them.');
            wsConnect.send(JSON.stringify({
              'callbackID': mJSO.callbackID,
              'data': bundle,
              'status': {
                'type': 'SUCCESS',
                'message': ''
              }
            }), undefined, 0);

          }).walk();

        break;

        // SAVEBUNDLE method
      case 'SAVEBUNDLE':

        log.info('Saving: ' + mJSO.data.annotation.name);

        var path2bndl = path.normalize(path.join(wsConnect.path2db, mJSO.data.session + '_ses', mJSO.data.annotation.name + '_bndl'));

        // save annotation
        fs.writeFileSync(path.normalize(path.join(path2bndl, mJSO.data.annotation.name + '_annot.json')), JSON.stringify(mJSO.data.annotation, undefined, 2));

        // save FORMANTS track (if defined for DB)
        var foundFormantsDef = false;
        for (var i = 0; i < wsConnect.dbConfig.ssffTrackDefinitions.length; i++) {
          console.log(wsConnect.dbConfig.ssffTrackDefinitions[i].name);
          if (wsConnect.dbConfig.ssffTrackDefinitions[i].name === 'FORMANTS') {
            foundFormantsDef = true;
          }
        }

        if (foundFormantsDef) {
          // write SSFF stored in mJSO.data.ssffFiles[0] back to file (expects FORMANTS files to have .fms as extentions)
          fs.writeFileSync(path.normalize(path.join(path2bndl, mJSO.data.annotation.name + '.fms')), mJSO.data.ssffFiles[0].data, 'base64');
        }

        // git commit
        var commitMessage = 'EMU-webApp auto save commit; User: ' + wsConnect.ID + '; DB: ' + wsConnect.path2db + '; Bundle: ' + mJSO.data.annotation.name;
        var gitCommand = 'git --git-dir=' + path.join(wsConnect.path2db, '.git') + ' --work-tree=' + wsConnect.path2db + ' commit -am "' + commitMessage + '"';
        log.info('Commit to dbs git repo with command: ' + gitCommand);

        exec(gitCommand, function (error, stdout, stderr) {
          if (error !== null) {
            log.info('Error commiting to git repo');
          }
        });

        wsConnect.send(JSON.stringify({
          'callbackID': mJSO.callbackID,
          'status': {
            'type': 'SUCCESS'
          }
        }), undefined, 0);

        break;

        // DISCONNECTING method
      case 'DISCONNECTWARNING':

        ws.send(JSON.stringify({
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