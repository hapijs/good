// This example starts a server at http://localhost:8080 and logs the request headers to the console using the Log.event function

// Load modules

var Log = require('../');
var Http = require('http');



// Declare internals

var internals = {};


internals.handler = function (req, res) {

    Log.event('request', req.headers);

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Request logged');
};


internals.startServer = function () {

    var server = Http.createServer(internals.handler);
    server.listen(8080);
    Log.event('server', 'started at http://localhost:8080/');
};


internals.startServer();