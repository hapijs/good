'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Wreck = require('wreck');

const GoodReporter = require('./fixtures/reporters');
const Stringify = require('./fixtures/reporter');
const Monitor = require('../lib/monitor');
const Utils = require('../lib/utils');

// Declare internals
const internals = {
    monitorFactory(server, options) {

        const defaults = {
            includes: {
                request: [],
                response: []
            },
            extensions: [],
            reporters: {},
            ops: false
        };

        if (server.events.hasListeners === undefined) {
            const hasListeners = function (event) {

                return this.listeners(event).length > 0;
            };

            server.decorate('server', 'hasListeners', hasListeners);
        }

        if (server.event !== undefined) {
            server.event('internalError');
            server.event('super-secret');
        }

        return new Monitor(server, Object.assign({}, defaults, options));
    }
};
// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

describe('Monitor', () => {

    it('logs an error if one occurs doing ops information collection', { plan: 1 }, () => {

        const monitor = internals.monitorFactory(new Hapi.Server(), { ops: { interval: 15000 } });
        const error = console.error;

        return new Promise((resolve) => {

            console.error = (err) => {

                console.error = error;
                expect(err).to.be.an.instanceof(Error);
                monitor.stop();

                resolve();
            };

            monitor.start();

            monitor._ops.emit('error', new Error('mock error'));
        });
    });

    it('allows starting the monitor without the ops monitoring', { plan: 1 }, () => {

        const monitor = internals.monitorFactory(new Hapi.Server());

        monitor.start();

        monitor.startOps(100);
        expect(monitor._ops).to.be.false();

        monitor.stop();
    });

    it('logs and destroys a reporter in the event of a stream error', { plan: 3 }, () => {

        const one = new GoodReporter.Incrementer(1);
        const two = new GoodReporter.Writer(true);
        const monitor = internals.monitorFactory(new Hapi.Server(), {
            reporters: {
                foo: [one, two]
            }
        });
        const err = console.error;
        console.error = (message) => {

            console.error = () => { };
            expect(message).to.match(/There was a problem \(.*\) in foo and it has been destroyed\./);
        };

        monitor.start();

        monitor.push(() => ({ id: 1, number: 2 }));
        monitor.push(() => ({ id: 2, number: 5 }));
        // Verion 8 of node misses this change inside monitor, so force it here
        const foo = monitor._reporters.get('foo');
        foo.destroyed = true;
        foo.emit('error');
        monitor.push(() => ({ id: 3, number: 100 }));

        expect(two.data).to.have.length(2);
        expect(two.data).to.equal([{ id: 1, number: 3 }, { id: 2, number: 6 }]);
        console.error = err;
    });

    describe('start()', () => {

        it('correctly passes dynamic arguments to stream constructors', { plan: 4 }, async () => {

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
                    foo: [
                        new GoodReporter.Incrementer(10, 5),
                        { module: require('./fixtures/reporter') }
                    ]
                }
            });

            monitor.start();

            expect(monitor._reporters.size).to.equal(1);

            await monitor.stop();
        });

        it('accepts a function as module', { plan: 1 }, async () => {

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [{
                        module: require('./fixtures/reporter')
                    }]
                }
            });

            monitor.start();

            expect(monitor._reporters.size).to.equal(1);

            await monitor.stop();
        });

        it('accepts an unnamed function as module', { plan: 1 }, () => {

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [{
                        module: require('./fixtures/unnamed-reporter')
                    }]
                }
            });

            monitor.start();

            expect(monitor._reporters.size).to.equal(1);

            monitor.stop();
        });

        it('attaches events for "ops", "log", and "request"', { plan: 3 }, () => {

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [new GoodReporter.Incrementer(1), new GoodReporter.Stringify()]
                },
                ops: 15000
            });

            monitor.start();

            expect(monitor._ops.listeners('ops')).to.have.length(1);
            expect(monitor._server.events.hasListeners('request')).to.be.true();
            expect(monitor._server.events.hasListeners('log')).to.be.true();

            monitor.stop();
        });

        it('validates the incoming stream object instances', { plan: 2 }, () => {

            const options = {
                reporters: {
                    foo: [{
                        module: '../test/fixtures/reporters',
                        name: 'NotConstructor'
                    }]
                }
            };

            let monitor = internals.monitorFactory(new Hapi.Server(), options);

            try {
                monitor.start();
            }
            catch (err) {
                expect(err).to.be.an.error('Error in foo. ../test/fixtures/reporters must be a constructor function.');
            }

            options.reporters.foo = [{
                module: '../test/fixtures/reporters',
                name: 'NotStream'
            }];

            monitor = internals.monitorFactory(new Hapi.Server(), options);

            try {
                monitor.start();
            }
            catch (err) {
                expect(err).to.be.an.error('Error in foo. ../test/fixtures/reporters must create a stream that has a pipe function.');
            }
        });

        it('does not create a reporter if the reporter has no streams', { plan: 2 }, () => {

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [],
                    bar: [new GoodReporter.Incrementer(1)]
                }
            });

            monitor.start();

            expect(monitor._reporters.size).to.equal(1);
            expect(monitor._reporters.get('bar')).to.exist();
        });
    });

    describe('push()', () => {

        it('passes data through each step in the pipeline', { plan: 2 }, () => {

            const out1 = new GoodReporter.Writer(true);
            const out2 = new GoodReporter.Writer(true);

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [new GoodReporter.Incrementer(5), out1],
                    bar: [new GoodReporter.Incrementer(99), out2]
                }
            });

            monitor.start();

            for (let i = 0; i <= 10; ++i) {
                monitor.push(() => ({ number: i }));
            }

            const res1 = out1.data;
            const res2 = out2.data;

            expect(res1).to.equal([
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

            expect(res2).to.equal([
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

        });

        it('does not push data through if the monitor has been stopped', { plan: 1 }, () => {

            const out1 = new GoodReporter.Writer(true);

            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [new GoodReporter.Incrementer(5), out1]
                }
            });

            monitor.start();
            monitor.stop();

            for (let i = 0; i <= 10; ++i) {
                monitor.push(() => ({ number: i }));
            }
            expect(out1.data).to.equal([]);
        });
    });

    describe('stop()', () => {

        it('cleans up open timeouts, stops reporting events and pushes null to the read stream', { plan: 6 }, async () => {

            const one = new GoodReporter.Incrementer(1);
            const two = new GoodReporter.Stringify();
            const three = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(new Hapi.Server(), {
                reporters: {
                    foo: [one, two, three]
                },
                ops: {
                    interval: 1500
                }
            });

            monitor.start();

            monitor.startOps(1500);

            expect(monitor._state.report).to.be.true();

            monitor.stop();

            await Utils.timeout(50);

            expect(one._finalized).to.be.true();
            expect(two._finalized).to.be.true();
            expect(three._finalized).to.be.true();
            expect(monitor._state.report).to.be.false();
            expect([false, null]).to.contain(monitor._ops._interval._repeat);
        });
    });

    describe('monitoring', () => {

        it('sends events to all reporters when they occur', { plan: 10 }, async () => {

            const server = new Hapi.Server({ debug: false });

            server.route({
                method: 'GET',
                path: '/',
                config: {
                    plugins: {
                        good: { foo: 'bar' }
                    },
                    handler: (request, h) => {

                        request.log('test-tag', 'log request data');
                        server.log(['test'], 'test data');

                        throw new Error('mock error');
                    }
                }
            });

            const out1 = new GoodReporter.Writer(true);
            const out2 = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [
                        new GoodReporter.Namer('foo'),
                        out1
                    ],
                    bar: [
                        out2
                    ]
                }
            });

            await server.start();

            monitor.start();

            try {
                await Wreck.get(server.info.uri + '/?q=test');
            }
            catch (err) {
                expect(err).to.exist();
                expect(err.output.payload.statusCode).to.equal(500);

                await Utils.timeout(50);

                const res1 = out1.data;
                const res2 = out2.data;

                expect(res1).to.have.length(4);
                expect(res1).to.part.contain([{
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
                expect(err1.error).to.equal('An internal server error occurred');

                expect(res2).to.have.length(4);
                expect(res2).to.part.contain([{
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
                expect(err1.error).to.equal('An internal server error occurred');
            }
        });

        it('provides additional information about "response" events using "requestHeaders","requestPayload", "responseHeaders" and "responsePayload"', { plan: 9 }, async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'POST',
                path: '/',
                handler: (request, h) => {

                    server.log(['test'], 'test data');

                    return 'done';
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [out]
                },
                includes: {
                    request: ['headers', 'payload'],
                    response: ['headers', 'payload']
                }
            });

            await server.start();
            monitor.start();

            const res = await Wreck.request('post', server.info.uri + '/?q=test', {
                headers: {
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify({
                    data: 'example payload'
                }),
                timeout: 200
            });

            expect(res.statusCode).to.equal(200);

            await Utils.timeout(50);

            const messages = out.data;
            const response = messages[1];

            expect(messages).to.have.length(2);

            expect(response.event).to.equal('response');
            expect(response.log).to.be.an.array();
            expect(response.headers).to.exist();
            expect(response.responseHeaders).to.exist();
            expect(response.requestPayload).to.equal({
                data: 'example payload'
            });
            expect(response.responsePayload).to.equal('done');
            expect(response.route).to.equal('/');

            await server.stop();
        });

        it('has a standard "ops" data object', { plan: 2 }, async () => {

            const server = new Hapi.Server();

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [new GoodReporter.Namer('ops'), out]
                },
                ops: {
                    interval: 100
                }
            });


            await server.start();

            monitor.start();

            monitor.startOps(100);

            // Give the reporters time to report
            await Utils.timeout(150);

            expect(out.data).to.have.length(1);

            const event = out.data[0];
            expect(event).to.be.an.instanceof(Utils.Ops);

            await server.stop();
        });

        it('has a standard "response" data object', { plan: 4 }, async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    return h.response().code(201);
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            await server.start();

            monitor.start();

            const res = await server.inject({
                url: '/'
            });

            expect(res.statusCode).to.equal(201);

            await Utils.timeout(50);

            expect(out.data).to.have.length(1);

            const event = out.data[0];

            expect(event).to.be.an.instanceof(Utils.RequestSent);
            expect(event.id).to.be.a.string();

            await server.stop();
        });

        it('has a standard "error" data object', { plan: 3 }, async () => {

            const server = new Hapi.Server({ debug: false });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    throw new Error('mock error');
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            await server.start();

            monitor.start();

            const res = await server.inject({
                url: '/'
            });

            expect(res.statusCode).to.equal(500);

            await Utils.timeout(50);

            expect(out.data).to.have.length(2);

            const event = out.data[0];
            expect(event).to.be.an.instanceof(Utils.RequestError);

            await server.stop();
        });

        it('includes headers in the "error" data object if so configured', { plan: 3 }, async () => {

            const server = new Hapi.Server({ debug: false });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    throw new Error('mock error');
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                includes: {
                    request: ['headers'],
                    response: []
                },
                reporters: { foo: [out] }
            });

            await server.start();

            monitor.start();

            const res = await server.inject({
                url: '/',
                headers: {
                    'X-Magic-Value': 'rabbits out of hats'
                }
            });

            expect(res.statusCode).to.equal(500);

            await Utils.timeout(50);

            expect(out.data).to.have.length(2);

            const event = out.data[1];
            expect(event.headers['x-magic-value']).to.equal('rabbits out of hats');

            await server.stop();
        });

        it('has a standard "log" data object', { plan: 4 }, async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    server.log(['user', 'success'], 'route route called');

                    return 'ok';
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            await server.start();

            monitor.start();

            const res = await server.inject({
                url: '/'
            });

            expect(res.statusCode).to.equal(200);

            await Utils.timeout(50);

            expect(out.data).to.have.length(2);

            const event = out.data[0];
            const request = out.data[1];

            expect(event).to.be.an.instanceof(Utils.ServerLog);
            expect(request.id).to.be.a.string();

            await server.stop();
        });

        it('has a standard "request" event schema', { plan: 4 }, async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    request.log(['user', 'test'], 'you called the / route');

                    return 'ok';
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, { reporters: { foo: [out] } });

            await server.start();

            monitor.start();

            const res = await server.inject({
                url: '/'
            });

            expect(res.statusCode).to.equal(200);

            await Utils.timeout(50);

            expect(out.data).to.have.length(2);

            const event = out.data[0];

            expect(event).to.be.an.instanceof(Utils.RequestLog);

            expect(event.id).to.be.a.string();

            await server.stop();
        });

        it('includes headers in data object if so configured', { plan: 3 }, async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    request.log(['user', 'test'], 'you called the / route');

                    return 'ok';
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                includes: {
                    request: ['headers'],
                    response: []
                },
                reporters: { foo: [out] }
            });

            await server.start();

            monitor.start();

            const res = await server.inject({
                url: '/',
                headers: {
                    'X-TraceID': 'ABCD12345'
                }
            });

            expect(res.statusCode).to.equal(200);

            await Utils.timeout(50);

            expect(out.data).to.have.length(2);

            const event = out.data[1];

            expect(event.headers['x-traceid']).to.equal('ABCD12345');

            await server.stop();
        });

        it('reports extension events when they occur', { plan: 6 }, async () => {

            const server = new Hapi.Server();

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, h) => {

                    // Simulate a new event that might exist down the road
                    server.events.emit('super-secret', {
                        id: 1,
                        foo: 'bar'
                    });

                    server.events.emit('super-secret', null);

                    return 'ok';
                }
            });

            const out = new GoodReporter.Writer(true);
            const monitor = internals.monitorFactory(server, {
                reporters: {
                    foo: [new GoodReporter.Cleaner('timestamp'), out]
                },
                extensions: ['start', 'stop', { name: 'request', channels: ['internal'] }, 'super-secret']
            });

            monitor.start();

            await server.start();

            await server.inject({
                url: '/'
            });

            await server.stop();

            await Utils.timeout(100);

            expect(out.data).to.have.length(5);

            expect(out.data[0].event).to.equal('start');

            expect(out.data[1]).to.equal({
                event: 'super-secret',
                payload: [{
                    id: 1,
                    foo: 'bar'
                }]
            });

            expect(out.data[2]).to.equal({
                event: 'super-secret',
                payload: [null]
            });

            expect(out.data[3].event).to.equal('response');

            expect(out.data[4].event).to.equal('stop');

        });

        it('attaches good data from the request.plugins.good and route good config to reporting objects', { plan: 3 }, async () => {

            const server = new Hapi.Server();

            server.route({
                path: '/',
                method: 'GET',
                config: {
                    handler(request, h) {

                        request.plugins.good = {
                            foo: 'baz',
                            filter: true
                        };

                        request.log(['test', { test: true }]);

                        return 'ok';
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

            monitor.start();

            const res = await server.inject({
                url: server.info.uri
            });

            expect(res.statusCode).to.equal(200);

            await Utils.timeout(50);

            expect(out.data[0].config).to.equal({
                foo: 'baz',
                filter: true,
                zip: 'zap'
            });
            expect(out.data[1].config).to.equal({
                foo: 'baz',
                filter: true,
                zip: 'zap'
            });
        });

        it('can communicate with process.stdout and process.stderr', { plan: 6 }, async () => {

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

            monitor.start();

            monitor.startOps(100);

            await Utils.timeout(250);

            monitor.stop();

            process.stdout.write = write;
            process.stderr.write = err;

            expect(writeData.length).to.be.above(1);
            expect(writeData[0]).to.include(['event', 'timestamp', 'host', 'pid', 'os', 'proc', 'load']);
            expect(writeData[0].name).to.equal('foo');

            expect(errData.length).to.be.above(1);
            expect(errData[0]).to.include(['event', 'timestamp', 'host', 'pid', 'os', 'proc', 'load']);
            expect(errData[0].name).to.equal('bar');

        });
    });
});
