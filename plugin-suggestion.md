# Why plugins?

Currently desired but unsupported functions include:

* Christoph: Dynamically assign bundles to user.
* Markus: Create new bundles client-side; upload WAV files.
* Nina/BAS: Grant database access based on auth tokens (should this be a
  plugin?)

New ideas may arise ...

# How?

* A plugin overrides the behavior for GETBUNDLE, SAVEBUNDLE, and/or
  GETBUNDLELIST.
* Plugin code is reviewed and added in the main repo (as a sub-directory
  whose name is the plugin name).
* Plugins are only loaded for databases that request them.
* If a database requests a plugin that is not available to the server, the
  database will not be loaded.

# How things work

## Database configuration

* A database may contain a file `nodejs_server_plugins.json` at the top-level
  dir.
* That file is a simple JSON array of strings, naming plugins to be loaded.

## Plugin loader

* Plugins are loaded on a per-connection basis.
* Plugins are only loaded after a user has logged on.
* After the LOGONUSER operation, plugins are loaded and starting from that
  point, the plugin-defined functions will be used instead of the default
  ones.
