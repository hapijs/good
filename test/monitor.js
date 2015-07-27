// Load modules

var Http = require('http');

var Code = require('code');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Items = require('items');
var Joi = require('joi');
var Lab = require('lab');

var GoodReporter = require('./helper');
var Monitor = require('../lib/monitor');

// Declare internals

var internals = {};

// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Code.expect;
var describe = lab.describe;
var it = lab.it;


describe('good', function () {

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

            expect(fn).to.throw(Error, /"opsInterval" must be larger than or equal to 100/gi);
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

            expect(fn).to.throw(Error, /"responseEvent" must be one of \[response, tail\]/gi);
            done();
        });

        it('supports valid reporter options', function (done) {

            var monitor;
            var options = {
                responseEvent: 'response',
                reporters: []
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                var one = options.reporters[0].instance;
                expect(one instanceof GoodReporter).to.be.true();
                expect(options.reporters[0].metadata.name).to.equal('good-reporter');
                expect(options.reporters[0].metadata.version).to.equal('1.0.0');

                expect(monitor._dataStream.listeners('data')).to.have.length(1);
                expect(error).to.not.exist();
                monitor.stop();
                done();
            });
        });

        it('supports reporter attributes nested in pkg property', function (done) {

            var monitor;
            var options = {
                responseEvent: 'response'
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            var originalAttributes = GoodReporter.attributes;
            GoodReporter.attributes = {
                pkg: {
                    name: 'good-reporter-pkg',
                    version: '2.0.0'
                }
            };

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                var one = options.reporters[0].instance;
                expect(one instanceof GoodReporter).to.be.true();

                expect(options.reporters[0].metadata.name).to.equal('good-reporter-pkg');
                expect(options.reporters[0].metadata.version).to.equal('2.0.0');

                expect(monitor._dataStream.listeners('data')).to.have.length(1);
                expect(error).to.not.exist();
                monitor.stop();

                GoodReporter.attributes = originalAttributes;

                done();
            });
        });

        it('supports passing a module name or path for the reporter function', function (done) {

            var monitor;
            var options = {
                responseEvent: 'response',
                reporters: [{
                    reporter: '../test/helper',
                    events: { log: '*' }
                }]
            };

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();
                expect(monitor._dataStream.listeners('data')).to.have.length(1);
                monitor.stop();
                done();
            });
        });

        it('allows starting with no reporters', function (done) {

            var monitor;
            var options = {
                responseEvent: 'response'
            };

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();
                expect(monitor._dataStream.listeners('data')).to.have.length(0);
                monitor.stop();
                done();
            });
        });

        it('throws an error if invalid extension events are used', function (done) {

            var options = {
                responseEvent: 'tail',
                reporters: [{
                    reporter: new GoodReporter({})
                }],
                extensions: ['tail', 'request', 'ops']
            };


            var fn = function () {

                var monitor = new Monitor(new Hapi.Server(), options);
            };

            expect(fn).to.throw(Error, 'Invalid monitorOptions options child "extensions" fails because ["extensions" at position 0 fails because ["0" contains an invalid value]]');
            done();
        });
    });

    describe('start()', function () {

        it('calls the init methods of all the reporters', function (done) {

            var monitor;
            var options = {};

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }, {
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();

                var one = monitor.settings.reporters[0].instance;
                var two = monitor.settings.reporters[1].instance;

                expect(one.initHitCount).to.equal(1);
                expect(one.emitters[0].on).to.exist();

                expect(two.initHitCount).to.equal(1);
                expect(two.emitters[0].on).to.exist();

                monitor.stop();
                done();
            });
        });

        it('callsback with an error if a there is an error in a broadcaster "init" method', function (done) {

            var monitor;
            var options = {};

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            var originalInit = GoodReporter.prototype.init;
            GoodReporter.prototype.init = function (stream, emitter, callback) {

                expect(emitter.on).to.exist();
                return callback(new Error('mock error'));
            };

            monitor = new Monitor(new Hapi.Server(), options);

            monitor.start(function (error) {

                expect(error).to.exist();
                expect(error.message).to.equal('mock error');

                GoodReporter.prototype.init = originalInit;

                done();
            });
        });

        it('attaches events for "ops", "tail", "log", and "request-error"', function (done) {

            var monitor;
            var options = {};
            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }, {
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (error) {

                expect(error).to.not.exist();

                expect(monitor.listeners('ops')).to.have.length(1);
                expect(monitor._server.listeners('request-error')).to.have.length(1);
                expect(monitor._server.listeners('log')).to.have.length(1);
                expect(monitor._server.listeners('tail')).to.have.length(1);
                monitor.stop();

                done();
            });
        });

        it('validates the incoming reporter objects', function (done) {

            var monitor;
            var options = {};

            options.reporters = [{
                reporter: GoodReporter
            }, {
                reporter: GoodReporter
            }];

            expect(function () {

                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(Hoek.ignore);
            }).to.throw('reporter must specify events to filter on');

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }, {
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            var originalInit = GoodReporter.prototype.init;
            GoodReporter.prototype.init = null;

            expect(function () {

                options.reporters[0].events = { log: '*' };
                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(Hoek.ignore);
            }).to.throw('Every reporter object must have an init method');

            GoodReporter.prototype.init = originalInit;

            done();
        });

        it('requires attributes on reporter constructor', function (done) {

            var monitor;
            var options = {};

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            var originalAttributes = GoodReporter.attributes;

            GoodReporter.attributes = null;

            monitor = new Monitor(new Hapi.Server(), options);

            var fnOne = function () {

                monitor.start();
            };

            expect(fnOne).to.throw(Error, 'reporter constructor missing attributes object');

            GoodReporter.attributes = {
                name: null
            };

            var fnTwo = function () {

                monitor.start();
            };

            expect(fnTwo).to.throw(Error, 'reporter attributus missing name');

            GoodReporter.attributes = originalAttributes;

            done();
        });
    });

    describe('stop()', function () {

        it('cleans up open timeouts, removes event handlers, and stops all of the reporters', function (done) {

            var monitor;
            var options = {};

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }, {
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start(function (err) {

                expect(err).to.not.exist();

                monitor.stop();

                var state = monitor._state;

                var one = monitor.settings.reporters[0].instance;
                var two = monitor.settings.reporters[1].instance;

                expect(one.stopped).to.be.true();
                expect(two.stopped).to.be.true();

                expect([false, null]).to.contain(state.opsInterval._repeat);
                expect(monitor._server.listeners('log')).to.have.length(0);
                expect(monitor.listeners('ops')).to.have.length(0);
                expect(monitor._server.listeners('internalError')).to.have.length(0);
                expect(monitor._server.listeners('tail')).to.have.length(0);

                done();
            });
        });

        it('is called on the "stop" server event', function (done) {

            var plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [{
                        reporter: GoodReporter,
                        events: { response: '*' }
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

            var options = {
                opsInterval: 100
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { log: '*', response: '*' }
            }, {
                reporter: GoodReporter,
                events: { error: '*' }
            }, {
                reporter: GoodReporter,
                events: { request: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

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

            server.register(plugin, function () {

                server.start(function () {

                    Http.get(server.info.uri + '/?q=test', function (res) {

                        // Give the reporters time to report
                        setTimeout(function () {

                            var events = plugin.options.reporters.reduce(function (memo, reporter) {

                                return memo.concat(reporter.instance.messages.map(function (message) {

                                    return message.event;
                                }));
                            }, []);

                            expect(res.statusCode).to.equal(500);
                            expect(events).to.have.length(4);
                            expect(events).to.only.include(['log', 'response', 'error', 'request']);
                            console.error = consoleError;

                            done();
                        }, 500);
                    });
                });
            });
        });

        it('provides additional information about "response" events using "requestHeaders","requestPayload", and "responsePayload"', function (done) {

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

            var options = {
                requestHeaders: true,
                requestPayload: true,
                responsePayload: true
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { response: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
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

                        var messages = plugin.options.reporters[0].instance.messages;
                        var response = messages[0];

                        expect(res.statusCode).to.equal(200);
                        expect(messages).to.have.length(1);

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

        it('filters payloads per the filter rules', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });
            server.route({
                method: 'POST',
                path: '/',
                handler: function (request, reply) {

                    reply({
                        first: 'John',
                        last: 'Smith',
                        ccn: '9999999999',
                        line: 'foo',
                        userId: 555645465,
                        address: {
                            line: ['123 Main street', 'Apt 200', 'Suite 100'],
                            bar: {
                                line: '123',
                                extra: 123456
                            },
                            city: 'Pittsburgh',
                            last: 'Jones',
                            foo: [{
                                email: 'adam@hapijs.com',
                                baz: 'another string',
                                line: 'another string'
                            }]
                        }
                    });
                }
            });

            var options = {
                requestPayload: true,
                responsePayload: true,
                filter: {
                    last: 'censor',
                    password: 'censor',
                    email: 'remove',
                    ccn: '(\\d{4})$',
                    userId: '(645)',
                    city: '(\\w?)',
                    line: 'censor'
                }
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { response: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            server.register(plugin, function () {

                server.start(function () {

                    var req = Http.request({
                        hostname: '127.0.0.1',
                        port: server.info.port,
                        method: 'POST',
                        path: '/',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (res) {

                        var messages = plugin.options.reporters[0].instance.messages;
                        var response = messages[0];

                        expect(res.statusCode).to.equal(200);
                        expect(messages).to.have.length(1);
                        expect(response.requestPayload).to.deep.equal({
                            password: 'XXXXX'
                        });
                        expect(response.responsePayload).to.deep.equal({
                            first: 'John',
                            last: 'XXXXX',
                            ccn: '999999XXXX',
                            userId: '555XXX465',
                            line: 'XXX',
                            address: {
                                line: ['XXXXXXXXXXXXXXX', 'XXXXXXX', 'XXXXXXXXX'],
                                bar: {
                                    line: 'XXX',
                                    extra: 123456
                                },
                                city: 'Xittsburgh',
                                last: 'XXXXX',
                                foo: [{
                                    baz: 'another string',
                                    line: 'XXXXXXXXXXXXXX'
                                }]
                            }
                        });
                        done();
                    });

                    req.write(JSON.stringify({
                        password: 12345,
                        email: 'adam@hapijs.com'
                    }));
                    req.end();
                });
            });
        });

        it('does not send an "ops" event if an error occurs during information gathering', function (done) {

            var options = {
                opsInterval: 100,
                reporters: [{
                    reporter: GoodReporter,
                    events: {
                        ops: '*'
                    }
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
                    monitor.stop();
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

            var options = {
                opsInterval: 100
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { ops: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            var schema = Joi.object().keys({
                event: Joi.string().required().allow('ops'),
                timestamp: Joi.number().required().integer(),
                pid: Joi.number().required().integer(),
                host: Joi.string().required(),
                os: Joi.object().required(),
                proc: Joi.object().required(),
                load: Joi.object().required()
            });

            server.register(plugin, function () {

                server.start(function () {

                    var one = plugin.options.reporters[0].instance;

                    // Give the reporters time to report
                    setTimeout(function () {

                        expect(one.messages).to.have.length(1);

                        var event = one.messages[0];

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
                handler: function (request, reply) {

                    reply().code(201);
                }
            });

            var options = {
                opsInterval: 2000
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { response: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
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
                log: Joi.array().items(Joi.object())
            });

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        var one = plugin.options.reporters[0].instance;

                        expect(res.statusCode).to.equal(201);
                        expect(one.messages).to.have.length(1);

                        var event = one.messages[0];

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
                handler: function (request, reply) {

                    throw new Error('mock error');
                }
            });

            var options = {
                opsInterval: 2000
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { error: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            var schema = Joi.object().keys({
                event: Joi.string().required().allow('error'),
                timestamp: Joi.number().required().integer(),
                id: Joi.string().required(),
                url: Joi.object().required(),
                method: Joi.string().required(),
                pid: Joi.number().integer().required(),
                error: Joi.object().required()
            });

            var consoleError = console.error;
            console.error = Hoek.ignore;

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        var one = plugin.options.reporters[0].instance;

                        expect(res.statusCode).to.equal(500);
                        expect(one.messages).to.have.length(1);

                        var event = one.messages[0];

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

            var options = {
                opsInterval: 2000
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { log: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            var schema = Joi.object().keys({
                event: Joi.string().required().allow('log'),
                timestamp: Joi.number().required().integer(),
                tags: Joi.array().items(Joi.string()).required(),
                data: Joi.string().required(),
                pid: Joi.number().integer().required()
            });

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        var one = plugin.options.reporters[0].instance;

                        expect(res.statusCode).to.equal(200);
                        expect(one.messages).to.have.length(1);

                        var event = one.messages[0];

                        expect(function () {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        server.stop();
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

            var options = {
                opsInterval: 2000
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { request: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            var schema = Joi.object().keys({
                event: Joi.string().required().allow('request'),
                timestamp: Joi.number().required().integer(),
                tags: Joi.array().items(Joi.string()).required(),
                data: Joi.string().required(),
                pid: Joi.number().integer().required(),
                id: Joi.string().required(),
                method: Joi.string().required().allow('GET'),
                path: Joi.string().required().allow('/')
            });

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {

                        var one = plugin.options.reporters[0].instance;

                        expect(res.statusCode).to.equal(200);
                        expect(one.messages).to.have.length(1);

                        var event = one.messages[0];

                        expect(function () {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        server.stop();
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
                handler: function (request, reply) {

                    throw new Error('mock error');
                }
            });

            var options = {
                opsInterval: 2000
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: { error: '*' }
            }, {
                reporter: GoodReporter,
                events: { error: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            var consoleError = console.error;
            console.error = Hoek.ignore;

            server.register(plugin, function () {

                var handlerCallCount = 0;

                var one = plugin.options.reporters[0].instance;
                var two = plugin.options.reporters[1].instance;

                one.handler = function (data) {

                    handlerCallCount++;
                    data.foo = true;
                };

                two.handler = function (data) {

                    handlerCallCount++;
                    expect(data.foo).to.not.exist();
                };

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function (res) {


                        expect(res.statusCode).to.equal(500);
                        expect(handlerCallCount).to.equal(2);
                        expect(one.messages).to.have.length(1);
                        expect(two.messages).to.have.length(1);

                        expect(one.messages[0]).to.deep.equal(two.messages[0]);
                        console.error = consoleError;
                        server.stop();

                        done();
                    });
                });
            });
        });

        it('reports extension events when they occur', function (done) {

            var server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    // Simulare a new event that might exist down the road
                    server._events.emit('super-secret', {
                        id: 1,
                        foo: 'bar'
                    });

                    server._events.emit('super-secret', null, null, null);

                    reply();
                }
            });

            var options = {
                extensions: ['start', 'stop', 'request-internal', 'super-secret']
            };

            options.reporters = [{
                reporter: GoodReporter,
                events: {
                    start: '*',
                    stop: '*',
                    'request-internal': '*',
                    'super-secret': '*'
                }
            }, {
                reporter: GoodReporter,
                events: { error: '*' }
            }];

            var plugin = {
               register: require('..'),
               options: options
            };

            server.register(plugin, function () {

                server.start(function () {

                    server.inject({
                        url: '/'
                    }, function () {

                        server.stop(function () {

                            var one = plugin.options.reporters[0].instance;

                            expect(one.messages).to.have.length(7);

                            expect(one.messages[0]).to.deep.equal({
                                event: 'start'
                            });
                            var internalEvents = [1, 4, 5];

                            for (var i = 0, il = internalEvents.length; i < il; ++i) {
                                var index = internalEvents[i];
                                var event = one.messages[index];

                                expect(event.event).to.equal('request-internal');
                                expect(event.request).to.be.a.string();
                                expect(event.timestamp).to.exist();
                                expect(event.tags).to.be.an.array();
                                expect(event.internal).to.be.true();
                            }

                            expect(one.messages[2]).to.deep.equal({
                                event: 'super-secret',
                                id: 1,
                                foo: 'bar'
                            });

                            expect(one.messages[3]).to.deep.equal({
                                event: 'super-secret'
                            });

                            expect(one.messages[6]).to.deep.equal({
                                event: 'stop'
                            });

                            done();
                        });
                    });
                });
            });
        });
    });
});
