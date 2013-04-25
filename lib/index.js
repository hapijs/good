// Load modules

var Hoek = require('hoek');
var Monitor = require('./monitor');


// Declare internals

var internals = {};


exports.register = function (plugin, options, next) {

    plugin.api('monitor', new Monitor(plugin, options));
    return next();
};

