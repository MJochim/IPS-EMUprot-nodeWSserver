# Why plugins?

Currently desired but unsupported functions include:

* Christoph: Dynamically assign bundles to user.
* Markus: Create new bundles client-side; upload WAV files.

New ideas may arise ...

# How?

* A plugin overrides one or more functions (see below, "What can be
  overridden?").
* Plugin code is reviewed and added in the main repo (as a sub-directory
  whose name is the plugin name).
* Plugins are only loaded for databases that request them.

# Database configuration

* A database may contain a file `node_server_plugins.json` at the top-level dir.
* That file lists plugins to be loaded.

Issues:
* What if a requested plugin is not installed?
    * Fail?
    * Ignore (silently)?
    * Specify requiredPlugins vs. optionalPlugins?
* List plugins by name only or by name and version?
* Per-connection or per-message:
    * Currently, the URL determines what database to load.
    * The URL can change per message (and thus may vary within a connection).
    * Minimally invasive would be to load plug-ins per-message as well.
    * But that would make it difficult for the server to advertise which
      plugins are actually loaded, e.g. via GETPROTOCOL (because technically,
      the reply would only be valid for the GETPROTOCOL call itself).

# What can be overridden?

* We have 8 different message types
    * Should not be overridden
        * GETPROTOCOL
        * DISCONNECTWARNING
    * Can be overwritten
        * GETDOUSERMANAGEMENT
        * LOGONUSER
        * GETGLOBALDBCONFIG
        * GETBUNDLELIST
        * GETBUNDLE
        * SAVEBUNDLE
    * Allow plugin to define new message types?
* We have 7 different helper functions
    * Should not be overridden
        * function onlyUnique(value, index, self)
        * function generateUUID()
    * Any use overriding them?
        * function findAllTracksInDBconfigNeededByEMUwebApp(DBconfig)
        * function checkCredentialsInSQLiteDB(username, pwd, callback)
        * function updateBndlListEntry(bndlListPath, entry)
        * function filterBndlList(bndlList)
        * function commitToGitRepo(path2db, ID, bundleName, connectionID, remoteAddress)
