// Declare internals

var internals = {};


module.exports.Monitor = internals.NetworkMonitor = function (events) {

    this._requests = {};
    this._connections = {};
    this._responseTimes = {};

    events.on('request', this._onRequest.bind(this));
    events.on('response', this._onResponse.bind(this));
};


internals.NetworkMonitor.prototype.requests = function (callback) {

    var self = this;
    process.nextTick(function() {

        callback(null, self._requests);
    });
};


internals.NetworkMonitor.prototype.concurrents = function (callback) {

    var self = this;

    process.nextTick(function() {

        var ports = Object.keys(self._connections);
        var concurrents = {};
        for (var i = 0, il = ports.length; i < il; ++i) {
            var port = ports[i];
            concurrents[port] = self._connections[port] ? Object.keys(self._connections[port]).length : 0;
        }

        return callback(null, concurrents);
    });
};


internals.NetworkMonitor.prototype.responseTimes = function (callback) {

    var self = this;

    process.nextTick(function () {

        var ports = Object.keys(self._responseTimes);
        var overview = {};
        for (var i = 0, il = ports.length; i < il; ++i) {
            var port = ports[i];
            var count = self._responseTimes[port].count || 1;
            overview[port] = {
                avg: self._responseTimes[port].total / count,
                max: self._responseTimes[port].max
            };
        }

        return callback(null, overview);
    });
};


internals.NetworkMonitor.prototype.reset = function () {

    var ports = Object.keys(this._requests);
    for (var i = 0, il = ports.length; i < il; ++i) {
        this._requests[ports[i]] = { total: 0, disconnects: 0, statusCodes: {} };
        this._responseTimes[ports[i]] = { count: 0, total: 0, max: 0 };
    }
};


internals.NetworkMonitor.prototype._onRequest = function (request, event, tags) {

    var port = 0;
    if (request.server.info && typeof request.server.info.port !== 'undefined') {

        port = request.server.info.port;
    }
    this._connections[port] = this._connections[port] || request.server._connections;

    if (event.tags &&
        event.tags.indexOf('received') !== -1 &&                            // Workaround current plugin event bug
        event.tags.indexOf('hapi') !== -1) {

        this._requests[port] = this._requests[port] || { total: 0, disconnects: 0, statusCodes: {} };
        this._requests[port].total++;
    }
};


internals.NetworkMonitor.prototype._onResponse = function (request) {

    var msec = Date.now() - request.info.received;
    var port = 0;
    if (request.server.info && typeof request.server.info.port !== 'undefined') {

        port = request.server.info.port;
    } 

    var response = request.response;
    var statusCode = response.statusCode;

    this._responseTimes[port] = this._responseTimes[port] || { count: 0, total: 0, max: 0 };
    this._responseTimes[port].count++;
    this._responseTimes[port].total += msec;

    if (this._responseTimes[port].max < msec) {
        this._responseTimes[port].max = msec;
    }

    this._requests[port].statusCodes[statusCode] = this._requests[port].statusCodes[statusCode] || 0;
    this._requests[port].statusCodes[statusCode]++;

    var log = request.getLog('aborted');
    if (log.length) {
        this._requests[port].disconnects++;
    }
};


internals.NetworkMonitor.prototype.sockets = function (httpAgents, httpsAgents, callback) {

    process.nextTick(function() {

        var result = {
            http: internals.getSocketCount(httpAgents),
            https: internals.getSocketCount(httpsAgents)
        };
        callback(null, result);
    });
};

internals.getSocketCount = function (agents) {

    var result = {
        total: 0
    };

    for (var j = 0, jl = agents.length; j < jl; ++j) {
        var agent = agents[j];

        var keys = Object.keys(agent.sockets);
        for (var i = 0, il = keys.length; i < il; ++i) {
            var key = keys[i];
            result[key] = agent.sockets[key].length;
            result.total += result[key];
        }
    }

    return result;
};