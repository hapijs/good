'use strict';

// Load Modules

const Joi = require('joi');

exports.monitor = Joi.object().keys({
    requestHeaders: Joi.bool().default(false),
    requestPayload: Joi.bool().default(false),
    responsePayload: Joi.bool().default(false),
    reporters: Joi.object().pattern(/./, Joi.array().items(
        Joi.string(),
        Joi.object().keys({
            pipe: Joi.func().required(),
            start: Joi.func()
        }).unknown(),
        Joi.object().keys({
            ctor: Joi.object({
                module: Joi.string().required(),
                name: Joi.string(),
                args: Joi.array().default([])
            }).required()
        })
    )).default({}),
    responseEvent: Joi.string().valid('response', 'tail').default('tail'),
    extensions: Joi.array().items(Joi.string().invalid('log', 'request-error', 'ops', 'request', 'response', 'tail')).default([]),
    ops: Joi.alternatives([Joi.object(), Joi.bool().allow(false)]).default({
        config: {},
        interval: 15000
    })
}).unknown(false);
