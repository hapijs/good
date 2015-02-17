// Load modules

var Os = require('os');
var Events = require('events');
var Path = require('path');
var Fs = require('fs');
var Dgram = require('dgram');
var Url = require('url');
var Async = require('async');
var Hoek = require('hoek');
var Wreck = require('wreck');
var SafeStringify = require('json-stringify-safe');
var System = require('./system');
var Package = require('../package.json');
var Process = require('./process');
var Network = require('./network');
var Redis = null;                           // Loaded on demand
var Schema = require('./schema');

// Declare internals

var internals = {
    host: Os.hostname(),
    appVer: Package.version
};


internals.defaults = {
    schemaName: 'good.v1',                          // String to include using 'schema' key in update envelope
    broadcastInterval: 0,                           // MSec, 0 for immediately
    opsInterval: 15000,                             // MSec, equal to or greater than 100
    extendedRequests: false,
    requestsEvent: 'tail',                          // Sets the event used by the monitor to listen to finished requests. Other options: 'response'.
    subscribers: null,                              // { console: ['ops', 'request', 'log', 'error'] }
    alwaysMeasureOps: false,                        // Measures ops even if no subscribers
    maxLogSize: 0,                                  // Max bytes allowed to be written to each log file
    requestTimeout: 60000,                          // Number of ms to set timeout for http request to
    extraFields: {},                                // extra fields to include in the envelope
    logRequestHeaders: false,                       // log all headers on request
    logRequestPayload: false,                       // log payload of request
    logResponsePayload: false,                      // log payload of response
    logPid: false,                                   // log pid
    leakDetection: false,                           // Check heap for leaks and log with ops event
    gcDetection: false                             // Count number of GCs and log with ops event
};


module.exports = internals.Monitor = function (plugin, options) {

    var self = this;

    Hoek.assert(this.constructor === internals.Monitor, 'Monitor must be instantiated using new');

    this.plugin = plugin;
    this.settings = Hoek.applyToDefaults(internals.defaults, options || {});

    if (!this.settings.subscribers) {
        this.settings.subscribers = {
            console: ['request', 'log']
        };
    }

    // Validate settings
    Schema.assert('monitorOptions', this.settings);
    Schema.assert('monitorSubscribers', this.settings.subscribers);

    // Register as event emitter

    Events.EventEmitter.call(this);

    // Private members

    this._subscriberQueues = {              // { destination -> subscriberQueue }
        console: {},
        http: {},
        udp: {},
        redis: {},
        file: {}
    };
    this._eventQueues = {};                 // { eventType -> [subscriberQueue] }
    this._subscriberTags = {};
    this._background = {};                  // internval ids
    this._fileLogs = {};                    // log file write streams
    this._isProcessingLogs = false;

    var parseDestType = function (dest) {

        if (dest === 'console') {
            return 'console';
        }
        if (/^(http|https)\:/i.test(dest)) {
            return 'http';
        }
        if (/^(udp)\:/i.test(dest)) {
            return 'udp';
        }
        if (/^(redis)\:/i.test(dest)) {
            return 'redis';
        }
        return 'file';
    };

    // Identify subscriptions

    var subscriberKeys = Object.keys(this.settings.subscribers);
    for (var i = 0, il = subscriberKeys.length; i < il; ++i) {
        var dest = subscriberKeys[i];
        var destType = parseDestType(dest);

        this._subscriberQueues[destType][dest] = [];

        var subscriptions = this.settings.subscribers[dest];
        var eventTypes = Array.isArray(subscriptions) ? subscriptions : subscriptions.events;
        this._subscriberTags[dest] = subscriptions.tags;

        for (var s = 0, sl = eventTypes.length; s < sl; ++s) {
            var eventType = eventTypes[s];
            this._eventQueues[eventType] = this._eventQueues[eventType] || [];
            this._eventQueues[eventType].push(this._subscriberQueues[destType][dest]);
        }
    }

    if (Object.keys(this._eventQueues).length ||
        this.settings.alwaysMeasureOps) {

        // Setup broadcast interval

        if (this.settings.broadcastInterval) {
            this._background.broadcastInterval = setInterval(this._broadcastRemotes.bind(this), this.settings.broadcastInterval);
        }

        // Initialize Events

        if (this._eventQueues.log) {
            this._background.log = this._handle('log');
            this.plugin.events.on('log', this._background.log);
        }

        if (this._eventQueues.error) {
            this._background.error = this._handle('error');
            this.plugin.events.on('internalError', this._background.error);
        }

        if (this._eventQueues.request) {
            this._background.request = this._handle('request');
            this.plugin.events.on(this.settings.requestsEvent, this._background.request);
        }

        if (this._eventQueues.ops ||
            this.settings.alwaysMeasureOps) {

            var pmonitor = new Process.Monitor();
            var os = new System.Monitor();
            var network = new Network.Monitor(plugin.events);

            this._background.ops = this._handle('ops');
            self.on('ops', this._background.ops);

            var asyncOps = {
                osload: os.loadavg,
                osmem: os.mem,
                osup: os.uptime,
                psup: pmonitor.uptime,
                psmem: pmonitor.memory,
                psdelay: pmonitor.delay,
                requests: network.requests.bind(network),
                concurrents: network.concurrents.bind(network),
                responseTimes: network.responseTimes.bind(network)
            };

            // Set ops interval timer

            var opsFunc = function () {

                // Gather operational statistics in parallel

                Async.parallel(asyncOps,
                function (err, results) {

                    if (!err) {
                        self.emit('ops', results);
                    }
                    network.reset();
                });
            };

            this._background.opsInterval = setInterval(opsFunc, this.settings.opsInterval);
        }
    }

    return this;
};

