// Load modules

var NodeUtil = require('util');
var Events = require('events');
var HapiLog = process.env.TEST_COV ? require('../lib-cov') : require('../lib');
var ProcessMonitor = process.env.TEST_COV ? require('../lib-cov/monitor/process') : require('../lib/monitor/process');
var SystemMonitor = process.env.TEST_COV ? require('../lib-cov/monitor/system') : require('../lib/monitor/system');


// Declare internals

var internals = {};


module.exports = HapiLog;
module.exports.SystemMonitor = SystemMonitor;
module.exports.ProcessMonitor = ProcessMonitor;


internals.Logger = function () {

    Events.EventEmitter.call(this);

    return this;
};

NodeUtil.inherits(internals.Logger, Events.EventEmitter);
module.exports._TEST = internals.logger = new internals.Logger();


// Override Log's console method

HapiLog.log.console = function (message) {

    internals.logger.emit('log', message);
};


module.exports.Server = function (settings) {

    var server = new internals.FakeServer(settings);
    server._monitor = new HapiLog.Monitor(server);

    return server;
};


internals.FakeServer = function (settings) {

    Events.EventEmitter.call(this);
    this.settings = settings;
};

NodeUtil.inherits(internals.FakeServer, Events.EventEmitter);