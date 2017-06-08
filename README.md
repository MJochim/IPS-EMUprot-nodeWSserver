# IPS-EMUprot-nodeWSserver.js


## Quick start
* `npm install`
* `node IPS-EMUprot-nodeWSserver.js server_config.json | node_modules/bunyan/bin/bunyan`


## JSON validation 

This server also implements a simple validation server to validate JSON files used by the new EMU speech database management system

### Validate `_annot.json` files

### curl

Validate \_annot.json file:

`curl -H "Content-Type: applicationjson" --data-binary  @msajc003_annot.json https://webapp2.phonetik.uni-muenchen.de:17890/_annot`



Validate \_DBconfig.json file:

`curl -H "Content-Type: applicationjson" --data-binary  @ae_DBconfig.json https://webapp2.phonetik.uni-muenchen.de:17890/_DBconfig`


### RCurl

```r
library('RCurl')
library('jsonlite')

# validate _annot.json
json_file = '~/Desktop/emuR_demoData/ae_emuDB/0000_ses/msajc003_bndl/msajc003_annot.json'
json_data = fromJSON(paste(readLines(json_file), collapse=""))
headers <- list('Accept' = 'application/json', 'Content-Type' = 'application/json')
postForm("https://webapp2.phonetik.uni-muenchen.de:17890/_annot", .opts=list(postfields=paste(readLines(json_file), collapse=""), httpheader=headers))

# validate _DBconfig.json
json_file = '~/Desktop/emuR_demoData/ae_emuDB/ae_DBconfig.json'
json_data = fromJSON(paste(readLines(json_file), collapse=""))
headers <- list('Accept' = 'application/json', 'Content-Type' = 'application/json')
postForm("https://webapp2.phonetik.uni-muenchen.de:17890/_DBconfig", .opts=list(postfields=paste(readLines(json_file), collapse=""), httpheader=headers))
```


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
