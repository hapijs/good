// Load modules

var Os = require('os');
var Hoek = require('hoek');


// Declare internals

var internals = {};


/**
 * Operating System Monitor Constructor
 *
 * @api public
 */
module.exports.Monitor = internals.OSMonitor = function () {

    Hoek.assert(this.constructor === internals.OSMonitor, 'OSMonitor must be instantiated using new');

    this.builtins = ['loadavg', 'uptime', 'freemem', 'totalmem', 'cpus'];

    // Expose Node os functions as async fns
    Hoek.inheritAsync(internals.OSMonitor, Os, this.public_methods);

    return this;
};


/**
 * Return memory statistics to a callback
 *
 * @param {Function} callback
 * @api public
 */
internals.OSMonitor.prototype.mem = function (callback) {

    callback(null, {
        total: Os.totalmem(),
        free: Os.freemem()
    });
};
