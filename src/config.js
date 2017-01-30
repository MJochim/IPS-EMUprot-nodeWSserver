"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

exports.config = {
	/*
	path2emuDBs: "emuDBs",
	*/

	ldap: {
		enabled: true,
		address: "ldaps://ldap.phonetik.uni-muenchen.de:636",
		bindDNLeft: "uid=",
		bindDNRight: ",ou=People,dc=phonetik,dc=uni-muenchen,dc=de"
	},
	managerAPI: {
		port: 8080
	},
	sql: {
		type: 'sqlite',
		filename: 'emu-server.DB'
		/*
		type: 'postgresql',
		host: 'localhost',
		port: 5432,
		user: 'username',
		password: 'password',
		database: 'database'
		*/
	},
	webSocketProtocol: {
		ssl: false,
		port: 17890,
		ssl_key: "certs/noPwdServer.key",
		ssl_cert: "certs/server.crt",
		filter_bndlList_for_finishedEditing: true,
		use_git_if_repo_found: true,
	}
};
