'use strict';

// Load modules

const Os = require('os');

const Hoek = require('hoek');
const Oppsy = require('oppsy');
const Pumpify = require('pumpify');

const Package = require('../package.json');
const Utils = require('./utils');


// Declare internals

const internals = {
    host: Os.hostname(),
    appVer: Package.version
};

class Monitor {
    constructor(server, options) {

        this.settings = options;
        this._state = {
            handlers: {},
            extensions: {}
        };
        this._server = server;

        const reducer = (obj, value) => {

            obj[value] = true;
            return obj;
        };

        const reqOptions = this.settings.includes.request.reduce(reducer, {});
        const resOptions = this.settings.includes.response.reduce(reducer, {});

        this._reporters = {};

        this._ops = this.settings.ops && new Oppsy(server, this.settings.ops.config);

        // Event handlers

        this._requestLogHandler = (request, event) => {

            this.push(() => new Utils.RequestLog(request, event));
        };

        this._logHandler = (event) => {

            this.push(() => new Utils.ServerLog(event));
        };

        this._errorHandler = (request, error) => {

            this.push(() => new Utils.RequestError(request, error));
        };

        this._responseHandler = (request) => {

            this.push(() => new Utils.RequestSent(reqOptions, resOptions, request));
        };

        this._opsHandler = (results) => {

            this.push(() => new Utils.Ops(results));
        };

        this._extensionHandler = function () {

            const args = Array(arguments.length);
            for (let i = 0; i < arguments.length; ++i) {
                args[i] = arguments[i];
            }
            const event = {
                event: args.shift(),
                timestamp: Date.now(),
                payload: args
            };
            this.push(() => Object.assign({}, event));
        };
    }

    startOps(interval) {

        this._ops && this._ops.start(interval);
    }

    start(callback) {

        internals.forOwn(this.settings.reporters, (reporterName, streamsSpec) => {

            const streamObjs = [];
            for (let i = 0; i < streamsSpec.length; ++i) {
                const spec = streamsSpec[i];

                // Already created stream
                if (typeof spec.pipe === 'function') {
                    streamObjs.push(spec);
                    continue;
                }

                // if this is stderr or stdout
                if (process[spec]) {
                    streamObjs.push(process[spec]);
                    continue;
                }

                let Ctor = require(spec.module);
                Ctor = spec.name ? Ctor[spec.name] : Ctor;
                Hoek.assert(typeof Ctor === 'function', `Error in ${reporterName}. ${spec.module} must be a constructor function.`);

                const ctorArgs = spec.args ? spec.args.slice() : [];
                ctorArgs.unshift(null);

                Ctor = Ctor.bind.apply(Ctor, ctorArgs);
                const stream = new Ctor();
                Hoek.assert(typeof stream.pipe === 'function', `Error in ${reporterName}. ${spec.module} must create a stream that has a pipe function.`);

                streamObjs.push(stream);
            }

            if (streamObjs.length === 1) {
                streamObjs.unshift(new Utils.NoOp());
            }

            this._reporters[reporterName] = Pumpify.obj(streamObjs);
            this._reporters[reporterName].on('error', (err) => {

                console.error(`There was a problem (${err}) in ${reporterName} and it has been destroyed.`);
            });
        });

        this._state.handlers.log = this._logHandler;
        this._state.handlers['request-error'] = this._errorHandler;
        this._state.handlers[this.settings.responseEvent] = this._responseHandler;
        this._state.handlers.request = this._requestLogHandler;

        // Initialize Events
        internals.forOwn(this._state.handlers, (event, handler) => {

            this._server.on(event, handler);
        });

        if (this._ops) {
            this._ops.on('ops', this._opsHandler);
            this._ops.on('error', (err) => {

                console.error(err);
            });
        }

        // Events can not be any of ['log', 'request-error', 'ops', 'request', 'response', 'tail']
        for (let i = 0; i < this.settings.extensions.length; ++i) {
            const event = this.settings.extensions[i];
            const handler = this._extensionHandler.bind(this, event);

            this._state.extensions[event] = handler;
            this._server.on(this.settings.extensions[i], handler);
        }

        return callback();
    }
    stop(callback) {

        const state = this._state;

        if (this._ops) {

            this._ops.stop();
            this._ops.removeAllListeners();
        }

        internals.forOwn(state.handlers, (event, handler) => {

            this._server.removeListener(event, handler);
        });

        internals.forOwn(state.extensions, (event, handler) => {

            this._server.removeListener(event, handler);
        });

        internals.forOwn(this._reporters, (name, reporter) => {

            reporter.end();
        });

        // Do a setImmediate here so that all the streams listening for "end" have a chance to run
        // https://github.com/nodejs/node/blob/master/lib/_stream_readable.js#L894-L897
        setImmediate(callback);
    }
    push(value) {

        internals.forOwn(this._reporters, (name, reporter) => {

            reporter.write(value());
        });
    }
}

module.exports = Monitor;

internals.forOwn = (obj, func) => {

    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        func(key, obj[key]);
    }
};
