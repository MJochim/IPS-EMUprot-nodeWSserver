# Why plugins?

Currently desired but unsupported functions include:

* Christoph: Dynamically assign bundles to user.
* Markus: Create new bundles client-side; upload WAV files.
* Nina/BAS: Grant database access based on auth tokens

New ideas may arise ...

# How?

* Plugin code can be written by anybody, will be reviewed by an Emu dev and
  then added in the main repo (in the plugins/ directory).
* Plugins are only loaded for databases that request them.
* If a database requests a plugin that is not available to the server, the
  database will not be loaded.
* A plugin is one javascript file that constitutes a NodeJS module.
* The protocol has eight message types (GETBUNDLE, SAVEBUNDLE, LOGONUSER etc.).
  A plugin can override any of the type-specific event handlers.

# How things work

## Database configuration

* A database may contain a file `nodejs_server_plugins.json` at the top-level
  dir.
* That file is a simple JSON object like this: { "pluginName": "somePlugin" }

## Plugin loader

* Plugins are loaded on a per-connection basis.
* Plugins are loaded as soon as a connection is established.