Hoek.inherits(internals.Monitor, Events.EventEmitter);


internals.Monitor.prototype.stop = function () {

    if (this._background.opsInterval) {
        clearInterval(this._background.opsInterval);
    }

    if (this._background.broadcastInterval) {
        clearInterval(this._background.broadcastInterval);
    }

    if (this._background.log) {
        this.plugin.events.removeListener('log', this._background.log);
    }

    if (this._background.request) {
        this.plugin.events.removeListener(this.settings.requestsEvent, this._background.request);
    }

    if (this._background.ops) {
        this.removeListener('ops', this._background.ops);
    }

    if (this._background.error) {
        this.plugin.events.removeListener('internalError', this._background.error);
    }
};


internals.Monitor.prototype._eventsFilter = function (destFilterTags, subscriberQueue) {

    var filteredQueue = subscriberQueue.filter(function (event) {

        var containsEventTag = function (tag) {

            return event.tags && event.tags.indexOf(tag) >= 0;
        };

        return !destFilterTags || destFilterTags.some(containsEventTag);
    });

    return filteredQueue;
};

internals.Monitor.prototype._broadcastRemotes = function () {

    var self = this;

    self._broadcastHttp();
    self._broadcastUdp();
    self._broadcastRedis();
};


internals.Monitor.prototype._makeEnvelope = function (subscriberQueue, uri) {

    var self = this;

    var envelope = {
        schema: self.settings.schemaName,
        host: internals.host,
        appVer: internals.appVer,
        timestamp: Date.now(),
        events: self._eventsFilter(self._subscriberTags[uri], subscriberQueue)
    };

    envelope = Hoek.applyToDefaults(self.settings.extraFields, envelope);

    return envelope;
};

internals.Monitor.prototype._broadcastHttp = function () {

    var self = this;

    Object.keys(self._subscriberQueues.http).forEach(function (uri) {

        var subscriberQueue = self._subscriberQueues.http[uri];
        if (!subscriberQueue.length) {
            return;
        }

        var envelope = self._makeEnvelope(subscriberQueue, uri);

        subscriberQueue.length = 0;                                     // Empty queue (must not set to [] or queue reference will change)

        Wreck.request('post', uri, { headers: { 'content-type': 'application/json' }, payload: JSON.stringify(envelope), timeout: self.settings.requestTimeout });
    });
};


