// this benchmark creates 2 leveldbs
// the first one it fills with argv[2] num rows of data
// the second one get initialized from the first
// argv[3] truthy (default is falsy) will use fast init (leveldb .tar.gz snapshot copy)
// default is to use pure http + json replication
//
// results on a mb air 1.7ghz i5 4gb ram SSD:
// $ node test/bulk-replication.js 50000
// writestream 50000: 2660ms
// replicate 50000: 28409ms
//
// $ node test/bulk-replication.js 50000 true
// writestream 50000: 2769ms
// generate tar: 1248ms
// replicate 50000: 1997ms

var Dat = require('../')

var path = require('path')
var fs = require('fs')
var os = require('os')
var rmrf = require('rimraf')

function noop() {}

var sourcePath = path.join(os.tmpdir(), 'datsource')
var destPath = path.join(os.tmpdir(), 'datdest')

cleanup(function() {
  fs.mkdirSync(sourcePath)
  fs.mkdirSync(destPath)
  testReplication(process.argv[2])
})

function testReplication(size) {
  size = size || 1000
  var dat = new Dat(sourcePath)
  dat.init(function(err, msg) {
    var ws = dat.createWriteStream({ csv: true })
    console.time('writestream ' + size)
    ws.on('close', function() {
      console.timeEnd('writestream ' + size)
      dat.serve(function(err, msg) {
        if (err) throw err
        var dat2 = new Dat(destPath)
        var opts = {}
        if (process.argv[3]) opts.remote = 'http://localhost:6461/_archive'
        console.time('replicate ' + size)
        
        dat2.init(opts, function(err, msg) {
          if (err) throw err          
          if (opts.remote) return done()
          
          dat2.pull(function(err) {
            if (err) throw err
            done()
          })
          
          function done() {
            console.timeEnd('replicate ' + size)
            dat.close() // stops http server
            cleanup()
          }
        })
      })
    })
    
    for (var i = 0; i < size; i++) {
      ws.write(new Buffer('a,b,c\n' + i + ',2,3'))
    }

    ws.end()
  })
}

function cleanup(cb) {
  rmrf(sourcePath, function(err) {
    if (err) console.log('cleanup err', err)
    rmrf(destPath, function(err) {
      if (err) console.log('cleanup err', err)
      if (cb) cb()
    })
  })
}
