// Load modules

var Hoek = require('hoek');
var Monitor = require('./monitor');


// Declare internals

var internals = {};


exports.register = function (pack, options, next) {

    pack.api(new Monitor(pack, options), 'monitor');
    return next();
};

