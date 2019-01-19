'use strict';

const Joi = require('joi');

const Monitor = require('./monitor');


const internals = {};


internals.reporters = [
    Joi.object({
        pipe: Joi.func().required(),
        start: Joi.func()
    })
        .unknown(),

    Joi.string()
        .valid('stdout', 'stderr'),

    Joi.object({
        module: Joi.alternatives().try(Joi.string(), Joi.func()).required(),
        name: Joi.string(),
        args: Joi.array().default([])
    })
];


internals.schema = Joi.object({

    includes: Joi.object({
        request: Joi.array().items(Joi.string().valid('headers', 'payload')).default([]),
        response: Joi.array().items(Joi.string().valid('headers', 'payload')).default([])
    })
        .default({
            request: [],
            response: []
        }),

    reporters: Joi.object()
        .pattern(/./, Joi.array().items(...internals.reporters))
        .default({}),

    extensions: Joi.array()
        .items(Joi.string().invalid('log', 'ops', 'request', 'response'))
        .default([]),

    ops: Joi.alternatives([
        Joi.object(),
        Joi.bool().allow(false)
    ])
        .default({
            config: {},
            interval: 15000
        })
})
    .unknown(false);


exports.plugin = {
    pkg: require('../package.json'),
    requirements: {
        hapi: '>=17.0.0'
    },
    register: function (server, options) {

        const settings = Joi.attempt(options, internals.schema);
        const monitor = new Monitor(server, settings);

        server.ext('onPostStop', internals.onPostStop(monitor));
        server.ext('onPreStart', internals.onPreStart(monitor, settings));

        monitor.start();
    }
};


internals.onPostStop = function (monitor) {

    return (server, h) => {

        return monitor.stop();
    };
};


internals.onPreStart = function (monitor, options) {

    return (server, h) => {

        const interval = options.ops.interval;
        monitor.startOps(interval);
    };
};
