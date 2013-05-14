var Hapi = require('hapi');


var server = new Hapi.Server();

var options = {
    subscribers: {},
    opsInterval: 100,
    alwaysMeasureOps: true,
    leakDetection: true
};

server.pack.require('..', options, function (err) {

    server.plugins.good.monitor.on('ops', function (event) {

        if (event.psleaks.length) {
            console.log(event.psleaks)
        }
    });

    leaky();
});

function leaky () {                                 // Code from mem watch leak example

    var http = require('http');

    var start = new Date();
    function msFromStart() {

        return new Date() - start;
    }

    var leak = [];

    // every second, this program "leaks" a little bit
    setInterval(function() {
        for (var i = 0; i < 10; i++) {
            var str = i.toString() + " on a stick, short and stout!";
            leak.push(str);
        }
    }, 2);

    // meantime, the program is busy, doing *lots* of http requests
    var http = require('http');
    http.createServer(function (req, res) {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Hello World\n');
    }).listen(1337, '127.0.0.1');

    function doHTTPRequest() {
        var options = {
            host: '127.0.0.1',
            port: 1337,
            path: '/index.html'
        };

        http.get(options, function(res) {
            setTimeout(doHTTPRequest, 300);
        }).on('error', function(e) {
            setTimeout(doHTTPRequest, 300);
        });
    }

    doHTTPRequest();
    doHTTPRequest();
}