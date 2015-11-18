'use strict';

// Load modules
const Monitor = require('./monitor');


exports.register = (server, options, next) => {

    const monitor = new Monitor(server, options);
    server.expose('monitor', monitor);
    server.on('stop', () => {

        monitor.stop();
    });

    return monitor.start(next);
};

exports.register.attributes = {

    pkg: require('../package.json')
};
