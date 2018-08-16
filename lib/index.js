'use strict';

// Load modules
const Hoek = require('hoek');
const Joi = require('joi');
const Schema = require('./schema');
const Monitor = require('./monitor');

const internals = {
    validateOptions(options) {

        const result = Joi.validate(options, Schema.monitor);
        Hoek.assert(!result.error, 'Invalid', 'monitorOptions', 'options', result.error);

        return result.value;
    },
    onPostStop(monitor) {

        return (server, h) => {

            return monitor.stop();
        };
    },
    onPreStart(monitor) {

        return (server, h) => {

            monitor.startOps();
        };
    },
    reconfigure(monitor) {

        return (options) => {

            monitor.stop();
            monitor.configure(internals.validateOptions(options));
            monitor.start();
        };
    }
};


exports.register = (server, options) => {

    // Do the initial configuration
    const monitor = new Monitor(server, internals.validateOptions(options));

    server.ext([{
        type: 'onPostStop',
        method: internals.onPostStop(monitor)
    }, {
        type: 'onPreStart',
        method: internals.onPreStart(monitor)
    }]);

    server.expose('reconfigure', internals.reconfigure(monitor));

    monitor.start();
};


exports.pkg = require('../package.json');
