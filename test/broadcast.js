// Load modules

var ChildProcess = require('child_process');
var Fs = require('fs');
var Lab = require('lab');
var Path = require('path');

var Hapi = require('hapi');


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
    var lastBroadcastPath = Path.join(__dirname, '..', 'lib', 'lastBroadcast_request_log_test.004');
    var logPath1 = Path.join(__dirname, 'request_log_test.001');
    var logPath2 = Path.join(__dirname, 'request_log_test.002');
    var logPath3 = Path.join(__dirname, 'request_log_test.003');
    var logPath4 = Path.join(__dirname, 'request_log_test.004');
    var logPath5 = Path.join(__dirname, 'request_log_test.005');
    var logPath6 = Path.join(__dirname, 'request_log_test.006');
    var logPath7 = Path.join(__dirname, 'request_log_test.007');
    var opsLogPath1 = Path.join(__dirname, 'ops_log_test.001');
    var broadcastJsonPath = Path.join(__dirname, 'broadcast.json');

    var data1 = '{"event":"request","timestamp":1369328752975,"id":"1369328752975-42369-3828","instance":"http://localhost:8080","labels":["api","http"],' +
        '"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":71,"statusCode":200}';
    var data2 = '{"event":"request","timestamp":1369328753222,"id":"1369328753222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],' +
        '"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":9,"statusCode":200}';
    var opsData1 = '{"event":"ops","timestamp":1375466329196,"os":{"load":[0.38671875,0.390625,0.51171875],"mem":{"total":3221225472,"free":2790420480},"uptime":5690647,"cpu":"70.81"},"proc":{"uptime":414,"mem":{"rss":204468224,"heapTotal":64403456,"heapUsed":29650600,"total":3221225472},"delay":0},"load":{"requests":{"8080":1007,"8443":178},"concurrents":{"8080":8,"8443":-7}}}';

    var locations = [logPath1, logPath2, logPath3, logPath4, logPath5, logPath6, logPath7, opsLogPath1, broadcastJsonPath, lastBroadcastPath];
    var cleanup = function (done) {
        for (var i = 0, il = locations.length; i < il; ++i) {
            if (Fs.existsSync(locations[i])) {
                Fs.unlinkSync(locations[i]);
            }
        }

        return done();
    };

    before(cleanup);
    it('sends log file to remote server', function (done) {


        var broadcast = null;
        var server = Hapi.createServer('127.0.0.1', 0);

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                expect(request.payload.events[1].id).to.equal('1369328753222-42369-62002');
                broadcast.kill('SIGUSR2');
            }
        });

        server.start( function () {

            var url = server.info.uri;
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', './test/fixtures/test_01.log', '-u', url, '-i', 5, '-p', 0]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });
        });
    });

    it('handles a log file that grows', function (done) {

        var nextData = '\n{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast = null;
        var server = Hapi.createServer('127.0.0.1', 0);
        var runCount = 0;

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                if (runCount++ === 0) {

                    expect(request.payload.events[0].id).to.equal('1369328753222-42369-62002');
                }
                else {

                    expect(request.payload.events[0].id).to.equal('1469328953222-42369-62002');
                    broadcast.kill('SIGUSR2');
                }
            }
        });

        server.start( function () {

            var url = server.info.uri;
            var stream = Fs.createWriteStream(logPath2, { flags: 'a' });
            stream.write(data2);
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath2, '-u', url, '-i', 5, '-p', 0]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });

            setTimeout(function () {

                stream.write(nextData);
                stream.end();
            }, 300);
        });
    });

    it('handles a log file that gets truncated', function (done) {

        var nextData = '{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["http"],"method":"get","path":"/","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast = null;
        var server = Hapi.createServer('127.0.0.1', 0);
        var runCount = 0;

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                if (runCount++ === 0) {

                    expect(request.payload.events[0].id).to.equal('1369328753222-42369-62002');
                }
                else {

                    expect(request.payload.events[0].id).to.equal('1469328953222-42369-62002');
                    broadcast.kill('SIGUSR2');
                }
            }
        });

        server.start( function () {

            var url = server.info.uri;
            var stream = Fs.createWriteStream(logPath3, { flags: 'a' });
            stream.write(data2);
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath3, '-u', url, '-i', 5, '-p', 0]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });

            setTimeout(function () {

                Fs.stat(logPath3, function (err, stat) {

                    Fs.truncate(logPath3, stat.size, function (err) {

                        expect(err).to.not.exist;
                        Fs.writeFileSync(logPath3, nextData);
                    });
                });
            }, 300);
        });
    });

    it('works when broadcast process is restarted', function (done) {

        var nextData = '\n{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast1 = null;
        var broadcast2 = null;
        var server = Hapi.createServer('127.0.0.1', 0);
        var runCount = 0;

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                if (runCount++ === 0) {

                    expect(request.payload.events[0].id).to.equal('1369328753222-42369-62002');
                    broadcast1 && broadcast1.kill('SIGUSR2');
                }
                else {

                    expect(request.payload.events.length).to.be.greaterThan(0);
                    broadcast2 && broadcast2.kill('SIGUSR2');
                }
            }
        });

        server.start( function () {

            var url = server.info.uri;
            var stream = Fs.createWriteStream(logPath4, { flags: 'a' });
            stream.write(data2);
            broadcast1 = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath4, '-u', url, '-i', 5]);
            broadcast1.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast1.once('close', function (code) {

                expect(code).to.equal(0);
                broadcast2 = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath4, '-u', url, '-i', 5]);
                broadcast2.stderr.on('data', function (data) {

                    expect(data.toString()).to.not.exist;

                });

                broadcast2.once('close', function (code) {

                    expect(code).to.equal(0);
                    done();
                });

                stream.write(nextData);
            });
        });
    });

    it('sends log file to remote server using a config file', function (done) {

        var broadcast = null;
        var server = Hapi.createServer('127.0.0.1', 0);

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                expect(request.payload.events[1].id).to.equal('1369328753222-42369-62002');
                Fs.unlinkSync(broadcastJsonPath);
                broadcast.kill('SIGUSR2');
            }
        });

        server.start( function () {

            var url = server.info.uri;
            var configObj = {
                url: url,
                path: './test/fixtures/test_01.log',
                interval: 5,
                useLastIndex: false
            };

            Fs.writeFileSync(broadcastJsonPath, JSON.stringify(configObj));
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-c', broadcastJsonPath]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });
        });
    });

    it('handles a log file that has the wrong format', function (done) {

        var broadcast = null;
        var runCount = 0;
        var nextData = '{"event":"request","timestamp"' + ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' + '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var server = Hapi.createServer('127.0.0.1', 0);

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                if (runCount++ === 0) {

                    expect(request.payload.events[0].id).to.equal('1469328953222-42369-62002');
                }
                broadcast.kill('SIGUSR2');
            }
        });

        server.start( function () {

            var url = server.info.uri;

            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath6, '-u', url, '-i', 5, '-p', 0]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.exist;
                broadcast.kill('SIGUSR2');
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });
        });

        var stream = Fs.createWriteStream(logPath6, { flags: 'a' });
        stream.write(data1);
        stream.write(data2);

        setTimeout(function () {

            stream.write(nextData);
        }, 300);
    });

    it('handles connection errors to remote server', function (done) {

        var broadcast = null;
        var stream = Fs.createWriteStream(logPath7, { flags: 'a' });
        stream.write(data2);
        var runCount = 0;
        var nextData = '{"event":"request","timestamp"' + ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' + '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var server = Hapi.createServer('127.0.0.1', 0);

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                if (runCount++ === 0) {

                    expect(request.payload.events[0].id).to.equal('1369328753222-42369-62002');
                    server.stop();
                }
            }
        });

        server.start( function () {

            var url = server.info.uri;
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath7, '-u', url, '-i', 5, '-p', 0]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.contain('ECONNREFUSED');
                broadcast.kill('SIGUSR2');
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });

            setTimeout(function () {

                stream.write(nextData);
            }, 300);
        });
    });

    it('sends ops log file to remote server', function (done) {

        var broadcast = null;
        var server = Hapi.createServer('127.0.0.1', 0);

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                expect(request.payload.events[0].timestamp).to.equal(1375466329196);
                broadcast.kill('SIGUSR2');
            }
        });

        server.start( function () {

            var url = server.info.uri;
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', './test/fixtures/test_ops.log', '-u', url, '-i', 5, '-p', 0]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });
        });
    });

    it('handles a log file that exists when onlySendNew is enabled', function (done) {

        var nextData = '\n{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast = null;

        var stream = Fs.createWriteStream(logPath2, { flags: 'a' });
        stream.write(data1);
        stream.write(data2);
        var server = Hapi.createServer('127.0.0.1', 0);

        server.route({
            path: '/',
            method: 'POST',
            handler: function (request, reply) {

                expect(request.payload.schema).to.equal('good.v1');
                expect(request.payload.events[0].id).to.equal('1469328953222-42369-62002');
                broadcast.kill('SIGUSR2');
            }
        });

        server.start( function () {

            var url = server.info.uri;
            broadcast = ChildProcess.spawn(process.execPath, [broadcastPath, '-l', logPath2, '-u', url, '-i', 5, '-p', 0, '-n', 1]);
            broadcast.stderr.on('data', function (data) {

                expect(data.toString()).to.not.exist;
            });

            broadcast.once('close', function (code) {

                expect(code).to.equal(0);
                done();
            });

            setTimeout(function () {

                stream.write(nextData);
            }, 300);
        });
    });
    after(cleanup);
});
