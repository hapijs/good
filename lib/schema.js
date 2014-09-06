// Load Modules

var Hoek = require('hoek');
var Joi = require('joi');

var internals = {};

exports.assert = function (type, options) {

    var error = Joi.validate(options, internals[type]).error;
    Hoek.assert(!error, 'Invalid', type, 'options', error && error.annotate());
};

internals.subscriptions = Joi.array().includes(Joi.string().valid('ops', 'request', 'log', 'error'));

internals.monitorOptions = Joi.object().keys({
    alwaysMeasureOps: Joi.boolean(),
    broadcastInterval: Joi.number().integer(),
    extendedRequests: Joi.boolean(),
    maxLogSize: Joi.number().integer(),
    opsInterval: Joi.number().integer().min(100),
    requestsEvent: Joi.string().valid('response','tail'),
    requestTimeout: Joi.number().integer(),
    schemaName: Joi.string(),
    subscribers: Joi.object().required(),
    extraFields: Joi.object(),
    logRequestHeaders: Joi.boolean(),
    logRequestPayload: Joi.boolean(),
    logResponsePayload: Joi.boolean(),
    logPid: Joi.boolean()
});

internals.monitorSubscribers = Joi.object()
    .pattern(/.+/, Joi.alternatives([Joi.object().keys({
        tags: Joi.array(),
        events: internals.subscriptions
    }), internals.subscriptions]));
