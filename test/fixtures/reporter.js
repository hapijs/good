'use strict';

const Stream = require('stream');


const internals = {};


module.exports = internals.Reporter = class extends Stream.Transform {

    static name = 'test';

    constructor() {

        super({ objectMode: true });
    }

    _transform(value, enc, callback) {

        callback(null, JSON.stringify(value));
    }
};
