'use strict';

const Validate = require('@hapi/validate');

const Monitor = require('./monitor');


const internals = {};


internals.reporters = [
    Validate.object({
        pipe: Validate.func().required(),
        start: Validate.func()
    })
        .unknown(),

    Validate.string()
        .valid('stdout', 'stderr'),

    Validate.object({
        module: Validate.alternatives().try(Validate.string(), Validate.func(), Validate.object()).required(),
        name: Validate.string(),
        args: Validate.array().default([])
    })
];


internals.schema = Validate.object({

    includes: Validate.object({
        request: Validate.array().items(Validate.string().valid('headers', 'payload')).default([]),
        response: Validate.array().items(Validate.string().valid('headers', 'payload')).default([])
    })
        .default({
            request: [],
            response: []
        }),

    reporters: Validate.object()
        .pattern(/./, Validate.array().items(...internals.reporters))
        .default({}),

    extensions: Validate.array()
        .items(Validate.string().invalid('log', 'ops', 'request', 'response'))
        .default([]),

    ops: Validate.alternatives([
        Validate.object(),
        Validate.bool().allow(false)
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
        hapi: '>=18.4.0'
    },
    register: function (server, options) {

        const settings = Validate.attempt(options, internals.schema);
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
