'use strict';

// Load modules

var Events = require('events');
var Os = require('os');
var Stream = require('stream');

var Hoek = require('hoek');
var Items = require('items');
var Oppsy = require('oppsy');
var Wreck = require('wreck');

var Package = require('../package.json');
var Schema = require('./schema');
var Utils = require('./utils');


// Declare internals

var internals = {
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


module.exports = internals.Monitor = function (server, options) {

    options = options || {};

    Hoek.assert(this instanceof internals.Monitor, 'Monitor must be instantiated using new');
    Hoek.assert(server, 'server required to create monitor');

    options = Hoek.applyToDefaultsWithShallow(internals.defaults, options, ['reporters']);

    this.settings = options;
    this._state = {
        handlers: {},
        extensions: {}
    };
    this._server = server;
    this._dataStream = new Stream.Readable({ objectMode: true });
    this._dataStream._read = Hoek.ignore;

    // Options used to create Great Response
    this._responseOptions = {
        requestHeaders: this.settings.requestHeaders,
        requestPayload: this.settings.requestPayload,
        responsePayload: this.settings.responsePayload
    };

    // Validate settings
    Schema.assert('monitorOptions', this.settings);

    this._ops = new Oppsy(server, options.ops.config);

    // Register as event emitter
    Events.EventEmitter.call(this);
};

Hoek.inherits(internals.Monitor, Events.EventEmitter);


internals.Monitor.prototype.start = function (callback) {

    var self = this;
    var reporterIndex = 0;

    Items.serial(this.settings.reporters, function (item, next) {

        var reporter;

        // Use hint of reporter index
        var errorHint = 'reporter [' + reporterIndex + ']';
        reporterIndex++;

        // If it has a reporter constructor, then create a new one, otherwise, assume it is
        // a valid pre-constructed reporter
        if (item.reporter) {

            // If the supply a path or module node, try to load it
            if (typeof item.reporter === 'string') {
                item.reporter = require(item.reporter);
            }

            // attempt to upgrade hint to reporter name
            var reachOptions = {
                functions: true
            };
            var reporterName = Hoek.reach(item, 'reporter.attributes.name', reachOptions);
            reporterName = reporterName || Hoek.reach(item, 'reporter.attributes.pkg.name', reachOptions);
            errorHint = reporterName || errorHint;

            Hoek.assert(typeof item.reporter === 'function', errorHint, 'must be a constructor function');
            Hoek.assert(typeof item.events === 'object', errorHint, 'must specify events to filter on');

            var Reporter = item.reporter;

            reporter = new Reporter(item.events, item.config);
        }
        else {
            reporter = item;
        }

        Hoek.assert(reporter.init, errorHint, 'must have an init method');
        reporter.init(self._dataStream, self, next);
    }, function (error) {

        if (error) {
            return callback(error);
        }

        self._state.wreckHandler = self._wreckHandler.bind(self);

        self._state.handlers.log = self._logHandler.bind(self);
        self._state.handlers['request-error'] = self._errorHandler.bind(self);
        self._state.handlers[self.settings.responseEvent] = self._responseHandler.bind(self);
        self._state.handlers.request = self._requestLogHandler.bind(self);

        // Initialize Events
        internals.iterateOverEventHash(self._state.handlers, function (event, handler) {

            self._server.on(event, handler);
        });

        self._ops.on('ops', self._opsHandler.bind(self));
        self._ops.on('error', function (err) {

            console.error(err);
        });
        Wreck.on('response', self._state.wreckHandler);
        self._ops.start(self.settings.ops.interval);

        // Events can not be any of ['log', 'request-error', 'ops', 'request', 'response', 'tail']
        for (var i = 0, il = self.settings.extensions.length; i < il; ++i) {
            var event = self.settings.extensions[i];

            self._state.extensions[event] = self._extensionHandler.bind(self, event);
            self._server.on(self.settings.extensions[i], self._state.extensions[event]);
        }

        return callback();
    });
};


internals.Monitor.prototype.stop = function () {

    var self = this;
    var state = this._state;

    Wreck.removeListener('response', state.wreckHandler);
    self._ops.stop();

    internals.iterateOverEventHash(state.handlers, function (event, handler) {

        self._server.removeListener(event, handler);
    });

    internals.iterateOverEventHash(state.extensions, function (event, handler) {

        self._server.removeListener(event, handler);
    });

    this.emit('stop');
};


internals.Monitor.prototype._requestLogHandler = function (request, event) {

    this._dataStream.push(Utils.GreatRequest(request, event));
};


internals.Monitor.prototype._logHandler = function (event) {

    this._dataStream.push(Utils.GreatLog(event));
};


internals.Monitor.prototype._errorHandler = function (request, error) {

    this._dataStream.push(Utils.GreatError(request, error));
};


internals.Monitor.prototype._responseHandler = function (request) {

    this._dataStream.push(Utils.GreatResponse(request, this._responseOptions, this.settings.filter));
};


internals.Monitor.prototype._opsHandler = function (results) {

    this._dataStream.push(Utils.GreatOps(results));
};


internals.Monitor.prototype._wreckHandler = function (error, request, response, start, uri) {

    this._dataStream.push(Utils.GreatWreck(error, request, response, start, uri));
};


internals.Monitor.prototype._extensionHandler = function (eventName) {

    var event;
    // (eventName, request, event, tags)
    if (arguments.length === 4) {
        event = arguments[2] || {};
    }
    else {
        event = arguments[1] || {};
    }
    event.event = eventName;
    this._dataStream.push(Object.freeze(event));
};

internals.iterateOverEventHash = function (hash, predicate) {

    var keys = Object.keys(hash);
    for (var k = 0, kl = keys.length; k < kl; ++k) {
        var key = keys[k];
        predicate(key, hash[key]);
    }
};
