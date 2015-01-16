"use strict";

// load deps
var fs = require('fs');
var sqlite3 = require('sqlite3').verbose(); 
var path = require('path');

// vars
var options = ['--addUser', '--createNewDB'];

// check arguments


console.log(process.argv[2]);

var dbPath = process.argv[3];

/**
*
*/
function createNewDB () {

	function createDb(dbPath) {
		console.log("createDb chain");
		db = new sqlite3.Database(dbPath, createTable);
	}


	function createTable() {
		console.log("createTable users");
		db.run("CREATE TABLE IF NOT EXISTS users(name, passwd)", insertRootEntry);
	}

	function insertRootEntry() {
		console.log("insertRows Ipsum i");
		db.run("INSERT INTO users VALUES ('root', 'root pwd')");

		// for (var i = 0; i < 10; i++) {
		// 	stmt.run("Ipsum " + i);
		// }

		stmt.finalize(readAllRows);
	}

	var db;

	fs.exists(dbPath, function (exists) {
		console.log(exists);
		if(!exists){
			createDb(dbPath);
			// var db = new sqlite3.Database(dbPath);

			// db.run("INSERT INTO users VALUES ('dude', 'meister')");

			// db.each("SELECT * FROM users", function(err, row) {
			// 	console.log(row.name + ": " + row.passwd);
			// });

			// db.close();

		}else{
			console.log('ERROR: DB already exists...')
		}

	});

}

createNewDB();