internals.Monitor.prototype._broadcastUdp = function () {

    var self = this;
    var request = function (uri, payload) {
        var message = new Buffer(payload);

        var client = Dgram.createSocket('udp4');
        client.on('error', function (err) { });
        client.send(message, 0, message.length, uri.port, uri.hostname, function () {

            client.close();
        });
    };

    Object.keys(self._subscriberQueues.udp).forEach(function (uri) {

        var subscriberQueue = self._subscriberQueues.udp[uri];
        if (!subscriberQueue.length) {
            return;
        }

        var envelope = self._makeEnvelope(subscriberQueue, uri);

        subscriberQueue.length = 0;                                     // Empty queue (must not set to [] or queue reference will change)

        request(Url.parse(uri), JSON.stringify(envelope));
    });
};


internals.Monitor.prototype._broadcastRedis = function () {

    var self = this;
    var request = function (uri, payload) {

        Redis = Redis || require('redis');          // Loaded on demand to avoid forcing a redis dependency

        var message = new Buffer(payload);
        var client = Redis.createClient(uri.port, uri.hostname);

        client.on('error', function (err) { });

        client.on('connect', function () {

            client.rpush(uri.path.substring(1), message, function () {

                client.quit();
            });
        });
    };

    Object.keys(self._subscriberQueues.redis).forEach(function (uri) {

        var subscriberQueue = self._subscriberQueues.redis[uri];
        if (!subscriberQueue.length) {
            return;
        }

        var envelope = self._makeEnvelope(subscriberQueue, uri);

        subscriberQueue.length = 0;                                     // Empty queue (must not set to [] or queue reference will change)

        request(Url.parse(uri), JSON.stringify(envelope));
    });
};


internals.Monitor.prototype._broadcastConsole = function () {

    var subscriberQueue = this._subscriberQueues.console.console;
    if (!subscriberQueue || !subscriberQueue.length) {
        return;
    }

    var events = this._eventsFilter(this._subscriberTags.console, subscriberQueue);

    subscriberQueue.length = 0;                                         // Empty queue (must not set to [] or queue reference will change)

    this._display(events);
};


internals.Monitor.prototype._broadcastFile = function () {

    var self = this;

    var keys = Object.keys(this._subscriberQueues.file);
    var keysLength = keys.length;

    if (!keysLength) {
        return;
    }

    if (this._isProcessingLogs) {
        self._doBroadcast = true;
        return;
    }

    this._isProcessingLogs = true;
    var logged = function () {

        self._isProcessingLogs = false;
        if (self._doBroadcast) {
            self._doBroadcast = false;
            self._broadcastFile();
        }
    };

    for (var i = 0; i < keysLength; ++i) {

        var file = keys[i];
        var subscriberQueue = this._subscriberQueues.file[file];
        var events = self._eventsFilter(this._subscriberTags[file], subscriberQueue);

        subscriberQueue.length = 0;                                     // Empty queue (must not set to [] or queue reference will change)
        self._logToFile(file, events, logged);
    }
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
    else if (eventName === 'error') {
        eventHandler = this._error();
    }

    Hoek.assert(eventHandler !== null, 'Invalid eventName specified');

    return function () {

        var subscriptions = self._eventQueues[eventName];
        if (subscriptions &&
            subscriptions.length) {

            var event = eventHandler.apply(this, arguments);

            for (var i = 0, il = subscriptions.length; i < il; ++i) {
                subscriptions[i].push(event);
            }

            self._broadcastRemotes();
            self._broadcastConsole();
            self._broadcastFile();
        }
    };
};

internals.Monitor.prototype._ops = function () {

    var self = this;

    return function (results) {

        var event = {
            event: 'ops',
            timestamp: Date.now(),
            host: internals.host,
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
                responseTimes: results.responseTimes
            }
        };

        if (self.settings.logPid) {
           event.pid = process.pid;
        }

        if (self.settings.leakDetection) {
            event.proc.leaks = results.psleaks;
        }

        if (self.settings.gcDetection) {
            event.proc.gcCount = results.psgcCount;
        }

        return event;
    };
};


