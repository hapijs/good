// Load Modules

var Hoek = require('hoek');
var Joi = require('joi');

var internals = {};

exports.assert = function (type, options) {

    var error = Joi.validate(options, internals[type]).error;
    Hoek.assert(!error, 'Invalid', type, 'options', error && error.annotate());
};

internals.monitorOptions = Joi.object().keys({
    extendedRequests: Joi.boolean(),
    opsInterval: Joi.number().integer().min(100),
    logRequestHeaders: Joi.boolean(),
    logRequestPayload: Joi.boolean(),
    logResponsePayload: Joi.boolean(),
    requestsEvent: Joi.string().valid('response','tail'),
    reporters: Joi.array().includes(Joi.object(), Joi.string()).required()
});
