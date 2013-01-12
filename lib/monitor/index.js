// Load modules

var Os = require('os');
var Async = require('async');
var Request = require('request');
var Hoek = require('hoek');
var System = require('./system');
var Process = require('./process');
var Log = require('../log');


// Declare internals

var internals = {
    hostname: Os.hostname(),
    version: Hoek.loadPackage().version || 'unknown'
};


/**
 * Monitor Constructor
 *
 * @param {Object} server (HTTP Server), must be an EventEmitter
 * @api public
 */
module.exports = internals.Monitor = function (server) {

    Hoek.assert(this.constructor === internals.Monitor, 'Monitor must be instantiated using new');

    this.server = server;
    this.settings = Hoek.clone(this.server.settings.monitor) || {};

    // Validate settings

    Hoek.assert(this.settings.opsInterval >= 100, 'Invalid monitor.opsInterval configuration');
    Hoek.assert(this.settings.subscribers, 'Invalid monitor.subscribers configuration');
    Hoek.assert(this.settings.requestsEvent === 'response' || this.settings.requestsEvent === 'tail', 'Invalid monitor.requestsEvent configuration');

    // Private members

    this._subscriberQueues = {};            // { destination -> subscriberQueue }
    this._eventQueues = {};                 // { eventType -> [subscriberQueue] }

    this._eventHeader = {
        module: 'hapi',
        host: internals.hostname,
        appVer: internals.version,
        events: []
    };

    // Identify subscriptions

    var subscriberKeys = Object.keys(this.settings.subscribers);
    for (var i = 0, il = subscriberKeys.length; i < il; ++i) {
        var dest = subscriberKeys[i];

        this._subscriberQueues[dest] = [];

        var subscriptions = this.settings.subscribers[dest];
        for (var s = 0, sl = subscriptions.length; s < sl; ++s) {
            var eventType = subscriptions[s];
            this._eventQueues[eventType] = this._eventQueues[eventType] || [];
            this._eventQueues[eventType].push(this._subscriberQueues[dest]);
        }
    }

    if (Object.keys(this._eventQueues).length) {

        // Setup broadcast interval

        if (this.settings.broadcastInterval) {
            setInterval(this._broadcast(), this.settings.broadcastInterval);
        }

        // Initialize Events

        if (this._eventQueues.log) {
            Log.on('log', this._handle('log'));
            Log.event(['info', 'config'], this.server.settings.nickname + ': Log monitoring enabled');
        }

        if (this._eventQueues.ops) {
            this._initOps();
        }

        if (this._eventQueues.request) {
            this.server.on(this.settings.requestsEvent, this._handle('request'));
            Log.event(['info', 'config'], this.server.settings.nickname + ': Requests monitoring enabled');
        }
    }

    return this;
};


/**
 * Initialize Operations Monitoring if configured
 *
 * @api private
 */
internals.Monitor.prototype._initOps = function () {

    var self = this;

    // Initialize helpers

    this._process = new Process.Monitor();
    this._os = new System.Monitor();

    // Subscribe to opts interval

    this.server.on('ops', this._handle('ops'));

    // Set ops interval timer

    var opsFunc = function () {

        // Gather operational statistics in parallel

        Async.parallel({
                oscpu: self._os.cpu,
                osdisk: self._os.disk,
                osload: self._os.loadavg,
                osmem: self._os.mem,
                osup: self._os.uptime,
                psup: self._process.uptime,
                psmem: self._process.memory,
                pscpu: self._process.cpu
            },
            function (err, results) {

                if (!err) {
                    self.server.emit('ops', results);
                }
                else {
                    Log.event(['err', 'monitor', 'ops'], err);
                }
            });
    };

    setInterval(opsFunc, this.settings.opsInterval);
    Log.event(['info', 'config'], this.server.settings.nickname + ': Ops monitoring enabled');
};


/**
 * Broadcast queued events
 *
 * @api private
 */
