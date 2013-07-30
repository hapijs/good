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
        emitter.emit('request', null, { tags: tags }, tagsMap);
        emitter.emit('request', null, { tags: tags }, tagsMap);
        emitter.emit('response');

        network.requests(function (err, result) {

            expect(result).to.equal(2);
        });

        network.concurrents(function (err, result) {

            expect(result).to.equal(1);
        });

        done();
    });
});