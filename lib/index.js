'use strict';

// Load modules
const Hoek = require('hoek');
const Joi = require('joi');
const Schema = require('./schema');
const Monitor = require('./monitor');

const internals = {
    onPostStop(monitor) {

        return (server, h) => {

            return monitor.stop();
        };
    },
    onPreStart(monitor, options) {

        return (server, h) => {

            const interval = options.ops.interval;
            monitor.startOps(interval);
        };
    }
};

exports.register = (server, options) => {

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

    monitor.start();
};


exports.pkg = require('../package.json');
