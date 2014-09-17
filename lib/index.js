// Load modules

var Monitor = require('./monitor');


// Declare internals

var internals = {};


exports.register = function (plugin, options, next) {

    var monitor = new Monitor(plugin, options);
    plugin.expose('monitor', monitor);

    return monitor.start(next);
};

exports.register.attributes = {

    pkg: require('../package.json')
};

exports.GoodConsole = require('./reporter');
exports.GoodFile = require('good-file');
