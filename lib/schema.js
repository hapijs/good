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
    requestHeaders: Joi.boolean(),
    requestPayload: Joi.boolean(),
    responsePayload: Joi.boolean(),
    reporters: Joi.array().items(Joi.object(), Joi.string()),
    responseEvent: Joi.string().valid('response', 'tail'),
    extensions: Joi.array().items(Joi.string().invalid('log', 'request-error', 'ops', 'request', 'response', 'tail')),
    ops: Joi.object().keys().allow(null).optional(),
    filter: Joi.object().pattern(/./, Joi.string())
}).unknown(false);
