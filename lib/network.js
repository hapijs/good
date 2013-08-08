// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


module.exports.Monitor = internals.NetworkMonitor = function (events) {

    Hoek.assert(this.constructor === internals.NetworkMonitor, 'NetworkMonitor must be instantiated using new');

    this._requests = {};
    this._connections = {};
    events.on('request', this._onRequest.bind(this));

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


internals.NetworkMonitor.prototype.reset = function () {

    var ports = Object.keys(this._requests);
    for (var i = 0, il = ports.length; i < il; ++i) {
        this._requests[ports[i]] = 0;
    }
};


internals.NetworkMonitor.prototype._onRequest = function (request, event, tags) {

    var port = (request.server && request.server.info) ? request.server.info.port : 0;
    this._connections[port] = this._connections[port] || request.server._connections;

    if (event.tags &&
        event.tags.indexOf('received') !== -1 &&                            // Workaround current plugin event bug
        event.tags.indexOf('hapi') !== -1) {

        this._requests[port] = this._requests[port] || 0;
        this._requests[port]++;
    }
};
