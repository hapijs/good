// Load modules

var Http = require('http');
var Url = require('url');


// Declare internals

var internals = {};


module.exports = internals.Replay = function (host, concurrent, log) {

    var self = this;

    this.host = host;
    this.availableSockets = concurrent;
    this.urls = this.parseUrls(log);

    return function () {

        self.makeRequests();
    };
};

internals.Replay.prototype.parseUrls = function (entries) {

    var urls = [];
    for (var i = 0, il = entries.length; i < il; ++i) {
        var entry = entries[i];
        if (entry.event === 'request' && entry.method === 'get') {
            if (entry.path) {
                urls.push(Url.format({
                    protocol: 'http',
                    host: this.host,
                    pathname: entry.path,
                    query: entry.query
                }));
            }
        }
    }

    return urls;
};

internals.Replay.prototype.handleResponse = function (response) {

    var self = this;

    response.once('data', function () { });

    response.once('error', function () {

        console.log('error for: ' + response.req.path);
        response.destroy();
    });

    response.once('close', function () {

        self.makeRequest();
    });
};


internals.Replay.prototype.makeRequests = function () {

    Http.globalAgent.maxSockets = this.availableSockets;
    console.log('Total requests to make: ' + this.urls.length);
    console.log('Making requests...');

    for (var i = 0, il = (this.urls.length > this.availableSockets ? this.availableSockets : this.urls.length); i < il; ++i) {

        this.makeRequest();
    }
};


internals.Replay.prototype.makeRequest = function () {

    var self = this;

    var url = this.urls.pop();

    while (!url) {
        if (!this.urls.length) {
            return process.exit();
        }

        url = this.urls.pop();
    }

    console.log(url);
    var req = Http.get(url, this.handleResponse);

    req.once('error', function (err) {

        console.log(err);
        self.makeRequest();
    });
};