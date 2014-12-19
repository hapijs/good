// Load modules

var Http = require('http');
var Hapi = require('hapi');
var Items = require('items');
var Code = require('code');
var GoodReporter = require('good-reporter');
var Hoek = require('hoek');
var Lab = require('lab');
var Joi = require('joi');
var Monitor = require('../lib/monitor');

// Declare internals

var internals = {};

// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Code.expect;
var describe = lab.describe;
var it = lab.it;


describe('good', function () {

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

            expect(err).to.not.exist();
            expect(holder).to.exist();
            callback(holder, server);
        });
    };

    describe('Monitor()', function () {

        it('throws an error constructed without new', function (done) {

            var fn = function () {

                var monitor = Monitor();
            };

            expect(fn).throws(Error, 'Monitor must be instantiated using new');
            done();
        });

        it('throws an error if opsInterval is too small', function (done) {

            var options = {
                opsInterval: 50
            };



            var fn = function () {

                var monitor = new Monitor(new Hapi.Server(), options);
            };

            expect(fn).to.throw(Error, /opsInterval must be larger than or equal to 100/gi);
            done();
        });

        it('does not throw an error when opsInterval is more than 100', function (done) {

            var options = {
                opsInterval: 100,
                reporters: [{
                    reporter: new GoodReporter({})
                }]
            };

            var fn = function () {

                var monitor = new Monitor(new Hapi.Server(), options);
            };

            expect(fn).not.to.throw();
            done();
        });

        it('throws an error if responseEvent is not "response" or "tail"', function (done) {

            var options = {
                responseEvent: 'test',
                reporters: [{
                    reporter: new GoodReporter({})
                }]
            };


            var fn = function () {

                var monitor = new Monitor(new Hapi.Server(), options);
            };

            expect(fn).to.throw(Error, /responseEvent must be one of response, tail/gi);
            done();
        });

        it('supports a mix of broadcaster options', function (done) {

            var monitor;
            var options = {
                responseEvent: 'response',
                reporters: []
            };


            options.reporters.push(new GoodReporter());
            options.reporters.push({
                reporter: GoodReporter
            });

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();
                expect(monitor._reporters.length).to.equal(2);
                done();
            });
        });

        it('supports passing a module name or path for the reporter function', function (done) {

            var monitor;
            var options = {
                responseEvent: 'response',
                reporters: [{
                    reporter: 'good-reporter',
                    args: [{ log: '*' }, { colors: true }]
                }, {
                    reporter: '../node_modules/good-reporter',
                    args: [{ log: '*' }, { colors: false }]
                }]
            };

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();
                var reporters = monitor._reporters;
                expect(reporters.length).to.equal(2);
                done();
            });
        });
    });

    describe('start()', function() {

        it('calls the start methods of all the reporters', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.start = function (emitter, callback) {

                hitCount++;
                expect(emitter).to.exist();
                return callback(null);
            };

            two.start = function (emitter, callback) {

                setTimeout(function () {

                    hitCount++;
                    expect(emitter).to.exist();
                    callback(null);
                }, 10);
            };

            options.reporters = [one, two];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();
                expect(monitor._reporters.length).to.equal(2);
                expect(hitCount).to.equal(2);
                done();
            });
        });

        it('callsback with an error if a there is an error in a broadcaster "start" method', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();


            one.start = function (emitter, callback) {

                expect(emitter).to.exist();
                return callback(new Error('mock error'));
            };

            options.reporters = [one];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.exist();
                expect(error.message).to.equal('mock error');

                done();
            });
        });

        it('attaches events for "ops", "tail", "log", and "request-error"', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.start = two.start =  function (emitter, callback) {

                hitCount++;
                expect(emitter).to.exist();
                return callback(null);
            };

            options.reporters = [one, two];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();

                expect(monitor.listeners('ops').length).to.equal(1);
                expect(monitor._server.listeners('request-error').length).to.equal(1);
                expect(monitor._server.listeners('log').length).to.equal(1);
                expect(monitor._server.listeners('tail').length).to.equal(1);

                done();
            });
        });

        it('validates the incoming reporter objects', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two;

            options.reporters = [one, two];

            expect(function( ){

                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(Hoek.ignore);
            }).to.throw('Every reporter object must have a start and stop function.');

            done();
        });
    });

    describe('stop()', function () {

        it('cleans up open timeouts, removes event handlers, and stops all of the reporters', function (done) {

            var monitor;
            var options = {};

            var one = new GoodReporter();
            var two = new GoodReporter();
            var hitCount = 0;

            one.stop = function () {

                hitCount++;
            };

            two.stop = function () {
                hitCount++;
                setTimeout(function () { }, 10);
            };

            options.reporters = [one, two];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (err) {

                expect(err).to.not.exist();

                monitor.stop();

                var state = monitor._state;
                expect(hitCount).to.equal(2);

                expect(state.opsInterval._repeat).to.equal(false);
                expect(monitor._server.listeners('log').length).to.equal(0);
                expect(monitor.listeners('ops').length).to.equal(0);
                expect(monitor._server.listeners('internalError').length).to.equal(0);
                expect(monitor._server.listeners('tail').length).to.equal(0);

                done();
            });

        });

        it('is called on the "stop" server event', function (done) {

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [{
                        reporter: GoodReporter
                    }]
                }
            };
            var stop = Monitor.prototype.stop;
            var called = false;

            Monitor.prototype.stop = function () {

                called = true;
                expect(called).to.equal(true);
                Monitor.prototype.stop = stop;
                done();
            };

            var server = new Hapi.Server();
            server.register(plugin, function () {

                // .stop emits the "stop" event
                server.stop();
            });
        });
    });

    describe('broadcasting', function () {

        it('sends events to all reporters when they occur', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });
            var consoleError = console.error;

            console.error = Hoek.ignore;

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    request.log('test-tag', 'log request data');
                    server.log(['test'], 'test data');
                    reply('done');
                    throw new Error('mock error');
                }
            });

            var one = new GoodReporter({ log: '*', response: '*' });
            var two = new GoodReporter({ error: '*' });
            var three = new GoodReporter({ request: '*' });
            var events = [];

            one._report = function (event, eventData) {

                events.push(eventData);
            };

            two._report = function (event, eventData) {

                setTimeout(function () {

                    events.push(eventData);
                }, 10);
            };

            three._report = function (event, eventData) {

                setTimeout(function () {

                    events.push(eventData);
                }, 20);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one, two, three],
                    opsInterval: 100
                }
            };

            server.register(plugin, function () {

                server.start(function () {

                    Http.get(server.info.uri + '/?q=test', function (res) {

                        // Give the reporters time to report
                        setTimeout(function () {

                            expect(res.statusCode).to.equal(500);
                            expect(events.length).to.equal(4);
                            expect(events[0].event).to.equal('log');
                            expect(events[1].event).to.equal('response');
                            expect(events[2].event).to.equal('error');
                            expect(events[3].event).to.equal('request');

                            console.error = consoleError;

                            done();
                        }, 500);
                    });
                });
            });
        });

        it('provides additional information about "response" events using "logRequestHeaders","logRequestPayload", and "logResponsePayload"', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });
            server.route({
                method: 'POST',
                path: '/',
                handler: function (request, reply) {

                    server.log(['test'], 'test data');
                    reply('done');
                }
            });

            var one = new GoodReporter({ response: '*' });
            one._eventQueue = [];

            one._report = function (event, eventData) {

                one._eventQueue.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    logRequestHeaders: true,
                    logRequestPayload: true,
                    logResponsePayload: true
                }
            };

            server.register(plugin, function () {

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
                        var response = eventsOne[0];

                        expect(res.statusCode).to.equal(200);
                        expect(eventsOne.length).to.equal(1);

                        expect(response.event).to.equal('response');
                        expect(response.log).to.exist();
                        expect(response.log).to.be.an.array();
                        expect(response.headers).to.exist();
                        expect(response.requestPayload).to.deep.equal({
                            data: 'example payload'
                        });
                        expect(response.responsePayload).to.equal('done');
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

            var options = {
                opsInterval: 100,
                reporters: [{
                    reporter: GoodReporter
                }]
            };
            var monitor = new Monitor(new Hapi.Server(), options);
            var ops = false;
            var log = console.error;

            console.error = function (error) {

                expect(error.message).to.equal('there was an error during processing');
            };

            var parallel = Items.parallel.execute;

            Items.parallel.execute = function (methods, callback) {

                var _callback = function (error, results) {

                    callback(error, results);

                    expect(error).to.exist();
                    expect(error.message).to.equal('there was an error during processing');
                    expect(results).to.not.exist();
                    expect(ops).to.be.false();
                    Items.parallel.execute = parallel;
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

                expect(error).to.not.exist();
            });
        });

        it('has a standard "ops" event schema', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            var one = new GoodReporter({
                ops: '*'
            });

            var events = [];

            one._report = function (event, eventData) {

                events.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    opsInterval: 100
                }
            };
            var schema = Joi.object().keys({
                event: Joi.string().required().allow('ops'),
                timestamp: Joi.number().required().integer(),
                pid: Joi.number().required().integer(),
                host: Joi.string().required(),
                os: Joi.object().required(),
                proc: Joi.object().required(),
                load: Joi.object().required()
            }).unknown(false);

            server.register(plugin, function () {

                server.start(function () {

                    // Give the reporters time to report
                    setTimeout(function () {


                        expect(events).to.have.length(1);

                        var event = events[0];

                        expect(function () {
                           Joi.assert(event, schema);
                        }).to.not.throw();

                        done();
                    }, 150);
                });
            });
        });

        it('has a standard "response" event schema', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost', labels: ['test', 'foo'] });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { reply().code(201); }
            });

            var one = new GoodReporter({
                response: '*'
            });

            var events = [];

            one._report = function (event, eventData) {

                events.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    opsInterval: 2000
                }
            };
            var schema = Joi.object().keys({
                event: Joi.string().required().allow('response'),
                timestamp: Joi.number().required().integer(),
                id: Joi.string().required(),
                instance: Joi.string().required(),
                labels: Joi.array(),
                method: Joi.string().required(),
                path: Joi.string().required(),
                query: Joi.object(),
                source: Joi.object().required(),
                responseTime: Joi.number().integer().required(),
                statusCode: Joi.number().integer().required(),
                pid: Joi.number().integer().required(),
                log: Joi.array().includes(Joi.object())
            }).unknown(false);

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        expect(res.statusCode).to.equal(201);
                        expect(events).to.have.length(1);

                        var event = events[0];

                        expect(function () {
                            Joi.assert(event, schema);
                        }).to.not.throw();

                        done();
                    });
                });
            });
        });

        it('has a standard "error" event schema', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { throw new Error('mock error'); }
            });

            var one = new GoodReporter({
                error: '*'
            });
            var events = [];

            one._report = function (event, eventData) {

                events.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    opsInterval: 2000
                }
            };
            var schema = Joi.object().keys({
                event: Joi.string().required().allow('error'),
                timestamp: Joi.number().required().integer(),
                url: Joi.object().required(),
                method: Joi.string().required(),
                pid: Joi.number().integer().required(),
                error: Joi.object().required()
            }).unknown();

            var consoleError = console.error;
            console.error = Hoek.ignore;

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        expect(res.statusCode).to.equal(500);
                        expect(events).to.have.length(1);

                        var event = events[0];

                        expect(function () {
                            Joi.assert(event, schema);
                        }).to.not.throw();

                        var parse = JSON.parse(JSON.stringify(event));

                        expect(parse.error).to.exist();
                        expect(parse.error.stack).to.exist();

                        console.error = consoleError;

                        done();
                    });
                });
            });
        });

        it('has a standard "log" event schema', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {
                    server.log(['user', 'success'], 'route route called');
                    reply();
                }
            });

            var one = new GoodReporter({
                log: '*'
            });
            var events = [];

            one._report = function (event, eventData) {

                events.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    opsInterval: 2000
                }
            };
            var schema = Joi.object().keys({
                event: Joi.string().required().allow('log'),
                timestamp: Joi.number().required().integer(),
                tags: Joi.array().includes(Joi.string()).required(),
                data: Joi.string().required(),
                pid: Joi.number().integer().required()
            }).unknown(false);

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        expect(res.statusCode).to.equal(200);
                        expect(events).to.have.length(1);

                        var event = events[0];

                        expect(function () {
                            Joi.assert(event, schema);
                        }).to.not.throw();

                        done();
                    });
                });
            });
        });

        it('has a standard "request" event schema', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    request.log(['user', 'test'], 'you called the / route');
                    reply();
                }
            });

            var one = new GoodReporter({
                request: '*'
            });
            var events = [];

            one._report = function (event, eventData) {

                events.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    opsInterval: 2000
                }
            };
            var schema = Joi.object().keys({
                event: Joi.string().required().allow('request'),
                timestamp: Joi.number().required().integer(),
                tags: Joi.array().includes(Joi.string()).required(),
                data: Joi.string().required(),
                pid: Joi.number().integer().required(),
                id: Joi.string().required(),
                method: Joi.string().required().allow('GET'),
                path: Joi.string().required().allow('/')
            }).unknown(false);

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        expect(res.statusCode).to.equal(200);
                        expect(events).to.have.length(1);

                        var event = events[0];

                        expect(function () {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        done();
                    });
                });
            });
        });

        it('prevents changing the eventData object', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) { throw new Error('mock error'); }
            });

            var one = new GoodReporter({
                error: '*'
            });
            var two = new GoodReporter({
                error: '*'
            });
            var events = [];

            one._report = function (event, eventData) {

                eventData.foo = true;
                events.push(eventData);
            };

            two._report = function (event, eventData) {

                expect(eventData.foo).to.not.exist();
                events.push(eventData);
            };

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one, two],
                    opsInterval: 2000
                }
            };


            var consoleError = console.error;
            console.error = Hoek.ignore;

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        expect(res.statusCode).to.equal(500);
                        expect(events).to.have.length(2);

                        expect(events[0]).to.deep.equal(events[1]);
                        console.error = consoleError;

                        done();
                    });
                });
            });
        });
    });
});
