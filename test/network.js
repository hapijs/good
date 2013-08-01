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

        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request = { server: { info: { port: 80 }}}
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('response', request);

        network.requests(function (err, result) {

            expect(result['80']).to.equal(2);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(1);
        });

        done();
    });

    it('defaults to port 0 when server info isn\'t set', function (done) {

        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request = { server: {}}
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('request', request, { tags: tags }, tagsMap);
        emitter.emit('response', request);

        network.requests(function (err, result) {

            expect(result['0']).to.equal(2);
        });

        network.concurrents(function (err, result) {

            expect(result['0']).to.equal(1);
        });

        done();
    });

    it('tracks requests by server', function (done) {

        var emitter = new Events.EventEmitter();
        var network = new NetworkMonitor.Monitor(emitter);

        var tags = ['hapi', 'received'];
        var tagsMap = Hoek.mapToObject(tags);
        var request1 = { server: { info: { port: 80 }}}
        var request2 = { server: { info: { port: 443 }}}
        emitter.emit('request', request1, { tags: tags }, tagsMap);
        emitter.emit('request', request1, { tags: tags }, tagsMap);
        emitter.emit('response', request1);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);
        emitter.emit('request', request2, { tags: tags }, tagsMap);

        network.requests(function (err, result) {

            expect(result['80']).to.equal(2);
            expect(result['443']).to.equal(3);
        });

        network.concurrents(function (err, result) {

            expect(result['80']).to.equal(1);
            expect(result['443']).to.equal(3);
        });

        done();
    });
});