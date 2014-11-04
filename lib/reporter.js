// Load modules

var Util = require('util');
var GoodReporter = require('good-reporter');
var Hoek = require('hoek');
var Moment = require('moment');
var SafeStringify = require('json-stringify-safe');

// Declare internals

var internals = {
    defaults: {
        events: {
            request: '*',
            log: '*'
        }
    }
};

module.exports = internals.GoodConsole = function (options) {

    Hoek.assert(this.constructor === internals.GoodConsole, 'GoodConsole must be created with new');
    options = options || {};
    var settings = Hoek.clone(options);

    settings = Hoek.applyToDefaults(internals.defaults, settings);

    GoodReporter.call(this, settings);
};

Hoek.inherits(internals.GoodConsole, GoodReporter);

internals.GoodConsole.timeString = function (timestamp) {

    var m = Moment.utc(timestamp);
    return m.format('YYMMDD/HHmmss.SSS');
};

internals.printEvent = function (event) {

    var timestring = internals.GoodConsole.timeString(event.timestamp);

    var data = event.data;
    if (typeof event.data === 'object' && event.data) {
        data = SafeStringify(event.data);
    }

    var output = timestring + ', ' + event.tags[0] + ', ' + data;
    console.log(output);
};

internals.printRequest = function (event) {

    var query = event.query ? SafeStringify(event.query) : '';
    var responsePayload = '';
    var statusCode = '';

    if (typeof event.responsePayload === 'object' && event.responsePayload) {
        responsePayload = 'response payload: ' + SafeStringify(event.responsePayload);
    }

    var methodColors = {
        get: 32,
        delete: 31,
        put: 36,
        post: 33
    };
    var color = methodColors[event.method] || 34;
    var method = '\x1b[1;' + color + 'm' + event.method + '\x1b[0m';

    if (event.statusCode) {
        color = 32;
        if (event.statusCode >= 500) {
            color = 31;
        } else if (event.statusCode >= 400) {
            color = 33;
        } else if (event.statusCode >= 300) {
            color = 36;
        }
        statusCode = '\x1b[' + color + 'm' + event.statusCode + '\x1b[0m';
    }

    internals.printEvent({
        timestamp: event.timestamp,
        tags: ['request'],
        //instance, method, path, query, statusCode, responseTime, responsePayload
        data: Util.format('%s: %s %s %s %s (%sms) %s', event.instance, method, event.path, query, statusCode, event.responseTime, responsePayload)
    });

};

internals.GoodConsole.prototype._report = function (event, eventData) {

    if (event === 'ops') {
        internals.printEvent({
            timestamp: eventData.timestamp,
            tags: ['ops'],
            data: 'memory: ' + Math.round(eventData.proc.mem.rss / (1024 * 1024)) +
            'Mb, uptime (seconds): ' + eventData.proc.uptime +
            ', load: ' + eventData.os.load
        });
    }
    else if (event === 'request') {
        internals.printRequest(eventData);
    }
    else if (event === 'error') {
        internals.printEvent({
            timestamp: eventData.timestamp,
            tags: ['internalError'],
            data: 'message: ' + eventData.message + ' stack: ' + eventData.stack
        });
    }
    else {
        internals.printEvent(eventData);
    }
};
