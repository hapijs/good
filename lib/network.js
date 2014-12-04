// Declare internals
var Hoek = require('hoek');
var Items = require('items');

var internals = {};


module.exports.Monitor = internals.NetworkMonitor = function (server) {

    this._requests = {};
    this._responseTimes = {};
    this._server = server;

    this._server.ext('onRequest', this._onRequest.bind(this));
    this._server.on('response', this._onResponse.bind(this));
};


internals.NetworkMonitor.prototype._onRequest = function (request, reply) {

    var self = this;
    var port = request.connection.info.port;

    this._requests[port] = this._requests[port] || { total: 0, disconnects: 0, statusCodes: {} };
    this._requests[port].total++;

    request.once('disconnect', function () {

        self._requests[port].disconnects++;
    });

    return reply.continue();
};


internals.NetworkMonitor.prototype._onResponse = function (request) {

    var msec = Date.now() - request.info.received;
    var port = request.connection.info.port;
    var statusCode = request.response.statusCode;

    this._responseTimes[port] = this._responseTimes[port] || { count: 0, total: 0, max: 0 };
    this._responseTimes[port].count++;
    this._responseTimes[port].total += msec;

    if (this._responseTimes[port].max < msec) {
        this._responseTimes[port].max = msec;
    }

    this._requests[port].statusCodes[statusCode] = this._requests[port].statusCodes[statusCode] || 0;
    this._requests[port].statusCodes[statusCode]++;
};


internals.NetworkMonitor.prototype.reset = function () {

    var ports = Object.keys(this._requests);
    for (var i = 0, il = ports.length; i < il; ++i) {
        this._requests[ports[i]] = { total: 0, disconnects: 0, statusCodes: {} };
        this._responseTimes[ports[i]] = { count: 0, total: 0, max: 0 };
    }
};


internals.NetworkMonitor.prototype.requests = function (callback) {

    var self = this;
    process.nextTick(function() {

        callback(null, self._requests);
    });
};


internals.NetworkMonitor.prototype.concurrents = function (callback) {

    var self = this;
    var result = {};

    Items.serial(self._server.connections, function (connection, next) {
        connection.listener.getConnections(function (err, count) {

            if (err) {
                return next(err);
            }

            result[connection.info.port] = count;
            next();
        });
    }, function (err) {

        callback(err, result);
    });
};


internals.NetworkMonitor.prototype.responseTimes = function (callback) {

    var self = this;

    process.nextTick(function () {

        var ports = Object.keys(self._responseTimes);
        var overview = {};
        for (var i = 0, il = ports.length; i < il; ++i) {
            var port = ports[i];
            var count = Hoek.reach(self, '_responseTimes.' + port + '.count', { default: 1});
            overview[port] = {
                avg: self._responseTimes[port].total / count,
                max: self._responseTimes[port].max
            };
        }

        return callback(null, overview);
    });
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
