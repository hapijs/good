// Load modules

var Chai = require('chai');
var Hapi = require('hapi');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Plugin', function () {

    it('emits ops data', function (done) {

        var server = new Hapi.Server();

        var options = {
            subscribers: {},
            opsInterval: 100,
            alwaysMeasureOps: true
        };

        server.plugin.require('..', options, function (err) {

            expect(err).to.not.exist;

            server.plugins.good.monitor.once('ops', function (event) {

                expect(event.osload).to.exist;
                done();
            });
        });
    });
});


