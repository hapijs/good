// Load modules

var Http = require('http');
var Async = require('async');
var Hapi = require('hapi');
var Lab = require('lab');
var GoodReporter = require('good-reporter');
var Monitor = require('../lib/monitor');

// Declare internals

var internals = {};

// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Lab.expect;
var before = lab.before;
var after = lab.after;
var describe = lab.describe;
var it = lab.it;


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

    describe('#constructor', function () {

        it('throws an error constructed without new', function (done) {

            var fn = function () {

                var monitor = Monitor();
            };

            expect(fn).throws(Error, 'Monitor must be instantiated using new');
            done();
        });

        it('has no options', function (done) {

            makePack(function (pack, server) {

                var fn = function () {

                    var monitor = new Monitor(pack);
                };
                expect(fn).to.not.throw();
                done();
            });
        });

        it('throws an error if opsInterval is too small', function (done) {

            var options = {
                opsInterval: 50
            };

            makePack(function (pack, server) {

                var fn = function () {

                    var monitor = new Monitor(pack, options);
                };

                expect(fn).to.throw(Error, /opsInterval must be larger than or equal to 100/gi);
                done();
            });
        });

        it('does not throw an error when opsInterval is more than 100', function (done) {

            var options = {
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
                requestsEvent: 'test'
            };

            makePack(function (pack, server) {

                var fn = function () {
                    var monitor = new Monitor(pack, options);
                };

                expect(fn).to.throw(Error, /requestsEvent must be one of response, tail/gi);
                done();
            });
        });

        it('requestsEvent is a response', function (done) {

            var options = {
                requestsEvent: 'response'
            };

            makePack(function (pack, server) {

                var fn = function () {

                    var monitor = new Monitor(pack, options);
                };

                expect(fn).not.to.throw(Error);
                done();
            });
        });

        it('supports a mix of broadcaster options', function (done) {

            var monitor;
            var options = {
                requestsEvent: 'response',
                reporters: []
            };


            options.reporters.push(new GoodReporter());
            options.reporters.push({
               reporter: GoodReporter
            });

            makePack(function (pack, server) {

                monitor = new Monitor(pack, options);
                monitor.start(function (error) {

                    expect(error).to.not.exist;
                    expect(monitor._reporters.length).to.equal(2);
                    done();
                });
            });
        });
    });

    describe('#start', function() {

        it('calls the start methods of all the reporters', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.start = function (callback) {

                hitCount++;
                return callback(null);
            };

            two.start = function (callback) {

                setTimeout(function () {

                    hitCount++;
                    callback(null);
                }, 10);
            };

            two.remote = true;

            options.reporters = [one, two];

            makePack(function (pack, server) {



                monitor = new Monitor(pack, options);
                monitor.start(function (error) {

                    expect(error).to.not.exist;
                    expect(monitor._reporters.length).to.equal(2);
                    expect(hitCount).to.equal(2);
                    done();
                });
            });
        });

        it('callsback with an error if a there is an error in a broadcaster "start" method', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();


            one.start = function (callback) {

                return callback(new Error('mock error'));
            };

            options.reporters = [one];

            makePack(function (pack, server) {


                monitor = new Monitor(pack, options);
                monitor.start(function (error) {

                    expect(error).to.exist;
                    expect(error.message).to.equal('mock error');

                    done();
                });
            });
        });

        it('attaches events for "ops", "request", "log", and "internalError"', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.start = two.start =  function (callback) {

                hitCount++;
                return callback(null);
            };

            options.reporters = [one, two];

            makePack(function (pack, server) {



                monitor = new Monitor(pack, options);
                monitor.start(function (error) {

                    expect(error).to.not.exist;

                    expect(monitor.listeners('ops').length).to.equal(1);
                    expect(monitor._plugin.events.listeners('internalError').length).to.equal(1);
                    expect(monitor._plugin.events.listeners('log').length).to.equal(1);
                    expect(monitor._plugin.events.listeners('request').length).to.equal(1);

                    done();
                });
            });
        });
    });

    describe('#stop', function () {

        it('cleans up open timeouts, removes event handlers, and stops all of the reporters', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.stop = function (callback) {

                hitCount++;
                return callback(null);
            };

            two.stop = function (callback) {

                setTimeout(function () {

                    hitCount++;
                    callback(null);
                }, 10);
            };

            options.reporters = [one, two];

            makePack(function (pack, server) {



                monitor = new Monitor(pack, options);
                monitor.start(function (err) {

                    expect(err).to.not.exist;

                    monitor.stop(function (error) {

                        expect(error).to.not.exist;

                        var state = monitor._state;
                        expect(hitCount).to.equal(2);

                        expect(state.opsInterval._repeat).to.equal(false);
                        expect(monitor._plugin.events.listeners('log').length).to.equal(0);
                        expect(monitor.listeners('ops').length).to.equal(0);
                        expect(monitor._plugin.events.listeners('internalError').length).to.equal(0);
                        expect(monitor._plugin.events.listeners('tail').length).to.equal(0);

                        done();
                    });
                });
            });
        });

        it('logs an error if it occurs during stop', function (done) {
            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.stop = function (callback) {

                hitCount++;
                return callback(null);
            };

            two.stop = function (callback) {

                setTimeout(function () {

                    hitCount++;
                    callback(new Error('mock error'));
                }, 10);
            };

            options.reporters = [one, two];

            makePack(function (pack, server) {



                monitor = new Monitor(pack, options);
                monitor.start(function (err) {

                    expect(err).to.not.exist;

                    var log = console.error;
                    console.error = function (error) {

                        console.error = log;
                        expect(error.message).to.equal('mock error');
                    };

                    monitor.stop(function (error) {

                        expect(error).to.not.exist;

                        var state = monitor._state;
                        expect(hitCount).to.equal(2);

                        expect(state.opsInterval._repeat).to.equal(false);
                        expect(monitor._plugin.events.listeners('log').length).to.equal(0);
                        expect(monitor.listeners('ops').length).to.equal(0);
                        expect(monitor._plugin.events.listeners('internalError').length).to.equal(0);
                        expect(monitor._plugin.events.listeners('tail').length).to.equal(0);

                        done();
                    });
                });
            });
        });
    });

    describe('broadcasting', function () {

        it('sends events to all reporters when they occur', function (done) {

            var server = new Hapi.Server('127.0.0.1', 0);
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    server.log(['test'], 'test data');
                    server.emit('internalError', request, new Error('mock error'));
                    reply('done');
                }
            });

            var one = new GoodReporter({
                events: {
                    log: [],
                    request: []
                }
            });

            var two = new GoodReporter({
                events: {
                    error: []
                }
            });

            var three = new GoodReporter({
               events: {
                   ops: []
               }
            });

            one.report = function (callback) {

                return callback(null);
            };

            two.report = function (callback) {

                setTimeout(function () {

                    return callback(null);
                }, 10);
            };

            three.report = function (callback) {

                setTimeout(function () {

                    return callback(null);
                }, 10);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one, two, three],
                    opsInterval: 100
                }
            };

            server.pack.register(plugin, function () {

                server.start(function () {

                    setTimeout(function () {

                        Http.get('http://127.0.0.1:' + server.info.port + '/?q=test', function (res) {

                            var eventsOne = one._eventQueue;
                            var eventsTwo = two._eventQueue;
                            var eventsThree = three._eventQueue;

                            expect(res.statusCode).to.equal(200);
                            expect(eventsOne.length).to.equal(2);
                            expect(eventsOne[0].event).to.equal('log');
                            expect(eventsOne[1].event).to.equal('request');

                            expect(eventsTwo.length).to.equal(1);
                            expect(eventsTwo[0].event).to.equal('error');

                            expect(eventsThree.length).to.equal(1);
                            expect(eventsThree[0].event).to.equal('ops');

                            done();
                        });
                    }, 150);
                });
            });
        });

        it('provides additional information about "request" events using "extendedRequests", "logRequestHeaders","logRequestPayload", and "logResponsePayload"', function (done) {

            var server = new Hapi.Server('127.0.0.1', 0);
            server.route({
                method: 'POST',
                path: '/',
                handler: function (request, reply) {

                    server.log(['test'], 'test data');
                    reply('done');
                }
            });

            var one = new GoodReporter({
                events: {
                    log: [],
                    request: []
                }
            });

            one.report = function (callback) {

                return callback(null);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    extendedRequests: true,
                    logRequestHeaders: true,
                    logRequestPayload: true,
                    logResponsePayload: true
                }
            };

            server.pack.register(plugin, function () {

                server.start(function () {

                    var req = Http.request({
                        hostname: '127.0.0.1',
                        port: server.info.port,
                        method: 'POST',
                        path: '/?q=test',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (res) {

                        var eventsOne = one._eventQueue;
                        var request = eventsOne[1];

                        expect(res.statusCode).to.equal(200);
                        expect(eventsOne.length).to.equal(2);
                        expect(eventsOne[0].event).to.equal('log');

                        expect(request.event).to.equal('request');
                        expect(request.log).to.exist;
                        expect(request.log).to.be.an('array');
                        expect(request.headers).to.exist;
                        expect(request.requestPayload).to.deep.equal({
                            data: 'example payload'
                        });
                        expect(request.responsePayload).to.equal('done');

                        done();
                    });

                    req.write(JSON.stringify({
                        data: 'example payload'
                    }));
                    req.end();

                });
            });
        });

        it('does not send an "ops" event if an error occurs during information gathering', function (done) {

            makePack(function (plugin, server) {

                var options = {
                    opsInterval: 100
                };
                var monitor = new Monitor(plugin, options);
                var ops = false;
                var log = console.error;

                console.error = function (error) {

                    expect(error.message).to.equal('there was an error during processing');
                };

                var parallel = Async.parallel;

                Async.parallel = function (methods, callback) {

                    var _callback = function (error, results) {

                        callback(error, results);

                        expect(error).to.exist;
                        expect(error.message).to.equal('there was an error during processing');
                        expect(ops).to.equal(false);
                        Async.parallel = parallel;
                        console.error = log;
                        delete methods.createError;
                        done();
                    };

                    methods.createError = function (callback) {

                        return callback(new Error('there was an error during processing'));
                    };

                    parallel(methods, _callback);
                };

                monitor.on('ops', function (event) {

                    ops = true;
                });

                monitor.start(function (error) {

                    expect(error).to.not.exist;
                });
            });
        });
    });


    describe('#_sendMessages', function () {

        it('logs an error if it occurs, but does not prevent other reporters from sending', function (done) {

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCounter = 0;

            one.report = function (callback) {


                setTimeout(function() {

                    hitCounter++;
                    expect(hitCounter).to.equal(2);

                    callback(null);
                    done();
                }, 5);
            };

            two.report = function (callback) {

                var log = console.error;

                console.error = function (value) {

                    console.error = log;

                    expect(value).to.exist;
                    expect(value.message).to.equal('mock error');
                };

                hitCounter++;
                callback(new Error('mock error'));

            };

            var reporters = [one, two];

            makePack(function (pack, server) {

                var monitor = new Monitor(pack, {
                   reporters: reporters
                });

                monitor._sendMessages(reporters);

            });
        });
    });

});
