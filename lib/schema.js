'use strict';

// Load Modules

const Joi = require('joi');

module.exports = Joi.object().keys({
    requestHeaders: Joi.bool().default(false),
    requestPayload: Joi.bool().default(false),
    responsePayload: Joi.bool().default(false),
    reporters: Joi.array().items(Joi.object(), Joi.string()).default([]),
    responseEvent: Joi.string().valid('response', 'tail').default('tail'),
    extensions: Joi.array().items(Joi.string().invalid('log', 'request-error', 'ops', 'request', 'response', 'tail')).default([]),
    ops: Joi.alternatives([Joi.object(), Joi.bool().allow(false)]).default({
        config: {},
        interval: 15000
    }),
    filter: Joi.object().pattern(/./, Joi.string()).default({})
}).unknown(false);
