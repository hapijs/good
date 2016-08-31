'use strict';

// Load modules

const Stream = require('stream');
const Hoek = require('hoek');

// Declare internals

const internals = {};

internals.extractConfig = function (request) {

    return Object.assign({}, Hoek.reach(request, 'route.settings.plugins.good'), Hoek.reach(request, 'plugins.good'));
};

// Payload for "log" events
class ServerLog {
    constructor(event) {

        this.event = 'log';
        this.timestamp = event.timestamp;
        this.tags = event.tags;
        this.data = event.data;
        this.pid = process.pid;
    }
}


// Payload for "error" events
class RequestError {
    constructor(request, error) {

        this.event = 'error';
        this.timestamp = request.info.received;
        this.id = request.id;
        this.url = request.url;
        this.method = request.method;
        this.pid = process.pid;
        this.error = error;
        this.config = internals.extractConfig(request);
    }
    toJSON() {

        const result = Object.assign({}, this, {
            error: {
                error: this.error.message,
                stack: this.error.stack
            }
        });
        return result;
    }
}


// Payload for "response" events
class RequestSent {
    constructor(reqOptions, resOptions, request) {

        const req = request.raw.req;
        const res = request.raw.res;

        this.event = 'response';
        this.timestamp = request.info.received;
        this.id = request.id;
        this.instance = request.connection.info.uri;
        this.labels = request.connection.settings.labels;
        this.method = request.method;
        this.path = request.path;
        this.query = request.query;
        this.responseTime = Date.now() - request.info.received;
        this.responseSentTime = request.info.responded - request.info.received;
        this.statusCode = res.statusCode;
        this.pid = process.pid;
        this.httpVersion = request.raw.req.httpVersion;
        this.source = {
            remoteAddress: request.info.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer
        };
        this.route = request.route.path;

        /* $lab:coverage:off$ */
        this.log = (request.route.settings.log === false ? [] : request.getLog());          // Explicitly compare to false for hapi < v15
        /* $lab:coverage:on$ */

        this.tags = request.route.settings.tags;

        if (reqOptions.headers) {
            this.headers = req.headers;
        }

        if (reqOptions.payload) {
            this.requestPayload = request.payload;
        }

        if (resOptions.payload && request.response) {
            this.responsePayload = request.response.source;
        }
        this.config = internals.extractConfig(request);
    }
}


// Payload for "ops" events
class Ops {
    constructor(ops) {

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
    }
}


// Payload for "request" events via request.log
class RequestLog {
    constructor(request, event) {

        this.event = 'request';
        this.timestamp = event.timestamp;
        this.tags = event.tags;
        this.data = event.data;
        this.pid = process.pid;
        this.id = request.id;
        this.method = request.method;
        this.path = request.path;
        this.config = internals.extractConfig(request);
    }
}

class WreckResponse {
    constructor(error, request, response, start, uri) {

        response = response || {};
        uri = uri || {};
        this.event = 'wreck';
        this.timestamp = Date.now();
        this.timeSpent = this.timestamp - start;
        this.pid = process.pid;

        if (error) {
            this.error = {
                message: error.message,
                stack: error.stack
            };
        }

        this.request = {
            method: uri.method,
            path: uri.path,
            url: uri.href,
            protocol: uri.protocol,
            host: uri.host,
            headers: request._headers
        };

        this.response = {
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            headers: response.headers
        };
    }
}


class NoOp extends Stream.Transform {
    constructor() {

        super({ objectMode: true });
    }
    _transform(value, encoding, callback) {

        callback(null, value);
    }
}


module.exports = {
    ServerLog,
    RequestError,
    Ops,
    RequestLog,
    RequestSent,
    NoOp,
    WreckResponse
};
