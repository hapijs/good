// Load modules

var Code = require('code');
var Events = require('events');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Http = require('http');
var Lab = require('lab');
var Stream = require('stream');
var NetworkMonitor = require('../lib/network');
var GoodReporter = require('good-reporter');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Code.expect;
var describe = lab.describe;
var it = lab.it;


describe('Network Monitor', function () {

    it('handle no port info', function (done) {

        var server = {
            _connections: {
                'ip:123': {},
                'ip:1234': {}
            }
        };

        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request = { server: server, info: { received: Date.now() - 1 }, url: { pathname: '/' }, response: { statusCode: 200 }, getLog: function () { return []; } };
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('response', request);

        network.concurrents(function (err, result) {

            expect(result['0']).to.equal(2);
        });

        network.requests(function (err, result) {

            expect(result['0'].total).to.equal(2);
        });

        done();
    });

    it('handles no tags', function (done) {

        var server = {
            info: { port: 80 },
            _connections: {
                'ip:123': {},
                'ip:1234': {}
            }
        };
        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var request = { server: server, url: { pathname: '/' } };
        emitter.emit('request', request, {});
        emitter.emit('request', request, {});

        network.requests(function (err, result) {

            expect(result['80']).to.not.exist();
        });

        done();
    });

    it('tracks requests and concurrents total since last check', function (done) {

        var server = {
            info: { port: 80 },
            _connections: {
                'ip:123': {},
                'ip:1234': {}
            }
        };
        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request = { server: server, url: { pathname: '/' } };
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('request', request, { tags: tags }, tagsMap);

        network.requests(function (err, result) {

            expect(result['80'].total).to.equal(2);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(2);
        });

        done();
    });

    it('handles undefined connections', function (done) {

        var server = {
            info: { port: 80 }
        };
        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request = { server: server, url: { pathname: '/' } };
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('request', request, { tags: tags }, tagsMap);

        network.requests(function (err, result) {

            expect(result['80'].total).to.equal(2);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(0);
        });

        done();
    });

    it('tracks requests by server', function (done) {

        var server1 = {
            info: { port: 80 },
            _connections: {
                'ip:123': {}
            }
        };
        var server2 = {
            info: { port: 443 },
            _connections: {
                'ip:123': {},
                'ip:1234': {},
                'ip:12345': {}
            }
        };

        var getLog = function () {

            return [];
        };

        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request1 = { server: server1, info: { received: Date.now() - 1 }, url: { pathname: '/' }, response: { statusCode: 200 }, getLog: getLog };
        var request2 = { server: server2, info: { received: Date.now() - 2 }, url: { pathname: '/test' }, response: { statusCode: 200 }, getLog: getLog };

        emitter.emit('request', request1, { tags: tags }, tagsMap);
        emitter.emit('request', request1, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('response', request1);
        request1.info.received -= 2;
        emitter.emit('response', request1);
        emitter.emit('response', request2);

        network.requests(function (err, result) {

            expect(result['80'].total).to.equal(2);
            expect(result['443'].total).to.equal(3);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(1);
            expect(result['443']).to.equal(3);
        });

        network.responseTimes(function (err, result) {

            expect(result['80'].max).to.be.at.least(3);
            expect(result['80'].avg).to.be.at.least(2);
            expect(result['443'].max).to.be.at.least(2);
            expect(result['443'].avg).to.be.at.least(2);
        });

        done();
    });

    it('tracks server disconnects', function (done) {

        var TestStream = function () {

            Stream.Readable.call(this);
        };

        Hoek.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            var self = this;

            if (this.isDone) {
                return;
            }

            this.isDone = true;

            setTimeout(function () { self.push('Hello'); }, 10);
            setTimeout(function () { self.push(null); }, 50);
        };

        var staticPort = 9001;
        var server = new Hapi.Server(0, staticPort);
        server.route({
            method: 'POST',
            path: '/',
            handler: function (request, reply) {

                reply(new TestStream());
            }
        });

        var options = {};
        var one = new GoodReporter({
            ops: '*'
        });

        one._report = function (event, eventData) {

            var log = eventData.load.requests;

            expect(log[staticPort]).to.deep.equal({
                total: 1,
                disconnects: 1,
                statusCodes: {
                    '200': 1
                }
            });

            return done();
        };

        options.reporters = [one];
        options.opsInterval = 1000;

        var plugin = {
            plugin: require('..'),
            options: options
        };

        server.pack.register(plugin, function () {

            server.start(function () {

                var options = {
                    hostname: '127.0.0.1',
                    port: staticPort,
                    path: '/',
                    method: 'POST'
                };

                var req = Http.request(options, function (res) {

                    req.destroy();
                });

                req.end('{}');
            });
        });
    });

    it('_onResponse() sets the set count, total, and max time on each port', function (done) {

        var request1 = {
            server: {
                info: {
                    port: 1337
                }
            },
            info: {
                received: Date.now() - 2
            },
            response: {
                statusCode: 200
            },
            getLog: function () { return []; }
        };
        var request2 = {
            server: {
                info: {
                    port: 31337
                }
            },
            info: {
                received: Date.now()
            },
            response: {
                statusCode: 200
            },
            getLog: function () { return []; }
        };

        var context = {
            _responseTimes: {
                1337: null,
                31337: {
                    max: 10000,
                    count: 5,
                    total: 20
                }
            },
            _requests: {
                1337: {
                    statusCodes: {}
                },
                31337: {
                    statusCodes: {}
                }
            }
        };

        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        network._onResponse.call(context, request1);
        network._onResponse.call(context, request2);

        expect(context._responseTimes[31337].max).to.equal(10000);
        expect(context._responseTimes[31337].count).to.equal(6);

        expect(context._responseTimes[1337].count).to.equal(1);
        expect(context._requests[1337].max).to.equal(context._requests[1337].total);

        done();


    });
});