internals.Monitor.prototype._broadcast = function () {

    var self = this;

    return function () {

        var subscriberQueueKeys = Object.keys(self._subscriberQueues);
        for (var i = 0, il = subscriberQueueKeys.length; i < il; ++i) {
            var dest = subscriberQueueKeys[i];
            var subscriberQueue = self._subscriberQueues[dest];

            if (subscriberQueue.length) {
                var data = Hoek.clone(self._eventHeader);
                data.mts = Date.now();

                for (var s = 0, sl = subscriberQueue.length; s < sl; ++s) {
                    data.events.push(subscriberQueue[s]);
                }

                subscriberQueue.length = 0;         // Empty queue (must not set to [] or queue reference will change)

                if (dest === 'console') {
                    self._display(data);
                }
                else {
                    var request = {
                        method: 'post',
                        uri: dest,
                        json: data
                    };

                    Request(request, function (err, res, body) {

                        // Ignore errors
                    });
                }
            }
        }
    };
};


/**
 * Respond to Monitoring Signals and dispatch handlers
 *
 * @param {String} eventName signal name
 * @api private
 */
internals.Monitor.prototype._handle = function (eventName) {

    var self = this;
    var eventHandler = null;

    if (eventName === 'ops') {
        eventHandler = this._ops();
    }
    else if (eventName === 'request') {
        eventHandler = this._request();
    }
    else if (eventName === 'log') {
        eventHandler = this._log();
    }

    Hoek.assert(eventHandler !== null, 'Invalid eventName specified');

    return function (context) {

        var subscriptions = self._eventQueues[eventName];
        if (subscriptions &&
            subscriptions.length) {

            var event = eventHandler(context);

            for (var i = 0, il = subscriptions.length; i < il; ++i) {
                subscriptions[i].push(event);
            }

            if (self.settings.broadcastInterval === 0) {
                self._broadcast()();
            }
        }
    };
};


/**
 * Generate and send Operational Monitoring data
 *
 * @param {Object} operations results object
 * @api private
 */
internals.Monitor.prototype._ops = function () {

    return function (results) {

        var event = {
            event: 'ops',
            ets: Date.now(),
            os: {
                load: results.osload,
                mem: results.osmem,
                disk: results.osdisk,
                uptime: results.osup
                // io: '', // Not yet implemented
                // net: '' // Not yet implemented
            },
            proc: {
                uptime: results.psup,
                mem: results.psmem,
                cpu: results.pscpu
            }
        };

        if (results.oscpu !== null &&
            results.oscpu !== '-') {

            event.os.cpu = results.oscpu;
        }

        return event;
    };
};


/**
 * Generate and send Request Monitoring data
 *
 * @param {Object} client HTTP client to use for sending
 * @param {String} url path to POST data
 * @api private
 */
internals.Monitor.prototype._request = function () {

    var self = this;

    return function (request) {

        var req = request.raw.req;

        var event = {
            event: 'request',
            ets: request._analytics.startTime,
            id: request.id,
            instance: request.server.settings.nickname,
            method: request.method,
            path: request.path,
            query: request.query,
            source: {
                remoteAddress: (req.connection ? req.connection.remoteAddress : 'unknown'),
                userAgent: req.headers['user-agent'],
                referer: req.headers.referer
            },
            responseTime: Date.now() - request._analytics.startTime
        };

        if (self.settings.extendedRequests &&
            request._log.length) {

            event.log = request._log;
        }

        return event;
    };
};


/**
 * Generate and send logs events
 *
 * @param {Object} event details
 * @api private
 */
internals.Monitor.prototype._log = function () {

    return function (event) {

        event = {
            event: 'log',
            ets: event.ets,
            tags: event.tags,
            data: event.data
        };

        return event;
    };
};


/**
 * Display events on console
 *
 * @api private
 */
internals.Monitor.prototype._display = function (data) {

    for (var i = 0, il = data.events.length; i < il; ++i) {
        var event = data.events[i];
        if (event.event === 'ops') {

            Log.print({
                ets: event.ets,
                tags: ['ops'],
                data: 'memory: ' + Math.round(event.proc.mem.rss / (1024 * 1024)) + 'M cpu: ' + event.proc.cpu
            });
        }
        else if (event.event === 'request') {

            Log.print({
                ets: event.ets,
                tags: ['request'],
                data: event.instance + ': ' + event.method + ' ' + event.path + ' (' + event.responseTime + 'ms)'
            });
        }
        else if (event.event === 'log') {

            Log.print(event);
        }
    }
};