// Load modules

var Os = require('os');
var Hoek = require('hoek');
// MemWatch delayed required inline


// Declare internals

var internals = {};


/**
 * Process Monitor Constructor, most functions inherited from process module
 *
 * @api public
 */
module.exports.Monitor = internals.ProcessMonitor = function (leakDetection) {

    Hoek.assert(this.constructor === internals.ProcessMonitor, 'ProcessMonitor must be instantiated using new');

    this.builtins = ['uptime', 'memoryUsage'];

    // Expose Node os functions as async fns
    Hoek.inheritAsync(internals.ProcessMonitor, process, this.builtins);

    this._leaks = [];
    if (leakDetection) {
        this._logLeaks();
    }

    return this;
};


internals.ProcessMonitor.prototype._logLeaks = function () {

    var self = this;

    require('memwatch').on('leak', function (info) {

        self._leaks.push(info);
    });
};


/**
 * Return process memoryUsage with total system memory
 *
 * @param {Function} callback function to process result
 * @api public
 */
internals.ProcessMonitor.prototype.memory = function (callback) {

    var result = process.memoryUsage();
    result.total = Os.totalmem();

    callback(null, result);
};


/**
 * Return process leaks
 *
 * @param {Function} callback function to process result
 * @api public
 */
internals.ProcessMonitor.prototype.leaks = function (callback) {

    var loggedLeaks = Hoek.clone(this._leaks);
    this._leaks = [];

    callback(null, loggedLeaks);
};


/**
 * Return event queue delay in ms
 *
 * @param {Function} callback function to process result
 * @api public
 */
internals.ProcessMonitor.prototype.delay = function (callback) {

    var start = Date.now();

    process.nextTick(function () {

        callback(null, Date.now() - start);
    });
};