// Load modules

var Hoek = require('hoek');
var Monitor = require('./monitor');


// Declare internals

var internals = {};


exports.register = function (pack, options, next) {

    pack.api('monitor', new Monitor(pack, options));
    return next();
};

