/**
  * nodejs script to manage the SQLite DB that contains 
  * all registered users (excluding users using verification over LDAP)
  * The SQLite DB contains a single table that is created with the following command:
  *
  *	> CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, salt TEXT)
  *
  * This script enables the user to do the following things:
  * 
  * 1.)	Create a new SQLiteDB to use with the node server:
  *
  *			> node manageSQLiteDB.js --createNewDB path/to/IPS-EMUprot-nodeWSserver.DB
  *
  *		Where "path/to/IPS-EMUprot-nodeWSserver.DB" is the path you wish the new DB to be placed in 
  *
  * 2.)	Add new user to existing SQLiteDB
  *
  *			> node manageSQLiteDB.js --addUser path/to/IPS-EMUprot-nodeWSserver.DB
  *	
  * 3.) Remove a user from existing SQLiteDB
  *
  *			> node manageSQLiteDB.js --removeUser path/to/IPS-EMUprot-nodeWSserver.DB username
  *
  */

// load deps
var fs = require('fs');
var sqlite3 = require('sqlite3').verbose(); 
var path = require('path');
var readline = require('readline');
var bcrypt = require('bcrypt');

// check arguments
var option = process.argv[2];
var dbPath = process.argv[3];

/**
 *
 */
 function createNewDB (path) {

	function createDb(dbPath) {
		console.log("createDb chain");
		db = new sqlite3.Database(dbPath, createTable);
	}


	function createTable() {
		console.log("createTable users");
		db.run("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, salt TEXT)", insertRootEntry);
	}

	function insertRootEntry() {

		var firstEntry;
		var secondEntry;
		var promptTxt = 'enter root password> ';

		// set std in to not echo pwd
		var stdin = process.openStdin();
		process.stdin.on("data", function(char) {
			char = char + "";
			switch (char) {
			// case "\n":
			// case "\r":
			// case "\u0004":
			//     stdin.pause();
			//     break;
			default:
			process.stdout.write("\033[2K\033[200D" + promptTxt + Array(rl.line.length+1).join("*"));
			break;
		}
	});


		// get pwd from cmdline
		var rl = readline.createInterface(process.stdin, process.stdout);
		rl.setPrompt(promptTxt);
		rl.prompt();
		rl.on('line', function(line) {
			if(firstEntry === undefined){
				firstEntry = line;
				promptTxt = 'reenter root password> ';
				rl.setPrompt(promptTxt);
				rl.prompt();
			}else if(secondEntry === undefined){
				secondEntry = line;
				if(firstEntry === secondEntry){
					console.log('same pwd!!!!! U ROCK!!!');
					rl.close();
				}else{
					console.log('passwords are not the same... please reenter!!!');
					promptTxt = 'enter root password> ';
					rl.setPrompt(promptTxt);
					firstEntry = undefined;
					secondEntry = undefined;
				}
			}

			rl.prompt();
		}).on('close',function(){
			var salt = bcrypt.genSaltSync(10);
			var hash = bcrypt.hashSync(firstEntry, salt);
			console.log(salt);
			console.log('inserting into users Table');
			var stmt = db.prepare("INSERT INTO users (username, password, salt) VALUES (?,?,?)");

			stmt.run("root", hash, salt);

			stmt.finalize(readAllRows);
		});

	}

	function readAllRows() {
		console.log("readAllRows lorem");
		db.all("SELECT * FROM users", function(err, rows) {
			console.log(rows);
			rows.forEach(function (row) {
				console.log(row.id + "; " + row.username + "; " + row.password + "; " + row.salt);
			});
			db.close();
			process.exit()
		});
	}

	// main 
	var db;

	// fs.exists(dbPath, function (exists) {
	// 	console.log(exists);
	// 	if(!exists){
	// 		createDb(dbPath);

	// 	}else{
	// 		console.log('ERROR: DB already exists...')
	// 	}

	// });

	console.log('you called?', path)
	createDb(path);
}

/**
 *
 */
function preCheckIfExist(path, proceedIfExist, callback) {
	console.log('here')
	fs.exists(path, function (exists) {
		console.log(exists);
		if(!exists){
			if(proceedIfExist){
				console.error(path, " doesn't exists!!!");
			}else{
				callback(path);
			}
		}else{
			if(proceedIfExist){
				callback(path);
			}else{
				console.error(path, " already exists!!!");
			}
		}
	});

}



//////////////////////////////
// call functions according to 
// functions
if(option == '--createNewDB'){
	preCheckIfExist(dbPath, false, createNewDB);
}else if(option == '--createNewDB'){
	addNewUser();
}