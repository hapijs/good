// Load modules

var Lab = require('lab');
var Hoek = require('hoek');
var Events = require('events');
var NetworkMonitor = require('../lib/network');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Network Monitor', function () {

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
        var request = { server: server };
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('request', request, { tags: tags }, tagsMap);

        network.requests(function (err, result) {

            expect(result['80']).to.equal(2);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(2);
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
        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request1 = { server: server1, msec: 1 };
        var request2 = { server: server2, msec: 2 };
        emitter.emit('request', request1, { tags: tags }, tagsMap);
        emitter.emit('request', request1, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('response', request1);
        request1.msec = 3;
        emitter.emit('response', request1);
        emitter.emit('response', request2);

        network.requests(function (err, result) {

            expect(result['80']).to.equal(2);
            expect(result['443']).to.equal(3);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(1);
            expect(result['443']).to.equal(3);
        });

        network.responseTimes(function (err, result) {

            expect(result['80'].max).to.equal(3);
            expect(result['80'].avg).to.equal(2);
            expect(result['443'].max).to.equal(2);
            expect(result['443'].avg).to.equal(2);
        });

        done();
    });
});