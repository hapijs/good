'use strict';

// Load modules

const Http = require('http');
const Fs = require('fs');

const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Insync = require('insync');
const Lab = require('lab');
const Wreck = require('wreck');

// Done for testing because Wreck is a singleton and every test run ads one event to it
Wreck.setMaxListeners(0);

const GoodReporter = require('./helper');
const Monitor = require('../lib/monitor');
const Utils = require('../lib/utils');

// Declare internals
const internals = {
    monitorFactory(server, options) {

        const defaults = {
            responseEvent: 'tail',
            requestHeaders: false,
            requestPayload: false,
            responsePayload: false,
            extensions: [],
            reporters: [],
            ops: {
                interval: 15000
            },
            filter: {}
        };
        return new Monitor(server, Object.assign({}, defaults, options));
    }
};
// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;



describe('Monitor', () => {

    it('logs an error if one occurs doing ops information collection', (done) => {

        const monitor = internals.monitorFactory(new Hapi.Server());
        const error = console.error;
        console.error = (err) => {

            console.error = error;
            expect(err).to.be.an.instanceof(Error);
            monitor.stop(done);
        };
        monitor.start((err) => {

            expect(err).to.not.exist();
            monitor._ops.emit('error', new Error('mock error'));
        });
    });

    describe('start()', () => {

        it('calls the init methods of all the reporters', (done) => {

            const one = new GoodReporter();
            const two = new GoodReporter();
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

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: [one, two]
            });
            monitor.start((error) => {

                expect(error).to.not.exist();
                expect(hitCount).to.equal(2);
                monitor.stop(done);
            });
        });

        it(`callsback with an error if a there is an error in a reporter 'init' method`, (done) => {

            const one = new GoodReporter();
            one.init = (stream, emitter, callback) => {

                expect(emitter.on).to.exist();
                return callback(new Error('mock error'));
            };
            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: [one]
            });
            monitor.start((error) => {

                expect(error).to.exist();
                expect(error.message).to.equal('mock error');
                done();
            });
        });

        it(`attaches events for 'ops', 'tail', 'log', and 'request-error'`, (done) => {

            const monitor = internals.monitorFactory(new Hapi.Server(), { reporters: [new GoodReporter()] } );
            monitor.start((error) => {

                expect(error).to.not.exist();

                expect(monitor._ops.listeners('ops')).to.have.length(1);
                expect(monitor._server.listeners('request-error')).to.have.length(1);
                expect(monitor._server.listeners('log')).to.have.length(1);
                expect(monitor._server.listeners('tail')).to.have.length(1);
                monitor.stop(done);
            });
        });

        it('validates the incoming reporter objects', (done) => {

            const options = {
                reporters: [{
                    reporter: Hoek.ignore
                }]
            };

            expect(() => {

                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('reporter [0] must specify events to filter on');

            expect(() => {

                options.reporters[0].events = { log: '*' };
                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('reporter [0] must have an init method');

            done();
        });

        it('uses reporter name if available or index as a fallback to throw reporter validation errors', (done) => {

            const ignore = () => {};
            ignore.attributes = {
                name: 'test-reporter'
            };
            const one = {
                reporter: ignore
            };
            const options = {
                reporters: [one]
            };

            expect(() => {

                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('test-reporter must specify events to filter on');

            ignore.attributes = {
                pkg: {
                    name: 'test-reporter-two'
                }
            };

            expect(() => {

                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('test-reporter-two must specify events to filter on');

            ignore.attributes = {};
            options.reporters = [one, one];

            expect(() => {

                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw('reporter [0] must specify events to filter on');

            done();
        });
    });

    describe('stop()', () => {

        it('cleans up open timeouts, removes event handlers, and pushes null to the read stream', (done) => {

            const one = new GoodReporter({ log: '*' });
            const two = new GoodReporter({ ops: '*' });
            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: [one, two],
                extensions: ['request-internal']
            });

            Insync.series([
                monitor.start.bind(monitor),
                (callback) => {

                    monitor.startOps(20000);
                    return callback();
                },
                (callback) => {

                    monitor.stop(() => {

                        expect(one.stopped).to.be.true();
                        expect(two.stopped).to.be.true();

                        expect([false, null]).to.contain(monitor._ops._interval._repeat);
                        expect(monitor._server.listeners('log')).to.have.length(0);
                        expect(monitor.listeners('ops')).to.have.length(0);
                        expect(monitor._server.listeners('internalError')).to.have.length(0);
                        expect(monitor._server.listeners('tail')).to.have.length(0);
                        expect(monitor._server.listeners('stop')).to.have.length(0);

                        callback();
                    });
                }
            ], done);
        });
    });

    describe('monitoring', () => {

        it('sends events to all reporters when they occur', (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection({ host: 'localhost' });
            const consoleError = console.error;
            const events = [];

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

            const monitor = internals.monitorFactory(server, {
                reporters: [one, two, three]
            });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    Http.get(server.info.uri + '/?q=test', (res) => {

                        // Give the reporters time to report
                        setTimeout(() => {

                            expect(res.statusCode).to.equal(500);
                            expect(events).to.have.length(4);
                            expect(events).to.only.include(['log', 'response', 'error', 'request']);
                            console.error = consoleError;

                            callback();
                        }, 500);
                    });
                }
            ], done);
        });

        it(`provides additional information about 'response' events using 'requestHeaders','requestPayload', and 'responsePayload'`, (done) => {

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
            const monitor = internals.monitorFactory(server, {
                reporters: [one],
                requestHeaders: true,
                requestPayload: true,
                responsePayload: true
            });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

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
                        server.stop(callback);
                    });

                    req.write(JSON.stringify({
                        data: 'example payload'
                    }));
                    req.end();
                }
            ], done);
        });

        it(`has a standard 'ops' data object`, (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost' });

            const one = new GoodReporter({ ops: '*' });
            const monitor = internals.monitorFactory(server, {
                reporters: [one]
            });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    monitor.startOps(100);
                    return callback();
                },
                (callback) => {

                    // Give the reporters time to report
                    setTimeout(() => {

                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];
                        expect(event).to.be.an.instanceof(Utils.GreatOps);
                        server.stop(callback);
                    }, 150);
                }
            ], done);
        });

        it(`has a standard 'response' data object`, (done) => {

            const server = new Hapi.Server();
            server.connection({ host: 'localhost', labels: ['test', 'foo'] });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    reply().code(201);
                }
            });

            const one = new GoodReporter({ response: '*' });
            const monitor = internals.monitorFactory(server, { reporters: [one] });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(201);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(event).to.be.an.instanceof(Utils.GreatResponse);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it(`has a standard 'error' data object schema`, (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection({ host: 'localhost' });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    throw new Error('mock error');
                }
            });

            const one = new GoodReporter({ error: '*' });
            const monitor = internals.monitorFactory(server, { reporters: [one] });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(500);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(event).to.be.an.instanceof(Utils.GreatError);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it(`has a standard 'log' data object`, (done) => {

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

            const one = new GoodReporter({ log: '*' });
            const monitor = internals.monitorFactory(server, { reporters: [one] });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(event).to.be.an.instanceof(Utils.GreatLog);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it(`has a standard 'request' event schema`, (done) => {

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

            const one = new GoodReporter({ request: '*' });
            const monitor = internals.monitorFactory(server, { reporters: [one] });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(one.messages).to.have.length(1);

                        const event = one.messages[0];

                        expect(event).to.be.an.instanceof(Utils.GreatRequest);
                        server.stop(callback);
                    });
                }
            ], done);
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
            const monitor = internals.monitorFactory(server, {
                reporters: [one],
                extensions: ['start', 'stop', 'request-internal', 'super-secret']
            });

            Insync.series([
                monitor.start.bind(monitor),
                server.start.bind(server),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, () => {

                        callback();
                    });
                },
                server.stop.bind(server),
                (callback) => {

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
                    callback();
                }
            ], done);
        });

        it('reports on outbound wreck requests', (done) => {

            const server = new Hapi.Server();
            const tls = {
                key: Fs.readFileSync(process.cwd() + '/test/fixtures/server.key', { encoding: 'utf8' }),
                cert: Fs.readFileSync(process.cwd() + '/test/fixtures/server.cert', { encoding: 'utf8' })
            };

            server.connection({ port: 0, labels: ['https'], tls });
            server.connection({ port: 0, labels: ['http'] });
            server.route({
                method: 'GET',
                path: '/',
                handler: function (request, reply) {

                    reply('/');
                }
            });

            server.select('http').route({
                method: 'GET',
                path: '/http',
                handler: function (request, reply) {

                    reply('http');
                }
            });

            const reporter = new GoodReporter({ wreck: '*' });
            const monitor = internals.monitorFactory(server, { reporters: [reporter] });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    Wreck.get(server.connections[0].info.uri + '/', { rejectUnauthorized: false }, () => {

                        Wreck.get(server.connections[1].info.uri + '/http', () => {

                            expect(reporter.messages).to.have.length(2);
                            const one = reporter.messages[0];
                            const two = reporter.messages[1];

                            expect(one).to.be.an.instanceof(Utils.GreatWreck);
                            expect(one.event).to.equal('wreck');
                            expect(one.request.protocol).to.equal('https:');
                            expect(one.request.host).to.exist();
                            expect(one.request.path).to.equal('/');

                            expect(two).to.be.an.instanceof(Utils.GreatWreck);
                            expect(two.event).to.equal('wreck');
                            expect(two.request.protocol).to.equal('http:');
                            expect(two.request.host).to.exist();
                            expect(two.request.path).to.equal('/http');

                            server.stop(done);
                        });
                    });
                }
            ], done);
        });

        it('attaches good data from the request.plugins.good and route good config to reporting objects', (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                path: '/',
                method: 'GET',
                config: {
                    handler(request, reply) {

                        request.plugins.good = {
                            foo: 'baz',
                            filter: true
                        };
                        reply();
                        request.log(['test', { test: true }]);
                    },
                    plugins: {
                        good: {
                            foo: 'bar',
                            zip: 'zap'
                        }
                    }
                }
            });

            const reporter = new GoodReporter({ response: '*', request: '*' });
            const monitor = internals.monitorFactory(server, { reporters: [reporter] });

            Insync.series([
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: server.info.uri
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(reporter.messages[0].config).to.deep.equal({
                            foo: 'baz',
                            filter: true,
                            zip: 'zap'
                        });
                        expect(reporter.messages[1].config).to.deep.equal({
                            foo: 'baz',
                            filter: true,
                            zip: 'zap'
                        });
                        callback();
                    });
                }
            ], done);


        });
    });
});
