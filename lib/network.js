// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


module.exports.Monitor = internals.NetworkMonitor = function (events) {

    Hoek.assert(this.constructor === internals.NetworkMonitor, 'NetworkMonitor must be instantiated using new');

    this._requests = {};
    this._responses = {};
    events.on('request', this._onRequest.bind(this));
    events.on('response', this._onResponse.bind(this));

    return this;
};


internals.NetworkMonitor.prototype.requests = function (callback) {

    callback(null, this._requests);
};


internals.NetworkMonitor.prototype.concurrents = function (callback) {

    var ports = Object.keys(this._requests);
    var concurrents = {};
    for (var i = 0, il = ports.length; i < il; ++i) {
        var port = ports[i];
        concurrents[port] = this._requests[port] - this._responses[port];
    }
    callback(null, concurrents);
};


internals.NetworkMonitor.prototype.reset = function () {

    this._requests = {};
    this._responses = {};
};


internals.NetworkMonitor.prototype._onRequest = function (request, event, tags) {

    var port = (request.server && request.server.info) ? request.server.info.port : 0;
    this._requests[port] = this._requests[port] || 0;
    this._responses[port] = this._responses[port] || 0;

    if (event.tags &&
        event.tags.indexOf('received') !== -1 &&                            // Workaround current plugin event bug
        event.tags.indexOf('hapi') !== -1) {

        this._requests[port]++;
    }
};


internals.NetworkMonitor.prototype._onResponse = function (request) {

    var port = (request.server && request.server.info) ? request.server.info.port : 0;
    this._responses[port]++;
};
