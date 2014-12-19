// Load modules
var Hoek = require('hoek');

// Declare internals

var internals = {};

exports.makeContinuation = function (predicate) {

    return function (callback) {

        process.nextTick(function () {

            var result = predicate();
            callback(null, result);
        });
    };
};


// Payload for "log" events
exports.GreatLog = function (event) {

    if (this.constructor === exports.GreatLog) {
        this.event = 'log';
        this.timestamp = event.timestamp;
        this.tags = event.tags;
        this.data = event.data;
        this.pid = process.pid;

        Object.freeze(this);
    }
    else {
        return new exports.GreatLog(event);
    }
};


// Payload for "error" events
exports.GreatError = function (request, error) {

    if (this.constructor === exports.GreatError) {
        this.event = 'error';
        this.timestamp = request.info.received;
        this.url = request.url;
        this.method = request.method;
        this.pid = process.pid;
        this.error = error;

        Object.freeze(this);
    }
    else {
        return new exports.GreatError(request, error);
    }
};


exports.GreatError.prototype.toJSON = function () {

    var result = Hoek.clone(this);

    result.error = {
        message: this.error.message,
        stack: this.error.stack
    };

    return result;
};


// Payload for "response" events
exports.GreatResponse = function (request, options) {

    if (this.constructor === exports.GreatResponse) {

        var req = request.raw.req;
        var res = request.raw.res;

        this.event = 'response';
        this.timestamp = request.info.received;
        this.id = request.id;
        this.instance = request.connection.info.uri;
        this.labels = request.connection.settings.labels;
        this.method = request.method;
        this.path = request.path;
        this.query = request.query;
        this.responseTime = Date.now() - request.info.received;
        this.statusCode = res.statusCode;
        this.pid = process.pid;
        this.source = {
            remoteAddress: request.info.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer
        };

        this.log = request.getLog();

        if (options.logRequestHeaders) {
            this.headers = req.headers;
        }

        if (options.logRequestPayload) {
            this.requestPayload = request.payload;
        }

        if (options.logResponsePayload) {
            this.responsePayload = request.response.source;
        }

        Object.freeze(this);
    }
    else {
        return new exports.GreatResponse(request, options);
    }
};


// Payload for "ops" events
exports.GreatOps = function (ops) {

    if (this.constructor === exports.GreatOps) {
        this.event = 'ops';
        this.timestamp = Date.now();
        this.host = ops.host;
        this.pid = process.pid;
        this.os = {
            load: ops.osload,
            mem: ops.osmem,
            uptime: ops.osup
        };
        this.proc = {
            uptime: ops.psup,
            mem: ops.psmem,
            delay: ops.psdelay
        };
        this.load = {
            requests: ops.requests,
            concurrents: ops.concurrents,
            responseTimes: ops.responseTimes,
            sockets: ops.sockets
        };

        Object.freeze(this);
    }
    else {
        return new exports.GreatOps(ops);
    }
};


// Payload for "request" events via request.log
exports.GreatRequest = function (request, event) {

    if (this.constructor === exports.GreatRequest) {
        this.event = 'request';
        this.timestamp = event.timestamp;
        this.tags = event.tags;
        this.data = event.data;
        this.pid = process.pid;
        this.id = request.id;
        this.method = request.method;
        this.path = request.path;

        Object.freeze(this);
    }
    else {
        return new exports.GreatRequest(request, event);
    }
};
