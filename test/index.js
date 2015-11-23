'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');

const GoodReporter = require('./helper');
const Monitor = require('../lib/monitor');


// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;


describe('good', () => {

    it('exposes the Monitor object', (done) => {

        const plugin = {
            register: require('../lib/index').register,
            options: {
                reporters: [{
                    reporter: GoodReporter,
                    events: { response: '*' }
                }]
            }
        };
        const server = new Hapi.Server();
        server.register(plugin, (err) => {

            expect(err).to.not.exist();
            expect(server.plugins.good.monitor).to.be.an.object();
            done();
        });
    });

    it('starts the Monitor object during registration', (done) => {

        const plugin = {
            register: require('../lib/index').register,
            options: {
                reporters: [{
                    reporter: GoodReporter,
                    events: { response: '*' }
                }]
            }
        };
        const server = new Hapi.Server();
        let called = false;
        const start = Monitor.prototype.start;
        Monitor.prototype.start = (callback) => {

            Monitor.prototype.start = start;
            called = true;
            callback();
        };

        server.register(plugin, (err) => {

            expect(err).to.not.exist();
            expect(called).to.be.true();
            done();
        });
    });

    it('stops the monitor when the server stops', (done) => {

        const plugin = {
            register: require('../lib/index').register,
            options: {
                reporters: [{
                    reporter: GoodReporter,
                    events: { response: '*' }
                }]
            }
        };
        const server = new Hapi.Server();
        let called = false;
        const stop = Monitor.prototype.stop;
        Monitor.prototype.stop = () => {

            Monitor.prototype.stop = stop;
            called = true;
        };


        server.register(plugin, (err) => {

            expect(err).to.not.exist();

            server.stop(() => {

                expect(called).to.be.true();
                done();
            });
        });
    });
});
