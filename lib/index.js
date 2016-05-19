'use strict';

// Load modules
const Hoek = require('hoek');
const Joi = require('joi');
const Schema = require('./schema');
const Monitor = require('./monitor');

const internals = {
    onPostStop(monitor) {

        return (server, next) => {

            monitor.stop(next);
        };
    },
    onPreStart(monitor, options) {

        return (server, next) => {

            const interval = options.ops.interval;
            monitor.startOps(interval);
            return next();
        };
    }
};

exports.register = (server, options, next) => {

    const result = Joi.validate(options, Schema.monitor);
    Hoek.assert(!result.error, 'Invalid', 'monitorOptions', 'options', result.error);

    const monitor = new Monitor(server, result.value);
    server.ext([{
        type: 'onPostStop',
        method: internals.onPostStop(monitor)
    }, {
        type: 'onPreStart',
        method: internals.onPreStart(monitor, result.value)
    }]);

    return monitor.start(next);
};


exports.register.attributes = {

    pkg: require('../package.json')
};
