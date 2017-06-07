# IPS-EMUprot-nodeWSserver.js


## Quick start
* `npm install`
* `node IPS-EMUprot-nodeWSserver.js server_config.json | node_modules/bunyan/bin/bunyan`


## JSON validation 

This server also implements a simple validation server to validate JSON files used by the new EMU speech database management system

### Validate `_annot.json` files

### curl

`curl -H "Content-Type: applicationjson" --data-binary  @msajc003_annot.json http://localhost:9263/_annot`

### RCurl

`library('RCurl')`

`json_file = '/path/2/instanceOfAnnotationFile.json'`
`json_data = fromJSON(paste(readLines(json_file), collapse=""))`
`headers <- list('Accept' = 'application/json', 'Content-Type' = 'application/json')`
`postForm("http://localhost:9263/_annot", .opts=list(postfields=paste(readLines(json_file), collapse=""), httpheader=headers))`


## Main authors

**Raphael Winkelmann**

+ [github](http://github.com/raphywink)

**Markus Jochim**

+ [github](http://github.com/mjochim)

**Affiliations**

[INSTITUTE OF PHONETICS AND SPEECH PROCESSING](http://www.en.phonetik.uni-muenchen.de/)


## For Maintainers

Be sure to check and update the /vnbdata/emuDBs/README file if any breaking changes / new features are implemented!
This will probably not be necessary any more once people start using the manager.
