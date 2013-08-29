// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


module.exports.Monitor = internals.NetworkMonitor = function (events) {

    Hoek.assert(this.constructor === internals.NetworkMonitor, 'NetworkMonitor must be instantiated using new');

    this._requests = {};
    this._connections = {};
    this._responseTimes = {};
    events.on('request', this._onRequest.bind(this));
    events.on('response', this._onResponse.bind(this));

    return this;
};


internals.NetworkMonitor.prototype.requests = function (callback) {

    callback(null, this._requests);
};


internals.NetworkMonitor.prototype.concurrents = function (callback) {

    var ports = Object.keys(this._connections);
    var concurrents = {};
    for (var i = 0, il = ports.length; i < il; ++i) {
        var port = ports[i];
        concurrents[port] = this._connections[port] ? Object.keys(this._connections[port]).length : 0;
    }

    callback(null, concurrents);
};


internals.NetworkMonitor.prototype.responseTimes = function (callback) {

    var ports = Object.keys(this._responseTimes);
    var overview = {};
    for (var i = 0, il = ports.length; i < il; ++i) {
        var port = ports[i];
        var count = this._responseTimes[port].count ? this._responseTimes[port].count : 1;
        overview[port] = {
            avg: this._responseTimes[port].total / count,
            max: this._responseTimes[port].max
        }
    }

    callback(null, overview);
};


internals.NetworkMonitor.prototype.reset = function () {

    var ports = Object.keys(this._requests);
    for (var i = 0, il = ports.length; i < il; ++i) {
        this._requests[ports[i]] = { total: 0 };
        this._responseTimes[ports[i]] = { count: 0, total: 0, max: 0 };
    }
};


internals.NetworkMonitor.prototype._onRequest = function (request, event, tags) {

    var port = (request.server && request.server.info) ? request.server.info.port : 0;
    this._connections[port] = this._connections[port] || request.server._connections;

    if (event.tags &&
        event.tags.indexOf('received') !== -1 &&                            // Workaround current plugin event bug
        event.tags.indexOf('hapi') !== -1) {

        this._requests[port] = this._requests[port] || { total: 0 };
        this._requests[port].total++;
    }
};


internals.NetworkMonitor.prototype._onResponse = function (request) {

    var msec = Date.now() - request.info.received;
    var port = (request.server && request.server.info) ? request.server.info.port : 0;
    var statusCode = request.raw && request.raw.res ? request.raw.res.statusCode : 0;
    statusCode = statusCode || request._response && request._response._code ? request._response._code : 500;              // When res.statusCode isn't set yet

    this._responseTimes[port] = this._responseTimes[port] || { count: 0, total: 0, max: 0 };
    this._responseTimes[port].count++;
    this._responseTimes[port].total += msec;

    if (this._responseTimes[port].max < msec) {
        this._responseTimes[port].max = msec;
    }

    this._requests[port][request.url.pathname] = this._requests[port][request.url.pathname] || { total: 0, avg: 0, max: 0, disconnects: 0,  statusCodes: {} };
    var pathData = this._requests[port][request.url.pathname];

    pathData.total++;
    pathData.statusCodes[statusCode] = pathData.statusCodes[statusCode] || 0;
    pathData.statusCodes[statusCode]++;

    if (pathData.max < msec) {
        pathData.max = msec;
    }

    if (pathData.total > 1) {
        pathData.avg = (pathData.avg + msec)/2;
    }
    else {
        pathData.avg = msec;
    }

    if (statusCode === 500 &&
        request._response &&
        request._response._err &&
        request._response._err.message === 'Server response closed before client response') {

        pathData.disconnects++;
    }

    this._requests[port][request.url.pathname] = pathData;
};
