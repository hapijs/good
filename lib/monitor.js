// Load modules

var Events = require('events');
var Http = require('http');
var Https = require('https');
var Os = require('os');
var Hoek = require('hoek');
var Items = require('items');
var Network = require('./network');
var Package = require('../package.json');
var ProcessMonitor = require('./process');
var Schema = require('./schema');
var System = require('./system');

// Declare internals

var internals = {
    host: Os.hostname(),
    appVer: Package.version
};


internals.defaults = {
    opsInterval: 15000,                             // MSec, equal to or greater than 100
    responseEvent: 'tail',                          // Sets the event used by the monitor to listen to finished requests. Other options: 'response'.
    logRequestHeaders: false,                       // log all headers on request
    logRequestPayload: false,                       // log payload of request
    logResponsePayload: false                       // log payload of response
};


module.exports = internals.Monitor = function (server, options) {

    options = options || {};

    Hoek.assert(this.constructor === internals.Monitor, 'Monitor must be instantiated using new');
    Hoek.assert(server, 'server required to create monitor');

    options = Hoek.applyToDefaultsWithShallow(internals.defaults, options, ['reporters', 'httpAgents', 'httpsAgents']);

    // Force them to be arrays
    var args = [];
    options.httpAgents = args.concat(options.httpAgents || Http.globalAgent);
    options.httpsAgents = args.concat(options.httpsAgents || Https.globalAgent);


    this.settings = options;
    this._reporters = [];
    this._state = {};
    this._server = server;

    // Validate settings
    Schema.assert('monitorOptions', this.settings);

    // Register as event emitter
    Events.EventEmitter.call(this);
};


Hoek.inherits(internals.Monitor, Events.EventEmitter);


internals.Monitor.prototype.start = function (callback) {

    var self = this;

    var setupOpsMonitoring = function () {

        var pmonitor = ProcessMonitor;
        var os = System;
        var network = new Network.Monitor(self._server);

        var asyncOps = {
            osload: os.loadavg,
            osmem: os.mem,
            osup: os.uptime,
            psup: pmonitor.uptime,
            psmem: pmonitor.memoryUsage,
            psdelay: pmonitor.delay,
            requests: network.requests.bind(network),
            concurrents: network.concurrents.bind(network),
            responseTimes: network.responseTimes.bind(network),
            sockets: network.sockets.bind(network, self.settings.httpAgents, self.settings.httpsAgents)
        };

        // Set ops interval timer

        return function () {

            // Gather operational statistics in parallel

            Items.parallel.execute(asyncOps, function (error, results) {

                if (error) {
                    console.error(error);
                }
                else {
                    results.host = internals.host;
                    self.emit('ops', results);
                }
                network.reset();
            });
        };
    };

    for (var i = 0, il = this.settings.reporters.length; i < il; i++) {

        var item = this.settings.reporters[i] || {};
        var reporter;

        // If it has a reporter constructor, then create a new one, otherwise, assume it is
        // a valid pre-constructed reporter
        if (item.reporter) {

            // If the supply a path or module node, try to load it
            if (typeof item.reporter === 'string') {
                item.reporter = require(item.reporter);
            }

            Hoek.assert(typeof item.reporter === 'function', 'reporter key must be a constructor function');

            item.args = item.args || [];
            // this pointer
            item.args.unshift(null);
            var constructor = item.reporter.bind.apply(item.reporter, item.args);
            reporter = new constructor();
        }
        else {
            reporter = item;
        }

        Hoek.assert(reporter.start && reporter.stop, 'Every reporter object must have a start and stop function.');

        this._reporters.push(reporter);
    }


    Items.serial(this._reporters, function (item, next) {

        item.start(self, next);
    }, function (error) {

        if (error) {
            return callback(error);
        }

        self._state.opsInterval = setInterval(setupOpsMonitoring(), self.settings.opsInterval);

        self._state.logHander = self._logHandler.bind(self);
        self._state.errorHandler = self._errorHandler.bind(self);
        self._state.responseHandler = self._responseHandler.bind(self);
        self._state.opsHandler = self._opsHandler.bind(self);

        // Initialize Events
        self._server.on('log', self._state.logHander);
        self._server.on('request-error', self._state.errorHandler);
        self._server.on(self.settings.responseEvent, self._state.responseHandler);
        self.on('ops', self._state.opsHandler);

        return callback();
    });
};


internals.Monitor.prototype.stop = function () {

    var state = this._state;
    clearInterval(state.opsInterval);

    this._server.removeListener('log', state.logHander);
    this._server.removeListener('request-error', state.errorHandler);
    this._server.removeListener(this.settings.responseEvent, state.responseHandler);
    this.removeListener('ops', state.opsHandler);

    for (var i = 0, il = this._reporters.length; i < il; ++i) {

        var reporter = this._reporters[i];
        reporter.stop();
    }
};


internals.Monitor.prototype._logHandler = function (event) {

    event = {
        event: 'log',
        timestamp: event.timestamp,
        tags: event.tags,
        data: event.data,
        pid: process.pid
    };

    this.emit('report', 'log', event);
};


internals.Monitor.prototype._errorHandler = function (request, error) {

    var event = {
        event: 'error',
        timestamp: request.info.received,
        url: request.url,
        method: request.method,
        pid: process.pid,
        error: error
    };

    this.emit('report', 'error', event);
};


internals.Monitor.prototype._responseHandler = function (request) {

    var req = request.raw.req;
    var res = request.raw.res;

    var event = {
        event: 'response',
        timestamp: request.info.received,
        id: request.id,
        instance: request.connection.info.uri,
        labels: request.connection.settings.labels,
        method: request.method,
        path: request.path,
        query: request.query,
        responseTime: Date.now() - request.info.received,
        statusCode: res.statusCode,
        pid: process.pid,
        source: {
            remoteAddress: request.info.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer
        }
    };

    event.log = request.getLog();

    if (this.settings.logRequestHeaders) {
        event.headers = req.headers;
    }

    if (this.settings.logRequestPayload) {
        event.requestPayload = request.payload;
    }

    if (this.settings.logResponsePayload) {
        event.responsePayload = request.response.source;
    }

    this.emit('report', 'response', event);
};


internals.Monitor.prototype._opsHandler = function (results) {

    var event = {
        event: 'ops',
        timestamp: Date.now(),
        host: results.host,
        pid: process.pid,
        os: {
            load: results.osload,
            mem: results.osmem,
            uptime: results.osup
        },
        proc: {
            uptime: results.psup,
            mem: results.psmem,
            delay: results.psdelay
        },
        load: {
            requests: results.requests,
            concurrents: results.concurrents,
            responseTimes: results.responseTimes,
            sockets: results.sockets
        }
    };

    this.emit('report', 'ops', event);
};
