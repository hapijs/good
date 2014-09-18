// Load modules

var GoodFile = require('good-file');
var Monitor = require('./monitor');
var GoodConsole = require('./reporter');


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

exports.GoodConsole = GoodConsole;
exports.GoodFile = GoodFile;
