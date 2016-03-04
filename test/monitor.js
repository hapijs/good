'use strict';

// Load modules

const Http = require('http');
const Fs = require('fs');

const Code = require('code');
const Hapi = require('hapi');
const Insync = require('insync');
const Lab = require('lab');
const Wreck = require('wreck');

// Done for testing because Wreck is a singleton and every test run ads one event to it
Wreck.setMaxListeners(0);

const GoodReporter = require('./fixtures/reporters');
const Stringify = require('./fixtures/reporter');
const Monitor = require('../lib/monitor');
const Utils = require('../lib/utils');

// Declare internals
const internals = {
    monitorFactory(server, options) {

        const defaults = {
            responseEvent: 'tail',
            includes: {
                request: [],
                response: []
            },
            extensions: [],
            reporters: [],
            ops: false,
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

        const monitor = internals.monitorFactory(new Hapi.Server(), { ops: { interval: 15000 } });
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

    it('allows starting the monitor without the ops monitoring', (done) => {

        const monitor = internals.monitorFactory(new Hapi.Server());
        monitor.start((err) => {

            expect(err).to.not.exist();
            monitor.startOps(100);
            expect(monitor._ops).to.be.false();
            monitor.stop(done);
        });
    });

    describe('start()', () => {

        it('correctly passes dynamic arguments to stream constructors', (done) => {

            const Inc = GoodReporter.Incrementer;
            GoodReporter.Incrementer = function (starting, multiple) {

                GoodReporter.Incrementer = Inc;
                expect(starting).to.equal(10);
                expect(multiple).to.equal(5);

                return new Inc(starting, multiple);
            };

            require.cache[process.cwd() + '/test/fixtures/reporter.js'].exports = function (options) {

                require.cache[process.cwd() + '/test/fixtures/reporter.js'].exports = Stringify;
                expect(options).to.be.undefined();
                return new Stringify(options);
            };

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [{
                        ctor: {
                            module: '../test/fixtures/reporters',
                            name: 'Incrementer',
                            args: [10, 5]
                        }
                    },
                    '../test/fixtures/reporter']
                }
            });

            monitor.start((error) => {

                expect(error).to.not.exist();
                expect(monitor._reporters).to.have.length(1);
                monitor.stop(done);
            });
        });

        it('calls the start methods of any reporter that has one', (done) => {

            const reporterOne = new GoodReporter.Incrementer(1);
            reporterOne.start = function (callback) {

                expect(callback).to.be.a.function();
                expect(this).to.equal(reporterOne);
                return callback();
            };

            const reporterTwo = new GoodReporter.Incrementer(4);
            reporterTwo.start = function (callback) {

                expect(callback).to.be.a.function();
                expect(this).to.equal(reporterTwo);
                return callback();
            };

            const realStart = GoodReporter.Stringify.prototype.start;
            GoodReporter.Stringify.prototype.start = function (callback) {

                Stringify.prototype.start = realStart;
                expect(callback).to.be.a.function();
                expect(this).to.be.an.instanceof(GoodReporter.Stringify);
                realStart(callback);
            };

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [
                        reporterOne,
                        reporterTwo, {
                            ctor: {
                                module: '../test/fixtures/reporters',
                                name: 'Stringify'
                            }
                        }
                    ]
                }
            });

            monitor.start((error) => {

                expect(error).to.not.exist();
                expect(monitor._reporters).to.have.length(1);
                monitor.stop(done);
            });
        });


        it(`calls back with an error if a there is an error in a reporter 'start' method`, (done) => {

            const one = new GoodReporter.Incrementer(1);
            one.start = function (callback) {

                expect(this).to.equal(one);
                callback(new Error('test error'));
            };
            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [one]
                }
            });
            monitor.start((error) => {

                expect(error).to.exist();
                expect(error.message).to.equal('test error');
                done();
            });
        });

        it(`attaches events for 'ops', 'tail', 'log', and 'request-error'`, (done) => {

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [new GoodReporter.Incrementer(1), new GoodReporter.Stringify()]
                },
                ops: 15000
            });
            monitor.start((error) => {

                expect(error).to.not.exist();

                expect(monitor._ops.listeners('ops')).to.have.length(1);
                expect(monitor._server.listeners('request-error')).to.have.length(1);
                expect(monitor._server.listeners('log')).to.have.length(1);
                expect(monitor._server.listeners('tail')).to.have.length(1);
                monitor.stop(done);
            });
        });

        it('validates the incoming stream object instances', (done) => {

            const options = {
                reporters: {
                    foo: [{
                        ctor: {
                            module: '../test/fixtures/reporters',
                            name: 'NotConstructor'
                        }
                    }]
                }
            };

            expect(() => {

                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw(Error, 'Error in foo. ../test/fixtures/reporters must be a constructor function.');

            expect(() => {

                options.reporters.foo = [{
                    ctor: {
                        module: '../test/fixtures/reporters',
                        name: 'NotStream'
                    }
                }];
                const monitor = internals.monitorFactory(new Hapi.Server(), options);
                monitor.start(() => {});
            }).to.throw(Error, 'Error in foo. ../test/fixtures/reporters must create a stream that has a pipe function.');

            done();
        });
    });

    describe('push()', () => {

        it('passes data through each step in the pipeline', (done) => {

            const out1 = new GoodReporter.Writer(true);
            const out2 = new GoodReporter.Writer(true);

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [new GoodReporter.Incrementer(5), out1],
                    bar: [new GoodReporter.Incrementer(99), out2]
                }
            });

            monitor.start((error) => {

                expect(error).to.not.exist();

                for (let i = 0; i <= 10; ++i) {
                    monitor.push(() => ({ number: i }));
                }
                monitor.push(() => null);

                const res1 = out1.data;
                const res2 = out2.data;

                expect(res1).to.deep.equal([
                    { number: 5 },
                    { number: 6 },
                    { number: 7 },
                    { number: 8 },
                    { number: 9 },
                    { number: 10 },
                    { number: 11 },
                    { number: 12 },
                    { number: 13 },
                    { number: 14 },
                    { number: 15 }
                ]);

                expect(res2).to.deep.equal([
                    { number: 99 },
                    { number: 100 },
                    { number: 101 },
                    { number: 102 },
                    { number: 103 },
                    { number: 104 },
                    { number: 105 },
                    { number: 106 },
                    { number: 107 },
                    { number: 108 },
                    { number: 109 }
                ]);

                done();
            });

        });
    });

    describe('stop()', () => {

        it('cleans up open timeouts, removes event handlers, and pushes null to the read stream', (done) => {

            const one = new GoodReporter.Incrementer(1);
            const two = new GoodReporter.Stringify();
            const three = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [one, two, three]
                },
                extensions: ['request-internal'],
                ops: {
                    interval: 1500
                }
            });

            Insync.series([
                monitor.start.bind(monitor),
                (callback) => {

                    monitor.startOps(1500);
                    return callback();
                },
                (callback) => {

                    monitor.stop(() => {

                        expect(one._finalized).to.be.true();
                        expect(two._finalized).to.be.true();
                        expect(three._finalized).to.be.true();
                        expect([false, null]).to.contain(monitor._ops._interval._repeat);
                        expect(monitor._server.listeners('log')).to.have.length(0);
                        expect(monitor._ops.listeners('ops')).to.have.length(0);
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
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    plugins: {
                        good: { foo: 'bar' }
                    },
                    handler: (request, reply) => {

                        request.log('test-tag', 'log request data');
                        server.log(['test'], 'test data');
                        reply('done');
                        throw new Error('mock error');
                    }
                }
            });

            const out1 = new GoodReporter.Writer(true);
            const out2 = new GoodReporter.Writer(true);
            // remove these keys so deep.equal works. they change call to call and machine to machine
            const filters = ['timestamp','pid', 'id', 'log', 'responseTime', 'source'];
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [
                        new GoodReporter.Namer('foo'),
                        new GoodReporter.Cleaner(filters),
                        out1
                    ],
                    bar: [
                        new GoodReporter.Cleaner(filters),
                        out2
                    ]
                }
            });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    const req = Http.request({
                        hostname: server.info.host,
                        port: server.info.port,
                        method: 'GET',
                        path: '/?q=test'
                    }, (res) => {

                        expect(res.statusCode).to.equal(500);
                        const res1 = out1.data;
                        const res2 = out2.data;

                        expect(res1).to.have.length(4);
                        expect(res1).to.deep.contain([{
                            event: 'request',
                            tags: ['test-tag'],
                            data: 'log request data',
                            method: 'get',
                            path: '/',
                            config: { foo: 'bar' },
                            name: 'foo'
                        }, {
                            event: 'log',
                            tags: ['test'],
                            data: 'test data',
                            name: 'foo'
                        }, {
                            event: 'response',
                            instance: server.info.uri,
                            labels: [],
                            method: 'get',
                            path: '/',
                            query: { q: 'test' },
                            statusCode: 500,
                            config: { foo: 'bar' },
                            name: 'foo'
                        }]);

                        const err1 = JSON.parse(JSON.stringify(res1[2]));
                        expect(err1.event).to.equal('error');
                        expect(err1.error.error).to.equal('Uncaught error: mock error');
                        expect(err1.error.stack.split('\n')[0]).to.equal('Error: Uncaught error: mock error');

                        expect(res2).to.have.length(4);
                        expect(res2).to.deep.contain([{
                            event: 'request',
                            tags: ['test-tag'],
                            data: 'log request data',
                            method: 'get',
                            path: '/',
                            config: { foo: 'bar' }
                        }, {
                            event: 'log',
                            tags: ['test'],
                            data: 'test data'
                        }, {
                            event: 'response',
                            instance: server.info.uri,
                            labels: [],
                            method: 'get',
                            path: '/',
                            query: { q: 'test' },
                            statusCode: 500,
                            config: { foo: 'bar' }
                        }]);

                        const err2 = JSON.parse(JSON.stringify(res1[2]));
                        expect(err2.event).to.equal('error');
                        expect(err2.error.error).to.equal('Uncaught error: mock error');
                        expect(err2.error.stack.split('\n')[0]).to.equal('Error: Uncaught error: mock error');

                        callback();
                    });
                    req.end();
                }
            ], done);
        });

        it(`provides additional information about 'response' events using 'requestHeaders','requestPayload', and 'responsePayload'`, (done) => {

            const server = new Hapi.Server();
            server.connection();
            server.route({
                method: 'POST',
                path: '/',
                handler: (request, reply) => {

                    server.log(['test'], 'test data');
                    reply('done');
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [out]
                },
                includes: {
                    request: ['headers', 'payload'],
                    response: ['payload']
                }
            });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    const req = Http.request({
                        hostname: server.info.host,
                        port: server.info.port,
                        method: 'POST',
                        path: '/?q=test',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, (res) => {

                        const messages = out.data;
                        const response = messages[1];

                        expect(res.statusCode).to.equal(200);
                        expect(messages).to.have.length(2);

                        expect(response.event).to.equal('response');
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
            server.connection();

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [new GoodReporter.Namer('ops'), out]
                },
                ops: {
                    interval: 100
                }
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

                        expect(out.data).to.have.length(1);

                        const event = out.data[0];
                        expect(event).to.be.an.instanceof(Utils.Ops);
                        server.stop(callback);
                    }, 150);
                }
            ], done);
        });

        it(`has a standard 'response' data object`, (done) => {

            const server = new Hapi.Server();
            server.connection({ labels: ['test', 'foo'] });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    reply().code(201);
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo : [out] } });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(201);
                        expect(out.data).to.have.length(1);

                        const event = out.data[0];
                        expect(event).to.be.an.instanceof(Utils.RequestSent);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it(`has a standard 'error' data object`, (done) => {

            const server = new Hapi.Server({ debug: false });
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    throw new Error('mock error');
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(500);
                        expect(out.data).to.have.length(2);

                        const event = out.data[0];
                        expect(event).to.be.an.instanceof(Utils.RequestError);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it(`has a standard 'log' data object`, (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    server.log(['user', 'success'], 'route route called');
                    reply();
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(out.data).to.have.length(2);

                        const event = out.data[0];

                        expect(event).to.be.an.instanceof(Utils.ServerLog);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it(`has a standard 'request' event schema`, (done) => {

            const server = new Hapi.Server();
            server.connection();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    request.log(['user', 'test'], 'you called the / route');
                    reply();
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: '/'
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(out.data).to.have.length(2);

                        const event = out.data[0];

                        expect(event).to.be.an.instanceof(Utils.RequestLog);
                        server.stop(callback);
                    });
                }
            ], done);
        });

        it('reports extension events when they occur', (done) => {

            const server = new Hapi.Server();
            server.connection();

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

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [new GoodReporter.Cleaner('timestamp'), out]
                },
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

                    expect(out.data).to.have.length(8);

                    expect(out.data[0]).to.deep.equal({
                        event: 'start',
                        payload: []
                    });
                    const internalEvents = [1, 4, 5];

                    for (let i = 0; i < internalEvents.length; ++i) {
                        const index = internalEvents[i];
                        const event = out.data[index];

                        expect(event.event).to.equal('request-internal');
                        expect(event.payload).to.have.length(3);
                        expect(event.payload[1].internal).to.be.true();
                    }

                    expect(out.data[2]).to.deep.equal({
                        event: 'super-secret',
                        payload: [{
                            id: 1,
                            foo: 'bar'
                        }]
                    });

                    expect(out.data[3]).to.deep.equal({
                        event: 'super-secret',
                        payload: [null, null, null]
                    });

                    expect(out.data[7]).to.deep.equal({
                        event: 'stop',
                        payload:[]
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

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            Insync.series([
                server.start.bind(server),
                monitor.start.bind(monitor),
                (callback) => {

                    Wreck.get(server.connections[0].info.uri + '/', { rejectUnauthorized: false }, () => {

                        Wreck.get(server.connections[1].info.uri + '/http', () => {

                            expect(out.data).to.have.length(4);
                            const one = out.data[1];
                            const two = out.data[3];

                            expect(one).to.be.an.instanceof(Utils.Wreck);
                            expect(one.event).to.equal('wreck');
                            expect(one.request.protocol).to.equal('https:');
                            expect(one.request.host).to.exist();
                            expect(one.request.path).to.equal('/');

                            expect(two).to.be.an.instanceof(Utils.Wreck);
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

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            Insync.series([
                monitor.start.bind(monitor),
                (callback) => {

                    server.inject({
                        url: server.info.uri
                    }, (res) => {

                        expect(res.statusCode).to.equal(200);
                        expect(out.data[0].config).to.deep.equal({
                            foo: 'baz',
                            filter: true,
                            zip: 'zap'
                        });
                        expect(out.data[1].config).to.deep.equal({
                            foo: 'baz',
                            filter: true,
                            zip: 'zap'
                        });
                        callback();
                    });
                }
            ], done);
        });

        it('can communicate with process.stdout and process.stderr', (done) => {

            const replace = (orig, dest) => {

                return (message, encoding) => {

                    try {
                        const data = JSON.parse(message);
                        dest.push(data);
                        return true;
                    }
                    catch (e) {
                        return orig(message, encoding);
                    }
                };
            };

            const write = process.stdout.write;
            const writeData = [];
            process.stdout.write = replace(write, writeData);

            const err = process.stderr.write;
            const errData = [];
            process.stderr.write = replace(err, errData);

            const server = new Hapi.Server();
            const monitor = internals.monitorFactory(server, {
                ops: {
                    internal: 100
                },
                reporters: {
                    foo: [new GoodReporter.Namer('foo'), new GoodReporter.Stringify(), 'stdout'],
                    bar: [new GoodReporter.Namer('bar'), new GoodReporter.Stringify(), 'stderr']
                }
            });

            Insync.series([
                monitor.start.bind(monitor),
                (callback) => {

                    monitor.startOps(100);
                    setTimeout(callback, 250);
                },
                monitor.stop.bind(monitor),
                (callback) => {

                    process.stdout.write = write;
                    process.stderr.write = err;

                    expect(writeData.length).to.be.above(1);
                    expect(writeData[0]).to.include(['event', 'timestamp', 'host', 'pid', 'os', 'proc', 'load']);
                    expect(writeData[0].name).to.equal('foo');

                    expect(errData.length).to.be.above(1);
                    expect(errData[0]).to.include(['event', 'timestamp', 'host', 'pid', 'os', 'proc', 'load']);
                    expect(errData[0].name).to.equal('bar');

                    callback();
                }
            ],done);
        });
    });
});
