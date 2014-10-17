// Load modules
var Http = require('http');
var Https = require('https');
var Lab = require('lab');
var Hapi = require('hapi');
var GoodReporter = require('good-reporter');



// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Lab.expect;
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
            expect(eventData.host).to.exist;
        };

        options.reporters = [one];


        var plugin = {
           plugin: require('..'),
           options: options
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;

            server.plugins.good.monitor.once('ops', function (event) {

                expect(event.osload).to.exist;
                done();
            });
        });
    });

    it('tracks used sockets', function (done) {

        var server = new Hapi.Server('localhost', 0);

        server.route({
            method: 'GET',
            path: '/',
            handler: function (request, reply) {

                Https.get('https://www.google.com');
            }
        });

        var options = {
            opsInterval: 1000
        };
        var one = new GoodReporter({
            events: {
                ops: '*'
            }
        });
        var hitCount = 0;

        one._report = function () {};

        options.reporters = [one];


        var plugin = {
            plugin: require('..'),
            options: options
        };

        server.pack.register(plugin, function (err) {

            expect(err).to.not.exist;

            server.plugins.good.monitor.once('ops', function (event) {

                expect(event.host).to.exist;
                expect(event.sockets).to.exist;
                expect(event.sockets.http.total).to.equal(5);

                done();
            });

            server.start(function() {

                for (var i = 0; i < 10; ++i) {
                    Http.get(server.info.uri + '/');
                }
            });
        });
    });
});