internals.Monitor.prototype._request = function () {

    var self = this;

    return function (request) {

        var req = request.raw.req;
        var res = request.raw.res;

        var WMTcookies;
        var headersWithoutCookies;

        // record walmart session cookies
        if (request.state && request.state['com.wm.customer']) {
            var customerIdStr = unescape(request.state['com.wm.customer']);
            WMTcookies = {
                'customerId': customerIdStr.split('~~')[0],
                'WMSessionID': request.state['WMSessionID'],
                'com.wm.ssa': request.state['com.wm.ssa'],
                'com.wm.visitor': request.state['com.wm.visitor']
            }
        }

        headersWithoutCookies = JSON.parse(JSON.stringify(req.headers));
        delete headersWithoutCookies.cookie;

        var event = {
            event: 'request',
            timestamp: request.info.received,
            id: request.id,
            instance: request.server.info.uri,
            labels: request.server.settings.labels,
            method: request.method,
            path: request.path,
            query: request.query,
            source: {
                remoteAddress: request.info.remoteAddress,
                userAgent: req.headers['user-agent'],
                referer: req.headers.referer
            },
            responseTime: Date.now() - request.info.received,
            statusCode: res.statusCode
        };

        // customerized extendsion
        event.headersWithoutCookies = headersWithoutCookies;
        event.source.clientIP = req.headers['NSC_Client_IP'];
        event.WMTcookies = WMTcookies;
        event.externalServicesTimer = request.info.externalServicesTimer;
        event.analytics = request.info.analytics;
        // -- end --

        if (self.settings.extendedRequests) {
            event.log = request.getLog();
        }

        if (self.settings.logRequestHeaders) {
           event.headers = req.headers;
        }

        if (self.settings.logRequestPayload) {

            // in Hapi proxy mode payload is always not readable
            if (request.payload && request.payload.readable) {
                event.requestPayload = request.payload;
            }
            else {
                event.requestPayload = "Not Readable";
            }
        }

        if (self.settings.logResponsePayload) {
           event.responsePayload = request.response.source;
        }

        if (self.settings.logPid) {
           event.pid = process.pid;
        }

        return event;
    };
};


internals.Monitor.prototype._log = function () {

    var self = this;

    return function (event) {

        event = {
            event: 'log',
            timestamp: event.timestamp,
            tags: event.tags,
            data: event.data
        };

        if (self.settings.logPid) {
           event.pid = process.pid;
        }

        return event;
    };
};


internals.Monitor.prototype._error = function () {

    var self = this;

    return function (request, error) {
        error = {
            event: 'error',
            url: request.url,
            method: request.method,
            timestamp: request.info.received,
            message: error.message,
            stack: error.stack
        };

        if (self.settings.logPid) {
           error.pid = process.pid;
        }

        return error;
    };
};


internals.Monitor.prototype._display = function (events) {

    for (var i = 0, il = events.length; i < il; ++i) {
        var event = events[i];
        if (event.event === 'ops') {
            internals.printEvent({
                timestamp: event.timestamp,
                tags: ['ops'],
                data: 'memory: ' + Math.round(event.proc.mem.rss / (1024 * 1024)) +
                    'Mb, uptime (seconds): ' + event.proc.uptime +
                    ', load: ' + event.os.load
            });
        }
        else if (event.event === 'request') {

            var query = event.query ? JSON.stringify(event.query) : '';
            var responsePayload = ' ';
            var statusCode = '';

            if (event.responsePayload) {
                try {
                   responsePayload = ' response payload: ' + JSON.stringify(event.responsePayload);
                } catch (err) {
                   responsePayload = ' response payload: ' + SafeStringify(event.responsePayload);
                }
            }

            var methodColors = { 'get': 32, 'delete': 31, 'put': 36, 'post': 33 };
            var color = methodColors[event.method] || 34;
            var method = '\x1b[1;' + color + 'm' + event.method + '\x1b[0m';

            if (event.statusCode) {
                var color = (event.statusCode >= 500 ? 31 : (event.statusCode >= 400 ? 33 : (event.statusCode >= 300 ? 36 : 32)));
                statusCode = ' \x1b[' + color + 'm' + event.statusCode + '\x1b[0m';
            }

            internals.printEvent({
                timestamp: event.timestamp,
                tags: ['request'],
                data: event.instance + ': ' + method + ' ' + event.path + ' ' + query + statusCode + ' (' + event.responseTime + 'ms)' + responsePayload
            });
        }
        else if (event.event === 'error') {
            internals.printEvent({
                timestamp: event.timestamp,
                tags: ['internalError'],
                data: 'message: ' + event.message + ' stack: ' + event.stack
            });
        }
        else {
            internals.printEvent(event);
        }
    }
};


