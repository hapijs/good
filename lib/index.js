// Load modules

var GoodFile = require('good-file');
var GoodConsole = require('./reporter');
var Monitor = require('./monitor');



// Declare internals

var internals = {};


exports.register = function (plugin, options, next) {

    var monitor = new Monitor(plugin, options);
    plugin.expose('monitor', monitor);
    plugin.events.on('stop', function () {

        monitor.stop();
    });

    return monitor.start(next);
};

exports.register.attributes = {

    pkg: require('../package.json')
};

exports.GoodConsole = GoodConsole;
exports.GoodFile = GoodFile;
