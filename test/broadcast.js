// Load modules

var ChildProcess = require('child_process');
var Fs = require('fs');
var Http = require('http');
var Lab = require('lab');
var Path = require('path');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Broadcast', function () {

    var broadcastPath = Path.join(__dirname, '..', 'bin', 'broadcast');
    var logPath = Path.join(__dirname, 'request_log_test.001');
    var data = '{"event":"request","timestamp":1369328752975,"id":"1369328752975-42369-3828","instance":"http://localhost:8080","labels":["api","http"],' +
        '"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":71,"statusCode":200}\n{"event":"request","timestamp"' +
        ':1369328753222,"id":"1369328753222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test","query":{},"source":' +
        '{"remoteAddress":"127.0.0.1"},"responseTime":9,"statusCode":200}';

    before(function (done) {

        if (Fs.existsSync(logPath)) {
            Fs.unlinkSync(logPath);
        }

        Fs.writeFile(logPath, data, done);
    });

    after(function (done) {

        if (Fs.existsSync(logPath)) {
            Fs.unlink(logPath, done);
        }
    });

    it('sends log file to remote server', function (done) {

        var broadcast = null;
        var server = Http.createServer(function (req, res) {

            var result = '';
            req.on('data', function (data) {

                result += data.toString();
            });

            req.once('end', function () {

                var obj = JSON.parse(result);

                expect(obj.schema).to.equal('good.v1');
                expect(obj.events[1]).to.equal('{"event":"request","timestamp":1369328753222,"id":"1369328753222-42369-62002","instance":"http://localhost:8080",' +
                    '"labels":["api","http"],"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":9,"statusCode":200}');

                broadcast.kill();
                done();
            });

            res.end();
        }).listen(0);

        server.once('listening', function () {

            var url = 'http://127.0.0.1:' + server.address().port + '/';

            broadcast = ChildProcess.spawn('node', [broadcastPath, '-l', logPath, '-u', url, '-i', 5]);
            broadcast.stderr.on('data', function (data) {

                expect(data).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
            });
        });
    });
});
