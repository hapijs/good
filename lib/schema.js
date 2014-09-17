// Load Modules

var Hoek = require('hoek');
var Joi = require('joi');

var internals = {};

exports.assert = function (type, options) {

    var error = Joi.validate(options, internals[type]).error;
    Hoek.assert(!error, 'Invalid', type, 'options', error && error.annotate());
};

internals.monitorOptions = Joi.object().keys({
    broadcastInterval: Joi.number().integer(),
    extendedRequests: Joi.boolean(),
    opsInterval: Joi.number().integer().min(100),
    requestsEvent: Joi.string().valid('response','tail'),
    requestTimeout: Joi.number().integer(),
    schemaName: Joi.string(),
    subscribers: Joi.object().required(),
    extraFields: Joi.object(),
    logRequestHeaders: Joi.boolean(),
    logRequestPayload: Joi.boolean(),
    logResponsePayload: Joi.boolean(),
    logPid: Joi.boolean(),
    subscribers: Joi.array().includes(Joi.object()).required()
});
