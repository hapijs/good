// Load modules


// Declare internals

var internals = {};


// Inherits a selected set of methods from an object, wrapping functions in asynchronous syntax and catching errors

exports.inheritAsync = function (self, obj, keys) {

    for (var i in obj) {

        if (obj.hasOwnProperty(i)) {

            self.prototype[i] = (function (fn) {

                return function (next) {

                    var result = null;
                    try {
                        result = fn();
                    }
                    catch (err) {
                        return next(err);
                    }

                    return next(null, result);
                };
            })(obj[i]);
        }
    }
};
