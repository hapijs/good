'use strict';

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Oppsy = require('oppsy');

const Good = require('../lib');
const GoodReporter = require('./fixtures/reporters');
const Monitor = require('../lib/monitor');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const { expect } = Code;


internals.reporters = {
    foo: [
        new GoodReporter.Incrementer(10, 5),
        new GoodReporter.Stringify(),
        new GoodReporter.Writer()
    ]
};


describe('good', () => {

    it('starts the Monitor object during registration', { plan: 1 }, async () => {

        const plugin = {
            plugin: Good,
            options: {
                reporters: internals.reporters
            }
        };
        const server = new Hapi.Server();
        let called = false;
        const start = Monitor.prototype.start;
        Monitor.prototype.start = function () {

            called = true;

            return start.call(this);
        };

        await server.register(plugin);

        expect(called).to.be.true();
    });

    it('starts the ops monitor when the server starts', { plan: 1 }, async () => {

        const plugin = {
            plugin: Good,
            options: {
                reporters: internals.reporters,
                ops: {
                    interval: 2000
                }
            }
        };
        const server = new Hapi.Server();
        const start = Oppsy.prototype.start;

        await server.register(plugin);

        Oppsy.prototype.start = (interval) => {

            Oppsy.prototype.start = start;
            expect(interval).to.equal(2000);
        };

        await server.start();
    });

    it('stops the monitor when the server stops', { plan: 1 }, async () => {

        const plugin = {
            plugin: Good,
            options: {
                reporters: internals.reporters
            }
        };
        const server = new Hapi.Server();
        let called = false;
        const stop = Monitor.prototype.stop;
        Monitor.prototype.stop = function () {

            called = true;

            return stop.call(this);
        };

        await server.register(plugin);

        await server.stop();

        expect(called).to.be.true();
    });

    it('supports a mix of reporter options', async () => {

        const plugin = {
            plugin: Good,
            options: {
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

        await server.register(plugin);
    });

    it('allows starting with no reporters', async () => {

        const server = new Hapi.Server();

        await server.register(Good);
    });

    it('throws an error if invalid extension events are used', { plan: 1 }, async () => {

        const plugin = {
            plugin: Good,
            options: {
                extensions: ['response']
            }
        };

        const server = new Hapi.Server();
        await expect(server.register(plugin)).to.reject(/contains an invalid value/);
    });
});
