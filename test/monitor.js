'use strict';

// Load modules

const Http = require('http');

const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Joi = require('joi');
const Lab = require('lab');

const GoodReporter = require('./helper');
const Monitor = require('../lib/monitor');

// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;


describe('good', () => {

    describe('Monitor()', () => {

        it('throws an error if responseEvent is not "response" or "tail"', (done) => {

            const options = {
                responseEvent: 'test',
                reporters: [{
                    reporter: new GoodReporter({})
                }]
            };


            const fn = () => {

                new Monitor(new Hapi.Server(), options);
            };

            expect(fn).to.throw(Error, /"responseEvent" must be one of \[response, tail\]/gi);
            done();
        });

        it('supports a mix of reporter options', (done) => {

            let monitor;
            const options = {
                responseEvent: 'response',
                reporters: []
            };

            options.reporters.push(new GoodReporter({ ops: '*' }));
            options.reporters.push({
                reporter: GoodReporter,
                events: { ops: '*' }
            });


            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((error) => {

                expect(monitor._dataStream.listeners('data')).to.have.length(2);
                expect(error).to.not.exist();
                monitor.stop();
                done();
            });
        });

        it('supports passing a module name or path for the reporter function', (done) => {

            let monitor;
            const options = {
                responseEvent: 'response',
                reporters: [{
                    reporter: '../test/helper',
                    events: { log: '*' }
                }]
            };

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((error) => {

                expect(error).to.not.exist();
                expect(monitor._dataStream.listeners('data')).to.have.length(1);
                monitor.stop();
                done();
            });
        });

        it('allows starting with no reporters', (done) => {

            let monitor;
            const options = {
                responseEvent: 'response'
            };

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((error) => {

                expect(error).to.not.exist();
                expect(monitor._dataStream.listeners('data')).to.have.length(0);
                monitor.stop();
                done();
            });
        });

        it('throws an error if invalid extension events are used', (done) => {

            const options = {
                responseEvent: 'tail',
                reporters: [{
                    reporter: new GoodReporter({})
                }],
                extensions: ['tail', 'request', 'ops']
            };


            const fn = () => {

                new Monitor(new Hapi.Server(), options);
            };

            expect(fn).to.throw(Error, 'Invalid monitorOptions options child "extensions" fails because ["extensions" at position 0 fails because ["0" contains an invalid value]]');
            done();
        });

        it('logs an error if one occurs doing ops information collection', (done) => {

            const error = console.error;
            console.error = (err) => {

                console.error = error;
                expect(err).to.be.an.instanceof(Error);
                done();
            };
            const monitor = new Monitor(new Hapi.Server());
            monitor.start((err) => {

                expect(err).to.not.exist();
                monitor._ops.emit('error', new Error('mock error'));
            });
        });
    });

    describe('start()', () => {

        it('calls the init methods of all the reporters', (done) => {

            const options = {};
            const one = new GoodReporter();
            const two = new GoodReporter();
            let monitor;
            let hitCount = 0;

            one.init = (stream, emitter, callback) => {

                hitCount++;
                expect(emitter.on).to.exist();
                return callback(null);
            };

            two.init = (stream, emitter, callback) => {

                setTimeout(() => {

                    hitCount++;
                    expect(emitter.on).to.exist();
                    callback(null);
                }, 10);
            };

            options.reporters = [one, two];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((error) => {

                expect(error).to.not.exist();
                expect(hitCount).to.equal(2);
                monitor.stop();
                done();
            });
        });

        it('callsback with an error if a there is an error in a broadcaster "init" method', (done) => {

            const options = {};
            const one = new GoodReporter();
            let monitor;

            one.init = (stream, emitter, callback) => {

                expect(emitter.on).to.exist();
                return callback(new Error('mock error'));
            };

            options.reporters = [one];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((error) => {

                expect(error).to.exist();
                expect(error.message).to.equal('mock error');

                done();
            });
        });

        it('attaches events for "ops", "tail", "log", and "request-error"', (done) => {

            const options = {};
            const one = new GoodReporter();
            const two = new GoodReporter();
            let monitor;

            one.start = two.start = (emitter, callback) => {};

            options.reporters = [one, two];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((error) => {

                expect(error).to.not.exist();

                expect(monitor._ops.listeners('ops')).to.have.length(1);
                expect(monitor._server.listeners('request-error')).to.have.length(1);
                expect(monitor._server.listeners('log')).to.have.length(1);
                expect(monitor._server.listeners('tail')).to.have.length(1);
                monitor.stop();

                done();
            });
        });

        it('validates the incoming reporter objects', (done) => {

            const options = {};
            const one = {
                reporter: Hoek.ignore
            };
            let monitor;

            options.reporters = [one];

            expect(() => {

                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('reporter [0] must specify events to filter on');

            expect(() => {

                options.reporters[0].events = { log: '*' };
                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('reporter [0] must have an init method');

            done();
        });

        it('uses reporter name or index in reporter validation errors', (done) => {

            const options = {};
            const ignore = () => {};
            ignore.attributes = {
                name: 'test-reporter'
            };
            const one = {
                reporter: ignore
            };

            let monitor;

            options.reporters = [one];

            expect(() => {

                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('test-reporter must specify events to filter on');

            ignore.attributes = {
                pkg: {
                    name: 'test-reporter-two'
                }
            };

            expect(() => {

                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('test-reporter-two must specify events to filter on');


            ignore.attributes = {};
            options.reporters = [one, one];

            expect(() => {

                monitor = new Monitor(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('reporter [0] must specify events to filter on');

            done();
        });
    });

    describe('stop()', () => {

        it('cleans up open timeouts, removes event handlers, and stops all of the reporters', (done) => {

            const one = new GoodReporter({ log: '*' });
            const two = new GoodReporter({ ops: '*' });
            const options = {};
            let monitor;

            options.reporters = [one, two];

            monitor = new Monitor(new Hapi.Server(), options);
            monitor.start((err) => {

                expect(err).to.not.exist();

                monitor.stop();

                expect(one.stopped).to.be.true();
                expect(two.stopped).to.be.true();

                expect([false, null]).to.contain(monitor._ops._interval._repeat);
                expect(monitor._server.listeners('log')).to.have.length(0);
                expect(monitor.listeners('ops')).to.have.length(0);
                expect(monitor._server.listeners('internalError')).to.have.length(0);
                expect(monitor._server.listeners('tail')).to.have.length(0);

                done();
            });
        });

        it('is called on the "stop" server event', (done) => {

            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [{
                        reporter: GoodReporter,
                        events: { response: '*' }
                    }]
                }
            };
            const stop = Monitor.prototype.stop;
            let called = false;

            Monitor.prototype.stop = () => {

                called = true;
                expect(called).to.equal(true);
                Monitor.prototype.stop = stop;
                done();
            };

            const server = new Hapi.Server();
            server.register(plugin, () => {

                // .stop emits the "stop" event
                server.stop((err) => {

                    expect(err).to.not.exist();
                });
            });
        });
    });

    describe('broadcasting', () => {

        it('sends events to all reporters when they occur', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });
            const consoleError = console.error;
            const events = [];

            console.error = () => {};

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    request.log('test-tag', 'log request data');
                    server.log(['test'], 'test data');
                    reply('done');
                    throw new Error('mock error');
                }
            });

            const one = new GoodReporter({ log: '*', response: '*' }, null, (data) => {

                events.push(data.event);
            });
            const two = new GoodReporter({ error: '*' }, null, (data) => {

                events.push(data.event);
            });
            const three = new GoodReporter({ request: '*' }, null, (data) => {

                setTimeout(() => {

                    events.push(data.event);
                }, 10);
            });

            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one, two, three]
                }
            };

            server.register(plugin, () => {

                server.start(() => {

                    Http.get(server.info.uri + '/?q=test', (res) => {

                        // Give the reporters time to report
                        setTimeout(() => {

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

        it('provides additional information about "response" events using "requestHeaders","requestPayload", and "responsePayload"', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });
            server.route({
                method: 'POST',
                path: '/',
                handler: (request, reply) => {

                    server.log(['test'], 'test data');
                    reply('done');
                }
            });

            const one = new GoodReporter({ response: '*' });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    requestHeaders: true,
                    requestPayload: true,
                    responsePayload: true
                }
            };

            server.register(plugin, () => {

                server.start(() => {

                    const req = Http.request({
                        hostname: '127.0.0.1',
                        port: server.info.port,
                        method: 'POST',
                        path: '/?q=test',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, (res) => {

                        const messages = one.messages;
                        const response = messages[0];

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

        it('filters payloads per the filter rules', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });
            server.route({
                method: 'POST',
                path: '/',
                handler: (request, reply) => {

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

            const one = new GoodReporter({ response: '*' });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
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
                }
            };

            server.register(plugin, () => {

                server.start(() => {

                    const req = Http.request({
                        hostname: '127.0.0.1',
                        port: server.info.port,
                        method: 'POST',
                        path: '/',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, (res) => {

                        const messages = one.messages;
                        const response = messages[0];

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

        it('has a standard "ops" event schema', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            const one = new GoodReporter({
                ops: '*'
            });

            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    ops: {
                        interval: 100
                    }
                }
            };
            const schema = Joi.object().keys({
                event: Joi.string().required().allow('ops'),
                timestamp: Joi.number().required().integer(),
                pid: Joi.number().required().integer(),
                host: Joi.string().required(),
                os: Joi.object().required(),
                proc: Joi.object().required(),
                load: Joi.object().required()
            });

            server.register(plugin, () => {

                server.start(() => {

                    // Give the reporters time to report
                    setTimeout(() => {

                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(() => {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        done();
                    }, 150);
                });
            });
        });

        it('has a standard "response" event schema', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', labels: ['test', 'foo'] });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    reply().code(201);
                }
            });

            const one = new GoodReporter({
                response: '*'
            });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one]
                }
            };
            const schema = Joi.object().keys({
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

            server.register(plugin, () => {

                server.start(() => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(201);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(() => {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        done();
                    });
                });
            });
        });

        it('has a standard "error" event schema', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    throw new Error('mock error');
                }
            });

            const one = new GoodReporter({
                error: '*'
            });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one]
                }
            };
            const schema = Joi.object().keys({
                event: Joi.string().required().allow('error'),
                timestamp: Joi.number().required().integer(),
                id: Joi.string().required(),
                url: Joi.object().required(),
                method: Joi.string().required(),
                pid: Joi.number().integer().required(),
                error: Joi.object().required()
            });

            const consoleError = console.error;
            console.error = () => {};

            server.register(plugin, () => {

                server.start(() => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(500);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(() => {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        const parse = JSON.parse(JSON.stringify(event));

                        expect(parse.error).to.exist();
                        expect(parse.error.stack).to.exist();

                        console.error = consoleError;

                        done();
                    });
                });
            });
        });

        it('has a standard "log" event schema', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    server.log(['user', 'success'], 'route route called');
                    reply();
                }
            });

            const one = new GoodReporter({
                log: '*'
            });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one]
                }
            };
            const schema = Joi.object().keys({
                event: Joi.string().required().allow('log'),
                timestamp: Joi.number().required().integer(),
                tags: Joi.array().items(Joi.string()).required(),
                data: Joi.string().required(),
                pid: Joi.number().integer().required()
            });

            server.register(plugin, () => {

                server.start(() => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(() => {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        server.stop((err) => {

                            expect(err).to.not.exist();
                        });
                        done();
                    });
                });
            });
        });

        it('has a standard "request" event schema', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    request.log(['user', 'test'], 'you called the / route');
                    reply();
                }
            });

            const one = new GoodReporter({
                request: '*'
            });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one]
                }
            };
            const schema = Joi.object().keys({
                event: Joi.string().required().allow('request'),
                timestamp: Joi.number().required().integer(),
                tags: Joi.array().items(Joi.string()).required(),
                data: Joi.string().required(),
                pid: Joi.number().integer().required(),
                id: Joi.string().required(),
                method: Joi.string().required().allow('GET'),
                path: Joi.string().required().allow('/')
            });

            server.register(plugin, () => {

                server.start(() => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(() => {

                            Joi.assert(event, schema);
                        }).to.not.throw();

                        server.stop((err) => {

                            expect(err).to.not.exist();
                        });
                        done();
                    });
                });
            });
        });

        it('reports extension events when they occur', (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    // Simulate a new event that might exist down the road
                    server._events.emit('super-secret', {
                        id: 1,
                        foo: 'bar'
                    });

                    server._events.emit('super-secret', null, null, null);

                    reply();
                }
            });

            const one = new GoodReporter({
                start: '*',
                stop: '*',
                'request-internal': '*',
                'super-secret': '*'
            });
            const plugin = {
                register: require('../lib/index').register,
                options: {
                    reporters: [one],
                    extensions: ['start', 'stop', 'request-internal', 'super-secret']
                }
            };

            server.register(plugin, () => {

                server.start(() => {

                    server.inject({
                        url: '/'
                    }, () => {

                        server.stop(() => {

                            expect(one.messages).to.have.length(7);

                            expect(one.messages[0]).to.deep.equal({
                                event: 'start'
                            });
                            const internalEvents = [1, 4, 5];

                            for (let i = 0; i < internalEvents.length; ++i) {
                                const index = internalEvents[i];
                                const event = one.messages[index];

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
