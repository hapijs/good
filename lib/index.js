'use strict';

const Hoek = require('hoek');
const Schema = require('./schema');

const internals = {
    defaults: {
        responseEvent: 'tail',
        requestHeaders: false,
        requestPayload: false,
        responsePayload: false,
        extensions: [],
        reporters: [],
        ops: {
            interval: 15000
        },
        filter: {}
    }
};


// Load modules
const Monitor = require('./monitor');


const onPostStop = (monitor) => {

    return (server, next) => {

        monitor.stop(next);
    };
};


const onPreStart = (monitor, options) => {

    return (server, next) => {

        const interval = options.ops.interval;
        monitor.startOps(interval);
        return next();
    };
};


exports.register = (server, options, next) => {

    options = Hoek.applyToDefaultsWithShallow(internals.defaults, options, ['reporters']);

    // Validate settings
    Schema.assert('monitorOptions', options);

    const monitor = new Monitor(server, options);
    server.expose('monitor', monitor);
    server.ext([{
        type: 'onPostStop',
        method: onPostStop(monitor)
    }, {
        type: 'onPreStart',
        method: onPreStart(monitor, options)
    }]);

    return monitor.start(next);
};


exports.register.attributes = {

    pkg: require('../package.json')
};
