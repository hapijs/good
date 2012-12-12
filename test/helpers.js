// Load modules

var NodeUtil = require('util');
var Events = require('events');
var Log = process.env.TEST_COV ? require('../lib-cov') : require('../lib');
var ProcessMonitor = process.env.TEST_COV ? require('../lib-cov/monitor/process') : require('../lib/monitor/process');
var SystemMonitor = process.env.TEST_COV ? require('../lib-cov/monitor/system') : require('../lib/monitor/system');


// Declare internals

var internals = {};


module.exports = Log;
module.exports.SystemMonitor = SystemMonitor;
module.exports.ProcessMonitor = ProcessMonitor;


internals.Logger = function () {

    Events.EventEmitter.call(this);

    return this;
};

NodeUtil.inherits(internals.Logger, Events.EventEmitter);
module.exports._TEST = internals.logger = new internals.Logger();


// Override Log's console method

Log.log.console = function (message) {

    internals.logger.emit('log', message);
};


module.exports.Server = internals.Server = function (settings) {

    Events.EventEmitter.call(this);

    this.nickname = 'test+server';
    this.settings = settings;

    return this;
};

NodeUtil.inherits(internals.Server, Events.EventEmitter);