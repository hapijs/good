'use strict';

const Os = require('os');

const Hoek = require('hoek');
const Oppsy = require('oppsy');
const Pumpify = require('pumpify');

const Package = require('../package.json');
const Utils = require('./utils');


const internals = {
    host: Os.hostname(),
    appVer: Package.version
};


module.exports = internals.Monitor = class {

    constructor(server, options) {

        this.settings = options;
        this._state = { report: false };
        this._server = server;
        this._reporters = new Map();

        const reducer = (obj, value) => {

            obj[value] = true;
            return obj;
        };

        const reqOptions = this.settings.includes.request.reduce(reducer, {});
        const resOptions = this.settings.includes.response.reduce(reducer, {});

        this._ops = this.settings.ops && new Oppsy(server, this.settings.ops.config);

        // Event handlers

        this._requestLogHandler = (request, event) => {

            this.push(() => new Utils.RequestLog(reqOptions, request, event));
        };

        this._logHandler = (event) => {

            this.push(() => new Utils.ServerLog(event));
        };

        this._errorHandler = (request, error) => {

            this.push(() => new Utils.RequestError(reqOptions, request, error));
        };

        this._responseHandler = (request) => {

            this.push(() => new Utils.RequestSent(reqOptions, resOptions, request, this._server));
        };

        this._opsHandler = (results) => {

            this.push(() => new Utils.Ops(results));
        };
    }

    startOps(interval) {

        this._ops && this._ops.start(interval);
    }

    start() {

        for (const reporterName in this.settings.reporters) {
            const streamsSpec = this.settings.reporters[reporterName];
            if (!streamsSpec.length) {
                continue;
            }

            const streamObjs = [];
            for (let i = 0; i < streamsSpec.length; ++i) {
                const spec = streamsSpec[i];

                // Already created stream

                if (typeof spec.pipe === 'function') {
                    streamObjs.push(spec);
                    continue;
                }

                // If this is stderr or stdout

                if (process[spec]) {
                    streamObjs.push(process[spec]);
                    continue;
                }

                const isFn = typeof spec.module === 'function';
                const moduleName = isFn ? spec.module.name || `The unnamed module at position ${i}` : spec.module;
                let Ctor = isFn ? spec.module : require(spec.module);
                Ctor = spec.name ? Ctor[spec.name] : Ctor;
                Hoek.assert(typeof Ctor === 'function', `Error in ${reporterName}. ${moduleName} must be a constructor function.`);

                const stream = spec.args ? new Ctor(...spec.args) : new Ctor();
                Hoek.assert(typeof stream.pipe === 'function', `Error in ${reporterName}. ${moduleName} must create a stream that has a pipe function.`);

                streamObjs.push(stream);
            }

            if (streamObjs.length === 1) {
                streamObjs.unshift(new Utils.NoOp());
            }

            this._reporters.set(reporterName, Pumpify.obj(streamObjs)).get(reporterName).on('error', (err) => {

                console.error(`There was a problem (${err}) in ${reporterName} and it has been destroyed.`);
                console.error(err);
            });
        }

        this._state.report = true;

        // Initialize Events

        this._server.events.on('log', this._logHandler);
        this._server.events.on({ name: 'request', channels: ['error'] }, this._errorHandler);
        this._server.events.on('response', this._responseHandler);
        this._server.events.on({ name: 'request', channels: ['app'] }, this._requestLogHandler);

        if (this._ops) {
            this._ops.on('ops', this._opsHandler);
            this._ops.on('error', console.error);
        }

        // Events can not be any of ['log', 'ops', 'request', 'response', 'tail']

        for (const event of this.settings.extensions) {
            this._server.events.on(event, (...args) => {

                const payload = {
                    event,
                    timestamp: Date.now(),
                    payload: args
                };

                this.push(() => Object.assign({}, payload));
            });
        }
    }

    stop() {

        this._state.report = false;
        if (this._ops) {

            this._ops.stop();
            this._ops.removeAllListeners();
        }

        for (const reporter of this._reporters.values()) {
            reporter.end();
        }
    }

    push(value) {

        if (this._state.report) {
            for (const reporter of this._reporters.values()) {
                if (reporter.destroyed === false) {
                    reporter.write(value());
                }
            }
        }
    }
};
