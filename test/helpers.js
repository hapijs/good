// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Good = require('../lib');
var ProcessMonitor = require('../lib/monitor/process');
var SystemMonitor = require('../lib/monitor/system');


// Declare internals

var internals = {};


module.exports = Good;
module.exports.SystemMonitor = SystemMonitor;
module.exports.ProcessMonitor = ProcessMonitor;


internals.Logger = function () {

    Events.EventEmitter.call(this);

    return this;
};

NodeUtil.inherits(internals.Logger, Events.EventEmitter);
module.exports._TEST = internals.logger = new internals.Logger();


// Override Log's console method

Good.log.console = function (message) {

    internals.logger.emit('log', message);
};


module.exports.Server = function (settings) {

    var server = new internals.FakeServer(settings);
    server._monitor = new Good.Monitor(server);

    return server;
};


internals.FakeServer = function (settings) {

    Events.EventEmitter.call(this);
    this.settings = settings;
};

NodeUtil.inherits(internals.FakeServer, Events.EventEmitter);