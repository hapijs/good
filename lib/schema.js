// Load Modules

var Hoek = require('hoek');
var Joi = require('joi');

var internals = {};

exports.assert = function (type, options) {

    var error = Joi.validate(options, internals[type]).error;
    Hoek.assert(!error, 'Invalid', type, 'options', error);
};

internals.monitorOptions = Joi.object().keys({
    extendedRequests: Joi.boolean(),
    httpAgents: Joi.array(),
    httpsAgents: Joi.array(),
    logRequestHeaders: Joi.boolean(),
    logRequestPayload: Joi.boolean(),
    logResponsePayload: Joi.boolean(),
    opsInterval: Joi.number().integer().min(100),
    reporters: Joi.array().includes(Joi.object(), Joi.string()).required(),
    requestsEvent: Joi.string().valid('response','tail')
});
