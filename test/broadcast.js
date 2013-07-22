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
    var lastBroadcastPath = Path.join(__dirname, '..', 'bin', 'lastBroadcast');
    var logPath1 = Path.join(__dirname, 'request_log_test.001');
    var logPath2 = Path.join(__dirname, 'request_log_test.002');
    var logPath3 = Path.join(__dirname, 'request_log_test.003');
    var logPath4 = Path.join(__dirname, 'request_log_test.004');
    var logPath5 = Path.join(__dirname, 'request_log_test.005');
    var logPath6 = Path.join(__dirname, 'request_log_test.006');
    var data1 = '{"event":"request","timestamp":1369328752975,"id":"1369328752975-42369-3828","instance":"http://localhost:8080","labels":["api","http"],' +
        '"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":71,"statusCode":200}';
    var data2 = '{"event":"request","timestamp":1369328753222,"id":"1369328753222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],' +
        '"method":"get","path":"/test","query":{},"source":{"remoteAddress":"127.0.0.1"},"responseTime":9,"statusCode":200}';

    before(function (done) {

        if (Fs.existsSync(lastBroadcastPath)) {
            Fs.unlinkSync(lastBroadcastPath);
        }

        if (Fs.existsSync(logPath1)) {
            Fs.unlinkSync(logPath1);
        }

        if (Fs.existsSync(logPath2)) {
            Fs.unlinkSync(logPath2);
        }

        if (Fs.existsSync(logPath3)) {
            Fs.unlinkSync(logPath3);
        }

        if (Fs.existsSync(logPath4)) {
            Fs.unlinkSync(logPath4);
        }

        if (Fs.existsSync(logPath5)) {
            Fs.unlinkSync(logPath5);
        }

        if (Fs.existsSync(logPath6)) {
            Fs.unlinkSync(logPath6);
        }

        done();
    });

    after(function (done) {

        if (Fs.existsSync(logPath1)) {
            Fs.unlinkSync(logPath1);
        }

        if (Fs.existsSync(logPath2)) {
            Fs.unlinkSync(logPath2);
        }

        if (Fs.existsSync(logPath3)) {
            Fs.unlinkSync(logPath3);
        }

        if (Fs.existsSync(logPath4)) {
            Fs.unlinkSync(logPath4);
        }

        if (Fs.existsSync(logPath5)) {
            Fs.unlinkSync(logPath5);
        }

        if (Fs.existsSync(logPath6)) {
            Fs.unlinkSync(logPath6);
        }

        if (Fs.existsSync(lastBroadcastPath)) {
            Fs.unlinkSync(lastBroadcastPath);
        }

        done();
    });

    it('sends log file to remote server', function (done) {

        var stream = Fs.createWriteStream(logPath1, { flags: 'a' });
        stream.write(data1, function () {
        stream.write('\n' + data2, function () {

            var broadcast = null;
            var server = Http.createServer(function (req, res) {

                var result = '';
                req.on('readable', function () {

                    var read = req.read();
                    if (read) {
                        result += read.toString();
                    }
                });

                req.once('end', function () {

                    var obj = JSON.parse(result);

                    expect(obj.schema).to.equal('good.v1');
                    expect(obj.events[1].id).to.equal('1369328753222-42369-62002');

                    broadcast.kill(0);
                    done();
                    done = function () {};
                });

                res.end();
            }).listen(0);

            server.once('listening', function () {

                var url = 'http://127.0.0.1:' + server.address().port + '/';

                broadcast = ChildProcess.spawn('node', [broadcastPath, '-l', logPath1, '-u', url, '-i', 5, '-p', 0]);
                broadcast.stderr.on('data', function (data) {

                    expect(data.toString()).to.not.exist;
                });

                broadcast.once('close', function (code) {

                    expect(code).to.equal(0);
                });
            });
        });
        });
    });

    it('handles a log file that grows', function (done) {

        var nextData = '\n{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast = null;
        var runCount = 0;

        var stream = Fs.createWriteStream(logPath2, { flags: 'a' });
        stream.write(data1, function () {
        stream.write('\n' + data2, function () {

            var server = Http.createServer(function (req, res) {

                var result = '';
                req.on('readable', function () {

                    var read = req.read();
                    if (read) {
                        result += read.toString();
                    }
                });

                req.once('end', function () {

                    var obj = JSON.parse(result);

                    expect(obj.schema).to.equal('good.v1');

                    if (runCount++ === 0) {
                        expect(obj.events[1].id).to.equal('1369328753222-42369-62002');
                    }
                    else {
                        expect(obj.events[0].id).to.equal('1469328953222-42369-62002');

                        broadcast.kill(0);
                        done();
                    }
                });

                res.end();
            }).listen(0);

            server.once('listening', function () {

                var url = 'http://127.0.0.1:' + server.address().port + '/';

                broadcast = ChildProcess.spawn('node', [broadcastPath, '-l', logPath2, '-u', url, '-i', 5, '-p', 0]);
                broadcast.stderr.on('data', function (data) {

                    expect(data.toString()).to.not.exist;
                });

                broadcast.once('close', function (code) {

                    expect(code).to.equal(0);
                });

                setTimeout(function () {

                    stream.write(nextData, function () {});
                }, 150);
            });
        });
        });
    });

    it('handles a log file that gets truncated', function (done) {

        var nextData = '{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast = null;
        var runCount = 0;

        var stream = Fs.createWriteStream(logPath3, { flags: 'a' });
        stream.write(data1, function () {
        stream.write('\n' + data2, function () {

            var server = Http.createServer(function (req, res) {

                var result = '';
                req.on('readable', function () {

                    var read = req.read();
                    if (read) {
                        result += read.toString();
                    }
                });

                req.once('end', function () {

                    var obj = JSON.parse(result);

                    expect(obj.schema).to.equal('good.v1');

                    if (runCount++ === 0) {
                        expect(obj.events[1].id).to.equal('1369328753222-42369-62002');
                    }
                    else {
                        expect(obj.events[0].id).to.equal('1469328953222-42369-62002');

                        broadcast.kill(0);
                        done();
                    }
                });

                res.end();
            }).listen(0);

            server.once('listening', function () {

                var url = 'http://127.0.0.1:' + server.address().port + '/';

                broadcast = ChildProcess.spawn('node', [broadcastPath, '-l', logPath3, '-u', url, '-i', 5, '-p', 0]);
                broadcast.stderr.on('data', function (data) {

                    expect(data.toString()).to.not.exist;
                });

                broadcast.once('close', function (code) {

                    expect(code).to.equal(0);
                });

                setTimeout(function () {

                    Fs.truncateSync(logPath3, data1.length + data2.length + 1);
                    stream.write(nextData, function () {});
                }, 150);
            });
        });
        });
    });


    it('works when broadcast process is restarted', function (done) {

        var nextData = '\n{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast1 = null;
        var broadcast2 = null;
        var url = null;
        var runCount = 0;

        var stream = Fs.createWriteStream(logPath4, { flags: 'a' });
        stream.write(data1, function () {
        stream.write('\n' + data2, function () {

            var server = Http.createServer(function (req, res) {

                var result = '';
                req.on('readable', function () {

                    var read = req.read();
                    if (read) {
                        result += read.toString();
                    }
                });

                req.once('end', function () {

                    var obj = JSON.parse(result);

                    expect(obj.schema).to.equal('good.v1');

                    if (runCount++ === 0) {
                        expect(obj.events[1].id).to.equal('1369328753222-42369-62002');
                    }
                    else {
                        expect(obj.events.length).to.be.greaterThan(0)

                        broadcast2 && broadcast2.kill(0);
                        done();
                        done = function () {};
                    }
                });

                res.end();
            }).listen(0);

            server.once('listening', function () {

                url = 'http://127.0.0.1:' + server.address().port + '/';

                broadcast1 = ChildProcess.spawn('node', [broadcastPath, '-l', logPath4, '-u', url, '-i', 5]);
                broadcast1.stderr.on('data', function (data) {

                    expect(data.toString()).to.not.exist;
                });

                broadcast1.once('close', function (code) {

                    expect(code).to.equal(0);
                });

                setTimeout(function () {
                    broadcast1.kill(0);
                }, 1);

                setTimeout(function () {

                    broadcast2 = ChildProcess.spawn('node', [broadcastPath, '-l', logPath4, '-u', url, '-i', 5]);
                    broadcast2.stderr.on('data', function (data) {

                        expect(data.toString()).to.not.exist;
                    });

                    broadcast2.once('close', function (code) {

                        expect(code).to.equal(0);
                    });

                    stream.write(nextData, function () {});
                }, 100);
            });
        });
        });
    });

    it('sends log file to remote server using a config file', function (done) {

        var configPath = __dirname + '/broadcast.json';
        var stream = Fs.createWriteStream(logPath5, { flags: 'a' });

        stream.write(data1, function () {
            stream.write('\n' + data2, function () {

                var broadcast = null;
                var server = Http.createServer(function (req, res) {

                    var result = '';
                    req.on('readable', function () {

                        var read = req.read();
                        if (read) {
                            result += read.toString();
                        }
                    });

                    req.once('end', function () {

                        var obj = JSON.parse(result);

                        expect(obj.schema).to.equal('good.v1');
                        expect(obj.events[1].id).to.equal('1369328753222-42369-62002');

                        Fs.unlinkSync(configPath);
                        broadcast.kill(0);
                        done();
                    });

                    res.end();
                }).listen(0);

                server.once('listening', function () {

                    var url = 'http://127.0.0.1:' + server.address().port + '/';
                    var configObj = {
                        url: url,
                        path: logPath5,
                        interval: 5,
                        useLastIndex: false
                    };

                    Fs.writeFileSync(configPath, JSON.stringify(configObj));
                    broadcast = ChildProcess.spawn('node', [broadcastPath, '-c', configPath]);
                    broadcast.stderr.on('data', function (data) {

                        expect(data.toString()).to.not.exist;
                    });

                    broadcast.once('close', function (code) {

                        expect(code).to.equal(0);
                    });
                });
            });
        });
    });

    it('handles a log file that has the wrong format', function (done) {

        var nextData = '{"event":"request","timestamp"' +
            ':1469328953222,"id":"1469328953222-42369-62002","instance":"http://localhost:8080","labels":["api","http"],"method":"get","path":"/test2","query":{},"source":' +
            '{"remoteAddress":"127.0.0.1"},"responseTime":19,"statusCode":200}';
        var broadcast = null;
        var runCount = 0;

        var stream = Fs.createWriteStream(logPath6, { flags: 'a' });
        stream.write(data1, function () {
            stream.write(data2, function () {

                var server = Http.createServer(function (req, res) {

                    var result = '';
                    req.on('readable', function () {

                        var read = req.read();
                        if (read) {
                            result += read.toString();
                        }
                    });

                    req.once('end', function () {

                        var obj = JSON.parse(result);

                        expect(obj.schema).to.equal('good.v1');

                        if (runCount++ === 0) {
                            expect(obj.events[0].id).to.equal('1469328953222-42369-62002');
                        }
                    });

                    res.end();
                }).listen(0);

                server.once('listening', function () {

                    var url = 'http://127.0.0.1:' + server.address().port + '/';

                    broadcast = ChildProcess.spawn('node', [broadcastPath, '-l', logPath6, '-u', url, '-i', 5, '-p', 0]);
                    broadcast.stderr.once('data', function (data) {

                        expect(data.toString()).to.exist;
                        broadcast.kill(0);
                        done();
                    });

                    broadcast.once('close', function (code) {

                        expect(code).to.equal(0);
                    });

                    setTimeout(function () {

                        stream.write(nextData, function () {});
                    }, 150);
                });
            });
        });
    });

});
