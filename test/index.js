// Load modules
var Http = require('http');
var Https = require('https');
var Code = require('code');
var GoodReporter = require('good-reporter');
var Hapi = require('hapi');
var Lab = require('lab');

// Declare internals

var internals = {
    agent: new Https.Agent({ maxSockets: 6 })
};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Code.expect;
var describe = lab.describe;
var it = lab.it;


describe('Plugin', function () {

    it('emits ops data', function (done) {

        var server = new Hapi.Server();

        var options = {
            opsInterval: 100,
            httpAgents: new Http.Agent(),
            httpsAgents: new Https.Agent()
        };
        var one = new GoodReporter({
            events: {
                ops: '*'
            }
        });

        one._report = function (event, eventData) {

            expect(event).to.equal('ops');
            expect(eventData.event).to.equal('ops');
            expect(eventData.host).to.exist();
        };

        options.reporters = [one];

        var plugin = {
           register: require('..'),
           options: options
        };

        server.register(plugin, function (err) {

            expect(err).to.not.exist();

            server.plugins.good.monitor.once('ops', function (event) {

                expect(event.osload).to.exist();
                done();
            });
        });
    });

    it('tracks used sockets', function (done) {

        var server = new Hapi.Server();

        server.connection({ host: 'localhost'});

        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                Https.get({
                    hostname: 'www.google.com',
                    port: 433,
                    path: '/',
                    agent: internals.agent
                });
            }
        });

        var options = {
            opsInterval: 1000,
            httpsAgents: internals.agent
        };
        var one = new GoodReporter({
            events: {
                ops: '*'
            }
        });

        one._report = function () {};

        options.reporters = [one];


        var plugin = {
            register: require('..'),
            options: options
        };

        server.register(plugin, function (err) {

            expect(err).to.not.exist();

            server.plugins.good.monitor.once('ops', function (event) {

                expect(event.host).to.exist();
                expect(event.sockets).to.exist();
                expect(event.sockets.https.total).to.equal(6);

                done();
            });

            for (var i = 0; i < 10; ++i) {
               server.inject({ url: '/'});
            }
        });
    });
});
