// Load modules

var Os = require('os');
var Events = require('events');
var NodeUtil = require('util');
var Async = require('async');
var Request = require('request');
var Hoek = require('hoek');
var System = require('./system');
var Process = require('./process');


// Declare internals

var internals = {
    host: Os.hostname(),
    appVer: Hoek.loadPackage(__dirname + '/..').version || 'unknown'                        // Look up a level to get the package.json page
};


internals.defaults = {
    schemaName: 'good.v1',                          // String to include using 'schema' key in update envelope
    broadcastInterval: 0,                           // MSec, 0 for immediately
    opsInterval: 15000,                             // MSec, equal to or greater than 100
    extendedRequests: false,
    requestsEvent: 'tail',                          // Sets the event used by the monitor to listen to finished requests. Other options: 'response'.
    subscribers: null,                              // { console: ['ops', 'request', 'log'] }
    alwaysMeasureOps: false                         // Measures ops even if no subscribers
};


module.exports = internals.Monitor = function (pack, options) {

    var self = this;

    Hoek.assert(this.constructor === internals.Monitor, 'Monitor must be instantiated using new');

    this.pack = pack;
    this.settings = Hoek.applyToDefaults(internals.defaults, options || {});

    if (!this.settings.subscribers) {
        this.settings.subscribers = {
            console: ['ops', 'request', 'log']
        };
    }

    // Validate settings

    Hoek.assert(this.settings.opsInterval >= 100, 'Invalid monitor.opsInterval configuration');
    Hoek.assert(this.settings.subscribers, 'Invalid monitor.subscribers configuration');
    Hoek.assert(this.settings.requestsEvent === 'response' || this.settings.requestsEvent === 'tail', 'Invalid monitor.requestsEvent configuration');

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Private members

    this._subscriberQueues = {};            // { destination -> subscriberQueue }
    this._eventQueues = {};                 // { eventType -> [subscriberQueue] }
    this._subscriberTags = {};
    this._background = {};                  // internval ids

    // Identify subscriptions

    var subscriberKeys = Object.keys(this.settings.subscribers);
    for (var i = 0, il = subscriberKeys.length; i < il; ++i) {
        var dest = subscriberKeys[i];

        this._subscriberQueues[dest] = [];

        var subscriptions = this.settings.subscribers[dest];
        var eventTypes = Array.isArray(subscriptions) ? subscriptions : subscriptions.events;
        this._subscriberTags[dest] = subscriptions.tags;

        for (var s = 0, sl = eventTypes.length; s < sl; ++s) {
            var eventType = eventTypes[s];
            this._eventQueues[eventType] = this._eventQueues[eventType] || [];
            this._eventQueues[eventType].push(this._subscriberQueues[dest]);
        }
    }

    if (Object.keys(this._eventQueues).length ||
        this.settings.alwaysMeasureOps) {

        // Setup broadcast interval

        if (this.settings.broadcastInterval) {
            this._background.broadcastInterval = setInterval(this._broadcast(), this.settings.broadcastInterval);
        }

        // Initialize Events

        if (this._eventQueues.log) {
            this._background.log = this._handle('log');
            this.pack.events.on('log', this._background.log);
        }

        if (this._eventQueues.request) {
            this._background.request = this._handle('request');
            this.pack.events.on(this.settings.requestsEvent, this._background.request);
        }

        if (this._eventQueues.ops ||
            this.settings.alwaysMeasureOps) {

            this._process = new Process.Monitor();
            this._os = new System.Monitor();

            this._background.ops = this._handle('ops');
            self.on('ops', this._background.ops);

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
                    pscpu: self._process.cpu,
                    psdelay: self._process.delay
                },
                function (err, results) {

                    if (!err) {
                        self.emit('ops', results);
                    }
                });
            };

            this._background.opsInterval = setInterval(opsFunc, this.settings.opsInterval);
        }
    }

    return this;
};

NodeUtil.inherits(internals.Monitor, Events.EventEmitter);


internals.Monitor.prototype.stop = function () {

    if (this._background.opsInterval) {
        clearInterval(this._background.opsInterval);
    }

    if (this._background.broadcastInterval) {
        clearInterval(this._background.broadcastInterval);
    }

    if (this._background.log) {
        this.pack.events.removeListener('log', this._background.log);
    }

    if (this._background.request) {
        this.pack.events.removeListener(this.settings.requestsEvent, this._background.request);
    }

    if (this._background.ops) {
        this.removeListener('ops', this._background.ops);
    }
};


internals.Monitor.prototype._broadcast = function () {

    var self = this;

    return function () {

        Object.keys(self._subscriberQueues).forEach(function (dest) {
            var subscriberQueue = self._subscriberQueues[dest];
            if (!subscriberQueue.length) {
                return;
            }

            var envelope = {
                schema: self.settings.schemaName,
                host: internals.host,
                appVer: internals.appVer,
                timestamp: Date.now(),
                events: []
            };

            var destFilterTags = self._subscriberTags[dest];
            var filteredQueue = subscriberQueue.filter(function (event) {

                var containsEventTag = function (tag) {

                    return event.tags && event.tags.indexOf(tag) >= 0;
                };

                return !destFilterTags || destFilterTags.some(containsEventTag);
            });

            filteredQueue.forEach(function (event) {

                envelope.events.push(event);
            });

            subscriberQueue.length = 0;         // Empty queue (must not set to [] or queue reference will change)

            // Display on console

            if (dest === 'console') {
                self._display(envelope);
                return;
            }

            // Send request

            Request({ method: 'post', uri: dest, json: envelope }, function (err, res, body) { });                    // Ignore errors
        });
    };
};


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


internals.Monitor.prototype._ops = function () {

    return function (results) {

        var event = {
            event: 'ops',
            timestamp: Date.now(),
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


internals.Monitor.prototype._request = function () {

    var self = this;

    return function (request) {

        var req = request.raw.req;
        var res = request.raw.res;

        var event = {
            event: 'request',
            timestamp: request.analytics.startTime,
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
            responseTime: Date.now() - request.analytics.startTime,
            statusCode: res.statusCode
        };

        if (self.settings.extendedRequests) {
            event.log = request.getLog();
        }

        return event;
    };
};


internals.Monitor.prototype._log = function () {

    return function (event) {

        event = {
            event: 'log',
            timestamp: event.timestamp,
            tags: event.tags,
            data: event.data
        };

        return event;
    };
};


internals.Monitor.prototype._display = function (data) {

    for (var i = 0, il = data.events.length; i < il; ++i) {
        var event = data.events[i];
        if (event.event === 'ops') {

            Hoek.printEvent({
                timestamp: event.timestamp,
                tags: ['ops'],
                data: 'memory: ' + Math.round(event.proc.mem.rss / (1024 * 1024)) + 'M cpu: ' + event.proc.cpu
            });
        }
        else if (event.event === 'request') {

            Hoek.printEvent({
                timestamp: event.timestamp,
                tags: ['request'],
                data: event.instance + ': ' + event.method + ' ' + event.path + ' (' + event.responseTime + 'ms)'
            });
        }
        else if (event.event === 'log') {

            Hoek.printEvent(event);
        }
    }
};