// Load modules

var Chai = require('chai');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Monitor = require('../lib/monitor');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


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
        server.plugin.register(plugin, function (err) {

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

    describe('#_broadcast', function () {

        it('doesn\'t do anything if there are no subscribers', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                expect(monitor._broadcast()()).to.not.exist;
                done();
            });
        });

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
                monitor._broadcast()();
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

                monitor._broadcast = function () {

                    return function () {

                        done();
                    };
                };

                monitor._handle('log')({ ets: Date.now(), tags: ['test'], data: 'test' });
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
                        }
                    },
                    analytics: {},
                    server: server
                };

                var monitor = new Monitor(pack, { subscribers: {} });
                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.userAgent).to.equal('test');
                done();
            });
        });

        it('logs errors when they occur', function (done) {

            var options = {
                subscribers: {},
                extendedRequests: true
            };

            makePack(function (pack, server) {

                var item = { ts: Date.now(), tags: ['a', 'b'], tag: { a: true, b: true }, data: 'hello!' };

                var request = {
                    raw: {
                        req: {
                            headers: {
                                'user-agent': 'test'
                            }
                        }
                    },
                    analytics: {},
                    server: server,
                    getLog: function () {

                        return [item];
                    }
                };

                var monitor = new Monitor(pack, options);

                var event = monitor._request()(request);

                expect(event.event).to.equal('request');
                expect(event.source.userAgent).to.equal('test');

                var itemLight = Hoek.clone(item);
                delete itemLight.tag;
                expect(event.log).to.deep.equal([itemLight]);
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

                var data = {
                    events: [{
                        event: 'ops',
                        proc: {
                            mem: {
                                rss: 1
                            },
                            cpu: 10
                        }
                    }]
                };

                Hoek.consoleFunc = function (string) {

                    Hoek.consoleFunc = console.log;
                    expect(string).to.contain('memory');
                    done();
                };

                monitor._display(data);
            });
        });

        it('prints to the log event data for request events', function (done) {

            var options = {
                subscribers: {}
            };

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, options);

                var data = {
                    events: [{
                        event: 'request',
                        instance: 'testInstance',
                        method: 'testMethod'
                    }]
                };

                Hoek.consoleFunc = function (string) {

                    Hoek.consoleFunc = console.log;
                    expect(string).to.contain('testMethod');
                    done();
                };

                monitor._display(data);
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