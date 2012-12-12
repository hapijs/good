// Load modules

var Chai = require('chai');
var Helpers = require('../helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Monitor', function () {

    it('throws an error constructed without new', function (done) {

        var fn = function () {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 50,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };

            var monitor = Helpers.Monitor(config);
        };

        expect(fn).throws(Error, 'Monitor must be instantiated using new');
        done();
    });

    it('throws an error if opsInterval is too small', function (done) {

        var fn = function () {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 50,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };

            var monitor = new Helpers.Monitor(config);
        };

        expect(fn).throws(Error, 'Invalid monitor.opsInterval configuration');
        done();
    });

    it('doesn\'t throw an error when opsInterval is more than 100', function (done) {

        var fn = function () {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };
            var monitor = new Helpers.Monitor(config);
        };

        expect(fn).not.to.throw(Error);
        done();
    });

    it('throws an error if subscribers is null', function (done) {

        var fn = function () {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: null,
                        requestsEvent: 'response'
                    }
                }
            };
            var monitor = new Helpers.Monitor(config);
        };

        expect(fn).throws(Error, 'Invalid monitor.subscribers configuration');
        done();
    });

    it('throws an error if requestsEvent is not response or tail', function (done) {

        var fn = function () {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: {},
                        requestsEvent: 'test'
                    }
                }
            };
            var monitor = new Helpers.Monitor(config);
        };

        expect(fn).throws(Error, 'Invalid monitor.requestsEvent configuration');
        done();
    });

    describe('#_broadcast', function () {

        it('doesn\'t do anything if there are no subscribers', function (done) {

            var config = {
                settings: {
                    monitor: {
                        opsInterval: 200,
                        subscribers: {},
                        requestsEvent: 'response'
                    }
                }
            };

            var monitor = new Helpers.Monitor(config);
            var broadcast = monitor._broadcast();

            expect(broadcast()).to.not.exist;
            done();
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

            var subscribers = {
                console: ['ops']
            };

            var settings = {
                monitor: {
                    opsInterval: 10000,
                    subscribers: subscribers,
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var server = new Helpers.Server(settings);
            var monitor = new Helpers.Monitor(server);

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.ops).to.exist;

            var ops = monitor._ops();
            var event = ops(results);

            expect(event.os.load).to.equal(1);
            expect(event.os.mem).to.equal(20);
            expect(event.os.disk).to.equal(30);
            done();
        });
    });

    describe('#_initOps', function () {

        it('logs errors when they occur', function (done) {

            var subscribers = {
                console: ['ops']
            };

            var settings = {
                monitor: {
                    opsInterval: 100,
                    subscribers: subscribers,
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var server = new Helpers.Server(settings);
            var monitor = new Helpers.Monitor(server);

            monitor._initOps();

            monitor._os = {
                cpu: function (cb) {

                    cb(new Error(), 1);
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

                    cb();
                },
                cpu: function (cb) {

                    cb();
                }
            };

            done();
        });
    });

    describe('#_request', function () {

        it('sets the event with the request data correctly', function (done) {

            var subscribers = {
                console: ['ops']
            };

            var server = {
                settings: {
                    monitor: {
                        opsInterval: 100000,
                        subscribers: subscribers,
                        requestsEvent: 'response',
                        broadcastInterval: 5
                    }
                },
                on: function () { },
                emit: function () { }
            };
            var request = {
                raw: {
                    req: {
                        headers: {
                            'user-agent': 'test'
                        }
                    }
                },
                _analytics: {},
                server: server
            };
            var monitor = new Helpers.Monitor(server);

            expect(monitor._subscriberQueues.console).to.exist;
            expect(monitor._eventQueues.ops).to.exist;

            var requestFn = monitor._request();
            var event = requestFn(request);

            expect(event.event).to.equal('request');
            expect(event.source.userAgent).to.equal('test');
            done();
        });

        it('logs errors when they occur', function (done) {

            var subscribers = {
                console: ['ops']
            };

            var server = {
                settings: {
                    monitor: {
                        opsInterval: 100000,
                        subscribers: subscribers,
                        requestsEvent: 'response',
                        broadcastInterval: 5,
                        extendedRequests: true
                    }
                },
                on: function () { },
                emit: function () { }
            };
            var request = {
                raw: {
                    req: {
                        headers: {
                            'user-agent': 'test'
                        }
                    }
                },
                _analytics: {},
                server: server,
                _log: 'test'
            };
            var monitor = new Helpers.Monitor(server);

            var event = monitor._request()(request);

            expect(event.event).to.equal('request');
            expect(event.source.userAgent).to.equal('test');
            expect(event.log).to.equal('test');
            done();
        });
    });

    describe('#_display', function () {

        it('prints to the log event data for ops events', function (done) {

            var settings = {
                monitor: {
                    opsInterval: 10000,
                    subscribers: {
                        console: ['ops']
                    },
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var server = new Helpers.Server(settings);
            var monitor = new Helpers.Monitor(server);

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

            Helpers._TEST.once('log', function (message) {

                expect(message).to.contain('memory');
                done();
            });

            monitor._display(data);
        });

        it('prints to the log event data for request events', function (done) {

            var settings = {
                monitor: {
                    opsInterval: 10000,
                    subscribers: {
                        console: ['ops']
                    },
                    requestsEvent: 'response',
                    broadcastInterval: 5
                }
            };

            var server = new Helpers.Server(settings);
            var monitor = new Helpers.Monitor(server);

            var data = {
                events: [{
                    event: 'request',
                    instance: 'testInstance',
                    method: 'testMethod'
                }]
            };

            Helpers._TEST.once('log', function (message) {

                expect(message).to.contain('testMethod');
                done();
            });

            monitor._display(data);
        });
    });
});