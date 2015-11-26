'use strict';

// Load Modules

const Hoek = require('hoek');
const Joi = require('joi');

const internals = {};

exports.assert = function (type, options) {

    const error = Joi.validate(options, internals[type]).error;
    Hoek.assert(!error, 'Invalid', type, 'options', error);
};

internals.monitorOptions = Joi.object().keys({
    requestHeaders: Joi.boolean().default(false),
    requestPayload: Joi.boolean().default(false),
    responsePayload: Joi.boolean().default(false),
    reporters: Joi.array().items(Joi.object(), Joi.string()).default([]),
    responseEvent: Joi.string().valid('response', 'tail').default('tail'),
    extensions: Joi.array().items(Joi.string().invalid('log', 'request-error', 'ops', 'request', 'response', 'tail')).default([]),
    ops: Joi.object().optional().default({
        config: {},
        interval: 15000
    }),
    filter: Joi.object().pattern(/./, Joi.string()).default({})
}).unknown(false);
