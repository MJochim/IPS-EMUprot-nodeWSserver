/**
 * nodejs script to manage the SQLite DB that contains
 * all registered users (excluding users using verification over LDAP)
 * The SQLite DB contains a single table that is created with the following command:
 *
 * > CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, salt TEXT)
 *
 * All passwords are stored as hashes using the bcrypt package: https://www.npmjs.com/package/bcrypt-nodejs
 *
 * --------------------------------------------------------
 *
 * This script enables the user to do the following things:
 *
 * 1.) Create a new SQLiteDB to use with the node server:
 *
 *         > node manageSQLiteDB.js --createNewDB path/to/IPS-EMUprot-nodeWSserver.DB
 *
 *     Where "path/to/IPS-EMUprot-nodeWSserver.DB" is the path you wish the new DB to be placed in
 *
 * 2.) Add new user to existing SQLiteDB
 *
 *         > node manageSQLiteDB.js --addUser path/to/IPS-EMUprot-nodeWSserver.DB username
 *
 * 3.) Remove a user from existing SQLiteDB
 *
 *         > node manageSQLiteDB.js --removeUser path/to/IPS-EMUprot-nodeWSserver.DB username
 *
 * 4.) List all users in SQLiteDB
 *
 *         > node manageSQLiteDB.js --listUsers path/to/IPS-EMUprot-nodeWSserver.DB
 */

// load deps
var fs = require('fs');
var sqlite3 = require('sqlite3').verbose();
var path = require('path');
var readline = require('readline');
var bcrypt = require('bcrypt');

// get options
var option = process.argv[2];
var dbPath = process.argv[3];
var username;

// global vars 
var db;
var firstEntry;
var secondEntry;
var promptTxt;
var rl;


/**
 *
 */
function hideStdIn(callback) {
    var stdin = process.openStdin();
    process.stdin.on("data", function (char) {
        process.stdout.write("\033[2K\033[200D" + promptTxt + Array(rl.line.length + 1).join("*"));
    });
}

/**
 *
 */
function getUserInput(callback) {
    hideStdIn();
    var res;
    rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt(promptTxt);
    rl.prompt();
    rl.on('line', function (line) {
        res = line;
        rl.close();
    }).on('close', function () {
        callback(res);
    });
}

/**
 *
 */
function readAllRows() {
    console.log('\nCurrent users table (; separated):');
    db.all("SELECT * FROM users", function (err, rows) {
        rows.forEach(function (row) {
            console.log("\t" + row.id + "; " + row.username + "; " + row.password + "; " + row.salt);
        });
    });
}

/**
 *
 */
function insertHashedEntry(usrname, pwd, callback) {
    console.log('INFO: inserting into users Table...');
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(pwd, salt);
    var stmt = db.prepare("INSERT INTO users (username, password, salt) VALUES (?,?,?)");
    stmt.run(usrname, hash, salt);
    stmt.finalize(callback);
}



/**
 *
 */
function checkIfUsrExist(callback) {
    db.all("SELECT * FROM users WHERE username='" + username + "'", function (err, rows) {
        if (rows.length === 1) {
            console.error('User already exists!');
        } else {
            callback();
        }

    });
}


/**
 *
 */
function createNewDB(path) {


    function createTable() {
        console.log("INFO: creating users table...");
        db.run("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, salt TEXT)", function () {
            db.close();
        });
    }

    // create db
    db = new sqlite3.Database(path, createTable);
}

/**
 *
 */
function addNewUser(path) {

    function addUser() {
        checkIfUsrExist(function () {
            promptTxt = 'Enter new password for user ' + username + ' > ';
            getUserInput(function (pwd1) {
                promptTxt = 'Reenter new password for user ' + username + ' > ';
                getUserInput(function (pwd2) {
                    if (pwd1 !== pwd2) {
                        console.log('Passwords where not the same! Please try again...');
                        getNewRootPwd();
                    } else {
                        insertHashedEntry(username, pwd1, readAllRows);
                    }
                });
            });
        });
    }

    db = new sqlite3.Database(path, addUser);
}

/**
 *
 */
function removeUser(path) {

    function rmUsr() {
        var stmt = db.prepare("DELETE FROM users WHERE username='" + username + "'");
        stmt.run();
        stmt.finalize(readAllRows);
    }

    db = new sqlite3.Database(path, rmUsr);
}


/**
 *
 */
function preCheckIfExist(path, proceedIfExist, callback) {
    fs.exists(path, function (exists) {
        if (!exists) {
            if (proceedIfExist) {
                console.error(path, "doesn't exists!!!");
            } else {
                callback(path);
            }
        } else {
            if (proceedIfExist) {
                callback(path);
            } else {
                console.error(path, "already exists!!!");
            }
        }
    });
}



//////////////////////////////
// call functions according to 
// options passed in

if (option == '--createNewDB') {

    preCheckIfExist(dbPath, false, createNewDB);

} else if (option == '--addUser') {

    username = process.argv[4];
    if (username !== undefined) {
        preCheckIfExist(dbPath, true, addNewUser);
    } else {
        console.error('Unspecified username argument');
    }

} else if (option == '--removeUser') {

    username = process.argv[4];
    if (username !== undefined) {
        preCheckIfExist(dbPath, true, removeUser);
    } else {
        console.error('Unspecified username argument');
    }

} else if (option == '--listUsers') {

    db = new sqlite3.Database(dbPath, readAllRows);

}