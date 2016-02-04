'use strict';

// Load modules

const Traverse = require('traverse');
const Hoek = require('hoek');

// Declare internals

const internals = {};

internals.getOwnProperty = function (obj, key) {

    if (obj.hasOwnProperty(key)) {
        return obj[key];
    }
};

internals.extractConfig = function (request) {

    return Object.assign({}, Hoek.reach(request, 'route.settings.plugins.good'), Hoek.reach(request, 'plugins.good'));
};

// Payload for "log" events
class GreatLog {
    constructor(event) {

        this.event = 'log';
        this.timestamp = event.timestamp;
        this.tags = event.tags;
        this.data = event.data;
        this.pid = process.pid;
    }
}


// Payload for "error" events
class GreatError {
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
class GreatResponse {
    constructor(request, options, filterRules) {

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
        this.statusCode = res.statusCode;
        this.pid = process.pid;
        this.httpVersion = request.raw.req.httpVersion;
        this.source = {
            remoteAddress: request.info.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer
        };

        this.log = request.getLog();

        if (options.requestHeaders) {
            this.headers = req.headers;
        }

        if (options.requestPayload) {
            this.requestPayload = request.payload;
        }

        if (options.responsePayload && request.response) {
            this.responsePayload = request.response.source;
        }

        if (Object.keys(filterRules).length) {

            GreatResponse.applyFilter(this.requestPayload, filterRules);
            GreatResponse.applyFilter(this.responsePayload, filterRules);
        }
        this.config = internals.extractConfig(request);
    }

    static replacer(match, group) {

        return (new Array(group.length + 1).join('X'));
    }

    static applyFilter(data, filterRules) {

        Traverse(data).forEach(function (value) {

            if (this.isRoot) {
                return;
            }

            if (this.isLeaf) {
                let filter = internals.getOwnProperty(filterRules, this.key) || internals.getOwnProperty(filterRules, this.parent.key);

                if (filter) {
                    filter = filter.toLowerCase();

                    if (filter === 'censor') {
                        this.update(('' + value).replace(/./g, 'X'));
                    }
                    else if (filter === 'remove') {
                        this.delete();
                    }
                    // Means this is a string that needs to be turned into a RegEx
                    else {
                        const regex = new RegExp(filter);
                        this.update(('' + value).replace(regex, GreatResponse.replacer));
                    }
                }
            }
        });
    }
}


// Payload for "ops" events
class GreatOps {
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
class GreatRequest {
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


// Payload for "wreck" events
class GreatWreck {
    constructor(error, request, response, start, uri) {

        request = Object.assign({}, request);
        response = Object.assign({}, response);
        uri = Object.assign({}, uri);
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
        this.config = internals.extractConfig(request);
    }
}

exports.GreatLog = GreatLog;
exports.GreatError = GreatError;
exports.GreatResponse = GreatResponse;
exports.GreatOps = GreatOps;
exports.GreatRequest = GreatRequest;
exports.GreatWreck = GreatWreck;
