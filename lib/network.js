// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


module.exports.Monitor = internals.NetworkMonitor = function (events) {

    Hoek.assert(this.constructor === internals.NetworkMonitor, 'NetworkMonitor must be instantiated using new');

    this._requests = 0;
    this._responses = 0;
    events.on('request', this._onRequest.bind(this));
    events.on('response', this._onResponse.bind(this));

    return this;
};


internals.NetworkMonitor.prototype.requests = function (callback) {

    callback(null, this._requests);
};


internals.NetworkMonitor.prototype.concurrents = function (callback) {

    callback(null, this._requests - this._responses);
};


internals.NetworkMonitor.prototype.reset = function () {

    this._requests = this._responses = 0;
};


internals.NetworkMonitor.prototype._onRequest = function (request, data) {

    if (data.tags.indexOf('received') !== -1) {
        this._requests++;
    }
};


internals.NetworkMonitor.prototype._onResponse = function (request) {

    this._responses++;
};
