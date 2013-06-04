// Load modules

var Lab = require('lab');
var Hoek = require('hoek');
var Http = require('http');
var Replay = require('../lib/replay');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Replay', function () {

    it('makes a request to the provided good log requests', function (done) {

        var data = [{"event":"request","timestamp":1369328752975,"id":"1369328752975-42369-3828","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":71,"statusCode":200},
            {"event":"request","timestamp":1369328753222,"id":"1369328753222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":9,"statusCode":200}];

        var server = Http.createServer(function (req, res) {

            expect(req.url).to.equal('/test');
            res.end('Content-Type: text/plain');
            server.close();

            done();
        });


        server.once('listening', function () {

            var count = 3;                                                  // consume the 3 entries logged by replay
            Hoek.consoleFunc = function (string) {

                if (count-- === 0) {
                    Hoek.consoleFunc = console.log;
                }
            };

            var replay = new Replay('127.0.0.1:' + server.address().port, 10, data);
            replay.makeRequests();
        });

        server.listen(0);
    });

    it('handles request errors', function (done) {

        var data = [{"event":"request","timestamp":1369328752975,"id":"1369328752975-42369-3828","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":71,"statusCode":200}];

        var server = Http.createServer(function (req, res) {

            var exit = process.exit;

            process.exit = function () {

                process.exit = exit;
                done();
            };

            req.socket.destroy();
        });


        server.once('listening', function () {

            var count = 3;
            Hoek.consoleFunc = function (string) {

                if (count-- === 0) {
                    Hoek.consoleFunc = console.log;
                }
            };

            var replay = new Replay('127.0.0.1:' + server.address().port, 10, data);
            replay.makeRequests();
        });

        server.listen(0);
    });

    it('handles response errors', function (done) {

        var data = [{"event":"request","timestamp":1369328752975,"id":"1369328752975-42369-3828","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":71,"statusCode":200}];

        var server = Http.createServer(function (req, res) {

            res.destroy();

            setTimeout(function () {

                done();
            }, 10);
        });


        server.once('listening', function () {

            var count = 3;
            Hoek.consoleFunc = function (string) {

                if (count-- === 0) {
                    Hoek.consoleFunc = console.log;
                    console.log('\n');                                                  // add a newline after last item for pretty test output
                }
            };

            var replay = new Replay('127.0.0.1:' + server.address().port, 10, data);
            replay.makeRequests();
        });

        server.listen(0);
    });
});


