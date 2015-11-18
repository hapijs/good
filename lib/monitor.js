'use strict';

// Load modules

const Events = require('events');
const Os = require('os');
const Stream = require('stream');

const Hoek = require('hoek');
const Items = require('items');
const Oppsy = require('oppsy');
const Wreck = require('wreck');

const Package = require('../package.json');
const Schema = require('./schema');
const Utils = require('./utils');


// Declare internals

const internals = {
    host: Os.hostname(),
    appVer: Package.version
};


internals.defaults = {
    responseEvent: 'tail',
    requestHeaders: false,
    requestPayload: false,
    responsePayload: false,
    extensions: [],
    reporters: [],
    ops: {
        interval: 15000
    },
    filter: {}
};

class Monitor extends Events.EventEmitter {
    constructor(server, options) {

        super();
        options = options || {};
        options = Hoek.applyToDefaultsWithShallow(internals.defaults, options, ['reporters']);

        this.settings = options;
        this._state = {
            handlers: {},
            extensions: {}
        };
        this._server = server;
        this._dataStream = new Stream.Readable({ objectMode: true });
        this._dataStream._read = () => {};

        // Options used to create Great Response
        this._responseOptions = {
            requestHeaders: this.settings.requestHeaders,
            requestPayload: this.settings.requestPayload,
            responsePayload: this.settings.responsePayload
        };

        // Validate settings
        Schema.assert('monitorOptions', this.settings);

        this._ops = new Oppsy(server, options.ops.config);

        // Event handlers

        this._requestLogHandler = (request, event) => {

            this._dataStream.push(new Utils.GreatRequest(request, event));
        };

        this._logHandler = (event) => {

            this._dataStream.push(new Utils.GreatLog(event));
        };

        this._errorHandler = (request, error) => {

            this._dataStream.push(new Utils.GreatError(request, error));
        };

        this._responseHandler = (request) => {

            this._dataStream.push(new Utils.GreatResponse(request, this._responseOptions, this.settings.filter));
        };

        this._opsHandler = (results) => {

            this._dataStream.push(new Utils.GreatOps(results));
        };

        this._wreckHandler = (error, request, response, start, uri) => {

            this._dataStream.push(new Utils.GreatWreck(error, request, response, start, uri));
        };

        this._extensionHandler = function (eventName) {

            let event;
            // (eventName, request, event, tags)
            if (arguments.length === 4) {
                event = Object.assign({}, arguments[2]);
            }
            else {
                event = Object.assign({}, arguments[1]);
            }
            event.event = eventName;
            this._dataStream.push(Object.freeze(event));
        };
    }

    start(callback) {

        let reporterIndex = 0;

        Items.serial(this.settings.reporters, (item, next) => {

            let reporter;

            // Use hint of reporter index
            let errorHint = `reporter [${reporterIndex}]`;
            reporterIndex++;

            // If it has a reporter constructor, then create a new one, otherwise, assume it is
            // a valid pre-constructed reporter
            if (item.reporter) {

                // If the supply a path or module node, try to load it
                if (typeof item.reporter === 'string') {
                    item.reporter = require(item.reporter);
                }

                // attempt to upgrade hint to reporter name
                const reachOptions = {
                    functions: true
                };
                let reporterName = Hoek.reach(item, 'reporter.attributes.name', reachOptions);
                reporterName = reporterName || Hoek.reach(item, 'reporter.attributes.pkg.name', reachOptions);
                errorHint = reporterName || errorHint;

                Hoek.assert(typeof item.reporter === 'function', errorHint, 'must be a constructor function');
                Hoek.assert(typeof item.events === 'object', errorHint, 'must specify events to filter on');

                const Reporter = item.reporter;

                reporter = new Reporter(item.events, item.config);
            }
            else {
                reporter = item;
            }

            Hoek.assert(reporter.init, errorHint, 'must have an init method');
            reporter.init(this._dataStream, this, next);
        }, (error) => {

            if (error) {
                return callback(error);
            }

            this._state.wreckHandler = this._wreckHandler;

            this._state.handlers.log = this._logHandler;
            this._state.handlers['request-error'] = this._errorHandler;
            this._state.handlers[this.settings.responseEvent] = this._responseHandler;
            this._state.handlers.request = this._requestLogHandler;

            // Initialize Events
            internals.iterateOverEventHash(this._state.handlers, (event, handler) => {

                this._server.on(event, handler);
            });

            this._ops.on('ops', this._opsHandler);
            this._ops.on('error', (err) => {

                console.error(err);
            });
            Wreck.on('response', this._state.wreckHandler);
            this._ops.start(this.settings.ops.interval);

            // Events can not be any of ['log', 'request-error', 'ops', 'request', 'response', 'tail']
            for (let i = 0; i < this.settings.extensions.length; ++i) {
                const event = this.settings.extensions[i];

                this._state.extensions[event] = this._extensionHandler.bind(this, event);
                this._server.on(this.settings.extensions[i], this._state.extensions[event]);
            }

            return callback();
        });
    }
    stop() {

        const state = this._state;

        Wreck.removeListener('response', state.wreckHandler);
        this._ops.stop();

        internals.iterateOverEventHash(state.handlers, (event, handler) => {

            this._server.removeListener(event, handler);
        });

        internals.iterateOverEventHash(state.extensions, (event, handler) => {

            this._server.removeListener(event, handler);
        });

        this.emit('stop');
    }
}

module.exports = Monitor;

internals.iterateOverEventHash = function (hash, predicate) {

    const keys = Object.keys(hash);
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        predicate(key, hash[key]);
    }
};