internals.printEvent = function (event) {

    var pad = function (value) {

        return (value < 10 ? '0' : '') + value;
    };

    var now = new Date(event.timestamp);
    var timestring = (now.getYear() - 100).toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '/' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds()) +
        '.' +
        now.getMilliseconds();

    var data = event.data;
    if (typeof event.data !== 'string') {
        try {
            data = JSON.stringify(event.data);
        }
        catch (e) {
            data = 'JSON Error: ' + e.message;
        }
    }

    var output = timestring + ', ' + event.tags[0] + ', ' + data;
    console.log(output);
};


internals.Monitor.prototype._logToFile = function (dest, events, callback) {

    var self = this;

    var total = events.length;
    var written = 0;

    var i = 0;
    var il = events.length;

    var logNext = function () {                                         // Ensure events written in correct order

        if (i > il) {
            return callback();
        }

        var event = events[i++];
        var eventString;

        if (event.statusCode === 504) {
            console.log('before', Date.now());
        }

        try {
            eventString = JSON.stringify(event);
        } catch (err) {
            eventString = SafeStringify(event);
        }

        if (event.statusCode === 504) {
            console.log('after', Date.now());
        }

        if (!eventString) {
            return logNext();
        }

        var data = new Buffer(eventString);
        var bytes = data.length;

        self._getFileLog(dest, bytes, function (err, fileLog) {

            if (err) {
                return callback(err);
            }

            writeEvent(data, fileLog);
        });
    };

    var writeEvent = function (data, fileLog) {

        if (fileLog.stream.bytesWritten) {
            fileLog.stream.write('\n');
        }

        fileLog.stream.write(data, function (err) {

            if (++written === total) {
                return callback(err);
            }

            logNext();
        });
    };

    logNext();
};


internals.Monitor.prototype._getFileLog = function (dest, bytes, callback) {

    var self = this;

    var ext = Path.extname(dest);
    var isFile = dest[dest.length - 1] !== Path.sep;
    var directory = isFile ? Path.dirname(dest) : dest;
    var file = isFile ? Path.basename(dest, ext) : Date.now().toString();

    var checkFileLog = function () {

        var fileLog = self._fileLogs[dest];
        if (!fileLog ||
            (self.settings.maxLogSize && (bytes + fileLog.stream.bytesWritten > self.settings.maxLogSize))) {

            return self._nextFile(directory, file + ext, processNextFile);
        }

        callback(null, fileLog);
    };

    var processNextFile = function (err, filePath) {

        if (err) {
            return callback(err);
        }

        if (self._fileLogs[dest] && self._fileLogs[dest].stream) {
            self._fileLogs[dest].stream.end();
        }

        self._fileLogs[dest] = {
            path: filePath,
            stream: Fs.createWriteStream(filePath, { flags: 'a' })
        };

        callback(null, self._fileLogs[dest]);
    };

    checkFileLog();
};


internals.Monitor.prototype._nextFile = function (directory, file, callback) {

    if (!this.settings.maxLogSize) {
        return callback(null, Path.join(directory, file));
    }

    Fs.readdir(directory, function (err, filenames) {

        if (err) {
            return callback(err);
        }

        var extNum = 0;
        filenames.forEach(function (filename) {

            if (Path.basename(filename, Path.extname(filename)) === file) {
                var fileExtNum = parseInt(Path.extname(filename).substr(1), 10);
                extNum = Math.max(fileExtNum, extNum);
            }
        });

        extNum++;
        var ext = extNum.toString();
        while (ext.length < 3) {
            ext = '0' + ext;
        }

        callback(null, Path.join(directory, file + '.' + ext));
    });
};
