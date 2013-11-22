// Load modules

var Hoek = require('hoek');
// MemWatch required inline


// Declare internals

var internals = {};


/**
 * Process Monitor Constructor, most functions inherited from process module
 *
 * @api public
 */
module.exports.Monitor = internals.ProcessMonitor = function (options) {

    Hoek.assert(this.constructor === internals.ProcessMonitor, 'ProcessMonitor must be instantiated using new');
    options = options || {};

    this.builtins = ['uptime', 'memoryUsage'];

    // Expose Node os functions as async fns
    Hoek.inheritAsync(internals.ProcessMonitor, process, this.builtins);

    this._leaks = [];
    if (options.leakDetection) {
        this._logLeaks();
    }

    this._gcCount = 0;
    if (options.gcDetection) {
        this._logGC();
    }

    return this;
};


internals.ProcessMonitor.prototype._logLeaks = function () {

    var self = this;

    require('memwatch').on('leak', function (info) {

        self._leaks.push(info);
    });
};


internals.ProcessMonitor.prototype._logGC = function () {

    var self = this;

    require('memwatch').on('stats', function (info) {

        self._gcCount++;
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


internals.ProcessMonitor.prototype.gcCount = function (callback) {

    callback(null, this._gcCount);
    this._gcCount = 0;
};


/**
 * Return event queue delay in ms
 *
 * @param {Function} callback function to process result
 * @api public
 */
internals.ProcessMonitor.prototype.delay = function (callback) {

    var bench = new Hoek.Bench();
    setImmediate(function () {

        callback(null, bench.elapsed());
    });
};