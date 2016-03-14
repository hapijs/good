'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Oppsy = require('oppsy');

const Good = require('../lib');
const GoodReporter = require('./fixtures/reporters');
const Monitor = require('../lib/monitor');

const reporters = {
    foo: [{
        module: '../test/fixtures/reporters',
        name: 'Incrementer',
        args: [10, 5]
    }, {
        module: '../test/fixtures/reporters',
        name: 'Stringify'
    }, {
        module: '../test/fixtures/reporters',
        name: 'Writer'
    }]
};


// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;


describe('good', () => {

    it('starts the Monitor object during registration', { plan: 2 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                reporters
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

    it('starts the ops monitor when the server starts', { plan: 2 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                reporters,
                ops: {
                    interval: 2000
                }
            }
        };
        const server = new Hapi.Server();
        const start = Oppsy.prototype.start;

        server.register(plugin, (err) => {

            expect(err).to.not.exist();
            Oppsy.prototype.start = (interval) => {

                Oppsy.prototype.start = start;
                expect(interval).to.equal(2000);
            };
            server.connection();
            server.start(done);
        });
    });

    it('stops the monitor when the server stops', { plan: 2 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                reporters
            }
        };
        const server = new Hapi.Server();
        let called = false;
        const stop = Monitor.prototype.stop;
        Monitor.prototype.stop = (callback) => {

            Monitor.prototype.stop = stop;
            called = true;
            return callback();
        };


        server.register(plugin, (err) => {

            expect(err).to.not.exist();

            server.stop(() => {

                expect(called).to.be.true();
                done();
            });
        });
    });

    it('throws an error if responseEvent is not "response" or "tail"', { plan: 1 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                responseEvent: 'foobar'
            }
        };
        const server = new Hapi.Server();

        expect(() => {

            server.register(plugin, () => {});
        }).to.throw(Error, /"responseEvent" must be one of \[response, tail\]/gi);
        done();
    });

    it('supports a mix of reporter options', { plan: 1 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                responseEvent: 'response',
                reporters: {
                    foo: [
                        new GoodReporter.Incrementer(2),
                        new GoodReporter.Incrementer(4), {
                            module: '../test/fixtures/reporters',
                            name: 'Writer',
                            args: [{ objectMode: true }]
                        }
                    ]
                }
            }
        };

        const server = new Hapi.Server();

        expect(() => {

            server.register(plugin, done);
        }).to.not.throw();
    });

    it('allows starting with no reporters', { plan: 1 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                responseEvent: 'response'
            }
        };

        const server = new Hapi.Server();

        expect(() => {

            server.register(plugin, done);
        }).to.not.throw();
    });

    it('throws an error if invalid extension events are used', { plan: 1 }, (done) => {

        const plugin = {
            register: Good.register,
            options: {
                extensions: ['tail']
            }
        };
        const server = new Hapi.Server();

        expect(() => {

            server.register(plugin, () => {});
        }).to.throw(Error, 'Invalid monitorOptions options child "extensions" fails because ["extensions" at position 0 fails because ["0" contains an invalid value]]');
        done();
    });
});
