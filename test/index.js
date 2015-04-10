// Load modules

var Code = require('code');
var Hapi = require('hapi');
var Hoek = require('hoek');
var Http = require('http');
var Https = require('https');
var Lab = require('lab');
var Wreck = require('wreck');

// Done for testing because Wreck is a singleton and every test run ads one event to it
Wreck.setMaxListeners(0);

var GoodReporter = require('./helper');


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
        var one = new GoodReporter({ ops: '*' });
        options.reporters = [one];

        var plugin = {
           register: require('..'),
           options: options
        };

        server.register(plugin, function (err) {

            expect(err).to.not.exist();

            server.plugins.good.monitor.once('ops', function (event) {

                expect(event.osload).to.exist();
                expect(one.messages).to.have.length(1);

                var message = one.messages[0];

                expect(message.event).to.equal('ops');
                expect(message.host).to.exist();

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
        var one = new GoodReporter({ ops: '*' });
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

    it('emits wreck data', function (done) {

        var server = new Hapi.Server();
        server.connection({ port: 0});

        server.route({ method: 'GET', path: '/', handler: function (request, reply) {

            reply('ok');
        }});

        var options = {
            httpAgents: new Http.Agent(),
            httpsAgents: new Https.Agent()
        };
        var one = new GoodReporter({
            wreck: '*'
        }, null, function (event) {

            expect(event.event).to.equal('wreck');
            done();
        });

        options.reporters = [one];

        var plugin = {
            register: require('..'),
            options: options
        };

        server.register(plugin, function (err) {

            expect(err).to.not.exist();

            server.start(function () {

                Wreck.get('http://127.0.0.1:' + server.info.port, Hoek.ignore);
            });
        });
    });
});
