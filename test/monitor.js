// Load modules

var Lab = require('lab');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Path = require('path');
var Fs = require('fs');
var Request = require('request');
var Monitor = require('../lib/monitor');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Monitor', function () {

    var makePack = function (callback) {

        var holder = null;

        var plugin = {
            name: '--test',
            version: '0.0.0',
            register: function (pack, options, next) {

                holder = pack;
                next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;
            expect(holder).to.exist;
            callback(holder, server);
        });
    };

    it('throws an error constructed without new', function (done) {

        var fn = function () {

            var monitor = Monitor();
        };

        expect(fn).throws(Error, 'Monitor must be instantiated using new');
        done();
    });

    it('throws an error if opsInterval is too small', function (done) {

        var options = {
            subscribers: {},
            opsInterval: 50
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).throws(Error, 'Invalid monitor.opsInterval configuration');
            done();
        });
    });

    it('doesn\'t throw an error when opsInterval is more than 100', function (done) {

        var options = {
            subscribers: {},
            opsInterval: 100
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).not.to.throw(Error);
            done();
        });
    });

    it('throws an error if requestsEvent is not response or tail', function (done) {

        var options = {
            subscribers: {},
            requestsEvent: 'test'
        };

        makePack(function (pack, server) {

            var fn = function () {

                var monitor = new Monitor(pack, options);
            };

            expect(fn).throws(Error, 'Invalid monitor.requestsEvent configuration');
            done();
        });
    });

    it('uses the passed in broadcastInterval and sets the event queue correctly', function (done) {

        var options = {
            broadcastInterval: 5
        };

        makePack(function (pack, server) {

            var monitor = new Monitor(pack, options);

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.request).to.exist;
            expect(monitor._eventQueues.log).to.exist;
            monitor.stop();
            done();
        });
    });

    describe('#_broadcastConsole', function () {

        it('filters out events that don\'t contain the subscribers tag', function (done) {

            var options = {
                subscribers: {
                    'console': { tags: ['ERROR', 'WARNING'], events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                Hoek.consoleFunc = function (string) {

                    expect(string).to.not.exist;
                };

                server.log('other', 'not used');
                Hoek.consoleFunc = console.log;
                monitor.stop();
                done();
            });
        });

        it('shows events that the subscriber tags match', function (done) {

            var options = {
                subscribers: {
                    'console': { tags: ['ERROR', 'WARNING'], events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                Hoek.consoleFunc = function (string) {

                    Hoek.consoleFunc = console.log;
                    expect(string).to.contain('included in output');
                    monitor.stop();
                    done();
                };

                server.log('ERROR', 'included in output');
            });
        });
    });

    describe('#_broadcastHttp', function () {

        it('doesn\'t do anything if there are no subscribers', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._broadcastHttp()).to.not.exist;
                done();
            });
        });

        it('broadcasts all events when no tags are provided', function (done) {

            var options = {
                subscribers: {
                    'console': { events: ['log'] }
                }
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._subscriberQueues.console).to.exist;
                expect(monitor._eventQueues.log).to.exist;

                Hoek.consoleFunc = function (string) {

                    Hoek.consoleFunc = console.log;
                    expect(string).to.contain('included in output');
                    monitor.stop();
                    done();
                };

                server.log('ERROR', 'included in output');
                monitor._broadcastHttp();
            });
        });

        it('sends all events to a remote server subscriber', function (done) {

            var remoteServer = new Hapi.Server(0);
            remoteServer.route({ method: 'POST', path: '/', handler: function (request) {

                expect(request.payload.appVer).to.exist;
                expect(request.payload.appVer).to.not.equal('unknown');
                done();
            }});

            var options = {
                subscribers: {}
            };

            remoteServer.start(function () {

                options.subscribers[remoteServer.info.uri] = { events: ['log'] };

                makePack(function (pack, server) {

                    var monitor = new Monitor(pack, options);

                    expect(monitor._eventQueues.log).to.exist;

                    server.log('ERROR', 'included in output');
                    monitor._broadcastHttp();
                });
            });
        });

        it('sends response status code to remote subscribers', function (done) {

            var remoteServer = new Hapi.Server(0);
            var server = new Hapi.Server(0);

            remoteServer.route({ method: 'POST', path: '/', handler: function (request) {

                expect(request.payload.events[0].statusCode).to.equal(200);
                request.reply('Success');
                done();
            }});

            server.route({ method: 'GET', path: '/', handler: function (request) {

                request.reply('Success');
            }});

            var options = {
                subscribers: {}
            };

            remoteServer.start(function () {

                options.subscribers[remoteServer.info.uri] = { events: ['request'] };
                var plugin = {
                    name: 'good',
                    register: require('../lib/index').register,
                    version: '0.0.1'
                };

                server.pack.register(plugin, options, function () {

                    server.start(function () {

                        Request(server.info.uri, function () {

                            server.plugins.good.monitor._broadcastHttp();
                        });
                    });
                });
            });
        });
    });

    describe('#_broadcastFile', function () {

        before(function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            if (!Fs.existsSync(folderPath)) {
                Fs.mkdirSync(folderPath);
            }

            done();
        });

        after(function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            Fs.readdirSync(folderPath).forEach(function (filePath) {

                Fs.unlinkSync(Path.join(folderPath, filePath));
            });

            Fs.rmdir(folderPath, done);
        });

        it('filters out events that don\'t contain the subscribers tag', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog0');
            options.subscribers[dest] = { tags: ['ERROR', 'WARNING'], events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);
                server.log('other', 'not used');

                var fn = function () {

                    var file = Fs.readFileSync(dest + '.001');
                };

                expect(fn).to.throw(Error);

                done();
            });
        });

        it('sends all events to a log file', function (done) {

            var folderPath = Path.join(__dirname, 'logs');
            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog1');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    setTimeout(function () {

                        var file = Fs.readFileSync(dest + '.001');
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('included in output');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('splits log files when maxLogSize exceeded', function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {},
                maxLogSize: 200
            };

            var dest = Path.join(folderPath, 'mylog2');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');

                setTimeout(function () {

                    server.log('ERROR', 'another error');
                    server.log('ERROR', 'here is one more error');
                    server.log('ERROR', 'here is one more error');
                    server.log('ERROR', 'here is one more error');

                    setTimeout(function () {

                        var file = Fs.readFileSync(dest + '.002');
                        var formatted = file.toString().split('\n');

                        var result = JSON.parse('[' + formatted + ']');
                        expect(result[0].data).to.equal('here is one more error');

                        done();
                    }, 10);
                }, 10);
            });
        });

        it('doesn\'t overwrite log file with several inital log events', function (done) {

            var folderPath = Path.join(__dirname, 'logs');

            var options = {
                subscribers: {}
            };

            var dest = Path.join(folderPath, 'mylog3');

            options.subscribers[dest] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                server.log('ERROR', 'another error');
                server.log('ERROR', 'here is one more error');

                setTimeout(function () {

                    var file = Fs.readFileSync(dest + '.001');
                    var formatted = file.toString().split('\n');

                    var result = JSON.parse('[' + formatted + ']');
                    expect(result[0].data).to.equal('included in output');
                    expect(result[1].data).to.equal('another error');

                    done();
                }, 10);
            });
        });

        it('logs to directory when provided', function (done) {

            var folderPath = Path.join(__dirname, 'logsdir');

            var options = {
                subscribers: {}
            };

            if (!Fs.existsSync(folderPath)) {
                Fs.mkdirSync(folderPath);
            }

            options.subscribers[folderPath + '/'] = { events: ['log'] };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._eventQueues.log).to.exist;

                server.log('ERROR', 'included in output');
                server.log('ERROR', 'another error');
                server.log('ERROR', 'here is one more error');

                setTimeout(function () {

                    var files = Fs.readdirSync(folderPath);
                    var file = Fs.readFileSync(Path.join(folderPath, files[0]));
                    var formatted = file.toString().split('\n');

                    var result = JSON.parse('[' + formatted + ']');
                    expect(result[0].data).to.equal('included in output');
                    expect(result[1].data).to.equal('another error');

                    Fs.readdirSync(folderPath).forEach(function (filePath) {

                        Fs.unlinkSync(Path.join(folderPath, filePath));
                    });

                    Fs.rmdir(folderPath, done);
                }, 10);
            });
        });
    });

    describe('#_ops', function () {

        it('sets the event with the result data correctly', function (done) {

            var results = {
                osload: 1,
                osmem: 20,
                osdisk: 30,
                osup: 50
            };

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var event = monitor._ops()(results);

                expect(event.os.load).to.equal(1);
                expect(event.os.mem).to.equal(20);
                expect(event.os.disk).to.equal(30);
                done();
            });
        });

        it('emits ops data', function (done) {

            var options = {
                subscribers: {
                    'http://localhost:1023/': ['ops']
                },
                opsInterval: 100
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                monitor.once('ops', function (event) {

                    expect(event.osload).to.exist;
                    monitor.stop();
                    done();
                });
            });
        });

        it('emits an event when everything succeeds', function (done) {

            var options = {
                subscribers: {},
                opsInterval: 100,
                alwaysMeasureOps: true
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                monitor.once('ops', function (event) {

                    expect(event.osdisk.total).to.equal(100);
                    expect(event.osup).to.equal(1000);
                    monitor.stop();
                    done();
                });

                monitor._os = {
                    cpu: function (cb) {

                        cb(null, 1);
                    },
                    disk: function (cb) {

                        cb(null, { total: 100, free: 10 });
                    },
                    loadavg: function (cb) {

                        cb();
                    },
                    mem: function (cb) {

                        cb();
                    },
                    uptime: function (cb) {

                        cb(null, 1000);
                    }
                };

                monitor._process = {
                    uptime: function (cb) {

                        cb(null, 1000);
                    },
                    memory: function (cb) {

                        cb(null, { rss: 100 });
                    },
                    cpu: function (cb) {

                        cb();
                    },
                    delay: function (cb) {

                        cb();
                    }
                };
            });
        });
    });

    describe('#_handle', function () {

        it('dispatches immediately when broadcastInterval is 0', function (done) {

            var options = {
                subscribers: {
                    'http://localhost:1023/': ['log']
                },
                broadcastInterval: 0
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                monitor._broadcastHttp = function () {

                    done();
                };

                monitor._handle('log')({ timestamp: Date.now(), tags: ['test'], data: 'test' });
            });
        });

        it('throws an error when eventName is invalid', function (done) {

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, { subscribers: {} });

                expect(function () {

                    monitor._handle('notFound');
                }).to.throw();
                done();
            });
        });
    });

    describe('#_request', function () {

        it('sets the event with the request data correctly', function (done) {

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {

                        }
                    },
                    info: {},
                    server: server
                };

                var monitor = new Monitor(pack, { subscribers: {} });
                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.userAgent).to.equal('test');
                done();
            });
        });

        it('sets the event with the request remote connection address', function (done) {

            makePack(function (pack, server) {

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            },
                            connection: {
                                remoteAddress: 'hapi.com'
                            }
                        },
                        res: {

                        }
                    },
                    info: {},
                    server: server
                };

                var monitor = new Monitor(pack, { subscribers: {} });
                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.remoteAddress).to.equal('hapi.com');
                done();
            });
        });

        it('logs errors when they occur', function (done) {

            var options = {
                subscribers: {},
                extendedRequests: true
            };

            makePack(function (pack, server) {

                var item = { ts: Date.now(), tags: ['a', 'b'], data: 'hello!' };

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        },
                        res: {

                        }
                    },
                    info: {},
                    server: server,
                    getLog: function () {

                        return [item];
                    }
                };

                var monitor = new Monitor(pack, options);

                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.userAgent).to.equal('test');
                expect(event.log).to.deep.equal([item]);
                done();
            });
        });
    });

    describe('#_display', function () {

        it('prints to the log event data for ops events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var events = [{
                    event: 'ops',
                    proc: {
                        mem: {
                            rss: 1
                        },
                        cpu: 10
                    }
                }];

                Hoek.consoleFunc = function (string) {

                    Hoek.consoleFunc = console.log;
                    expect(string).to.contain('memory');
                    done();
                };

                monitor._display(events);
            });
        });

        it('prints to the log event data for request events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var events = [{
                    event: 'request',
                    instance: 'testInstance',
                    method: 'testMethod'
                }];

                Hoek.consoleFunc = function (string) {

                    Hoek.consoleFunc = console.log;
                    expect(string).to.contain('testMethod');
                    done();
                };

                monitor._display(events);
            });
        });
    });

    describe('#_log', function () {

        it('returns wrapped events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var event = monitor._log()({});

                expect(event.event).to.equal('log');
                done();
            });
        });
    });
});