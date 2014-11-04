// Load modules


// Declare internals

var internals = {};

exports.makeContinuation = function (predicate) {

    return function (callback) {

        process.nextTick(function () {

            var result = predicate();
            callback(null, result);
        });
    };
};
