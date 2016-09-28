(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

module.exports.Dispatcher = require('./lib/Dispatcher');

},{"./lib/Dispatcher":3}],3:[function(require,module,exports){
(function (process){
/**
 * Copyright (c) 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Dispatcher
 * 
 * @preventMunge
 */

'use strict';

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var invariant = require('fbjs/lib/invariant');

var _prefix = 'ID_';

/**
 * Dispatcher is used to broadcast payloads to registered callbacks. This is
 * different from generic pub-sub systems in two ways:
 *
 *   1) Callbacks are not subscribed to particular events. Every payload is
 *      dispatched to every registered callback.
 *   2) Callbacks can be deferred in whole or part until other callbacks have
 *      been executed.
 *
 * For example, consider this hypothetical flight destination form, which
 * selects a default city when a country is selected:
 *
 *   var flightDispatcher = new Dispatcher();
 *
 *   // Keeps track of which country is selected
 *   var CountryStore = {country: null};
 *
 *   // Keeps track of which city is selected
 *   var CityStore = {city: null};
 *
 *   // Keeps track of the base flight price of the selected city
 *   var FlightPriceStore = {price: null}
 *
 * When a user changes the selected city, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'city-update',
 *     selectedCity: 'paris'
 *   });
 *
 * This payload is digested by `CityStore`:
 *
 *   flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'city-update') {
 *       CityStore.city = payload.selectedCity;
 *     }
 *   });
 *
 * When the user selects a country, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'country-update',
 *     selectedCountry: 'australia'
 *   });
 *
 * This payload is digested by both stores:
 *
 *   CountryStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       CountryStore.country = payload.selectedCountry;
 *     }
 *   });
 *
 * When the callback to update `CountryStore` is registered, we save a reference
 * to the returned token. Using this token with `waitFor()`, we can guarantee
 * that `CountryStore` is updated before the callback that updates `CityStore`
 * needs to query its data.
 *
 *   CityStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       // `CountryStore.country` may not be updated.
 *       flightDispatcher.waitFor([CountryStore.dispatchToken]);
 *       // `CountryStore.country` is now guaranteed to be updated.
 *
 *       // Select the default city for the new country
 *       CityStore.city = getDefaultCityForCountry(CountryStore.country);
 *     }
 *   });
 *
 * The usage of `waitFor()` can be chained, for example:
 *
 *   FlightPriceStore.dispatchToken =
 *     flightDispatcher.register(function(payload) {
 *       switch (payload.actionType) {
 *         case 'country-update':
 *         case 'city-update':
 *           flightDispatcher.waitFor([CityStore.dispatchToken]);
 *           FlightPriceStore.price =
 *             getFlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *     }
 *   });
 *
 * The `country-update` payload will be guaranteed to invoke the stores'
 * registered callbacks in order: `CountryStore`, `CityStore`, then
 * `FlightPriceStore`.
 */

var Dispatcher = (function () {
  function Dispatcher() {
    _classCallCheck(this, Dispatcher);

    this._callbacks = {};
    this._isDispatching = false;
    this._isHandled = {};
    this._isPending = {};
    this._lastID = 1;
  }

  /**
   * Registers a callback to be invoked with every dispatched payload. Returns
   * a token that can be used with `waitFor()`.
   */

  Dispatcher.prototype.register = function register(callback) {
    var id = _prefix + this._lastID++;
    this._callbacks[id] = callback;
    return id;
  };

  /**
   * Removes a callback based on its token.
   */

  Dispatcher.prototype.unregister = function unregister(id) {
    !this._callbacks[id] ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Dispatcher.unregister(...): `%s` does not map to a registered callback.', id) : invariant(false) : undefined;
    delete this._callbacks[id];
  };

  /**
   * Waits for the callbacks specified to be invoked before continuing execution
   * of the current callback. This method should only be used by a callback in
   * response to a dispatched payload.
   */

  Dispatcher.prototype.waitFor = function waitFor(ids) {
    !this._isDispatching ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Dispatcher.waitFor(...): Must be invoked while dispatching.') : invariant(false) : undefined;
    for (var ii = 0; ii < ids.length; ii++) {
      var id = ids[ii];
      if (this._isPending[id]) {
        !this._isHandled[id] ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Dispatcher.waitFor(...): Circular dependency detected while ' + 'waiting for `%s`.', id) : invariant(false) : undefined;
        continue;
      }
      !this._callbacks[id] ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Dispatcher.waitFor(...): `%s` does not map to a registered callback.', id) : invariant(false) : undefined;
      this._invokeCallback(id);
    }
  };

  /**
   * Dispatches a payload to all registered callbacks.
   */

  Dispatcher.prototype.dispatch = function dispatch(payload) {
    !!this._isDispatching ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.') : invariant(false) : undefined;
    this._startDispatching(payload);
    try {
      for (var id in this._callbacks) {
        if (this._isPending[id]) {
          continue;
        }
        this._invokeCallback(id);
      }
    } finally {
      this._stopDispatching();
    }
  };

  /**
   * Is this Dispatcher currently dispatching.
   */

  Dispatcher.prototype.isDispatching = function isDispatching() {
    return this._isDispatching;
  };

  /**
   * Call the callback stored with the given id. Also do some internal
   * bookkeeping.
   *
   * @internal
   */

  Dispatcher.prototype._invokeCallback = function _invokeCallback(id) {
    this._isPending[id] = true;
    this._callbacks[id](this._pendingPayload);
    this._isHandled[id] = true;
  };

  /**
   * Set up bookkeeping needed when dispatching.
   *
   * @internal
   */

  Dispatcher.prototype._startDispatching = function _startDispatching(payload) {
    for (var id in this._callbacks) {
      this._isPending[id] = false;
      this._isHandled[id] = false;
    }
    this._pendingPayload = payload;
    this._isDispatching = true;
  };

  /**
   * Clear bookkeeping used for dispatching.
   *
   * @internal
   */

  Dispatcher.prototype._stopDispatching = function _stopDispatching() {
    delete this._pendingPayload;
    this._isDispatching = false;
  };

  return Dispatcher;
})();

module.exports = Dispatcher;
}).call(this,require('_process'))

},{"_process":15,"fbjs/lib/invariant":4}],4:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule invariant
 */

"use strict";

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var invariant = function (condition, format, a, b, c, d, e, f) {
  if (process.env.NODE_ENV !== 'production') {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error('Invariant Violation: ' + format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
};

module.exports = invariant;
}).call(this,require('_process'))

},{"_process":15}],5:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var invariant = function(condition, format, a, b, c, d, e, f) {
  if (process.env.NODE_ENV !== 'production') {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error(
        'Minified exception occurred; use the non-minified dev environment ' +
        'for the full error message and additional helpful warnings.'
      );
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
};

module.exports = invariant;

}).call(this,require('_process'))

},{"_process":15}],6:[function(require,module,exports){
(function (global){
/**
 * @license
 * Lo-Dash 1.0.2 (Custom Build) <http://lodash.com/>
 * Build: `lodash modern -o ./dist/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.4.4 <http://underscorejs.org/>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * Available under MIT license <http://lodash.com/license>
 */
;(function(window, undefined) {

  /** Detect free variable `exports` */
  var freeExports = typeof exports == 'object' && exports;

  /** Detect free variable `module` */
  var freeModule = typeof module == 'object' && module && module.exports == freeExports && module;

  /** Detect free variable `global` and use it as `window` */
  var freeGlobal = typeof global == 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    window = freeGlobal;
  }

  /** Used for array and object method references */
  var arrayRef = [],
      objectRef = {};

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used internally to indicate various things */
  var indicatorObject = objectRef;

  /** Used by `cachedContains` as the default size when optimizations are enabled for large arrays */
  var largeArraySize = 30;

  /** Used to restore the original `_` reference in `noConflict` */
  var oldDash = window._;

  /** Used to match HTML entities */
  var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g;

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to detect if a method is native */
  var reNative = RegExp('^' +
    (objectRef.valueOf + '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/valueOf|for [^\]]+/g, '.+?') + '$'
  );

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-7.8.6
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to match HTML characters */
  var reUnescapedHtml = /[&<>"']/g;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** Native method shortcuts */
  var ceil = Math.ceil,
      concat = arrayRef.concat,
      floor = Math.floor,
      getPrototypeOf = reNative.test(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
      hasOwnProperty = objectRef.hasOwnProperty,
      push = arrayRef.push,
      toString = objectRef.toString;

  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeBind = reNative.test(nativeBind = slice.bind) && nativeBind,
      nativeIsArray = reNative.test(nativeIsArray = Array.isArray) && nativeIsArray,
      nativeIsFinite = window.isFinite,
      nativeIsNaN = window.isNaN,
      nativeKeys = reNative.test(nativeKeys = Object.keys) && nativeKeys,
      nativeMax = Math.max,
      nativeMin = Math.min,
      nativeRandom = Math.random;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Detect various environments */
  var isIeOpera = !!window.attachEvent,
      isV8 = nativeBind && !/\n|true/.test(nativeBind + isIeOpera);

  /* Detect if `Function#bind` exists and is inferred to be fast (all but V8) */
  var isBindFast = nativeBind && !isV8;

  /* Detect if `Object.keys` exists and is inferred to be fast (IE, Opera, V8) */
  var isKeysFast = nativeKeys && (isIeOpera || isV8);

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used to lookup a built-in constructor by [[Class]] */
  var ctorByClass = {};
  ctorByClass[arrayClass] = Array;
  ctorByClass[boolClass] = Boolean;
  ctorByClass[dateClass] = Date;
  ctorByClass[objectClass] = Object;
  ctorByClass[numberClass] = Number;
  ctorByClass[regexpClass] = RegExp;
  ctorByClass[stringClass] = String;

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a `lodash` object, that wraps the given `value`, to enable method
   * chaining.
   *
   * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
   * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
   * and `unshift`
   *
   * The chainable wrapper functions are:
   * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`, `compose`,
   * `concat`, `countBy`, `debounce`, `defaults`, `defer`, `delay`, `difference`,
   * `filter`, `flatten`, `forEach`, `forIn`, `forOwn`, `functions`, `groupBy`,
   * `initial`, `intersection`, `invert`, `invoke`, `keys`, `map`, `max`, `memoize`,
   * `merge`, `min`, `object`, `omit`, `once`, `pairs`, `partial`, `partialRight`,
   * `pick`, `pluck`, `push`, `range`, `reject`, `rest`, `reverse`, `shuffle`,
   * `slice`, `sort`, `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`,
   * `union`, `uniq`, `unshift`, `values`, `where`, `without`, `wrap`, and `zip`
   *
   * The non-chainable wrapper functions are:
   * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `has`, `identity`,
   * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`, `isEmpty`,
   * `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`, `isObject`,
   * `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`, `lastIndexOf`,
   * `mixin`, `noConflict`, `pop`, `random`, `reduce`, `reduceRight`, `result`,
   * `shift`, `size`, `some`, `sortedIndex`, `template`, `unescape`, and `uniqueId`
   *
   * The wrapper functions `first` and `last` return wrapped values when `n` is
   * passed, otherwise they return unwrapped values.
   *
   * @name _
   * @constructor
   * @category Chaining
   * @param {Mixed} value The value to wrap in a `lodash` instance.
   * @returns {Object} Returns a `lodash` instance.
   */
  function lodash(value) {
    // exit early if already wrapped, even if wrapped by a different `lodash` constructor
    if (value && typeof value == 'object' && value.__wrapped__) {
      return value;
    }
    // allow invoking `lodash` without the `new` operator
    if (!(this instanceof lodash)) {
      return new lodash(value);
    }
    this.__wrapped__ = value;
  }

  /**
   * By default, the template delimiters used by Lo-Dash are similar to those in
   * embedded Ruby (ERB). Change the following template settings to use alternative
   * delimiters.
   *
   * @static
   * @memberOf _
   * @type Object
   */
  lodash.templateSettings = {

    /**
     * Used to detect `data` property values to be HTML-escaped.
     *
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'escape': /<%-([\s\S]+?)%>/g,

    /**
     * Used to detect code to be evaluated.
     *
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'evaluate': /<%([\s\S]+?)%>/g,

    /**
     * Used to detect `data` property values to inject.
     *
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'interpolate': reInterpolate,

    /**
     * Used to reference the data object in the template text.
     *
     * @memberOf _.templateSettings
     * @type String
     */
    'variable': '',

    /**
     * Used to import variables into the compiled template.
     *
     * @memberOf _.templateSettings
     * @type Object
     */
    'imports': {

      /**
       * A reference to the `lodash` function.
       *
       * @memberOf _.templateSettings.imports
       * @type Function
       */
      '_': lodash
    }
  };

  /*--------------------------------------------------------------------------*/

  /**
   * The template used to create iterator functions.
   *
   * @private
   * @param {Obect} data The data object used to populate the text.
   * @returns {String} Returns the interpolated text.
   */
  var iteratorTemplate = function(obj) {
    
    var __p = 'var index, iterable = ' +
    (obj.firstArg ) +
    ', result = iterable;\nif (!iterable) return result;\n' +
    (obj.top ) +
    ';\n';
     if (obj.arrays) {
    __p += 'var length = iterable.length; index = -1;\nif (' +
    (obj.arrays ) +
    ') {\n  while (++index < length) {\n    ' +
    (obj.loop ) +
    '\n  }\n}\nelse {  ';
     } ;
    
     if (obj.isKeysFast && obj.useHas) {
    __p += '\n  var ownIndex = -1,\n      ownProps = objectTypes[typeof iterable] ? nativeKeys(iterable) : [],\n      length = ownProps.length;\n\n  while (++ownIndex < length) {\n    index = ownProps[ownIndex];\n    ' +
    (obj.loop ) +
    '\n  }  ';
     } else {
    __p += '\n  for (index in iterable) {';
        if (obj.useHas) {
    __p += '\n    if (';
          if (obj.useHas) {
    __p += 'hasOwnProperty.call(iterable, index)';
     }    ;
    __p += ') {    ';
     } ;
    __p += 
    (obj.loop ) +
    ';    ';
     if (obj.useHas) {
    __p += '\n    }';
     } ;
    __p += '\n  }  ';
     } ;
    
     if (obj.arrays) {
    __p += '\n}';
     } ;
    __p += 
    (obj.bottom ) +
    ';\nreturn result';
    
    
    return __p
  };

  /** Reusable iterator options for `assign` and `defaults` */
  var defaultsIteratorOptions = {
    'args': 'object, source, guard',
    'top':
      'var args = arguments,\n' +
      '    argsIndex = 0,\n' +
      "    argsLength = typeof guard == 'number' ? 2 : args.length;\n" +
      'while (++argsIndex < argsLength) {\n' +
      '  iterable = args[argsIndex];\n' +
      '  if (iterable && objectTypes[typeof iterable]) {',
    'loop': "if (typeof result[index] == 'undefined') result[index] = iterable[index]",
    'bottom': '  }\n}'
  };

  /** Reusable iterator options shared by `each`, `forIn`, and `forOwn` */
  var eachIteratorOptions = {
    'args': 'collection, callback, thisArg',
    'top': "callback = callback && typeof thisArg == 'undefined' ? callback : createCallback(callback, thisArg)",
    'arrays': "typeof length == 'number'",
    'loop': 'if (callback(iterable[index], index, collection) === false) return result'
  };

  /** Reusable iterator options for `forIn` and `forOwn` */
  var forOwnIteratorOptions = {
    'top': 'if (!objectTypes[typeof iterable]) return result;\n' + eachIteratorOptions.top,
    'arrays': false
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a function optimized to search large arrays for a given `value`,
   * starting at `fromIndex`, using strict equality for comparisons, i.e. `===`.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Number} [fromIndex=0] The index to search from.
   * @param {Number} [largeSize=30] The length at which an array is considered large.
   * @returns {Boolean} Returns `true`, if `value` is found, else `false`.
   */
  function cachedContains(array, fromIndex, largeSize) {
    fromIndex || (fromIndex = 0);

    var length = array.length,
        isLarge = (length - fromIndex) >= (largeSize || largeArraySize);

    if (isLarge) {
      var cache = {},
          index = fromIndex - 1;

      while (++index < length) {
        // manually coerce `value` to a string because `hasOwnProperty`, in some
        // older versions of Firefox, coerces objects incorrectly
        var key = array[index] + '';
        (hasOwnProperty.call(cache, key) ? cache[key] : (cache[key] = [])).push(array[index]);
      }
    }
    return function(value) {
      if (isLarge) {
        var key = value + '';
        return hasOwnProperty.call(cache, key) && indexOf(cache[key], value) > -1;
      }
      return indexOf(array, value, fromIndex) > -1;
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default `callback` when a given
   * `collection` is a string value.
   *
   * @private
   * @param {String} value The character to inspect.
   * @returns {Number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` values, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {Number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ai = a.index,
        bi = b.index;

    a = a.criteria;
    b = b.criteria;

    // ensure a stable sort in V8 and other engines
    // http://code.google.com/p/v8/issues/detail?id=90
    if (a !== b) {
      if (a > b || typeof a == 'undefined') {
        return 1;
      }
      if (a < b || typeof b == 'undefined') {
        return -1;
      }
    }
    return ai < bi ? -1 : 1;
  }

  /**
   * Creates a function that, when called, invokes `func` with the `this` binding
   * of `thisArg` and prepends any `partialArgs` to the arguments passed to the
   * bound function.
   *
   * @private
   * @param {Function|String} func The function to bind or the method name.
   * @param {Mixed} [thisArg] The `this` binding of `func`.
   * @param {Array} partialArgs An array of arguments to be partially applied.
   * @param {Object} [rightIndicator] Used to indicate partially applying arguments from the right.
   * @returns {Function} Returns the new bound function.
   */
  function createBound(func, thisArg, partialArgs, rightIndicator) {
    var isFunc = isFunction(func),
        isPartial = !partialArgs,
        key = thisArg;

    // juggle arguments
    if (isPartial) {
      partialArgs = thisArg;
    }
    if (!isFunc) {
      thisArg = func;
    }

    function bound() {
      // `Function#bind` spec
      // http://es5.github.com/#x15.3.4.5
      var args = arguments,
          thisBinding = isPartial ? this : thisArg;

      if (!isFunc) {
        func = thisArg[key];
      }
      if (partialArgs.length) {
        args = args.length
          ? (args = slice(args), rightIndicator ? args.concat(partialArgs) : partialArgs.concat(args))
          : partialArgs;
      }
      if (this instanceof bound) {
        // ensure `new bound` is an instance of `bound` and `func`
        noop.prototype = func.prototype;
        thisBinding = new noop;
        noop.prototype = null;

        // mimic the constructor's `return` behavior
        // http://es5.github.com/#x13.2.2
        var result = func.apply(thisBinding, args);
        return isObject(result) ? result : thisBinding;
      }
      return func.apply(thisBinding, args);
    }
    return bound;
  }

  /**
   * Produces a callback bound to an optional `thisArg`. If `func` is a property
   * name, the created callback will return the property value for a given element.
   * If `func` is an object, the created callback will return `true` for elements
   * that contain the equivalent object properties, otherwise it will return `false`.
   *
   * @private
   * @param {Mixed} [func=identity] The value to convert to a callback.
   * @param {Mixed} [thisArg] The `this` binding of the created callback.
   * @param {Number} [argCount=3] The number of arguments the callback accepts.
   * @returns {Function} Returns a callback function.
   */
  function createCallback(func, thisArg, argCount) {
    if (func == null) {
      return identity;
    }
    var type = typeof func;
    if (type != 'function') {
      if (type != 'object') {
        return function(object) {
          return object[func];
        };
      }
      var props = keys(func);
      return function(object) {
        var length = props.length,
            result = false;
        while (length--) {
          if (!(result = isEqual(object[props[length]], func[props[length]], indicatorObject))) {
            break;
          }
        }
        return result;
      };
    }
    if (typeof thisArg != 'undefined') {
      if (argCount === 1) {
        return function(value) {
          return func.call(thisArg, value);
        };
      }
      if (argCount === 2) {
        return function(a, b) {
          return func.call(thisArg, a, b);
        };
      }
      if (argCount === 4) {
        return function(accumulator, value, index, object) {
          return func.call(thisArg, accumulator, value, index, object);
        };
      }
      return function(value, index, object) {
        return func.call(thisArg, value, index, object);
      };
    }
    return func;
  }

  /**
   * Creates compiled iteration functions.
   *
   * @private
   * @param {Object} [options1, options2, ...] The compile options object(s).
   *  arrays - A string of code to determine if the iterable is an array or array-like.
   *  useHas - A boolean to specify using `hasOwnProperty` checks in the object loop.
   *  args - A string of comma separated arguments the iteration function will accept.
   *  top - A string of code to execute before the iteration branches.
   *  loop - A string of code to execute in the object loop.
   *  bottom - A string of code to execute after the iteration branches.
   *
   * @returns {Function} Returns the compiled function.
   */
  function createIterator() {
    var data = {
      // support properties
      'isKeysFast': isKeysFast,

      // iterator options
      'arrays': 'isArray(iterable)',
      'bottom': '',
      'loop': '',
      'top': '',
      'useHas': true
    };

    // merge options into a template data object
    for (var object, index = 0; object = arguments[index]; index++) {
      for (var key in object) {
        data[key] = object[key];
      }
    }
    var args = data.args;
    data.firstArg = /^[^,]+/.exec(args)[0];

    // create the function factory
    var factory = Function(
        'createCallback, hasOwnProperty, isArguments, isArray, isString, ' +
        'objectTypes, nativeKeys',
      'return function(' + args + ') {\n' + iteratorTemplate(data) + '\n}'
    );
    // return the compiled function
    return factory(
      createCallback, hasOwnProperty, isArguments, isArray, isString,
      objectTypes, nativeKeys
    );
  }

  /**
   * A function compiled to iterate `arguments` objects, arrays, objects, and
   * strings consistenly across environments, executing the `callback` for each
   * element in the `collection`. The `callback` is bound to `thisArg` and invoked
   * with three arguments; (value, index|key, collection). Callbacks may exit
   * iteration early by explicitly returning `false`.
   *
   * @private
   * @type Function
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array|Object|String} Returns `collection`.
   */
  var each = createIterator(eachIteratorOptions);

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {String} match The matched character to escape.
   * @returns {String} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Used by `escape` to convert characters to HTML entities.
   *
   * @private
   * @param {String} match The matched character to escape.
   * @returns {String} Returns the escaped character.
   */
  function escapeHtmlChar(match) {
    return htmlEscapes[match];
  }

  /**
   * Checks if `value` is a DOM node in IE < 9.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a DOM node, else `false`.
   */
  function isNode(value) {
    // IE < 9 presents DOM nodes as `Object` objects except they have `toString`
    // methods that are `typeof` "string" and still can coerce nodes to strings
    return typeof value.toString != 'function' && typeof (value + '') == 'string';
  }

  /**
   * A no-operation function.
   *
   * @private
   */
  function noop() {
    // no operation performed
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used, instead of `Array#slice`, to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|String} collection The collection to slice.
   * @param {Number} start The start index.
   * @param {Number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /**
   * Used by `unescape` to convert HTML entities to characters.
   *
   * @private
   * @param {String} match The matched character to unescape.
   * @returns {String} Returns the unescaped character.
   */
  function unescapeHtmlChar(match) {
    return htmlUnescapes[match];
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Checks if `value` is an `arguments` object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is an `arguments` object, else `false`.
   * @example
   *
   * (function() { return _.isArguments(arguments); })(1, 2, 3);
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */
  function isArguments(value) {
    return toString.call(value) == argsClass;
  }

  /**
   * Iterates over `object`'s own and inherited enumerable properties, executing
   * the `callback` for each property. The `callback` is bound to `thisArg` and
   * invoked with three arguments; (value, key, object). Callbacks may exit iteration
   * early by explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * function Dog(name) {
   *   this.name = name;
   * }
   *
   * Dog.prototype.bark = function() {
   *   alert('Woof, woof!');
   * };
   *
   * _.forIn(new Dog('Dagny'), function(value, key) {
   *   alert(key);
   * });
   * // => alerts 'name' and 'bark' (order is not guaranteed)
   */
  var forIn = createIterator(eachIteratorOptions, forOwnIteratorOptions, {
    'useHas': false
  });

  /**
   * Iterates over an object's own enumerable properties, executing the `callback`
   * for each property. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, key, object). Callbacks may exit iteration early by explicitly
   * returning `false`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
   *   alert(key);
   * });
   * // => alerts '0', '1', and 'length' (order is not guaranteed)
   */
  var forOwn = createIterator(eachIteratorOptions, forOwnIteratorOptions);

  /**
   * Checks if `value` is an array.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is an array, else `false`.
   * @example
   *
   * (function() { return _.isArray(arguments); })();
   * // => false
   *
   * _.isArray([1, 2, 3]);
   * // => true
   */
  var isArray = nativeIsArray || function(value) {
    // `instanceof` may cause a memory leak in IE 7 if `value` is a host object
    // http://ajaxian.com/archives/working-aroung-the-instanceof-memory-leak
    return value instanceof Array || toString.call(value) == arrayClass;
  };

  /**
   * Creates an array composed of the own enumerable property names of `object`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names.
   * @example
   *
   * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
   * // => ['one', 'two', 'three'] (order is not guaranteed)
   */
  var keys = !nativeKeys ? shimKeys : function(object) {
    if (!isObject(object)) {
      return [];
    }
    return nativeKeys(object);
  };

  /**
   * A fallback implementation of `isPlainObject` that checks if a given `value`
   * is an object created by the `Object` constructor, assuming objects created
   * by the `Object` constructor have no inherited enumerable properties and that
   * there are no `Object.prototype` extensions.
   *
   * @private
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if `value` is a plain object, else `false`.
   */
  function shimIsPlainObject(value) {
    // avoid non-objects and false positives for `arguments` objects
    var result = false;
    if (!(value && typeof value == 'object') || isArguments(value)) {
      return result;
    }
    // check that the constructor is `Object` (i.e. `Object instanceof Object`)
    var ctor = value.constructor;
    if ((!isFunction(ctor)) || ctor instanceof ctor) {
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return result === false || hasOwnProperty.call(value, result);
    }
    return result;
  }

  /**
   * A fallback implementation of `Object.keys` that produces an array of the
   * given object's own enumerable property names.
   *
   * @private
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names.
   */
  function shimKeys(object) {
    var result = [];
    forOwn(object, function(value, key) {
      result.push(key);
    });
    return result;
  }

  /**
   * Used to convert characters to HTML entities:
   *
   * Though the `>` character is escaped for symmetry, characters like `>` and `/`
   * don't require escaping in HTML and have no special meaning unless they're part
   * of a tag or an unquoted attribute value.
   * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
   */
  var htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  /** Used to convert HTML entities to characters */
  var htmlUnescapes = invert(htmlEscapes);

  /*--------------------------------------------------------------------------*/

  /**
   * Assigns own enumerable properties of source object(s) to the destination
   * object. Subsequent sources will overwrite propery assignments of previous
   * sources. If a `callback` function is passed, it will be executed to produce
   * the assigned values. The `callback` is bound to `thisArg` and invoked with
   * two arguments; (objectValue, sourceValue).
   *
   * @static
   * @memberOf _
   * @type Function
   * @alias extend
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [source1, source2, ...] The source objects.
   * @param {Function} [callback] The function to customize assigning values.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * _.assign({ 'name': 'moe' }, { 'age': 40 });
   * // => { 'name': 'moe', 'age': 40 }
   *
   * var defaults = _.partialRight(_.assign, function(a, b) {
   *   return typeof a == 'undefined' ? b : a;
   * });
   *
   * var food = { 'name': 'apple' };
   * defaults(food, { 'name': 'banana', 'type': 'fruit' });
   * // => { 'name': 'apple', 'type': 'fruit' }
   */
  var assign = createIterator(defaultsIteratorOptions, {
    'top':
      defaultsIteratorOptions.top.replace(';',
        ';\n' +
        "if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {\n" +
        '  var callback = createCallback(args[--argsLength - 1], args[argsLength--], 2);\n' +
        "} else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {\n" +
        '  callback = args[--argsLength];\n' +
        '}'
      ),
    'loop': 'result[index] = callback ? callback(result[index], iterable[index]) : iterable[index]'
  });

  /**
   * Creates a clone of `value`. If `deep` is `true`, nested objects will also
   * be cloned, otherwise they will be assigned by reference. If a `callback`
   * function is passed, it will be executed to produce the cloned values. If
   * `callback` returns `undefined`, cloning will be handled by the method instead.
   * The `callback` is bound to `thisArg` and invoked with one argument; (value).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to clone.
   * @param {Boolean} [deep=false] A flag to indicate a deep clone.
   * @param {Function} [callback] The function to customize cloning values.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @param- {Array} [stackA=[]] Internally used to track traversed source objects.
   * @param- {Array} [stackB=[]] Internally used to associate clones with source counterparts.
   * @returns {Mixed} Returns the cloned `value`.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * var shallow = _.clone(stooges);
   * shallow[0] === stooges[0];
   * // => true
   *
   * var deep = _.clone(stooges, true);
   * deep[0] === stooges[0];
   * // => false
   *
   * _.mixin({
   *   'clone': _.partialRight(_.clone, function(value) {
   *     return _.isElement(value) ? value.cloneNode(false) : undefined;
   *   })
   * });
   *
   * var clone = _.clone(document.body);
   * clone.childNodes.length;
   * // => 0
   */
  function clone(value, deep, callback, thisArg, stackA, stackB) {
    var result = value;

    // allows working with "Collections" methods without using their `callback`
    // argument, `index|key`, for this method's `callback`
    if (typeof deep == 'function') {
      thisArg = callback;
      callback = deep;
      deep = false;
    }
    if (typeof callback == 'function') {
      callback = typeof thisArg == 'undefined' ? callback : createCallback(callback, thisArg, 1);
      result = callback(result);

      var done = typeof result != 'undefined';
      if (!done) {
        result = value;
      }
    }
    // inspect [[Class]]
    var isObj = isObject(result);
    if (isObj) {
      var className = toString.call(result);
      if (!cloneableClasses[className]) {
        return result;
      }
      var isArr = isArray(result);
    }
    // shallow clone
    if (!isObj || !deep) {
      return isObj && !done
        ? (isArr ? slice(result) : assign({}, result))
        : result;
    }
    var ctor = ctorByClass[className];
    switch (className) {
      case boolClass:
      case dateClass:
        return done ? result : new ctor(+result);

      case numberClass:
      case stringClass:
        return done ? result : new ctor(result);

      case regexpClass:
        return done ? result : ctor(result.source, reFlags.exec(result));
    }
    // check for circular references and return corresponding clone
    stackA || (stackA = []);
    stackB || (stackB = []);

    var length = stackA.length;
    while (length--) {
      if (stackA[length] == value) {
        return stackB[length];
      }
    }
    // init cloned object
    if (!done) {
      result = isArr ? ctor(result.length) : {};

      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
    }
    // add the source value to the stack of traversed objects
    // and associate it with its clone
    stackA.push(value);
    stackB.push(result);

    // recursively populate clone (susceptible to call stack limits)
    (isArr ? forEach : forOwn)(done ? result : value, function(objValue, key) {
      result[key] = clone(objValue, deep, callback, undefined, stackA, stackB);
    });

    return result;
  }

  /**
   * Creates a deep clone of `value`. If a `callback` function is passed, it will
   * be executed to produce the cloned values. If `callback` returns the value it
   * was passed, cloning will be handled by the method instead. The `callback` is
   * bound to `thisArg` and invoked with one argument; (value).
   *
   * Note: This function is loosely based on the structured clone algorithm. Functions
   * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
   * objects created by constructors other than `Object` are cloned to plain `Object` objects.
   * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to deep clone.
   * @param {Function} [callback] The function to customize cloning values.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the deep cloned `value`.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * var deep = _.cloneDeep(stooges);
   * deep[0] === stooges[0];
   * // => false
   *
   * var view = {
   *   'label': 'docs',
   *   'node': element
   * };
   *
   * var clone = _.cloneDeep(view, function(value) {
   *   return _.isElement(value) ? value.cloneNode(true) : value;
   * });
   *
   * clone.node == view.node;
   * // => false
   */
  function cloneDeep(value, callback, thisArg) {
    return clone(value, true, callback, thisArg);
  }

  /**
   * Assigns own enumerable properties of source object(s) to the destination
   * object for all destination properties that resolve to `undefined`. Once a
   * property is set, additional defaults of the same property will be ignored.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [source1, source2, ...] The source objects.
   * @param- {Object} [guard] Internally used to allow working with `_.reduce`
   *  without using its callback's `key` and `object` arguments as sources.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * var food = { 'name': 'apple' };
   * _.defaults(food, { 'name': 'banana', 'type': 'fruit' });
   * // => { 'name': 'apple', 'type': 'fruit' }
   */
  var defaults = createIterator(defaultsIteratorOptions);

  /**
   * Creates a sorted array of all enumerable properties, own and inherited,
   * of `object` that have function values.
   *
   * @static
   * @memberOf _
   * @alias methods
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names that have function values.
   * @example
   *
   * _.functions(_);
   * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
   */
  function functions(object) {
    var result = [];
    forIn(object, function(value, key) {
      if (isFunction(value)) {
        result.push(key);
      }
    });
    return result.sort();
  }

  /**
   * Checks if the specified object `property` exists and is a direct property,
   * instead of an inherited property.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to check.
   * @param {String} property The property to check for.
   * @returns {Boolean} Returns `true` if key is a direct property, else `false`.
   * @example
   *
   * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
   * // => true
   */
  function has(object, property) {
    return object ? hasOwnProperty.call(object, property) : false;
  }

  /**
   * Creates an object composed of the inverted keys and values of the given `object`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to invert.
   * @returns {Object} Returns the created inverted object.
   * @example
   *
   *  _.invert({ 'first': 'moe', 'second': 'larry' });
   * // => { 'moe': 'first', 'larry': 'second' } (order is not guaranteed)
   */
  function invert(object) {
    var index = -1,
        props = keys(object),
        length = props.length,
        result = {};

    while (++index < length) {
      var key = props[index];
      result[object[key]] = key;
    }
    return result;
  }

  /**
   * Checks if `value` is a boolean value.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a boolean value, else `false`.
   * @example
   *
   * _.isBoolean(null);
   * // => false
   */
  function isBoolean(value) {
    return value === true || value === false || toString.call(value) == boolClass;
  }

  /**
   * Checks if `value` is a date.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a date, else `false`.
   * @example
   *
   * _.isDate(new Date);
   * // => true
   */
  function isDate(value) {
    return value instanceof Date || toString.call(value) == dateClass;
  }

  /**
   * Checks if `value` is a DOM element.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a DOM element, else `false`.
   * @example
   *
   * _.isElement(document.body);
   * // => true
   */
  function isElement(value) {
    return value ? value.nodeType === 1 : false;
  }

  /**
   * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
   * length of `0` and objects with no own enumerable properties are considered
   * "empty".
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Array|Object|String} value The value to inspect.
   * @returns {Boolean} Returns `true`, if the `value` is empty, else `false`.
   * @example
   *
   * _.isEmpty([1, 2, 3]);
   * // => false
   *
   * _.isEmpty({});
   * // => true
   *
   * _.isEmpty('');
   * // => true
   */
  function isEmpty(value) {
    var result = true;
    if (!value) {
      return result;
    }
    var className = toString.call(value),
        length = value.length;

    if ((className == arrayClass || className == stringClass ||
        className == argsClass) ||
        (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
      return !length;
    }
    forOwn(value, function() {
      return (result = false);
    });
    return result;
  }

  /**
   * Performs a deep comparison between two values to determine if they are
   * equivalent to each other. If `callback` is passed, it will be executed to
   * compare values. If `callback` returns `undefined`, comparisons will be handled
   * by the method instead. The `callback` is bound to `thisArg` and invoked with
   * two arguments; (a, b).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} a The value to compare.
   * @param {Mixed} b The other value to compare.
   * @param {Function} [callback] The function to customize comparing values.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @param- {Object} [stackA=[]] Internally used track traversed `a` objects.
   * @param- {Object} [stackB=[]] Internally used track traversed `b` objects.
   * @returns {Boolean} Returns `true`, if the values are equvalent, else `false`.
   * @example
   *
   * var moe = { 'name': 'moe', 'age': 40 };
   * var copy = { 'name': 'moe', 'age': 40 };
   *
   * moe == copy;
   * // => false
   *
   * _.isEqual(moe, copy);
   * // => true
   *
   * var words = ['hello', 'goodbye'];
   * var otherWords = ['hi', 'goodbye'];
   *
   * _.isEqual(words, otherWords, function(a, b) {
   *   var reGreet = /^(?:hello|hi)$/i,
   *       aGreet = _.isString(a) && reGreet.test(a),
   *       bGreet = _.isString(b) && reGreet.test(b);
   *
   *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
   * });
   * // => true
   */
  function isEqual(a, b, callback, thisArg, stackA, stackB) {
    // used to indicate that when comparing objects, `a` has at least the properties of `b`
    var whereIndicator = callback === indicatorObject;
    if (callback && !whereIndicator) {
      callback = typeof thisArg == 'undefined' ? callback : createCallback(callback, thisArg, 2);
      var result = callback(a, b);
      if (typeof result != 'undefined') {
        return !!result;
      }
    }
    // exit early for identical values
    if (a === b) {
      // treat `+0` vs. `-0` as not equal
      return a !== 0 || (1 / a == 1 / b);
    }
    var type = typeof a,
        otherType = typeof b;

    // exit early for unlike primitive values
    if (a === a &&
        (!a || (type != 'function' && type != 'object')) &&
        (!b || (otherType != 'function' && otherType != 'object'))) {
      return false;
    }
    // exit early for `null` and `undefined`, avoiding ES3's Function#call behavior
    // http://es5.github.com/#x15.3.4.4
    if (a == null || b == null) {
      return a === b;
    }
    // compare [[Class]] names
    var className = toString.call(a),
        otherClass = toString.call(b);

    if (className == argsClass) {
      className = objectClass;
    }
    if (otherClass == argsClass) {
      otherClass = objectClass;
    }
    if (className != otherClass) {
      return false;
    }
    switch (className) {
      case boolClass:
      case dateClass:
        // coerce dates and booleans to numbers, dates to milliseconds and booleans
        // to `1` or `0`, treating invalid dates coerced to `NaN` as not equal
        return +a == +b;

      case numberClass:
        // treat `NaN` vs. `NaN` as equal
        return a != +a
          ? b != +b
          // but treat `+0` vs. `-0` as not equal
          : (a == 0 ? (1 / a == 1 / b) : a == +b);

      case regexpClass:
      case stringClass:
        // coerce regexes to strings (http://es5.github.com/#x15.10.6.4)
        // treat string primitives and their corresponding object instances as equal
        return a == b + '';
    }
    var isArr = className == arrayClass;
    if (!isArr) {
      // unwrap any `lodash` wrapped values
      if (a.__wrapped__ || b.__wrapped__) {
        return isEqual(a.__wrapped__ || a, b.__wrapped__ || b, callback, thisArg, stackA, stackB);
      }
      // exit for functions and DOM nodes
      if (className != objectClass) {
        return false;
      }
      // in older versions of Opera, `arguments` objects have `Array` constructors
      var ctorA = a.constructor,
          ctorB = b.constructor;

      // non `Object` object instances with different constructors are not equal
      if (ctorA != ctorB && !(
            isFunction(ctorA) && ctorA instanceof ctorA &&
            isFunction(ctorB) && ctorB instanceof ctorB
          )) {
        return false;
      }
    }
    // assume cyclic structures are equal
    // the algorithm for detecting cyclic structures is adapted from ES 5.1
    // section 15.12.3, abstract operation `JO` (http://es5.github.com/#x15.12.3)
    stackA || (stackA = []);
    stackB || (stackB = []);

    var length = stackA.length;
    while (length--) {
      if (stackA[length] == a) {
        return stackB[length] == b;
      }
    }
    var size = 0;
    result = true;

    // add `a` and `b` to the stack of traversed objects
    stackA.push(a);
    stackB.push(b);

    // recursively compare objects and arrays (susceptible to call stack limits)
    if (isArr) {
      length = a.length;
      size = b.length;

      // compare lengths to determine if a deep comparison is necessary
      result = size == a.length;
      if (!result && !whereIndicator) {
        return result;
      }
      // deep compare the contents, ignoring non-numeric properties
      while (size--) {
        var index = length,
            value = b[size];

        if (whereIndicator) {
          while (index--) {
            if ((result = isEqual(a[index], value, callback, thisArg, stackA, stackB))) {
              break;
            }
          }
        } else if (!(result = isEqual(a[size], value, callback, thisArg, stackA, stackB))) {
          break;
        }
      }
      return result;
    }
    // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
    // which, in this case, is more costly
    forIn(b, function(value, key, b) {
      if (hasOwnProperty.call(b, key)) {
        // count the number of properties.
        size++;
        // deep compare each property value.
        return (result = hasOwnProperty.call(a, key) && isEqual(a[key], value, callback, thisArg, stackA, stackB));
      }
    });

    if (result && !whereIndicator) {
      // ensure both objects have the same number of properties
      forIn(a, function(value, key, a) {
        if (hasOwnProperty.call(a, key)) {
          // `size` will be `-1` if `a` has more properties than `b`
          return (result = --size > -1);
        }
      });
    }
    return result;
  }

  /**
   * Checks if `value` is, or can be coerced to, a finite number.
   *
   * Note: This is not the same as native `isFinite`, which will return true for
   * booleans and empty strings. See http://es5.github.com/#x15.1.2.5.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is finite, else `false`.
   * @example
   *
   * _.isFinite(-101);
   * // => true
   *
   * _.isFinite('10');
   * // => true
   *
   * _.isFinite(true);
   * // => false
   *
   * _.isFinite('');
   * // => false
   *
   * _.isFinite(Infinity);
   * // => false
   */
  function isFinite(value) {
    return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
  }

  /**
   * Checks if `value` is a function.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   */
  function isFunction(value) {
    return typeof value == 'function';
  }
  // fallback for older versions of Chrome and Safari
  if (isFunction(/x/)) {
    isFunction = function(value) {
      return value instanceof Function || toString.call(value) == funcClass;
    };
  }

  /**
   * Checks if `value` is the language type of Object.
   * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(1);
   * // => false
   */
  function isObject(value) {
    // check if the value is the ECMAScript language type of Object
    // http://es5.github.com/#x8
    // and avoid a V8 bug
    // http://code.google.com/p/v8/issues/detail?id=2291
    return value ? objectTypes[typeof value] : false;
  }

  /**
   * Checks if `value` is `NaN`.
   *
   * Note: This is not the same as native `isNaN`, which will return `true` for
   * `undefined` and other values. See http://es5.github.com/#x15.1.2.4.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is `NaN`, else `false`.
   * @example
   *
   * _.isNaN(NaN);
   * // => true
   *
   * _.isNaN(new Number(NaN));
   * // => true
   *
   * isNaN(undefined);
   * // => true
   *
   * _.isNaN(undefined);
   * // => false
   */
  function isNaN(value) {
    // `NaN` as a primitive is the only value that is not equal to itself
    // (perform the [[Class]] check first to avoid errors with some host objects in IE)
    return isNumber(value) && value != +value
  }

  /**
   * Checks if `value` is `null`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is `null`, else `false`.
   * @example
   *
   * _.isNull(null);
   * // => true
   *
   * _.isNull(undefined);
   * // => false
   */
  function isNull(value) {
    return value === null;
  }

  /**
   * Checks if `value` is a number.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a number, else `false`.
   * @example
   *
   * _.isNumber(8.4 * 5);
   * // => true
   */
  function isNumber(value) {
    return typeof value == 'number' || toString.call(value) == numberClass;
  }

  /**
   * Checks if a given `value` is an object created by the `Object` constructor.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if `value` is a plain object, else `false`.
   * @example
   *
   * function Stooge(name, age) {
   *   this.name = name;
   *   this.age = age;
   * }
   *
   * _.isPlainObject(new Stooge('moe', 40));
   * // => false
   *
   * _.isPlainObject([1, 2, 3]);
   * // => false
   *
   * _.isPlainObject({ 'name': 'moe', 'age': 40 });
   * // => true
   */
  var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
    if (!(value && typeof value == 'object')) {
      return false;
    }
    var valueOf = value.valueOf,
        objProto = typeof valueOf == 'function' && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

    return objProto
      ? value == objProto || (getPrototypeOf(value) == objProto && !isArguments(value))
      : shimIsPlainObject(value);
  };

  /**
   * Checks if `value` is a regular expression.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a regular expression, else `false`.
   * @example
   *
   * _.isRegExp(/moe/);
   * // => true
   */
  function isRegExp(value) {
    return value instanceof RegExp || toString.call(value) == regexpClass;
  }

  /**
   * Checks if `value` is a string.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is a string, else `false`.
   * @example
   *
   * _.isString('moe');
   * // => true
   */
  function isString(value) {
    return typeof value == 'string' || toString.call(value) == stringClass;
  }

  /**
   * Checks if `value` is `undefined`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true`, if the `value` is `undefined`, else `false`.
   * @example
   *
   * _.isUndefined(void 0);
   * // => true
   */
  function isUndefined(value) {
    return typeof value == 'undefined';
  }

  /**
   * Recursively merges own enumerable properties of the source object(s), that
   * don't resolve to `undefined`, into the destination object. Subsequent sources
   * will overwrite propery assignments of previous sources. If a `callback` function
   * is passed, it will be executed to produce the merged values of the destination
   * and source properties. If `callback` returns `undefined`, merging will be
   * handled by the method instead. The `callback` is bound to `thisArg` and
   * invoked with two arguments; (objectValue, sourceValue).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [source1, source2, ...] The source objects.
   * @param {Function} [callback] The function to customize merging properties.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @param- {Object} [deepIndicator] Internally used to indicate that `stackA`
   *  and `stackB` are arrays of traversed objects instead of source objects.
   * @param- {Array} [stackA=[]] Internally used to track traversed source objects.
   * @param- {Array} [stackB=[]] Internally used to associate values with their
   *  source counterparts.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * var names = {
   *   'stooges': [
   *     { 'name': 'moe' },
   *     { 'name': 'larry' }
   *   ]
   * };
   *
   * var ages = {
   *   'stooges': [
   *     { 'age': 40 },
   *     { 'age': 50 }
   *   ]
   * };
   *
   * _.merge(names, ages);
   * // => { 'stooges': [{ 'name': 'moe', 'age': 40 }, { 'name': 'larry', 'age': 50 }] }
   *
   * var food = {
   *   'fruits': ['apple'],
   *   'vegetables': ['beet']
   * };
   *
   * var otherFood = {
   *   'fruits': ['banana'],
   *   'vegetables': ['carrot']
   * };
   *
   * _.merge(food, otherFood, function(a, b) {
   *   return _.isArray(a) ? a.concat(b) : undefined;
   * });
   * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
   */
  function merge(object, source, deepIndicator) {
    var args = arguments,
        index = 0,
        length = 2;

    if (!isObject(object)) {
      return object;
    }
    if (deepIndicator === indicatorObject) {
      var callback = args[3],
          stackA = args[4],
          stackB = args[5];
    } else {
      stackA = [];
      stackB = [];

      // allows working with `_.reduce` and `_.reduceRight` without
      // using their `callback` arguments, `index|key` and `collection`
      if (typeof deepIndicator != 'number') {
        length = args.length;
      }
      if (length > 3 && typeof args[length - 2] == 'function') {
        callback = createCallback(args[--length - 1], args[length--], 2);
      } else if (length > 2 && typeof args[length - 1] == 'function') {
        callback = args[--length];
      }
    }
    while (++index < length) {
      (isArray(args[index]) ? forEach : forOwn)(args[index], function(source, key) {
        var found,
            isArr,
            result = source,
            value = object[key];

        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            if ((found = stackA[stackLength] == source)) {
              value = stackB[stackLength];
              break;
            }
          }
          if (!found) {
            value = isArr
              ? (isArray(value) ? value : [])
              : (isPlainObject(value) ? value : {});

            if (callback) {
              result = callback(value, source);
              if (typeof result != 'undefined') {
                value = result;
              }
            }
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value);

            // recursively merge objects and arrays (susceptible to call stack limits)
            if (!callback) {
              value = merge(value, source, indicatorObject, callback, stackA, stackB);
            }
          }
        }
        else {
          if (callback) {
            result = callback(value, source);
            if (typeof result == 'undefined') {
              result = source;
            }
          }
          if (typeof result != 'undefined') {
            value = result;
          }
        }
        object[key] = value;
      });
    }
    return object;
  }

  /**
   * Creates a shallow clone of `object` excluding the specified properties.
   * Property names may be specified as individual arguments or as arrays of
   * property names. If a `callback` function is passed, it will be executed
   * for each property in the `object`, omitting the properties `callback`
   * returns truthy for. The `callback` is bound to `thisArg` and invoked
   * with three arguments; (value, key, object).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The source object.
   * @param {Function|String} callback|[prop1, prop2, ...] The properties to omit
   *  or the function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns an object without the omitted properties.
   * @example
   *
   * _.omit({ 'name': 'moe', 'age': 40 }, 'age');
   * // => { 'name': 'moe' }
   *
   * _.omit({ 'name': 'moe', 'age': 40 }, function(value) {
   *   return typeof value == 'number';
   * });
   * // => { 'name': 'moe' }
   */
  function omit(object, callback, thisArg) {
    var isFunc = typeof callback == 'function',
        result = {};

    if (isFunc) {
      callback = createCallback(callback, thisArg);
    } else {
      var props = concat.apply(arrayRef, arguments);
    }
    forIn(object, function(value, key, object) {
      if (isFunc
            ? !callback(value, key, object)
            : indexOf(props, key, 1) < 0
          ) {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Creates a two dimensional array of the given object's key-value pairs,
   * i.e. `[[key1, value1], [key2, value2]]`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns new array of key-value pairs.
   * @example
   *
   * _.pairs({ 'moe': 30, 'larry': 40 });
   * // => [['moe', 30], ['larry', 40]] (order is not guaranteed)
   */
  function pairs(object) {
    var index = -1,
        props = keys(object),
        length = props.length,
        result = Array(length);

    while (++index < length) {
      var key = props[index];
      result[index] = [key, object[key]];
    }
    return result;
  }

  /**
   * Creates a shallow clone of `object` composed of the specified properties.
   * Property names may be specified as individual arguments or as arrays of property
   * names. If `callback` is passed, it will be executed for each property in the
   * `object`, picking the properties `callback` returns truthy for. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, key, object).
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The source object.
   * @param {Array|Function|String} callback|[prop1, prop2, ...] The function called
   *  per iteration or properties to pick, either as individual arguments or arrays.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns an object composed of the picked properties.
   * @example
   *
   * _.pick({ 'name': 'moe', '_userid': 'moe1' }, 'name');
   * // => { 'name': 'moe' }
   *
   * _.pick({ 'name': 'moe', '_userid': 'moe1' }, function(value, key) {
   *   return key.charAt(0) != '_';
   * });
   * // => { 'name': 'moe' }
   */
  function pick(object, callback, thisArg) {
    var result = {};
    if (typeof callback != 'function') {
      var index = 0,
          props = concat.apply(arrayRef, arguments),
          length = isObject(object) ? props.length : 0;

      while (++index < length) {
        var key = props[index];
        if (key in object) {
          result[key] = object[key];
        }
      }
    } else {
      callback = createCallback(callback, thisArg);
      forIn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result[key] = value;
        }
      });
    }
    return result;
  }

  /**
   * Creates an array composed of the own enumerable property values of `object`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property values.
   * @example
   *
   * _.values({ 'one': 1, 'two': 2, 'three': 3 });
   * // => [1, 2, 3]
   */
  function values(object) {
    var index = -1,
        props = keys(object),
        length = props.length,
        result = Array(length);

    while (++index < length) {
      result[index] = object[props[index]];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates an array of elements from the specified indexes, or keys, of the
   * `collection`. Indexes may be specified as individual arguments or as arrays
   * of indexes.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Array|Number|String} [index1, index2, ...] The indexes of
   *  `collection` to retrieve, either as individual arguments or arrays.
   * @returns {Array} Returns a new array of elements corresponding to the
   *  provided indexes.
   * @example
   *
   * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
   * // => ['a', 'c', 'e']
   *
   * _.at(['moe', 'larry', 'curly'], 0, 2);
   * // => ['moe', 'curly']
   */
  function at(collection) {
    var index = -1,
        props = concat.apply(arrayRef, slice(arguments, 1)),
        length = props.length,
        result = Array(length);

    while(++index < length) {
      result[index] = collection[props[index]];
    }
    return result;
  }

  /**
   * Checks if a given `target` element is present in a `collection` using strict
   * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
   * as the offset from the end of the collection.
   *
   * @static
   * @memberOf _
   * @alias include
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Mixed} target The value to check for.
   * @param {Number} [fromIndex=0] The index to search from.
   * @returns {Boolean} Returns `true` if the `target` element is found, else `false`.
   * @example
   *
   * _.contains([1, 2, 3], 1);
   * // => true
   *
   * _.contains([1, 2, 3], 1, 2);
   * // => false
   *
   * _.contains({ 'name': 'moe', 'age': 40 }, 'moe');
   * // => true
   *
   * _.contains('curly', 'ur');
   * // => true
   */
  function contains(collection, target, fromIndex) {
    var index = -1,
        length = collection ? collection.length : 0,
        result = false;

    fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
    if (typeof length == 'number') {
      result = (isString(collection)
        ? collection.indexOf(target, fromIndex)
        : indexOf(collection, target, fromIndex)
      ) > -1;
    } else {
      each(collection, function(value) {
        if (++index >= fromIndex) {
          return !(result = value === target);
        }
      });
    }
    return result;
  }

  /**
   * Creates an object composed of keys returned from running each element of the
   * `collection` through the given `callback`. The corresponding value of each key
   * is the number of times the key was returned by the `callback`. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns the composed aggregate object.
   * @example
   *
   * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
   * // => { '4': 1, '6': 2 }
   *
   * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
   * // => { '4': 1, '6': 2 }
   *
   * _.countBy(['one', 'two', 'three'], 'length');
   * // => { '3': 2, '5': 1 }
   */
  function countBy(collection, callback, thisArg) {
    var result = {};
    callback = createCallback(callback, thisArg);

    forEach(collection, function(value, key, collection) {
      key = callback(value, key, collection) + '';
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });
    return result;
  }

  /**
   * Checks if the `callback` returns a truthy value for **all** elements of a
   * `collection`. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias all
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Boolean} Returns `true` if all elements pass the callback check,
   *  else `false`.
   * @example
   *
   * _.every([true, 1, null, 'yes'], Boolean);
   * // => false
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.every(stooges, 'age');
   * // => true
   *
   * // using "_.where" callback shorthand
   * _.every(stooges, { 'age': 50 });
   * // => false
   */
  function every(collection, callback, thisArg) {
    var result = true;
    callback = createCallback(callback, thisArg);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        if (!(result = !!callback(collection[index], index, collection))) {
          break;
        }
      }
    } else {
      each(collection, function(value, index, collection) {
        return (result = !!callback(value, index, collection));
      });
    }
    return result;
  }

  /**
   * Examines each element in a `collection`, returning an array of all elements
   * the `callback` returns truthy for. The `callback` is bound to `thisArg` and
   * invoked with three arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias select
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of elements that passed the callback check.
   * @example
   *
   * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [2, 4, 6]
   *
   * var food = [
   *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
   *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.filter(food, 'organic');
   * // => [{ 'name': 'carrot', 'organic': true, 'type': 'vegetable' }]
   *
   * // using "_.where" callback shorthand
   * _.filter(food, { 'type': 'fruit' });
   * // => [{ 'name': 'apple', 'organic': false, 'type': 'fruit' }]
   */
  function filter(collection, callback, thisArg) {
    var result = [];
    callback = createCallback(callback, thisArg);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        var value = collection[index];
        if (callback(value, index, collection)) {
          result.push(value);
        }
      }
    } else {
      each(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result.push(value);
        }
      });
    }
    return result;
  }

  /**
   * Examines each element in a `collection`, returning the first that the `callback`
   * returns truthy for. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias detect
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the element that passed the callback check,
   *  else `undefined`.
   * @example
   *
   * var even = _.find([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => 2
   *
   * var food = [
   *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
   *   { 'name': 'banana', 'organic': true,  'type': 'fruit' },
   *   { 'name': 'beet',   'organic': false, 'type': 'vegetable' },
   *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
   * ];
   *
   * // using "_.where" callback shorthand
   * var veggie = _.find(food, { 'type': 'vegetable' });
   * // => { 'name': 'beet', 'organic': false, 'type': 'vegetable' }
   *
   * // using "_.pluck" callback shorthand
   * var healthy = _.find(food, 'organic');
   * // => { 'name': 'banana', 'organic': true, 'type': 'fruit' }
   */
  function find(collection, callback, thisArg) {
    var result;
    callback = createCallback(callback, thisArg);

    forEach(collection, function(value, index, collection) {
      if (callback(value, index, collection)) {
        result = value;
        return false;
      }
    });
    return result;
  }

  /**
   * Iterates over a `collection`, executing the `callback` for each element in
   * the `collection`. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index|key, collection). Callbacks may exit iteration early
   * by explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @alias each
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array|Object|String} Returns `collection`.
   * @example
   *
   * _([1, 2, 3]).forEach(alert).join(',');
   * // => alerts each number and returns '1,2,3'
   *
   * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, alert);
   * // => alerts each number value (order is not guaranteed)
   */
  function forEach(collection, callback, thisArg) {
    if (callback && typeof thisArg == 'undefined' && isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        if (callback(collection[index], index, collection) === false) {
          break;
        }
      }
    } else {
      each(collection, callback, thisArg);
    }
    return collection;
  }

  /**
   * Creates an object composed of keys returned from running each element of the
   * `collection` through the `callback`. The corresponding value of each key is
   * an array of elements passed to `callback` that returned the key. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns the composed aggregate object.
   * @example
   *
   * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
   * // => { '4': [4.2], '6': [6.1, 6.4] }
   *
   * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
   * // => { '4': [4.2], '6': [6.1, 6.4] }
   *
   * // using "_.pluck" callback shorthand
   * _.groupBy(['one', 'two', 'three'], 'length');
   * // => { '3': ['one', 'two'], '5': ['three'] }
   */
  function groupBy(collection, callback, thisArg) {
    var result = {};
    callback = createCallback(callback, thisArg);

    forEach(collection, function(value, key, collection) {
      key = callback(value, key, collection) + '';
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });
    return result;
  }

  /**
   * Invokes the method named by `methodName` on each element in the `collection`,
   * returning an array of the results of each invoked method. Additional arguments
   * will be passed to each invoked method. If `methodName` is a function, it will
   * be invoked for, and `this` bound to, each element in the `collection`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|String} methodName The name of the method to invoke or
   *  the function invoked per iteration.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the method with.
   * @returns {Array} Returns a new array of the results of each invoked method.
   * @example
   *
   * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
   * // => [[1, 5, 7], [1, 2, 3]]
   *
   * _.invoke([123, 456], String.prototype.split, '');
   * // => [['1', '2', '3'], ['4', '5', '6']]
   */
  function invoke(collection, methodName) {
    var args = slice(arguments, 2),
        index = -1,
        isFunc = typeof methodName == 'function',
        length = collection ? collection.length : 0,
        result = Array(typeof length == 'number' ? length : 0);

    forEach(collection, function(value) {
      result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
    });
    return result;
  }

  /**
   * Creates an array of values by running each element in the `collection`
   * through the `callback`. The `callback` is bound to `thisArg` and invoked with
   * three arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias collect
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of the results of each `callback` execution.
   * @example
   *
   * _.map([1, 2, 3], function(num) { return num * 3; });
   * // => [3, 6, 9]
   *
   * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
   * // => [3, 6, 9] (order is not guaranteed)
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.map(stooges, 'name');
   * // => ['moe', 'larry']
   */
  function map(collection, callback, thisArg) {
    var index = -1,
        length = collection ? collection.length : 0,
        result = Array(typeof length == 'number' ? length : 0);

    callback = createCallback(callback, thisArg);
    if (isArray(collection)) {
      while (++index < length) {
        result[index] = callback(collection[index], index, collection);
      }
    } else {
      each(collection, function(value, key, collection) {
        result[++index] = callback(value, key, collection);
      });
    }
    return result;
  }

  /**
   * Retrieves the maximum value of an `array`. If `callback` is passed,
   * it will be executed for each value in the `array` to generate the
   * criterion by which the value is ranked. The `callback` is bound to
   * `thisArg` and invoked with three arguments; (value, index, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the maximum value.
   * @example
   *
   * _.max([4, 2, 8, 6]);
   * // => 8
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * _.max(stooges, function(stooge) { return stooge.age; });
   * // => { 'name': 'larry', 'age': 50 };
   *
   * // using "_.pluck" callback shorthand
   * _.max(stooges, 'age');
   * // => { 'name': 'larry', 'age': 50 };
   */
  function max(collection, callback, thisArg) {
    var computed = -Infinity,
        result = computed;

    if (!callback && isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        var value = collection[index];
        if (value > result) {
          result = value;
        }
      }
    } else {
      callback = !callback && isString(collection)
        ? charAtCallback
        : createCallback(callback, thisArg);

      each(collection, function(value, index, collection) {
        var current = callback(value, index, collection);
        if (current > computed) {
          computed = current;
          result = value;
        }
      });
    }
    return result;
  }

  /**
   * Retrieves the minimum value of an `array`. If `callback` is passed,
   * it will be executed for each value in the `array` to generate the
   * criterion by which the value is ranked. The `callback` is bound to `thisArg`
   * and invoked with three arguments; (value, index, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the minimum value.
   * @example
   *
   * _.min([4, 2, 8, 6]);
   * // => 2
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * _.min(stooges, function(stooge) { return stooge.age; });
   * // => { 'name': 'moe', 'age': 40 };
   *
   * // using "_.pluck" callback shorthand
   * _.min(stooges, 'age');
   * // => { 'name': 'moe', 'age': 40 };
   */
  function min(collection, callback, thisArg) {
    var computed = Infinity,
        result = computed;

    if (!callback && isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        var value = collection[index];
        if (value < result) {
          result = value;
        }
      }
    } else {
      callback = !callback && isString(collection)
        ? charAtCallback
        : createCallback(callback, thisArg);

      each(collection, function(value, index, collection) {
        var current = callback(value, index, collection);
        if (current < computed) {
          computed = current;
          result = value;
        }
      });
    }
    return result;
  }

  /**
   * Retrieves the value of a specified property from all elements in the `collection`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {String} property The property to pluck.
   * @returns {Array} Returns a new array of property values.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * _.pluck(stooges, 'name');
   * // => ['moe', 'larry']
   */
  var pluck = map;

  /**
   * Reduces a `collection` to a value that is the accumulated result of running
   * each element in the `collection` through the `callback`, where each successive
   * `callback` execution consumes the return value of the previous execution.
   * If `accumulator` is not passed, the first element of the `collection` will be
   * used as the initial `accumulator` value. The `callback` is bound to `thisArg`
   * and invoked with four arguments; (accumulator, value, index|key, collection).
   *
   * @static
   * @memberOf _
   * @alias foldl, inject
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [accumulator] Initial value of the accumulator.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the accumulated value.
   * @example
   *
   * var sum = _.reduce([1, 2, 3], function(sum, num) {
   *   return sum + num;
   * });
   * // => 6
   *
   * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
   *   result[key] = num * 3;
   *   return result;
   * }, {});
   * // => { 'a': 3, 'b': 6, 'c': 9 }
   */
  function reduce(collection, callback, accumulator, thisArg) {
    var noaccum = arguments.length < 3;
    callback = createCallback(callback, thisArg, 4);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      if (noaccum) {
        accumulator = collection[++index];
      }
      while (++index < length) {
        accumulator = callback(accumulator, collection[index], index, collection);
      }
    } else {
      each(collection, function(value, index, collection) {
        accumulator = noaccum
          ? (noaccum = false, value)
          : callback(accumulator, value, index, collection)
      });
    }
    return accumulator;
  }

  /**
   * This method is similar to `_.reduce`, except that it iterates over a
   * `collection` from right to left.
   *
   * @static
   * @memberOf _
   * @alias foldr
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {Mixed} [accumulator] Initial value of the accumulator.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the accumulated value.
   * @example
   *
   * var list = [[0, 1], [2, 3], [4, 5]];
   * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
   * // => [4, 5, 2, 3, 0, 1]
   */
  function reduceRight(collection, callback, accumulator, thisArg) {
    var iterable = collection,
        length = collection ? collection.length : 0,
        noaccum = arguments.length < 3;

    if (typeof length != 'number') {
      var props = keys(collection);
      length = props.length;
    }
    callback = createCallback(callback, thisArg, 4);
    forEach(collection, function(value, index, collection) {
      index = props ? props[--length] : --length;
      accumulator = noaccum
        ? (noaccum = false, iterable[index])
        : callback(accumulator, iterable[index], index, collection);
    });
    return accumulator;
  }

  /**
   * The opposite of `_.filter`, this method returns the elements of a
   * `collection` that `callback` does **not** return truthy for.
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of elements that did **not** pass the
   *  callback check.
   * @example
   *
   * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [1, 3, 5]
   *
   * var food = [
   *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
   *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.reject(food, 'organic');
   * // => [{ 'name': 'apple', 'organic': false, 'type': 'fruit' }]
   *
   * // using "_.where" callback shorthand
   * _.reject(food, { 'type': 'fruit' });
   * // => [{ 'name': 'carrot', 'organic': true, 'type': 'vegetable' }]
   */
  function reject(collection, callback, thisArg) {
    callback = createCallback(callback, thisArg);
    return filter(collection, function(value, index, collection) {
      return !callback(value, index, collection);
    });
  }

  /**
   * Creates an array of shuffled `array` values, using a version of the
   * Fisher-Yates shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to shuffle.
   * @returns {Array} Returns a new shuffled collection.
   * @example
   *
   * _.shuffle([1, 2, 3, 4, 5, 6]);
   * // => [4, 1, 6, 3, 5, 2]
   */
  function shuffle(collection) {
    var index = -1,
        length = collection ? collection.length : 0,
        result = Array(typeof length == 'number' ? length : 0);

    forEach(collection, function(value) {
      var rand = floor(nativeRandom() * (++index + 1));
      result[index] = result[rand];
      result[rand] = value;
    });
    return result;
  }

  /**
   * Gets the size of the `collection` by returning `collection.length` for arrays
   * and array-like objects or the number of own enumerable properties for objects.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to inspect.
   * @returns {Number} Returns `collection.length` or number of own enumerable properties.
   * @example
   *
   * _.size([1, 2]);
   * // => 2
   *
   * _.size({ 'one': 1, 'two': 2, 'three': 3 });
   * // => 3
   *
   * _.size('curly');
   * // => 5
   */
  function size(collection) {
    var length = collection ? collection.length : 0;
    return typeof length == 'number' ? length : keys(collection).length;
  }

  /**
   * Checks if the `callback` returns a truthy value for **any** element of a
   * `collection`. The function returns as soon as it finds passing value, and
   * does not iterate over the entire `collection`. The `callback` is bound to
   * `thisArg` and invoked with three arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias any
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Boolean} Returns `true` if any element passes the callback check,
   *  else `false`.
   * @example
   *
   * _.some([null, 0, 'yes', false], Boolean);
   * // => true
   *
   * var food = [
   *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
   *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.some(food, 'organic');
   * // => true
   *
   * // using "_.where" callback shorthand
   * _.some(food, { 'type': 'meat' });
   * // => false
   */
  function some(collection, callback, thisArg) {
    var result;
    callback = createCallback(callback, thisArg);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        if ((result = callback(collection[index], index, collection))) {
          break;
        }
      }
    } else {
      each(collection, function(value, index, collection) {
        return !(result = callback(value, index, collection));
      });
    }
    return !!result;
  }

  /**
   * Creates an array of elements, sorted in ascending order by the results of
   * running each element in the `collection` through the `callback`. This method
   * performs a stable sort, that is, it will preserve the original sort order of
   * equal elements. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index|key, collection).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of sorted elements.
   * @example
   *
   * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
   * // => [3, 1, 2]
   *
   * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
   * // => [3, 1, 2]
   *
   * // using "_.pluck" callback shorthand
   * _.sortBy(['banana', 'strawberry', 'apple'], 'length');
   * // => ['apple', 'banana', 'strawberry']
   */
  function sortBy(collection, callback, thisArg) {
    var index = -1,
        length = collection ? collection.length : 0,
        result = Array(typeof length == 'number' ? length : 0);

    callback = createCallback(callback, thisArg);
    forEach(collection, function(value, key, collection) {
      result[++index] = {
        'criteria': callback(value, key, collection),
        'index': index,
        'value': value
      };
    });

    length = result.length;
    result.sort(compareAscending);
    while (length--) {
      result[length] = result[length].value;
    }
    return result;
  }

  /**
   * Converts the `collection` to an array.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|String} collection The collection to convert.
   * @returns {Array} Returns the new converted array.
   * @example
   *
   * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
   * // => [2, 3, 4]
   */
  function toArray(collection) {
    if (collection && typeof collection.length == 'number') {
      return  slice(collection);
    }
    return values(collection);
  }

  /**
   * Examines each element in a `collection`, returning an array of all elements
   * that have the given `properties`. When checking `properties`, this method
   * performs a deep comparison between values to determine if they are equivalent
   * to each other.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Collections
   * @param {Array|Object|String} collection The collection to iterate over.
   * @param {Object} properties The object of property values to filter by.
   * @returns {Array} Returns a new array of elements that have the given `properties`.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 }
   * ];
   *
   * _.where(stooges, { 'age': 40 });
   * // => [{ 'name': 'moe', 'age': 40 }]
   */
  var where = filter;

  /*--------------------------------------------------------------------------*/

  /**
   * Creates an array with all falsey values of `array` removed. The values
   * `false`, `null`, `0`, `""`, `undefined` and `NaN` are all falsey.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to compact.
   * @returns {Array} Returns a new filtered array.
   * @example
   *
   * _.compact([0, 1, false, 2, '', 3]);
   * // => [1, 2, 3]
   */
  function compact(array) {
    var index = -1,
        length = array ? array.length : 0,
        result = [];

    while (++index < length) {
      var value = array[index];
      if (value) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Creates an array of `array` elements not present in the other arrays
   * using strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to process.
   * @param {Array} [array1, array2, ...] Arrays to check.
   * @returns {Array} Returns a new array of `array` elements not present in the
   *  other arrays.
   * @example
   *
   * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
   * // => [1, 3, 4]
   */
  function difference(array) {
    var index = -1,
        length = array ? array.length : 0,
        flattened = concat.apply(arrayRef, arguments),
        contains = cachedContains(flattened, length),
        result = [];

    while (++index < length) {
      var value = array[index];
      if (!contains(value)) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Gets the first element of the `array`. If a number `n` is passed, the first
   * `n` elements of the `array` are returned. If a `callback` function is passed,
   * the first elements the `callback` returns truthy for are returned. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, index, array).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias head, take
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Function|Object|Number|String} [callback|n] The function called
   *  per element or the number of elements to return. If a property name or
   *  object is passed, it will be used to create a "_.pluck" or "_.where"
   *  style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the first element(s) of `array`.
   * @example
   *
   * _.first([1, 2, 3]);
   * // => 1
   *
   * _.first([1, 2, 3], 2);
   * // => [1, 2]
   *
   * _.first([1, 2, 3], function(num) {
   *   return num < 3;
   * });
   * // => [1, 2]
   *
   * var food = [
   *   { 'name': 'banana', 'organic': true },
   *   { 'name': 'beet',   'organic': false },
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.first(food, 'organic');
   * // => [{ 'name': 'banana', 'organic': true }]
   *
   * var food = [
   *   { 'name': 'apple',  'type': 'fruit' },
   *   { 'name': 'banana', 'type': 'fruit' },
   *   { 'name': 'beet',   'type': 'vegetable' }
   * ];
   *
   * // using "_.where" callback shorthand
   * _.first(food, { 'type': 'fruit' });
   * // => [{ 'name': 'apple', 'type': 'fruit' }, { 'name': 'banana', 'type': 'fruit' }]
   */
  function first(array, callback, thisArg) {
    if (array) {
      var n = 0,
          length = array.length;

      if (typeof callback != 'number' && callback != null) {
        var index = -1;
        callback = createCallback(callback, thisArg);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array[0];
        }
      }
      return slice(array, 0, nativeMin(nativeMax(0, n), length));
    }
  }

  /**
   * Flattens a nested array (the nesting can be to any depth). If `shallow` is
   * truthy, `array` will only be flattened a single level.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to compact.
   * @param {Boolean} shallow A flag to indicate only flattening a single level.
   * @returns {Array} Returns a new flattened array.
   * @example
   *
   * _.flatten([1, [2], [3, [[4]]]]);
   * // => [1, 2, 3, 4];
   *
   * _.flatten([1, [2], [3, [[4]]]], true);
   * // => [1, 2, 3, [[4]]];
   */
  function flatten(array, shallow) {
    var index = -1,
        length = array ? array.length : 0,
        result = [];

    while (++index < length) {
      var value = array[index];

      // recursively flatten arrays (susceptible to call stack limits)
      if (isArray(value)) {
        push.apply(result, shallow ? value : flatten(value));
      } else {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Gets the index at which the first occurrence of `value` is found using
   * strict equality for comparisons, i.e. `===`. If the `array` is already
   * sorted, passing `true` for `fromIndex` will run a faster binary search.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Boolean|Number} [fromIndex=0] The index to search from or `true` to
   *  perform a binary search on a sorted `array`.
   * @returns {Number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.indexOf([1, 2, 3, 1, 2, 3], 2);
   * // => 1
   *
   * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
   * // => 4
   *
   * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
   * // => 2
   */
  function indexOf(array, value, fromIndex) {
    var index = -1,
        length = array ? array.length : 0;

    if (typeof fromIndex == 'number') {
      index = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0) - 1;
    } else if (fromIndex) {
      index = sortedIndex(array, value);
      return array[index] === value ? index : -1;
    }
    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Gets all but the last element of `array`. If a number `n` is passed, the
   * last `n` elements are excluded from the result. If a `callback` function
   * is passed, the last elements the `callback` returns truthy for are excluded
   * from the result. The `callback` is bound to `thisArg` and invoked with three
   * arguments; (value, index, array).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Function|Object|Number|String} [callback|n=1] The function called
   *  per element or the number of elements to exclude. If a property name or
   *  object is passed, it will be used to create a "_.pluck" or "_.where"
   *  style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a slice of `array`.
   * @example
   *
   * _.initial([1, 2, 3]);
   * // => [1, 2]
   *
   * _.initial([1, 2, 3], 2);
   * // => [1]
   *
   * _.initial([1, 2, 3], function(num) {
   *   return num > 1;
   * });
   * // => [1]
   *
   * var food = [
   *   { 'name': 'beet',   'organic': false },
   *   { 'name': 'carrot', 'organic': true }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.initial(food, 'organic');
   * // => [{ 'name': 'beet',   'organic': false }]
   *
   * var food = [
   *   { 'name': 'banana', 'type': 'fruit' },
   *   { 'name': 'beet',   'type': 'vegetable' },
   *   { 'name': 'carrot', 'type': 'vegetable' }
   * ];
   *
   * // using "_.where" callback shorthand
   * _.initial(food, { 'type': 'vegetable' });
   * // => [{ 'name': 'banana', 'type': 'fruit' }]
   */
  function initial(array, callback, thisArg) {
    if (!array) {
      return [];
    }
    var n = 0,
        length = array.length;

    if (typeof callback != 'number' && callback != null) {
      var index = length;
      callback = createCallback(callback, thisArg);
      while (index-- && callback(array[index], index, array)) {
        n++;
      }
    } else {
      n = (callback == null || thisArg) ? 1 : callback || n;
    }
    return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
  }

  /**
   * Computes the intersection of all the passed-in arrays using strict equality
   * for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of unique elements that are present
   *  in **all** of the arrays.
   * @example
   *
   * _.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
   * // => [1, 2]
   */
  function intersection(array) {
    var args = arguments,
        argsLength = args.length,
        cache = { '0': {} },
        index = -1,
        length = array ? array.length : 0,
        isLarge = length >= 100,
        result = [],
        seen = result;

    outer:
    while (++index < length) {
      var value = array[index];
      if (isLarge) {
        var key = value + '';
        var inited = hasOwnProperty.call(cache[0], key)
          ? !(seen = cache[0][key])
          : (seen = cache[0][key] = []);
      }
      if (inited || indexOf(seen, value) < 0) {
        if (isLarge) {
          seen.push(value);
        }
        var argsIndex = argsLength;
        while (--argsIndex) {
          if (!(cache[argsIndex] || (cache[argsIndex] = cachedContains(args[argsIndex], 0, 100)))(value)) {
            continue outer;
          }
        }
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Gets the last element of the `array`. If a number `n` is passed, the last
   * `n` elements of the `array` are returned. If a `callback` function is passed,
   * the last elements the `callback` returns truthy for are returned. The `callback`
   * is bound to `thisArg` and invoked with three arguments; (value, index, array).
   *
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Function|Object|Number|String} [callback|n] The function called
   *  per element or the number of elements to return. If a property name or
   *  object is passed, it will be used to create a "_.pluck" or "_.where"
   *  style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Mixed} Returns the last element(s) of `array`.
   * @example
   *
   * _.last([1, 2, 3]);
   * // => 3
   *
   * _.last([1, 2, 3], 2);
   * // => [2, 3]
   *
   * _.last([1, 2, 3], function(num) {
   *   return num > 1;
   * });
   * // => [2, 3]
   *
   * var food = [
   *   { 'name': 'beet',   'organic': false },
   *   { 'name': 'carrot', 'organic': true }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.last(food, 'organic');
   * // => [{ 'name': 'carrot', 'organic': true }]
   *
   * var food = [
   *   { 'name': 'banana', 'type': 'fruit' },
   *   { 'name': 'beet',   'type': 'vegetable' },
   *   { 'name': 'carrot', 'type': 'vegetable' }
   * ];
   *
   * // using "_.where" callback shorthand
   * _.last(food, { 'type': 'vegetable' });
   * // => [{ 'name': 'beet', 'type': 'vegetable' }, { 'name': 'carrot', 'type': 'vegetable' }]
   */
  function last(array, callback, thisArg) {
    if (array) {
      var n = 0,
          length = array.length;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = createCallback(callback, thisArg);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array[length - 1];
        }
      }
      return slice(array, nativeMax(0, length - n));
    }
  }

  /**
   * Gets the index at which the last occurrence of `value` is found using strict
   * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
   * as the offset from the end of the collection.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Number} [fromIndex=array.length-1] The index to search from.
   * @returns {Number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
   * // => 4
   *
   * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
   * // => 1
   */
  function lastIndexOf(array, value, fromIndex) {
    var index = array ? array.length : 0;
    if (typeof fromIndex == 'number') {
      index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
    }
    while (index--) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Creates an object composed from arrays of `keys` and `values`. Pass either
   * a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`, or
   * two arrays, one of `keys` and one of corresponding `values`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} keys The array of keys.
   * @param {Array} [values=[]] The array of values.
   * @returns {Object} Returns an object composed of the given keys and
   *  corresponding values.
   * @example
   *
   * _.object(['moe', 'larry'], [30, 40]);
   * // => { 'moe': 30, 'larry': 40 }
   */
  function object(keys, values) {
    var index = -1,
        length = keys ? keys.length : 0,
        result = {};

    while (++index < length) {
      var key = keys[index];
      if (values) {
        result[key] = values[index];
      } else {
        result[key[0]] = key[1];
      }
    }
    return result;
  }

  /**
   * Creates an array of numbers (positive and/or negative) progressing from
   * `start` up to but not including `end`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Number} [start=0] The start of the range.
   * @param {Number} end The end of the range.
   * @param {Number} [step=1] The value to increment or descrement by.
   * @returns {Array} Returns a new range array.
   * @example
   *
   * _.range(10);
   * // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
   *
   * _.range(1, 11);
   * // => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
   *
   * _.range(0, 30, 5);
   * // => [0, 5, 10, 15, 20, 25]
   *
   * _.range(0, -10, -1);
   * // => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
   *
   * _.range(0);
   * // => []
   */
  function range(start, end, step) {
    start = +start || 0;
    step = +step || 1;

    if (end == null) {
      end = start;
      start = 0;
    }
    // use `Array(length)` so V8 will avoid the slower "dictionary" mode
    // http://youtu.be/XAqIpGU8ZZk#t=17m25s
    var index = -1,
        length = nativeMax(0, ceil((end - start) / step)),
        result = Array(length);

    while (++index < length) {
      result[index] = start;
      start += step;
    }
    return result;
  }

  /**
   * The opposite of `_.initial`, this method gets all but the first value of `array`.
   * If a number `n` is passed, the first `n` values are excluded from the result.
   * If a `callback` function is passed, the first elements the `callback` returns
   * truthy for are excluded from the result. The `callback` is bound to `thisArg`
   * and invoked with three arguments; (value, index, array).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias drop, tail
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Function|Object|Number|String} [callback|n=1] The function called
   *  per element or the number of elements to exclude. If a property name or
   *  object is passed, it will be used to create a "_.pluck" or "_.where"
   *  style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a slice of `array`.
   * @example
   *
   * _.rest([1, 2, 3]);
   * // => [2, 3]
   *
   * _.rest([1, 2, 3], 2);
   * // => [3]
   *
   * _.rest([1, 2, 3], function(num) {
   *   return num < 3;
   * });
   * // => [3]
   *
   * var food = [
   *   { 'name': 'banana', 'organic': true },
   *   { 'name': 'beet',   'organic': false },
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.rest(food, 'organic');
   * // => [{ 'name': 'beet', 'organic': false }]
   *
   * var food = [
   *   { 'name': 'apple',  'type': 'fruit' },
   *   { 'name': 'banana', 'type': 'fruit' },
   *   { 'name': 'beet',   'type': 'vegetable' }
   * ];
   *
   * // using "_.where" callback shorthand
   * _.rest(food, { 'type': 'fruit' });
   * // => [{ 'name': 'beet', 'type': 'vegetable' }]
   */
  function rest(array, callback, thisArg) {
    if (typeof callback != 'number' && callback != null) {
      var n = 0,
          index = -1,
          length = array ? array.length : 0;

      callback = createCallback(callback, thisArg);
      while (++index < length && callback(array[index], index, array)) {
        n++;
      }
    } else {
      n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
    }
    return slice(array, n);
  }

  /**
   * Uses a binary search to determine the smallest index at which the `value`
   * should be inserted into `array` in order to maintain the sort order of the
   * sorted `array`. If `callback` is passed, it will be executed for `value` and
   * each element in `array` to compute their sort ranking. The `callback` is
   * bound to `thisArg` and invoked with one argument; (value).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Mixed} value The value to evaluate.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Number} Returns the index at which the value should be inserted
   *  into `array`.
   * @example
   *
   * _.sortedIndex([20, 30, 50], 40);
   * // => 2
   *
   * // using "_.pluck" callback shorthand
   * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
   * // => 2
   *
   * var dict = {
   *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
   * };
   *
   * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
   *   return dict.wordToNumber[word];
   * });
   * // => 2
   *
   * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
   *   return this.wordToNumber[word];
   * }, dict);
   * // => 2
   */
  function sortedIndex(array, value, callback, thisArg) {
    var low = 0,
        high = array ? array.length : low;

    // explicitly reference `identity` for better inlining in Firefox
    callback = callback ? createCallback(callback, thisArg, 1) : identity;
    value = callback(value);

    while (low < high) {
      var mid = (low + high) >>> 1;
      callback(array[mid]) < value
        ? low = mid + 1
        : high = mid;
    }
    return low;
  }

  /**
   * Computes the union of the passed-in arrays using strict equality for
   * comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of unique values, in order, that are
   *  present in one or more of the arrays.
   * @example
   *
   * _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
   * // => [1, 2, 3, 101, 10]
   */
  function union() {
    return uniq(concat.apply(arrayRef, arguments));
  }

  /**
   * Creates a duplicate-value-free version of the `array` using strict equality
   * for comparisons, i.e. `===`. If the `array` is already sorted, passing `true`
   * for `isSorted` will run a faster algorithm. If `callback` is passed, each
   * element of `array` is passed through a callback` before uniqueness is computed.
   * The `callback` is bound to `thisArg` and invoked with three arguments; (value, index, array).
   *
   * If a property name is passed for `callback`, the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is passed for `callback`, the created "_.where" style callback
   * will return `true` for elements that have the propeties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias unique
   * @category Arrays
   * @param {Array} array The array to process.
   * @param {Boolean} [isSorted=false] A flag to indicate that the `array` is already sorted.
   * @param {Function|Object|String} [callback=identity] The function called per
   *  iteration. If a property name or object is passed, it will be used to create
   *  a "_.pluck" or "_.where" style callback, respectively.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a duplicate-value-free array.
   * @example
   *
   * _.uniq([1, 2, 1, 3, 1]);
   * // => [1, 2, 3]
   *
   * _.uniq([1, 1, 2, 2, 3], true);
   * // => [1, 2, 3]
   *
   * _.uniq([1, 2, 1.5, 3, 2.5], function(num) { return Math.floor(num); });
   * // => [1, 2, 3]
   *
   * _.uniq([1, 2, 1.5, 3, 2.5], function(num) { return this.floor(num); }, Math);
   * // => [1, 2, 3]
   *
   * // using "_.pluck" callback shorthand
   * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
   * // => [{ 'x': 1 }, { 'x': 2 }]
   */
  function uniq(array, isSorted, callback, thisArg) {
    var index = -1,
        length = array ? array.length : 0,
        result = [],
        seen = result;

    // juggle arguments
    if (typeof isSorted == 'function') {
      thisArg = callback;
      callback = isSorted;
      isSorted = false;
    }
    // init value cache for large arrays
    var isLarge = !isSorted && length >= 75;
    if (isLarge) {
      var cache = {};
    }
    if (callback) {
      seen = [];
      callback = createCallback(callback, thisArg);
    }
    while (++index < length) {
      var value = array[index],
          computed = callback ? callback(value, index, array) : value;

      if (isLarge) {
        var key = computed + '';
        var inited = hasOwnProperty.call(cache, key)
          ? !(seen = cache[key])
          : (seen = cache[key] = []);
      }
      if (isSorted
            ? !index || seen[seen.length - 1] !== computed
            : inited || indexOf(seen, computed) < 0
          ) {
        if (callback || isLarge) {
          seen.push(computed);
        }
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Creates an array with all occurrences of the passed values removed using
   * strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to filter.
   * @param {Mixed} [value1, value2, ...] Values to remove.
   * @returns {Array} Returns a new filtered array.
   * @example
   *
   * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
   * // => [2, 3, 4]
   */
  function without(array) {
    var index = -1,
        length = array ? array.length : 0,
        contains = cachedContains(arguments, 1),
        result = [];

    while (++index < length) {
      var value = array[index];
      if (!contains(value)) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Groups the elements of each array at their corresponding indexes. Useful for
   * separate data sources that are coordinated through matching array indexes.
   * For a matrix of nested arrays, `_.zip.apply(...)` can transpose the matrix
   * in a similar fashion.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of grouped elements.
   * @example
   *
   * _.zip(['moe', 'larry'], [30, 40], [true, false]);
   * // => [['moe', 30, true], ['larry', 40, false]]
   */
  function zip(array) {
    var index = -1,
        length = array ? max(pluck(arguments, 'length')) : 0,
        result = Array(length);

    while (++index < length) {
      result[index] = pluck(arguments, index);
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a function that is restricted to executing `func` only after it is
   * called `n` times. The `func` is executed with the `this` binding of the
   * created function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Number} n The number of times the function must be called before
   * it is executed.
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new restricted function.
   * @example
   *
   * var renderNotes = _.after(notes.length, render);
   * _.forEach(notes, function(note) {
   *   note.asyncSave({ 'success': renderNotes });
   * });
   * // `renderNotes` is run once, after all notes have saved
   */
  function after(n, func) {
    if (n < 1) {
      return func();
    }
    return function() {
      if (--n < 1) {
        return func.apply(this, arguments);
      }
    };
  }

  /**
   * Creates a function that, when called, invokes `func` with the `this`
   * binding of `thisArg` and prepends any additional `bind` arguments to those
   * passed to the bound function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to bind.
   * @param {Mixed} [thisArg] The `this` binding of `func`.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * var func = function(greeting) {
   *   return greeting + ' ' + this.name;
   * };
   *
   * func = _.bind(func, { 'name': 'moe' }, 'hi');
   * func();
   * // => 'hi moe'
   */
  function bind(func, thisArg) {
    // use `Function#bind` if it exists and is fast
    // (in V8 `Function#bind` is slower except when partially applied)
    return isBindFast || (nativeBind && arguments.length > 2)
      ? nativeBind.call.apply(nativeBind, arguments)
      : createBound(func, thisArg, slice(arguments, 2));
  }

  /**
   * Binds methods on `object` to `object`, overwriting the existing method.
   * Method names may be specified as individual arguments or as arrays of method
   * names. If no method names are provided, all the function properties of `object`
   * will be bound.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Object} object The object to bind and assign the bound methods to.
   * @param {String} [methodName1, methodName2, ...] Method names on the object to bind.
   * @returns {Object} Returns `object`.
   * @example
   *
   * var view = {
   *  'label': 'docs',
   *  'onClick': function() { alert('clicked ' + this.label); }
   * };
   *
   * _.bindAll(view);
   * jQuery('#docs').on('click', view.onClick);
   * // => alerts 'clicked docs', when the button is clicked
   */
  function bindAll(object) {
    var funcs = concat.apply(arrayRef, arguments),
        index = funcs.length > 1 ? 0 : (funcs = functions(object), -1),
        length = funcs.length;

    while (++index < length) {
      var key = funcs[index];
      object[key] = bind(object[key], object);
    }
    return object;
  }

  /**
   * Creates a function that, when called, invokes the method at `object[key]`
   * and prepends any additional `bindKey` arguments to those passed to the bound
   * function. This method differs from `_.bind` by allowing bound functions to
   * reference methods that will be redefined or don't yet exist.
   * See http://michaux.ca/articles/lazy-function-definition-pattern.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Object} object The object the method belongs to.
   * @param {String} key The key of the method.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * var object = {
   *   'name': 'moe',
   *   'greet': function(greeting) {
   *     return greeting + ' ' + this.name;
   *   }
   * };
   *
   * var func = _.bindKey(object, 'greet', 'hi');
   * func();
   * // => 'hi moe'
   *
   * object.greet = function(greeting) {
   *   return greeting + ', ' + this.name + '!';
   * };
   *
   * func();
   * // => 'hi, moe!'
   */
  function bindKey(object, key) {
    return createBound(object, key, slice(arguments, 2));
  }

  /**
   * Creates a function that is the composition of the passed functions,
   * where each function consumes the return value of the function that follows.
   * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
   * Each function is executed with the `this` binding of the composed function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} [func1, func2, ...] Functions to compose.
   * @returns {Function} Returns the new composed function.
   * @example
   *
   * var greet = function(name) { return 'hi ' + name; };
   * var exclaim = function(statement) { return statement + '!'; };
   * var welcome = _.compose(exclaim, greet);
   * welcome('moe');
   * // => 'hi moe!'
   */
  function compose() {
    var funcs = arguments;
    return function() {
      var args = arguments,
          length = funcs.length;

      while (length--) {
        args = [funcs[length].apply(this, args)];
      }
      return args[0];
    };
  }

  /**
   * Creates a function that will delay the execution of `func` until after
   * `wait` milliseconds have elapsed since the last time it was invoked. Pass
   * `true` for `immediate` to cause debounce to invoke `func` on the leading,
   * instead of the trailing, edge of the `wait` timeout. Subsequent calls to
   * the debounced function will return the result of the last `func` call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to debounce.
   * @param {Number} wait The number of milliseconds to delay.
   * @param {Boolean} immediate A flag to indicate execution is on the leading
   *  edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * var lazyLayout = _.debounce(calculateLayout, 300);
   * jQuery(window).on('resize', lazyLayout);
   */
  function debounce(func, wait, immediate) {
    var args,
        result,
        thisArg,
        timeoutId;

    function delayed() {
      timeoutId = null;
      if (!immediate) {
        result = func.apply(thisArg, args);
      }
    }
    return function() {
      var isImmediate = immediate && !timeoutId;
      args = arguments;
      thisArg = this;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(delayed, wait);

      if (isImmediate) {
        result = func.apply(thisArg, args);
      }
      return result;
    };
  }

  /**
   * Executes the `func` function after `wait` milliseconds. Additional arguments
   * will be passed to `func` when it is invoked.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to delay.
   * @param {Number} wait The number of milliseconds to delay execution.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
   * @returns {Number} Returns the `setTimeout` timeout id.
   * @example
   *
   * var log = _.bind(console.log, console);
   * _.delay(log, 1000, 'logged later');
   * // => 'logged later' (Appears after one second.)
   */
  function delay(func, wait) {
    var args = slice(arguments, 2);
    return setTimeout(function() { func.apply(undefined, args); }, wait);
  }

  /**
   * Defers executing the `func` function until the current call stack has cleared.
   * Additional arguments will be passed to `func` when it is invoked.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to defer.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
   * @returns {Number} Returns the `setTimeout` timeout id.
   * @example
   *
   * _.defer(function() { alert('deferred'); });
   * // returns from the function before `alert` is called
   */
  function defer(func) {
    var args = slice(arguments, 1);
    return setTimeout(function() { func.apply(undefined, args); }, 1);
  }
  // use `setImmediate` if it's available in Node.js
  if (isV8 && freeModule && typeof setImmediate == 'function') {
    defer = bind(setImmediate, window);
  }

  /**
   * Creates a function that memoizes the result of `func`. If `resolver` is
   * passed, it will be used to determine the cache key for storing the result
   * based on the arguments passed to the memoized function. By default, the first
   * argument passed to the memoized function is used as the cache key. The `func`
   * is executed with the `this` binding of the memoized function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to have its output memoized.
   * @param {Function} [resolver] A function used to resolve the cache key.
   * @returns {Function} Returns the new memoizing function.
   * @example
   *
   * var fibonacci = _.memoize(function(n) {
   *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
   * });
   */
  function memoize(func, resolver) {
    var cache = {};
    return function() {
      var key = (resolver ? resolver.apply(this, arguments) : arguments[0]) + '';
      return hasOwnProperty.call(cache, key)
        ? cache[key]
        : (cache[key] = func.apply(this, arguments));
    };
  }

  /**
   * Creates a function that is restricted to execute `func` once. Repeat calls to
   * the function will return the value of the first call. The `func` is executed
   * with the `this` binding of the created function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new restricted function.
   * @example
   *
   * var initialize = _.once(createApplication);
   * initialize();
   * initialize();
   * // `initialize` executes `createApplication` once
   */
  function once(func) {
    var ran,
        result;

    return function() {
      if (ran) {
        return result;
      }
      ran = true;
      result = func.apply(this, arguments);

      // clear the `func` variable so the function may be garbage collected
      func = null;
      return result;
    };
  }

  /**
   * Creates a function that, when called, invokes `func` with any additional
   * `partial` arguments prepended to those passed to the new function. This
   * method is similar to `_.bind`, except it does **not** alter the `this` binding.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to partially apply arguments to.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new partially applied function.
   * @example
   *
   * var greet = function(greeting, name) { return greeting + ' ' + name; };
   * var hi = _.partial(greet, 'hi');
   * hi('moe');
   * // => 'hi moe'
   */
  function partial(func) {
    return createBound(func, slice(arguments, 1));
  }

  /**
   * This method is similar to `_.partial`, except that `partial` arguments are
   * appended to those passed to the new function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to partially apply arguments to.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new partially applied function.
   * @example
   *
   * var defaultsDeep = _.partialRight(_.merge, _.defaults);
   *
   * var options = {
   *   'variable': 'data',
   *   'imports': { 'jq': $ }
   * };
   *
   * defaultsDeep(options, _.templateSettings);
   *
   * options.variable
   * // => 'data'
   *
   * options.imports
   * // => { '_': _, 'jq': $ }
   */
  function partialRight(func) {
    return createBound(func, slice(arguments, 1), null, indicatorObject);
  }

  /**
   * Creates a function that, when executed, will only call the `func`
   * function at most once per every `wait` milliseconds. If the throttled
   * function is invoked more than once during the `wait` timeout, `func` will
   * also be called on the trailing edge of the timeout. Subsequent calls to the
   * throttled function will return the result of the last `func` call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to throttle.
   * @param {Number} wait The number of milliseconds to throttle executions to.
   * @returns {Function} Returns the new throttled function.
   * @example
   *
   * var throttled = _.throttle(updatePosition, 100);
   * jQuery(window).on('scroll', throttled);
   */
  function throttle(func, wait) {
    var args,
        result,
        thisArg,
        timeoutId,
        lastCalled = 0;

    function trailingCall() {
      lastCalled = new Date;
      timeoutId = null;
      result = func.apply(thisArg, args);
    }
    return function() {
      var now = new Date,
          remaining = wait - (now - lastCalled);

      args = arguments;
      thisArg = this;

      if (remaining <= 0) {
        clearTimeout(timeoutId);
        timeoutId = null;
        lastCalled = now;
        result = func.apply(thisArg, args);
      }
      else if (!timeoutId) {
        timeoutId = setTimeout(trailingCall, remaining);
      }
      return result;
    };
  }

  /**
   * Creates a function that passes `value` to the `wrapper` function as its
   * first argument. Additional arguments passed to the function are appended
   * to those passed to the `wrapper` function. The `wrapper` is executed with
   * the `this` binding of the created function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Mixed} value The value to wrap.
   * @param {Function} wrapper The wrapper function.
   * @returns {Function} Returns the new function.
   * @example
   *
   * var hello = function(name) { return 'hello ' + name; };
   * hello = _.wrap(hello, function(func) {
   *   return 'before, ' + func('moe') + ', after';
   * });
   * hello();
   * // => 'before, hello moe, after'
   */
  function wrap(value, wrapper) {
    return function() {
      var args = [value];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
   * corresponding HTML entities.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} string The string to escape.
   * @returns {String} Returns the escaped string.
   * @example
   *
   * _.escape('Moe, Larry & Curly');
   * // => 'Moe, Larry &amp; Curly'
   */
  function escape(string) {
    return string == null ? '' : (string + '').replace(reUnescapedHtml, escapeHtmlChar);
  }

  /**
   * This function returns the first argument passed to it.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Mixed} value Any value.
   * @returns {Mixed} Returns `value`.
   * @example
   *
   * var moe = { 'name': 'moe' };
   * moe === _.identity(moe);
   * // => true
   */
  function identity(value) {
    return value;
  }

  /**
   * Adds functions properties of `object` to the `lodash` function and chainable
   * wrapper.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} object The object of function properties to add to `lodash`.
   * @example
   *
   * _.mixin({
   *   'capitalize': function(string) {
   *     return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
   *   }
   * });
   *
   * _.capitalize('moe');
   * // => 'Moe'
   *
   * _('moe').capitalize();
   * // => 'Moe'
   */
  function mixin(object) {
    forEach(functions(object), function(methodName) {
      var func = lodash[methodName] = object[methodName];

      lodash.prototype[methodName] = function() {
        var args = [this.__wrapped__];
        push.apply(args, arguments);
        return new lodash(func.apply(lodash, args));
      };
    });
  }

  /**
   * Reverts the '_' variable to its previous value and returns a reference to
   * the `lodash` function.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @returns {Function} Returns the `lodash` function.
   * @example
   *
   * var lodash = _.noConflict();
   */
  function noConflict() {
    window._ = oldDash;
    return this;
  }

  /**
   * Produces a random number between `min` and `max` (inclusive). If only one
   * argument is passed, a number between `0` and the given number will be returned.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Number} [min=0] The minimum possible value.
   * @param {Number} [max=1] The maximum possible value.
   * @returns {Number} Returns a random number.
   * @example
   *
   * _.random(0, 5);
   * // => a number between 0 and 5
   *
   * _.random(5);
   * // => also a number between 0 and 5
   */
  function random(min, max) {
    if (min == null && max == null) {
      max = 1;
    }
    min = +min || 0;
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + floor(nativeRandom() * ((+max || 0) - min + 1));
  }

  /**
   * Resolves the value of `property` on `object`. If `property` is a function,
   * it will be invoked and its result returned, else the property value is
   * returned. If `object` is falsey, then `null` is returned.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} object The object to inspect.
   * @param {String} property The property to get the value of.
   * @returns {Mixed} Returns the resolved value.
   * @example
   *
   * var object = {
   *   'cheese': 'crumpets',
   *   'stuff': function() {
   *     return 'nonsense';
   *   }
   * };
   *
   * _.result(object, 'cheese');
   * // => 'crumpets'
   *
   * _.result(object, 'stuff');
   * // => 'nonsense'
   */
  function result(object, property) {
    var value = object ? object[property] : undefined;
    return isFunction(value) ? object[property]() : value;
  }

  /**
   * A micro-templating method that handles arbitrary delimiters, preserves
   * whitespace, and correctly escapes quotes within interpolated code.
   *
   * Note: In the development build, `_.template` utilizes sourceURLs for easier
   * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
   *
   * Note: Lo-Dash may be used in Chrome extensions by either creating a `lodash csp`
   * build and using precompiled templates, or loading Lo-Dash in a sandbox.
   *
   * For more information on precompiling templates see:
   * http://lodash.com/#custom-builds
   *
   * For more information on Chrome extension sandboxes see:
   * http://developer.chrome.com/stable/extensions/sandboxingEval.html
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} text The template text.
   * @param {Obect} data The data object used to populate the text.
   * @param {Object} options The options object.
   *  escape - The "escape" delimiter regexp.
   *  evaluate - The "evaluate" delimiter regexp.
   *  interpolate - The "interpolate" delimiter regexp.
   *  sourceURL - The sourceURL of the template's compiled source.
   *  variable - The data object variable name.
   *
   * @returns {Function|String} Returns a compiled function when no `data` object
   *  is given, else it returns the interpolated text.
   * @example
   *
   * // using a compiled template
   * var compiled = _.template('hello <%= name %>');
   * compiled({ 'name': 'moe' });
   * // => 'hello moe'
   *
   * var list = '<% _.forEach(people, function(name) { %><li><%= name %></li><% }); %>';
   * _.template(list, { 'people': ['moe', 'larry'] });
   * // => '<li>moe</li><li>larry</li>'
   *
   * // using the "escape" delimiter to escape HTML in data property values
   * _.template('<b><%- value %></b>', { 'value': '<script>' });
   * // => '<b>&lt;script&gt;</b>'
   *
   * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
   * _.template('hello ${ name }', { 'name': 'curly' });
   * // => 'hello curly'
   *
   * // using the internal `print` function in "evaluate" delimiters
   * _.template('<% print("hello " + epithet); %>!', { 'epithet': 'stooge' });
   * // => 'hello stooge!'
   *
   * // using custom template delimiters
   * _.templateSettings = {
   *   'interpolate': /{{([\s\S]+?)}}/g
   * };
   *
   * _.template('hello {{ name }}!', { 'name': 'mustache' });
   * // => 'hello mustache!'
   *
   * // using the `sourceURL` option to specify a custom sourceURL for the template
   * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
   * compiled(data);
   * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
   *
   * // using the `variable` option to ensure a with-statement isn't used in the compiled template
   * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
   * compiled.source;
   * // => function(data) {
   *   var __t, __p = '', __e = _.escape;
   *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
   *   return __p;
   * }
   *
   * // using the `source` property to inline compiled templates for meaningful
   * // line numbers in error messages and a stack trace
   * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
   *   var JST = {\
   *     "main": ' + _.template(mainText).source + '\
   *   };\
   * ');
   */
  function template(text, data, options) {
    // based on John Resig's `tmpl` implementation
    // http://ejohn.org/blog/javascript-micro-templating/
    // and Laura Doktorova's doT.js
    // https://github.com/olado/doT
    var settings = lodash.templateSettings;
    text || (text = '');

    // avoid missing dependencies when `iteratorTemplate` is not defined
    options = defaults({}, options, settings);

    var imports = defaults({}, options.imports, settings.imports),
        importsKeys = keys(imports),
        importsValues = values(imports);

    var isEvaluating,
        index = 0,
        interpolate = options.interpolate || reNoMatch,
        source = "__p += '";

    // compile regexp to match each delimiter
    var reDelimiters = RegExp(
      (options.escape || reNoMatch).source + '|' +
      interpolate.source + '|' +
      (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
      (options.evaluate || reNoMatch).source + '|$'
    , 'g');

    text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
      interpolateValue || (interpolateValue = esTemplateValue);

      // escape characters that cannot be included in string literals
      source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

      // replace delimiters with snippets
      if (escapeValue) {
        source += "' +\n__e(" + escapeValue + ") +\n'";
      }
      if (evaluateValue) {
        isEvaluating = true;
        source += "';\n" + evaluateValue + ";\n__p += '";
      }
      if (interpolateValue) {
        source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
      }
      index = offset + match.length;

      // the JS engine embedded in Adobe products requires returning the `match`
      // string in order to produce the correct `offset` value
      return match;
    });

    source += "';\n";

    // if `variable` is not specified and the template contains "evaluate"
    // delimiters, wrap a with-statement around the generated code to add the
    // data object to the top of the scope chain
    var variable = options.variable,
        hasVariable = variable;

    if (!hasVariable) {
      variable = 'obj';
      source = 'with (' + variable + ') {\n' + source + '\n}\n';
    }
    // cleanup code by stripping empty strings
    source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
      .replace(reEmptyStringMiddle, '$1')
      .replace(reEmptyStringTrailing, '$1;');

    // frame code as the function body
    source = 'function(' + variable + ') {\n' +
      (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
      "var __t, __p = '', __e = _.escape" +
      (isEvaluating
        ? ', __j = Array.prototype.join;\n' +
          "function print() { __p += __j.call(arguments, '') }\n"
        : ';\n'
      ) +
      source +
      'return __p\n}';

    // Use a sourceURL for easier debugging and wrap in a multi-line comment to
    // avoid issues with Narwhal, IE conditional compilation, and the JS engine
    // embedded in Adobe products.
    // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
    var sourceURL = '\n/*\n//@ sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

    try {
      var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
    } catch(e) {
      e.source = source;
      throw e;
    }
    if (data) {
      return result(data);
    }
    // provide the compiled function's source via its `toString` method, in
    // supported environments, or the `source` property as a convenience for
    // inlining compiled templates during the build process
    result.source = source;
    return result;
  }

  /**
   * Executes the `callback` function `n` times, returning an array of the results
   * of each `callback` execution. The `callback` is bound to `thisArg` and invoked
   * with one argument; (index).
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Number} n The number of times to execute the callback.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of the results of each `callback` execution.
   * @example
   *
   * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
   * // => [3, 6, 4]
   *
   * _.times(3, function(n) { mage.castSpell(n); });
   * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
   *
   * _.times(3, function(n) { this.cast(n); }, mage);
   * // => also calls `mage.castSpell(n)` three times
   */
  function times(n, callback, thisArg) {
    n = +n || 0;
    var index = -1,
        result = Array(n);

    while (++index < n) {
      result[index] = callback.call(thisArg, index);
    }
    return result;
  }

  /**
   * The opposite of `_.escape`, this method converts the HTML entities
   * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
   * corresponding characters.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} string The string to unescape.
   * @returns {String} Returns the unescaped string.
   * @example
   *
   * _.unescape('Moe, Larry &amp; Curly');
   * // => 'Moe, Larry & Curly'
   */
  function unescape(string) {
    return string == null ? '' : (string + '').replace(reEscapedHtml, unescapeHtmlChar);
  }

  /**
   * Generates a unique ID. If `prefix` is passed, the ID will be appended to it.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} [prefix] The value to prefix the ID with.
   * @returns {String} Returns the unique ID.
   * @example
   *
   * _.uniqueId('contact_');
   * // => 'contact_104'
   *
   * _.uniqueId();
   * // => '105'
   */
  function uniqueId(prefix) {
    var id = ++idCounter;
    return (prefix == null ? '' : prefix + '') + id;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Invokes `interceptor` with the `value` as the first argument, and then
   * returns `value`. The purpose of this method is to "tap into" a method chain,
   * in order to perform operations on intermediate results within the chain.
   *
   * @static
   * @memberOf _
   * @category Chaining
   * @param {Mixed} value The value to pass to `interceptor`.
   * @param {Function} interceptor The function to invoke.
   * @returns {Mixed} Returns `value`.
   * @example
   *
   * _([1, 2, 3, 4])
   *  .filter(function(num) { return num % 2 == 0; })
   *  .tap(alert)
   *  .map(function(num) { return num * num; })
   *  .value();
   * // => // [2, 4] (alerted)
   * // => [4, 16]
   */
  function tap(value, interceptor) {
    interceptor(value);
    return value;
  }

  /**
   * Produces the `toString` result of the wrapped value.
   *
   * @name toString
   * @memberOf _
   * @category Chaining
   * @returns {String} Returns the string result.
   * @example
   *
   * _([1, 2, 3]).toString();
   * // => '1,2,3'
   */
  function wrapperToString() {
    return this.__wrapped__ + '';
  }

  /**
   * Extracts the wrapped value.
   *
   * @name valueOf
   * @memberOf _
   * @alias value
   * @category Chaining
   * @returns {Mixed} Returns the wrapped value.
   * @example
   *
   * _([1, 2, 3]).valueOf();
   * // => [1, 2, 3]
   */
  function wrapperValueOf() {
    return this.__wrapped__;
  }

  /*--------------------------------------------------------------------------*/

  // add functions that return wrapped values when chaining
  lodash.after = after;
  lodash.assign = assign;
  lodash.at = at;
  lodash.bind = bind;
  lodash.bindAll = bindAll;
  lodash.bindKey = bindKey;
  lodash.compact = compact;
  lodash.compose = compose;
  lodash.countBy = countBy;
  lodash.debounce = debounce;
  lodash.defaults = defaults;
  lodash.defer = defer;
  lodash.delay = delay;
  lodash.difference = difference;
  lodash.filter = filter;
  lodash.flatten = flatten;
  lodash.forEach = forEach;
  lodash.forIn = forIn;
  lodash.forOwn = forOwn;
  lodash.functions = functions;
  lodash.groupBy = groupBy;
  lodash.initial = initial;
  lodash.intersection = intersection;
  lodash.invert = invert;
  lodash.invoke = invoke;
  lodash.keys = keys;
  lodash.map = map;
  lodash.max = max;
  lodash.memoize = memoize;
  lodash.merge = merge;
  lodash.min = min;
  lodash.object = object;
  lodash.omit = omit;
  lodash.once = once;
  lodash.pairs = pairs;
  lodash.partial = partial;
  lodash.partialRight = partialRight;
  lodash.pick = pick;
  lodash.pluck = pluck;
  lodash.range = range;
  lodash.reject = reject;
  lodash.rest = rest;
  lodash.shuffle = shuffle;
  lodash.sortBy = sortBy;
  lodash.tap = tap;
  lodash.throttle = throttle;
  lodash.times = times;
  lodash.toArray = toArray;
  lodash.union = union;
  lodash.uniq = uniq;
  lodash.values = values;
  lodash.where = where;
  lodash.without = without;
  lodash.wrap = wrap;
  lodash.zip = zip;

  // add aliases
  lodash.collect = map;
  lodash.drop = rest;
  lodash.each = forEach;
  lodash.extend = assign;
  lodash.methods = functions;
  lodash.select = filter;
  lodash.tail = rest;
  lodash.unique = uniq;

  // add functions to `lodash.prototype`
  mixin(lodash);

  /*--------------------------------------------------------------------------*/

  // add functions that return unwrapped values when chaining
  lodash.clone = clone;
  lodash.cloneDeep = cloneDeep;
  lodash.contains = contains;
  lodash.escape = escape;
  lodash.every = every;
  lodash.find = find;
  lodash.has = has;
  lodash.identity = identity;
  lodash.indexOf = indexOf;
  lodash.isArguments = isArguments;
  lodash.isArray = isArray;
  lodash.isBoolean = isBoolean;
  lodash.isDate = isDate;
  lodash.isElement = isElement;
  lodash.isEmpty = isEmpty;
  lodash.isEqual = isEqual;
  lodash.isFinite = isFinite;
  lodash.isFunction = isFunction;
  lodash.isNaN = isNaN;
  lodash.isNull = isNull;
  lodash.isNumber = isNumber;
  lodash.isObject = isObject;
  lodash.isPlainObject = isPlainObject;
  lodash.isRegExp = isRegExp;
  lodash.isString = isString;
  lodash.isUndefined = isUndefined;
  lodash.lastIndexOf = lastIndexOf;
  lodash.mixin = mixin;
  lodash.noConflict = noConflict;
  lodash.random = random;
  lodash.reduce = reduce;
  lodash.reduceRight = reduceRight;
  lodash.result = result;
  lodash.size = size;
  lodash.some = some;
  lodash.sortedIndex = sortedIndex;
  lodash.template = template;
  lodash.unescape = unescape;
  lodash.uniqueId = uniqueId;

  // add aliases
  lodash.all = every;
  lodash.any = some;
  lodash.detect = find;
  lodash.foldl = reduce;
  lodash.foldr = reduceRight;
  lodash.include = contains;
  lodash.inject = reduce;

  forOwn(lodash, function(func, methodName) {
    if (!lodash.prototype[methodName]) {
      lodash.prototype[methodName] = function() {
        var args = [this.__wrapped__];
        push.apply(args, arguments);
        return func.apply(lodash, args);
      };
    }
  });

  /*--------------------------------------------------------------------------*/

  // add functions capable of returning wrapped and unwrapped values when chaining
  lodash.first = first;
  lodash.last = last;

  // add aliases
  lodash.take = first;
  lodash.head = first;

  forOwn(lodash, function(func, methodName) {
    if (!lodash.prototype[methodName]) {
      lodash.prototype[methodName]= function(callback, thisArg) {
        var result = func(this.__wrapped__, callback, thisArg);
        return callback == null || (thisArg && typeof callback != 'function')
          ? result
          : new lodash(result);
      };
    }
  });

  /*--------------------------------------------------------------------------*/

  /**
   * The semantic version number.
   *
   * @static
   * @memberOf _
   * @type String
   */
  lodash.VERSION = '1.0.2';

  // add "Chaining" functions to the wrapper
  lodash.prototype.toString = wrapperToString;
  lodash.prototype.value = wrapperValueOf;
  lodash.prototype.valueOf = wrapperValueOf;

  // add `Array` functions that return unwrapped values
  each(['join', 'pop', 'shift'], function(methodName) {
    var func = arrayRef[methodName];
    lodash.prototype[methodName] = function() {
      return func.apply(this.__wrapped__, arguments);
    };
  });

  // add `Array` functions that return the wrapped value
  each(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
    var func = arrayRef[methodName];
    lodash.prototype[methodName] = function() {
      func.apply(this.__wrapped__, arguments);
      return this;
    };
  });

  // add `Array` functions that return new wrapped values
  each(['concat', 'slice', 'splice'], function(methodName) {
    var func = arrayRef[methodName];
    lodash.prototype[methodName] = function() {
      return new lodash(func.apply(this.__wrapped__, arguments));
    };
  });

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash was injected by a third-party script and not intended to be
    // loaded as a module. The global assignment can be reverted in the Lo-Dash
    // module via its `noConflict()` method.
    window._ = lodash;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return lodash;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports) {
    // in Node.js or RingoJS v0.8.0+
    if (freeModule) {
      (freeModule.exports = lodash)._ = lodash;
    }
    // in Narwhal or RingoJS v0.7.0-
    else {
      freeExports._ = lodash;
    }
  }
  else {
    // in a browser or Rhino
    window._ = lodash;
  }
}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],7:[function(require,module,exports){
module.exports = require('./lib/McFly');
},{"./lib/McFly":11}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Dispatcher = require('./Dispatcher');

var _Dispatcher2 = _interopRequireDefault(_Dispatcher);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function reThrow(reject, error) {
  if (error && error.stack) {
    console.error(error.stack);
  }
  return reject(error);
}

/**
 * Action class
 */

var Action = function () {

  /**
   * Constructs an Action object
   *
   * @param {function} callback - Callback method for Action
   * @constructor
   */

  function Action(callback) {
    _classCallCheck(this, Action);

    this.callback = callback;
  }

  /**
   * Calls callback method from Dispatcher
   *
   * @param {...*} arguments - arguments for callback method
   * @returns Promise object
   */


  _createClass(Action, [{
    key: 'dispatch',
    value: function dispatch() {
      return Promise.resolve(this.callback.apply(this, arguments)).then(function (payload) {
        return new Promise(function (resolve, reject) {
          if (!payload) return reThrow(reject, 'Payload needs to be an object');
          if (!payload.actionType) return reThrow(reject, 'Payload object requires an actionType property');

          try {
            _Dispatcher2.default.dispatch(payload);
          } catch (error) {
            reThrow(reject, error);
          }

          resolve();
        });
      });
    }
  }]);

  return Action;
}();

exports.default = Action;
},{"./Dispatcher":10}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Action = require('./Action');

var _Action2 = _interopRequireDefault(_Action);

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * ActionsFactory class
 */

var ActionsFactory =

/**
 * Constructs an ActionsFactory object and translates actions parameter into
 * Action objects.
 *
 * @param {object} actions - Object with methods to create actions with
 * @constructor
 */
function ActionsFactory(actions) {
  _classCallCheck(this, ActionsFactory);

  var _actions = {};
  for (var a in actions) {
    if (actions.hasOwnProperty(a)) {
      var action = new _Action2.default(actions[a]);
      _actions[a] = action.dispatch.bind(action);
    }
  }
  (0, _objectAssign2.default)(this, _actions);
};

exports.default = ActionsFactory;
},{"./Action":8,"object-assign":14}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _flux = require('flux');

/** Creates a singlar instance of Facebook's Dispatcher */
var appDispatcher = new _flux.Dispatcher();

exports.default = appDispatcher;
},{"flux":2}],11:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Dispatcher = require('./Dispatcher');

var _Dispatcher2 = _interopRequireDefault(_Dispatcher);

var _Store = require('./Store');

var _Store2 = _interopRequireDefault(_Store);

var _ActionsFactory = require('./ActionsFactory');

var _ActionsFactory2 = _interopRequireDefault(_ActionsFactory);

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Main McFly Class
 */

var McFly = function () {

  /**
   * Instatiates McFly along with actions object, stores array and sets
   * dispatcher to Dispatcher.
   *
   * @constructor
   */

  function McFly() {
    _classCallCheck(this, McFly);

    this.actions = {};
    this.stores = [];
    this.dispatcher = _Dispatcher2.default;
  }

  /**
   * Creates an instance of a Store, registers the supplied callback with the
   * dispatcher, and pushes it into the global list of stores
   *
   * @param {object} methods - Public methods for Store instance
   * @param {function} callback - Callback method for Dispatcher dispatches
   * @return {object} - Returns instance of Store
   */


  _createClass(McFly, [{
    key: 'createStore',
    value: function createStore(methods, callback) {
      var store = new _Store2.default(methods, callback);
      store.dispatcherID = this.dispatcher.register(store.callback);
      this.stores.push(store);
      return store;
    }

    /**
     * Creates an instance of an ActionsFactory and adds the supplied actions
     * to the global list of actions
     *
     * @param {object} actions - Action methods
     * @return {object} - Returns instance of ActionsFactory
     */

  }, {
    key: 'createActions',
    value: function createActions(actions) {
      var actionFactory = new _ActionsFactory2.default(actions);
      (0, _objectAssign2.default)(this.actions, actionFactory);
      return actionFactory;
    }
  }]);

  return McFly;
}();

module.exports = McFly;
},{"./ActionsFactory":9,"./Dispatcher":10,"./Store":12,"object-assign":14}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Store class
 */

var Store = function () {

  /**
   * Constructs a Store object, extends it with EventEmitter and supplied
   * methods parameter,  and creates a mixin property for use in components.
   *
   * @param {object} methods - Public methods for Store instance
   * @param {function} callback - Callback method for Dispatcher dispatches
   * @constructor
   */

  function Store(methods, callback) {
    _classCallCheck(this, Store);

    var self = this;
    this.callback = callback;
    (0, _invariant2.default)(!methods.callback, '"callback" is a reserved name and cannot be used as a method name.');
    (0, _invariant2.default)(!methods.mixin, '"mixin" is a reserved name and cannot be used as a method name.');
    (0, _objectAssign2.default)(this, _events.EventEmitter.prototype, methods);
    this.mixin = {
      componentDidMount: function componentDidMount() {
        var _this = this;

        var warn = void 0;
        var changeFn = void 0;

        try {
          warn = (console.warn || console.log).bind(console);
        } catch (e) {
          warn = function warn() {
            return false;
          };
        }

        if (!this.storeDidChange) {
          warn("A component that uses a McFly Store mixin is not implementing storeDidChange. onChange will be called instead, but this will no longer be supported from version 1.0.");
        }
        changeFn = this.storeDidChange || this.onChange;
        if (!changeFn) {
          warn("A change handler is missing from a component with a McFly mixin. Notifications from Stores are not being handled.");
        }
        this.listener = function () {
          _this.isMounted() && changeFn();
        };
        self.addChangeListener(this.listener);
      },
      componentWillUnmount: function componentWillUnmount() {
        this.listener && self.removeChangeListener(this.listener);
      }
    };
  }

  /**
   * Returns dispatch token
   */


  _createClass(Store, [{
    key: 'getDispatchToken',
    value: function getDispatchToken() {
      return this.dispatcherID;
    }

    /**
     * Emits change event
     */

  }, {
    key: 'emitChange',
    value: function emitChange() {
      this.emit('change');
    }

    /**
     * Adds a change listener
     *
     * @param {function} callback - Callback method for change event
     */

  }, {
    key: 'addChangeListener',
    value: function addChangeListener(callback) {
      this.on('change', callback);
    }

    /**
     * Removes a change listener
     *
     * @param {function} callback - Callback method for change event
     */

  }, {
    key: 'removeChangeListener',
    value: function removeChangeListener(callback) {
      this.removeListener('change', callback);
    }
  }]);

  return Store;
}();

exports.default = Store;
},{"events":1,"invariant":5,"object-assign":14}],13:[function(require,module,exports){
/*!
 * numeral.js
 * version : 1.5.3
 * author : Adam Draper
 * license : MIT
 * http://adamwdraper.github.com/Numeral-js/
 */

(function () {

    /************************************
        Constants
    ************************************/

    var numeral,
        VERSION = '1.5.3',
        // internal storage for language config files
        languages = {},
        currentLanguage = 'en',
        zeroFormat = null,
        defaultFormat = '0,0',
        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports);


    /************************************
        Constructors
    ************************************/


    // Numeral prototype object
    function Numeral (number) {
        this._value = number;
    }

    /**
     * Implementation of toFixed() that treats floats more like decimals
     *
     * Fixes binary rounding issues (eg. (0.615).toFixed(2) === '0.61') that present
     * problems for accounting- and finance-related software.
     */
    function toFixed (value, precision, roundingFunction, optionals) {
        var power = Math.pow(10, precision),
            optionalsRegExp,
            output;
            
        //roundingFunction = (roundingFunction !== undefined ? roundingFunction : Math.round);
        // Multiply up by precision, round accurately, then divide and use native toFixed():
        output = (roundingFunction(value * power) / power).toFixed(precision);

        if (optionals) {
            optionalsRegExp = new RegExp('0{1,' + optionals + '}$');
            output = output.replace(optionalsRegExp, '');
        }

        return output;
    }

    /************************************
        Formatting
    ************************************/

    // determine what type of formatting we need to do
    function formatNumeral (n, format, roundingFunction) {
        var output;

        // figure out what kind of format we are dealing with
        if (format.indexOf('$') > -1) { // currency!!!!!
            output = formatCurrency(n, format, roundingFunction);
        } else if (format.indexOf('%') > -1) { // percentage
            output = formatPercentage(n, format, roundingFunction);
        } else if (format.indexOf(':') > -1) { // time
            output = formatTime(n, format);
        } else { // plain ol' numbers or bytes
            output = formatNumber(n._value, format, roundingFunction);
        }

        // return string
        return output;
    }

    // revert to number
    function unformatNumeral (n, string) {
        var stringOriginal = string,
            thousandRegExp,
            millionRegExp,
            billionRegExp,
            trillionRegExp,
            suffixes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            bytesMultiplier = false,
            power;

        if (string.indexOf(':') > -1) {
            n._value = unformatTime(string);
        } else {
            if (string === zeroFormat) {
                n._value = 0;
            } else {
                if (languages[currentLanguage].delimiters.decimal !== '.') {
                    string = string.replace(/\./g,'').replace(languages[currentLanguage].delimiters.decimal, '.');
                }

                // see if abbreviations are there so that we can multiply to the correct number
                thousandRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.thousand + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
                millionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.million + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
                billionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.billion + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
                trillionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.trillion + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');

                // see if bytes are there so that we can multiply to the correct number
                for (power = 0; power <= suffixes.length; power++) {
                    bytesMultiplier = (string.indexOf(suffixes[power]) > -1) ? Math.pow(1024, power + 1) : false;

                    if (bytesMultiplier) {
                        break;
                    }
                }

                // do some math to create our number
                n._value = ((bytesMultiplier) ? bytesMultiplier : 1) * ((stringOriginal.match(thousandRegExp)) ? Math.pow(10, 3) : 1) * ((stringOriginal.match(millionRegExp)) ? Math.pow(10, 6) : 1) * ((stringOriginal.match(billionRegExp)) ? Math.pow(10, 9) : 1) * ((stringOriginal.match(trillionRegExp)) ? Math.pow(10, 12) : 1) * ((string.indexOf('%') > -1) ? 0.01 : 1) * (((string.split('-').length + Math.min(string.split('(').length-1, string.split(')').length-1)) % 2)? 1: -1) * Number(string.replace(/[^0-9\.]+/g, ''));

                // round if we are talking about bytes
                n._value = (bytesMultiplier) ? Math.ceil(n._value) : n._value;
            }
        }
        return n._value;
    }

    function formatCurrency (n, format, roundingFunction) {
        var symbolIndex = format.indexOf('$'),
            openParenIndex = format.indexOf('('),
            minusSignIndex = format.indexOf('-'),
            space = '',
            spliceIndex,
            output;

        // check for space before or after currency
        if (format.indexOf(' $') > -1) {
            space = ' ';
            format = format.replace(' $', '');
        } else if (format.indexOf('$ ') > -1) {
            space = ' ';
            format = format.replace('$ ', '');
        } else {
            format = format.replace('$', '');
        }

        // format the number
        output = formatNumber(n._value, format, roundingFunction);

        // position the symbol
        if (symbolIndex <= 1) {
            if (output.indexOf('(') > -1 || output.indexOf('-') > -1) {
                output = output.split('');
                spliceIndex = 1;
                if (symbolIndex < openParenIndex || symbolIndex < minusSignIndex){
                    // the symbol appears before the "(" or "-"
                    spliceIndex = 0;
                }
                output.splice(spliceIndex, 0, languages[currentLanguage].currency.symbol + space);
                output = output.join('');
            } else {
                output = languages[currentLanguage].currency.symbol + space + output;
            }
        } else {
            if (output.indexOf(')') > -1) {
                output = output.split('');
                output.splice(-1, 0, space + languages[currentLanguage].currency.symbol);
                output = output.join('');
            } else {
                output = output + space + languages[currentLanguage].currency.symbol;
            }
        }

        return output;
    }

    function formatPercentage (n, format, roundingFunction) {
        var space = '',
            output,
            value = n._value * 100;

        // check for space before %
        if (format.indexOf(' %') > -1) {
            space = ' ';
            format = format.replace(' %', '');
        } else {
            format = format.replace('%', '');
        }

        output = formatNumber(value, format, roundingFunction);
        
        if (output.indexOf(')') > -1 ) {
            output = output.split('');
            output.splice(-1, 0, space + '%');
            output = output.join('');
        } else {
            output = output + space + '%';
        }

        return output;
    }

    function formatTime (n) {
        var hours = Math.floor(n._value/60/60),
            minutes = Math.floor((n._value - (hours * 60 * 60))/60),
            seconds = Math.round(n._value - (hours * 60 * 60) - (minutes * 60));
        return hours + ':' + ((minutes < 10) ? '0' + minutes : minutes) + ':' + ((seconds < 10) ? '0' + seconds : seconds);
    }

    function unformatTime (string) {
        var timeArray = string.split(':'),
            seconds = 0;
        // turn hours and minutes into seconds and add them all up
        if (timeArray.length === 3) {
            // hours
            seconds = seconds + (Number(timeArray[0]) * 60 * 60);
            // minutes
            seconds = seconds + (Number(timeArray[1]) * 60);
            // seconds
            seconds = seconds + Number(timeArray[2]);
        } else if (timeArray.length === 2) {
            // minutes
            seconds = seconds + (Number(timeArray[0]) * 60);
            // seconds
            seconds = seconds + Number(timeArray[1]);
        }
        return Number(seconds);
    }

    function formatNumber (value, format, roundingFunction) {
        var negP = false,
            signed = false,
            optDec = false,
            abbr = '',
            abbrK = false, // force abbreviation to thousands
            abbrM = false, // force abbreviation to millions
            abbrB = false, // force abbreviation to billions
            abbrT = false, // force abbreviation to trillions
            abbrForce = false, // force abbreviation
            bytes = '',
            ord = '',
            abs = Math.abs(value),
            suffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            min,
            max,
            power,
            w,
            precision,
            thousands,
            d = '',
            neg = false;

        // check if number is zero and a custom zero format has been set
        if (value === 0 && zeroFormat !== null) {
            return zeroFormat;
        } else {
            // see if we should use parentheses for negative number or if we should prefix with a sign
            // if both are present we default to parentheses
            if (format.indexOf('(') > -1) {
                negP = true;
                format = format.slice(1, -1);
            } else if (format.indexOf('+') > -1) {
                signed = true;
                format = format.replace(/\+/g, '');
            }

            // see if abbreviation is wanted
            if (format.indexOf('a') > -1) {
                // check if abbreviation is specified
                abbrK = format.indexOf('aK') >= 0;
                abbrM = format.indexOf('aM') >= 0;
                abbrB = format.indexOf('aB') >= 0;
                abbrT = format.indexOf('aT') >= 0;
                abbrForce = abbrK || abbrM || abbrB || abbrT;

                // check for space before abbreviation
                if (format.indexOf(' a') > -1) {
                    abbr = ' ';
                    format = format.replace(' a', '');
                } else {
                    format = format.replace('a', '');
                }

                if (abs >= Math.pow(10, 12) && !abbrForce || abbrT) {
                    // trillion
                    abbr = abbr + languages[currentLanguage].abbreviations.trillion;
                    value = value / Math.pow(10, 12);
                } else if (abs < Math.pow(10, 12) && abs >= Math.pow(10, 9) && !abbrForce || abbrB) {
                    // billion
                    abbr = abbr + languages[currentLanguage].abbreviations.billion;
                    value = value / Math.pow(10, 9);
                } else if (abs < Math.pow(10, 9) && abs >= Math.pow(10, 6) && !abbrForce || abbrM) {
                    // million
                    abbr = abbr + languages[currentLanguage].abbreviations.million;
                    value = value / Math.pow(10, 6);
                } else if (abs < Math.pow(10, 6) && abs >= Math.pow(10, 3) && !abbrForce || abbrK) {
                    // thousand
                    abbr = abbr + languages[currentLanguage].abbreviations.thousand;
                    value = value / Math.pow(10, 3);
                }
            }

            // see if we are formatting bytes
            if (format.indexOf('b') > -1) {
                // check for space before
                if (format.indexOf(' b') > -1) {
                    bytes = ' ';
                    format = format.replace(' b', '');
                } else {
                    format = format.replace('b', '');
                }

                for (power = 0; power <= suffixes.length; power++) {
                    min = Math.pow(1024, power);
                    max = Math.pow(1024, power+1);

                    if (value >= min && value < max) {
                        bytes = bytes + suffixes[power];
                        if (min > 0) {
                            value = value / min;
                        }
                        break;
                    }
                }
            }

            // see if ordinal is wanted
            if (format.indexOf('o') > -1) {
                // check for space before
                if (format.indexOf(' o') > -1) {
                    ord = ' ';
                    format = format.replace(' o', '');
                } else {
                    format = format.replace('o', '');
                }

                ord = ord + languages[currentLanguage].ordinal(value);
            }

            if (format.indexOf('[.]') > -1) {
                optDec = true;
                format = format.replace('[.]', '.');
            }

            w = value.toString().split('.')[0];
            precision = format.split('.')[1];
            thousands = format.indexOf(',');

            if (precision) {
                if (precision.indexOf('[') > -1) {
                    precision = precision.replace(']', '');
                    precision = precision.split('[');
                    d = toFixed(value, (precision[0].length + precision[1].length), roundingFunction, precision[1].length);
                } else {
                    d = toFixed(value, precision.length, roundingFunction);
                }

                w = d.split('.')[0];

                if (d.split('.')[1].length) {
                    d = languages[currentLanguage].delimiters.decimal + d.split('.')[1];
                } else {
                    d = '';
                }

                if (optDec && Number(d.slice(1)) === 0) {
                    d = '';
                }
            } else {
                w = toFixed(value, null, roundingFunction);
            }

            // format number
            if (w.indexOf('-') > -1) {
                w = w.slice(1);
                neg = true;
            }

            if (thousands > -1) {
                w = w.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + languages[currentLanguage].delimiters.thousands);
            }

            if (format.indexOf('.') === 0) {
                w = '';
            }

            return ((negP && neg) ? '(' : '') + ((!negP && neg) ? '-' : '') + ((!neg && signed) ? '+' : '') + w + d + ((ord) ? ord : '') + ((abbr) ? abbr : '') + ((bytes) ? bytes : '') + ((negP && neg) ? ')' : '');
        }
    }

    /************************************
        Top Level Functions
    ************************************/

    numeral = function (input) {
        if (numeral.isNumeral(input)) {
            input = input.value();
        } else if (input === 0 || typeof input === 'undefined') {
            input = 0;
        } else if (!Number(input)) {
            input = numeral.fn.unformat(input);
        }

        return new Numeral(Number(input));
    };

    // version number
    numeral.version = VERSION;

    // compare numeral object
    numeral.isNumeral = function (obj) {
        return obj instanceof Numeral;
    };

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    numeral.language = function (key, values) {
        if (!key) {
            return currentLanguage;
        }

        if (key && !values) {
            if(!languages[key]) {
                throw new Error('Unknown language : ' + key);
            }
            currentLanguage = key;
        }

        if (values || !languages[key]) {
            loadLanguage(key, values);
        }

        return numeral;
    };
    
    // This function provides access to the loaded language data.  If
    // no arguments are passed in, it will simply return the current
    // global language object.
    numeral.languageData = function (key) {
        if (!key) {
            return languages[currentLanguage];
        }
        
        if (!languages[key]) {
            throw new Error('Unknown language : ' + key);
        }
        
        return languages[key];
    };

    numeral.language('en', {
        delimiters: {
            thousands: ',',
            decimal: '.'
        },
        abbreviations: {
            thousand: 'k',
            million: 'm',
            billion: 'b',
            trillion: 't'
        },
        ordinal: function (number) {
            var b = number % 10;
            return (~~ (number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
        },
        currency: {
            symbol: '$'
        }
    });

    numeral.zeroFormat = function (format) {
        zeroFormat = typeof(format) === 'string' ? format : null;
    };

    numeral.defaultFormat = function (format) {
        defaultFormat = typeof(format) === 'string' ? format : '0.0';
    };

    /************************************
        Helpers
    ************************************/

    function loadLanguage(key, values) {
        languages[key] = values;
    }

    /************************************
        Floating-point helpers
    ************************************/

    // The floating-point helper functions and implementation
    // borrows heavily from sinful.js: http://guipn.github.io/sinful.js/

    /**
     * Array.prototype.reduce for browsers that don't support it
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#Compatibility
     */
    if ('function' !== typeof Array.prototype.reduce) {
        Array.prototype.reduce = function (callback, opt_initialValue) {
            'use strict';
            
            if (null === this || 'undefined' === typeof this) {
                // At the moment all modern browsers, that support strict mode, have
                // native implementation of Array.prototype.reduce. For instance, IE8
                // does not support strict mode, so this check is actually useless.
                throw new TypeError('Array.prototype.reduce called on null or undefined');
            }
            
            if ('function' !== typeof callback) {
                throw new TypeError(callback + ' is not a function');
            }

            var index,
                value,
                length = this.length >>> 0,
                isValueSet = false;

            if (1 < arguments.length) {
                value = opt_initialValue;
                isValueSet = true;
            }

            for (index = 0; length > index; ++index) {
                if (this.hasOwnProperty(index)) {
                    if (isValueSet) {
                        value = callback(value, this[index], index, this);
                    } else {
                        value = this[index];
                        isValueSet = true;
                    }
                }
            }

            if (!isValueSet) {
                throw new TypeError('Reduce of empty array with no initial value');
            }

            return value;
        };
    }

    
    /**
     * Computes the multiplier necessary to make x >= 1,
     * effectively eliminating miscalculations caused by
     * finite precision.
     */
    function multiplier(x) {
        var parts = x.toString().split('.');
        if (parts.length < 2) {
            return 1;
        }
        return Math.pow(10, parts[1].length);
    }

    /**
     * Given a variable number of arguments, returns the maximum
     * multiplier that must be used to normalize an operation involving
     * all of them.
     */
    function correctionFactor() {
        var args = Array.prototype.slice.call(arguments);
        return args.reduce(function (prev, next) {
            var mp = multiplier(prev),
                mn = multiplier(next);
        return mp > mn ? mp : mn;
        }, -Infinity);
    }        


    /************************************
        Numeral Prototype
    ************************************/


    numeral.fn = Numeral.prototype = {

        clone : function () {
            return numeral(this);
        },

        format : function (inputString, roundingFunction) {
            return formatNumeral(this, 
                  inputString ? inputString : defaultFormat, 
                  (roundingFunction !== undefined) ? roundingFunction : Math.round
              );
        },

        unformat : function (inputString) {
            if (Object.prototype.toString.call(inputString) === '[object Number]') { 
                return inputString; 
            }
            return unformatNumeral(this, inputString ? inputString : defaultFormat);
        },

        value : function () {
            return this._value;
        },

        valueOf : function () {
            return this._value;
        },

        set : function (value) {
            this._value = Number(value);
            return this;
        },

        add : function (value) {
            var corrFactor = correctionFactor.call(null, this._value, value);
            function cback(accum, curr, currI, O) {
                return accum + corrFactor * curr;
            }
            this._value = [this._value, value].reduce(cback, 0) / corrFactor;
            return this;
        },

        subtract : function (value) {
            var corrFactor = correctionFactor.call(null, this._value, value);
            function cback(accum, curr, currI, O) {
                return accum - corrFactor * curr;
            }
            this._value = [value].reduce(cback, this._value * corrFactor) / corrFactor;            
            return this;
        },

        multiply : function (value) {
            function cback(accum, curr, currI, O) {
                var corrFactor = correctionFactor(accum, curr);
                return (accum * corrFactor) * (curr * corrFactor) /
                    (corrFactor * corrFactor);
            }
            this._value = [this._value, value].reduce(cback, 1);
            return this;
        },

        divide : function (value) {
            function cback(accum, curr, currI, O) {
                var corrFactor = correctionFactor(accum, curr);
                return (accum * corrFactor) / (curr * corrFactor);
            }
            this._value = [this._value, value].reduce(cback);            
            return this;
        },

        difference : function (value) {
            return Math.abs(numeral(this._value).subtract(value).value());
        }

    };

    /************************************
        Exposing Numeral
    ************************************/

    // CommonJS module is defined
    if (hasModule) {
        module.exports = numeral;
    }

    /*global ender:false */
    if (typeof ender === 'undefined') {
        // here, `this` means `window` in the browser, or `global` on the server
        // add `numeral` as a global object via a string identifier,
        // for Closure Compiler 'advanced' mode
        this['numeral'] = numeral;
    }

    /*global define:false */
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return numeral;
        });
    }
}).call(this);

},{}],14:[function(require,module,exports){
'use strict';
/* eslint-disable no-unused-vars */
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (e) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],15:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],16:[function(require,module,exports){
(function (global){
'use strict';

LazyLoad.js([hU.baseURL + 'js/vendors.js'], function () {
  var _require = require('lodash');

  var assign = _require.assign;


  global.React = require('react');
  assign(global.React, require('react-dom'));

  global.jQuery = require('jquery');
  global.$ = jQuery;

  LazyLoad.js([hU.baseURL + 'vendors/slick/slick.min.js'], function () {
    return require('./router');
  });
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./router":28,"jquery":"jquery","lodash":6,"react":"react","react-dom":"react-dom"}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _flux = require('./../flux');

var _Loading = require('./Loading');

var _Loading2 = _interopRequireDefault(_Loading);

var _Offers = require('./Offers');

var _Offers2 = _interopRequireDefault(_Offers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Home = function (_React$Component) {
  _inherits(Home, _React$Component);

  function Home(props) {
    _classCallCheck(this, Home);

    var _this = _possibleConstructorReturn(this, (Home.__proto__ || Object.getPrototypeOf(Home)).call(this, props));

    _this.state = { loading: true };
    return _this;
  }

  _createClass(Home, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _this2 = this;

      _flux.actions.offers.list().then(function () {
        return _this2.setState({ loading: false });
      });
    }
  }, {
    key: 'render',
    value: function render() {
      var loading = this.state.loading;

      var offers = _flux.store.offers.getOffers();

      return _react2.default.createElement(
        'div',
        { id: 'Home' },
        _react2.default.createElement(
          'div',
          { className: 'container' },
          _react2.default.createElement(
            'h1',
            { className: 'section-title' },
            'Ofertas de viagens'
          ),
          loading ? _react2.default.createElement(_Loading2.default, null) : _react2.default.createElement(_Offers2.default, { offers: offers })
        )
      );
    }
  }]);

  return Home;
}(_react2.default.Component);

exports.default = Home;

},{"./../flux":25,"./Loading":18,"./Offers":21,"react":"react"}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Loading = function (_React$Component) {
  _inherits(Loading, _React$Component);

  function Loading() {
    _classCallCheck(this, Loading);

    return _possibleConstructorReturn(this, (Loading.__proto__ || Object.getPrototypeOf(Loading)).apply(this, arguments));
  }

  _createClass(Loading, [{
    key: "render",
    value: function render() {

      return _react2.default.createElement(
        "div",
        { id: "Loading" },
        _react2.default.createElement(
          "p",
          null,
          "Carregando..."
        )
      );
    }
  }]);

  return Loading;
}(_react2.default.Component);

exports.default = Loading;

},{"react":"react"}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactPage = require('react-page');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Main = function (_React$Component) {
  _inherits(Main, _React$Component);

  function Main() {
    _classCallCheck(this, Main);

    return _possibleConstructorReturn(this, (Main.__proto__ || Object.getPrototypeOf(Main)).apply(this, arguments));
  }

  _createClass(Main, [{
    key: 'render',
    value: function render() {

      return _react2.default.createElement(
        'div',
        { id: 'Main' },
        _react2.default.createElement(
          'header',
          null,
          _react2.default.createElement(
            'h1',
            null,
            _react2.default.createElement(
              _reactPage.Link,
              { to: 'app' },
              _react2.default.createElement('img', { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxODAuMjQ5IiBoZWlnaHQ9IjMxLjgzMyI+PGcgZmlsbD0iI0ZGRiI+PHBhdGggZD0iTTE2MC4xIDExLjE4OGMtMi4xOTIgMC00LjA1LjEyMy00Ljk3LjM5My0uMDM3LjAxLS4wNzMuMDI2LS4xMDcuMDQtLjAyMy4wMTQtLjA0NS4wMi0uMDY1LjAzMy0uMjg3LjEzNS0uNDg3LjQwNC0uNDgyLjc5di4wMTNsLS4wMDUtLjAwNC4wMDYgMTAuMTZjMCAuMTk3LjEzNi40NjUuNDYuNDY1aDIuMjE0Yy4zMyAwIC40NC0uMjguNDQtLjQ3bC0uMDItOC41MzhjLjc5LS4xNCAyLjE4Ny0uMTQ2IDIuMTg3LS4xNDYgMy4wNC4wMjMgMi45OSAyLjM3IDIuOTkgMi4zN3Y2LjM2NGMwIC4yMTcuMTgyLjQ0NS40NDcuNDQ1bDIuMi4wMDJjLjI3NCAwIC40ODItLjE4OC40ODItLjQ0My4wMDUtLjA4Mi4wMS00LjYwNC0uMDE0LTYuOTA2LS4wMy0yLjc0Ny0yLjA4Ny00LjU2OC01Ljc2LTQuNTY4ek0xMzMuMjA2IDExLjIyNmMtMS4xNjMgMC0yLjUyMy4zOTUtMi41MjMuMzk1bC4wMDMtMy4wMzhjMC0uMTg4LS4xNS0uNDUzLS40NDUtLjQ1M2gtMi4xM2MtLjE4MyAwLS40NzQuMTA4LS40NzQuNDhsLS4wMDUgMTMuNDEzaC4wMDRjMCAuMDEtLjAwMy4wMTQtLjAwMy4wMjMuMDA2LjQzNC4zMTMuNzkzLjcyNS44NzMuMDA1IDAgLjAwOC4wMDUuMDEyLjAwNSAyLjAwMi4zMzYgMy45MzIuMzEyIDMuOTMyLjMxMiAyLjQ5IDAgNi43NzItLjQ4IDYuNzcyLTYuMDA4IDAtNS41MjQtNC43MDUtNi4wMDQtNS44NjYtNi4wMDR6bS0yLjQ2OCA5LjQwNGwtLjAyNS02LjI2NHMuNjgtLjc5IDIuMDk0LS43OWMxLjQxOCAwIDMuMTQgMS4xNTMgMy4xNCAzLjU2IDAgMi41NS0uODc2IDQuMDc0LTUuMjEgMy40OTR6TTUzLjQwNSA4LjEzSDUwLjk4Yy0uMTg1LjAwNi0uMzQuMTI3LS4zNDIuMzM2VjE0LjA2OGgtNS45OGwtLjAwMy01LjQ3NWMwLS4yNy0uMjE4LS40NjMtLjQ1Ni0uNDYzSDQyLjA0Yy0uMTU3IDAtLjQ2Mi4xLS40NjIuNDk4djEzLjc0NC0uMDIzLjMxYzAgLjI2LjIyOC40MzIuNDQuNDMybC4wMDQuMDAyaDIuMTg1bC0uMjYzLjAwNi4yOC0uMDA2Yy4yMTcgMCAuNDM2LS4xOTUuNDM2LS40NDV2LTYuMTAyaDUuOTgydjYuMTE3YzAgLjI2Ni4yNTUuNDMuNDYyLjQzbDIuMTguMDA2Yy4zNDMgMCAuNDU3LS4yNi40NjMtLjQ3bC4wMDQtMTQuMTZoLS4wMDNjLS4wMDMtLjE5LS4xNTQtLjM0Mi0uMzQyLS4zNHpNOTguMjUzIDIwLjg1OGMwLS4zNDQtLjI4Ni0uNDY3LS40NzUtLjQ2bC0xLjE5Ny4xYy0xLjc1Ny4xNDQtMS43MjgtLjg3Ni0xLjcyOC0uODc2bC0uMDA0LTExYzAtLjMxNi0uMjY1LS40MzgtLjQ1LS40MzhsLTIuMjEzLS4wMDRjLS4xOC4wMTItLjQ1LjEyNS0uNDUuNDZ2MTAuNjEyYzAgMy40MDIgMi42MDcgMy45OTYgNC4wOCAzLjk5Ni4zMzMgMCAuNjQyLS4wMTIuOTItLjAyNy41NDUtLjAyOC44NTgtLjA3IDEuMTE3LS4xMS4wMi0uMDAyLS4wMDMgMCAuMDEtLjAwNi4yMi0uMDI1LjM5Mi0uMjMyLjM5Mi0uNDI0di0xLjgyMnpNNzUuOTk1IDIwLjM5N0w3NC44IDIwLjVjLTEuNzU3LjE0Mi0xLjczLS44NzgtMS43My0uODc4di02LjA3bDIuNDUyLS4wMDJjLjMxMiAwIC40NjgtLjIzMi40NjgtLjQzNGwuMDAzLTEuNDYzYzAtLjMyOC0uMjcyLS40NzctLjQ2LS40NzNsLTIuNDYyLjAwMi0uMDA2LTIuMzZjMC0uNDcyLS4zOC0uNTctLjU4OC0uNTE3bC0xLjg3OC4zOTV2LjAwNGMtLjM1NS4wOTQtLjYyNS4zNzctLjY0LjgwNWgtLjAwM3YuMDM2bC0uMDAyLjAwOC4wMDIuMDF2OS42OWMwIDMuNCAyLjYwNiAzLjk5NSA0LjA4IDMuOTk1LjMzMiAwIC42NC0uMDEzLjkxNi0uMDI4LjU1My0uMDMuODczLS4wNzIgMS4xMy0uMTEuMDMtLjAwNyAwIC4wMDMuMDItLjAwNy4yOTQtLjA0NS4zNjctLjMyLjM2Ny0uNDY3bC0uMDAyLTEuNzY0YzAtLjM2My0uMjg3LS40ODItLjQ3LS40Nzd6TTEyNS44MzUgMTEuODUzYy4wMzYtLjI5LS4xOTQtLjQ2My0uMzY2LS40OS0uMDE1LS4wMDgtLjc5LS4xMDItMS4zNzItLjE1OC0uMjc1LS4wMy0uNzMtLjA2Mi0xLjA2NS0uMDYyLTEuNDc0IDAtMy45MTQuNjQzLTMuOTE0IDQuMDQzdjEuNTU2bC4wMDIgNS44ODdjMCAuMjI4LjE1LjQ3NC40Ni40NzRoMi4yMjRjLjE4Ni0uMDA0LjQzLS4xNTguNDMtLjQ2VjE0LjYyOHMtLjE2LTEuMDk0IDEuNzMtLjg4YzAgMCAxLjAzLjA5NyAxLjE0NC4xMDYuMTg2LjAxOC40MTMtLjA5LjQ4LS4zNjUtLjAwMyAwIC4yNDUtMS42MzIuMjQ1LTEuNjM1ek0xNzkuNjk3IDE3LjMzN2MwLTYuNDMyLTYuMDA4LTYuMTctNi4wMDgtNi4xN2gtLjI2Yy0xLjM0LjA1LTUuNjg1LjYyNS01LjY4NSA2LjA5MiAwIDAtLjM3MyA2LjAyNiA1LjgxIDYuMDI2aC40NmM2LjE4IDAgNS42ODItNS45NSA1LjY4Mi01Ljk1em0tNS45MDcgMy41MTZjLTIgMC0zLjAxNS0xLjU4Ni0zLjAxNS0zLjU1cy45NzMtMy42NTMgMi44ODctMy42NTNjMS45NDQgMCAzLjAzNiAxLjY4OCAzLjAzNiAzLjY1MnMtLjk2MiAzLjU1LTIuOTA4IDMuNTV6TTYxLjg3NyAxMS4xNjdoLS4yNThjLTEuMzQzLjA1LTUuNjg1LjYyNS01LjY4NSA2LjA5MiAwIDAtLjM3MyA2LjAyNiA1LjgxIDYuMDI2aC40NThjNi4xODIgMCA1LjY4Mi01Ljk1IDUuNjgyLTUuOTUgMC02LjQzLTYuMDA4LTYuMTctNi4wMDgtNi4xN3ptLjEwMyA5LjY4NmMtMi4wMDQgMC0zLjAxNi0xLjU4Ni0zLjAxNi0zLjU1cy45NzItMy42NTMgMi44ODUtMy42NTNjMS45NDMgMCAzLjAzNSAxLjY4OCAzLjAzNSAzLjY1MnMtLjk2IDMuNTUtMi45MDUgMy41NXpNMTE2LjUwNCA4LjU3NWMwLS4xOC0uMTItLjQ1LS40NzctLjQ1bC0yLjA5Ny0uMDA1Yy0uMjIzIDAtLjQ2OC4xNDMtLjQ2OC40NjdsLjAwNyAxMS45NWgtMy41MTNjLTEuNTk3IDAtMi4zOTUtLjc4NC0yLjM5NS0yLjM0N2wtLjAxNC05LjYzYzAtLjIyNC0uMjQ0LS40NDQtLjQzMy0uNDRsLTIuMjIyLjAwNGMtLjMgMC0uNDg1LjIzLS40OS40MzJsLS4wMDcgOS43MDdjMCAuNzEuMTU4IDEuMzM4LjQzNyAxLjkyNHMuNjU1IDEuMDkyIDEuMTM0IDEuNTE4Yy40OC40MyAxLjA0Ni43NiAxLjcuOTkyLjY1LjIyNyAxLjM1LjM0OCAyLjEuMzQ4bDUuODYtLjAwNmMuMDE1IDAgLjAyNi0uMDA1LjA0LS4wMDcuNDYyLS4wMjcuODM1LS4zODUuODQ4LS44NTJ2LS4wMTNjLjAwMiAwLS4wMS0xMy41OS0uMDEtMTMuNTkyek04My43OTIgMTEuMTY1Yy01LjM4IDAtNS45NzQgNC4zODMtNS45NzQgNS43OXMuMDE0IDYuMjcgNi40MyA2LjI3YzAgMCAyLjIzNC4wOSA0LjQ0LS43MDZsLjAyNy0uMDFjLjIxLS4wNjMuMzQ2LS4zMTIuMjc4LS41ODdsLS4yNzMtMS4yNTZjLS4wNjgtLjIzOC0uMzE1LS4zOTMtLjU2LS4zMzggMCAwLTEuNzY1LjUtMy42NzcuNS0zLjQ2IDAtMy42MjYtMi42Ni0zLjYyNi0yLjY2bDcuOTA3LS4wMDNjLjE5OCAwIC40NjgtLjExNS40NjgtLjUwNmwuMDAzLTEuNDA3czAtNS4wODgtNS40NDMtNS4wODh6bS0yLjk0NyA0LjcxN3MuMTgtMi4zMDcgMi44Ny0yLjMwN2MyLjQ5OCAwIDIuNTY0IDIuMzA3IDIuNTY0IDIuMzA3aC01LjQzNXpNMTQ2LjM0NSAxMS4xNzNjLTIuMzE4LjAwMi00LjM5Ni43NDQtNC4zOTYuNzQ0bC0uMDYzLjAyYy0uMTg2LjA2LS4zNzQuMjgtLjI5Ni41N2wuNDA2IDEuMzk3Yy4wNzYuMjc1LjMzLjM4My41OTcuMzE2IDAgMCAxLjc2LS42MyAzLjY3My0uNjgyIDIuOTQzLS4wNzYgMi43NyAxLjMwMyAyLjc3IDEuOTcuMDA0LjIyNiAwIC4xNTcgMCAuMTU3bC0uMjYuMDAyaC00LjIwNnMtMy44ODctLjA5NC0zLjg4NyAzLjgyOGMwIDMuODU3IDQuNzI4IDMuNjkzIDQuNzI4IDMuNjkzIDUuNTY0LjA3MiA1Ljk1Mi0uMSA1Ljk1Mi0uMXMuNjg1IDAgLjY4NS0uODA3di03LjA2YzAtLjkuMjA1LTQuMDQ3LTUuNzAyLTQuMDQ3em0tMS4xODYgOS41OHMtMS42MDQuMDQtMS42MDQtMS4zOWMwLTEuNTc1IDEuODEtMS40OSAxLjgxLTEuNDloMy42MzhsLjAxIDIuODY0LTMuODU1LjAxNnoiLz48L2c+PGcgZmlsbD0iI0ZGRiI+PHBhdGggZD0iTTM3LjE4LjIyNWMtLjEwOC0uMTQtLjIyNy0uMTQzLS4zMDMtLjE0M0wzMy41Ni4wODZjLTEuNzMgMC0yLjgzMy45NC0zLjI3NiAyLjgxbC01LjA4IDI3LjkzNWMtLjAyNS4xMjQtLjAzLjI1NS4wNS4zNTUuMDc3LjA5Mi4yNTMuMTM1LjMyNC4xMzVsMi4xMi4wMWMuODkzIDAgMi41NzMtLjUyNSAzLjA4OC0yLjYzN0wzNy4yMjQuNTVjLjAxMi0uMDcuMDM3LS4yMi0uMDQ0LS4zMjV6TTguNzk3IDEyLjYzNWwtLjAyNi0uMTVMNy4wMyAyLjg3M0M2LjU5IDEuMDI1IDUuNDg4LjA4MyAzLjc1OC4wODNMLjQxOC4wNzdILjQwNUMuMzIuMDc4LjIwNC4xNDIuMTMuMjMuMDY0LjMxLjA3NC40NTMuMDkuNTI3bDYuNDQyIDI4LjE3Yy40NzggMi4wMiAyLjE2IDIuNjI1IDMuMDU1IDIuNjI1bDIuMTgtLjAwOGMuMDcgMCAuMjEzLS4wMy4yOS0uMTIzLjA4LS4wOTcuMDgtLjI0LjA1Ni0uMzZsLTEuNC03LjYyYy0uMDU1LS4yNjUuMDUtLjQwMy4wNS0uNDAzLjE1LS4xNi4zNTMtLjEuMzUzLS4xIDIuMTEyLjcyMyAzLjk3Mi42NTQgMy45NzIuNjU0IDYuMTA2IDAgOS40MDgtNC4zNjggOS40MDgtNC4zNjgtMS41NjcgMS4yMS0zLjg5NiAxLjk0LTUuODQ1IDEuOTQtNC45NSAwLTkuMDY3LTMuNTk2LTkuODUzLTguMjk3eiIvPjwvZz48cGF0aCBmaWxsPSIjRkJCMDM0IiBkPSJNMTguNjYyIDE5LjdjNC43NiAwIDguNjMtMy44NyA4LjYzLTguNjMyIDAtMS43NDQtLjUyLTMuMzctMS40MTYtNC43MzQtMS41NDQtMi4zNDYtNC4yMDItMy44OTYtNy4yMTQtMy44OTYtNC43NiAwLTguNjMyIDMuODczLTguNjMyIDguNjMgMCAxLjk1NC42NSAzLjc1NSAxLjc0NCA1LjIwMiAxLjU3OCAyLjA4NCA0LjA4IDMuNDMgNi44ODggMy40M3ptMC0xMy44NDNjMi44NzQgMCA1LjIxMyAyLjMzNiA1LjIxMyA1LjIxIDAgMi44NzgtMi4zNCA1LjIxOC01LjIxMyA1LjIxOC0yLjg3NyAwLTUuMjE0LTIuMzQtNS4yMTQtNS4yMTcgMC0yLjg3NSAyLjMzNy01LjIxIDUuMjE0LTUuMjF6Ii8+PHBhdGggZmlsbD0iI0U4N0QxRSIgZD0iTTExLjc5MiAxNi4yNzVjMS41NzggMi4wODQgNC4wNzcgMy40MzQgNi44ODggMy40MzQgNC43NiAwIDguNjMtMy44NzQgOC42My04LjYzNCAwLTEuNzQ2LS41Mi0zLjM3NS0xLjQxNy00LjczNmwtLjE2Ni0uMjI3Yy4yOTQuODEuNDU1IDEuNjguNDU1IDIuNTkgMCA0LjE3NC0zLjMxOCA3LjU4Mi03LjQ2MyA3LjU4MmgtLjA5NWMtMi44NzYgMC01LjE1Ny0yLjMzOC01LjE1Ny01LjIxMyAwLTIuODczIDIuMzM4LTUuMjEgNS4yMTQtNS4yMWwuMDM1LjAwNWMtNC4xNDggMC03LjUxOCAzLjM1NS03LjUxOCA3LjUwNiAwIDEuMDIuMjAzIDEuOTk0LjU3MyAyLjg4M2wuMDIuMDJ6Ii8+PC9zdmc+', alt: 'Hotel Urbano', title: 'Hotel Urbano' })
            )
          )
        ),
        _react2.default.createElement(_reactPage.RouteHandler, null)
      );
    }
  }]);

  return Main;
}(_react2.default.Component);

exports.default = Main;

},{"react":"react","react-page":"react-page"}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _flux = require('./../flux');

var _Options = require('./Options');

var _Options2 = _interopRequireDefault(_Options);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Offer = function (_React$Component) {
  _inherits(Offer, _React$Component);

  function Offer() {
    _classCallCheck(this, Offer);

    return _possibleConstructorReturn(this, (Offer.__proto__ || Object.getPrototypeOf(Offer)).apply(this, arguments));
  }

  _createClass(Offer, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      LazyLoad.css([hU.baseURL + 'vendors/slick/slick.css', hU.baseURL + 'vendors/slick/slick-theme.css'], this._slick.bind(this));
    }
  }, {
    key: '_slick',
    value: function _slick() {
      $((0, _react.findDOMNode)(this.refs.slick)).slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: false,
        fade: true,
        asNavFor: '.nav'
      });

      $((0, _react.findDOMNode)(this.refs.slickNav)).slick({
        slidesToShow: 0,
        slidesToScroll: 1,
        asNavFor: '.wrapper',
        focusOnSelect: true
      });
    }
  }, {
    key: 'render',
    value: function render() {

      var offer = _flux.store.offers.getOffer();

      return _react2.default.createElement(
        'div',
        { id: 'Offer' },
        _react2.default.createElement(
          'div',
          { className: 'container' },
          _react2.default.createElement(
            'header',
            null,
            _react2.default.createElement(
              'h1',
              { className: 'title' },
              offer.title
            ),
            _react2.default.createElement(
              'h2',
              { className: 'location' },
              offer.location
            ),
            _react2.default.createElement(
              'p',
              null,
              offer.description
            )
          ),
          _react2.default.createElement(
            'div',
            { className: 'slideshow' },
            _react2.default.createElement(
              'div',
              { className: 'wrapper', ref: 'slick' },
              offer.photos.map(function (photo, i) {
                return _react2.default.createElement(
                  'div',
                  { className: 'slide', key: i, style: { backgroundImage: 'url(' + hU.baseURL + photo + ')' } },
                  _react2.default.createElement('img', { src: '' + hU.baseURL + photo })
                );
              })
            ),
            _react2.default.createElement(
              'div',
              { className: 'nav', ref: 'slickNav' },
              offer.photos.map(function (photo, i) {
                return _react2.default.createElement(
                  'div',
                  { className: 'slide', key: i, style: { backgroundImage: 'url(' + hU.baseURL + photo + ')' } },
                  _react2.default.createElement('img', { src: '' + hU.baseURL + photo })
                );
              })
            )
          ),
          _react2.default.createElement(_Options2.default, { options: offer.options })
        )
      );
    }
  }]);

  return Offer;
}(_react2.default.Component);

exports.default = Offer;

},{"./../flux":25,"./Options":22,"react":"react"}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactPage = require('react-page');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Offers = function (_React$Component) {
  _inherits(Offers, _React$Component);

  function Offers() {
    _classCallCheck(this, Offers);

    return _possibleConstructorReturn(this, (Offers.__proto__ || Object.getPrototypeOf(Offers)).apply(this, arguments));
  }

  _createClass(Offers, [{
    key: '_randonImageKey',
    value: function _randonImageKey(min, max) {
      return parseInt(Math.random() * (max - min) + min);
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      var offers = this.props.offers;


      return _react2.default.createElement(
        'div',
        { id: 'Offers' },
        _react2.default.createElement(
          'div',
          { className: 'row' },
          offers.map(function (_ref, index) {
            var description = _ref.description;
            var id = _ref.id;
            var location = _ref.location;
            var photos = _ref.photos;
            var title = _ref.title;
            return _react2.default.createElement(
              'div',
              { className: 'column', key: index },
              _react2.default.createElement(
                _reactPage.Link,
                { to: 'offer', params: { id: id } },
                _react2.default.createElement('div', { className: 'image', style: { backgroundImage: 'url(' + photos[_this2._randonImageKey(1, 5)] + ')' } }),
                _react2.default.createElement(
                  'div',
                  { className: 'info' },
                  _react2.default.createElement(
                    'p',
                    { className: 'location' },
                    location
                  ),
                  _react2.default.createElement(
                    'h2',
                    { className: 'title' },
                    title
                  ),
                  _react2.default.createElement(
                    'p',
                    { className: 'description' },
                    description
                  )
                )
              )
            );
          })
        )
      );
    }
  }]);

  return Offers;
}(_react2.default.Component);

exports.default = Offers;

},{"react":"react","react-page":"react-page"}],22:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _numeral = require('numeral');

var _numeral2 = _interopRequireDefault(_numeral);

var _lodash = require('lodash');

var _Warning = require('./Warning');

var _Warning2 = _interopRequireDefault(_Warning);

var _randomKey = require('./../helpers/randomKey');

var _randomKey2 = _interopRequireDefault(_randomKey);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Options = function (_React$Component) {
  _inherits(Options, _React$Component);

  function Options(props) {
    _classCallCheck(this, Options);

    var _this = _possibleConstructorReturn(this, (Options.__proto__ || Object.getPrototypeOf(Options)).call(this, props));

    _this.state = { options: [] };
    return _this;
  }

  _createClass(Options, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      var options = this.props.options;

      this.setState({ options: (0, _lodash.sortBy)(options, 'price') });
    }
  }, {
    key: '_daily',
    value: function _daily(options) {
      var dailyArr = options.map(function (option, index) {
        return option.daily;
      });
      return (0, _lodash.uniq)(dailyArr);
    }
  }, {
    key: '_departures',
    value: function _departures(options) {
      var departuresArr = options.map(function (option) {
        return option.from.map(function (location) {
          return location;
        });
      });
      return (0, _lodash.uniq)((0, _lodash.flatten)(departuresArr)).sort();
    }
  }, {
    key: '_filterDeparture',
    value: function _filterDeparture(e) {
      var options = this.props.options;

      var filteredOpts = [];

      options.forEach(function (option) {
        option.from.forEach(function (location) {
          if (location === e.target.value) filteredOpts.push(option);
        });
      });

      this.setState({ options: (0, _lodash.sortBy)(filteredOpts, 'price') });
    }
  }, {
    key: '_filterDaily',
    value: function _filterDaily(e) {
      var options = this.props.options;

      var filteredOpts = [];

      options.forEach(function (option) {
        if (option.daily === Number(e.target.value)) filteredOpts.push(option);
      });

      this.setState({ options: (0, _lodash.sortBy)(filteredOpts, 'price') });
    }
  }, {
    key: 'render',
    value: function render() {
      var options = this.state.options || [];
      var srcDaily = this._daily(this.props.options);
      var srcDepartures = this._departures(this.props.options);

      return _react2.default.createElement(
        'div',
        { className: 'options' },
        _react2.default.createElement(
          'header',
          null,
          _react2.default.createElement(
            'p',
            { className: 'section-title' },
            'Escolha sua melhor opção'
          ),
          _react2.default.createElement(
            'form',
            null,
            _react2.default.createElement(
              'div',
              { className: 'form-control' },
              _react2.default.createElement(
                'label',
                null,
                'Saídas: '
              ),
              _react2.default.createElement(
                'div',
                { className: 'select-wrapper' },
                _react2.default.createElement(
                  'select',
                  { onChange: this._filterDeparture.bind(this) },
                  _react2.default.createElement(
                    'option',
                    null,
                    'Escolha'
                  ),
                  srcDepartures.map(function (departure, i) {
                    return _react2.default.createElement(
                      'option',
                      { key: i, value: departure },
                      departure
                    );
                  })
                )
              )
            ),
            _react2.default.createElement(
              'div',
              { className: 'form-control' },
              _react2.default.createElement(
                'label',
                null,
                'N. de diárias: '
              ),
              _react2.default.createElement(
                'div',
                { className: 'select-wrapper' },
                _react2.default.createElement(
                  'select',
                  { onChange: this._filterDaily.bind(this) },
                  _react2.default.createElement(
                    'option',
                    null,
                    'Escolha'
                  ),
                  srcDaily.map(function (daily, i) {
                    return _react2.default.createElement(
                      'option',
                      { key: i, value: daily },
                      daily
                    );
                  })
                )
              )
            )
          )
        ),
        options.map(function (option, index) {
          return _react2.default.createElement(
            'div',
            { className: 'option', key: index },
            _react2.default.createElement(
              'div',
              { className: 'info' },
              _react2.default.createElement(
                'div',
                { className: 'wrapper' },
                _react2.default.createElement(
                  'h3',
                  { className: 'title' },
                  option.title
                ),
                _react2.default.createElement(
                  'p',
                  null,
                  option.description
                )
              )
            ),
            _react2.default.createElement(
              'div',
              { className: 'departures' },
              _react2.default.createElement(
                'div',
                { className: 'wrapper' },
                _react2.default.createElement(
                  'p',
                  { className: 'title' },
                  'Saídas:'
                ),
                _react2.default.createElement(
                  'ul',
                  null,
                  option.from.map(function (locale, index) {
                    return _react2.default.createElement(
                      'li',
                      { key: index },
                      locale
                    );
                  })
                )
              )
            ),
            _react2.default.createElement(
              'div',
              { className: 'specs' },
              _react2.default.createElement(
                'div',
                { className: 'wrapper' },
                _react2.default.createElement(
                  'div',
                  { className: 'daily' },
                  _react2.default.createElement(
                    'p',
                    null,
                    option.daily,
                    ' ',
                    _react2.default.createElement('i', { className: 'icon-calendar-day' })
                  ),
                  _react2.default.createElement(
                    'p',
                    { className: 'small' },
                    'Diárias'
                  )
                ),
                _react2.default.createElement(
                  'div',
                  { className: 'person' },
                  _react2.default.createElement(
                    'p',
                    null,
                    '1 ',
                    _react2.default.createElement('i', { className: 'icon-user' })
                  ),
                  _react2.default.createElement(
                    'p',
                    { className: 'small' },
                    'Pessoa'
                  )
                )
              )
            ),
            _react2.default.createElement(
              'div',
              { className: 'price' },
              _react2.default.createElement(
                'div',
                { className: 'wrapper' },
                _react2.default.createElement(_Warning2.default, { k: (0, _randomKey2.default)(0, 2) }),
                _react2.default.createElement(
                  'p',
                  null,
                  'Por apenas:'
                ),
                _react2.default.createElement(
                  'p',
                  { className: 'price-value' },
                  _react2.default.createElement(
                    'span',
                    null,
                    'R$'
                  ),
                  ' ',
                  (0, _numeral2.default)(option.price).format('0,0')
                ),
                _react2.default.createElement(
                  'p',
                  { className: 'taxes' },
                  '+ taxas  em 10x'
                ),
                _react2.default.createElement(
                  'button',
                  { className: 'buy' },
                  'quero ir'
                )
              )
            )
          );
        })
      );
    }
  }]);

  return Options;
}(_react2.default.Component);

exports.default = Options;

},{"./../helpers/randomKey":26,"./Warning":23,"lodash":6,"numeral":13,"react":"react"}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _randomKey = require('./../helpers/randomKey');

var _randomKey2 = _interopRequireDefault(_randomKey);

var _warnings = require('./../helpers/warnings');

var _warnings2 = _interopRequireDefault(_warnings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Warning = function (_React$Component) {
  _inherits(Warning, _React$Component);

  function Warning() {
    _classCallCheck(this, Warning);

    return _possibleConstructorReturn(this, (Warning.__proto__ || Object.getPrototypeOf(Warning)).apply(this, arguments));
  }

  _createClass(Warning, [{
    key: 'render',
    value: function render() {
      var k = this.props.k;


      return _react2.default.createElement(
        'p',
        { className: 'warning ' + _warnings2.default[k].color },
        _warnings2.default[k].msg
      );
    }
  }]);

  return Warning;
}(_react2.default.Component);

exports.default = Warning;

},{"./../helpers/randomKey":26,"./../helpers/warnings":27,"react":"react"}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.numeral = undefined;

var _numeral = require('numeral');

var _numeral2 = _interopRequireDefault(_numeral);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_numeral2.default.language('pt-br', {
  currency: {
    symbol: 'R$'
  },
  delimiters: {
    thousands: '.',
    decimal: ','
  }
});

_numeral2.default.language('pt-br');

exports.numeral = _numeral2.default;

},{"numeral":13}],25:[function(require,module,exports){
"use strict";

var _mcfly = require("mcfly");

var _mcfly2 = _interopRequireDefault(_mcfly);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Flux = new _mcfly2.default();

// SET ACTIONS
var OffersActions = Flux.createActions({
  list: function list() {
    return new Promise(function (resolve, reject) {
      $.get(hU.baseURL + "api/offers").done(function (data) {
        return resolve(data);
      }).fail(function (jqxhr, textStatus, error) {
        return console.log(error);
      });
    }).then(function (result) {
      return {
        data: result,
        actionType: "OFFERS"
      };
    });
  },

  get: function get(id) {
    return new Promise(function (resolve, reject) {
      $.get(hU.baseURL + "api/offer/" + id).done(function (data) {
        return resolve(data);
      }).fail(function (jqxhr, textStatus, error) {
        return console.log(error);
      });
    }).then(function (result) {
      return {
        data: result,
        actionType: "OFFER"
      };
    });
  }
});

// SET STORES
var OffersStore = Flux.createStore({
  setOffers: function setOffers(data) {
    this.offers = data;
  },

  getOffers: function getOffers() {
    return this.offers;
  },

  setOffer: function setOffer(data) {
    this.offer = data;
  },

  getOffer: function getOffer() {
    return this.offer;
  }
}, function (payload) {
  switch (payload.actionType) {
    case 'OFFERS':
      OffersStore.setOffers(payload.data);
      break;

    case 'OFFER':
      OffersStore.setOffer(payload.data);
      break;

    default:
      return false;
  }

  return true;
});

// HELPER
var aliases = {
  actions: {
    offers: OffersActions
  },

  store: {
    offers: OffersStore
  }
};

module.exports = aliases;

},{"mcfly":7}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var randomKey = function randomKey(min, max) {
    return parseInt(Math.random() * (max - min) + min);
};

exports.default = randomKey;

},{}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var warnings = [{
  msg: '$ Tarifa não reembolsável',
  color: 'orange'
}, {
  msg: '$ Cancelamento grátis',
  color: 'green'
}];

exports.default = warnings;

},{}],28:[function(require,module,exports){
'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _reactPage = require('react-page');

var _reactPage2 = _interopRequireDefault(_reactPage);

var _flux = require('./flux');

var _Main = require('./components/Main');

var _Main2 = _interopRequireDefault(_Main);

var _Home = require('./components/Home');

var _Home2 = _interopRequireDefault(_Home);

var _Offer = require('./components/Offer');

var _Offer2 = _interopRequireDefault(_Offer);

var _numeral = require('./config/numeral');

var _numeral2 = _interopRequireDefault(_numeral);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var render = function render(RootComponent) {
  return _reactDom2.default.render(_react2.default.createElement(RootComponent, null), document.getElementById('app'));
};

_reactPage2.default.set(render).with(_Main2.default).on('app', '/', _Home2.default).on('offer', '/offer/:id', _reactPage2.default.when(function (_ref) {
  var params = _ref.params;
  return _flux.actions.offers.get(params.id);
}, _Offer2.default, null, null)).run();

},{"./components/Home":17,"./components/Main":19,"./components/Offer":20,"./config/numeral":24,"./flux":25,"react":"react","react-dom":"react-dom","react-page":"react-page"}]},{},[16])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbHV4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZsdXgvbGliL0Rpc3BhdGNoZXIuanMiLCJub2RlX21vZHVsZXMvZmx1eC9ub2RlX21vZHVsZXMvZmJqcy9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL2ludmFyaWFudC9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9kaXN0L2xvZGFzaC5qcyIsIm5vZGVfbW9kdWxlcy9tY2ZseS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tY2ZseS9saWIvQWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL21jZmx5L2xpYi9BY3Rpb25zRmFjdG9yeS5qcyIsIm5vZGVfbW9kdWxlcy9tY2ZseS9saWIvRGlzcGF0Y2hlci5qcyIsIm5vZGVfbW9kdWxlcy9tY2ZseS9saWIvTWNGbHkuanMiLCJub2RlX21vZHVsZXMvbWNmbHkvbGliL1N0b3JlLmpzIiwibm9kZV9tb2R1bGVzL251bWVyYWwvbnVtZXJhbC5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9qcy9hcHAuanMiLCJzcmMvanMvY29tcG9uZW50cy9Ib21lLmpzIiwic3JjL2pzL2NvbXBvbmVudHMvTG9hZGluZy5qcyIsInNyYy9qcy9jb21wb25lbnRzL01haW4uanMiLCJzcmMvanMvY29tcG9uZW50cy9PZmZlci5qcyIsInNyYy9qcy9jb21wb25lbnRzL09mZmVycy5qcyIsInNyYy9qcy9jb21wb25lbnRzL09wdGlvbnMuanMiLCJzcmMvanMvY29tcG9uZW50cy9XYXJuaW5nLmpzIiwic3JjL2pzL2NvbmZpZy9udW1lcmFsLmpzIiwic3JjL2pzL2ZsdXgvaW5kZXguanMiLCJzcmMvanMvaGVscGVycy9yYW5kb21LZXkuanMiLCJzcmMvanMvaGVscGVycy93YXJuaW5ncy5qcyIsInNyYy9qcy9yb3V0ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3YzSkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdnFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3BMQSxTQUFTLEVBQVQsQ0FBWSxDQUFJLEdBQUcsT0FBUCxtQkFBWixFQUE0QyxZQUFNO0FBQUEsaUJBRS9CLFFBQVEsUUFBUixDQUYrQjs7QUFBQSxNQUV6QyxNQUZ5QyxZQUV6QyxNQUZ5Qzs7O0FBSWhELFNBQU8sS0FBUCxHQUFlLFFBQVEsT0FBUixDQUFmO0FBQ0EsU0FBTyxPQUFPLEtBQWQsRUFBcUIsUUFBUSxXQUFSLENBQXJCOztBQUVBLFNBQU8sTUFBUCxHQUFnQixRQUFRLFFBQVIsQ0FBaEI7QUFDQSxTQUFPLENBQVAsR0FBVyxNQUFYOztBQUVBLFdBQVMsRUFBVCxDQUFZLENBQUksR0FBRyxPQUFQLGdDQUFaLEVBQXlEO0FBQUEsV0FBTSxRQUFRLFVBQVIsQ0FBTjtBQUFBLEdBQXpEO0FBQ0QsQ0FYRDs7Ozs7Ozs7Ozs7OztBQ0FBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7Ozs7O0lBRXFCLEk7OztBQUVuQixnQkFBWSxLQUFaLEVBQW1CO0FBQUE7O0FBQUEsNEdBQ1gsS0FEVzs7QUFFakIsVUFBSyxLQUFMLEdBQWEsRUFBRSxTQUFTLElBQVgsRUFBYjtBQUZpQjtBQUdsQjs7Ozt3Q0FFbUI7QUFBQTs7QUFFbEIsb0JBQVEsTUFBUixDQUFlLElBQWYsR0FDRyxJQURILENBQ1E7QUFBQSxlQUFNLE9BQUssUUFBTCxDQUFjLEVBQUMsU0FBUyxLQUFWLEVBQWQsQ0FBTjtBQUFBLE9BRFI7QUFFRDs7OzZCQUVRO0FBQUEsVUFFQSxPQUZBLEdBRVcsS0FBSyxLQUZoQixDQUVBLE9BRkE7O0FBR1AsVUFBTSxTQUFTLFlBQU0sTUFBTixDQUFhLFNBQWIsRUFBZjs7QUFFQSxhQUNFO0FBQUE7QUFBQSxVQUFLLElBQUcsTUFBUjtBQUNFO0FBQUE7QUFBQSxZQUFLLFdBQVUsV0FBZjtBQUNBO0FBQUE7QUFBQSxjQUFJLFdBQVUsZUFBZDtBQUFBO0FBQUEsV0FEQTtBQUdJLG9CQUFVLHNEQUFWLEdBQXdCLGtEQUFRLFFBQVEsTUFBaEI7QUFINUI7QUFERixPQURGO0FBVUQ7Ozs7RUE1QitCLGdCQUFNLFM7O2tCQUFuQixJOzs7Ozs7Ozs7OztBQ0xyQjs7Ozs7Ozs7Ozs7O0lBRXFCLE87Ozs7Ozs7Ozs7OzZCQUVWOztBQUVQLGFBQ0U7QUFBQTtBQUFBLFVBQUssSUFBRyxTQUFSO0FBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQURGLE9BREY7QUFLRDs7OztFQVRrQyxnQkFBTSxTOztrQkFBdEIsTzs7Ozs7Ozs7Ozs7QUNGckI7Ozs7QUFDQTs7Ozs7Ozs7OztJQUVxQixJOzs7Ozs7Ozs7Ozs2QkFFVjs7QUFFUCxhQUNFO0FBQUE7QUFBQSxVQUFLLElBQUcsTUFBUjtBQUNFO0FBQUE7QUFBQTtBQUNFO0FBQUE7QUFBQTtBQUNFO0FBQUE7QUFBQSxnQkFBTSxJQUFHLEtBQVQ7QUFBZSxxREFBSyxLQUFJLDQrTkFBVCxFQUFzL04sS0FBSSxjQUExL04sRUFBeWdPLE9BQU0sY0FBL2dPO0FBQWY7QUFERjtBQURGLFNBREY7QUFNQTtBQU5BLE9BREY7QUFVRDs7OztFQWQrQixnQkFBTSxTOztrQkFBbkIsSTs7Ozs7Ozs7Ozs7QUNIckI7Ozs7QUFDQTs7QUFDQTs7Ozs7Ozs7Ozs7O0lBRXFCLEs7Ozs7Ozs7Ozs7O3dDQUVDO0FBQ2xCLGVBQVMsR0FBVCxDQUFhLENBQ1IsR0FBRyxPQURLLDhCQUVSLEdBQUcsT0FGSyxtQ0FBYixFQUdHLEtBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsSUFBakIsQ0FISDtBQUlEOzs7NkJBRVE7QUFDUCxRQUFFLHdCQUFZLEtBQUssSUFBTCxDQUFVLEtBQXRCLENBQUYsRUFBZ0MsS0FBaEMsQ0FBc0M7QUFDcEMsc0JBQWMsQ0FEc0I7QUFFcEMsd0JBQWdCLENBRm9CO0FBR3BDLGdCQUFRLEtBSDRCO0FBSXBDLGNBQU0sSUFKOEI7QUFLcEMsa0JBQVU7QUFMMEIsT0FBdEM7O0FBUUEsUUFBRSx3QkFBWSxLQUFLLElBQUwsQ0FBVSxRQUF0QixDQUFGLEVBQW1DLEtBQW5DLENBQXlDO0FBQ3ZDLHNCQUFjLENBRHlCO0FBRXZDLHdCQUFnQixDQUZ1QjtBQUd2QyxrQkFBVSxVQUg2QjtBQUl2Qyx1QkFBZTtBQUp3QixPQUF6QztBQU1EOzs7NkJBRVE7O0FBRVAsVUFBTSxRQUFRLFlBQU0sTUFBTixDQUFhLFFBQWIsRUFBZDs7QUFFQSxhQUNFO0FBQUE7QUFBQSxVQUFLLElBQUcsT0FBUjtBQUNFO0FBQUE7QUFBQSxZQUFLLFdBQVUsV0FBZjtBQUNFO0FBQUE7QUFBQTtBQUNFO0FBQUE7QUFBQSxnQkFBSSxXQUFVLE9BQWQ7QUFBdUIsb0JBQU07QUFBN0IsYUFERjtBQUVFO0FBQUE7QUFBQSxnQkFBSSxXQUFVLFVBQWQ7QUFBMEIsb0JBQU07QUFBaEMsYUFGRjtBQUdFO0FBQUE7QUFBQTtBQUFJLG9CQUFNO0FBQVY7QUFIRixXQURGO0FBTUU7QUFBQTtBQUFBLGNBQUssV0FBVSxXQUFmO0FBQ0U7QUFBQTtBQUFBLGdCQUFLLFdBQVUsU0FBZixFQUF5QixLQUFJLE9BQTdCO0FBRUksb0JBQU0sTUFBTixDQUFhLEdBQWIsQ0FBaUIsVUFBQyxLQUFELEVBQVEsQ0FBUjtBQUFBLHVCQUNmO0FBQUE7QUFBQSxvQkFBSyxXQUFVLE9BQWYsRUFBd0IsS0FBSyxDQUE3QixFQUFnQyxPQUFPLEVBQUMsMEJBQXdCLEdBQUcsT0FBM0IsR0FBcUMsS0FBckMsTUFBRCxFQUF2QztBQUNFLHlEQUFLLFVBQVEsR0FBRyxPQUFYLEdBQXFCLEtBQTFCO0FBREYsaUJBRGU7QUFBQSxlQUFqQjtBQUZKLGFBREY7QUFVRTtBQUFBO0FBQUEsZ0JBQUssV0FBVSxLQUFmLEVBQXFCLEtBQUksVUFBekI7QUFFSSxvQkFBTSxNQUFOLENBQWEsR0FBYixDQUFpQixVQUFDLEtBQUQsRUFBUSxDQUFSO0FBQUEsdUJBQ2Y7QUFBQTtBQUFBLG9CQUFLLFdBQVUsT0FBZixFQUF3QixLQUFLLENBQTdCLEVBQWdDLE9BQU8sRUFBQywwQkFBd0IsR0FBRyxPQUEzQixHQUFxQyxLQUFyQyxNQUFELEVBQXZDO0FBQ0UseURBQUssVUFBUSxHQUFHLE9BQVgsR0FBcUIsS0FBMUI7QUFERixpQkFEZTtBQUFBLGVBQWpCO0FBRko7QUFWRixXQU5GO0FBMEJFLDZEQUFTLFNBQVMsTUFBTSxPQUF4QjtBQTFCRjtBQURGLE9BREY7QUFnQ0Q7Ozs7RUE5RGdDLGdCQUFNLFM7O2tCQUFwQixLOzs7Ozs7Ozs7OztBQ0pyQjs7OztBQUNBOzs7Ozs7Ozs7O0lBRXFCLE07Ozs7Ozs7Ozs7O29DQUVILEcsRUFBSyxHLEVBQUs7QUFDeEIsYUFBTyxTQUFTLEtBQUssTUFBTCxNQUFpQixNQUFNLEdBQXZCLElBQThCLEdBQXZDLENBQVA7QUFDRDs7OzZCQUVRO0FBQUE7O0FBQUEsVUFDQSxNQURBLEdBQ1UsS0FBSyxLQURmLENBQ0EsTUFEQTs7O0FBR1AsYUFDRTtBQUFBO0FBQUEsVUFBSyxJQUFHLFFBQVI7QUFDRTtBQUFBO0FBQUEsWUFBSyxXQUFVLEtBQWY7QUFFSSxpQkFBTyxHQUFQLENBQVcsZ0JBQTZDLEtBQTdDO0FBQUEsZ0JBQUUsV0FBRixRQUFFLFdBQUY7QUFBQSxnQkFBZSxFQUFmLFFBQWUsRUFBZjtBQUFBLGdCQUFtQixRQUFuQixRQUFtQixRQUFuQjtBQUFBLGdCQUE2QixNQUE3QixRQUE2QixNQUE3QjtBQUFBLGdCQUFxQyxLQUFyQyxRQUFxQyxLQUFyQztBQUFBLG1CQUNUO0FBQUE7QUFBQSxnQkFBSyxXQUFVLFFBQWYsRUFBd0IsS0FBSyxLQUE3QjtBQUNFO0FBQUE7QUFBQSxrQkFBTSxJQUFHLE9BQVQsRUFBaUIsUUFBUSxFQUFDLElBQUksRUFBTCxFQUF6QjtBQUNFLHVEQUFLLFdBQVUsT0FBZixFQUF1QixPQUFPLEVBQUMsMEJBQXdCLE9BQU8sT0FBSyxlQUFMLENBQXFCLENBQXJCLEVBQXVCLENBQXZCLENBQVAsQ0FBeEIsTUFBRCxFQUE5QixHQURGO0FBRUU7QUFBQTtBQUFBLG9CQUFLLFdBQVUsTUFBZjtBQUNFO0FBQUE7QUFBQSxzQkFBRyxXQUFVLFVBQWI7QUFBeUI7QUFBekIsbUJBREY7QUFFRTtBQUFBO0FBQUEsc0JBQUksV0FBVSxPQUFkO0FBQXVCO0FBQXZCLG1CQUZGO0FBR0U7QUFBQTtBQUFBLHNCQUFHLFdBQVUsYUFBYjtBQUE0QjtBQUE1QjtBQUhGO0FBRkY7QUFERixhQURTO0FBQUEsV0FBWDtBQUZKO0FBREYsT0FERjtBQW9CRDs7OztFQTdCaUMsZ0JBQU0sUzs7a0JBQXJCLE07Ozs7Ozs7Ozs7O0FDSHJCOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOzs7Ozs7Ozs7Ozs7SUFFcUIsTzs7O0FBRW5CLG1CQUFZLEtBQVosRUFBa0I7QUFBQTs7QUFBQSxrSEFDVixLQURVOztBQUVoQixVQUFLLEtBQUwsR0FBYSxFQUFDLFNBQVMsRUFBVixFQUFiO0FBRmdCO0FBR2pCOzs7O3dDQUVtQjtBQUFBLFVBQ1gsT0FEVyxHQUNBLEtBQUssS0FETCxDQUNYLE9BRFc7O0FBRWxCLFdBQUssUUFBTCxDQUFjLEVBQUMsU0FBUyxvQkFBTyxPQUFQLEVBQWdCLE9BQWhCLENBQVYsRUFBZDtBQUNEOzs7MkJBRU0sTyxFQUFTO0FBQ2QsVUFBTSxXQUFXLFFBQVEsR0FBUixDQUFZLFVBQUMsTUFBRCxFQUFTLEtBQVQ7QUFBQSxlQUFtQixPQUFPLEtBQTFCO0FBQUEsT0FBWixDQUFqQjtBQUNBLGFBQU8sa0JBQUssUUFBTCxDQUFQO0FBQ0Q7OztnQ0FFVyxPLEVBQVM7QUFDbkIsVUFBTSxnQkFBZ0IsUUFBUSxHQUFSLENBQVk7QUFBQSxlQUFVLE9BQU8sSUFBUCxDQUFZLEdBQVosQ0FBZ0I7QUFBQSxpQkFBWSxRQUFaO0FBQUEsU0FBaEIsQ0FBVjtBQUFBLE9BQVosQ0FBdEI7QUFDQSxhQUFPLGtCQUFLLHFCQUFRLGFBQVIsQ0FBTCxFQUE2QixJQUE3QixFQUFQO0FBQ0Q7OztxQ0FFZ0IsQyxFQUFHO0FBQUEsVUFDWCxPQURXLEdBQ0EsS0FBSyxLQURMLENBQ1gsT0FEVzs7QUFFbEIsVUFBTSxlQUFlLEVBQXJCOztBQUVBLGNBQVEsT0FBUixDQUFnQixVQUFDLE1BQUQsRUFBWTtBQUN4QixlQUFPLElBQVAsQ0FBWSxPQUFaLENBQW9CLFVBQUMsUUFBRCxFQUFhO0FBQy9CLGNBQUcsYUFBYSxFQUFFLE1BQUYsQ0FBUyxLQUF6QixFQUFnQyxhQUFhLElBQWIsQ0FBa0IsTUFBbEI7QUFDakMsU0FGRDtBQUdELE9BSkg7O0FBTUEsV0FBSyxRQUFMLENBQWMsRUFBQyxTQUFTLG9CQUFPLFlBQVAsRUFBcUIsT0FBckIsQ0FBVixFQUFkO0FBQ0Q7OztpQ0FFWSxDLEVBQUc7QUFBQSxVQUNQLE9BRE8sR0FDSSxLQUFLLEtBRFQsQ0FDUCxPQURPOztBQUVkLFVBQU0sZUFBZSxFQUFyQjs7QUFFQSxjQUFRLE9BQVIsQ0FBZ0IsVUFBQyxNQUFELEVBQVk7QUFDMUIsWUFBRyxPQUFPLEtBQVAsS0FBaUIsT0FBTyxFQUFFLE1BQUYsQ0FBUyxLQUFoQixDQUFwQixFQUE0QyxhQUFhLElBQWIsQ0FBa0IsTUFBbEI7QUFDN0MsT0FGRDs7QUFJQSxXQUFLLFFBQUwsQ0FBYyxFQUFDLFNBQVMsb0JBQU8sWUFBUCxFQUFxQixPQUFyQixDQUFWLEVBQWQ7QUFDRDs7OzZCQUVRO0FBQ1AsVUFBTSxVQUFVLEtBQUssS0FBTCxDQUFXLE9BQVgsSUFBc0IsRUFBdEM7QUFDQSxVQUFNLFdBQVcsS0FBSyxNQUFMLENBQVksS0FBSyxLQUFMLENBQVcsT0FBdkIsQ0FBakI7QUFDQSxVQUFNLGdCQUFnQixLQUFLLFdBQUwsQ0FBaUIsS0FBSyxLQUFMLENBQVcsT0FBNUIsQ0FBdEI7O0FBRUEsYUFDRTtBQUFBO0FBQUEsVUFBSyxXQUFVLFNBQWY7QUFDRTtBQUFBO0FBQUE7QUFDRTtBQUFBO0FBQUEsY0FBRyxXQUFVLGVBQWI7QUFBQTtBQUFBLFdBREY7QUFFRTtBQUFBO0FBQUE7QUFDRTtBQUFBO0FBQUEsZ0JBQUssV0FBVSxjQUFmO0FBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQURGO0FBRUU7QUFBQTtBQUFBLGtCQUFLLFdBQVUsZ0JBQWY7QUFDRTtBQUFBO0FBQUEsb0JBQVEsVUFBVSxLQUFLLGdCQUFMLENBQXNCLElBQXRCLENBQTJCLElBQTNCLENBQWxCO0FBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFERjtBQUdJLGdDQUFjLEdBQWQsQ0FBa0IsVUFBQyxTQUFELEVBQVksQ0FBWjtBQUFBLDJCQUNoQjtBQUFBO0FBQUEsd0JBQVEsS0FBSyxDQUFiLEVBQWdCLE9BQU8sU0FBdkI7QUFBbUM7QUFBbkMscUJBRGdCO0FBQUEsbUJBQWxCO0FBSEo7QUFERjtBQUZGLGFBREY7QUFjRTtBQUFBO0FBQUEsZ0JBQUssV0FBVSxjQUFmO0FBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQURGO0FBRUU7QUFBQTtBQUFBLGtCQUFLLFdBQVUsZ0JBQWY7QUFDRTtBQUFBO0FBQUEsb0JBQVEsVUFBVSxLQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsSUFBdkIsQ0FBbEI7QUFDRTtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQURGO0FBR0ksMkJBQVMsR0FBVCxDQUFhLFVBQUMsS0FBRCxFQUFRLENBQVI7QUFBQSwyQkFDWDtBQUFBO0FBQUEsd0JBQVEsS0FBSyxDQUFiLEVBQWdCLE9BQU8sS0FBdkI7QUFBK0I7QUFBL0IscUJBRFc7QUFBQSxtQkFBYjtBQUhKO0FBREY7QUFGRjtBQWRGO0FBRkYsU0FERjtBQWlDSSxnQkFBUSxHQUFSLENBQVksVUFBQyxNQUFELEVBQVMsS0FBVDtBQUFBLGlCQUNWO0FBQUE7QUFBQSxjQUFLLFdBQVUsUUFBZixFQUF3QixLQUFLLEtBQTdCO0FBQ0U7QUFBQTtBQUFBLGdCQUFLLFdBQVUsTUFBZjtBQUNFO0FBQUE7QUFBQSxrQkFBSyxXQUFVLFNBQWY7QUFDRTtBQUFBO0FBQUEsb0JBQUksV0FBVSxPQUFkO0FBQXVCLHlCQUFPO0FBQTlCLGlCQURGO0FBRUU7QUFBQTtBQUFBO0FBQUkseUJBQU87QUFBWDtBQUZGO0FBREYsYUFERjtBQU9FO0FBQUE7QUFBQSxnQkFBSyxXQUFVLFlBQWY7QUFDRTtBQUFBO0FBQUEsa0JBQUssV0FBVSxTQUFmO0FBQ0U7QUFBQTtBQUFBLG9CQUFHLFdBQVUsT0FBYjtBQUFBO0FBQUEsaUJBREY7QUFFRTtBQUFBO0FBQUE7QUFFSSx5QkFBTyxJQUFQLENBQVksR0FBWixDQUFnQixVQUFDLE1BQUQsRUFBUyxLQUFUO0FBQUEsMkJBQ2Q7QUFBQTtBQUFBLHdCQUFJLEtBQUssS0FBVDtBQUFpQjtBQUFqQixxQkFEYztBQUFBLG1CQUFoQjtBQUZKO0FBRkY7QUFERixhQVBGO0FBbUJFO0FBQUE7QUFBQSxnQkFBSyxXQUFVLE9BQWY7QUFDRTtBQUFBO0FBQUEsa0JBQUssV0FBVSxTQUFmO0FBQ0U7QUFBQTtBQUFBLG9CQUFLLFdBQVUsT0FBZjtBQUNFO0FBQUE7QUFBQTtBQUFJLDJCQUFPLEtBQVg7QUFBQTtBQUFrQix5REFBRyxXQUFVLG1CQUFiO0FBQWxCLG1CQURGO0FBRUU7QUFBQTtBQUFBLHNCQUFHLFdBQVUsT0FBYjtBQUFBO0FBQUE7QUFGRixpQkFERjtBQUtFO0FBQUE7QUFBQSxvQkFBSyxXQUFVLFFBQWY7QUFDRTtBQUFBO0FBQUE7QUFBQTtBQUFLLHlEQUFHLFdBQVUsV0FBYjtBQUFMLG1CQURGO0FBRUU7QUFBQTtBQUFBLHNCQUFHLFdBQVUsT0FBYjtBQUFBO0FBQUE7QUFGRjtBQUxGO0FBREYsYUFuQkY7QUErQkU7QUFBQTtBQUFBLGdCQUFLLFdBQVUsT0FBZjtBQUNFO0FBQUE7QUFBQSxrQkFBSyxXQUFVLFNBQWY7QUFDRSxtRUFBUyxHQUFHLHlCQUFVLENBQVYsRUFBWSxDQUFaLENBQVosR0FERjtBQUVFO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBRkY7QUFHRTtBQUFBO0FBQUEsb0JBQUcsV0FBVSxhQUFiO0FBQTJCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQTNCO0FBQUE7QUFBNEMseUNBQVEsT0FBTyxLQUFmLEVBQXNCLE1BQXRCLENBQTZCLEtBQTdCO0FBQTVDLGlCQUhGO0FBSUU7QUFBQTtBQUFBLG9CQUFHLFdBQVUsT0FBYjtBQUFBO0FBQUEsaUJBSkY7QUFLRTtBQUFBO0FBQUEsb0JBQVEsV0FBVSxLQUFsQjtBQUFBO0FBQUE7QUFMRjtBQURGO0FBL0JGLFdBRFU7QUFBQSxTQUFaO0FBakNKLE9BREY7QUFnRkQ7Ozs7RUFuSWtDLGdCQUFNLFM7O2tCQUF0QixPOzs7Ozs7Ozs7OztBQ05yQjs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7Ozs7OztJQUVxQixPOzs7Ozs7Ozs7Ozs2QkFFVjtBQUFBLFVBRUEsQ0FGQSxHQUVLLEtBQUssS0FGVixDQUVBLENBRkE7OztBQUlQLGFBQ0U7QUFBQTtBQUFBLFVBQUcsd0JBQXNCLG1CQUFTLENBQVQsRUFBWSxLQUFyQztBQUErQywyQkFBUyxDQUFULEVBQVk7QUFBM0QsT0FERjtBQUdEOzs7O0VBVGtDLGdCQUFNLFM7O2tCQUF0QixPOzs7Ozs7Ozs7O0FDSnJCOzs7Ozs7QUFFQSxrQkFBUSxRQUFSLENBQWlCLE9BQWpCLEVBQTBCO0FBQ3hCLFlBQVU7QUFDUixZQUFRO0FBREEsR0FEYztBQUl4QixjQUFZO0FBQ1YsZUFBVyxHQUREO0FBRVYsYUFBUztBQUZDO0FBSlksQ0FBMUI7O0FBVUEsa0JBQVEsUUFBUixDQUFpQixPQUFqQjs7UUFFUSxPOzs7OztBQ2RSOzs7Ozs7QUFFQSxJQUFNLE9BQU8scUJBQWI7O0FBRUE7QUFDQSxJQUFNLGdCQUFnQixLQUFLLGFBQUwsQ0FDcEI7QUFDRSxRQUFNO0FBQUEsV0FBTSxJQUFJLE9BQUosQ0FBWSxVQUFTLE9BQVQsRUFBa0IsTUFBbEIsRUFBMEI7QUFDaEQsUUFBRSxHQUFGLENBQVMsR0FBRyxPQUFaLGlCQUNHLElBREgsQ0FDUSxVQUFDLElBQUQ7QUFBQSxlQUFVLFFBQVEsSUFBUixDQUFWO0FBQUEsT0FEUixFQUVHLElBRkgsQ0FFUSxVQUFDLEtBQUQsRUFBUSxVQUFSLEVBQW9CLEtBQXBCO0FBQUEsZUFBOEIsUUFBUSxHQUFSLENBQVksS0FBWixDQUE5QjtBQUFBLE9BRlI7QUFHQyxLQUpTLEVBS1QsSUFMUyxDQUtKLFVBQUMsTUFBRDtBQUFBLGFBQWE7QUFDakIsY0FBTSxNQURXO0FBRWpCLG9CQUFZO0FBRkssT0FBYjtBQUFBLEtBTEksQ0FBTjtBQUFBLEdBRFI7O0FBV0UsT0FBSyxhQUFDLEVBQUQ7QUFBQSxXQUFRLElBQUksT0FBSixDQUFZLFVBQVMsT0FBVCxFQUFrQixNQUFsQixFQUEwQjtBQUNqRCxRQUFFLEdBQUYsQ0FBUyxHQUFHLE9BQVosa0JBQWdDLEVBQWhDLEVBQ0UsSUFERixDQUNPLFVBQUMsSUFBRDtBQUFBLGVBQVUsUUFBUSxJQUFSLENBQVY7QUFBQSxPQURQLEVBRUUsSUFGRixDQUVPLFVBQUMsS0FBRCxFQUFRLFVBQVIsRUFBb0IsS0FBcEI7QUFBQSxlQUE4QixRQUFRLEdBQVIsQ0FBWSxLQUFaLENBQTlCO0FBQUEsT0FGUDtBQUdDLEtBSlUsRUFLWixJQUxZLENBS1AsVUFBQyxNQUFEO0FBQUEsYUFBYTtBQUNqQixjQUFNLE1BRFc7QUFFakIsb0JBQVk7QUFGSyxPQUFiO0FBQUEsS0FMTyxDQUFSO0FBQUE7QUFYUCxDQURvQixDQUF0Qjs7QUF3QkE7QUFDQSxJQUFNLGNBQWMsS0FBSyxXQUFMLENBQ2xCO0FBQ0UsYUFBVyxtQkFBUyxJQUFULEVBQWU7QUFDeEIsU0FBSyxNQUFMLEdBQWMsSUFBZDtBQUNELEdBSEg7O0FBS0UsYUFBVyxxQkFBVztBQUNwQixXQUFPLEtBQUssTUFBWjtBQUNELEdBUEg7O0FBU0UsWUFBVSxrQkFBUyxJQUFULEVBQWU7QUFDdkIsU0FBSyxLQUFMLEdBQWEsSUFBYjtBQUNELEdBWEg7O0FBYUUsWUFBVSxvQkFBVztBQUNuQixXQUFPLEtBQUssS0FBWjtBQUNEO0FBZkgsQ0FEa0IsRUFtQmxCLFVBQVMsT0FBVCxFQUFpQjtBQUNmLFVBQU8sUUFBUSxVQUFmO0FBQ0UsU0FBSyxRQUFMO0FBQ0Usa0JBQVksU0FBWixDQUFzQixRQUFRLElBQTlCO0FBQ0E7O0FBRUYsU0FBSyxPQUFMO0FBQ0Usa0JBQVksUUFBWixDQUFxQixRQUFRLElBQTdCO0FBQ0E7O0FBRUY7QUFDRSxhQUFPLEtBQVA7QUFWSjs7QUFhQSxTQUFPLElBQVA7QUFDRCxDQWxDaUIsQ0FBcEI7O0FBcUNBO0FBQ0EsSUFBTSxVQUFVO0FBQ2QsV0FBUztBQUNQLFlBQVE7QUFERCxHQURLOztBQUtkLFNBQU87QUFDTCxZQUFRO0FBREg7QUFMTyxDQUFoQjs7QUFVQSxPQUFPLE9BQVAsR0FBaUIsT0FBakI7Ozs7Ozs7O0FDOUVBLElBQU0sWUFBWSxTQUFaLFNBQVksQ0FBUyxHQUFULEVBQWMsR0FBZCxFQUFtQjtBQUNqQyxXQUFPLFNBQVMsS0FBSyxNQUFMLE1BQWlCLE1BQU0sR0FBdkIsSUFBOEIsR0FBdkMsQ0FBUDtBQUNELENBRkg7O2tCQUllLFM7Ozs7Ozs7O0FDSmYsSUFBTSxXQUFXLENBQ2Y7QUFDRSxPQUFLLDJCQURQO0FBRUUsU0FBTztBQUZULENBRGUsRUFLZjtBQUNFLE9BQUssdUJBRFA7QUFFRSxTQUFPO0FBRlQsQ0FMZSxDQUFqQjs7a0JBV2UsUTs7Ozs7QUNYZjs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFFQTs7Ozs7O0FBRUEsSUFBSSxTQUFTLFNBQVQsTUFBUztBQUFBLFNBQWlCLG1CQUFTLE1BQVQsQ0FBZ0IsOEJBQUMsYUFBRCxPQUFoQixFQUM1QixTQUFTLGNBQVQsQ0FBd0IsS0FBeEIsQ0FENEIsQ0FBakI7QUFBQSxDQUFiOztBQUdBLG9CQUFLLEdBQUwsQ0FBUyxNQUFULEVBQ0UsSUFERixpQkFFRyxFQUZILENBR0ksS0FISixFQUlJLEdBSkosa0JBT0csRUFQSCxDQVFJLE9BUkosRUFTSSxZQVRKLEVBVUksb0JBQUssSUFBTCxDQUNFO0FBQUEsTUFBRSxNQUFGLFFBQUUsTUFBRjtBQUFBLFNBQWMsY0FBUSxNQUFSLENBQWUsR0FBZixDQUFtQixPQUFPLEVBQTFCLENBQWQ7QUFBQSxDQURGLG1CQUdFLElBSEYsRUFJRSxJQUpGLENBVkosRUFpQkcsR0FqQkgiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEF0IGxlYXN0IGdpdmUgc29tZSBraW5kIG9mIGNvbnRleHQgdG8gdGhlIHVzZXJcbiAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcgKyBlciArICcpJyk7XG4gICAgICAgIGVyci5jb250ZXh0ID0gZXI7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtMjAxNSwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbm1vZHVsZS5leHBvcnRzLkRpc3BhdGNoZXIgPSByZXF1aXJlKCcuL2xpYi9EaXNwYXRjaGVyJyk7XG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNC0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIERpc3BhdGNoZXJcbiAqIFxuICogQHByZXZlbnRNdW5nZVxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxudmFyIF9wcmVmaXggPSAnSURfJztcblxuLyoqXG4gKiBEaXNwYXRjaGVyIGlzIHVzZWQgdG8gYnJvYWRjYXN0IHBheWxvYWRzIHRvIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLiBUaGlzIGlzXG4gKiBkaWZmZXJlbnQgZnJvbSBnZW5lcmljIHB1Yi1zdWIgc3lzdGVtcyBpbiB0d28gd2F5czpcbiAqXG4gKiAgIDEpIENhbGxiYWNrcyBhcmUgbm90IHN1YnNjcmliZWQgdG8gcGFydGljdWxhciBldmVudHMuIEV2ZXJ5IHBheWxvYWQgaXNcbiAqICAgICAgZGlzcGF0Y2hlZCB0byBldmVyeSByZWdpc3RlcmVkIGNhbGxiYWNrLlxuICogICAyKSBDYWxsYmFja3MgY2FuIGJlIGRlZmVycmVkIGluIHdob2xlIG9yIHBhcnQgdW50aWwgb3RoZXIgY2FsbGJhY2tzIGhhdmVcbiAqICAgICAgYmVlbiBleGVjdXRlZC5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgY29uc2lkZXIgdGhpcyBoeXBvdGhldGljYWwgZmxpZ2h0IGRlc3RpbmF0aW9uIGZvcm0sIHdoaWNoXG4gKiBzZWxlY3RzIGEgZGVmYXVsdCBjaXR5IHdoZW4gYSBjb3VudHJ5IGlzIHNlbGVjdGVkOlxuICpcbiAqICAgdmFyIGZsaWdodERpc3BhdGNoZXIgPSBuZXcgRGlzcGF0Y2hlcigpO1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2Ygd2hpY2ggY291bnRyeSBpcyBzZWxlY3RlZFxuICogICB2YXIgQ291bnRyeVN0b3JlID0ge2NvdW50cnk6IG51bGx9O1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2Ygd2hpY2ggY2l0eSBpcyBzZWxlY3RlZFxuICogICB2YXIgQ2l0eVN0b3JlID0ge2NpdHk6IG51bGx9O1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2YgdGhlIGJhc2UgZmxpZ2h0IHByaWNlIG9mIHRoZSBzZWxlY3RlZCBjaXR5XG4gKiAgIHZhciBGbGlnaHRQcmljZVN0b3JlID0ge3ByaWNlOiBudWxsfVxuICpcbiAqIFdoZW4gYSB1c2VyIGNoYW5nZXMgdGhlIHNlbGVjdGVkIGNpdHksIHdlIGRpc3BhdGNoIHRoZSBwYXlsb2FkOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gKiAgICAgYWN0aW9uVHlwZTogJ2NpdHktdXBkYXRlJyxcbiAqICAgICBzZWxlY3RlZENpdHk6ICdwYXJpcydcbiAqICAgfSk7XG4gKlxuICogVGhpcyBwYXlsb2FkIGlzIGRpZ2VzdGVkIGJ5IGBDaXR5U3RvcmVgOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NpdHktdXBkYXRlJykge1xuICogICAgICAgQ2l0eVN0b3JlLmNpdHkgPSBwYXlsb2FkLnNlbGVjdGVkQ2l0eTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFdoZW4gdGhlIHVzZXIgc2VsZWN0cyBhIGNvdW50cnksIHdlIGRpc3BhdGNoIHRoZSBwYXlsb2FkOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gKiAgICAgYWN0aW9uVHlwZTogJ2NvdW50cnktdXBkYXRlJyxcbiAqICAgICBzZWxlY3RlZENvdW50cnk6ICdhdXN0cmFsaWEnXG4gKiAgIH0pO1xuICpcbiAqIFRoaXMgcGF5bG9hZCBpcyBkaWdlc3RlZCBieSBib3RoIHN0b3JlczpcbiAqXG4gKiAgIENvdW50cnlTdG9yZS5kaXNwYXRjaFRva2VuID0gZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NvdW50cnktdXBkYXRlJykge1xuICogICAgICAgQ291bnRyeVN0b3JlLmNvdW50cnkgPSBwYXlsb2FkLnNlbGVjdGVkQ291bnRyeTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFdoZW4gdGhlIGNhbGxiYWNrIHRvIHVwZGF0ZSBgQ291bnRyeVN0b3JlYCBpcyByZWdpc3RlcmVkLCB3ZSBzYXZlIGEgcmVmZXJlbmNlXG4gKiB0byB0aGUgcmV0dXJuZWQgdG9rZW4uIFVzaW5nIHRoaXMgdG9rZW4gd2l0aCBgd2FpdEZvcigpYCwgd2UgY2FuIGd1YXJhbnRlZVxuICogdGhhdCBgQ291bnRyeVN0b3JlYCBpcyB1cGRhdGVkIGJlZm9yZSB0aGUgY2FsbGJhY2sgdGhhdCB1cGRhdGVzIGBDaXR5U3RvcmVgXG4gKiBuZWVkcyB0byBxdWVyeSBpdHMgZGF0YS5cbiAqXG4gKiAgIENpdHlTdG9yZS5kaXNwYXRjaFRva2VuID0gZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NvdW50cnktdXBkYXRlJykge1xuICogICAgICAgLy8gYENvdW50cnlTdG9yZS5jb3VudHJ5YCBtYXkgbm90IGJlIHVwZGF0ZWQuXG4gKiAgICAgICBmbGlnaHREaXNwYXRjaGVyLndhaXRGb3IoW0NvdW50cnlTdG9yZS5kaXNwYXRjaFRva2VuXSk7XG4gKiAgICAgICAvLyBgQ291bnRyeVN0b3JlLmNvdW50cnlgIGlzIG5vdyBndWFyYW50ZWVkIHRvIGJlIHVwZGF0ZWQuXG4gKlxuICogICAgICAgLy8gU2VsZWN0IHRoZSBkZWZhdWx0IGNpdHkgZm9yIHRoZSBuZXcgY291bnRyeVxuICogICAgICAgQ2l0eVN0b3JlLmNpdHkgPSBnZXREZWZhdWx0Q2l0eUZvckNvdW50cnkoQ291bnRyeVN0b3JlLmNvdW50cnkpO1xuICogICAgIH1cbiAqICAgfSk7XG4gKlxuICogVGhlIHVzYWdlIG9mIGB3YWl0Rm9yKClgIGNhbiBiZSBjaGFpbmVkLCBmb3IgZXhhbXBsZTpcbiAqXG4gKiAgIEZsaWdodFByaWNlU3RvcmUuZGlzcGF0Y2hUb2tlbiA9XG4gKiAgICAgZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uVHlwZSkge1xuICogICAgICAgICBjYXNlICdjb3VudHJ5LXVwZGF0ZSc6XG4gKiAgICAgICAgIGNhc2UgJ2NpdHktdXBkYXRlJzpcbiAqICAgICAgICAgICBmbGlnaHREaXNwYXRjaGVyLndhaXRGb3IoW0NpdHlTdG9yZS5kaXNwYXRjaFRva2VuXSk7XG4gKiAgICAgICAgICAgRmxpZ2h0UHJpY2VTdG9yZS5wcmljZSA9XG4gKiAgICAgICAgICAgICBnZXRGbGlnaHRQcmljZVN0b3JlKENvdW50cnlTdG9yZS5jb3VudHJ5LCBDaXR5U3RvcmUuY2l0eSk7XG4gKiAgICAgICAgICAgYnJlYWs7XG4gKiAgICAgfVxuICogICB9KTtcbiAqXG4gKiBUaGUgYGNvdW50cnktdXBkYXRlYCBwYXlsb2FkIHdpbGwgYmUgZ3VhcmFudGVlZCB0byBpbnZva2UgdGhlIHN0b3JlcydcbiAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzIGluIG9yZGVyOiBgQ291bnRyeVN0b3JlYCwgYENpdHlTdG9yZWAsIHRoZW5cbiAqIGBGbGlnaHRQcmljZVN0b3JlYC5cbiAqL1xuXG52YXIgRGlzcGF0Y2hlciA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIERpc3BhdGNoZXIoKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIERpc3BhdGNoZXIpO1xuXG4gICAgdGhpcy5fY2FsbGJhY2tzID0ge307XG4gICAgdGhpcy5faXNEaXNwYXRjaGluZyA9IGZhbHNlO1xuICAgIHRoaXMuX2lzSGFuZGxlZCA9IHt9O1xuICAgIHRoaXMuX2lzUGVuZGluZyA9IHt9O1xuICAgIHRoaXMuX2xhc3RJRCA9IDE7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCB3aXRoIGV2ZXJ5IGRpc3BhdGNoZWQgcGF5bG9hZC4gUmV0dXJuc1xuICAgKiBhIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgd2l0aCBgd2FpdEZvcigpYC5cbiAgICovXG5cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiByZWdpc3RlcihjYWxsYmFjaykge1xuICAgIHZhciBpZCA9IF9wcmVmaXggKyB0aGlzLl9sYXN0SUQrKztcbiAgICB0aGlzLl9jYWxsYmFja3NbaWRdID0gY2FsbGJhY2s7XG4gICAgcmV0dXJuIGlkO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgY2FsbGJhY2sgYmFzZWQgb24gaXRzIHRva2VuLlxuICAgKi9cblxuICBEaXNwYXRjaGVyLnByb3RvdHlwZS51bnJlZ2lzdGVyID0gZnVuY3Rpb24gdW5yZWdpc3RlcihpZCkge1xuICAgICF0aGlzLl9jYWxsYmFja3NbaWRdID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ0Rpc3BhdGNoZXIudW5yZWdpc3RlciguLi4pOiBgJXNgIGRvZXMgbm90IG1hcCB0byBhIHJlZ2lzdGVyZWQgY2FsbGJhY2suJywgaWQpIDogaW52YXJpYW50KGZhbHNlKSA6IHVuZGVmaW5lZDtcbiAgICBkZWxldGUgdGhpcy5fY2FsbGJhY2tzW2lkXTtcbiAgfTtcblxuICAvKipcbiAgICogV2FpdHMgZm9yIHRoZSBjYWxsYmFja3Mgc3BlY2lmaWVkIHRvIGJlIGludm9rZWQgYmVmb3JlIGNvbnRpbnVpbmcgZXhlY3V0aW9uXG4gICAqIG9mIHRoZSBjdXJyZW50IGNhbGxiYWNrLiBUaGlzIG1ldGhvZCBzaG91bGQgb25seSBiZSB1c2VkIGJ5IGEgY2FsbGJhY2sgaW5cbiAgICogcmVzcG9uc2UgdG8gYSBkaXNwYXRjaGVkIHBheWxvYWQuXG4gICAqL1xuXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLndhaXRGb3IgPSBmdW5jdGlvbiB3YWl0Rm9yKGlkcykge1xuICAgICF0aGlzLl9pc0Rpc3BhdGNoaW5nID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ0Rpc3BhdGNoZXIud2FpdEZvciguLi4pOiBNdXN0IGJlIGludm9rZWQgd2hpbGUgZGlzcGF0Y2hpbmcuJykgOiBpbnZhcmlhbnQoZmFsc2UpIDogdW5kZWZpbmVkO1xuICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCBpZHMubGVuZ3RoOyBpaSsrKSB7XG4gICAgICB2YXIgaWQgPSBpZHNbaWldO1xuICAgICAgaWYgKHRoaXMuX2lzUGVuZGluZ1tpZF0pIHtcbiAgICAgICAgIXRoaXMuX2lzSGFuZGxlZFtpZF0gPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IENpcmN1bGFyIGRlcGVuZGVuY3kgZGV0ZWN0ZWQgd2hpbGUgJyArICd3YWl0aW5nIGZvciBgJXNgLicsIGlkKSA6IGludmFyaWFudChmYWxzZSkgOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgIXRoaXMuX2NhbGxiYWNrc1tpZF0gPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IGAlc2AgZG9lcyBub3QgbWFwIHRvIGEgcmVnaXN0ZXJlZCBjYWxsYmFjay4nLCBpZCkgOiBpbnZhcmlhbnQoZmFsc2UpIDogdW5kZWZpbmVkO1xuICAgICAgdGhpcy5faW52b2tlQ2FsbGJhY2soaWQpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogRGlzcGF0Y2hlcyBhIHBheWxvYWQgdG8gYWxsIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuICAgKi9cblxuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5kaXNwYXRjaCA9IGZ1bmN0aW9uIGRpc3BhdGNoKHBheWxvYWQpIHtcbiAgICAhIXRoaXMuX2lzRGlzcGF0Y2hpbmcgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnRGlzcGF0Y2guZGlzcGF0Y2goLi4uKTogQ2Fubm90IGRpc3BhdGNoIGluIHRoZSBtaWRkbGUgb2YgYSBkaXNwYXRjaC4nKSA6IGludmFyaWFudChmYWxzZSkgOiB1bmRlZmluZWQ7XG4gICAgdGhpcy5fc3RhcnREaXNwYXRjaGluZyhwYXlsb2FkKTtcbiAgICB0cnkge1xuICAgICAgZm9yICh2YXIgaWQgaW4gdGhpcy5fY2FsbGJhY2tzKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1BlbmRpbmdbaWRdKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW52b2tlQ2FsbGJhY2soaWQpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLl9zdG9wRGlzcGF0Y2hpbmcoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIElzIHRoaXMgRGlzcGF0Y2hlciBjdXJyZW50bHkgZGlzcGF0Y2hpbmcuXG4gICAqL1xuXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLmlzRGlzcGF0Y2hpbmcgPSBmdW5jdGlvbiBpc0Rpc3BhdGNoaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9pc0Rpc3BhdGNoaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDYWxsIHRoZSBjYWxsYmFjayBzdG9yZWQgd2l0aCB0aGUgZ2l2ZW4gaWQuIEFsc28gZG8gc29tZSBpbnRlcm5hbFxuICAgKiBib29ra2VlcGluZy5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLl9pbnZva2VDYWxsYmFjayA9IGZ1bmN0aW9uIF9pbnZva2VDYWxsYmFjayhpZCkge1xuICAgIHRoaXMuX2lzUGVuZGluZ1tpZF0gPSB0cnVlO1xuICAgIHRoaXMuX2NhbGxiYWNrc1tpZF0odGhpcy5fcGVuZGluZ1BheWxvYWQpO1xuICAgIHRoaXMuX2lzSGFuZGxlZFtpZF0gPSB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgdXAgYm9va2tlZXBpbmcgbmVlZGVkIHdoZW4gZGlzcGF0Y2hpbmcuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cblxuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5fc3RhcnREaXNwYXRjaGluZyA9IGZ1bmN0aW9uIF9zdGFydERpc3BhdGNoaW5nKHBheWxvYWQpIHtcbiAgICBmb3IgKHZhciBpZCBpbiB0aGlzLl9jYWxsYmFja3MpIHtcbiAgICAgIHRoaXMuX2lzUGVuZGluZ1tpZF0gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2lzSGFuZGxlZFtpZF0gPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5fcGVuZGluZ1BheWxvYWQgPSBwYXlsb2FkO1xuICAgIHRoaXMuX2lzRGlzcGF0Y2hpbmcgPSB0cnVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGVhciBib29ra2VlcGluZyB1c2VkIGZvciBkaXNwYXRjaGluZy5cbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLl9zdG9wRGlzcGF0Y2hpbmcgPSBmdW5jdGlvbiBfc3RvcERpc3BhdGNoaW5nKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wZW5kaW5nUGF5bG9hZDtcbiAgICB0aGlzLl9pc0Rpc3BhdGNoaW5nID0gZmFsc2U7XG4gIH07XG5cbiAgcmV0dXJuIERpc3BhdGNoZXI7XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpc3BhdGNoZXI7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIGludmFyaWFudFxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgaW52YXJpYW50ID0gZnVuY3Rpb24gKGNvbmRpdGlvbiwgZm9ybWF0LCBhLCBiLCBjLCBkLCBlLCBmKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFyaWFudCByZXF1aXJlcyBhbiBlcnJvciBtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB2YXIgZXJyb3I7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignTWluaWZpZWQgZXhjZXB0aW9uIG9jY3VycmVkOyB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgJyArICdmb3IgdGhlIGZ1bGwgZXJyb3IgbWVzc2FnZSBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLicpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYXJncyA9IFthLCBiLCBjLCBkLCBlLCBmXTtcbiAgICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignSW52YXJpYW50IFZpb2xhdGlvbjogJyArIGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgICAgfSkpO1xuICAgIH1cblxuICAgIGVycm9yLmZyYW1lc1RvUG9wID0gMTsgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCBpbnZhcmlhbnQncyBvd24gZnJhbWVcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbnZhcmlhbnQ7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgaW52YXJpYW50ID0gZnVuY3Rpb24oY29uZGl0aW9uLCBmb3JtYXQsIGEsIGIsIGMsIGQsIGUsIGYpIHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YXJpYW50IHJlcXVpcmVzIGFuIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQnKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNvbmRpdGlvbikge1xuICAgIHZhciBlcnJvcjtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICAnTWluaWZpZWQgZXhjZXB0aW9uIG9jY3VycmVkOyB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgJyArXG4gICAgICAgICdmb3IgdGhlIGZ1bGwgZXJyb3IgbWVzc2FnZSBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLidcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBhcmdzID0gW2EsIGIsIGMsIGQsIGUsIGZdO1xuICAgICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICBmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24oKSB7IHJldHVybiBhcmdzW2FyZ0luZGV4KytdOyB9KVxuICAgICAgKTtcbiAgICAgIGVycm9yLm5hbWUgPSAnSW52YXJpYW50IFZpb2xhdGlvbic7XG4gICAgfVxuXG4gICAgZXJyb3IuZnJhbWVzVG9Qb3AgPSAxOyAvLyB3ZSBkb24ndCBjYXJlIGFib3V0IGludmFyaWFudCdzIG93biBmcmFtZVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGludmFyaWFudDtcbiIsIi8qKlxuICogQGxpY2Vuc2VcbiAqIExvLURhc2ggMS4wLjIgKEN1c3RvbSBCdWlsZCkgPGh0dHA6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiAtbyAuL2Rpc3QvbG9kYXNoLmpzYFxuICogQ29weXJpZ2h0IDIwMTItMjAxMyBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS40LjQgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLz5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTMgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIEluYy5cbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cDovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuOyhmdW5jdGlvbih3aW5kb3csIHVuZGVmaW5lZCkge1xuXG4gIC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AgKi9cbiAgdmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cztcblxuICAvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAgKi9cbiAgdmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cyAmJiBtb2R1bGU7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGFuZCB1c2UgaXQgYXMgYHdpbmRvd2AgKi9cbiAgdmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcbiAgaWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsKSB7XG4gICAgd2luZG93ID0gZnJlZUdsb2JhbDtcbiAgfVxuXG4gIC8qKiBVc2VkIGZvciBhcnJheSBhbmQgb2JqZWN0IG1ldGhvZCByZWZlcmVuY2VzICovXG4gIHZhciBhcnJheVJlZiA9IFtdLFxuICAgICAgb2JqZWN0UmVmID0ge307XG5cbiAgLyoqIFVzZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIElEcyAqL1xuICB2YXIgaWRDb3VudGVyID0gMDtcblxuICAvKiogVXNlZCBpbnRlcm5hbGx5IHRvIGluZGljYXRlIHZhcmlvdXMgdGhpbmdzICovXG4gIHZhciBpbmRpY2F0b3JPYmplY3QgPSBvYmplY3RSZWY7XG5cbiAgLyoqIFVzZWQgYnkgYGNhY2hlZENvbnRhaW5zYCBhcyB0aGUgZGVmYXVsdCBzaXplIHdoZW4gb3B0aW1pemF0aW9ucyBhcmUgZW5hYmxlZCBmb3IgbGFyZ2UgYXJyYXlzICovXG4gIHZhciBsYXJnZUFycmF5U2l6ZSA9IDMwO1xuXG4gIC8qKiBVc2VkIHRvIHJlc3RvcmUgdGhlIG9yaWdpbmFsIGBfYCByZWZlcmVuY2UgaW4gYG5vQ29uZmxpY3RgICovXG4gIHZhciBvbGREYXNoID0gd2luZG93Ll87XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggSFRNTCBlbnRpdGllcyAqL1xuICB2YXIgcmVFc2NhcGVkSHRtbCA9IC8mKD86YW1wfGx0fGd0fHF1b3R8IzM5KTsvZztcblxuICAvKiogVXNlZCB0byBtYXRjaCBlbXB0eSBzdHJpbmcgbGl0ZXJhbHMgaW4gY29tcGlsZWQgdGVtcGxhdGUgc291cmNlICovXG4gIHZhciByZUVtcHR5U3RyaW5nTGVhZGluZyA9IC9cXGJfX3AgXFwrPSAnJzsvZyxcbiAgICAgIHJlRW1wdHlTdHJpbmdNaWRkbGUgPSAvXFxiKF9fcCBcXCs9KSAnJyBcXCsvZyxcbiAgICAgIHJlRW1wdHlTdHJpbmdUcmFpbGluZyA9IC8oX19lXFwoLio/XFwpfFxcYl9fdFxcKSkgXFwrXFxuJyc7L2c7XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggcmVnZXhwIGZsYWdzIGZyb20gdGhlaXIgY29lcmNlZCBzdHJpbmcgdmFsdWVzICovXG4gIHZhciByZUZsYWdzID0gL1xcdyokLztcblxuICAvKiogVXNlZCB0byBkZXRlY3QgaWYgYSBtZXRob2QgaXMgbmF0aXZlICovXG4gIHZhciByZU5hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICAgIChvYmplY3RSZWYudmFsdWVPZiArICcnKVxuICAgICAgLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAgIC5yZXBsYWNlKC92YWx1ZU9mfGZvciBbXlxcXV0rL2csICcuKz8nKSArICckJ1xuICApO1xuXG4gIC8qKlxuICAgKiBVc2VkIHRvIG1hdGNoIEVTNiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzXG4gICAqIGh0dHA6Ly9wZW9wbGUubW96aWxsYS5vcmcvfmpvcmVuZG9yZmYvZXM2LWRyYWZ0Lmh0bWwjc2VjLTcuOC42XG4gICAqL1xuICB2YXIgcmVFc1RlbXBsYXRlID0gL1xcJFxceyhbXlxcXFx9XSooPzpcXFxcLlteXFxcXH1dKikqKVxcfS9nO1xuXG4gIC8qKiBVc2VkIHRvIG1hdGNoIFwiaW50ZXJwb2xhdGVcIiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXG4gIHZhciByZUludGVycG9sYXRlID0gLzwlPShbXFxzXFxTXSs/KSU+L2c7XG5cbiAgLyoqIFVzZWQgdG8gZW5zdXJlIGNhcHR1cmluZyBvcmRlciBvZiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXG4gIHZhciByZU5vTWF0Y2ggPSAvKCReKS87XG5cbiAgLyoqIFVzZWQgdG8gbWF0Y2ggSFRNTCBjaGFyYWN0ZXJzICovXG4gIHZhciByZVVuZXNjYXBlZEh0bWwgPSAvWyY8PlwiJ10vZztcblxuICAvKiogVXNlZCB0byBtYXRjaCB1bmVzY2FwZWQgY2hhcmFjdGVycyBpbiBjb21waWxlZCBzdHJpbmcgbGl0ZXJhbHMgKi9cbiAgdmFyIHJlVW5lc2NhcGVkU3RyaW5nID0gL1snXFxuXFxyXFx0XFx1MjAyOFxcdTIwMjlcXFxcXS9nO1xuXG4gIC8qKiBVc2VkIHRvIG1ha2UgdGVtcGxhdGUgc291cmNlVVJMcyBlYXNpZXIgdG8gaWRlbnRpZnkgKi9cbiAgdmFyIHRlbXBsYXRlQ291bnRlciA9IDA7XG5cbiAgLyoqIE5hdGl2ZSBtZXRob2Qgc2hvcnRjdXRzICovXG4gIHZhciBjZWlsID0gTWF0aC5jZWlsLFxuICAgICAgY29uY2F0ID0gYXJyYXlSZWYuY29uY2F0LFxuICAgICAgZmxvb3IgPSBNYXRoLmZsb29yLFxuICAgICAgZ2V0UHJvdG90eXBlT2YgPSByZU5hdGl2ZS50ZXN0KGdldFByb3RvdHlwZU9mID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKSAmJiBnZXRQcm90b3R5cGVPZixcbiAgICAgIGhhc093blByb3BlcnR5ID0gb2JqZWN0UmVmLmhhc093blByb3BlcnR5LFxuICAgICAgcHVzaCA9IGFycmF5UmVmLnB1c2gsXG4gICAgICB0b1N0cmluZyA9IG9iamVjdFJlZi50b1N0cmluZztcblxuICAvKiBOYXRpdmUgbWV0aG9kIHNob3J0Y3V0cyBmb3IgbWV0aG9kcyB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcyAqL1xuICB2YXIgbmF0aXZlQmluZCA9IHJlTmF0aXZlLnRlc3QobmF0aXZlQmluZCA9IHNsaWNlLmJpbmQpICYmIG5hdGl2ZUJpbmQsXG4gICAgICBuYXRpdmVJc0FycmF5ID0gcmVOYXRpdmUudGVzdChuYXRpdmVJc0FycmF5ID0gQXJyYXkuaXNBcnJheSkgJiYgbmF0aXZlSXNBcnJheSxcbiAgICAgIG5hdGl2ZUlzRmluaXRlID0gd2luZG93LmlzRmluaXRlLFxuICAgICAgbmF0aXZlSXNOYU4gPSB3aW5kb3cuaXNOYU4sXG4gICAgICBuYXRpdmVLZXlzID0gcmVOYXRpdmUudGVzdChuYXRpdmVLZXlzID0gT2JqZWN0LmtleXMpICYmIG5hdGl2ZUtleXMsXG4gICAgICBuYXRpdmVNYXggPSBNYXRoLm1heCxcbiAgICAgIG5hdGl2ZU1pbiA9IE1hdGgubWluLFxuICAgICAgbmF0aXZlUmFuZG9tID0gTWF0aC5yYW5kb207XG5cbiAgLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCBzaG9ydGN1dHMgKi9cbiAgdmFyIGFyZ3NDbGFzcyA9ICdbb2JqZWN0IEFyZ3VtZW50c10nLFxuICAgICAgYXJyYXlDbGFzcyA9ICdbb2JqZWN0IEFycmF5XScsXG4gICAgICBib29sQ2xhc3MgPSAnW29iamVjdCBCb29sZWFuXScsXG4gICAgICBkYXRlQ2xhc3MgPSAnW29iamVjdCBEYXRlXScsXG4gICAgICBmdW5jQ2xhc3MgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgICAgbnVtYmVyQ2xhc3MgPSAnW29iamVjdCBOdW1iZXJdJyxcbiAgICAgIG9iamVjdENsYXNzID0gJ1tvYmplY3QgT2JqZWN0XScsXG4gICAgICByZWdleHBDbGFzcyA9ICdbb2JqZWN0IFJlZ0V4cF0nLFxuICAgICAgc3RyaW5nQ2xhc3MgPSAnW29iamVjdCBTdHJpbmddJztcblxuICAvKiogRGV0ZWN0IHZhcmlvdXMgZW52aXJvbm1lbnRzICovXG4gIHZhciBpc0llT3BlcmEgPSAhIXdpbmRvdy5hdHRhY2hFdmVudCxcbiAgICAgIGlzVjggPSBuYXRpdmVCaW5kICYmICEvXFxufHRydWUvLnRlc3QobmF0aXZlQmluZCArIGlzSWVPcGVyYSk7XG5cbiAgLyogRGV0ZWN0IGlmIGBGdW5jdGlvbiNiaW5kYCBleGlzdHMgYW5kIGlzIGluZmVycmVkIHRvIGJlIGZhc3QgKGFsbCBidXQgVjgpICovXG4gIHZhciBpc0JpbmRGYXN0ID0gbmF0aXZlQmluZCAmJiAhaXNWODtcblxuICAvKiBEZXRlY3QgaWYgYE9iamVjdC5rZXlzYCBleGlzdHMgYW5kIGlzIGluZmVycmVkIHRvIGJlIGZhc3QgKElFLCBPcGVyYSwgVjgpICovXG4gIHZhciBpc0tleXNGYXN0ID0gbmF0aXZlS2V5cyAmJiAoaXNJZU9wZXJhIHx8IGlzVjgpO1xuXG4gIC8qKiBVc2VkIHRvIGlkZW50aWZ5IG9iamVjdCBjbGFzc2lmaWNhdGlvbnMgdGhhdCBgXy5jbG9uZWAgc3VwcG9ydHMgKi9cbiAgdmFyIGNsb25lYWJsZUNsYXNzZXMgPSB7fTtcbiAgY2xvbmVhYmxlQ2xhc3Nlc1tmdW5jQ2xhc3NdID0gZmFsc2U7XG4gIGNsb25lYWJsZUNsYXNzZXNbYXJnc0NsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbYXJyYXlDbGFzc10gPVxuICBjbG9uZWFibGVDbGFzc2VzW2Jvb2xDbGFzc10gPSBjbG9uZWFibGVDbGFzc2VzW2RhdGVDbGFzc10gPVxuICBjbG9uZWFibGVDbGFzc2VzW251bWJlckNsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbb2JqZWN0Q2xhc3NdID1cbiAgY2xvbmVhYmxlQ2xhc3Nlc1tyZWdleHBDbGFzc10gPSBjbG9uZWFibGVDbGFzc2VzW3N0cmluZ0NsYXNzXSA9IHRydWU7XG5cbiAgLyoqIFVzZWQgdG8gbG9va3VwIGEgYnVpbHQtaW4gY29uc3RydWN0b3IgYnkgW1tDbGFzc11dICovXG4gIHZhciBjdG9yQnlDbGFzcyA9IHt9O1xuICBjdG9yQnlDbGFzc1thcnJheUNsYXNzXSA9IEFycmF5O1xuICBjdG9yQnlDbGFzc1tib29sQ2xhc3NdID0gQm9vbGVhbjtcbiAgY3RvckJ5Q2xhc3NbZGF0ZUNsYXNzXSA9IERhdGU7XG4gIGN0b3JCeUNsYXNzW29iamVjdENsYXNzXSA9IE9iamVjdDtcbiAgY3RvckJ5Q2xhc3NbbnVtYmVyQ2xhc3NdID0gTnVtYmVyO1xuICBjdG9yQnlDbGFzc1tyZWdleHBDbGFzc10gPSBSZWdFeHA7XG4gIGN0b3JCeUNsYXNzW3N0cmluZ0NsYXNzXSA9IFN0cmluZztcblxuICAvKiogVXNlZCB0byBkZXRlcm1pbmUgaWYgdmFsdWVzIGFyZSBvZiB0aGUgbGFuZ3VhZ2UgdHlwZSBPYmplY3QgKi9cbiAgdmFyIG9iamVjdFR5cGVzID0ge1xuICAgICdib29sZWFuJzogZmFsc2UsXG4gICAgJ2Z1bmN0aW9uJzogdHJ1ZSxcbiAgICAnb2JqZWN0JzogdHJ1ZSxcbiAgICAnbnVtYmVyJzogZmFsc2UsXG4gICAgJ3N0cmluZyc6IGZhbHNlLFxuICAgICd1bmRlZmluZWQnOiBmYWxzZVxuICB9O1xuXG4gIC8qKiBVc2VkIHRvIGVzY2FwZSBjaGFyYWN0ZXJzIGZvciBpbmNsdXNpb24gaW4gY29tcGlsZWQgc3RyaW5nIGxpdGVyYWxzICovXG4gIHZhciBzdHJpbmdFc2NhcGVzID0ge1xuICAgICdcXFxcJzogJ1xcXFwnLFxuICAgIFwiJ1wiOiBcIidcIixcbiAgICAnXFxuJzogJ24nLFxuICAgICdcXHInOiAncicsXG4gICAgJ1xcdCc6ICd0JyxcbiAgICAnXFx1MjAyOCc6ICd1MjAyOCcsXG4gICAgJ1xcdTIwMjknOiAndTIwMjknXG4gIH07XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBgbG9kYXNoYCBvYmplY3QsIHRoYXQgd3JhcHMgdGhlIGdpdmVuIGB2YWx1ZWAsIHRvIGVuYWJsZSBtZXRob2RcbiAgICogY2hhaW5pbmcuXG4gICAqXG4gICAqIEluIGFkZGl0aW9uIHRvIExvLURhc2ggbWV0aG9kcywgd3JhcHBlcnMgYWxzbyBoYXZlIHRoZSBmb2xsb3dpbmcgYEFycmF5YCBtZXRob2RzOlxuICAgKiBgY29uY2F0YCwgYGpvaW5gLCBgcG9wYCwgYHB1c2hgLCBgcmV2ZXJzZWAsIGBzaGlmdGAsIGBzbGljZWAsIGBzb3J0YCwgYHNwbGljZWAsXG4gICAqIGFuZCBgdW5zaGlmdGBcbiAgICpcbiAgICogVGhlIGNoYWluYWJsZSB3cmFwcGVyIGZ1bmN0aW9ucyBhcmU6XG4gICAqIGBhZnRlcmAsIGBhc3NpZ25gLCBgYmluZGAsIGBiaW5kQWxsYCwgYGJpbmRLZXlgLCBgY2hhaW5gLCBgY29tcGFjdGAsIGBjb21wb3NlYCxcbiAgICogYGNvbmNhdGAsIGBjb3VudEJ5YCwgYGRlYm91bmNlYCwgYGRlZmF1bHRzYCwgYGRlZmVyYCwgYGRlbGF5YCwgYGRpZmZlcmVuY2VgLFxuICAgKiBgZmlsdGVyYCwgYGZsYXR0ZW5gLCBgZm9yRWFjaGAsIGBmb3JJbmAsIGBmb3JPd25gLCBgZnVuY3Rpb25zYCwgYGdyb3VwQnlgLFxuICAgKiBgaW5pdGlhbGAsIGBpbnRlcnNlY3Rpb25gLCBgaW52ZXJ0YCwgYGludm9rZWAsIGBrZXlzYCwgYG1hcGAsIGBtYXhgLCBgbWVtb2l6ZWAsXG4gICAqIGBtZXJnZWAsIGBtaW5gLCBgb2JqZWN0YCwgYG9taXRgLCBgb25jZWAsIGBwYWlyc2AsIGBwYXJ0aWFsYCwgYHBhcnRpYWxSaWdodGAsXG4gICAqIGBwaWNrYCwgYHBsdWNrYCwgYHB1c2hgLCBgcmFuZ2VgLCBgcmVqZWN0YCwgYHJlc3RgLCBgcmV2ZXJzZWAsIGBzaHVmZmxlYCxcbiAgICogYHNsaWNlYCwgYHNvcnRgLCBgc29ydEJ5YCwgYHNwbGljZWAsIGB0YXBgLCBgdGhyb3R0bGVgLCBgdGltZXNgLCBgdG9BcnJheWAsXG4gICAqIGB1bmlvbmAsIGB1bmlxYCwgYHVuc2hpZnRgLCBgdmFsdWVzYCwgYHdoZXJlYCwgYHdpdGhvdXRgLCBgd3JhcGAsIGFuZCBgemlwYFxuICAgKlxuICAgKiBUaGUgbm9uLWNoYWluYWJsZSB3cmFwcGVyIGZ1bmN0aW9ucyBhcmU6XG4gICAqIGBjbG9uZWAsIGBjbG9uZURlZXBgLCBgY29udGFpbnNgLCBgZXNjYXBlYCwgYGV2ZXJ5YCwgYGZpbmRgLCBgaGFzYCwgYGlkZW50aXR5YCxcbiAgICogYGluZGV4T2ZgLCBgaXNBcmd1bWVudHNgLCBgaXNBcnJheWAsIGBpc0Jvb2xlYW5gLCBgaXNEYXRlYCwgYGlzRWxlbWVudGAsIGBpc0VtcHR5YCxcbiAgICogYGlzRXF1YWxgLCBgaXNGaW5pdGVgLCBgaXNGdW5jdGlvbmAsIGBpc05hTmAsIGBpc051bGxgLCBgaXNOdW1iZXJgLCBgaXNPYmplY3RgLFxuICAgKiBgaXNQbGFpbk9iamVjdGAsIGBpc1JlZ0V4cGAsIGBpc1N0cmluZ2AsIGBpc1VuZGVmaW5lZGAsIGBqb2luYCwgYGxhc3RJbmRleE9mYCxcbiAgICogYG1peGluYCwgYG5vQ29uZmxpY3RgLCBgcG9wYCwgYHJhbmRvbWAsIGByZWR1Y2VgLCBgcmVkdWNlUmlnaHRgLCBgcmVzdWx0YCxcbiAgICogYHNoaWZ0YCwgYHNpemVgLCBgc29tZWAsIGBzb3J0ZWRJbmRleGAsIGB0ZW1wbGF0ZWAsIGB1bmVzY2FwZWAsIGFuZCBgdW5pcXVlSWRgXG4gICAqXG4gICAqIFRoZSB3cmFwcGVyIGZ1bmN0aW9ucyBgZmlyc3RgIGFuZCBgbGFzdGAgcmV0dXJuIHdyYXBwZWQgdmFsdWVzIHdoZW4gYG5gIGlzXG4gICAqIHBhc3NlZCwgb3RoZXJ3aXNlIHRoZXkgcmV0dXJuIHVud3JhcHBlZCB2YWx1ZXMuXG4gICAqXG4gICAqIEBuYW1lIF9cbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gd3JhcCBpbiBhIGBsb2Rhc2hgIGluc3RhbmNlLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGEgYGxvZGFzaGAgaW5zdGFuY2UuXG4gICAqL1xuICBmdW5jdGlvbiBsb2Rhc2godmFsdWUpIHtcbiAgICAvLyBleGl0IGVhcmx5IGlmIGFscmVhZHkgd3JhcHBlZCwgZXZlbiBpZiB3cmFwcGVkIGJ5IGEgZGlmZmVyZW50IGBsb2Rhc2hgIGNvbnN0cnVjdG9yXG4gICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB2YWx1ZS5fX3dyYXBwZWRfXykge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICAvLyBhbGxvdyBpbnZva2luZyBgbG9kYXNoYCB3aXRob3V0IHRoZSBgbmV3YCBvcGVyYXRvclxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBsb2Rhc2gpKSB7XG4gICAgICByZXR1cm4gbmV3IGxvZGFzaCh2YWx1ZSk7XG4gICAgfVxuICAgIHRoaXMuX193cmFwcGVkX18gPSB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCeSBkZWZhdWx0LCB0aGUgdGVtcGxhdGUgZGVsaW1pdGVycyB1c2VkIGJ5IExvLURhc2ggYXJlIHNpbWlsYXIgdG8gdGhvc2UgaW5cbiAgICogZW1iZWRkZWQgUnVieSAoRVJCKS4gQ2hhbmdlIHRoZSBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlXG4gICAqIGRlbGltaXRlcnMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQHR5cGUgT2JqZWN0XG4gICAqL1xuICBsb2Rhc2gudGVtcGxhdGVTZXR0aW5ncyA9IHtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZWN0IGBkYXRhYCBwcm9wZXJ0eSB2YWx1ZXMgdG8gYmUgSFRNTC1lc2NhcGVkLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIF8udGVtcGxhdGVTZXR0aW5nc1xuICAgICAqIEB0eXBlIFJlZ0V4cFxuICAgICAqL1xuICAgICdlc2NhcGUnOiAvPCUtKFtcXHNcXFNdKz8pJT4vZyxcblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZWN0IGNvZGUgdG8gYmUgZXZhbHVhdGVkLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIF8udGVtcGxhdGVTZXR0aW5nc1xuICAgICAqIEB0eXBlIFJlZ0V4cFxuICAgICAqL1xuICAgICdldmFsdWF0ZSc6IC88JShbXFxzXFxTXSs/KSU+L2csXG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVjdCBgZGF0YWAgcHJvcGVydHkgdmFsdWVzIHRvIGluamVjdC5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcbiAgICAgKiBAdHlwZSBSZWdFeHBcbiAgICAgKi9cbiAgICAnaW50ZXJwb2xhdGUnOiByZUludGVycG9sYXRlLFxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byByZWZlcmVuY2UgdGhlIGRhdGEgb2JqZWN0IGluIHRoZSB0ZW1wbGF0ZSB0ZXh0LlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIF8udGVtcGxhdGVTZXR0aW5nc1xuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgICd2YXJpYWJsZSc6ICcnLFxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBpbXBvcnQgdmFyaWFibGVzIGludG8gdGhlIGNvbXBpbGVkIHRlbXBsYXRlLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIF8udGVtcGxhdGVTZXR0aW5nc1xuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqL1xuICAgICdpbXBvcnRzJzoge1xuXG4gICAgICAvKipcbiAgICAgICAqIEEgcmVmZXJlbmNlIHRvIHRoZSBgbG9kYXNoYCBmdW5jdGlvbi5cbiAgICAgICAqXG4gICAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzLmltcG9ydHNcbiAgICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICAgKi9cbiAgICAgICdfJzogbG9kYXNoXG4gICAgfVxuICB9O1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBUaGUgdGVtcGxhdGUgdXNlZCB0byBjcmVhdGUgaXRlcmF0b3IgZnVuY3Rpb25zLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iZWN0fSBkYXRhIFRoZSBkYXRhIG9iamVjdCB1c2VkIHRvIHBvcHVsYXRlIHRoZSB0ZXh0LlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAgICovXG4gIHZhciBpdGVyYXRvclRlbXBsYXRlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgXG4gICAgdmFyIF9fcCA9ICd2YXIgaW5kZXgsIGl0ZXJhYmxlID0gJyArXG4gICAgKG9iai5maXJzdEFyZyApICtcbiAgICAnLCByZXN1bHQgPSBpdGVyYWJsZTtcXG5pZiAoIWl0ZXJhYmxlKSByZXR1cm4gcmVzdWx0O1xcbicgK1xuICAgIChvYmoudG9wICkgK1xuICAgICc7XFxuJztcbiAgICAgaWYgKG9iai5hcnJheXMpIHtcbiAgICBfX3AgKz0gJ3ZhciBsZW5ndGggPSBpdGVyYWJsZS5sZW5ndGg7IGluZGV4ID0gLTE7XFxuaWYgKCcgK1xuICAgIChvYmouYXJyYXlzICkgK1xuICAgICcpIHtcXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XFxuICAgICcgK1xuICAgIChvYmoubG9vcCApICtcbiAgICAnXFxuICB9XFxufVxcbmVsc2UgeyAgJztcbiAgICAgfSA7XG4gICAgXG4gICAgIGlmIChvYmouaXNLZXlzRmFzdCAmJiBvYmoudXNlSGFzKSB7XG4gICAgX19wICs9ICdcXG4gIHZhciBvd25JbmRleCA9IC0xLFxcbiAgICAgIG93blByb3BzID0gb2JqZWN0VHlwZXNbdHlwZW9mIGl0ZXJhYmxlXSA/IG5hdGl2ZUtleXMoaXRlcmFibGUpIDogW10sXFxuICAgICAgbGVuZ3RoID0gb3duUHJvcHMubGVuZ3RoO1xcblxcbiAgd2hpbGUgKCsrb3duSW5kZXggPCBsZW5ndGgpIHtcXG4gICAgaW5kZXggPSBvd25Qcm9wc1tvd25JbmRleF07XFxuICAgICcgK1xuICAgIChvYmoubG9vcCApICtcbiAgICAnXFxuICB9ICAnO1xuICAgICB9IGVsc2Uge1xuICAgIF9fcCArPSAnXFxuICBmb3IgKGluZGV4IGluIGl0ZXJhYmxlKSB7JztcbiAgICAgICAgaWYgKG9iai51c2VIYXMpIHtcbiAgICBfX3AgKz0gJ1xcbiAgICBpZiAoJztcbiAgICAgICAgICBpZiAob2JqLnVzZUhhcykge1xuICAgIF9fcCArPSAnaGFzT3duUHJvcGVydHkuY2FsbChpdGVyYWJsZSwgaW5kZXgpJztcbiAgICAgfSAgICA7XG4gICAgX19wICs9ICcpIHsgICAgJztcbiAgICAgfSA7XG4gICAgX19wICs9IFxuICAgIChvYmoubG9vcCApICtcbiAgICAnOyAgICAnO1xuICAgICBpZiAob2JqLnVzZUhhcykge1xuICAgIF9fcCArPSAnXFxuICAgIH0nO1xuICAgICB9IDtcbiAgICBfX3AgKz0gJ1xcbiAgfSAgJztcbiAgICAgfSA7XG4gICAgXG4gICAgIGlmIChvYmouYXJyYXlzKSB7XG4gICAgX19wICs9ICdcXG59JztcbiAgICAgfSA7XG4gICAgX19wICs9IFxuICAgIChvYmouYm90dG9tICkgK1xuICAgICc7XFxucmV0dXJuIHJlc3VsdCc7XG4gICAgXG4gICAgXG4gICAgcmV0dXJuIF9fcFxuICB9O1xuXG4gIC8qKiBSZXVzYWJsZSBpdGVyYXRvciBvcHRpb25zIGZvciBgYXNzaWduYCBhbmQgYGRlZmF1bHRzYCAqL1xuICB2YXIgZGVmYXVsdHNJdGVyYXRvck9wdGlvbnMgPSB7XG4gICAgJ2FyZ3MnOiAnb2JqZWN0LCBzb3VyY2UsIGd1YXJkJyxcbiAgICAndG9wJzpcbiAgICAgICd2YXIgYXJncyA9IGFyZ3VtZW50cyxcXG4nICtcbiAgICAgICcgICAgYXJnc0luZGV4ID0gMCxcXG4nICtcbiAgICAgIFwiICAgIGFyZ3NMZW5ndGggPSB0eXBlb2YgZ3VhcmQgPT0gJ251bWJlcicgPyAyIDogYXJncy5sZW5ndGg7XFxuXCIgK1xuICAgICAgJ3doaWxlICgrK2FyZ3NJbmRleCA8IGFyZ3NMZW5ndGgpIHtcXG4nICtcbiAgICAgICcgIGl0ZXJhYmxlID0gYXJnc1thcmdzSW5kZXhdO1xcbicgK1xuICAgICAgJyAgaWYgKGl0ZXJhYmxlICYmIG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0pIHsnLFxuICAgICdsb29wJzogXCJpZiAodHlwZW9mIHJlc3VsdFtpbmRleF0gPT0gJ3VuZGVmaW5lZCcpIHJlc3VsdFtpbmRleF0gPSBpdGVyYWJsZVtpbmRleF1cIixcbiAgICAnYm90dG9tJzogJyAgfVxcbn0nXG4gIH07XG5cbiAgLyoqIFJldXNhYmxlIGl0ZXJhdG9yIG9wdGlvbnMgc2hhcmVkIGJ5IGBlYWNoYCwgYGZvckluYCwgYW5kIGBmb3JPd25gICovXG4gIHZhciBlYWNoSXRlcmF0b3JPcHRpb25zID0ge1xuICAgICdhcmdzJzogJ2NvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnJyxcbiAgICAndG9wJzogXCJjYWxsYmFjayA9IGNhbGxiYWNrICYmIHR5cGVvZiB0aGlzQXJnID09ICd1bmRlZmluZWQnID8gY2FsbGJhY2sgOiBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZylcIixcbiAgICAnYXJyYXlzJzogXCJ0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInXCIsXG4gICAgJ2xvb3AnOiAnaWYgKGNhbGxiYWNrKGl0ZXJhYmxlW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pID09PSBmYWxzZSkgcmV0dXJuIHJlc3VsdCdcbiAgfTtcblxuICAvKiogUmV1c2FibGUgaXRlcmF0b3Igb3B0aW9ucyBmb3IgYGZvckluYCBhbmQgYGZvck93bmAgKi9cbiAgdmFyIGZvck93bkl0ZXJhdG9yT3B0aW9ucyA9IHtcbiAgICAndG9wJzogJ2lmICghb2JqZWN0VHlwZXNbdHlwZW9mIGl0ZXJhYmxlXSkgcmV0dXJuIHJlc3VsdDtcXG4nICsgZWFjaEl0ZXJhdG9yT3B0aW9ucy50b3AsXG4gICAgJ2FycmF5cyc6IGZhbHNlXG4gIH07XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiBvcHRpbWl6ZWQgdG8gc2VhcmNoIGxhcmdlIGFycmF5cyBmb3IgYSBnaXZlbiBgdmFsdWVgLFxuICAgKiBzdGFydGluZyBhdCBgZnJvbUluZGV4YCwgdXNpbmcgc3RyaWN0IGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbZnJvbUluZGV4PTBdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtsYXJnZVNpemU9MzBdIFRoZSBsZW5ndGggYXQgd2hpY2ggYW4gYXJyYXkgaXMgY29uc2lkZXJlZCBsYXJnZS5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiBgdmFsdWVgIGlzIGZvdW5kLCBlbHNlIGBmYWxzZWAuXG4gICAqL1xuICBmdW5jdGlvbiBjYWNoZWRDb250YWlucyhhcnJheSwgZnJvbUluZGV4LCBsYXJnZVNpemUpIHtcbiAgICBmcm9tSW5kZXggfHwgKGZyb21JbmRleCA9IDApO1xuXG4gICAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcbiAgICAgICAgaXNMYXJnZSA9IChsZW5ndGggLSBmcm9tSW5kZXgpID49IChsYXJnZVNpemUgfHwgbGFyZ2VBcnJheVNpemUpO1xuXG4gICAgaWYgKGlzTGFyZ2UpIHtcbiAgICAgIHZhciBjYWNoZSA9IHt9LFxuICAgICAgICAgIGluZGV4ID0gZnJvbUluZGV4IC0gMTtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgLy8gbWFudWFsbHkgY29lcmNlIGB2YWx1ZWAgdG8gYSBzdHJpbmcgYmVjYXVzZSBgaGFzT3duUHJvcGVydHlgLCBpbiBzb21lXG4gICAgICAgIC8vIG9sZGVyIHZlcnNpb25zIG9mIEZpcmVmb3gsIGNvZXJjZXMgb2JqZWN0cyBpbmNvcnJlY3RseVxuICAgICAgICB2YXIga2V5ID0gYXJyYXlbaW5kZXhdICsgJyc7XG4gICAgICAgIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNhY2hlLCBrZXkpID8gY2FjaGVba2V5XSA6IChjYWNoZVtrZXldID0gW10pKS5wdXNoKGFycmF5W2luZGV4XSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKGlzTGFyZ2UpIHtcbiAgICAgICAgdmFyIGtleSA9IHZhbHVlICsgJyc7XG4gICAgICAgIHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKGNhY2hlLCBrZXkpICYmIGluZGV4T2YoY2FjaGVba2V5XSwgdmFsdWUpID4gLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5kZXhPZihhcnJheSwgdmFsdWUsIGZyb21JbmRleCkgPiAtMTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgXy5tYXhgIGFuZCBgXy5taW5gIGFzIHRoZSBkZWZhdWx0IGBjYWxsYmFja2Agd2hlbiBhIGdpdmVuXG4gICAqIGBjb2xsZWN0aW9uYCBpcyBhIHN0cmluZyB2YWx1ZS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFRoZSBjaGFyYWN0ZXIgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyB0aGUgY29kZSB1bml0IG9mIGdpdmVuIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIGNoYXJBdENhbGxiYWNrKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlLmNoYXJDb2RlQXQoMCk7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgc29ydEJ5YCB0byBjb21wYXJlIHRyYW5zZm9ybWVkIGBjb2xsZWN0aW9uYCB2YWx1ZXMsIHN0YWJsZSBzb3J0aW5nXG4gICAqIHRoZW0gaW4gYXNjZW5kaW5nIG9yZGVyLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gYSBUaGUgb2JqZWN0IHRvIGNvbXBhcmUgdG8gYGJgLlxuICAgKiBAcGFyYW0ge09iamVjdH0gYiBUaGUgb2JqZWN0IHRvIGNvbXBhcmUgdG8gYGFgLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBzb3J0IG9yZGVyIGluZGljYXRvciBvZiBgMWAgb3IgYC0xYC5cbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBhcmVBc2NlbmRpbmcoYSwgYikge1xuICAgIHZhciBhaSA9IGEuaW5kZXgsXG4gICAgICAgIGJpID0gYi5pbmRleDtcblxuICAgIGEgPSBhLmNyaXRlcmlhO1xuICAgIGIgPSBiLmNyaXRlcmlhO1xuXG4gICAgLy8gZW5zdXJlIGEgc3RhYmxlIHNvcnQgaW4gVjggYW5kIG90aGVyIGVuZ2luZXNcbiAgICAvLyBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD05MFxuICAgIGlmIChhICE9PSBiKSB7XG4gICAgICBpZiAoYSA+IGIgfHwgdHlwZW9mIGEgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICBpZiAoYSA8IGIgfHwgdHlwZW9mIGIgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYWkgPCBiaSA/IC0xIDogMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIGludm9rZXMgYGZ1bmNgIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nXG4gICAqIG9mIGB0aGlzQXJnYCBhbmQgcHJlcGVuZHMgYW55IGBwYXJ0aWFsQXJnc2AgdG8gdGhlIGFyZ3VtZW50cyBwYXNzZWQgdG8gdGhlXG4gICAqIGJvdW5kIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYmluZCBvciB0aGUgbWV0aG9kIG5hbWUuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICAgKiBAcGFyYW0ge0FycmF5fSBwYXJ0aWFsQXJncyBBbiBhcnJheSBvZiBhcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbcmlnaHRJbmRpY2F0b3JdIFVzZWQgdG8gaW5kaWNhdGUgcGFydGlhbGx5IGFwcGx5aW5nIGFyZ3VtZW50cyBmcm9tIHRoZSByaWdodC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYm91bmQgZnVuY3Rpb24uXG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVCb3VuZChmdW5jLCB0aGlzQXJnLCBwYXJ0aWFsQXJncywgcmlnaHRJbmRpY2F0b3IpIHtcbiAgICB2YXIgaXNGdW5jID0gaXNGdW5jdGlvbihmdW5jKSxcbiAgICAgICAgaXNQYXJ0aWFsID0gIXBhcnRpYWxBcmdzLFxuICAgICAgICBrZXkgPSB0aGlzQXJnO1xuXG4gICAgLy8ganVnZ2xlIGFyZ3VtZW50c1xuICAgIGlmIChpc1BhcnRpYWwpIHtcbiAgICAgIHBhcnRpYWxBcmdzID0gdGhpc0FyZztcbiAgICB9XG4gICAgaWYgKCFpc0Z1bmMpIHtcbiAgICAgIHRoaXNBcmcgPSBmdW5jO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xuICAgICAgLy8gYEZ1bmN0aW9uI2JpbmRgIHNwZWNcbiAgICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjMuNC41XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgICB0aGlzQmluZGluZyA9IGlzUGFydGlhbCA/IHRoaXMgOiB0aGlzQXJnO1xuXG4gICAgICBpZiAoIWlzRnVuYykge1xuICAgICAgICBmdW5jID0gdGhpc0FyZ1trZXldO1xuICAgICAgfVxuICAgICAgaWYgKHBhcnRpYWxBcmdzLmxlbmd0aCkge1xuICAgICAgICBhcmdzID0gYXJncy5sZW5ndGhcbiAgICAgICAgICA/IChhcmdzID0gc2xpY2UoYXJncyksIHJpZ2h0SW5kaWNhdG9yID8gYXJncy5jb25jYXQocGFydGlhbEFyZ3MpIDogcGFydGlhbEFyZ3MuY29uY2F0KGFyZ3MpKVxuICAgICAgICAgIDogcGFydGlhbEFyZ3M7XG4gICAgICB9XG4gICAgICBpZiAodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSB7XG4gICAgICAgIC8vIGVuc3VyZSBgbmV3IGJvdW5kYCBpcyBhbiBpbnN0YW5jZSBvZiBgYm91bmRgIGFuZCBgZnVuY2BcbiAgICAgICAgbm9vcC5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgICAgdGhpc0JpbmRpbmcgPSBuZXcgbm9vcDtcbiAgICAgICAgbm9vcC5wcm90b3R5cGUgPSBudWxsO1xuXG4gICAgICAgIC8vIG1pbWljIHRoZSBjb25zdHJ1Y3RvcidzIGByZXR1cm5gIGJlaGF2aW9yXG4gICAgICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDEzLjIuMlxuICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQmluZGluZywgYXJncyk7XG4gICAgICAgIHJldHVybiBpc09iamVjdChyZXN1bHQpID8gcmVzdWx0IDogdGhpc0JpbmRpbmc7XG4gICAgICB9XG4gICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzQmluZGluZywgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBib3VuZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlcyBhIGNhbGxiYWNrIGJvdW5kIHRvIGFuIG9wdGlvbmFsIGB0aGlzQXJnYC4gSWYgYGZ1bmNgIGlzIGEgcHJvcGVydHlcbiAgICogbmFtZSwgdGhlIGNyZWF0ZWQgY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIGZvciBhIGdpdmVuIGVsZW1lbnQuXG4gICAqIElmIGBmdW5jYCBpcyBhbiBvYmplY3QsIHRoZSBjcmVhdGVkIGNhbGxiYWNrIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHNcbiAgICogdGhhdCBjb250YWluIHRoZSBlcXVpdmFsZW50IG9iamVjdCBwcm9wZXJ0aWVzLCBvdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gYGZhbHNlYC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtNaXhlZH0gW2Z1bmM9aWRlbnRpdHldIFRoZSB2YWx1ZSB0byBjb252ZXJ0IHRvIGEgY2FsbGJhY2suXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgY2FsbGJhY2suXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbYXJnQ291bnQ9M10gVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhlIGNhbGxiYWNrIGFjY2VwdHMuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyBhIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlQ2FsbGJhY2soZnVuYywgdGhpc0FyZywgYXJnQ291bnQpIHtcbiAgICBpZiAoZnVuYyA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gaWRlbnRpdHk7XG4gICAgfVxuICAgIHZhciB0eXBlID0gdHlwZW9mIGZ1bmM7XG4gICAgaWYgKHR5cGUgIT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKHR5cGUgIT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgICAgIHJldHVybiBvYmplY3RbZnVuY107XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB2YXIgcHJvcHMgPSBrZXlzKGZ1bmMpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgICAgICB2YXIgbGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxuICAgICAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGlzRXF1YWwob2JqZWN0W3Byb3BzW2xlbmd0aF1dLCBmdW5jW3Byb3BzW2xlbmd0aF1dLCBpbmRpY2F0b3JPYmplY3QpKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHRoaXNBcmcgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGlmIChhcmdDb3VudCA9PT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChhcmdDb3VudCA9PT0gMikge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYSwgYik7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAoYXJnQ291bnQgPT09IDQpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIG9iamVjdCkge1xuICAgICAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgb2JqZWN0KTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIG9iamVjdCkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpbmRleCwgb2JqZWN0KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBmdW5jO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgY29tcGlsZWQgaXRlcmF0aW9uIGZ1bmN0aW9ucy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zMSwgb3B0aW9uczIsIC4uLl0gVGhlIGNvbXBpbGUgb3B0aW9ucyBvYmplY3QocykuXG4gICAqICBhcnJheXMgLSBBIHN0cmluZyBvZiBjb2RlIHRvIGRldGVybWluZSBpZiB0aGUgaXRlcmFibGUgaXMgYW4gYXJyYXkgb3IgYXJyYXktbGlrZS5cbiAgICogIHVzZUhhcyAtIEEgYm9vbGVhbiB0byBzcGVjaWZ5IHVzaW5nIGBoYXNPd25Qcm9wZXJ0eWAgY2hlY2tzIGluIHRoZSBvYmplY3QgbG9vcC5cbiAgICogIGFyZ3MgLSBBIHN0cmluZyBvZiBjb21tYSBzZXBhcmF0ZWQgYXJndW1lbnRzIHRoZSBpdGVyYXRpb24gZnVuY3Rpb24gd2lsbCBhY2NlcHQuXG4gICAqICB0b3AgLSBBIHN0cmluZyBvZiBjb2RlIHRvIGV4ZWN1dGUgYmVmb3JlIHRoZSBpdGVyYXRpb24gYnJhbmNoZXMuXG4gICAqICBsb29wIC0gQSBzdHJpbmcgb2YgY29kZSB0byBleGVjdXRlIGluIHRoZSBvYmplY3QgbG9vcC5cbiAgICogIGJvdHRvbSAtIEEgc3RyaW5nIG9mIGNvZGUgdG8gZXhlY3V0ZSBhZnRlciB0aGUgaXRlcmF0aW9uIGJyYW5jaGVzLlxuICAgKlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uLlxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlSXRlcmF0b3IoKSB7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAvLyBzdXBwb3J0IHByb3BlcnRpZXNcbiAgICAgICdpc0tleXNGYXN0JzogaXNLZXlzRmFzdCxcblxuICAgICAgLy8gaXRlcmF0b3Igb3B0aW9uc1xuICAgICAgJ2FycmF5cyc6ICdpc0FycmF5KGl0ZXJhYmxlKScsXG4gICAgICAnYm90dG9tJzogJycsXG4gICAgICAnbG9vcCc6ICcnLFxuICAgICAgJ3RvcCc6ICcnLFxuICAgICAgJ3VzZUhhcyc6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gbWVyZ2Ugb3B0aW9ucyBpbnRvIGEgdGVtcGxhdGUgZGF0YSBvYmplY3RcbiAgICBmb3IgKHZhciBvYmplY3QsIGluZGV4ID0gMDsgb2JqZWN0ID0gYXJndW1lbnRzW2luZGV4XTsgaW5kZXgrKykge1xuICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICBkYXRhW2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGFyZ3MgPSBkYXRhLmFyZ3M7XG4gICAgZGF0YS5maXJzdEFyZyA9IC9eW14sXSsvLmV4ZWMoYXJncylbMF07XG5cbiAgICAvLyBjcmVhdGUgdGhlIGZ1bmN0aW9uIGZhY3RvcnlcbiAgICB2YXIgZmFjdG9yeSA9IEZ1bmN0aW9uKFxuICAgICAgICAnY3JlYXRlQ2FsbGJhY2ssIGhhc093blByb3BlcnR5LCBpc0FyZ3VtZW50cywgaXNBcnJheSwgaXNTdHJpbmcsICcgK1xuICAgICAgICAnb2JqZWN0VHlwZXMsIG5hdGl2ZUtleXMnLFxuICAgICAgJ3JldHVybiBmdW5jdGlvbignICsgYXJncyArICcpIHtcXG4nICsgaXRlcmF0b3JUZW1wbGF0ZShkYXRhKSArICdcXG59J1xuICAgICk7XG4gICAgLy8gcmV0dXJuIHRoZSBjb21waWxlZCBmdW5jdGlvblxuICAgIHJldHVybiBmYWN0b3J5KFxuICAgICAgY3JlYXRlQ2FsbGJhY2ssIGhhc093blByb3BlcnR5LCBpc0FyZ3VtZW50cywgaXNBcnJheSwgaXNTdHJpbmcsXG4gICAgICBvYmplY3RUeXBlcywgbmF0aXZlS2V5c1xuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQSBmdW5jdGlvbiBjb21waWxlZCB0byBpdGVyYXRlIGBhcmd1bWVudHNgIG9iamVjdHMsIGFycmF5cywgb2JqZWN0cywgYW5kXG4gICAqIHN0cmluZ3MgY29uc2lzdGVubHkgYWNyb3NzIGVudmlyb25tZW50cywgZXhlY3V0aW5nIHRoZSBgY2FsbGJhY2tgIGZvciBlYWNoXG4gICAqIGVsZW1lbnQgaW4gdGhlIGBjb2xsZWN0aW9uYC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkXG4gICAqIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuIENhbGxiYWNrcyBtYXkgZXhpdFxuICAgKiBpdGVyYXRpb24gZWFybHkgYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHR5cGUgRnVuY3Rpb25cbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fE9iamVjdHxTdHJpbmd9IFJldHVybnMgYGNvbGxlY3Rpb25gLlxuICAgKi9cbiAgdmFyIGVhY2ggPSBjcmVhdGVJdGVyYXRvcihlYWNoSXRlcmF0b3JPcHRpb25zKTtcblxuICAvKipcbiAgICogVXNlZCBieSBgdGVtcGxhdGVgIHRvIGVzY2FwZSBjaGFyYWN0ZXJzIGZvciBpbmNsdXNpb24gaW4gY29tcGlsZWRcbiAgICogc3RyaW5nIGxpdGVyYWxzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWF0Y2ggVGhlIG1hdGNoZWQgY2hhcmFjdGVyIHRvIGVzY2FwZS5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgZXNjYXBlZCBjaGFyYWN0ZXIuXG4gICAqL1xuICBmdW5jdGlvbiBlc2NhcGVTdHJpbmdDaGFyKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIHN0cmluZ0VzY2FwZXNbbWF0Y2hdO1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgYnkgYGVzY2FwZWAgdG8gY29udmVydCBjaGFyYWN0ZXJzIHRvIEhUTUwgZW50aXRpZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtYXRjaCBUaGUgbWF0Y2hlZCBjaGFyYWN0ZXIgdG8gZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIGNoYXJhY3Rlci5cbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWxDaGFyKG1hdGNoKSB7XG4gICAgcmV0dXJuIGh0bWxFc2NhcGVzW21hdGNoXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIERPTSBub2RlIGluIElFIDwgOS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBET00gbm9kZSwgZWxzZSBgZmFsc2VgLlxuICAgKi9cbiAgZnVuY3Rpb24gaXNOb2RlKHZhbHVlKSB7XG4gICAgLy8gSUUgPCA5IHByZXNlbnRzIERPTSBub2RlcyBhcyBgT2JqZWN0YCBvYmplY3RzIGV4Y2VwdCB0aGV5IGhhdmUgYHRvU3RyaW5nYFxuICAgIC8vIG1ldGhvZHMgdGhhdCBhcmUgYHR5cGVvZmAgXCJzdHJpbmdcIiBhbmQgc3RpbGwgY2FuIGNvZXJjZSBub2RlcyB0byBzdHJpbmdzXG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZS50b1N0cmluZyAhPSAnZnVuY3Rpb24nICYmIHR5cGVvZiAodmFsdWUgKyAnJykgPT0gJ3N0cmluZyc7XG4gIH1cblxuICAvKipcbiAgICogQSBuby1vcGVyYXRpb24gZnVuY3Rpb24uXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBub29wKCkge1xuICAgIC8vIG5vIG9wZXJhdGlvbiBwZXJmb3JtZWRcbiAgfVxuXG4gIC8qKlxuICAgKiBTbGljZXMgdGhlIGBjb2xsZWN0aW9uYCBmcm9tIHRoZSBgc3RhcnRgIGluZGV4IHVwIHRvLCBidXQgbm90IGluY2x1ZGluZyxcbiAgICogdGhlIGBlbmRgIGluZGV4LlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQsIGluc3RlYWQgb2YgYEFycmF5I3NsaWNlYCwgdG8gc3VwcG9ydCBub2RlIGxpc3RzXG4gICAqIGluIElFIDwgOSBhbmQgdG8gZW5zdXJlIGRlbnNlIGFycmF5cyBhcmUgcmV0dXJuZWQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBzbGljZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0IFRoZSBzdGFydCBpbmRleC5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGVuZCBUaGUgZW5kIGluZGV4LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIG5ldyBhcnJheS5cbiAgICovXG4gIGZ1bmN0aW9uIHNsaWNlKGFycmF5LCBzdGFydCwgZW5kKSB7XG4gICAgc3RhcnQgfHwgKHN0YXJ0ID0gMCk7XG4gICAgaWYgKHR5cGVvZiBlbmQgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGVuZCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcbiAgICB9XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGVuZCAtIHN0YXJ0IHx8IDAsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoKTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICByZXN1bHRbaW5kZXhdID0gYXJyYXlbc3RhcnQgKyBpbmRleF07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBieSBgdW5lc2NhcGVgIHRvIGNvbnZlcnQgSFRNTCBlbnRpdGllcyB0byBjaGFyYWN0ZXJzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWF0Y2ggVGhlIG1hdGNoZWQgY2hhcmFjdGVyIHRvIHVuZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSB1bmVzY2FwZWQgY2hhcmFjdGVyLlxuICAgKi9cbiAgZnVuY3Rpb24gdW5lc2NhcGVIdG1sQ2hhcihtYXRjaCkge1xuICAgIHJldHVybiBodG1sVW5lc2NhcGVzW21hdGNoXTtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhbiBgYXJndW1lbnRzYCBvYmplY3QuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIHRoZSBgdmFsdWVgIGlzIGFuIGBhcmd1bWVudHNgIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAoZnVuY3Rpb24oKSB7IHJldHVybiBfLmlzQXJndW1lbnRzKGFyZ3VtZW50cyk7IH0pKDEsIDIsIDMpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNBcmd1bWVudHMoWzEsIDIsIDNdKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzQXJndW1lbnRzKHZhbHVlKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFyZ3NDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlcyBvdmVyIGBvYmplY3RgJ3Mgb3duIGFuZCBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLCBleGVjdXRpbmdcbiAgICogdGhlIGBjYWxsYmFja2AgZm9yIGVhY2ggcHJvcGVydHkuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcbiAgICogaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuIENhbGxiYWNrcyBtYXkgZXhpdCBpdGVyYXRpb25cbiAgICogZWFybHkgYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAdHlwZSBGdW5jdGlvblxuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBmdW5jdGlvbiBEb2cobmFtZSkge1xuICAgKiAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAqIH1cbiAgICpcbiAgICogRG9nLnByb3RvdHlwZS5iYXJrID0gZnVuY3Rpb24oKSB7XG4gICAqICAgYWxlcnQoJ1dvb2YsIHdvb2YhJyk7XG4gICAqIH07XG4gICAqXG4gICAqIF8uZm9ySW4obmV3IERvZygnRGFnbnknKSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgKiAgIGFsZXJ0KGtleSk7XG4gICAqIH0pO1xuICAgKiAvLyA9PiBhbGVydHMgJ25hbWUnIGFuZCAnYmFyaycgKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgdmFyIGZvckluID0gY3JlYXRlSXRlcmF0b3IoZWFjaEl0ZXJhdG9yT3B0aW9ucywgZm9yT3duSXRlcmF0b3JPcHRpb25zLCB7XG4gICAgJ3VzZUhhcyc6IGZhbHNlXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBJdGVyYXRlcyBvdmVyIGFuIG9iamVjdCdzIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMsIGV4ZWN1dGluZyB0aGUgYGNhbGxiYWNrYFxuICAgKiBmb3IgZWFjaCBwcm9wZXJ0eS4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICogYXJndW1lbnRzOyAodmFsdWUsIGtleSwgb2JqZWN0KS4gQ2FsbGJhY2tzIG1heSBleGl0IGl0ZXJhdGlvbiBlYXJseSBieSBleHBsaWNpdGx5XG4gICAqIHJldHVybmluZyBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZm9yT3duKHsgJzAnOiAnemVybycsICcxJzogJ29uZScsICdsZW5ndGgnOiAyIH0sIGZ1bmN0aW9uKG51bSwga2V5KSB7XG4gICAqICAgYWxlcnQoa2V5KTtcbiAgICogfSk7XG4gICAqIC8vID0+IGFsZXJ0cyAnMCcsICcxJywgYW5kICdsZW5ndGgnIChvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAgICovXG4gIHZhciBmb3JPd24gPSBjcmVhdGVJdGVyYXRvcihlYWNoSXRlcmF0b3JPcHRpb25zLCBmb3JPd25JdGVyYXRvck9wdGlvbnMpO1xuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhbiBhcnJheS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCwgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gYXJyYXksIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy5pc0FycmF5KGFyZ3VtZW50cyk7IH0pKCk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICB2YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAvLyBgaW5zdGFuY2VvZmAgbWF5IGNhdXNlIGEgbWVtb3J5IGxlYWsgaW4gSUUgNyBpZiBgdmFsdWVgIGlzIGEgaG9zdCBvYmplY3RcbiAgICAvLyBodHRwOi8vYWpheGlhbi5jb20vYXJjaGl2ZXMvd29ya2luZy1hcm91bmctdGhlLWluc3RhbmNlb2YtbWVtb3J5LWxlYWtcbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBBcnJheSB8fCB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBhcnJheUNsYXNzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IGNvbXBvc2VkIG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmtleXMoeyAnb25lJzogMSwgJ3R3byc6IDIsICd0aHJlZSc6IDMgfSk7XG4gICAqIC8vID0+IFsnb25lJywgJ3R3bycsICd0aHJlZSddIChvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAgICovXG4gIHZhciBrZXlzID0gIW5hdGl2ZUtleXMgPyBzaGltS2V5cyA6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIGlmICghaXNPYmplY3Qob2JqZWN0KSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICByZXR1cm4gbmF0aXZlS2V5cyhvYmplY3QpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBpc1BsYWluT2JqZWN0YCB0aGF0IGNoZWNrcyBpZiBhIGdpdmVuIGB2YWx1ZWBcbiAgICogaXMgYW4gb2JqZWN0IGNyZWF0ZWQgYnkgdGhlIGBPYmplY3RgIGNvbnN0cnVjdG9yLCBhc3N1bWluZyBvYmplY3RzIGNyZWF0ZWRcbiAgICogYnkgdGhlIGBPYmplY3RgIGNvbnN0cnVjdG9yIGhhdmUgbm8gaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydGllcyBhbmQgdGhhdFxuICAgKiB0aGVyZSBhcmUgbm8gYE9iamVjdC5wcm90b3R5cGVgIGV4dGVuc2lvbnMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiBgdmFsdWVgIGlzIGEgcGxhaW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gICAqL1xuICBmdW5jdGlvbiBzaGltSXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICAgIC8vIGF2b2lkIG5vbi1vYmplY3RzIGFuZCBmYWxzZSBwb3NpdGl2ZXMgZm9yIGBhcmd1bWVudHNgIG9iamVjdHNcbiAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XG4gICAgaWYgKCEodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnKSB8fCBpc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgdGhlIGNvbnN0cnVjdG9yIGlzIGBPYmplY3RgIChpLmUuIGBPYmplY3QgaW5zdGFuY2VvZiBPYmplY3RgKVxuICAgIHZhciBjdG9yID0gdmFsdWUuY29uc3RydWN0b3I7XG4gICAgaWYgKCghaXNGdW5jdGlvbihjdG9yKSkgfHwgY3RvciBpbnN0YW5jZW9mIGN0b3IpIHtcbiAgICAgIC8vIEluIG1vc3QgZW52aXJvbm1lbnRzIGFuIG9iamVjdCdzIG93biBwcm9wZXJ0aWVzIGFyZSBpdGVyYXRlZCBiZWZvcmVcbiAgICAgIC8vIGl0cyBpbmhlcml0ZWQgcHJvcGVydGllcy4gSWYgdGhlIGxhc3QgaXRlcmF0ZWQgcHJvcGVydHkgaXMgYW4gb2JqZWN0J3NcbiAgICAgIC8vIG93biBwcm9wZXJ0eSB0aGVuIHRoZXJlIGFyZSBubyBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLlxuICAgICAgZm9ySW4odmFsdWUsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgcmVzdWx0ID0ga2V5O1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0ID09PSBmYWxzZSB8fCBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCByZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEEgZmFsbGJhY2sgaW1wbGVtZW50YXRpb24gb2YgYE9iamVjdC5rZXlzYCB0aGF0IHByb2R1Y2VzIGFuIGFycmF5IG9mIHRoZVxuICAgKiBnaXZlbiBvYmplY3QncyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAgICovXG4gIGZ1bmN0aW9uIHNoaW1LZXlzKG9iamVjdCkge1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBmb3JPd24ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCB0byBjb252ZXJ0IGNoYXJhY3RlcnMgdG8gSFRNTCBlbnRpdGllczpcbiAgICpcbiAgICogVGhvdWdoIHRoZSBgPmAgY2hhcmFjdGVyIGlzIGVzY2FwZWQgZm9yIHN5bW1ldHJ5LCBjaGFyYWN0ZXJzIGxpa2UgYD5gIGFuZCBgL2BcbiAgICogZG9uJ3QgcmVxdWlyZSBlc2NhcGluZyBpbiBIVE1MIGFuZCBoYXZlIG5vIHNwZWNpYWwgbWVhbmluZyB1bmxlc3MgdGhleSdyZSBwYXJ0XG4gICAqIG9mIGEgdGFnIG9yIGFuIHVucXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICogaHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvYW1iaWd1b3VzLWFtcGVyc2FuZHMgKHVuZGVyIFwic2VtaS1yZWxhdGVkIGZ1biBmYWN0XCIpXG4gICAqL1xuICB2YXIgaHRtbEVzY2FwZXMgPSB7XG4gICAgJyYnOiAnJmFtcDsnLFxuICAgICc8JzogJyZsdDsnLFxuICAgICc+JzogJyZndDsnLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiMzOTsnXG4gIH07XG5cbiAgLyoqIFVzZWQgdG8gY29udmVydCBIVE1MIGVudGl0aWVzIHRvIGNoYXJhY3RlcnMgKi9cbiAgdmFyIGh0bWxVbmVzY2FwZXMgPSBpbnZlcnQoaHRtbEVzY2FwZXMpO1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBBc3NpZ25zIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byB0aGUgZGVzdGluYXRpb25cbiAgICogb2JqZWN0LiBTdWJzZXF1ZW50IHNvdXJjZXMgd2lsbCBvdmVyd3JpdGUgcHJvcGVyeSBhc3NpZ25tZW50cyBvZiBwcmV2aW91c1xuICAgKiBzb3VyY2VzLiBJZiBhIGBjYWxsYmFja2AgZnVuY3Rpb24gaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIHRvIHByb2R1Y2VcbiAgICogdGhlIGFzc2lnbmVkIHZhbHVlcy4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGhcbiAgICogdHdvIGFyZ3VtZW50czsgKG9iamVjdFZhbHVlLCBzb3VyY2VWYWx1ZSkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQHR5cGUgRnVuY3Rpb25cbiAgICogQGFsaWFzIGV4dGVuZFxuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbc291cmNlMSwgc291cmNlMiwgLi4uXSBUaGUgc291cmNlIG9iamVjdHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBhc3NpZ25pbmcgdmFsdWVzLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5hc3NpZ24oeyAnbmFtZSc6ICdtb2UnIH0sIHsgJ2FnZSc6IDQwIH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9XG4gICAqXG4gICAqIHZhciBkZWZhdWx0cyA9IF8ucGFydGlhbFJpZ2h0KF8uYXNzaWduLCBmdW5jdGlvbihhLCBiKSB7XG4gICAqICAgcmV0dXJuIHR5cGVvZiBhID09ICd1bmRlZmluZWQnID8gYiA6IGE7XG4gICAqIH0pO1xuICAgKlxuICAgKiB2YXIgZm9vZCA9IHsgJ25hbWUnOiAnYXBwbGUnIH07XG4gICAqIGRlZmF1bHRzKGZvb2QsIHsgJ25hbWUnOiAnYmFuYW5hJywgJ3R5cGUnOiAnZnJ1aXQnIH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ2FwcGxlJywgJ3R5cGUnOiAnZnJ1aXQnIH1cbiAgICovXG4gIHZhciBhc3NpZ24gPSBjcmVhdGVJdGVyYXRvcihkZWZhdWx0c0l0ZXJhdG9yT3B0aW9ucywge1xuICAgICd0b3AnOlxuICAgICAgZGVmYXVsdHNJdGVyYXRvck9wdGlvbnMudG9wLnJlcGxhY2UoJzsnLFxuICAgICAgICAnO1xcbicgK1xuICAgICAgICBcImlmIChhcmdzTGVuZ3RoID4gMyAmJiB0eXBlb2YgYXJnc1thcmdzTGVuZ3RoIC0gMl0gPT0gJ2Z1bmN0aW9uJykge1xcblwiICtcbiAgICAgICAgJyAgdmFyIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soYXJnc1stLWFyZ3NMZW5ndGggLSAxXSwgYXJnc1thcmdzTGVuZ3RoLS1dLCAyKTtcXG4nICtcbiAgICAgICAgXCJ9IGVsc2UgaWYgKGFyZ3NMZW5ndGggPiAyICYmIHR5cGVvZiBhcmdzW2FyZ3NMZW5ndGggLSAxXSA9PSAnZnVuY3Rpb24nKSB7XFxuXCIgK1xuICAgICAgICAnICBjYWxsYmFjayA9IGFyZ3NbLS1hcmdzTGVuZ3RoXTtcXG4nICtcbiAgICAgICAgJ30nXG4gICAgICApLFxuICAgICdsb29wJzogJ3Jlc3VsdFtpbmRleF0gPSBjYWxsYmFjayA/IGNhbGxiYWNrKHJlc3VsdFtpbmRleF0sIGl0ZXJhYmxlW2luZGV4XSkgOiBpdGVyYWJsZVtpbmRleF0nXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgY2xvbmUgb2YgYHZhbHVlYC4gSWYgYGRlZXBgIGlzIGB0cnVlYCwgbmVzdGVkIG9iamVjdHMgd2lsbCBhbHNvXG4gICAqIGJlIGNsb25lZCwgb3RoZXJ3aXNlIHRoZXkgd2lsbCBiZSBhc3NpZ25lZCBieSByZWZlcmVuY2UuIElmIGEgYGNhbGxiYWNrYFxuICAgKiBmdW5jdGlvbiBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgZXhlY3V0ZWQgdG8gcHJvZHVjZSB0aGUgY2xvbmVkIHZhbHVlcy4gSWZcbiAgICogYGNhbGxiYWNrYCByZXR1cm5zIGB1bmRlZmluZWRgLCBjbG9uaW5nIHdpbGwgYmUgaGFuZGxlZCBieSB0aGUgbWV0aG9kIGluc3RlYWQuXG4gICAqIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIG9uZSBhcmd1bWVudDsgKHZhbHVlKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2xvbmUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2RlZXA9ZmFsc2VdIEEgZmxhZyB0byBpbmRpY2F0ZSBhIGRlZXAgY2xvbmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjbG9uaW5nIHZhbHVlcy5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcGFyYW0tIHtBcnJheX0gW3N0YWNrQT1bXV0gSW50ZXJuYWxseSB1c2VkIHRvIHRyYWNrIHRyYXZlcnNlZCBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHBhcmFtLSB7QXJyYXl9IFtzdGFja0I9W11dIEludGVybmFsbHkgdXNlZCB0byBhc3NvY2lhdGUgY2xvbmVzIHdpdGggc291cmNlIGNvdW50ZXJwYXJ0cy5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBjbG9uZWQgYHZhbHVlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHN0b29nZXMgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSxcbiAgICogICB7ICduYW1lJzogJ2xhcnJ5JywgJ2FnZSc6IDUwIH1cbiAgICogXTtcbiAgICpcbiAgICogdmFyIHNoYWxsb3cgPSBfLmNsb25lKHN0b29nZXMpO1xuICAgKiBzaGFsbG93WzBdID09PSBzdG9vZ2VzWzBdO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIHZhciBkZWVwID0gXy5jbG9uZShzdG9vZ2VzLCB0cnVlKTtcbiAgICogZGVlcFswXSA9PT0gc3Rvb2dlc1swXTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICpcbiAgICogXy5taXhpbih7XG4gICAqICAgJ2Nsb25lJzogXy5wYXJ0aWFsUmlnaHQoXy5jbG9uZSwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICogICAgIHJldHVybiBfLmlzRWxlbWVudCh2YWx1ZSkgPyB2YWx1ZS5jbG9uZU5vZGUoZmFsc2UpIDogdW5kZWZpbmVkO1xuICAgKiAgIH0pXG4gICAqIH0pO1xuICAgKlxuICAgKiB2YXIgY2xvbmUgPSBfLmNsb25lKGRvY3VtZW50LmJvZHkpO1xuICAgKiBjbG9uZS5jaGlsZE5vZGVzLmxlbmd0aDtcbiAgICogLy8gPT4gMFxuICAgKi9cbiAgZnVuY3Rpb24gY2xvbmUodmFsdWUsIGRlZXAsIGNhbGxiYWNrLCB0aGlzQXJnLCBzdGFja0EsIHN0YWNrQikge1xuICAgIHZhciByZXN1bHQgPSB2YWx1ZTtcblxuICAgIC8vIGFsbG93cyB3b3JraW5nIHdpdGggXCJDb2xsZWN0aW9uc1wiIG1ldGhvZHMgd2l0aG91dCB1c2luZyB0aGVpciBgY2FsbGJhY2tgXG4gICAgLy8gYXJndW1lbnQsIGBpbmRleHxrZXlgLCBmb3IgdGhpcyBtZXRob2QncyBgY2FsbGJhY2tgXG4gICAgaWYgKHR5cGVvZiBkZWVwID09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXNBcmcgPSBjYWxsYmFjaztcbiAgICAgIGNhbGxiYWNrID0gZGVlcDtcbiAgICAgIGRlZXAgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IHR5cGVvZiB0aGlzQXJnID09ICd1bmRlZmluZWQnID8gY2FsbGJhY2sgOiBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMSk7XG4gICAgICByZXN1bHQgPSBjYWxsYmFjayhyZXN1bHQpO1xuXG4gICAgICB2YXIgZG9uZSA9IHR5cGVvZiByZXN1bHQgIT0gJ3VuZGVmaW5lZCc7XG4gICAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGluc3BlY3QgW1tDbGFzc11dXG4gICAgdmFyIGlzT2JqID0gaXNPYmplY3QocmVzdWx0KTtcbiAgICBpZiAoaXNPYmopIHtcbiAgICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKHJlc3VsdCk7XG4gICAgICBpZiAoIWNsb25lYWJsZUNsYXNzZXNbY2xhc3NOYW1lXSkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgICAgdmFyIGlzQXJyID0gaXNBcnJheShyZXN1bHQpO1xuICAgIH1cbiAgICAvLyBzaGFsbG93IGNsb25lXG4gICAgaWYgKCFpc09iaiB8fCAhZGVlcCkge1xuICAgICAgcmV0dXJuIGlzT2JqICYmICFkb25lXG4gICAgICAgID8gKGlzQXJyID8gc2xpY2UocmVzdWx0KSA6IGFzc2lnbih7fSwgcmVzdWx0KSlcbiAgICAgICAgOiByZXN1bHQ7XG4gICAgfVxuICAgIHZhciBjdG9yID0gY3RvckJ5Q2xhc3NbY2xhc3NOYW1lXTtcbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgY2FzZSBib29sQ2xhc3M6XG4gICAgICBjYXNlIGRhdGVDbGFzczpcbiAgICAgICAgcmV0dXJuIGRvbmUgPyByZXN1bHQgOiBuZXcgY3RvcigrcmVzdWx0KTtcblxuICAgICAgY2FzZSBudW1iZXJDbGFzczpcbiAgICAgIGNhc2Ugc3RyaW5nQ2xhc3M6XG4gICAgICAgIHJldHVybiBkb25lID8gcmVzdWx0IDogbmV3IGN0b3IocmVzdWx0KTtcblxuICAgICAgY2FzZSByZWdleHBDbGFzczpcbiAgICAgICAgcmV0dXJuIGRvbmUgPyByZXN1bHQgOiBjdG9yKHJlc3VsdC5zb3VyY2UsIHJlRmxhZ3MuZXhlYyhyZXN1bHQpKTtcbiAgICB9XG4gICAgLy8gY2hlY2sgZm9yIGNpcmN1bGFyIHJlZmVyZW5jZXMgYW5kIHJldHVybiBjb3JyZXNwb25kaW5nIGNsb25lXG4gICAgc3RhY2tBIHx8IChzdGFja0EgPSBbXSk7XG4gICAgc3RhY2tCIHx8IChzdGFja0IgPSBbXSk7XG5cbiAgICB2YXIgbGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIGlmIChzdGFja0FbbGVuZ3RoXSA9PSB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gc3RhY2tCW2xlbmd0aF07XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGluaXQgY2xvbmVkIG9iamVjdFxuICAgIGlmICghZG9uZSkge1xuICAgICAgcmVzdWx0ID0gaXNBcnIgPyBjdG9yKHJlc3VsdC5sZW5ndGgpIDoge307XG5cbiAgICAgIC8vIGFkZCBhcnJheSBwcm9wZXJ0aWVzIGFzc2lnbmVkIGJ5IGBSZWdFeHAjZXhlY2BcbiAgICAgIGlmIChpc0Fycikge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2luZGV4JykpIHtcbiAgICAgICAgICByZXN1bHQuaW5kZXggPSB2YWx1ZS5pbmRleDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2lucHV0JykpIHtcbiAgICAgICAgICByZXN1bHQuaW5wdXQgPSB2YWx1ZS5pbnB1dDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBhZGQgdGhlIHNvdXJjZSB2YWx1ZSB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHNcbiAgICAvLyBhbmQgYXNzb2NpYXRlIGl0IHdpdGggaXRzIGNsb25lXG4gICAgc3RhY2tBLnB1c2godmFsdWUpO1xuICAgIHN0YWNrQi5wdXNoKHJlc3VsdCk7XG5cbiAgICAvLyByZWN1cnNpdmVseSBwb3B1bGF0ZSBjbG9uZSAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXG4gICAgKGlzQXJyID8gZm9yRWFjaCA6IGZvck93bikoZG9uZSA/IHJlc3VsdCA6IHZhbHVlLCBmdW5jdGlvbihvYmpWYWx1ZSwga2V5KSB7XG4gICAgICByZXN1bHRba2V5XSA9IGNsb25lKG9ialZhbHVlLCBkZWVwLCBjYWxsYmFjaywgdW5kZWZpbmVkLCBzdGFja0EsIHN0YWNrQik7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBkZWVwIGNsb25lIG9mIGB2YWx1ZWAuIElmIGEgYGNhbGxiYWNrYCBmdW5jdGlvbiBpcyBwYXNzZWQsIGl0IHdpbGxcbiAgICogYmUgZXhlY3V0ZWQgdG8gcHJvZHVjZSB0aGUgY2xvbmVkIHZhbHVlcy4gSWYgYGNhbGxiYWNrYCByZXR1cm5zIHRoZSB2YWx1ZSBpdFxuICAgKiB3YXMgcGFzc2VkLCBjbG9uaW5nIHdpbGwgYmUgaGFuZGxlZCBieSB0aGUgbWV0aG9kIGluc3RlYWQuIFRoZSBgY2FsbGJhY2tgIGlzXG4gICAqIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIG9uZSBhcmd1bWVudDsgKHZhbHVlKS5cbiAgICpcbiAgICogTm90ZTogVGhpcyBmdW5jdGlvbiBpcyBsb29zZWx5IGJhc2VkIG9uIHRoZSBzdHJ1Y3R1cmVkIGNsb25lIGFsZ29yaXRobS4gRnVuY3Rpb25zXG4gICAqIGFuZCBET00gbm9kZXMgYXJlICoqbm90KiogY2xvbmVkLiBUaGUgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mIGBhcmd1bWVudHNgIG9iamVjdHMgYW5kXG4gICAqIG9iamVjdHMgY3JlYXRlZCBieSBjb25zdHJ1Y3RvcnMgb3RoZXIgdGhhbiBgT2JqZWN0YCBhcmUgY2xvbmVkIHRvIHBsYWluIGBPYmplY3RgIG9iamVjdHMuXG4gICAqIFNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNS9pbmZyYXN0cnVjdHVyZS5odG1sI2ludGVybmFsLXN0cnVjdHVyZWQtY2xvbmluZy1hbGdvcml0aG0uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGRlZXAgY2xvbmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjbG9uaW5nIHZhbHVlcy5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIGRlZXAgY2xvbmVkIGB2YWx1ZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9XG4gICAqIF07XG4gICAqXG4gICAqIHZhciBkZWVwID0gXy5jbG9uZURlZXAoc3Rvb2dlcyk7XG4gICAqIGRlZXBbMF0gPT09IHN0b29nZXNbMF07XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIHZhciB2aWV3ID0ge1xuICAgKiAgICdsYWJlbCc6ICdkb2NzJyxcbiAgICogICAnbm9kZSc6IGVsZW1lbnRcbiAgICogfTtcbiAgICpcbiAgICogdmFyIGNsb25lID0gXy5jbG9uZURlZXAodmlldywgZnVuY3Rpb24odmFsdWUpIHtcbiAgICogICByZXR1cm4gXy5pc0VsZW1lbnQodmFsdWUpID8gdmFsdWUuY2xvbmVOb2RlKHRydWUpIDogdmFsdWU7XG4gICAqIH0pO1xuICAgKlxuICAgKiBjbG9uZS5ub2RlID09IHZpZXcubm9kZTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGNsb25lRGVlcCh2YWx1ZSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICByZXR1cm4gY2xvbmUodmFsdWUsIHRydWUsIGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NpZ25zIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byB0aGUgZGVzdGluYXRpb25cbiAgICogb2JqZWN0IGZvciBhbGwgZGVzdGluYXRpb24gcHJvcGVydGllcyB0aGF0IHJlc29sdmUgdG8gYHVuZGVmaW5lZGAuIE9uY2UgYVxuICAgKiBwcm9wZXJ0eSBpcyBzZXQsIGFkZGl0aW9uYWwgZGVmYXVsdHMgb2YgdGhlIHNhbWUgcHJvcGVydHkgd2lsbCBiZSBpZ25vcmVkLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtzb3VyY2UxLCBzb3VyY2UyLCAuLi5dIFRoZSBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHBhcmFtLSB7T2JqZWN0fSBbZ3VhcmRdIEludGVybmFsbHkgdXNlZCB0byBhbGxvdyB3b3JraW5nIHdpdGggYF8ucmVkdWNlYFxuICAgKiAgd2l0aG91dCB1c2luZyBpdHMgY2FsbGJhY2sncyBga2V5YCBhbmQgYG9iamVjdGAgYXJndW1lbnRzIGFzIHNvdXJjZXMuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGZvb2QgPSB7ICduYW1lJzogJ2FwcGxlJyB9O1xuICAgKiBfLmRlZmF1bHRzKGZvb2QsIHsgJ25hbWUnOiAnYmFuYW5hJywgJ3R5cGUnOiAnZnJ1aXQnIH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ2FwcGxlJywgJ3R5cGUnOiAnZnJ1aXQnIH1cbiAgICovXG4gIHZhciBkZWZhdWx0cyA9IGNyZWF0ZUl0ZXJhdG9yKGRlZmF1bHRzSXRlcmF0b3JPcHRpb25zKTtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHNvcnRlZCBhcnJheSBvZiBhbGwgZW51bWVyYWJsZSBwcm9wZXJ0aWVzLCBvd24gYW5kIGluaGVyaXRlZCxcbiAgICogb2YgYG9iamVjdGAgdGhhdCBoYXZlIGZ1bmN0aW9uIHZhbHVlcy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgbWV0aG9kc1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHByb3BlcnR5IG5hbWVzIHRoYXQgaGF2ZSBmdW5jdGlvbiB2YWx1ZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZnVuY3Rpb25zKF8pO1xuICAgKiAvLyA9PiBbJ2FsbCcsICdhbnknLCAnYmluZCcsICdiaW5kQWxsJywgJ2Nsb25lJywgJ2NvbXBhY3QnLCAnY29tcG9zZScsIC4uLl1cbiAgICovXG4gIGZ1bmN0aW9uIGZ1bmN0aW9ucyhvYmplY3QpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0LnNvcnQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIHNwZWNpZmllZCBvYmplY3QgYHByb3BlcnR5YCBleGlzdHMgYW5kIGlzIGEgZGlyZWN0IHByb3BlcnR5LFxuICAgKiBpbnN0ZWFkIG9mIGFuIGluaGVyaXRlZCBwcm9wZXJ0eS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gY2hlY2suXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eSBUaGUgcHJvcGVydHkgdG8gY2hlY2sgZm9yLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYga2V5IGlzIGEgZGlyZWN0IHByb3BlcnR5LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaGFzKHsgJ2EnOiAxLCAnYic6IDIsICdjJzogMyB9LCAnYicpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBoYXMob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgIHJldHVybiBvYmplY3QgPyBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpIDogZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIGludmVydGVkIGtleXMgYW5kIHZhbHVlcyBvZiB0aGUgZ2l2ZW4gYG9iamVjdGAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGludmVydC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY3JlYXRlZCBpbnZlcnRlZCBvYmplY3QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqICBfLmludmVydCh7ICdmaXJzdCc6ICdtb2UnLCAnc2Vjb25kJzogJ2xhcnJ5JyB9KTtcbiAgICogLy8gPT4geyAnbW9lJzogJ2ZpcnN0JywgJ2xhcnJ5JzogJ3NlY29uZCcgfSAob3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gICAqL1xuICBmdW5jdGlvbiBpbnZlcnQob2JqZWN0KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIHByb3BzID0ga2V5cyhvYmplY3QpLFxuICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICAgIHJlc3VsdCA9IHt9O1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgICByZXN1bHRbb2JqZWN0W2tleV1dID0ga2V5O1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgYm9vbGVhbiB2YWx1ZS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCwgaWYgdGhlIGB2YWx1ZWAgaXMgYSBib29sZWFuIHZhbHVlLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNCb29sZWFuKG51bGwpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNCb29sZWFuKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSB0cnVlIHx8IHZhbHVlID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBib29sQ2xhc3M7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBkYXRlLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiB0aGUgYHZhbHVlYCBpcyBhIGRhdGUsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0RhdGUobmV3IERhdGUpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc0RhdGUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBEYXRlIHx8IHRvU3RyaW5nLmNhbGwodmFsdWUpID09IGRhdGVDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIERPTSBlbGVtZW50LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiB0aGUgYHZhbHVlYCBpcyBhIERPTSBlbGVtZW50LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNFbGVtZW50KGRvY3VtZW50LmJvZHkpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc0VsZW1lbnQodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPyB2YWx1ZS5ub2RlVHlwZSA9PT0gMSA6IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGVtcHR5LiBBcnJheXMsIHN0cmluZ3MsIG9yIGBhcmd1bWVudHNgIG9iamVjdHMgd2l0aCBhXG4gICAqIGxlbmd0aCBvZiBgMGAgYW5kIG9iamVjdHMgd2l0aCBubyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzIGFyZSBjb25zaWRlcmVkXG4gICAqIFwiZW1wdHlcIi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IHZhbHVlIFRoZSB2YWx1ZSB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIHRoZSBgdmFsdWVgIGlzIGVtcHR5LCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNFbXB0eShbMSwgMiwgM10pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzRW1wdHkoe30pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNFbXB0eSgnJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzRW1wdHkodmFsdWUpIHtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbCh2YWx1ZSksXG4gICAgICAgIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcblxuICAgIGlmICgoY2xhc3NOYW1lID09IGFycmF5Q2xhc3MgfHwgY2xhc3NOYW1lID09IHN0cmluZ0NsYXNzIHx8XG4gICAgICAgIGNsYXNzTmFtZSA9PSBhcmdzQ2xhc3MpIHx8XG4gICAgICAgIChjbGFzc05hbWUgPT0gb2JqZWN0Q2xhc3MgJiYgdHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyAmJiBpc0Z1bmN0aW9uKHZhbHVlLnNwbGljZSkpKSB7XG4gICAgICByZXR1cm4gIWxlbmd0aDtcbiAgICB9XG4gICAgZm9yT3duKHZhbHVlLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAocmVzdWx0ID0gZmFsc2UpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgYSBkZWVwIGNvbXBhcmlzb24gYmV0d2VlbiB0d28gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZVxuICAgKiBlcXVpdmFsZW50IHRvIGVhY2ggb3RoZXIuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIHRvXG4gICAqIGNvbXBhcmUgdmFsdWVzLiBJZiBgY2FsbGJhY2tgIHJldHVybnMgYHVuZGVmaW5lZGAsIGNvbXBhcmlzb25zIHdpbGwgYmUgaGFuZGxlZFxuICAgKiBieSB0aGUgbWV0aG9kIGluc3RlYWQuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoXG4gICAqIHR3byBhcmd1bWVudHM7IChhLCBiKS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSBhIFRoZSB2YWx1ZSB0byBjb21wYXJlLlxuICAgKiBAcGFyYW0ge01peGVkfSBiIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgY29tcGFyaW5nIHZhbHVlcy5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtzdGFja0E9W11dIEludGVybmFsbHkgdXNlZCB0cmFjayB0cmF2ZXJzZWQgYGFgIG9iamVjdHMuXG4gICAqIEBwYXJhbS0ge09iamVjdH0gW3N0YWNrQj1bXV0gSW50ZXJuYWxseSB1c2VkIHRyYWNrIHRyYXZlcnNlZCBgYmAgb2JqZWN0cy5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiB0aGUgdmFsdWVzIGFyZSBlcXV2YWxlbnQsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG1vZSA9IHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH07XG4gICAqIHZhciBjb3B5ID0geyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfTtcbiAgICpcbiAgICogbW9lID09IGNvcHk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNFcXVhbChtb2UsIGNvcHkpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIHZhciB3b3JkcyA9IFsnaGVsbG8nLCAnZ29vZGJ5ZSddO1xuICAgKiB2YXIgb3RoZXJXb3JkcyA9IFsnaGknLCAnZ29vZGJ5ZSddO1xuICAgKlxuICAgKiBfLmlzRXF1YWwod29yZHMsIG90aGVyV29yZHMsIGZ1bmN0aW9uKGEsIGIpIHtcbiAgICogICB2YXIgcmVHcmVldCA9IC9eKD86aGVsbG98aGkpJC9pLFxuICAgKiAgICAgICBhR3JlZXQgPSBfLmlzU3RyaW5nKGEpICYmIHJlR3JlZXQudGVzdChhKSxcbiAgICogICAgICAgYkdyZWV0ID0gXy5pc1N0cmluZyhiKSAmJiByZUdyZWV0LnRlc3QoYik7XG4gICAqXG4gICAqICAgcmV0dXJuIChhR3JlZXQgfHwgYkdyZWV0KSA/IChhR3JlZXQgPT0gYkdyZWV0KSA6IHVuZGVmaW5lZDtcbiAgICogfSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzRXF1YWwoYSwgYiwgY2FsbGJhY2ssIHRoaXNBcmcsIHN0YWNrQSwgc3RhY2tCKSB7XG4gICAgLy8gdXNlZCB0byBpbmRpY2F0ZSB0aGF0IHdoZW4gY29tcGFyaW5nIG9iamVjdHMsIGBhYCBoYXMgYXQgbGVhc3QgdGhlIHByb3BlcnRpZXMgb2YgYGJgXG4gICAgdmFyIHdoZXJlSW5kaWNhdG9yID0gY2FsbGJhY2sgPT09IGluZGljYXRvck9iamVjdDtcbiAgICBpZiAoY2FsbGJhY2sgJiYgIXdoZXJlSW5kaWNhdG9yKSB7XG4gICAgICBjYWxsYmFjayA9IHR5cGVvZiB0aGlzQXJnID09ICd1bmRlZmluZWQnID8gY2FsbGJhY2sgOiBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMik7XG4gICAgICB2YXIgcmVzdWx0ID0gY2FsbGJhY2soYSwgYik7XG4gICAgICBpZiAodHlwZW9mIHJlc3VsdCAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gISFyZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4aXQgZWFybHkgZm9yIGlkZW50aWNhbCB2YWx1ZXNcbiAgICBpZiAoYSA9PT0gYikge1xuICAgICAgLy8gdHJlYXQgYCswYCB2cy4gYC0wYCBhcyBub3QgZXF1YWxcbiAgICAgIHJldHVybiBhICE9PSAwIHx8ICgxIC8gYSA9PSAxIC8gYik7XG4gICAgfVxuICAgIHZhciB0eXBlID0gdHlwZW9mIGEsXG4gICAgICAgIG90aGVyVHlwZSA9IHR5cGVvZiBiO1xuXG4gICAgLy8gZXhpdCBlYXJseSBmb3IgdW5saWtlIHByaW1pdGl2ZSB2YWx1ZXNcbiAgICBpZiAoYSA9PT0gYSAmJlxuICAgICAgICAoIWEgfHwgKHR5cGUgIT0gJ2Z1bmN0aW9uJyAmJiB0eXBlICE9ICdvYmplY3QnKSkgJiZcbiAgICAgICAgKCFiIHx8IChvdGhlclR5cGUgIT0gJ2Z1bmN0aW9uJyAmJiBvdGhlclR5cGUgIT0gJ29iamVjdCcpKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBleGl0IGVhcmx5IGZvciBgbnVsbGAgYW5kIGB1bmRlZmluZWRgLCBhdm9pZGluZyBFUzMncyBGdW5jdGlvbiNjYWxsIGJlaGF2aW9yXG4gICAgLy8gaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMy40LjRcbiAgICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGEgPT09IGI7XG4gICAgfVxuICAgIC8vIGNvbXBhcmUgW1tDbGFzc11dIG5hbWVzXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSksXG4gICAgICAgIG90aGVyQ2xhc3MgPSB0b1N0cmluZy5jYWxsKGIpO1xuXG4gICAgaWYgKGNsYXNzTmFtZSA9PSBhcmdzQ2xhc3MpIHtcbiAgICAgIGNsYXNzTmFtZSA9IG9iamVjdENsYXNzO1xuICAgIH1cbiAgICBpZiAob3RoZXJDbGFzcyA9PSBhcmdzQ2xhc3MpIHtcbiAgICAgIG90aGVyQ2xhc3MgPSBvYmplY3RDbGFzcztcbiAgICB9XG4gICAgaWYgKGNsYXNzTmFtZSAhPSBvdGhlckNsYXNzKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICBjYXNlIGJvb2xDbGFzczpcbiAgICAgIGNhc2UgZGF0ZUNsYXNzOlxuICAgICAgICAvLyBjb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWJlcnMsIGRhdGVzIHRvIG1pbGxpc2Vjb25kcyBhbmQgYm9vbGVhbnNcbiAgICAgICAgLy8gdG8gYDFgIG9yIGAwYCwgdHJlYXRpbmcgaW52YWxpZCBkYXRlcyBjb2VyY2VkIHRvIGBOYU5gIGFzIG5vdCBlcXVhbFxuICAgICAgICByZXR1cm4gK2EgPT0gK2I7XG5cbiAgICAgIGNhc2UgbnVtYmVyQ2xhc3M6XG4gICAgICAgIC8vIHRyZWF0IGBOYU5gIHZzLiBgTmFOYCBhcyBlcXVhbFxuICAgICAgICByZXR1cm4gYSAhPSArYVxuICAgICAgICAgID8gYiAhPSArYlxuICAgICAgICAgIC8vIGJ1dCB0cmVhdCBgKzBgIHZzLiBgLTBgIGFzIG5vdCBlcXVhbFxuICAgICAgICAgIDogKGEgPT0gMCA/ICgxIC8gYSA9PSAxIC8gYikgOiBhID09ICtiKTtcblxuICAgICAgY2FzZSByZWdleHBDbGFzczpcbiAgICAgIGNhc2Ugc3RyaW5nQ2xhc3M6XG4gICAgICAgIC8vIGNvZXJjZSByZWdleGVzIHRvIHN0cmluZ3MgKGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjEwLjYuNClcbiAgICAgICAgLy8gdHJlYXQgc3RyaW5nIHByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IGluc3RhbmNlcyBhcyBlcXVhbFxuICAgICAgICByZXR1cm4gYSA9PSBiICsgJyc7XG4gICAgfVxuICAgIHZhciBpc0FyciA9IGNsYXNzTmFtZSA9PSBhcnJheUNsYXNzO1xuICAgIGlmICghaXNBcnIpIHtcbiAgICAgIC8vIHVud3JhcCBhbnkgYGxvZGFzaGAgd3JhcHBlZCB2YWx1ZXNcbiAgICAgIGlmIChhLl9fd3JhcHBlZF9fIHx8IGIuX193cmFwcGVkX18pIHtcbiAgICAgICAgcmV0dXJuIGlzRXF1YWwoYS5fX3dyYXBwZWRfXyB8fCBhLCBiLl9fd3JhcHBlZF9fIHx8IGIsIGNhbGxiYWNrLCB0aGlzQXJnLCBzdGFja0EsIHN0YWNrQik7XG4gICAgICB9XG4gICAgICAvLyBleGl0IGZvciBmdW5jdGlvbnMgYW5kIERPTSBub2Rlc1xuICAgICAgaWYgKGNsYXNzTmFtZSAhPSBvYmplY3RDbGFzcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICAvLyBpbiBvbGRlciB2ZXJzaW9ucyBvZiBPcGVyYSwgYGFyZ3VtZW50c2Agb2JqZWN0cyBoYXZlIGBBcnJheWAgY29uc3RydWN0b3JzXG4gICAgICB2YXIgY3RvckEgPSBhLmNvbnN0cnVjdG9yLFxuICAgICAgICAgIGN0b3JCID0gYi5jb25zdHJ1Y3RvcjtcblxuICAgICAgLy8gbm9uIGBPYmplY3RgIG9iamVjdCBpbnN0YW5jZXMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1YWxcbiAgICAgIGlmIChjdG9yQSAhPSBjdG9yQiAmJiAhKFxuICAgICAgICAgICAgaXNGdW5jdGlvbihjdG9yQSkgJiYgY3RvckEgaW5zdGFuY2VvZiBjdG9yQSAmJlxuICAgICAgICAgICAgaXNGdW5jdGlvbihjdG9yQikgJiYgY3RvckIgaW5zdGFuY2VvZiBjdG9yQlxuICAgICAgICAgICkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBhc3N1bWUgY3ljbGljIHN0cnVjdHVyZXMgYXJlIGVxdWFsXG4gICAgLy8gdGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpYyBzdHJ1Y3R1cmVzIGlzIGFkYXB0ZWQgZnJvbSBFUyA1LjFcbiAgICAvLyBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gIChodHRwOi8vZXM1LmdpdGh1Yi5jb20vI3gxNS4xMi4zKVxuICAgIHN0YWNrQSB8fCAoc3RhY2tBID0gW10pO1xuICAgIHN0YWNrQiB8fCAoc3RhY2tCID0gW10pO1xuXG4gICAgdmFyIGxlbmd0aCA9IHN0YWNrQS5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICBpZiAoc3RhY2tBW2xlbmd0aF0gPT0gYSkge1xuICAgICAgICByZXR1cm4gc3RhY2tCW2xlbmd0aF0gPT0gYjtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHNpemUgPSAwO1xuICAgIHJlc3VsdCA9IHRydWU7XG5cbiAgICAvLyBhZGQgYGFgIGFuZCBgYmAgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzXG4gICAgc3RhY2tBLnB1c2goYSk7XG4gICAgc3RhY2tCLnB1c2goYik7XG5cbiAgICAvLyByZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cyAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXG4gICAgaWYgKGlzQXJyKSB7XG4gICAgICBsZW5ndGggPSBhLmxlbmd0aDtcbiAgICAgIHNpemUgPSBiLmxlbmd0aDtcblxuICAgICAgLy8gY29tcGFyZSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnlcbiAgICAgIHJlc3VsdCA9IHNpemUgPT0gYS5sZW5ndGg7XG4gICAgICBpZiAoIXJlc3VsdCAmJiAhd2hlcmVJbmRpY2F0b3IpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIC8vIGRlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXNcbiAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgdmFyIGluZGV4ID0gbGVuZ3RoLFxuICAgICAgICAgICAgdmFsdWUgPSBiW3NpemVdO1xuXG4gICAgICAgIGlmICh3aGVyZUluZGljYXRvcikge1xuICAgICAgICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICAgICAgICBpZiAoKHJlc3VsdCA9IGlzRXF1YWwoYVtpbmRleF0sIHZhbHVlLCBjYWxsYmFjaywgdGhpc0FyZywgc3RhY2tBLCBzdGFja0IpKSkge1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIShyZXN1bHQgPSBpc0VxdWFsKGFbc2l6ZV0sIHZhbHVlLCBjYWxsYmFjaywgdGhpc0FyZywgc3RhY2tBLCBzdGFja0IpKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICAvLyBkZWVwIGNvbXBhcmUgb2JqZWN0cyB1c2luZyBgZm9ySW5gLCBpbnN0ZWFkIG9mIGBmb3JPd25gLCB0byBhdm9pZCBgT2JqZWN0LmtleXNgXG4gICAgLy8gd2hpY2gsIGluIHRoaXMgY2FzZSwgaXMgbW9yZSBjb3N0bHlcbiAgICBmb3JJbihiLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBiKSB7XG4gICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChiLCBrZXkpKSB7XG4gICAgICAgIC8vIGNvdW50IHRoZSBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgICAgc2l6ZSsrO1xuICAgICAgICAvLyBkZWVwIGNvbXBhcmUgZWFjaCBwcm9wZXJ0eSB2YWx1ZS5cbiAgICAgICAgcmV0dXJuIChyZXN1bHQgPSBoYXNPd25Qcm9wZXJ0eS5jYWxsKGEsIGtleSkgJiYgaXNFcXVhbChhW2tleV0sIHZhbHVlLCBjYWxsYmFjaywgdGhpc0FyZywgc3RhY2tBLCBzdGFja0IpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChyZXN1bHQgJiYgIXdoZXJlSW5kaWNhdG9yKSB7XG4gICAgICAvLyBlbnN1cmUgYm90aCBvYmplY3RzIGhhdmUgdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXNcbiAgICAgIGZvckluKGEsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGEpIHtcbiAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoYSwga2V5KSkge1xuICAgICAgICAgIC8vIGBzaXplYCB3aWxsIGJlIGAtMWAgaWYgYGFgIGhhcyBtb3JlIHByb3BlcnRpZXMgdGhhbiBgYmBcbiAgICAgICAgICByZXR1cm4gKHJlc3VsdCA9IC0tc2l6ZSA+IC0xKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMsIG9yIGNhbiBiZSBjb2VyY2VkIHRvLCBhIGZpbml0ZSBudW1iZXIuXG4gICAqXG4gICAqIE5vdGU6IFRoaXMgaXMgbm90IHRoZSBzYW1lIGFzIG5hdGl2ZSBgaXNGaW5pdGVgLCB3aGljaCB3aWxsIHJldHVybiB0cnVlIGZvclxuICAgKiBib29sZWFucyBhbmQgZW1wdHkgc3RyaW5ncy4gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDE1LjEuMi41LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiB0aGUgYHZhbHVlYCBpcyBmaW5pdGUsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0Zpbml0ZSgtMTAxKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzRmluaXRlKCcxMCcpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNGaW5pdGUodHJ1ZSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNGaW5pdGUoJycpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzRmluaXRlKEluZmluaXR5KTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICovXG4gIGZ1bmN0aW9uIGlzRmluaXRlKHZhbHVlKSB7XG4gICAgcmV0dXJuIG5hdGl2ZUlzRmluaXRlKHZhbHVlKSAmJiAhbmF0aXZlSXNOYU4ocGFyc2VGbG9hdCh2YWx1ZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZnVuY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIHRoZSBgdmFsdWVgIGlzIGEgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc0Z1bmN0aW9uKF8pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnZnVuY3Rpb24nO1xuICB9XG4gIC8vIGZhbGxiYWNrIGZvciBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaVxuICBpZiAoaXNGdW5jdGlvbigveC8pKSB7XG4gICAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBGdW5jdGlvbiB8fCB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBmdW5jQ2xhc3M7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgbGFuZ3VhZ2UgdHlwZSBvZiBPYmplY3QuXG4gICAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiB0aGUgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc09iamVjdCh7fSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uaXNPYmplY3QoMSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAgIC8vIGNoZWNrIGlmIHRoZSB2YWx1ZSBpcyB0aGUgRUNNQVNjcmlwdCBsYW5ndWFnZSB0eXBlIG9mIE9iamVjdFxuICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmNvbS8jeDhcbiAgICAvLyBhbmQgYXZvaWQgYSBWOCBidWdcbiAgICAvLyBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxXG4gICAgcmV0dXJuIHZhbHVlID8gb2JqZWN0VHlwZXNbdHlwZW9mIHZhbHVlXSA6IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGBOYU5gLlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGlzIG5vdCB0aGUgc2FtZSBhcyBuYXRpdmUgYGlzTmFOYCwgd2hpY2ggd2lsbCByZXR1cm4gYHRydWVgIGZvclxuICAgKiBgdW5kZWZpbmVkYCBhbmQgb3RoZXIgdmFsdWVzLiBTZWUgaHR0cDovL2VzNS5naXRodWIuY29tLyN4MTUuMS4yLjQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIHRoZSBgdmFsdWVgIGlzIGBOYU5gLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNOYU4oTmFOKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzTmFOKG5ldyBOdW1iZXIoTmFOKSk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogaXNOYU4odW5kZWZpbmVkKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzTmFOKHVuZGVmaW5lZCk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBpc05hTih2YWx1ZSkge1xuICAgIC8vIGBOYU5gIGFzIGEgcHJpbWl0aXZlIGlzIHRoZSBvbmx5IHZhbHVlIHRoYXQgaXMgbm90IGVxdWFsIHRvIGl0c2VsZlxuICAgIC8vIChwZXJmb3JtIHRoZSBbW0NsYXNzXV0gY2hlY2sgZmlyc3QgdG8gYXZvaWQgZXJyb3JzIHdpdGggc29tZSBob3N0IG9iamVjdHMgaW4gSUUpXG4gICAgcmV0dXJuIGlzTnVtYmVyKHZhbHVlKSAmJiB2YWx1ZSAhPSArdmFsdWVcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBgbnVsbGAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIHRoZSBgdmFsdWVgIGlzIGBudWxsYCwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzTnVsbChudWxsKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiBfLmlzTnVsbCh1bmRlZmluZWQpO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKi9cbiAgZnVuY3Rpb24gaXNOdWxsKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgbnVtYmVyLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAgICogQHJldHVybnMge0Jvb2xlYW59IFJldHVybnMgYHRydWVgLCBpZiB0aGUgYHZhbHVlYCBpcyBhIG51bWJlciwgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmlzTnVtYmVyKDguNCAqIDUpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc051bWJlcih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gbnVtYmVyQ2xhc3M7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gYHZhbHVlYCBpcyBhbiBvYmplY3QgY3JlYXRlZCBieSB0aGUgYE9iamVjdGAgY29uc3RydWN0b3IuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogZnVuY3Rpb24gU3Rvb2dlKG5hbWUsIGFnZSkge1xuICAgKiAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAqICAgdGhpcy5hZ2UgPSBhZ2U7XG4gICAqIH1cbiAgICpcbiAgICogXy5pc1BsYWluT2JqZWN0KG5ldyBTdG9vZ2UoJ21vZScsIDQwKSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqXG4gICAqIF8uaXNQbGFpbk9iamVjdChbMSwgMiwgM10pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiBfLmlzUGxhaW5PYmplY3QoeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIHZhciBpc1BsYWluT2JqZWN0ID0gIWdldFByb3RvdHlwZU9mID8gc2hpbUlzUGxhaW5PYmplY3QgOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIGlmICghKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdmFyIHZhbHVlT2YgPSB2YWx1ZS52YWx1ZU9mLFxuICAgICAgICBvYmpQcm90byA9IHR5cGVvZiB2YWx1ZU9mID09ICdmdW5jdGlvbicgJiYgKG9ialByb3RvID0gZ2V0UHJvdG90eXBlT2YodmFsdWVPZikpICYmIGdldFByb3RvdHlwZU9mKG9ialByb3RvKTtcblxuICAgIHJldHVybiBvYmpQcm90b1xuICAgICAgPyB2YWx1ZSA9PSBvYmpQcm90byB8fCAoZ2V0UHJvdG90eXBlT2YodmFsdWUpID09IG9ialByb3RvICYmICFpc0FyZ3VtZW50cyh2YWx1ZSkpXG4gICAgICA6IHNoaW1Jc1BsYWluT2JqZWN0KHZhbHVlKTtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSByZWd1bGFyIGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAsIGlmIHRoZSBgdmFsdWVgIGlzIGEgcmVndWxhciBleHByZXNzaW9uLCBlbHNlIGBmYWxzZWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaXNSZWdFeHAoL21vZS8pO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc1JlZ0V4cCh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCB8fCB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSByZWdleHBDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHN0cmluZy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCwgaWYgdGhlIGB2YWx1ZWAgaXMgYSBzdHJpbmcsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc1N0cmluZygnbW9lJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICovXG4gIGZ1bmN0aW9uIGlzU3RyaW5nKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyB8fCB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBzdHJpbmdDbGFzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIGB0cnVlYCwgaWYgdGhlIGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5pc1VuZGVmaW5lZCh2b2lkIDApO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqL1xuICBmdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ3VuZGVmaW5lZCc7XG4gIH1cblxuICAvKipcbiAgICogUmVjdXJzaXZlbHkgbWVyZ2VzIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgdGhlIHNvdXJjZSBvYmplY3QocyksIHRoYXRcbiAgICogZG9uJ3QgcmVzb2x2ZSB0byBgdW5kZWZpbmVkYCwgaW50byB0aGUgZGVzdGluYXRpb24gb2JqZWN0LiBTdWJzZXF1ZW50IHNvdXJjZXNcbiAgICogd2lsbCBvdmVyd3JpdGUgcHJvcGVyeSBhc3NpZ25tZW50cyBvZiBwcmV2aW91cyBzb3VyY2VzLiBJZiBhIGBjYWxsYmFja2AgZnVuY3Rpb25cbiAgICogaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIHRvIHByb2R1Y2UgdGhlIG1lcmdlZCB2YWx1ZXMgb2YgdGhlIGRlc3RpbmF0aW9uXG4gICAqIGFuZCBzb3VyY2UgcHJvcGVydGllcy4gSWYgYGNhbGxiYWNrYCByZXR1cm5zIGB1bmRlZmluZWRgLCBtZXJnaW5nIHdpbGwgYmVcbiAgICogaGFuZGxlZCBieSB0aGUgbWV0aG9kIGluc3RlYWQuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcbiAgICogaW52b2tlZCB3aXRoIHR3byBhcmd1bWVudHM7IChvYmplY3RWYWx1ZSwgc291cmNlVmFsdWUpLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtzb3VyY2UxLCBzb3VyY2UyLCAuLi5dIFRoZSBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIG1lcmdpbmcgcHJvcGVydGllcy5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcGFyYW0tIHtPYmplY3R9IFtkZWVwSW5kaWNhdG9yXSBJbnRlcm5hbGx5IHVzZWQgdG8gaW5kaWNhdGUgdGhhdCBgc3RhY2tBYFxuICAgKiAgYW5kIGBzdGFja0JgIGFyZSBhcnJheXMgb2YgdHJhdmVyc2VkIG9iamVjdHMgaW5zdGVhZCBvZiBzb3VyY2Ugb2JqZWN0cy5cbiAgICogQHBhcmFtLSB7QXJyYXl9IFtzdGFja0E9W11dIEludGVybmFsbHkgdXNlZCB0byB0cmFjayB0cmF2ZXJzZWQgc291cmNlIG9iamVjdHMuXG4gICAqIEBwYXJhbS0ge0FycmF5fSBbc3RhY2tCPVtdXSBJbnRlcm5hbGx5IHVzZWQgdG8gYXNzb2NpYXRlIHZhbHVlcyB3aXRoIHRoZWlyXG4gICAqICBzb3VyY2UgY291bnRlcnBhcnRzLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBuYW1lcyA9IHtcbiAgICogICAnc3Rvb2dlcyc6IFtcbiAgICogICAgIHsgJ25hbWUnOiAnbW9lJyB9LFxuICAgKiAgICAgeyAnbmFtZSc6ICdsYXJyeScgfVxuICAgKiAgIF1cbiAgICogfTtcbiAgICpcbiAgICogdmFyIGFnZXMgPSB7XG4gICAqICAgJ3N0b29nZXMnOiBbXG4gICAqICAgICB7ICdhZ2UnOiA0MCB9LFxuICAgKiAgICAgeyAnYWdlJzogNTAgfVxuICAgKiAgIF1cbiAgICogfTtcbiAgICpcbiAgICogXy5tZXJnZShuYW1lcywgYWdlcyk7XG4gICAqIC8vID0+IHsgJ3N0b29nZXMnOiBbeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfSwgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9XSB9XG4gICAqXG4gICAqIHZhciBmb29kID0ge1xuICAgKiAgICdmcnVpdHMnOiBbJ2FwcGxlJ10sXG4gICAqICAgJ3ZlZ2V0YWJsZXMnOiBbJ2JlZXQnXVxuICAgKiB9O1xuICAgKlxuICAgKiB2YXIgb3RoZXJGb29kID0ge1xuICAgKiAgICdmcnVpdHMnOiBbJ2JhbmFuYSddLFxuICAgKiAgICd2ZWdldGFibGVzJzogWydjYXJyb3QnXVxuICAgKiB9O1xuICAgKlxuICAgKiBfLm1lcmdlKGZvb2QsIG90aGVyRm9vZCwgZnVuY3Rpb24oYSwgYikge1xuICAgKiAgIHJldHVybiBfLmlzQXJyYXkoYSkgPyBhLmNvbmNhdChiKSA6IHVuZGVmaW5lZDtcbiAgICogfSk7XG4gICAqIC8vID0+IHsgJ2ZydWl0cyc6IFsnYXBwbGUnLCAnYmFuYW5hJ10sICd2ZWdldGFibGVzJzogWydiZWV0JywgJ2NhcnJvdF0gfVxuICAgKi9cbiAgZnVuY3Rpb24gbWVyZ2Uob2JqZWN0LCBzb3VyY2UsIGRlZXBJbmRpY2F0b3IpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgaW5kZXggPSAwLFxuICAgICAgICBsZW5ndGggPSAyO1xuXG4gICAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgICByZXR1cm4gb2JqZWN0O1xuICAgIH1cbiAgICBpZiAoZGVlcEluZGljYXRvciA9PT0gaW5kaWNhdG9yT2JqZWN0KSB7XG4gICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzWzNdLFxuICAgICAgICAgIHN0YWNrQSA9IGFyZ3NbNF0sXG4gICAgICAgICAgc3RhY2tCID0gYXJnc1s1XTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhY2tBID0gW107XG4gICAgICBzdGFja0IgPSBbXTtcblxuICAgICAgLy8gYWxsb3dzIHdvcmtpbmcgd2l0aCBgXy5yZWR1Y2VgIGFuZCBgXy5yZWR1Y2VSaWdodGAgd2l0aG91dFxuICAgICAgLy8gdXNpbmcgdGhlaXIgYGNhbGxiYWNrYCBhcmd1bWVudHMsIGBpbmRleHxrZXlgIGFuZCBgY29sbGVjdGlvbmBcbiAgICAgIGlmICh0eXBlb2YgZGVlcEluZGljYXRvciAhPSAnbnVtYmVyJykge1xuICAgICAgICBsZW5ndGggPSBhcmdzLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGlmIChsZW5ndGggPiAzICYmIHR5cGVvZiBhcmdzW2xlbmd0aCAtIDJdID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhhcmdzWy0tbGVuZ3RoIC0gMV0sIGFyZ3NbbGVuZ3RoLS1dLCAyKTtcbiAgICAgIH0gZWxzZSBpZiAobGVuZ3RoID4gMiAmJiB0eXBlb2YgYXJnc1tsZW5ndGggLSAxXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1stLWxlbmd0aF07XG4gICAgICB9XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAoaXNBcnJheShhcmdzW2luZGV4XSkgPyBmb3JFYWNoIDogZm9yT3duKShhcmdzW2luZGV4XSwgZnVuY3Rpb24oc291cmNlLCBrZXkpIHtcbiAgICAgICAgdmFyIGZvdW5kLFxuICAgICAgICAgICAgaXNBcnIsXG4gICAgICAgICAgICByZXN1bHQgPSBzb3VyY2UsXG4gICAgICAgICAgICB2YWx1ZSA9IG9iamVjdFtrZXldO1xuXG4gICAgICAgIGlmIChzb3VyY2UgJiYgKChpc0FyciA9IGlzQXJyYXkoc291cmNlKSkgfHwgaXNQbGFpbk9iamVjdChzb3VyY2UpKSkge1xuICAgICAgICAgIC8vIGF2b2lkIG1lcmdpbmcgcHJldmlvdXNseSBtZXJnZWQgY3ljbGljIHNvdXJjZXNcbiAgICAgICAgICB2YXIgc3RhY2tMZW5ndGggPSBzdGFja0EubGVuZ3RoO1xuICAgICAgICAgIHdoaWxlIChzdGFja0xlbmd0aC0tKSB7XG4gICAgICAgICAgICBpZiAoKGZvdW5kID0gc3RhY2tBW3N0YWNrTGVuZ3RoXSA9PSBzb3VyY2UpKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gc3RhY2tCW3N0YWNrTGVuZ3RoXTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgIHZhbHVlID0gaXNBcnJcbiAgICAgICAgICAgICAgPyAoaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IFtdKVxuICAgICAgICAgICAgICA6IChpc1BsYWluT2JqZWN0KHZhbHVlKSA/IHZhbHVlIDoge30pO1xuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIHNvdXJjZSk7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSByZXN1bHQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGFkZCBgc291cmNlYCBhbmQgYXNzb2NpYXRlZCBgdmFsdWVgIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xuICAgICAgICAgICAgc3RhY2tBLnB1c2goc291cmNlKTtcbiAgICAgICAgICAgIHN0YWNrQi5wdXNoKHZhbHVlKTtcblxuICAgICAgICAgICAgLy8gcmVjdXJzaXZlbHkgbWVyZ2Ugb2JqZWN0cyBhbmQgYXJyYXlzIChzdXNjZXB0aWJsZSB0byBjYWxsIHN0YWNrIGxpbWl0cylcbiAgICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBtZXJnZSh2YWx1ZSwgc291cmNlLCBpbmRpY2F0b3JPYmplY3QsIGNhbGxiYWNrLCBzdGFja0EsIHN0YWNrQik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICByZXN1bHQgPSBzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHJlc3VsdDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBzaGFsbG93IGNsb25lIG9mIGBvYmplY3RgIGV4Y2x1ZGluZyB0aGUgc3BlY2lmaWVkIHByb3BlcnRpZXMuXG4gICAqIFByb3BlcnR5IG5hbWVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzIG9mXG4gICAqIHByb3BlcnR5IG5hbWVzLiBJZiBhIGBjYWxsYmFja2AgZnVuY3Rpb24gaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkXG4gICAqIGZvciBlYWNoIHByb3BlcnR5IGluIHRoZSBgb2JqZWN0YCwgb21pdHRpbmcgdGhlIHByb3BlcnRpZXMgYGNhbGxiYWNrYFxuICAgKiByZXR1cm5zIHRydXRoeSBmb3IuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZFxuICAgKiB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IE9iamVjdHNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgc291cmNlIG9iamVjdC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGNhbGxiYWNrfFtwcm9wMSwgcHJvcDIsIC4uLl0gVGhlIHByb3BlcnRpZXMgdG8gb21pdFxuICAgKiAgb3IgdGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gb2JqZWN0IHdpdGhvdXQgdGhlIG9taXR0ZWQgcHJvcGVydGllcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5vbWl0KHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sICdhZ2UnKTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdtb2UnIH1cbiAgICpcbiAgICogXy5vbWl0KHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAqICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJztcbiAgICogfSk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnbW9lJyB9XG4gICAqL1xuICBmdW5jdGlvbiBvbWl0KG9iamVjdCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgaXNGdW5jID0gdHlwZW9mIGNhbGxiYWNrID09ICdmdW5jdGlvbicsXG4gICAgICAgIHJlc3VsdCA9IHt9O1xuXG4gICAgaWYgKGlzRnVuYykge1xuICAgICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBwcm9wcyA9IGNvbmNhdC5hcHBseShhcnJheVJlZiwgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmplY3QpIHtcbiAgICAgIGlmIChpc0Z1bmNcbiAgICAgICAgICAgID8gIWNhbGxiYWNrKHZhbHVlLCBrZXksIG9iamVjdClcbiAgICAgICAgICAgIDogaW5kZXhPZihwcm9wcywga2V5LCAxKSA8IDBcbiAgICAgICAgICApIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSB0d28gZGltZW5zaW9uYWwgYXJyYXkgb2YgdGhlIGdpdmVuIG9iamVjdCdzIGtleS12YWx1ZSBwYWlycyxcbiAgICogaS5lLiBgW1trZXkxLCB2YWx1ZTFdLCBba2V5MiwgdmFsdWUyXV1gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgbmV3IGFycmF5IG9mIGtleS12YWx1ZSBwYWlycy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5wYWlycyh7ICdtb2UnOiAzMCwgJ2xhcnJ5JzogNDAgfSk7XG4gICAqIC8vID0+IFtbJ21vZScsIDMwXSwgWydsYXJyeScsIDQwXV0gKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgZnVuY3Rpb24gcGFpcnMob2JqZWN0KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIHByb3BzID0ga2V5cyhvYmplY3QpLFxuICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBba2V5LCBvYmplY3Rba2V5XV07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHNoYWxsb3cgY2xvbmUgb2YgYG9iamVjdGAgY29tcG9zZWQgb2YgdGhlIHNwZWNpZmllZCBwcm9wZXJ0aWVzLlxuICAgKiBQcm9wZXJ0eSBuYW1lcyBtYXkgYmUgc3BlY2lmaWVkIGFzIGluZGl2aWR1YWwgYXJndW1lbnRzIG9yIGFzIGFycmF5cyBvZiBwcm9wZXJ0eVxuICAgKiBuYW1lcy4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yIGVhY2ggcHJvcGVydHkgaW4gdGhlXG4gICAqIGBvYmplY3RgLCBwaWNraW5nIHRoZSBwcm9wZXJ0aWVzIGBjYWxsYmFja2AgcmV0dXJucyB0cnV0aHkgZm9yLiBUaGUgYGNhbGxiYWNrYFxuICAgKiBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwga2V5LCBvYmplY3QpLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBPYmplY3RzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIHNvdXJjZSBvYmplY3QuXG4gICAqIEBwYXJhbSB7QXJyYXl8RnVuY3Rpb258U3RyaW5nfSBjYWxsYmFja3xbcHJvcDEsIHByb3AyLCAuLi5dIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICogIHBlciBpdGVyYXRpb24gb3IgcHJvcGVydGllcyB0byBwaWNrLCBlaXRoZXIgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXJyYXlzLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBwaWNrZWQgcHJvcGVydGllcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5waWNrKHsgJ25hbWUnOiAnbW9lJywgJ191c2VyaWQnOiAnbW9lMScgfSwgJ25hbWUnKTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdtb2UnIH1cbiAgICpcbiAgICogXy5waWNrKHsgJ25hbWUnOiAnbW9lJywgJ191c2VyaWQnOiAnbW9lMScgfSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgKiAgIHJldHVybiBrZXkuY2hhckF0KDApICE9ICdfJztcbiAgICogfSk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnbW9lJyB9XG4gICAqL1xuICBmdW5jdGlvbiBwaWNrKG9iamVjdCwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSB7XG4gICAgICB2YXIgaW5kZXggPSAwLFxuICAgICAgICAgIHByb3BzID0gY29uY2F0LmFwcGx5KGFycmF5UmVmLCBhcmd1bWVudHMpLFxuICAgICAgICAgIGxlbmd0aCA9IGlzT2JqZWN0KG9iamVjdCkgPyBwcm9wcy5sZW5ndGggOiAwO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgICAgICBpZiAoa2V5IGluIG9iamVjdCkge1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gb2JqZWN0W2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xuICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGtleSwgb2JqZWN0KSkge1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgY29tcG9zZWQgb2YgdGhlIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IHZhbHVlcyBvZiBgb2JqZWN0YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHByb3BlcnR5IHZhbHVlcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy52YWx1ZXMoeyAnb25lJzogMSwgJ3R3byc6IDIsICd0aHJlZSc6IDMgfSk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKi9cbiAgZnVuY3Rpb24gdmFsdWVzKG9iamVjdCkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBwcm9wcyA9IGtleXMob2JqZWN0KSxcbiAgICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxuICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBvYmplY3RbcHJvcHNbaW5kZXhdXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIGVsZW1lbnRzIGZyb20gdGhlIHNwZWNpZmllZCBpbmRleGVzLCBvciBrZXlzLCBvZiB0aGVcbiAgICogYGNvbGxlY3Rpb25gLiBJbmRleGVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzXG4gICAqIG9mIGluZGV4ZXMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7QXJyYXl8TnVtYmVyfFN0cmluZ30gW2luZGV4MSwgaW5kZXgyLCAuLi5dIFRoZSBpbmRleGVzIG9mXG4gICAqICBgY29sbGVjdGlvbmAgdG8gcmV0cmlldmUsIGVpdGhlciBhcyBpbmRpdmlkdWFsIGFyZ3VtZW50cyBvciBhcnJheXMuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBlbGVtZW50cyBjb3JyZXNwb25kaW5nIHRvIHRoZVxuICAgKiAgcHJvdmlkZWQgaW5kZXhlcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5hdChbJ2EnLCAnYicsICdjJywgJ2QnLCAnZSddLCBbMCwgMiwgNF0pO1xuICAgKiAvLyA9PiBbJ2EnLCAnYycsICdlJ11cbiAgICpcbiAgICogXy5hdChbJ21vZScsICdsYXJyeScsICdjdXJseSddLCAwLCAyKTtcbiAgICogLy8gPT4gWydtb2UnLCAnY3VybHknXVxuICAgKi9cbiAgZnVuY3Rpb24gYXQoY29sbGVjdGlvbikge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBwcm9wcyA9IGNvbmNhdC5hcHBseShhcnJheVJlZiwgc2xpY2UoYXJndW1lbnRzLCAxKSksXG4gICAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBjb2xsZWN0aW9uW3Byb3BzW2luZGV4XV07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gYHRhcmdldGAgZWxlbWVudCBpcyBwcmVzZW50IGluIGEgYGNvbGxlY3Rpb25gIHVzaW5nIHN0cmljdFxuICAgKiBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuIElmIGBmcm9tSW5kZXhgIGlzIG5lZ2F0aXZlLCBpdCBpcyB1c2VkXG4gICAqIGFzIHRoZSBvZmZzZXQgZnJvbSB0aGUgZW5kIG9mIHRoZSBjb2xsZWN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBhbGlhcyBpbmNsdWRlXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge01peGVkfSB0YXJnZXQgVGhlIHZhbHVlIHRvIGNoZWNrIGZvci5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtmcm9tSW5kZXg9MF0gVGhlIGluZGV4IHRvIHNlYXJjaCBmcm9tLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB0YXJnZXRgIGVsZW1lbnQgaXMgZm91bmQsIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5jb250YWlucyhbMSwgMiwgM10sIDEpO1xuICAgKiAvLyA9PiB0cnVlXG4gICAqXG4gICAqIF8uY29udGFpbnMoWzEsIDIsIDNdLCAxLCAyKTtcbiAgICogLy8gPT4gZmFsc2VcbiAgICpcbiAgICogXy5jb250YWlucyh7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LCAnbW9lJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogXy5jb250YWlucygnY3VybHknLCAndXInKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gY29udGFpbnMoY29sbGVjdGlvbiwgdGFyZ2V0LCBmcm9tSW5kZXgpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCxcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG5cbiAgICBmcm9tSW5kZXggPSAoZnJvbUluZGV4IDwgMCA/IG5hdGl2ZU1heCgwLCBsZW5ndGggKyBmcm9tSW5kZXgpIDogZnJvbUluZGV4KSB8fCAwO1xuICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICByZXN1bHQgPSAoaXNTdHJpbmcoY29sbGVjdGlvbilcbiAgICAgICAgPyBjb2xsZWN0aW9uLmluZGV4T2YodGFyZ2V0LCBmcm9tSW5kZXgpXG4gICAgICAgIDogaW5kZXhPZihjb2xsZWN0aW9uLCB0YXJnZXQsIGZyb21JbmRleClcbiAgICAgICkgPiAtMTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAoKytpbmRleCA+PSBmcm9tSW5kZXgpIHtcbiAgICAgICAgICByZXR1cm4gIShyZXN1bHQgPSB2YWx1ZSA9PT0gdGFyZ2V0KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgb2Yga2V5cyByZXR1cm5lZCBmcm9tIHJ1bm5pbmcgZWFjaCBlbGVtZW50IG9mIHRoZVxuICAgKiBgY29sbGVjdGlvbmAgdGhyb3VnaCB0aGUgZ2l2ZW4gYGNhbGxiYWNrYC4gVGhlIGNvcnJlc3BvbmRpbmcgdmFsdWUgb2YgZWFjaCBrZXlcbiAgICogaXMgdGhlIG51bWJlciBvZiB0aW1lcyB0aGUga2V5IHdhcyByZXR1cm5lZCBieSB0aGUgYGNhbGxiYWNrYC4gVGhlIGBjYWxsYmFja2BcbiAgICogaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fFN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlclxuICAgKiAgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHBhc3NlZCwgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZVxuICAgKiAgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGNvbXBvc2VkIGFnZ3JlZ2F0ZSBvYmplY3QuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uY291bnRCeShbNC4zLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gTWF0aC5mbG9vcihudW0pOyB9KTtcbiAgICogLy8gPT4geyAnNCc6IDEsICc2JzogMiB9XG4gICAqXG4gICAqIF8uY291bnRCeShbNC4zLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4geyAnNCc6IDEsICc2JzogMiB9XG4gICAqXG4gICAqIF8uY291bnRCeShbJ29uZScsICd0d28nLCAndGhyZWUnXSwgJ2xlbmd0aCcpO1xuICAgKiAvLyA9PiB7ICczJzogMiwgJzUnOiAxIH1cbiAgICovXG4gIGZ1bmN0aW9uIGNvdW50QnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG5cbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pIHtcbiAgICAgIGtleSA9IGNhbGxiYWNrKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pICsgJyc7XG4gICAgICAoaGFzT3duUHJvcGVydHkuY2FsbChyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSsrIDogcmVzdWx0W2tleV0gPSAxKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrcyBpZiB0aGUgYGNhbGxiYWNrYCByZXR1cm5zIGEgdHJ1dGh5IHZhbHVlIGZvciAqKmFsbCoqIGVsZW1lbnRzIG9mIGFcbiAgICogYGNvbGxlY3Rpb25gLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxuICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGV0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAqIGVsc2UgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgYWxsXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxTdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcbiAgICogIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGVcbiAgICogIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYWxsIGVsZW1lbnRzIHBhc3MgdGhlIGNhbGxiYWNrIGNoZWNrLFxuICAgKiAgZWxzZSBgZmFsc2VgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmV2ZXJ5KFt0cnVlLCAxLCBudWxsLCAneWVzJ10sIEJvb2xlYW4pO1xuICAgKiAvLyA9PiBmYWxzZVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfVxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5ldmVyeShzdG9vZ2VzLCAnYWdlJyk7XG4gICAqIC8vID0+IHRydWVcbiAgICpcbiAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAqIF8uZXZlcnkoc3Rvb2dlcywgeyAnYWdlJzogNTAgfSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBldmVyeShjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQgPSB0cnVlO1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuXG4gICAgaWYgKGlzQXJyYXkoY29sbGVjdGlvbikpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICBpZiAoIShyZXN1bHQgPSAhIWNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbikpKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIChyZXN1bHQgPSAhIWNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogRXhhbWluZXMgZWFjaCBlbGVtZW50IGluIGEgYGNvbGxlY3Rpb25gLCByZXR1cm5pbmcgYW4gYXJyYXkgb2YgYWxsIGVsZW1lbnRzXG4gICAqIHRoZSBgY2FsbGJhY2tgIHJldHVybnMgdHJ1dGh5IGZvci4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZFxuICAgKiBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIHNlbGVjdFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8U3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlXG4gICAqICBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGVsZW1lbnRzIHRoYXQgcGFzc2VkIHRoZSBjYWxsYmFjayBjaGVjay5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGV2ZW5zID0gXy5maWx0ZXIoWzEsIDIsIDMsIDQsIDUsIDZdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAlIDIgPT0gMDsgfSk7XG4gICAqIC8vID0+IFsyLCA0LCA2XVxuICAgKlxuICAgKiB2YXIgZm9vZCA9IFtcbiAgICogICB7ICduYW1lJzogJ2FwcGxlJywgICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ2ZydWl0JyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY2Fycm90JywgJ29yZ2FuaWMnOiB0cnVlLCAgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLmZpbHRlcihmb29kLCAnb3JnYW5pYycpO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdjYXJyb3QnLCAnb3JnYW5pYyc6IHRydWUsICd0eXBlJzogJ3ZlZ2V0YWJsZScgfV1cbiAgICpcbiAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAqIF8uZmlsdGVyKGZvb2QsIHsgJ3R5cGUnOiAnZnJ1aXQnIH0pO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdhcHBsZScsICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ2ZydWl0JyB9XVxuICAgKi9cbiAgZnVuY3Rpb24gZmlsdGVyKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuXG4gICAgaWYgKGlzQXJyYXkoY29sbGVjdGlvbikpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xuXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBjb2xsZWN0aW9uW2luZGV4XTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4YW1pbmVzIGVhY2ggZWxlbWVudCBpbiBhIGBjb2xsZWN0aW9uYCwgcmV0dXJuaW5nIHRoZSBmaXJzdCB0aGF0IHRoZSBgY2FsbGJhY2tgXG4gICAqIHJldHVybnMgdHJ1dGh5IGZvci4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGRldGVjdFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8U3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlXG4gICAqICBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBlbGVtZW50IHRoYXQgcGFzc2VkIHRoZSBjYWxsYmFjayBjaGVjayxcbiAgICogIGVsc2UgYHVuZGVmaW5lZGAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBldmVuID0gXy5maW5kKFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xuICAgKiAvLyA9PiAyXG4gICAqXG4gICAqIHZhciBmb29kID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnYXBwbGUnLCAgJ29yZ2FuaWMnOiBmYWxzZSwgJ3R5cGUnOiAnZnJ1aXQnIH0sXG4gICAqICAgeyAnbmFtZSc6ICdiYW5hbmEnLCAnb3JnYW5pYyc6IHRydWUsICAndHlwZSc6ICdmcnVpdCcgfSxcbiAgICogICB7ICduYW1lJzogJ2JlZXQnLCAgICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ3ZlZ2V0YWJsZScgfSxcbiAgICogICB7ICduYW1lJzogJ2NhcnJvdCcsICdvcmdhbmljJzogdHJ1ZSwgICd0eXBlJzogJ3ZlZ2V0YWJsZScgfVxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogdmFyIHZlZ2dpZSA9IF8uZmluZChmb29kLCB7ICd0eXBlJzogJ3ZlZ2V0YWJsZScgfSk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnYmVldCcsICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ3ZlZ2V0YWJsZScgfVxuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogdmFyIGhlYWx0aHkgPSBfLmZpbmQoZm9vZCwgJ29yZ2FuaWMnKTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdiYW5hbmEnLCAnb3JnYW5pYyc6IHRydWUsICd0eXBlJzogJ2ZydWl0JyB9XG4gICAqL1xuICBmdW5jdGlvbiBmaW5kKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSkge1xuICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogSXRlcmF0ZXMgb3ZlciBhIGBjb2xsZWN0aW9uYCwgZXhlY3V0aW5nIHRoZSBgY2FsbGJhY2tgIGZvciBlYWNoIGVsZW1lbnQgaW5cbiAgICogdGhlIGBjb2xsZWN0aW9uYC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuIENhbGxiYWNrcyBtYXkgZXhpdCBpdGVyYXRpb24gZWFybHlcbiAgICogYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgZWFjaFxuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fE9iamVjdHxTdHJpbmd9IFJldHVybnMgYGNvbGxlY3Rpb25gLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfKFsxLCAyLCAzXSkuZm9yRWFjaChhbGVydCkuam9pbignLCcpO1xuICAgKiAvLyA9PiBhbGVydHMgZWFjaCBudW1iZXIgYW5kIHJldHVybnMgJzEsMiwzJ1xuICAgKlxuICAgKiBfLmZvckVhY2goeyAnb25lJzogMSwgJ3R3byc6IDIsICd0aHJlZSc6IDMgfSwgYWxlcnQpO1xuICAgKiAvLyA9PiBhbGVydHMgZWFjaCBudW1iZXIgdmFsdWUgKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKi9cbiAgZnVuY3Rpb24gZm9yRWFjaChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGlmIChjYWxsYmFjayAmJiB0eXBlb2YgdGhpc0FyZyA9PSAndW5kZWZpbmVkJyAmJiBpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbikgPT09IGZhbHNlKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWFjaChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgfVxuICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIGtleXMgcmV0dXJuZWQgZnJvbSBydW5uaW5nIGVhY2ggZWxlbWVudCBvZiB0aGVcbiAgICogYGNvbGxlY3Rpb25gIHRocm91Z2ggdGhlIGBjYWxsYmFja2AuIFRoZSBjb3JyZXNwb25kaW5nIHZhbHVlIG9mIGVhY2gga2V5IGlzXG4gICAqIGFuIGFycmF5IG9mIGVsZW1lbnRzIHBhc3NlZCB0byBgY2FsbGJhY2tgIHRoYXQgcmV0dXJuZWQgdGhlIGtleS4gVGhlIGBjYWxsYmFja2BcbiAgICogaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWBcbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8U3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlXG4gICAqICBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY29tcG9zZWQgYWdncmVnYXRlIG9iamVjdC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5ncm91cEJ5KFs0LjIsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLmZsb29yKG51bSk7IH0pO1xuICAgKiAvLyA9PiB7ICc0JzogWzQuMl0sICc2JzogWzYuMSwgNi40XSB9XG4gICAqXG4gICAqIF8uZ3JvdXBCeShbNC4yLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4geyAnNCc6IFs0LjJdLCAnNic6IFs2LjEsIDYuNF0gfVxuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5ncm91cEJ5KFsnb25lJywgJ3R3bycsICd0aHJlZSddLCAnbGVuZ3RoJyk7XG4gICAqIC8vID0+IHsgJzMnOiBbJ29uZScsICd0d28nXSwgJzUnOiBbJ3RocmVlJ10gfVxuICAgKi9cbiAgZnVuY3Rpb24gZ3JvdXBCeShjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGtleSwgY29sbGVjdGlvbikge1xuICAgICAga2V5ID0gY2FsbGJhY2sodmFsdWUsIGtleSwgY29sbGVjdGlvbikgKyAnJztcbiAgICAgIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldIDogcmVzdWx0W2tleV0gPSBbXSkucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBtZXRob2QgbmFtZWQgYnkgYG1ldGhvZE5hbWVgIG9uIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gLFxuICAgKiByZXR1cm5pbmcgYW4gYXJyYXkgb2YgdGhlIHJlc3VsdHMgb2YgZWFjaCBpbnZva2VkIG1ldGhvZC4gQWRkaXRpb25hbCBhcmd1bWVudHNcbiAgICogd2lsbCBiZSBwYXNzZWQgdG8gZWFjaCBpbnZva2VkIG1ldGhvZC4gSWYgYG1ldGhvZE5hbWVgIGlzIGEgZnVuY3Rpb24sIGl0IHdpbGxcbiAgICogYmUgaW52b2tlZCBmb3IsIGFuZCBgdGhpc2AgYm91bmQgdG8sIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gbWV0aG9kTmFtZSBUaGUgbmFtZSBvZiB0aGUgbWV0aG9kIHRvIGludm9rZSBvclxuICAgKiAgdGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAgICogQHBhcmFtIHtNaXhlZH0gW2FyZzEsIGFyZzIsIC4uLl0gQXJndW1lbnRzIHRvIGludm9rZSB0aGUgbWV0aG9kIHdpdGguXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGludm9rZWQgbWV0aG9kLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmludm9rZShbWzUsIDEsIDddLCBbMywgMiwgMV1dLCAnc29ydCcpO1xuICAgKiAvLyA9PiBbWzEsIDUsIDddLCBbMSwgMiwgM11dXG4gICAqXG4gICAqIF8uaW52b2tlKFsxMjMsIDQ1Nl0sIFN0cmluZy5wcm90b3R5cGUuc3BsaXQsICcnKTtcbiAgICogLy8gPT4gW1snMScsICcyJywgJzMnXSwgWyc0JywgJzUnLCAnNiddXVxuICAgKi9cbiAgZnVuY3Rpb24gaW52b2tlKGNvbGxlY3Rpb24sIG1ldGhvZE5hbWUpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMiksXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGlzRnVuYyA9IHR5cGVvZiBtZXRob2ROYW1lID09ICdmdW5jdGlvbicsXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiAwKTtcblxuICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJlc3VsdFsrK2luZGV4XSA9IChpc0Z1bmMgPyBtZXRob2ROYW1lIDogdmFsdWVbbWV0aG9kTmFtZV0pLmFwcGx5KHZhbHVlLCBhcmdzKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdmFsdWVzIGJ5IHJ1bm5pbmcgZWFjaCBlbGVtZW50IGluIHRoZSBgY29sbGVjdGlvbmBcbiAgICogdGhyb3VnaCB0aGUgYGNhbGxiYWNrYC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGhcbiAgICogdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGNvbGxlY3RcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fFN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlclxuICAgKiAgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHBhc3NlZCwgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZVxuICAgKiAgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLm1hcChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICogMzsgfSk7XG4gICAqIC8vID0+IFszLCA2LCA5XVxuICAgKlxuICAgKiBfLm1hcCh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9LCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAqIDM7IH0pO1xuICAgKiAvLyA9PiBbMywgNiwgOV0gKG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfVxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5tYXAoc3Rvb2dlcywgJ25hbWUnKTtcbiAgICogLy8gPT4gWydtb2UnLCAnbGFycnknXVxuICAgKi9cbiAgZnVuY3Rpb24gbWFwKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiAwKTtcblxuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgIGlmIChpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICByZXN1bHRbaW5kZXhdID0gY2FsbGJhY2soY29sbGVjdGlvbltpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJlc3VsdFsrK2luZGV4XSA9IGNhbGxiYWNrKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBtYXhpbXVtIHZhbHVlIG9mIGFuIGBhcnJheWAuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLFxuICAgKiBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBlYWNoIHZhbHVlIGluIHRoZSBgYXJyYXlgIHRvIGdlbmVyYXRlIHRoZVxuICAgKiBjcml0ZXJpb24gYnkgd2hpY2ggdGhlIHZhbHVlIGlzIHJhbmtlZC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG9cbiAgICogYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGV0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAqIGVsc2UgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8U3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlXG4gICAqICBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge01peGVkfSBSZXR1cm5zIHRoZSBtYXhpbXVtIHZhbHVlLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLm1heChbNCwgMiwgOCwgNl0pO1xuICAgKiAvLyA9PiA4XG4gICAqXG4gICAqIHZhciBzdG9vZ2VzID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnbW9lJywgJ2FnZSc6IDQwIH0sXG4gICAqICAgeyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9XG4gICAqIF07XG4gICAqXG4gICAqIF8ubWF4KHN0b29nZXMsIGZ1bmN0aW9uKHN0b29nZSkgeyByZXR1cm4gc3Rvb2dlLmFnZTsgfSk7XG4gICAqIC8vID0+IHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfTtcbiAgICpcbiAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAqIF8ubWF4KHN0b29nZXMsICdhZ2UnKTtcbiAgICogLy8gPT4geyAnbmFtZSc6ICdsYXJyeScsICdhZ2UnOiA1MCB9O1xuICAgKi9cbiAgZnVuY3Rpb24gbWF4KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcblxuICAgIGlmICghY2FsbGJhY2sgJiYgaXNBcnJheShjb2xsZWN0aW9uKSkge1xuICAgICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbi5sZW5ndGg7XG5cbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGNvbGxlY3Rpb25baW5kZXhdO1xuICAgICAgICBpZiAodmFsdWUgPiByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayA9ICFjYWxsYmFjayAmJiBpc1N0cmluZyhjb2xsZWN0aW9uKVxuICAgICAgICA/IGNoYXJBdENhbGxiYWNrXG4gICAgICAgIDogY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuXG4gICAgICBlYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICB2YXIgY3VycmVudCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICAgIGlmIChjdXJyZW50ID4gY29tcHV0ZWQpIHtcbiAgICAgICAgICBjb21wdXRlZCA9IGN1cnJlbnQ7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBhbiBgYXJyYXlgLiBJZiBgY2FsbGJhY2tgIGlzIHBhc3NlZCxcbiAgICogaXQgd2lsbCBiZSBleGVjdXRlZCBmb3IgZWFjaCB2YWx1ZSBpbiB0aGUgYGFycmF5YCB0byBnZW5lcmF0ZSB0aGVcbiAgICogY3JpdGVyaW9uIGJ5IHdoaWNoIHRoZSB2YWx1ZSBpcyByYW5rZWQuIFRoZSBgY2FsbGJhY2tgIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxuICAgKiBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fFN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlclxuICAgKiAgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHBhc3NlZCwgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZVxuICAgKiAgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgbWluaW11bSB2YWx1ZS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5taW4oWzQsIDIsIDgsIDZdKTtcbiAgICogLy8gPT4gMlxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLm1pbihzdG9vZ2VzLCBmdW5jdGlvbihzdG9vZ2UpIHsgcmV0dXJuIHN0b29nZS5hZ2U7IH0pO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9O1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5taW4oc3Rvb2dlcywgJ2FnZScpO1xuICAgKiAvLyA9PiB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9O1xuICAgKi9cbiAgZnVuY3Rpb24gbWluKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gSW5maW5pdHksXG4gICAgICAgIHJlc3VsdCA9IGNvbXB1dGVkO1xuXG4gICAgaWYgKCFjYWxsYmFjayAmJiBpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgIGlmICh2YWx1ZSA8IHJlc3VsdCkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrID0gIWNhbGxiYWNrICYmIGlzU3RyaW5nKGNvbGxlY3Rpb24pXG4gICAgICAgID8gY2hhckF0Q2FsbGJhY2tcbiAgICAgICAgOiBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG5cbiAgICAgIGVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgICAgaWYgKGN1cnJlbnQgPCBjb21wdXRlZCkge1xuICAgICAgICAgIGNvbXB1dGVkID0gY3VycmVudDtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSB2YWx1ZSBvZiBhIHNwZWNpZmllZCBwcm9wZXJ0eSBmcm9tIGFsbCBlbGVtZW50cyBpbiB0aGUgYGNvbGxlY3Rpb25gLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgVGhlIHByb3BlcnR5IHRvIHBsdWNrLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgcHJvcGVydHkgdmFsdWVzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLnBsdWNrKHN0b29nZXMsICduYW1lJyk7XG4gICAqIC8vID0+IFsnbW9lJywgJ2xhcnJ5J11cbiAgICovXG4gIHZhciBwbHVjayA9IG1hcDtcblxuICAvKipcbiAgICogUmVkdWNlcyBhIGBjb2xsZWN0aW9uYCB0byBhIHZhbHVlIHRoYXQgaXMgdGhlIGFjY3VtdWxhdGVkIHJlc3VsdCBvZiBydW5uaW5nXG4gICAqIGVhY2ggZWxlbWVudCBpbiB0aGUgYGNvbGxlY3Rpb25gIHRocm91Z2ggdGhlIGBjYWxsYmFja2AsIHdoZXJlIGVhY2ggc3VjY2Vzc2l2ZVxuICAgKiBgY2FsbGJhY2tgIGV4ZWN1dGlvbiBjb25zdW1lcyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBwcmV2aW91cyBleGVjdXRpb24uXG4gICAqIElmIGBhY2N1bXVsYXRvcmAgaXMgbm90IHBhc3NlZCwgdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGBjb2xsZWN0aW9uYCB3aWxsIGJlXG4gICAqIHVzZWQgYXMgdGhlIGluaXRpYWwgYGFjY3VtdWxhdG9yYCB2YWx1ZS4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgXG4gICAqIGFuZCBpbnZva2VkIHdpdGggZm91ciBhcmd1bWVudHM7IChhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGZvbGRsLCBpbmplY3RcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYWNjdW11bGF0b3JdIEluaXRpYWwgdmFsdWUgb2YgdGhlIGFjY3VtdWxhdG9yLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBzdW0gPSBfLnJlZHVjZShbMSwgMiwgM10sIGZ1bmN0aW9uKHN1bSwgbnVtKSB7XG4gICAqICAgcmV0dXJuIHN1bSArIG51bTtcbiAgICogfSk7XG4gICAqIC8vID0+IDZcbiAgICpcbiAgICogdmFyIG1hcHBlZCA9IF8ucmVkdWNlKHsgJ2EnOiAxLCAnYic6IDIsICdjJzogMyB9LCBmdW5jdGlvbihyZXN1bHQsIG51bSwga2V5KSB7XG4gICAqICAgcmVzdWx0W2tleV0gPSBudW0gKiAzO1xuICAgKiAgIHJldHVybiByZXN1bHQ7XG4gICAqIH0sIHt9KTtcbiAgICogLy8gPT4geyAnYSc6IDMsICdiJzogNiwgJ2MnOiA5IH1cbiAgICovXG4gIGZ1bmN0aW9uIHJlZHVjZShjb2xsZWN0aW9uLCBjYWxsYmFjaywgYWNjdW11bGF0b3IsIHRoaXNBcmcpIHtcbiAgICB2YXIgbm9hY2N1bSA9IGFyZ3VtZW50cy5sZW5ndGggPCAzO1xuICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDQpO1xuXG4gICAgaWYgKGlzQXJyYXkoY29sbGVjdGlvbikpIHtcbiAgICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xuXG4gICAgICBpZiAobm9hY2N1bSkge1xuICAgICAgICBhY2N1bXVsYXRvciA9IGNvbGxlY3Rpb25bKytpbmRleF07XG4gICAgICB9XG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICBhY2N1bXVsYXRvciA9IGNhbGxiYWNrKGFjY3VtdWxhdG9yLCBjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICBhY2N1bXVsYXRvciA9IG5vYWNjdW1cbiAgICAgICAgICA/IChub2FjY3VtID0gZmFsc2UsIHZhbHVlKVxuICAgICAgICAgIDogY2FsbGJhY2soYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbilcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gYWNjdW11bGF0b3I7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgaXMgc2ltaWxhciB0byBgXy5yZWR1Y2VgLCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIGFcbiAgICogYGNvbGxlY3Rpb25gIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgZm9sZHJcbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYWNjdW11bGF0b3JdIEluaXRpYWwgdmFsdWUgb2YgdGhlIGFjY3VtdWxhdG9yLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBsaXN0ID0gW1swLCAxXSwgWzIsIDNdLCBbNCwgNV1dO1xuICAgKiB2YXIgZmxhdCA9IF8ucmVkdWNlUmlnaHQobGlzdCwgZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYS5jb25jYXQoYik7IH0sIFtdKTtcbiAgICogLy8gPT4gWzQsIDUsIDIsIDMsIDAsIDFdXG4gICAqL1xuICBmdW5jdGlvbiByZWR1Y2VSaWdodChjb2xsZWN0aW9uLCBjYWxsYmFjaywgYWNjdW11bGF0b3IsIHRoaXNBcmcpIHtcbiAgICB2YXIgaXRlcmFibGUgPSBjb2xsZWN0aW9uLFxuICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwLFxuICAgICAgICBub2FjY3VtID0gYXJndW1lbnRzLmxlbmd0aCA8IDM7XG5cbiAgICBpZiAodHlwZW9mIGxlbmd0aCAhPSAnbnVtYmVyJykge1xuICAgICAgdmFyIHByb3BzID0ga2V5cyhjb2xsZWN0aW9uKTtcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcbiAgICB9XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgNCk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIGluZGV4ID0gcHJvcHMgPyBwcm9wc1stLWxlbmd0aF0gOiAtLWxlbmd0aDtcbiAgICAgIGFjY3VtdWxhdG9yID0gbm9hY2N1bVxuICAgICAgICA/IChub2FjY3VtID0gZmFsc2UsIGl0ZXJhYmxlW2luZGV4XSlcbiAgICAgICAgOiBjYWxsYmFjayhhY2N1bXVsYXRvciwgaXRlcmFibGVbaW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBvcHBvc2l0ZSBvZiBgXy5maWx0ZXJgLCB0aGlzIG1ldGhvZCByZXR1cm5zIHRoZSBlbGVtZW50cyBvZiBhXG4gICAqIGBjb2xsZWN0aW9uYCB0aGF0IGBjYWxsYmFja2AgZG9lcyAqKm5vdCoqIHJldHVybiB0cnV0aHkgZm9yLlxuICAgKlxuICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAqXG4gICAqIElmIGFuIG9iamVjdCBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXG4gICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcbiAgICogZWxzZSBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxTdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcbiAgICogIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGVcbiAgICogIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBkaWQgKipub3QqKiBwYXNzIHRoZVxuICAgKiAgY2FsbGJhY2sgY2hlY2suXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBvZGRzID0gXy5yZWplY3QoWzEsIDIsIDMsIDQsIDUsIDZdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAlIDIgPT0gMDsgfSk7XG4gICAqIC8vID0+IFsxLCAzLCA1XVxuICAgKlxuICAgKiB2YXIgZm9vZCA9IFtcbiAgICogICB7ICduYW1lJzogJ2FwcGxlJywgICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ2ZydWl0JyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY2Fycm90JywgJ29yZ2FuaWMnOiB0cnVlLCAgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLnJlamVjdChmb29kLCAnb3JnYW5pYycpO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdhcHBsZScsICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ2ZydWl0JyB9XVxuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5yZWplY3QoZm9vZCwgeyAndHlwZSc6ICdmcnVpdCcgfSk7XG4gICAqIC8vID0+IFt7ICduYW1lJzogJ2NhcnJvdCcsICdvcmdhbmljJzogdHJ1ZSwgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XVxuICAgKi9cbiAgZnVuY3Rpb24gcmVqZWN0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgcmV0dXJuIGZpbHRlcihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJldHVybiAhY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIHNodWZmbGVkIGBhcnJheWAgdmFsdWVzLCB1c2luZyBhIHZlcnNpb24gb2YgdGhlXG4gICAqIEZpc2hlci1ZYXRlcyBzaHVmZmxlLiBTZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXItWWF0ZXNfc2h1ZmZsZS5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIHNodWZmbGUuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBzaHVmZmxlZCBjb2xsZWN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnNodWZmbGUoWzEsIDIsIDMsIDQsIDUsIDZdKTtcbiAgICogLy8gPT4gWzQsIDEsIDYsIDMsIDUsIDJdXG4gICAqL1xuICBmdW5jdGlvbiBzaHVmZmxlKGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyA/IGxlbmd0aCA6IDApO1xuXG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIHJhbmQgPSBmbG9vcihuYXRpdmVSYW5kb20oKSAqICgrK2luZGV4ICsgMSkpO1xuICAgICAgcmVzdWx0W2luZGV4XSA9IHJlc3VsdFtyYW5kXTtcbiAgICAgIHJlc3VsdFtyYW5kXSA9IHZhbHVlO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgc2l6ZSBvZiB0aGUgYGNvbGxlY3Rpb25gIGJ5IHJldHVybmluZyBgY29sbGVjdGlvbi5sZW5ndGhgIGZvciBhcnJheXNcbiAgICogYW5kIGFycmF5LWxpa2Ugb2JqZWN0cyBvciB0aGUgbnVtYmVyIG9mIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgZm9yIG9iamVjdHMuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpbnNwZWN0LlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIGBjb2xsZWN0aW9uLmxlbmd0aGAgb3IgbnVtYmVyIG9mIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uc2l6ZShbMSwgMl0pO1xuICAgKiAvLyA9PiAyXG4gICAqXG4gICAqIF8uc2l6ZSh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9KTtcbiAgICogLy8gPT4gM1xuICAgKlxuICAgKiBfLnNpemUoJ2N1cmx5Jyk7XG4gICAqIC8vID0+IDVcbiAgICovXG4gIGZ1bmN0aW9uIHNpemUoY29sbGVjdGlvbikge1xuICAgIHZhciBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xuICAgIHJldHVybiB0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInID8gbGVuZ3RoIDoga2V5cyhjb2xsZWN0aW9uKS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIHRoZSBgY2FsbGJhY2tgIHJldHVybnMgYSB0cnV0aHkgdmFsdWUgZm9yICoqYW55KiogZWxlbWVudCBvZiBhXG4gICAqIGBjb2xsZWN0aW9uYC4gVGhlIGZ1bmN0aW9uIHJldHVybnMgYXMgc29vbiBhcyBpdCBmaW5kcyBwYXNzaW5nIHZhbHVlLCBhbmRcbiAgICogZG9lcyBub3QgaXRlcmF0ZSBvdmVyIHRoZSBlbnRpcmUgYGNvbGxlY3Rpb25gLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0b1xuICAgKiBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cbiAgICpcbiAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGV0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAqIGVsc2UgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgYW55XG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxTdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcbiAgICogIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGVcbiAgICogIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYW55IGVsZW1lbnQgcGFzc2VzIHRoZSBjYWxsYmFjayBjaGVjayxcbiAgICogIGVsc2UgYGZhbHNlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5zb21lKFtudWxsLCAwLCAneWVzJywgZmFsc2VdLCBCb29sZWFuKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiB2YXIgZm9vZCA9IFtcbiAgICogICB7ICduYW1lJzogJ2FwcGxlJywgICdvcmdhbmljJzogZmFsc2UsICd0eXBlJzogJ2ZydWl0JyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY2Fycm90JywgJ29yZ2FuaWMnOiB0cnVlLCAgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLnNvbWUoZm9vZCwgJ29yZ2FuaWMnKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5zb21lKGZvb2QsIHsgJ3R5cGUnOiAnbWVhdCcgfSk7XG4gICAqIC8vID0+IGZhbHNlXG4gICAqL1xuICBmdW5jdGlvbiBzb21lKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcblxuICAgIGlmIChpc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uLmxlbmd0aDtcblxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKChyZXN1bHQgPSBjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiAhKHJlc3VsdCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiAhIXJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIGVsZW1lbnRzLCBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyIGJ5IHRoZSByZXN1bHRzIG9mXG4gICAqIHJ1bm5pbmcgZWFjaCBlbGVtZW50IGluIHRoZSBgY29sbGVjdGlvbmAgdGhyb3VnaCB0aGUgYGNhbGxiYWNrYC4gVGhpcyBtZXRob2RcbiAgICogcGVyZm9ybXMgYSBzdGFibGUgc29ydCwgdGhhdCBpcywgaXQgd2lsbCBwcmVzZXJ2ZSB0aGUgb3JpZ2luYWwgc29ydCBvcmRlciBvZlxuICAgKiBlcXVhbCBlbGVtZW50cy4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcbiAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fFN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlclxuICAgKiAgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHBhc3NlZCwgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZVxuICAgKiAgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBzb3J0ZWQgZWxlbWVudHMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uc29ydEJ5KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLnNpbihudW0pOyB9KTtcbiAgICogLy8gPT4gWzMsIDEsIDJdXG4gICAqXG4gICAqIF8uc29ydEJ5KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLnNpbihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4gWzMsIDEsIDJdXG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLnNvcnRCeShbJ2JhbmFuYScsICdzdHJhd2JlcnJ5JywgJ2FwcGxlJ10sICdsZW5ndGgnKTtcbiAgICogLy8gPT4gWydhcHBsZScsICdiYW5hbmEnLCAnc3RyYXdiZXJyeSddXG4gICAqL1xuICBmdW5jdGlvbiBzb3J0QnkoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCxcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyA/IGxlbmd0aCA6IDApO1xuXG4gICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgZm9yRWFjaChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XG4gICAgICByZXN1bHRbKytpbmRleF0gPSB7XG4gICAgICAgICdjcml0ZXJpYSc6IGNhbGxiYWNrKHZhbHVlLCBrZXksIGNvbGxlY3Rpb24pLFxuICAgICAgICAnaW5kZXgnOiBpbmRleCxcbiAgICAgICAgJ3ZhbHVlJzogdmFsdWVcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBsZW5ndGggPSByZXN1bHQubGVuZ3RoO1xuICAgIHJlc3VsdC5zb3J0KGNvbXBhcmVBc2NlbmRpbmcpO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgcmVzdWx0W2xlbmd0aF0gPSByZXN1bHRbbGVuZ3RoXS52YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgYGNvbGxlY3Rpb25gIHRvIGFuIGFycmF5LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gY29udmVydC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgY29udmVydGVkIGFycmF5LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAoZnVuY3Rpb24oKSB7IHJldHVybiBfLnRvQXJyYXkoYXJndW1lbnRzKS5zbGljZSgxKTsgfSkoMSwgMiwgMywgNCk7XG4gICAqIC8vID0+IFsyLCAzLCA0XVxuICAgKi9cbiAgZnVuY3Rpb24gdG9BcnJheShjb2xsZWN0aW9uKSB7XG4gICAgaWYgKGNvbGxlY3Rpb24gJiYgdHlwZW9mIGNvbGxlY3Rpb24ubGVuZ3RoID09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gIHNsaWNlKGNvbGxlY3Rpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzKGNvbGxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4YW1pbmVzIGVhY2ggZWxlbWVudCBpbiBhIGBjb2xsZWN0aW9uYCwgcmV0dXJuaW5nIGFuIGFycmF5IG9mIGFsbCBlbGVtZW50c1xuICAgKiB0aGF0IGhhdmUgdGhlIGdpdmVuIGBwcm9wZXJ0aWVzYC4gV2hlbiBjaGVja2luZyBgcHJvcGVydGllc2AsIHRoaXMgbWV0aG9kXG4gICAqIHBlcmZvcm1zIGEgZGVlcCBjb21wYXJpc29uIGJldHdlZW4gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZSBlcXVpdmFsZW50XG4gICAqIHRvIGVhY2ggb3RoZXIuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQHR5cGUgRnVuY3Rpb25cbiAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXG4gICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fFN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wZXJ0aWVzIFRoZSBvYmplY3Qgb2YgcHJvcGVydHkgdmFsdWVzIHRvIGZpbHRlciBieS5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgZ2l2ZW4gYHByb3BlcnRpZXNgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgc3Rvb2dlcyA9IFtcbiAgICogICB7ICduYW1lJzogJ21vZScsICdhZ2UnOiA0MCB9LFxuICAgKiAgIHsgJ25hbWUnOiAnbGFycnknLCAnYWdlJzogNTAgfVxuICAgKiBdO1xuICAgKlxuICAgKiBfLndoZXJlKHN0b29nZXMsIHsgJ2FnZSc6IDQwIH0pO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdtb2UnLCAnYWdlJzogNDAgfV1cbiAgICovXG4gIHZhciB3aGVyZSA9IGZpbHRlcjtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSB3aXRoIGFsbCBmYWxzZXkgdmFsdWVzIG9mIGBhcnJheWAgcmVtb3ZlZC4gVGhlIHZhbHVlc1xuICAgKiBgZmFsc2VgLCBgbnVsbGAsIGAwYCwgYFwiXCJgLCBgdW5kZWZpbmVkYCBhbmQgYE5hTmAgYXJlIGFsbCBmYWxzZXkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gY29tcGFjdC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGZpbHRlcmVkIGFycmF5LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmNvbXBhY3QoWzAsIDEsIGZhbHNlLCAyLCAnJywgM10pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBhY3QoYXJyYXkpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgYGFycmF5YCBlbGVtZW50cyBub3QgcHJlc2VudCBpbiB0aGUgb3RoZXIgYXJyYXlzXG4gICAqIHVzaW5nIHN0cmljdCBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcHJvY2Vzcy5cbiAgICogQHBhcmFtIHtBcnJheX0gW2FycmF5MSwgYXJyYXkyLCAuLi5dIEFycmF5cyB0byBjaGVjay5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGBhcnJheWAgZWxlbWVudHMgbm90IHByZXNlbnQgaW4gdGhlXG4gICAqICBvdGhlciBhcnJheXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uZGlmZmVyZW5jZShbMSwgMiwgMywgNCwgNV0sIFs1LCAyLCAxMF0pO1xuICAgKiAvLyA9PiBbMSwgMywgNF1cbiAgICovXG4gIGZ1bmN0aW9uIGRpZmZlcmVuY2UoYXJyYXkpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxuICAgICAgICBmbGF0dGVuZWQgPSBjb25jYXQuYXBwbHkoYXJyYXlSZWYsIGFyZ3VtZW50cyksXG4gICAgICAgIGNvbnRhaW5zID0gY2FjaGVkQ29udGFpbnMoZmxhdHRlbmVkLCBsZW5ndGgpLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICBpZiAoIWNvbnRhaW5zKHZhbHVlKSkge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgZmlyc3QgZWxlbWVudCBvZiB0aGUgYGFycmF5YC4gSWYgYSBudW1iZXIgYG5gIGlzIHBhc3NlZCwgdGhlIGZpcnN0XG4gICAqIGBuYCBlbGVtZW50cyBvZiB0aGUgYGFycmF5YCBhcmUgcmV0dXJuZWQuIElmIGEgYGNhbGxiYWNrYCBmdW5jdGlvbiBpcyBwYXNzZWQsXG4gICAqIHRoZSBmaXJzdCBlbGVtZW50cyB0aGUgYGNhbGxiYWNrYCByZXR1cm5zIHRydXRoeSBmb3IgYXJlIHJldHVybmVkLiBUaGUgYGNhbGxiYWNrYFxuICAgKiBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cbiAgICpcbiAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGV0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAqIGVsc2UgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgaGVhZCwgdGFrZVxuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8TnVtYmVyfFN0cmluZ30gW2NhbGxiYWNrfG5dIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICogIHBlciBlbGVtZW50IG9yIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gcmV0dXJuLiBJZiBhIHByb3BlcnR5IG5hbWUgb3JcbiAgICogIG9iamVjdCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIlxuICAgKiAgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIGZpcnN0IGVsZW1lbnQocykgb2YgYGFycmF5YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5maXJzdChbMSwgMiwgM10pO1xuICAgKiAvLyA9PiAxXG4gICAqXG4gICAqIF8uZmlyc3QoWzEsIDIsIDNdLCAyKTtcbiAgICogLy8gPT4gWzEsIDJdXG4gICAqXG4gICAqIF8uZmlyc3QoWzEsIDIsIDNdLCBmdW5jdGlvbihudW0pIHtcbiAgICogICByZXR1cm4gbnVtIDwgMztcbiAgICogfSk7XG4gICAqIC8vID0+IFsxLCAyXVxuICAgKlxuICAgKiB2YXIgZm9vZCA9IFtcbiAgICogICB7ICduYW1lJzogJ2JhbmFuYScsICdvcmdhbmljJzogdHJ1ZSB9LFxuICAgKiAgIHsgJ25hbWUnOiAnYmVldCcsICAgJ29yZ2FuaWMnOiBmYWxzZSB9LFxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5maXJzdChmb29kLCAnb3JnYW5pYycpO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYW5hbmEnLCAnb3JnYW5pYyc6IHRydWUgfV1cbiAgICpcbiAgICogdmFyIGZvb2QgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdhcHBsZScsICAndHlwZSc6ICdmcnVpdCcgfSxcbiAgICogICB7ICduYW1lJzogJ2JhbmFuYScsICd0eXBlJzogJ2ZydWl0JyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnYmVldCcsICAgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLmZpcnN0KGZvb2QsIHsgJ3R5cGUnOiAnZnJ1aXQnIH0pO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdhcHBsZScsICd0eXBlJzogJ2ZydWl0JyB9LCB7ICduYW1lJzogJ2JhbmFuYScsICd0eXBlJzogJ2ZydWl0JyB9XVxuICAgKi9cbiAgZnVuY3Rpb24gZmlyc3QoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgaWYgKGFycmF5KSB7XG4gICAgICB2YXIgbiA9IDAsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gLTE7XG4gICAgICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCAmJiBjYWxsYmFjayhhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSkpIHtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG4gPSBjYWxsYmFjaztcbiAgICAgICAgaWYgKG4gPT0gbnVsbCB8fCB0aGlzQXJnKSB7XG4gICAgICAgICAgcmV0dXJuIGFycmF5WzBdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gc2xpY2UoYXJyYXksIDAsIG5hdGl2ZU1pbihuYXRpdmVNYXgoMCwgbiksIGxlbmd0aCkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVucyBhIG5lc3RlZCBhcnJheSAodGhlIG5lc3RpbmcgY2FuIGJlIHRvIGFueSBkZXB0aCkuIElmIGBzaGFsbG93YCBpc1xuICAgKiB0cnV0aHksIGBhcnJheWAgd2lsbCBvbmx5IGJlIGZsYXR0ZW5lZCBhIHNpbmdsZSBsZXZlbC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBjb21wYWN0LlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHNoYWxsb3cgQSBmbGFnIHRvIGluZGljYXRlIG9ubHkgZmxhdHRlbmluZyBhIHNpbmdsZSBsZXZlbC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGZsYXR0ZW5lZCBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5mbGF0dGVuKFsxLCBbMl0sIFszLCBbWzRdXV1dKTtcbiAgICogLy8gPT4gWzEsIDIsIDMsIDRdO1xuICAgKlxuICAgKiBfLmZsYXR0ZW4oWzEsIFsyXSwgWzMsIFtbNF1dXV0sIHRydWUpO1xuICAgKiAvLyA9PiBbMSwgMiwgMywgW1s0XV1dO1xuICAgKi9cbiAgZnVuY3Rpb24gZmxhdHRlbihhcnJheSwgc2hhbGxvdykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcblxuICAgICAgLy8gcmVjdXJzaXZlbHkgZmxhdHRlbiBhcnJheXMgKHN1c2NlcHRpYmxlIHRvIGNhbGwgc3RhY2sgbGltaXRzKVxuICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgIHB1c2guYXBwbHkocmVzdWx0LCBzaGFsbG93ID8gdmFsdWUgOiBmbGF0dGVuKHZhbHVlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgaW5kZXggYXQgd2hpY2ggdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYHZhbHVlYCBpcyBmb3VuZCB1c2luZ1xuICAgKiBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLiBJZiB0aGUgYGFycmF5YCBpcyBhbHJlYWR5XG4gICAqIHNvcnRlZCwgcGFzc2luZyBgdHJ1ZWAgZm9yIGBmcm9tSW5kZXhgIHdpbGwgcnVuIGEgZmFzdGVyIGJpbmFyeSBzZWFyY2guXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAgICogQHBhcmFtIHtCb29sZWFufE51bWJlcn0gW2Zyb21JbmRleD0wXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20gb3IgYHRydWVgIHRvXG4gICAqICBwZXJmb3JtIGEgYmluYXJ5IHNlYXJjaCBvbiBhIHNvcnRlZCBgYXJyYXlgLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgbWF0Y2hlZCB2YWx1ZSBvciBgLTFgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyKTtcbiAgICogLy8gPT4gMVxuICAgKlxuICAgKiBfLmluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyLCAzKTtcbiAgICogLy8gPT4gNFxuICAgKlxuICAgKiBfLmluZGV4T2YoWzEsIDEsIDIsIDIsIDMsIDNdLCAyLCB0cnVlKTtcbiAgICogLy8gPT4gMlxuICAgKi9cbiAgZnVuY3Rpb24gaW5kZXhPZihhcnJheSwgdmFsdWUsIGZyb21JbmRleCkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG5cbiAgICBpZiAodHlwZW9mIGZyb21JbmRleCA9PSAnbnVtYmVyJykge1xuICAgICAgaW5kZXggPSAoZnJvbUluZGV4IDwgMCA/IG5hdGl2ZU1heCgwLCBsZW5ndGggKyBmcm9tSW5kZXgpIDogZnJvbUluZGV4IHx8IDApIC0gMTtcbiAgICB9IGVsc2UgaWYgKGZyb21JbmRleCkge1xuICAgICAgaW5kZXggPSBzb3J0ZWRJbmRleChhcnJheSwgdmFsdWUpO1xuICAgICAgcmV0dXJuIGFycmF5W2luZGV4XSA9PT0gdmFsdWUgPyBpbmRleCA6IC0xO1xuICAgIH1cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgaWYgKGFycmF5W2luZGV4XSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhbGwgYnV0IHRoZSBsYXN0IGVsZW1lbnQgb2YgYGFycmF5YC4gSWYgYSBudW1iZXIgYG5gIGlzIHBhc3NlZCwgdGhlXG4gICAqIGxhc3QgYG5gIGVsZW1lbnRzIGFyZSBleGNsdWRlZCBmcm9tIHRoZSByZXN1bHQuIElmIGEgYGNhbGxiYWNrYCBmdW5jdGlvblxuICAgKiBpcyBwYXNzZWQsIHRoZSBsYXN0IGVsZW1lbnRzIHRoZSBgY2FsbGJhY2tgIHJldHVybnMgdHJ1dGh5IGZvciBhcmUgZXhjbHVkZWRcbiAgICogZnJvbSB0aGUgcmVzdWx0LiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxuICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cbiAgICpcbiAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGV0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAqIGVsc2UgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8TnVtYmVyfFN0cmluZ30gW2NhbGxiYWNrfG49MV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgKiAgcGVyIGVsZW1lbnQgb3IgdGhlIG51bWJlciBvZiBlbGVtZW50cyB0byBleGNsdWRlLiBJZiBhIHByb3BlcnR5IG5hbWUgb3JcbiAgICogIG9iamVjdCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIlxuICAgKiAgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBzbGljZSBvZiBgYXJyYXlgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmluaXRpYWwoWzEsIDIsIDNdKTtcbiAgICogLy8gPT4gWzEsIDJdXG4gICAqXG4gICAqIF8uaW5pdGlhbChbMSwgMiwgM10sIDIpO1xuICAgKiAvLyA9PiBbMV1cbiAgICpcbiAgICogXy5pbml0aWFsKFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7XG4gICAqICAgcmV0dXJuIG51bSA+IDE7XG4gICAqIH0pO1xuICAgKiAvLyA9PiBbMV1cbiAgICpcbiAgICogdmFyIGZvb2QgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdiZWV0JywgICAnb3JnYW5pYyc6IGZhbHNlIH0sXG4gICAqICAgeyAnbmFtZSc6ICdjYXJyb3QnLCAnb3JnYW5pYyc6IHRydWUgfVxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5pbml0aWFsKGZvb2QsICdvcmdhbmljJyk7XG4gICAqIC8vID0+IFt7ICduYW1lJzogJ2JlZXQnLCAgICdvcmdhbmljJzogZmFsc2UgfV1cbiAgICpcbiAgICogdmFyIGZvb2QgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdiYW5hbmEnLCAndHlwZSc6ICdmcnVpdCcgfSxcbiAgICogICB7ICduYW1lJzogJ2JlZXQnLCAgICd0eXBlJzogJ3ZlZ2V0YWJsZScgfSxcbiAgICogICB7ICduYW1lJzogJ2NhcnJvdCcsICd0eXBlJzogJ3ZlZ2V0YWJsZScgfVxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5pbml0aWFsKGZvb2QsIHsgJ3R5cGUnOiAndmVnZXRhYmxlJyB9KTtcbiAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmFuYW5hJywgJ3R5cGUnOiAnZnJ1aXQnIH1dXG4gICAqL1xuICBmdW5jdGlvbiBpbml0aWFsKGFycmF5LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGlmICghYXJyYXkpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgdmFyIG4gPSAwLFxuICAgICAgICBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgIHZhciBpbmRleCA9IGxlbmd0aDtcbiAgICAgIGNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcpO1xuICAgICAgd2hpbGUgKGluZGV4LS0gJiYgY2FsbGJhY2soYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSB7XG4gICAgICAgIG4rKztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbiA9IChjYWxsYmFjayA9PSBudWxsIHx8IHRoaXNBcmcpID8gMSA6IGNhbGxiYWNrIHx8IG47XG4gICAgfVxuICAgIHJldHVybiBzbGljZShhcnJheSwgMCwgbmF0aXZlTWluKG5hdGl2ZU1heCgwLCBsZW5ndGggLSBuKSwgbGVuZ3RoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcHV0ZXMgdGhlIGludGVyc2VjdGlvbiBvZiBhbGwgdGhlIHBhc3NlZC1pbiBhcnJheXMgdXNpbmcgc3RyaWN0IGVxdWFsaXR5XG4gICAqIGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gcHJvY2Vzcy5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHVuaXF1ZSBlbGVtZW50cyB0aGF0IGFyZSBwcmVzZW50XG4gICAqICBpbiAqKmFsbCoqIG9mIHRoZSBhcnJheXMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uaW50ZXJzZWN0aW9uKFsxLCAyLCAzXSwgWzEwMSwgMiwgMSwgMTBdLCBbMiwgMV0pO1xuICAgKiAvLyA9PiBbMSwgMl1cbiAgICovXG4gIGZ1bmN0aW9uIGludGVyc2VjdGlvbihhcnJheSkge1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICBhcmdzTGVuZ3RoID0gYXJncy5sZW5ndGgsXG4gICAgICAgIGNhY2hlID0geyAnMCc6IHt9IH0sXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMCxcbiAgICAgICAgaXNMYXJnZSA9IGxlbmd0aCA+PSAxMDAsXG4gICAgICAgIHJlc3VsdCA9IFtdLFxuICAgICAgICBzZWVuID0gcmVzdWx0O1xuXG4gICAgb3V0ZXI6XG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcbiAgICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICAgIHZhciBrZXkgPSB2YWx1ZSArICcnO1xuICAgICAgICB2YXIgaW5pdGVkID0gaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZVswXSwga2V5KVxuICAgICAgICAgID8gIShzZWVuID0gY2FjaGVbMF1ba2V5XSlcbiAgICAgICAgICA6IChzZWVuID0gY2FjaGVbMF1ba2V5XSA9IFtdKTtcbiAgICAgIH1cbiAgICAgIGlmIChpbml0ZWQgfHwgaW5kZXhPZihzZWVuLCB2YWx1ZSkgPCAwKSB7XG4gICAgICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYXJnc0luZGV4ID0gYXJnc0xlbmd0aDtcbiAgICAgICAgd2hpbGUgKC0tYXJnc0luZGV4KSB7XG4gICAgICAgICAgaWYgKCEoY2FjaGVbYXJnc0luZGV4XSB8fCAoY2FjaGVbYXJnc0luZGV4XSA9IGNhY2hlZENvbnRhaW5zKGFyZ3NbYXJnc0luZGV4XSwgMCwgMTAwKSkpKHZhbHVlKSkge1xuICAgICAgICAgICAgY29udGludWUgb3V0ZXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBsYXN0IGVsZW1lbnQgb2YgdGhlIGBhcnJheWAuIElmIGEgbnVtYmVyIGBuYCBpcyBwYXNzZWQsIHRoZSBsYXN0XG4gICAqIGBuYCBlbGVtZW50cyBvZiB0aGUgYGFycmF5YCBhcmUgcmV0dXJuZWQuIElmIGEgYGNhbGxiYWNrYCBmdW5jdGlvbiBpcyBwYXNzZWQsXG4gICAqIHRoZSBsYXN0IGVsZW1lbnRzIHRoZSBgY2FsbGJhY2tgIHJldHVybnMgdHJ1dGh5IGZvciBhcmUgcmV0dXJuZWQuIFRoZSBgY2FsbGJhY2tgXG4gICAqIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgYXJyYXkpLlxuICAgKlxuICAgKlxuICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAqXG4gICAqIElmIGFuIG9iamVjdCBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXG4gICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcbiAgICogZWxzZSBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxOdW1iZXJ8U3RyaW5nfSBbY2FsbGJhY2t8bl0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxuICAgKiAgcGVyIGVsZW1lbnQgb3IgdGhlIG51bWJlciBvZiBlbGVtZW50cyB0byByZXR1cm4uIElmIGEgcHJvcGVydHkgbmFtZSBvclxuICAgKiAgb2JqZWN0IGlzIHBhc3NlZCwgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiXG4gICAqICBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxuICAgKiBAcGFyYW0ge01peGVkfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgbGFzdCBlbGVtZW50KHMpIG9mIGBhcnJheWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8ubGFzdChbMSwgMiwgM10pO1xuICAgKiAvLyA9PiAzXG4gICAqXG4gICAqIF8ubGFzdChbMSwgMiwgM10sIDIpO1xuICAgKiAvLyA9PiBbMiwgM11cbiAgICpcbiAgICogXy5sYXN0KFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7XG4gICAqICAgcmV0dXJuIG51bSA+IDE7XG4gICAqIH0pO1xuICAgKiAvLyA9PiBbMiwgM11cbiAgICpcbiAgICogdmFyIGZvb2QgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdiZWV0JywgICAnb3JnYW5pYyc6IGZhbHNlIH0sXG4gICAqICAgeyAnbmFtZSc6ICdjYXJyb3QnLCAnb3JnYW5pYyc6IHRydWUgfVxuICAgKiBdO1xuICAgKlxuICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcbiAgICogXy5sYXN0KGZvb2QsICdvcmdhbmljJyk7XG4gICAqIC8vID0+IFt7ICduYW1lJzogJ2NhcnJvdCcsICdvcmdhbmljJzogdHJ1ZSB9XVxuICAgKlxuICAgKiB2YXIgZm9vZCA9IFtcbiAgICogICB7ICduYW1lJzogJ2JhbmFuYScsICd0eXBlJzogJ2ZydWl0JyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnYmVldCcsICAgJ3R5cGUnOiAndmVnZXRhYmxlJyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnY2Fycm90JywgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLmxhc3QoZm9vZCwgeyAndHlwZSc6ICd2ZWdldGFibGUnIH0pO1xuICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiZWV0JywgJ3R5cGUnOiAndmVnZXRhYmxlJyB9LCB7ICduYW1lJzogJ2NhcnJvdCcsICd0eXBlJzogJ3ZlZ2V0YWJsZScgfV1cbiAgICovXG4gIGZ1bmN0aW9uIGxhc3QoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgaWYgKGFycmF5KSB7XG4gICAgICB2YXIgbiA9IDAsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gbGVuZ3RoO1xuICAgICAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICAgICAgd2hpbGUgKGluZGV4LS0gJiYgY2FsbGJhY2soYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSB7XG4gICAgICAgICAgbisrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuID0gY2FsbGJhY2s7XG4gICAgICAgIGlmIChuID09IG51bGwgfHwgdGhpc0FyZykge1xuICAgICAgICAgIHJldHVybiBhcnJheVtsZW5ndGggLSAxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHNsaWNlKGFycmF5LCBuYXRpdmVNYXgoMCwgbGVuZ3RoIC0gbikpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIGB2YWx1ZWAgaXMgZm91bmQgdXNpbmcgc3RyaWN0XG4gICAqIGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgYGZyb21JbmRleGAgaXMgbmVnYXRpdmUsIGl0IGlzIHVzZWRcbiAgICogYXMgdGhlIG9mZnNldCBmcm9tIHRoZSBlbmQgb2YgdGhlIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtmcm9tSW5kZXg9YXJyYXkubGVuZ3RoLTFdIFRoZSBpbmRleCB0byBzZWFyY2ggZnJvbS5cbiAgICogQHJldHVybnMge051bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIG1hdGNoZWQgdmFsdWUgb3IgYC0xYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5sYXN0SW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIpO1xuICAgKiAvLyA9PiA0XG4gICAqXG4gICAqIF8ubGFzdEluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyLCAzKTtcbiAgICogLy8gPT4gMVxuICAgKi9cbiAgZnVuY3Rpb24gbGFzdEluZGV4T2YoYXJyYXksIHZhbHVlLCBmcm9tSW5kZXgpIHtcbiAgICB2YXIgaW5kZXggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XG4gICAgaWYgKHR5cGVvZiBmcm9tSW5kZXggPT0gJ251bWJlcicpIHtcbiAgICAgIGluZGV4ID0gKGZyb21JbmRleCA8IDAgPyBuYXRpdmVNYXgoMCwgaW5kZXggKyBmcm9tSW5kZXgpIDogbmF0aXZlTWluKGZyb21JbmRleCwgaW5kZXggLSAxKSkgKyAxO1xuICAgIH1cbiAgICB3aGlsZSAoaW5kZXgtLSkge1xuICAgICAgaWYgKGFycmF5W2luZGV4XSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBvYmplY3QgY29tcG9zZWQgZnJvbSBhcnJheXMgb2YgYGtleXNgIGFuZCBgdmFsdWVzYC4gUGFzcyBlaXRoZXJcbiAgICogYSBzaW5nbGUgdHdvIGRpbWVuc2lvbmFsIGFycmF5LCBpLmUuIGBbW2tleTEsIHZhbHVlMV0sIFtrZXkyLCB2YWx1ZTJdXWAsIG9yXG4gICAqIHR3byBhcnJheXMsIG9uZSBvZiBga2V5c2AgYW5kIG9uZSBvZiBjb3JyZXNwb25kaW5nIGB2YWx1ZXNgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0ga2V5cyBUaGUgYXJyYXkgb2Yga2V5cy5cbiAgICogQHBhcmFtIHtBcnJheX0gW3ZhbHVlcz1bXV0gVGhlIGFycmF5IG9mIHZhbHVlcy5cbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIGdpdmVuIGtleXMgYW5kXG4gICAqICBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5vYmplY3QoWydtb2UnLCAnbGFycnknXSwgWzMwLCA0MF0pO1xuICAgKiAvLyA9PiB7ICdtb2UnOiAzMCwgJ2xhcnJ5JzogNDAgfVxuICAgKi9cbiAgZnVuY3Rpb24gb2JqZWN0KGtleXMsIHZhbHVlcykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBrZXlzID8ga2V5cy5sZW5ndGggOiAwLFxuICAgICAgICByZXN1bHQgPSB7fTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIga2V5ID0ga2V5c1tpbmRleF07XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVzW2luZGV4XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtrZXlbMF1dID0ga2V5WzFdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgbnVtYmVycyAocG9zaXRpdmUgYW5kL29yIG5lZ2F0aXZlKSBwcm9ncmVzc2luZyBmcm9tXG4gICAqIGBzdGFydGAgdXAgdG8gYnV0IG5vdCBpbmNsdWRpbmcgYGVuZGAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0PTBdIFRoZSBzdGFydCBvZiB0aGUgcmFuZ2UuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBlbmQgVGhlIGVuZCBvZiB0aGUgcmFuZ2UuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbc3RlcD0xXSBUaGUgdmFsdWUgdG8gaW5jcmVtZW50IG9yIGRlc2NyZW1lbnQgYnkuXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyByYW5nZSBhcnJheS5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5yYW5nZSgxMCk7XG4gICAqIC8vID0+IFswLCAxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5XVxuICAgKlxuICAgKiBfLnJhbmdlKDEsIDExKTtcbiAgICogLy8gPT4gWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXVxuICAgKlxuICAgKiBfLnJhbmdlKDAsIDMwLCA1KTtcbiAgICogLy8gPT4gWzAsIDUsIDEwLCAxNSwgMjAsIDI1XVxuICAgKlxuICAgKiBfLnJhbmdlKDAsIC0xMCwgLTEpO1xuICAgKiAvLyA9PiBbMCwgLTEsIC0yLCAtMywgLTQsIC01LCAtNiwgLTcsIC04LCAtOV1cbiAgICpcbiAgICogXy5yYW5nZSgwKTtcbiAgICogLy8gPT4gW11cbiAgICovXG4gIGZ1bmN0aW9uIHJhbmdlKHN0YXJ0LCBlbmQsIHN0ZXApIHtcbiAgICBzdGFydCA9ICtzdGFydCB8fCAwO1xuICAgIHN0ZXAgPSArc3RlcCB8fCAxO1xuXG4gICAgaWYgKGVuZCA9PSBudWxsKSB7XG4gICAgICBlbmQgPSBzdGFydDtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgLy8gdXNlIGBBcnJheShsZW5ndGgpYCBzbyBWOCB3aWxsIGF2b2lkIHRoZSBzbG93ZXIgXCJkaWN0aW9uYXJ5XCIgbW9kZVxuICAgIC8vIGh0dHA6Ly95b3V0dS5iZS9YQXFJcEdVOFpaayN0PTE3bTI1c1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBuYXRpdmVNYXgoMCwgY2VpbCgoZW5kIC0gc3RhcnQpIC8gc3RlcCkpLFxuICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBzdGFydDtcbiAgICAgIHN0YXJ0ICs9IHN0ZXA7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmluaXRpYWxgLCB0aGlzIG1ldGhvZCBnZXRzIGFsbCBidXQgdGhlIGZpcnN0IHZhbHVlIG9mIGBhcnJheWAuXG4gICAqIElmIGEgbnVtYmVyIGBuYCBpcyBwYXNzZWQsIHRoZSBmaXJzdCBgbmAgdmFsdWVzIGFyZSBleGNsdWRlZCBmcm9tIHRoZSByZXN1bHQuXG4gICAqIElmIGEgYGNhbGxiYWNrYCBmdW5jdGlvbiBpcyBwYXNzZWQsIHRoZSBmaXJzdCBlbGVtZW50cyB0aGUgYGNhbGxiYWNrYCByZXR1cm5zXG4gICAqIHRydXRoeSBmb3IgYXJlIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdC4gVGhlIGBjYWxsYmFja2AgaXMgYm91bmQgdG8gYHRoaXNBcmdgXG4gICAqIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBhcnJheSkuXG4gICAqXG4gICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXG4gICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cbiAgICpcbiAgICogSWYgYW4gb2JqZWN0IGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcbiAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BldGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxuICAgKiBlbHNlIGBmYWxzZWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIGRyb3AsIHRhaWxcbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcXVlcnkuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fE51bWJlcnxTdHJpbmd9IFtjYWxsYmFja3xuPTFdIFRoZSBmdW5jdGlvbiBjYWxsZWRcbiAgICogIHBlciBlbGVtZW50IG9yIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZXhjbHVkZS4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yXG4gICAqICBvYmplY3QgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCJcbiAgICogIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgc2xpY2Ugb2YgYGFycmF5YC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXy5yZXN0KFsxLCAyLCAzXSk7XG4gICAqIC8vID0+IFsyLCAzXVxuICAgKlxuICAgKiBfLnJlc3QoWzEsIDIsIDNdLCAyKTtcbiAgICogLy8gPT4gWzNdXG4gICAqXG4gICAqIF8ucmVzdChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkge1xuICAgKiAgIHJldHVybiBudW0gPCAzO1xuICAgKiB9KTtcbiAgICogLy8gPT4gWzNdXG4gICAqXG4gICAqIHZhciBmb29kID0gW1xuICAgKiAgIHsgJ25hbWUnOiAnYmFuYW5hJywgJ29yZ2FuaWMnOiB0cnVlIH0sXG4gICAqICAgeyAnbmFtZSc6ICdiZWV0JywgICAnb3JnYW5pYyc6IGZhbHNlIH0sXG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLnJlc3QoZm9vZCwgJ29yZ2FuaWMnKTtcbiAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmVldCcsICdvcmdhbmljJzogZmFsc2UgfV1cbiAgICpcbiAgICogdmFyIGZvb2QgPSBbXG4gICAqICAgeyAnbmFtZSc6ICdhcHBsZScsICAndHlwZSc6ICdmcnVpdCcgfSxcbiAgICogICB7ICduYW1lJzogJ2JhbmFuYScsICd0eXBlJzogJ2ZydWl0JyB9LFxuICAgKiAgIHsgJ25hbWUnOiAnYmVldCcsICAgJ3R5cGUnOiAndmVnZXRhYmxlJyB9XG4gICAqIF07XG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLnJlc3QoZm9vZCwgeyAndHlwZSc6ICdmcnVpdCcgfSk7XG4gICAqIC8vID0+IFt7ICduYW1lJzogJ2JlZXQnLCAndHlwZSc6ICd2ZWdldGFibGUnIH1dXG4gICAqL1xuICBmdW5jdGlvbiByZXN0KGFycmF5LCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ251bWJlcicgJiYgY2FsbGJhY2sgIT0gbnVsbCkge1xuICAgICAgdmFyIG4gPSAwLFxuICAgICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xuXG4gICAgICBjYWxsYmFjayA9IGNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnKTtcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoICYmIGNhbGxiYWNrKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSkge1xuICAgICAgICBuKys7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG4gPSAoY2FsbGJhY2sgPT0gbnVsbCB8fCB0aGlzQXJnKSA/IDEgOiBuYXRpdmVNYXgoMCwgY2FsbGJhY2spO1xuICAgIH1cbiAgICByZXR1cm4gc2xpY2UoYXJyYXksIG4pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZXMgYSBiaW5hcnkgc2VhcmNoIHRvIGRldGVybWluZSB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2ggdGhlIGB2YWx1ZWBcbiAgICogc2hvdWxkIGJlIGluc2VydGVkIGludG8gYGFycmF5YCBpbiBvcmRlciB0byBtYWludGFpbiB0aGUgc29ydCBvcmRlciBvZiB0aGVcbiAgICogc29ydGVkIGBhcnJheWAuIElmIGBjYWxsYmFja2AgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBgdmFsdWVgIGFuZFxuICAgKiBlYWNoIGVsZW1lbnQgaW4gYGFycmF5YCB0byBjb21wdXRlIHRoZWlyIHNvcnQgcmFua2luZy4gVGhlIGBjYWxsYmFja2AgaXNcbiAgICogYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggb25lIGFyZ3VtZW50OyAodmFsdWUpLlxuICAgKlxuICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxuICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXG4gICAqXG4gICAqIElmIGFuIG9iamVjdCBpcyBwYXNzZWQgZm9yIGBjYWxsYmFja2AsIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXG4gICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcbiAgICogZWxzZSBgZmFsc2VgLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIGV2YWx1YXRlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxTdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcbiAgICogIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGVcbiAgICogIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cbiAgICogQHBhcmFtIHtNaXhlZH0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgdmFsdWUgc2hvdWxkIGJlIGluc2VydGVkXG4gICAqICBpbnRvIGBhcnJheWAuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uc29ydGVkSW5kZXgoWzIwLCAzMCwgNTBdLCA0MCk7XG4gICAqIC8vID0+IDJcbiAgICpcbiAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXG4gICAqIF8uc29ydGVkSW5kZXgoW3sgJ3gnOiAyMCB9LCB7ICd4JzogMzAgfSwgeyAneCc6IDUwIH1dLCB7ICd4JzogNDAgfSwgJ3gnKTtcbiAgICogLy8gPT4gMlxuICAgKlxuICAgKiB2YXIgZGljdCA9IHtcbiAgICogICAnd29yZFRvTnVtYmVyJzogeyAndHdlbnR5JzogMjAsICd0aGlydHknOiAzMCwgJ2ZvdXJ0eSc6IDQwLCAnZmlmdHknOiA1MCB9XG4gICAqIH07XG4gICAqXG4gICAqIF8uc29ydGVkSW5kZXgoWyd0d2VudHknLCAndGhpcnR5JywgJ2ZpZnR5J10sICdmb3VydHknLCBmdW5jdGlvbih3b3JkKSB7XG4gICAqICAgcmV0dXJuIGRpY3Qud29yZFRvTnVtYmVyW3dvcmRdO1xuICAgKiB9KTtcbiAgICogLy8gPT4gMlxuICAgKlxuICAgKiBfLnNvcnRlZEluZGV4KFsndHdlbnR5JywgJ3RoaXJ0eScsICdmaWZ0eSddLCAnZm91cnR5JywgZnVuY3Rpb24od29yZCkge1xuICAgKiAgIHJldHVybiB0aGlzLndvcmRUb051bWJlclt3b3JkXTtcbiAgICogfSwgZGljdCk7XG4gICAqIC8vID0+IDJcbiAgICovXG4gIGZ1bmN0aW9uIHNvcnRlZEluZGV4KGFycmF5LCB2YWx1ZSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICB2YXIgbG93ID0gMCxcbiAgICAgICAgaGlnaCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogbG93O1xuXG4gICAgLy8gZXhwbGljaXRseSByZWZlcmVuY2UgYGlkZW50aXR5YCBmb3IgYmV0dGVyIGlubGluaW5nIGluIEZpcmVmb3hcbiAgICBjYWxsYmFjayA9IGNhbGxiYWNrID8gY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDEpIDogaWRlbnRpdHk7XG4gICAgdmFsdWUgPSBjYWxsYmFjayh2YWx1ZSk7XG5cbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICAgIGNhbGxiYWNrKGFycmF5W21pZF0pIDwgdmFsdWVcbiAgICAgICAgPyBsb3cgPSBtaWQgKyAxXG4gICAgICAgIDogaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wdXRlcyB0aGUgdW5pb24gb2YgdGhlIHBhc3NlZC1pbiBhcnJheXMgdXNpbmcgc3RyaWN0IGVxdWFsaXR5IGZvclxuICAgKiBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gcHJvY2Vzcy5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHVuaXF1ZSB2YWx1ZXMsIGluIG9yZGVyLCB0aGF0IGFyZVxuICAgKiAgcHJlc2VudCBpbiBvbmUgb3IgbW9yZSBvZiB0aGUgYXJyYXlzLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnVuaW9uKFsxLCAyLCAzXSwgWzEwMSwgMiwgMSwgMTBdLCBbMiwgMV0pO1xuICAgKiAvLyA9PiBbMSwgMiwgMywgMTAxLCAxMF1cbiAgICovXG4gIGZ1bmN0aW9uIHVuaW9uKCkge1xuICAgIHJldHVybiB1bmlxKGNvbmNhdC5hcHBseShhcnJheVJlZiwgYXJndW1lbnRzKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGR1cGxpY2F0ZS12YWx1ZS1mcmVlIHZlcnNpb24gb2YgdGhlIGBhcnJheWAgdXNpbmcgc3RyaWN0IGVxdWFsaXR5XG4gICAqIGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgdGhlIGBhcnJheWAgaXMgYWxyZWFkeSBzb3J0ZWQsIHBhc3NpbmcgYHRydWVgXG4gICAqIGZvciBgaXNTb3J0ZWRgIHdpbGwgcnVuIGEgZmFzdGVyIGFsZ29yaXRobS4gSWYgYGNhbGxiYWNrYCBpcyBwYXNzZWQsIGVhY2hcbiAgICogZWxlbWVudCBvZiBgYXJyYXlgIGlzIHBhc3NlZCB0aHJvdWdoIGEgY2FsbGJhY2tgIGJlZm9yZSB1bmlxdWVuZXNzIGlzIGNvbXB1dGVkLlxuICAgKiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cbiAgICpcbiAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHBhc3NlZCBmb3IgYGNhbGxiYWNrYCwgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcbiAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxuICAgKlxuICAgKiBJZiBhbiBvYmplY3QgaXMgcGFzc2VkIGZvciBgY2FsbGJhY2tgLCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xuICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGV0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXG4gICAqIGVsc2UgYGZhbHNlYC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAYWxpYXMgdW5pcXVlXG4gICAqIEBjYXRlZ29yeSBBcnJheXNcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW2lzU29ydGVkPWZhbHNlXSBBIGZsYWcgdG8gaW5kaWNhdGUgdGhhdCB0aGUgYGFycmF5YCBpcyBhbHJlYWR5IHNvcnRlZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8U3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyXG4gICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcGFzc2VkLCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlXG4gICAqICBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgZHVwbGljYXRlLXZhbHVlLWZyZWUgYXJyYXkuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8udW5pcShbMSwgMiwgMSwgMywgMV0pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICpcbiAgICogXy51bmlxKFsxLCAxLCAyLCAyLCAzXSwgdHJ1ZSk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKlxuICAgKiBfLnVuaXEoWzEsIDIsIDEuNSwgMywgMi41XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLmZsb29yKG51bSk7IH0pO1xuICAgKiAvLyA9PiBbMSwgMiwgM11cbiAgICpcbiAgICogXy51bmlxKFsxLCAyLCAxLjUsIDMsIDIuNV0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gdGhpcy5mbG9vcihudW0pOyB9LCBNYXRoKTtcbiAgICogLy8gPT4gWzEsIDIsIDNdXG4gICAqXG4gICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxuICAgKiBfLnVuaXEoW3sgJ3gnOiAxIH0sIHsgJ3gnOiAyIH0sIHsgJ3gnOiAxIH1dLCAneCcpO1xuICAgKiAvLyA9PiBbeyAneCc6IDEgfSwgeyAneCc6IDIgfV1cbiAgICovXG4gIGZ1bmN0aW9uIHVuaXEoYXJyYXksIGlzU29ydGVkLCBjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXG4gICAgICAgIHJlc3VsdCA9IFtdLFxuICAgICAgICBzZWVuID0gcmVzdWx0O1xuXG4gICAgLy8ganVnZ2xlIGFyZ3VtZW50c1xuICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpc0FyZyA9IGNhbGxiYWNrO1xuICAgICAgY2FsbGJhY2sgPSBpc1NvcnRlZDtcbiAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgfVxuICAgIC8vIGluaXQgdmFsdWUgY2FjaGUgZm9yIGxhcmdlIGFycmF5c1xuICAgIHZhciBpc0xhcmdlID0gIWlzU29ydGVkICYmIGxlbmd0aCA+PSA3NTtcbiAgICBpZiAoaXNMYXJnZSkge1xuICAgICAgdmFyIGNhY2hlID0ge307XG4gICAgfVxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgc2VlbiA9IFtdO1xuICAgICAgY2FsbGJhY2sgPSBjcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgfVxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF0sXG4gICAgICAgICAgY29tcHV0ZWQgPSBjYWxsYmFjayA/IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgYXJyYXkpIDogdmFsdWU7XG5cbiAgICAgIGlmIChpc0xhcmdlKSB7XG4gICAgICAgIHZhciBrZXkgPSBjb21wdXRlZCArICcnO1xuICAgICAgICB2YXIgaW5pdGVkID0gaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZSwga2V5KVxuICAgICAgICAgID8gIShzZWVuID0gY2FjaGVba2V5XSlcbiAgICAgICAgICA6IChzZWVuID0gY2FjaGVba2V5XSA9IFtdKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1NvcnRlZFxuICAgICAgICAgICAgPyAhaW5kZXggfHwgc2VlbltzZWVuLmxlbmd0aCAtIDFdICE9PSBjb21wdXRlZFxuICAgICAgICAgICAgOiBpbml0ZWQgfHwgaW5kZXhPZihzZWVuLCBjb21wdXRlZCkgPCAwXG4gICAgICAgICAgKSB7XG4gICAgICAgIGlmIChjYWxsYmFjayB8fCBpc0xhcmdlKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKGNvbXB1dGVkKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBhcnJheSB3aXRoIGFsbCBvY2N1cnJlbmNlcyBvZiB0aGUgcGFzc2VkIHZhbHVlcyByZW1vdmVkIHVzaW5nXG4gICAqIHN0cmljdCBlcXVhbGl0eSBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEFycmF5c1xuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gZmlsdGVyLlxuICAgKiBAcGFyYW0ge01peGVkfSBbdmFsdWUxLCB2YWx1ZTIsIC4uLl0gVmFsdWVzIHRvIHJlbW92ZS5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGZpbHRlcmVkIGFycmF5LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLndpdGhvdXQoWzEsIDIsIDEsIDAsIDMsIDEsIDRdLCAwLCAxKTtcbiAgICogLy8gPT4gWzIsIDMsIDRdXG4gICAqL1xuICBmdW5jdGlvbiB3aXRob3V0KGFycmF5KSB7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMCxcbiAgICAgICAgY29udGFpbnMgPSBjYWNoZWRDb250YWlucyhhcmd1bWVudHMsIDEpLFxuICAgICAgICByZXN1bHQgPSBbXTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XG4gICAgICBpZiAoIWNvbnRhaW5zKHZhbHVlKSkge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogR3JvdXBzIHRoZSBlbGVtZW50cyBvZiBlYWNoIGFycmF5IGF0IHRoZWlyIGNvcnJlc3BvbmRpbmcgaW5kZXhlcy4gVXNlZnVsIGZvclxuICAgKiBzZXBhcmF0ZSBkYXRhIHNvdXJjZXMgdGhhdCBhcmUgY29vcmRpbmF0ZWQgdGhyb3VnaCBtYXRjaGluZyBhcnJheSBpbmRleGVzLlxuICAgKiBGb3IgYSBtYXRyaXggb2YgbmVzdGVkIGFycmF5cywgYF8uemlwLmFwcGx5KC4uLilgIGNhbiB0cmFuc3Bvc2UgdGhlIG1hdHJpeFxuICAgKiBpbiBhIHNpbWlsYXIgZmFzaGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgQXJyYXlzXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheTEsIGFycmF5MiwgLi4uXSBBcnJheXMgdG8gcHJvY2Vzcy5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGdyb3VwZWQgZWxlbWVudHMuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8uemlwKFsnbW9lJywgJ2xhcnJ5J10sIFszMCwgNDBdLCBbdHJ1ZSwgZmFsc2VdKTtcbiAgICogLy8gPT4gW1snbW9lJywgMzAsIHRydWVdLCBbJ2xhcnJ5JywgNDAsIGZhbHNlXV1cbiAgICovXG4gIGZ1bmN0aW9uIHppcChhcnJheSkge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBhcnJheSA/IG1heChwbHVjayhhcmd1bWVudHMsICdsZW5ndGgnKSkgOiAwLFxuICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBwbHVjayhhcmd1bWVudHMsIGluZGV4KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpcyByZXN0cmljdGVkIHRvIGV4ZWN1dGluZyBgZnVuY2Agb25seSBhZnRlciBpdCBpc1xuICAgKiBjYWxsZWQgYG5gIHRpbWVzLiBUaGUgYGZ1bmNgIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZVxuICAgKiBjcmVhdGVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG4gVGhlIG51bWJlciBvZiB0aW1lcyB0aGUgZnVuY3Rpb24gbXVzdCBiZSBjYWxsZWQgYmVmb3JlXG4gICAqIGl0IGlzIGV4ZWN1dGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byByZXN0cmljdC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcmVzdHJpY3RlZCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIHJlbmRlck5vdGVzID0gXy5hZnRlcihub3Rlcy5sZW5ndGgsIHJlbmRlcik7XG4gICAqIF8uZm9yRWFjaChub3RlcywgZnVuY3Rpb24obm90ZSkge1xuICAgKiAgIG5vdGUuYXN5bmNTYXZlKHsgJ3N1Y2Nlc3MnOiByZW5kZXJOb3RlcyB9KTtcbiAgICogfSk7XG4gICAqIC8vIGByZW5kZXJOb3Rlc2AgaXMgcnVuIG9uY2UsIGFmdGVyIGFsbCBub3RlcyBoYXZlIHNhdmVkXG4gICAqL1xuICBmdW5jdGlvbiBhZnRlcihuLCBmdW5jKSB7XG4gICAgaWYgKG4gPCAxKSB7XG4gICAgICByZXR1cm4gZnVuYygpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS1uIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2BcbiAgICogYmluZGluZyBvZiBgdGhpc0FyZ2AgYW5kIHByZXBlbmRzIGFueSBhZGRpdGlvbmFsIGBiaW5kYCBhcmd1bWVudHMgdG8gdGhvc2VcbiAgICogcGFzc2VkIHRvIHRoZSBib3VuZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGJpbmQuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICAgKiBAcGFyYW0ge01peGVkfSBbYXJnMSwgYXJnMiwgLi4uXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJvdW5kIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZnVuYyA9IGZ1bmN0aW9uKGdyZWV0aW5nKSB7XG4gICAqICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy5uYW1lO1xuICAgKiB9O1xuICAgKlxuICAgKiBmdW5jID0gXy5iaW5kKGZ1bmMsIHsgJ25hbWUnOiAnbW9lJyB9LCAnaGknKTtcbiAgICogZnVuYygpO1xuICAgKiAvLyA9PiAnaGkgbW9lJ1xuICAgKi9cbiAgZnVuY3Rpb24gYmluZChmdW5jLCB0aGlzQXJnKSB7XG4gICAgLy8gdXNlIGBGdW5jdGlvbiNiaW5kYCBpZiBpdCBleGlzdHMgYW5kIGlzIGZhc3RcbiAgICAvLyAoaW4gVjggYEZ1bmN0aW9uI2JpbmRgIGlzIHNsb3dlciBleGNlcHQgd2hlbiBwYXJ0aWFsbHkgYXBwbGllZClcbiAgICByZXR1cm4gaXNCaW5kRmFzdCB8fCAobmF0aXZlQmluZCAmJiBhcmd1bWVudHMubGVuZ3RoID4gMilcbiAgICAgID8gbmF0aXZlQmluZC5jYWxsLmFwcGx5KG5hdGl2ZUJpbmQsIGFyZ3VtZW50cylcbiAgICAgIDogY3JlYXRlQm91bmQoZnVuYywgdGhpc0FyZywgc2xpY2UoYXJndW1lbnRzLCAyKSk7XG4gIH1cblxuICAvKipcbiAgICogQmluZHMgbWV0aG9kcyBvbiBgb2JqZWN0YCB0byBgb2JqZWN0YCwgb3ZlcndyaXRpbmcgdGhlIGV4aXN0aW5nIG1ldGhvZC5cbiAgICogTWV0aG9kIG5hbWVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzIG9mIG1ldGhvZFxuICAgKiBuYW1lcy4gSWYgbm8gbWV0aG9kIG5hbWVzIGFyZSBwcm92aWRlZCwgYWxsIHRoZSBmdW5jdGlvbiBwcm9wZXJ0aWVzIG9mIGBvYmplY3RgXG4gICAqIHdpbGwgYmUgYm91bmQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gYmluZCBhbmQgYXNzaWduIHRoZSBib3VuZCBtZXRob2RzIHRvLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW21ldGhvZE5hbWUxLCBtZXRob2ROYW1lMiwgLi4uXSBNZXRob2QgbmFtZXMgb24gdGhlIG9iamVjdCB0byBiaW5kLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgdmlldyA9IHtcbiAgICogICdsYWJlbCc6ICdkb2NzJyxcbiAgICogICdvbkNsaWNrJzogZnVuY3Rpb24oKSB7IGFsZXJ0KCdjbGlja2VkICcgKyB0aGlzLmxhYmVsKTsgfVxuICAgKiB9O1xuICAgKlxuICAgKiBfLmJpbmRBbGwodmlldyk7XG4gICAqIGpRdWVyeSgnI2RvY3MnKS5vbignY2xpY2snLCB2aWV3Lm9uQ2xpY2spO1xuICAgKiAvLyA9PiBhbGVydHMgJ2NsaWNrZWQgZG9jcycsIHdoZW4gdGhlIGJ1dHRvbiBpcyBjbGlja2VkXG4gICAqL1xuICBmdW5jdGlvbiBiaW5kQWxsKG9iamVjdCkge1xuICAgIHZhciBmdW5jcyA9IGNvbmNhdC5hcHBseShhcnJheVJlZiwgYXJndW1lbnRzKSxcbiAgICAgICAgaW5kZXggPSBmdW5jcy5sZW5ndGggPiAxID8gMCA6IChmdW5jcyA9IGZ1bmN0aW9ucyhvYmplY3QpLCAtMSksXG4gICAgICAgIGxlbmd0aCA9IGZ1bmNzLmxlbmd0aDtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICB2YXIga2V5ID0gZnVuY3NbaW5kZXhdO1xuICAgICAgb2JqZWN0W2tleV0gPSBiaW5kKG9iamVjdFtrZXldLCBvYmplY3QpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgaW52b2tlcyB0aGUgbWV0aG9kIGF0IGBvYmplY3Rba2V5XWBcbiAgICogYW5kIHByZXBlbmRzIGFueSBhZGRpdGlvbmFsIGBiaW5kS2V5YCBhcmd1bWVudHMgdG8gdGhvc2UgcGFzc2VkIHRvIHRoZSBib3VuZFxuICAgKiBmdW5jdGlvbi4gVGhpcyBtZXRob2QgZGlmZmVycyBmcm9tIGBfLmJpbmRgIGJ5IGFsbG93aW5nIGJvdW5kIGZ1bmN0aW9ucyB0b1xuICAgKiByZWZlcmVuY2UgbWV0aG9kcyB0aGF0IHdpbGwgYmUgcmVkZWZpbmVkIG9yIGRvbid0IHlldCBleGlzdC5cbiAgICogU2VlIGh0dHA6Ly9taWNoYXV4LmNhL2FydGljbGVzL2xhenktZnVuY3Rpb24tZGVmaW5pdGlvbi1wYXR0ZXJuLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRoZSBtZXRob2QgYmVsb25ncyB0by5cbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYm91bmQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBvYmplY3QgPSB7XG4gICAqICAgJ25hbWUnOiAnbW9lJyxcbiAgICogICAnZ3JlZXQnOiBmdW5jdGlvbihncmVldGluZykge1xuICAgKiAgICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy5uYW1lO1xuICAgKiAgIH1cbiAgICogfTtcbiAgICpcbiAgICogdmFyIGZ1bmMgPSBfLmJpbmRLZXkob2JqZWN0LCAnZ3JlZXQnLCAnaGknKTtcbiAgICogZnVuYygpO1xuICAgKiAvLyA9PiAnaGkgbW9lJ1xuICAgKlxuICAgKiBvYmplY3QuZ3JlZXQgPSBmdW5jdGlvbihncmVldGluZykge1xuICAgKiAgIHJldHVybiBncmVldGluZyArICcsICcgKyB0aGlzLm5hbWUgKyAnISc7XG4gICAqIH07XG4gICAqXG4gICAqIGZ1bmMoKTtcbiAgICogLy8gPT4gJ2hpLCBtb2UhJ1xuICAgKi9cbiAgZnVuY3Rpb24gYmluZEtleShvYmplY3QsIGtleSkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZChvYmplY3QsIGtleSwgc2xpY2UoYXJndW1lbnRzLCAyKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIHRoZSBwYXNzZWQgZnVuY3Rpb25zLFxuICAgKiB3aGVyZSBlYWNoIGZ1bmN0aW9uIGNvbnN1bWVzIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cbiAgICogRm9yIGV4YW1wbGUsIGNvbXBvc2luZyB0aGUgZnVuY3Rpb25zIGBmKClgLCBgZygpYCwgYW5kIGBoKClgIHByb2R1Y2VzIGBmKGcoaCgpKSlgLlxuICAgKiBFYWNoIGZ1bmN0aW9uIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjb21wb3NlZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtmdW5jMSwgZnVuYzIsIC4uLl0gRnVuY3Rpb25zIHRvIGNvbXBvc2UuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGNvbXBvc2VkIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgZ3JlZXQgPSBmdW5jdGlvbihuYW1lKSB7IHJldHVybiAnaGkgJyArIG5hbWU7IH07XG4gICAqIHZhciBleGNsYWltID0gZnVuY3Rpb24oc3RhdGVtZW50KSB7IHJldHVybiBzdGF0ZW1lbnQgKyAnISc7IH07XG4gICAqIHZhciB3ZWxjb21lID0gXy5jb21wb3NlKGV4Y2xhaW0sIGdyZWV0KTtcbiAgICogd2VsY29tZSgnbW9lJyk7XG4gICAqIC8vID0+ICdoaSBtb2UhJ1xuICAgKi9cbiAgZnVuY3Rpb24gY29tcG9zZSgpIHtcbiAgICB2YXIgZnVuY3MgPSBhcmd1bWVudHM7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgICAgbGVuZ3RoID0gZnVuY3MubGVuZ3RoO1xuXG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgYXJncyA9IFtmdW5jc1tsZW5ndGhdLmFwcGx5KHRoaXMsIGFyZ3MpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhcmdzWzBdO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBkZWxheSB0aGUgZXhlY3V0aW9uIG9mIGBmdW5jYCB1bnRpbCBhZnRlclxuICAgKiBgd2FpdGAgbWlsbGlzZWNvbmRzIGhhdmUgZWxhcHNlZCBzaW5jZSB0aGUgbGFzdCB0aW1lIGl0IHdhcyBpbnZva2VkLiBQYXNzXG4gICAqIGB0cnVlYCBmb3IgYGltbWVkaWF0ZWAgdG8gY2F1c2UgZGVib3VuY2UgdG8gaW52b2tlIGBmdW5jYCBvbiB0aGUgbGVhZGluZyxcbiAgICogaW5zdGVhZCBvZiB0aGUgdHJhaWxpbmcsIGVkZ2Ugb2YgdGhlIGB3YWl0YCB0aW1lb3V0LiBTdWJzZXF1ZW50IGNhbGxzIHRvXG4gICAqIHRoZSBkZWJvdW5jZWQgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIHJlc3VsdCBvZiB0aGUgbGFzdCBgZnVuY2AgY2FsbC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGRlYm91bmNlLlxuICAgKiBAcGFyYW0ge051bWJlcn0gd2FpdCBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byBkZWxheS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBpbW1lZGlhdGUgQSBmbGFnIHRvIGluZGljYXRlIGV4ZWN1dGlvbiBpcyBvbiB0aGUgbGVhZGluZ1xuICAgKiAgZWRnZSBvZiB0aGUgdGltZW91dC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZGVib3VuY2VkIGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgbGF6eUxheW91dCA9IF8uZGVib3VuY2UoY2FsY3VsYXRlTGF5b3V0LCAzMDApO1xuICAgKiBqUXVlcnkod2luZG93KS5vbigncmVzaXplJywgbGF6eUxheW91dCk7XG4gICAqL1xuICBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBpbW1lZGlhdGUpIHtcbiAgICB2YXIgYXJncyxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICB0aGlzQXJnLFxuICAgICAgICB0aW1lb3V0SWQ7XG5cbiAgICBmdW5jdGlvbiBkZWxheWVkKCkge1xuICAgICAgdGltZW91dElkID0gbnVsbDtcbiAgICAgIGlmICghaW1tZWRpYXRlKSB7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpc0ltbWVkaWF0ZSA9IGltbWVkaWF0ZSAmJiAhdGltZW91dElkO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIHRoaXNBcmcgPSB0aGlzO1xuXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZGVsYXllZCwgd2FpdCk7XG5cbiAgICAgIGlmIChpc0ltbWVkaWF0ZSkge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIHRoZSBgZnVuY2AgZnVuY3Rpb24gYWZ0ZXIgYHdhaXRgIG1pbGxpc2Vjb25kcy4gQWRkaXRpb25hbCBhcmd1bWVudHNcbiAgICogd2lsbCBiZSBwYXNzZWQgdG8gYGZ1bmNgIHdoZW4gaXQgaXMgaW52b2tlZC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGRlbGF5LlxuICAgKiBAcGFyYW0ge051bWJlcn0gd2FpdCBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byBkZWxheSBleGVjdXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBpbnZva2UgdGhlIGZ1bmN0aW9uIHdpdGguXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIGBzZXRUaW1lb3V0YCB0aW1lb3V0IGlkLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgbG9nID0gXy5iaW5kKGNvbnNvbGUubG9nLCBjb25zb2xlKTtcbiAgICogXy5kZWxheShsb2csIDEwMDAsICdsb2dnZWQgbGF0ZXInKTtcbiAgICogLy8gPT4gJ2xvZ2dlZCBsYXRlcicgKEFwcGVhcnMgYWZ0ZXIgb25lIHNlY29uZC4pXG4gICAqL1xuICBmdW5jdGlvbiBkZWxheShmdW5jLCB3YWl0KSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBmdW5jLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7IH0sIHdhaXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmVycyBleGVjdXRpbmcgdGhlIGBmdW5jYCBmdW5jdGlvbiB1bnRpbCB0aGUgY3VycmVudCBjYWxsIHN0YWNrIGhhcyBjbGVhcmVkLlxuICAgKiBBZGRpdGlvbmFsIGFyZ3VtZW50cyB3aWxsIGJlIHBhc3NlZCB0byBgZnVuY2Agd2hlbiBpdCBpcyBpbnZva2VkLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gZGVmZXIuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBpbnZva2UgdGhlIGZ1bmN0aW9uIHdpdGguXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgdGhlIGBzZXRUaW1lb3V0YCB0aW1lb3V0IGlkLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmRlZmVyKGZ1bmN0aW9uKCkgeyBhbGVydCgnZGVmZXJyZWQnKTsgfSk7XG4gICAqIC8vIHJldHVybnMgZnJvbSB0aGUgZnVuY3Rpb24gYmVmb3JlIGBhbGVydGAgaXMgY2FsbGVkXG4gICAqL1xuICBmdW5jdGlvbiBkZWZlcihmdW5jKSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBmdW5jLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7IH0sIDEpO1xuICB9XG4gIC8vIHVzZSBgc2V0SW1tZWRpYXRlYCBpZiBpdCdzIGF2YWlsYWJsZSBpbiBOb2RlLmpzXG4gIGlmIChpc1Y4ICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIHNldEltbWVkaWF0ZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgZGVmZXIgPSBiaW5kKHNldEltbWVkaWF0ZSwgd2luZG93KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBtZW1vaXplcyB0aGUgcmVzdWx0IG9mIGBmdW5jYC4gSWYgYHJlc29sdmVyYCBpc1xuICAgKiBwYXNzZWQsIGl0IHdpbGwgYmUgdXNlZCB0byBkZXRlcm1pbmUgdGhlIGNhY2hlIGtleSBmb3Igc3RvcmluZyB0aGUgcmVzdWx0XG4gICAqIGJhc2VkIG9uIHRoZSBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBtZW1vaXplZCBmdW5jdGlvbi4gQnkgZGVmYXVsdCwgdGhlIGZpcnN0XG4gICAqIGFyZ3VtZW50IHBhc3NlZCB0byB0aGUgbWVtb2l6ZWQgZnVuY3Rpb24gaXMgdXNlZCBhcyB0aGUgY2FjaGUga2V5LiBUaGUgYGZ1bmNgXG4gICAqIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBtZW1vaXplZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGhhdmUgaXRzIG91dHB1dCBtZW1vaXplZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW3Jlc29sdmVyXSBBIGZ1bmN0aW9uIHVzZWQgdG8gcmVzb2x2ZSB0aGUgY2FjaGUga2V5LlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBtZW1vaXppbmcgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBmaWJvbmFjY2kgPSBfLm1lbW9pemUoZnVuY3Rpb24obikge1xuICAgKiAgIHJldHVybiBuIDwgMiA/IG4gOiBmaWJvbmFjY2kobiAtIDEpICsgZmlib25hY2NpKG4gLSAyKTtcbiAgICogfSk7XG4gICAqL1xuICBmdW5jdGlvbiBtZW1vaXplKGZ1bmMsIHJlc29sdmVyKSB7XG4gICAgdmFyIGNhY2hlID0ge307XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGtleSA9IChyZXNvbHZlciA/IHJlc29sdmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgOiBhcmd1bWVudHNbMF0pICsgJyc7XG4gICAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZSwga2V5KVxuICAgICAgICA/IGNhY2hlW2tleV1cbiAgICAgICAgOiAoY2FjaGVba2V5XSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpcyByZXN0cmljdGVkIHRvIGV4ZWN1dGUgYGZ1bmNgIG9uY2UuIFJlcGVhdCBjYWxscyB0b1xuICAgKiB0aGUgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBjYWxsLiBUaGUgYGZ1bmNgIGlzIGV4ZWN1dGVkXG4gICAqIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gcmVzdHJpY3QuXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHJlc3RyaWN0ZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBpbml0aWFsaXplID0gXy5vbmNlKGNyZWF0ZUFwcGxpY2F0aW9uKTtcbiAgICogaW5pdGlhbGl6ZSgpO1xuICAgKiBpbml0aWFsaXplKCk7XG4gICAqIC8vIGBpbml0aWFsaXplYCBleGVjdXRlcyBgY3JlYXRlQXBwbGljYXRpb25gIG9uY2VcbiAgICovXG4gIGZ1bmN0aW9uIG9uY2UoZnVuYykge1xuICAgIHZhciByYW4sXG4gICAgICAgIHJlc3VsdDtcblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyYW4pIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIHJhbiA9IHRydWU7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgIC8vIGNsZWFyIHRoZSBgZnVuY2AgdmFyaWFibGUgc28gdGhlIGZ1bmN0aW9uIG1heSBiZSBnYXJiYWdlIGNvbGxlY3RlZFxuICAgICAgZnVuYyA9IG51bGw7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIGFueSBhZGRpdGlvbmFsXG4gICAqIGBwYXJ0aWFsYCBhcmd1bWVudHMgcHJlcGVuZGVkIHRvIHRob3NlIHBhc3NlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLiBUaGlzXG4gICAqIG1ldGhvZCBpcyBzaW1pbGFyIHRvIGBfLmJpbmRgLCBleGNlcHQgaXQgZG9lcyAqKm5vdCoqIGFsdGVyIHRoZSBgdGhpc2AgYmluZGluZy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHBhcnRpYWxseSBhcHBseSBhcmd1bWVudHMgdG8uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGdyZWV0aW5nLCBuYW1lKSB7IHJldHVybiBncmVldGluZyArICcgJyArIG5hbWU7IH07XG4gICAqIHZhciBoaSA9IF8ucGFydGlhbChncmVldCwgJ2hpJyk7XG4gICAqIGhpKCdtb2UnKTtcbiAgICogLy8gPT4gJ2hpIG1vZSdcbiAgICovXG4gIGZ1bmN0aW9uIHBhcnRpYWwoZnVuYykge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZChmdW5jLCBzbGljZShhcmd1bWVudHMsIDEpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBzaW1pbGFyIHRvIGBfLnBhcnRpYWxgLCBleGNlcHQgdGhhdCBgcGFydGlhbGAgYXJndW1lbnRzIGFyZVxuICAgKiBhcHBlbmRlZCB0byB0aG9zZSBwYXNzZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHBhcnRpYWxseSBhcHBseSBhcmd1bWVudHMgdG8uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFthcmcxLCBhcmcyLCAuLi5dIEFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBkZWZhdWx0c0RlZXAgPSBfLnBhcnRpYWxSaWdodChfLm1lcmdlLCBfLmRlZmF1bHRzKTtcbiAgICpcbiAgICogdmFyIG9wdGlvbnMgPSB7XG4gICAqICAgJ3ZhcmlhYmxlJzogJ2RhdGEnLFxuICAgKiAgICdpbXBvcnRzJzogeyAnanEnOiAkIH1cbiAgICogfTtcbiAgICpcbiAgICogZGVmYXVsdHNEZWVwKG9wdGlvbnMsIF8udGVtcGxhdGVTZXR0aW5ncyk7XG4gICAqXG4gICAqIG9wdGlvbnMudmFyaWFibGVcbiAgICogLy8gPT4gJ2RhdGEnXG4gICAqXG4gICAqIG9wdGlvbnMuaW1wb3J0c1xuICAgKiAvLyA9PiB7ICdfJzogXywgJ2pxJzogJCB9XG4gICAqL1xuICBmdW5jdGlvbiBwYXJ0aWFsUmlnaHQoZnVuYykge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZChmdW5jLCBzbGljZShhcmd1bWVudHMsIDEpLCBudWxsLCBpbmRpY2F0b3JPYmplY3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGV4ZWN1dGVkLCB3aWxsIG9ubHkgY2FsbCB0aGUgYGZ1bmNgXG4gICAqIGZ1bmN0aW9uIGF0IG1vc3Qgb25jZSBwZXIgZXZlcnkgYHdhaXRgIG1pbGxpc2Vjb25kcy4gSWYgdGhlIHRocm90dGxlZFxuICAgKiBmdW5jdGlvbiBpcyBpbnZva2VkIG1vcmUgdGhhbiBvbmNlIGR1cmluZyB0aGUgYHdhaXRgIHRpbWVvdXQsIGBmdW5jYCB3aWxsXG4gICAqIGFsc28gYmUgY2FsbGVkIG9uIHRoZSB0cmFpbGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0LiBTdWJzZXF1ZW50IGNhbGxzIHRvIHRoZVxuICAgKiB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbCByZXR1cm4gdGhlIHJlc3VsdCBvZiB0aGUgbGFzdCBgZnVuY2AgY2FsbC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHRocm90dGxlLlxuICAgKiBAcGFyYW0ge051bWJlcn0gd2FpdCBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byB0aHJvdHRsZSBleGVjdXRpb25zIHRvLlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB0aHJvdHRsZWQgZnVuY3Rpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciB0aHJvdHRsZWQgPSBfLnRocm90dGxlKHVwZGF0ZVBvc2l0aW9uLCAxMDApO1xuICAgKiBqUXVlcnkod2luZG93KS5vbignc2Nyb2xsJywgdGhyb3R0bGVkKTtcbiAgICovXG4gIGZ1bmN0aW9uIHRocm90dGxlKGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICB0aGlzQXJnLFxuICAgICAgICB0aW1lb3V0SWQsXG4gICAgICAgIGxhc3RDYWxsZWQgPSAwO1xuXG4gICAgZnVuY3Rpb24gdHJhaWxpbmdDYWxsKCkge1xuICAgICAgbGFzdENhbGxlZCA9IG5ldyBEYXRlO1xuICAgICAgdGltZW91dElkID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub3cgPSBuZXcgRGF0ZSxcbiAgICAgICAgICByZW1haW5pbmcgPSB3YWl0IC0gKG5vdyAtIGxhc3RDYWxsZWQpO1xuXG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGhpc0FyZyA9IHRoaXM7XG5cbiAgICAgIGlmIChyZW1haW5pbmcgPD0gMCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgdGltZW91dElkID0gbnVsbDtcbiAgICAgICAgbGFzdENhbGxlZCA9IG5vdztcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKCF0aW1lb3V0SWQpIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dCh0cmFpbGluZ0NhbGwsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgcGFzc2VzIGB2YWx1ZWAgdG8gdGhlIGB3cmFwcGVyYCBmdW5jdGlvbiBhcyBpdHNcbiAgICogZmlyc3QgYXJndW1lbnQuIEFkZGl0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byB0aGUgZnVuY3Rpb24gYXJlIGFwcGVuZGVkXG4gICAqIHRvIHRob3NlIHBhc3NlZCB0byB0aGUgYHdyYXBwZXJgIGZ1bmN0aW9uLiBUaGUgYHdyYXBwZXJgIGlzIGV4ZWN1dGVkIHdpdGhcbiAgICogdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgVGhlIHZhbHVlIHRvIHdyYXAuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IHdyYXBwZXIgVGhlIHdyYXBwZXIgZnVuY3Rpb24uXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiB2YXIgaGVsbG8gPSBmdW5jdGlvbihuYW1lKSB7IHJldHVybiAnaGVsbG8gJyArIG5hbWU7IH07XG4gICAqIGhlbGxvID0gXy53cmFwKGhlbGxvLCBmdW5jdGlvbihmdW5jKSB7XG4gICAqICAgcmV0dXJuICdiZWZvcmUsICcgKyBmdW5jKCdtb2UnKSArICcsIGFmdGVyJztcbiAgICogfSk7XG4gICAqIGhlbGxvKCk7XG4gICAqIC8vID0+ICdiZWZvcmUsIGhlbGxvIG1vZSwgYWZ0ZXInXG4gICAqL1xuICBmdW5jdGlvbiB3cmFwKHZhbHVlLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBbdmFsdWVdO1xuICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIHdyYXBwZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgY2hhcmFjdGVycyBgJmAsIGA8YCwgYD5gLCBgXCJgLCBhbmQgYCdgIGluIGBzdHJpbmdgIHRvIHRoZWlyXG4gICAqIGNvcnJlc3BvbmRpbmcgSFRNTCBlbnRpdGllcy5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIHN0cmluZyB0byBlc2NhcGUuXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLmVzY2FwZSgnTW9lLCBMYXJyeSAmIEN1cmx5Jyk7XG4gICAqIC8vID0+ICdNb2UsIExhcnJ5ICZhbXA7IEN1cmx5J1xuICAgKi9cbiAgZnVuY3Rpb24gZXNjYXBlKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcgPT0gbnVsbCA/ICcnIDogKHN0cmluZyArICcnKS5yZXBsYWNlKHJlVW5lc2NhcGVkSHRtbCwgZXNjYXBlSHRtbENoYXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgZmlyc3QgYXJndW1lbnQgcGFzc2VkIHRvIGl0LlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgQW55IHZhbHVlLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgYHZhbHVlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG1vZSA9IHsgJ25hbWUnOiAnbW9lJyB9O1xuICAgKiBtb2UgPT09IF8uaWRlbnRpdHkobW9lKTtcbiAgICogLy8gPT4gdHJ1ZVxuICAgKi9cbiAgZnVuY3Rpb24gaWRlbnRpdHkodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBmdW5jdGlvbnMgcHJvcGVydGllcyBvZiBgb2JqZWN0YCB0byB0aGUgYGxvZGFzaGAgZnVuY3Rpb24gYW5kIGNoYWluYWJsZVxuICAgKiB3cmFwcGVyLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IG9mIGZ1bmN0aW9uIHByb3BlcnRpZXMgdG8gYWRkIHRvIGBsb2Rhc2hgLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLm1peGluKHtcbiAgICogICAnY2FwaXRhbGl6ZSc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgKiAgICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpO1xuICAgKiAgIH1cbiAgICogfSk7XG4gICAqXG4gICAqIF8uY2FwaXRhbGl6ZSgnbW9lJyk7XG4gICAqIC8vID0+ICdNb2UnXG4gICAqXG4gICAqIF8oJ21vZScpLmNhcGl0YWxpemUoKTtcbiAgICogLy8gPT4gJ01vZSdcbiAgICovXG4gIGZ1bmN0aW9uIG1peGluKG9iamVjdCkge1xuICAgIGZvckVhY2goZnVuY3Rpb25zKG9iamVjdCksIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gbG9kYXNoW21ldGhvZE5hbWVdID0gb2JqZWN0W21ldGhvZE5hbWVdO1xuXG4gICAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX193cmFwcGVkX19dO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiBuZXcgbG9kYXNoKGZ1bmMuYXBwbHkobG9kYXNoLCBhcmdzKSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldmVydHMgdGhlICdfJyB2YXJpYWJsZSB0byBpdHMgcHJldmlvdXMgdmFsdWUgYW5kIHJldHVybnMgYSByZWZlcmVuY2UgdG9cbiAgICogdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBgbG9kYXNoYCBmdW5jdGlvbi5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIGxvZGFzaCA9IF8ubm9Db25mbGljdCgpO1xuICAgKi9cbiAgZnVuY3Rpb24gbm9Db25mbGljdCgpIHtcbiAgICB3aW5kb3cuXyA9IG9sZERhc2g7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUHJvZHVjZXMgYSByYW5kb20gbnVtYmVyIGJldHdlZW4gYG1pbmAgYW5kIGBtYXhgIChpbmNsdXNpdmUpLiBJZiBvbmx5IG9uZVxuICAgKiBhcmd1bWVudCBpcyBwYXNzZWQsIGEgbnVtYmVyIGJldHdlZW4gYDBgIGFuZCB0aGUgZ2l2ZW4gbnVtYmVyIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge051bWJlcn0gW21pbj0wXSBUaGUgbWluaW11bSBwb3NzaWJsZSB2YWx1ZS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IFttYXg9MV0gVGhlIG1heGltdW0gcG9zc2libGUgdmFsdWUuXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IFJldHVybnMgYSByYW5kb20gbnVtYmVyLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnJhbmRvbSgwLCA1KTtcbiAgICogLy8gPT4gYSBudW1iZXIgYmV0d2VlbiAwIGFuZCA1XG4gICAqXG4gICAqIF8ucmFuZG9tKDUpO1xuICAgKiAvLyA9PiBhbHNvIGEgbnVtYmVyIGJldHdlZW4gMCBhbmQgNVxuICAgKi9cbiAgZnVuY3Rpb24gcmFuZG9tKG1pbiwgbWF4KSB7XG4gICAgaWYgKG1pbiA9PSBudWxsICYmIG1heCA9PSBudWxsKSB7XG4gICAgICBtYXggPSAxO1xuICAgIH1cbiAgICBtaW4gPSArbWluIHx8IDA7XG4gICAgaWYgKG1heCA9PSBudWxsKSB7XG4gICAgICBtYXggPSBtaW47XG4gICAgICBtaW4gPSAwO1xuICAgIH1cbiAgICByZXR1cm4gbWluICsgZmxvb3IobmF0aXZlUmFuZG9tKCkgKiAoKCttYXggfHwgMCkgLSBtaW4gKyAxKSk7XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZXMgdGhlIHZhbHVlIG9mIGBwcm9wZXJ0eWAgb24gYG9iamVjdGAuIElmIGBwcm9wZXJ0eWAgaXMgYSBmdW5jdGlvbixcbiAgICogaXQgd2lsbCBiZSBpbnZva2VkIGFuZCBpdHMgcmVzdWx0IHJldHVybmVkLCBlbHNlIHRoZSBwcm9wZXJ0eSB2YWx1ZSBpc1xuICAgKiByZXR1cm5lZC4gSWYgYG9iamVjdGAgaXMgZmFsc2V5LCB0aGVuIGBudWxsYCBpcyByZXR1cm5lZC5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHkgVGhlIHByb3BlcnR5IHRvIGdldCB0aGUgdmFsdWUgb2YuXG4gICAqIEByZXR1cm5zIHtNaXhlZH0gUmV0dXJucyB0aGUgcmVzb2x2ZWQgdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBvYmplY3QgPSB7XG4gICAqICAgJ2NoZWVzZSc6ICdjcnVtcGV0cycsXG4gICAqICAgJ3N0dWZmJzogZnVuY3Rpb24oKSB7XG4gICAqICAgICByZXR1cm4gJ25vbnNlbnNlJztcbiAgICogICB9XG4gICAqIH07XG4gICAqXG4gICAqIF8ucmVzdWx0KG9iamVjdCwgJ2NoZWVzZScpO1xuICAgKiAvLyA9PiAnY3J1bXBldHMnXG4gICAqXG4gICAqIF8ucmVzdWx0KG9iamVjdCwgJ3N0dWZmJyk7XG4gICAqIC8vID0+ICdub25zZW5zZSdcbiAgICovXG4gIGZ1bmN0aW9uIHJlc3VsdChvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgdmFyIHZhbHVlID0gb2JqZWN0ID8gb2JqZWN0W3Byb3BlcnR5XSA6IHVuZGVmaW5lZDtcbiAgICByZXR1cm4gaXNGdW5jdGlvbih2YWx1ZSkgPyBvYmplY3RbcHJvcGVydHldKCkgOiB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIG1pY3JvLXRlbXBsYXRpbmcgbWV0aG9kIHRoYXQgaGFuZGxlcyBhcmJpdHJhcnkgZGVsaW1pdGVycywgcHJlc2VydmVzXG4gICAqIHdoaXRlc3BhY2UsIGFuZCBjb3JyZWN0bHkgZXNjYXBlcyBxdW90ZXMgd2l0aGluIGludGVycG9sYXRlZCBjb2RlLlxuICAgKlxuICAgKiBOb3RlOiBJbiB0aGUgZGV2ZWxvcG1lbnQgYnVpbGQsIGBfLnRlbXBsYXRlYCB1dGlsaXplcyBzb3VyY2VVUkxzIGZvciBlYXNpZXJcbiAgICogZGVidWdnaW5nLiBTZWUgaHR0cDovL3d3dy5odG1sNXJvY2tzLmNvbS9lbi90dXRvcmlhbHMvZGV2ZWxvcGVydG9vbHMvc291cmNlbWFwcy8jdG9jLXNvdXJjZXVybFxuICAgKlxuICAgKiBOb3RlOiBMby1EYXNoIG1heSBiZSB1c2VkIGluIENocm9tZSBleHRlbnNpb25zIGJ5IGVpdGhlciBjcmVhdGluZyBhIGBsb2Rhc2ggY3NwYFxuICAgKiBidWlsZCBhbmQgdXNpbmcgcHJlY29tcGlsZWQgdGVtcGxhdGVzLCBvciBsb2FkaW5nIExvLURhc2ggaW4gYSBzYW5kYm94LlxuICAgKlxuICAgKiBGb3IgbW9yZSBpbmZvcm1hdGlvbiBvbiBwcmVjb21waWxpbmcgdGVtcGxhdGVzIHNlZTpcbiAgICogaHR0cDovL2xvZGFzaC5jb20vI2N1c3RvbS1idWlsZHNcbiAgICpcbiAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24gb24gQ2hyb21lIGV4dGVuc2lvbiBzYW5kYm94ZXMgc2VlOlxuICAgKiBodHRwOi8vZGV2ZWxvcGVyLmNocm9tZS5jb20vc3RhYmxlL2V4dGVuc2lvbnMvc2FuZGJveGluZ0V2YWwuaHRtbFxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHQgVGhlIHRlbXBsYXRlIHRleHQuXG4gICAqIEBwYXJhbSB7T2JlY3R9IGRhdGEgVGhlIGRhdGEgb2JqZWN0IHVzZWQgdG8gcG9wdWxhdGUgdGhlIHRleHQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogIGVzY2FwZSAtIFRoZSBcImVzY2FwZVwiIGRlbGltaXRlciByZWdleHAuXG4gICAqICBldmFsdWF0ZSAtIFRoZSBcImV2YWx1YXRlXCIgZGVsaW1pdGVyIHJlZ2V4cC5cbiAgICogIGludGVycG9sYXRlIC0gVGhlIFwiaW50ZXJwb2xhdGVcIiBkZWxpbWl0ZXIgcmVnZXhwLlxuICAgKiAgc291cmNlVVJMIC0gVGhlIHNvdXJjZVVSTCBvZiB0aGUgdGVtcGxhdGUncyBjb21waWxlZCBzb3VyY2UuXG4gICAqICB2YXJpYWJsZSAtIFRoZSBkYXRhIG9iamVjdCB2YXJpYWJsZSBuYW1lLlxuICAgKlxuICAgKiBAcmV0dXJucyB7RnVuY3Rpb258U3RyaW5nfSBSZXR1cm5zIGEgY29tcGlsZWQgZnVuY3Rpb24gd2hlbiBubyBgZGF0YWAgb2JqZWN0XG4gICAqICBpcyBnaXZlbiwgZWxzZSBpdCByZXR1cm5zIHRoZSBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogLy8gdXNpbmcgYSBjb21waWxlZCB0ZW1wbGF0ZVxuICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoZWxsbyA8JT0gbmFtZSAlPicpO1xuICAgKiBjb21waWxlZCh7ICduYW1lJzogJ21vZScgfSk7XG4gICAqIC8vID0+ICdoZWxsbyBtb2UnXG4gICAqXG4gICAqIHZhciBsaXN0ID0gJzwlIF8uZm9yRWFjaChwZW9wbGUsIGZ1bmN0aW9uKG5hbWUpIHsgJT48bGk+PCU9IG5hbWUgJT48L2xpPjwlIH0pOyAlPic7XG4gICAqIF8udGVtcGxhdGUobGlzdCwgeyAncGVvcGxlJzogWydtb2UnLCAnbGFycnknXSB9KTtcbiAgICogLy8gPT4gJzxsaT5tb2U8L2xpPjxsaT5sYXJyeTwvbGk+J1xuICAgKlxuICAgKiAvLyB1c2luZyB0aGUgXCJlc2NhcGVcIiBkZWxpbWl0ZXIgdG8gZXNjYXBlIEhUTUwgaW4gZGF0YSBwcm9wZXJ0eSB2YWx1ZXNcbiAgICogXy50ZW1wbGF0ZSgnPGI+PCUtIHZhbHVlICU+PC9iPicsIHsgJ3ZhbHVlJzogJzxzY3JpcHQ+JyB9KTtcbiAgICogLy8gPT4gJzxiPiZsdDtzY3JpcHQmZ3Q7PC9iPidcbiAgICpcbiAgICogLy8gdXNpbmcgdGhlIEVTNiBkZWxpbWl0ZXIgYXMgYW4gYWx0ZXJuYXRpdmUgdG8gdGhlIGRlZmF1bHQgXCJpbnRlcnBvbGF0ZVwiIGRlbGltaXRlclxuICAgKiBfLnRlbXBsYXRlKCdoZWxsbyAkeyBuYW1lIH0nLCB7ICduYW1lJzogJ2N1cmx5JyB9KTtcbiAgICogLy8gPT4gJ2hlbGxvIGN1cmx5J1xuICAgKlxuICAgKiAvLyB1c2luZyB0aGUgaW50ZXJuYWwgYHByaW50YCBmdW5jdGlvbiBpbiBcImV2YWx1YXRlXCIgZGVsaW1pdGVyc1xuICAgKiBfLnRlbXBsYXRlKCc8JSBwcmludChcImhlbGxvIFwiICsgZXBpdGhldCk7ICU+IScsIHsgJ2VwaXRoZXQnOiAnc3Rvb2dlJyB9KTtcbiAgICogLy8gPT4gJ2hlbGxvIHN0b29nZSEnXG4gICAqXG4gICAqIC8vIHVzaW5nIGN1c3RvbSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzXG4gICAqIF8udGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICogICAnaW50ZXJwb2xhdGUnOiAve3soW1xcc1xcU10rPyl9fS9nXG4gICAqIH07XG4gICAqXG4gICAqIF8udGVtcGxhdGUoJ2hlbGxvIHt7IG5hbWUgfX0hJywgeyAnbmFtZSc6ICdtdXN0YWNoZScgfSk7XG4gICAqIC8vID0+ICdoZWxsbyBtdXN0YWNoZSEnXG4gICAqXG4gICAqIC8vIHVzaW5nIHRoZSBgc291cmNlVVJMYCBvcHRpb24gdG8gc3BlY2lmeSBhIGN1c3RvbSBzb3VyY2VVUkwgZm9yIHRoZSB0ZW1wbGF0ZVxuICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoZWxsbyA8JT0gbmFtZSAlPicsIG51bGwsIHsgJ3NvdXJjZVVSTCc6ICcvYmFzaWMvZ3JlZXRpbmcuanN0JyB9KTtcbiAgICogY29tcGlsZWQoZGF0YSk7XG4gICAqIC8vID0+IGZpbmQgdGhlIHNvdXJjZSBvZiBcImdyZWV0aW5nLmpzdFwiIHVuZGVyIHRoZSBTb3VyY2VzIHRhYiBvciBSZXNvdXJjZXMgcGFuZWwgb2YgdGhlIHdlYiBpbnNwZWN0b3JcbiAgICpcbiAgICogLy8gdXNpbmcgdGhlIGB2YXJpYWJsZWAgb3B0aW9uIHRvIGVuc3VyZSBhIHdpdGgtc3RhdGVtZW50IGlzbid0IHVzZWQgaW4gdGhlIGNvbXBpbGVkIHRlbXBsYXRlXG4gICAqIHZhciBjb21waWxlZCA9IF8udGVtcGxhdGUoJ2hpIDwlPSBkYXRhLm5hbWUgJT4hJywgbnVsbCwgeyAndmFyaWFibGUnOiAnZGF0YScgfSk7XG4gICAqIGNvbXBpbGVkLnNvdXJjZTtcbiAgICogLy8gPT4gZnVuY3Rpb24oZGF0YSkge1xuICAgKiAgIHZhciBfX3QsIF9fcCA9ICcnLCBfX2UgPSBfLmVzY2FwZTtcbiAgICogICBfX3AgKz0gJ2hpICcgKyAoKF9fdCA9ICggZGF0YS5uYW1lICkpID09IG51bGwgPyAnJyA6IF9fdCkgKyAnISc7XG4gICAqICAgcmV0dXJuIF9fcDtcbiAgICogfVxuICAgKlxuICAgKiAvLyB1c2luZyB0aGUgYHNvdXJjZWAgcHJvcGVydHkgdG8gaW5saW5lIGNvbXBpbGVkIHRlbXBsYXRlcyBmb3IgbWVhbmluZ2Z1bFxuICAgKiAvLyBsaW5lIG51bWJlcnMgaW4gZXJyb3IgbWVzc2FnZXMgYW5kIGEgc3RhY2sgdHJhY2VcbiAgICogZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4oY3dkLCAnanN0LmpzJyksICdcXFxuICAgKiAgIHZhciBKU1QgPSB7XFxcbiAgICogICAgIFwibWFpblwiOiAnICsgXy50ZW1wbGF0ZShtYWluVGV4dCkuc291cmNlICsgJ1xcXG4gICAqICAgfTtcXFxuICAgKiAnKTtcbiAgICovXG4gIGZ1bmN0aW9uIHRlbXBsYXRlKHRleHQsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICAvLyBiYXNlZCBvbiBKb2huIFJlc2lnJ3MgYHRtcGxgIGltcGxlbWVudGF0aW9uXG4gICAgLy8gaHR0cDovL2Vqb2huLm9yZy9ibG9nL2phdmFzY3JpcHQtbWljcm8tdGVtcGxhdGluZy9cbiAgICAvLyBhbmQgTGF1cmEgRG9rdG9yb3ZhJ3MgZG9ULmpzXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL29sYWRvL2RvVFxuICAgIHZhciBzZXR0aW5ncyA9IGxvZGFzaC50ZW1wbGF0ZVNldHRpbmdzO1xuICAgIHRleHQgfHwgKHRleHQgPSAnJyk7XG5cbiAgICAvLyBhdm9pZCBtaXNzaW5nIGRlcGVuZGVuY2llcyB3aGVuIGBpdGVyYXRvclRlbXBsYXRlYCBpcyBub3QgZGVmaW5lZFxuICAgIG9wdGlvbnMgPSBkZWZhdWx0cyh7fSwgb3B0aW9ucywgc2V0dGluZ3MpO1xuXG4gICAgdmFyIGltcG9ydHMgPSBkZWZhdWx0cyh7fSwgb3B0aW9ucy5pbXBvcnRzLCBzZXR0aW5ncy5pbXBvcnRzKSxcbiAgICAgICAgaW1wb3J0c0tleXMgPSBrZXlzKGltcG9ydHMpLFxuICAgICAgICBpbXBvcnRzVmFsdWVzID0gdmFsdWVzKGltcG9ydHMpO1xuXG4gICAgdmFyIGlzRXZhbHVhdGluZyxcbiAgICAgICAgaW5kZXggPSAwLFxuICAgICAgICBpbnRlcnBvbGF0ZSA9IG9wdGlvbnMuaW50ZXJwb2xhdGUgfHwgcmVOb01hdGNoLFxuICAgICAgICBzb3VyY2UgPSBcIl9fcCArPSAnXCI7XG5cbiAgICAvLyBjb21waWxlIHJlZ2V4cCB0byBtYXRjaCBlYWNoIGRlbGltaXRlclxuICAgIHZhciByZURlbGltaXRlcnMgPSBSZWdFeHAoXG4gICAgICAob3B0aW9ucy5lc2NhcGUgfHwgcmVOb01hdGNoKS5zb3VyY2UgKyAnfCcgK1xuICAgICAgaW50ZXJwb2xhdGUuc291cmNlICsgJ3wnICtcbiAgICAgIChpbnRlcnBvbGF0ZSA9PT0gcmVJbnRlcnBvbGF0ZSA/IHJlRXNUZW1wbGF0ZSA6IHJlTm9NYXRjaCkuc291cmNlICsgJ3wnICtcbiAgICAgIChvcHRpb25zLmV2YWx1YXRlIHx8IHJlTm9NYXRjaCkuc291cmNlICsgJ3wkJ1xuICAgICwgJ2cnKTtcblxuICAgIHRleHQucmVwbGFjZShyZURlbGltaXRlcnMsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGVWYWx1ZSwgaW50ZXJwb2xhdGVWYWx1ZSwgZXNUZW1wbGF0ZVZhbHVlLCBldmFsdWF0ZVZhbHVlLCBvZmZzZXQpIHtcbiAgICAgIGludGVycG9sYXRlVmFsdWUgfHwgKGludGVycG9sYXRlVmFsdWUgPSBlc1RlbXBsYXRlVmFsdWUpO1xuXG4gICAgICAvLyBlc2NhcGUgY2hhcmFjdGVycyB0aGF0IGNhbm5vdCBiZSBpbmNsdWRlZCBpbiBzdHJpbmcgbGl0ZXJhbHNcbiAgICAgIHNvdXJjZSArPSB0ZXh0LnNsaWNlKGluZGV4LCBvZmZzZXQpLnJlcGxhY2UocmVVbmVzY2FwZWRTdHJpbmcsIGVzY2FwZVN0cmluZ0NoYXIpO1xuXG4gICAgICAvLyByZXBsYWNlIGRlbGltaXRlcnMgd2l0aCBzbmlwcGV0c1xuICAgICAgaWYgKGVzY2FwZVZhbHVlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIicgK1xcbl9fZShcIiArIGVzY2FwZVZhbHVlICsgXCIpICtcXG4nXCI7XG4gICAgICB9XG4gICAgICBpZiAoZXZhbHVhdGVWYWx1ZSkge1xuICAgICAgICBpc0V2YWx1YXRpbmcgPSB0cnVlO1xuICAgICAgICBzb3VyY2UgKz0gXCInO1xcblwiICsgZXZhbHVhdGVWYWx1ZSArIFwiO1xcbl9fcCArPSAnXCI7XG4gICAgICB9XG4gICAgICBpZiAoaW50ZXJwb2xhdGVWYWx1ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInICtcXG4oKF9fdCA9IChcIiArIGludGVycG9sYXRlVmFsdWUgKyBcIikpID09IG51bGwgPyAnJyA6IF9fdCkgK1xcbidcIjtcbiAgICAgIH1cbiAgICAgIGluZGV4ID0gb2Zmc2V0ICsgbWF0Y2gubGVuZ3RoO1xuXG4gICAgICAvLyB0aGUgSlMgZW5naW5lIGVtYmVkZGVkIGluIEFkb2JlIHByb2R1Y3RzIHJlcXVpcmVzIHJldHVybmluZyB0aGUgYG1hdGNoYFxuICAgICAgLy8gc3RyaW5nIGluIG9yZGVyIHRvIHByb2R1Y2UgdGhlIGNvcnJlY3QgYG9mZnNldGAgdmFsdWVcbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAvLyBpZiBgdmFyaWFibGVgIGlzIG5vdCBzcGVjaWZpZWQgYW5kIHRoZSB0ZW1wbGF0ZSBjb250YWlucyBcImV2YWx1YXRlXCJcbiAgICAvLyBkZWxpbWl0ZXJzLCB3cmFwIGEgd2l0aC1zdGF0ZW1lbnQgYXJvdW5kIHRoZSBnZW5lcmF0ZWQgY29kZSB0byBhZGQgdGhlXG4gICAgLy8gZGF0YSBvYmplY3QgdG8gdGhlIHRvcCBvZiB0aGUgc2NvcGUgY2hhaW5cbiAgICB2YXIgdmFyaWFibGUgPSBvcHRpb25zLnZhcmlhYmxlLFxuICAgICAgICBoYXNWYXJpYWJsZSA9IHZhcmlhYmxlO1xuXG4gICAgaWYgKCFoYXNWYXJpYWJsZSkge1xuICAgICAgdmFyaWFibGUgPSAnb2JqJztcbiAgICAgIHNvdXJjZSA9ICd3aXRoICgnICsgdmFyaWFibGUgKyAnKSB7XFxuJyArIHNvdXJjZSArICdcXG59XFxuJztcbiAgICB9XG4gICAgLy8gY2xlYW51cCBjb2RlIGJ5IHN0cmlwcGluZyBlbXB0eSBzdHJpbmdzXG4gICAgc291cmNlID0gKGlzRXZhbHVhdGluZyA/IHNvdXJjZS5yZXBsYWNlKHJlRW1wdHlTdHJpbmdMZWFkaW5nLCAnJykgOiBzb3VyY2UpXG4gICAgICAucmVwbGFjZShyZUVtcHR5U3RyaW5nTWlkZGxlLCAnJDEnKVxuICAgICAgLnJlcGxhY2UocmVFbXB0eVN0cmluZ1RyYWlsaW5nLCAnJDE7Jyk7XG5cbiAgICAvLyBmcmFtZSBjb2RlIGFzIHRoZSBmdW5jdGlvbiBib2R5XG4gICAgc291cmNlID0gJ2Z1bmN0aW9uKCcgKyB2YXJpYWJsZSArICcpIHtcXG4nICtcbiAgICAgIChoYXNWYXJpYWJsZSA/ICcnIDogdmFyaWFibGUgKyAnIHx8ICgnICsgdmFyaWFibGUgKyAnID0ge30pO1xcbicpICtcbiAgICAgIFwidmFyIF9fdCwgX19wID0gJycsIF9fZSA9IF8uZXNjYXBlXCIgK1xuICAgICAgKGlzRXZhbHVhdGluZ1xuICAgICAgICA/ICcsIF9faiA9IEFycmF5LnByb3RvdHlwZS5qb2luO1xcbicgK1xuICAgICAgICAgIFwiZnVuY3Rpb24gcHJpbnQoKSB7IF9fcCArPSBfX2ouY2FsbChhcmd1bWVudHMsICcnKSB9XFxuXCJcbiAgICAgICAgOiAnO1xcbidcbiAgICAgICkgK1xuICAgICAgc291cmNlICtcbiAgICAgICdyZXR1cm4gX19wXFxufSc7XG5cbiAgICAvLyBVc2UgYSBzb3VyY2VVUkwgZm9yIGVhc2llciBkZWJ1Z2dpbmcgYW5kIHdyYXAgaW4gYSBtdWx0aS1saW5lIGNvbW1lbnQgdG9cbiAgICAvLyBhdm9pZCBpc3N1ZXMgd2l0aCBOYXJ3aGFsLCBJRSBjb25kaXRpb25hbCBjb21waWxhdGlvbiwgYW5kIHRoZSBKUyBlbmdpbmVcbiAgICAvLyBlbWJlZGRlZCBpbiBBZG9iZSBwcm9kdWN0cy5cbiAgICAvLyBodHRwOi8vd3d3Lmh0bWw1cm9ja3MuY29tL2VuL3R1dG9yaWFscy9kZXZlbG9wZXJ0b29scy9zb3VyY2VtYXBzLyN0b2Mtc291cmNldXJsXG4gICAgdmFyIHNvdXJjZVVSTCA9ICdcXG4vKlxcbi8vQCBzb3VyY2VVUkw9JyArIChvcHRpb25zLnNvdXJjZVVSTCB8fCAnL2xvZGFzaC90ZW1wbGF0ZS9zb3VyY2VbJyArICh0ZW1wbGF0ZUNvdW50ZXIrKykgKyAnXScpICsgJ1xcbiovJztcblxuICAgIHRyeSB7XG4gICAgICB2YXIgcmVzdWx0ID0gRnVuY3Rpb24oaW1wb3J0c0tleXMsICdyZXR1cm4gJyArIHNvdXJjZSArIHNvdXJjZVVSTCkuYXBwbHkodW5kZWZpbmVkLCBpbXBvcnRzVmFsdWVzKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIHJldHVybiByZXN1bHQoZGF0YSk7XG4gICAgfVxuICAgIC8vIHByb3ZpZGUgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uJ3Mgc291cmNlIHZpYSBpdHMgYHRvU3RyaW5nYCBtZXRob2QsIGluXG4gICAgLy8gc3VwcG9ydGVkIGVudmlyb25tZW50cywgb3IgdGhlIGBzb3VyY2VgIHByb3BlcnR5IGFzIGEgY29udmVuaWVuY2UgZm9yXG4gICAgLy8gaW5saW5pbmcgY29tcGlsZWQgdGVtcGxhdGVzIGR1cmluZyB0aGUgYnVpbGQgcHJvY2Vzc1xuICAgIHJlc3VsdC5zb3VyY2UgPSBzb3VyY2U7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyB0aGUgYGNhbGxiYWNrYCBmdW5jdGlvbiBgbmAgdGltZXMsIHJldHVybmluZyBhbiBhcnJheSBvZiB0aGUgcmVzdWx0c1xuICAgKiBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLiBUaGUgYGNhbGxiYWNrYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWRcbiAgICogd2l0aCBvbmUgYXJndW1lbnQ7IChpbmRleCkuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge051bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRvIGV4ZWN1dGUgdGhlIGNhbGxiYWNrLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cbiAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggYGNhbGxiYWNrYCBleGVjdXRpb24uXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIHZhciBkaWNlUm9sbHMgPSBfLnRpbWVzKDMsIF8ucGFydGlhbChfLnJhbmRvbSwgMSwgNikpO1xuICAgKiAvLyA9PiBbMywgNiwgNF1cbiAgICpcbiAgICogXy50aW1lcygzLCBmdW5jdGlvbihuKSB7IG1hZ2UuY2FzdFNwZWxsKG4pOyB9KTtcbiAgICogLy8gPT4gY2FsbHMgYG1hZ2UuY2FzdFNwZWxsKG4pYCB0aHJlZSB0aW1lcywgcGFzc2luZyBgbmAgb2YgYDBgLCBgMWAsIGFuZCBgMmAgcmVzcGVjdGl2ZWx5XG4gICAqXG4gICAqIF8udGltZXMoMywgZnVuY3Rpb24obikgeyB0aGlzLmNhc3Qobik7IH0sIG1hZ2UpO1xuICAgKiAvLyA9PiBhbHNvIGNhbGxzIGBtYWdlLmNhc3RTcGVsbChuKWAgdGhyZWUgdGltZXNcbiAgICovXG4gIGZ1bmN0aW9uIHRpbWVzKG4sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgbiA9ICtuIHx8IDA7XG4gICAgdmFyIGluZGV4ID0gLTEsXG4gICAgICAgIHJlc3VsdCA9IEFycmF5KG4pO1xuXG4gICAgd2hpbGUgKCsraW5kZXggPCBuKSB7XG4gICAgICByZXN1bHRbaW5kZXhdID0gY2FsbGJhY2suY2FsbCh0aGlzQXJnLCBpbmRleCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmVzY2FwZWAsIHRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZSBIVE1MIGVudGl0aWVzXG4gICAqIGAmYW1wO2AsIGAmbHQ7YCwgYCZndDtgLCBgJnF1b3Q7YCwgYW5kIGAmIzM5O2AgaW4gYHN0cmluZ2AgdG8gdGhlaXJcbiAgICogY29ycmVzcG9uZGluZyBjaGFyYWN0ZXJzLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgc3RyaW5nIHRvIHVuZXNjYXBlLlxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSB1bmVzY2FwZWQgc3RyaW5nLlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnVuZXNjYXBlKCdNb2UsIExhcnJ5ICZhbXA7IEN1cmx5Jyk7XG4gICAqIC8vID0+ICdNb2UsIExhcnJ5ICYgQ3VybHknXG4gICAqL1xuICBmdW5jdGlvbiB1bmVzY2FwZShzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nID09IG51bGwgPyAnJyA6IChzdHJpbmcgKyAnJykucmVwbGFjZShyZUVzY2FwZWRIdG1sLCB1bmVzY2FwZUh0bWxDaGFyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSB1bmlxdWUgSUQuIElmIGBwcmVmaXhgIGlzIHBhc3NlZCwgdGhlIElEIHdpbGwgYmUgYXBwZW5kZWQgdG8gaXQuXG4gICAqXG4gICAqIEBzdGF0aWNcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gW3ByZWZpeF0gVGhlIHZhbHVlIHRvIHByZWZpeCB0aGUgSUQgd2l0aC5cbiAgICogQHJldHVybnMge1N0cmluZ30gUmV0dXJucyB0aGUgdW5pcXVlIElELlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfLnVuaXF1ZUlkKCdjb250YWN0XycpO1xuICAgKiAvLyA9PiAnY29udGFjdF8xMDQnXG4gICAqXG4gICAqIF8udW5pcXVlSWQoKTtcbiAgICogLy8gPT4gJzEwNSdcbiAgICovXG4gIGZ1bmN0aW9uIHVuaXF1ZUlkKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyO1xuICAgIHJldHVybiAocHJlZml4ID09IG51bGwgPyAnJyA6IHByZWZpeCArICcnKSArIGlkO1xuICB9XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIEludm9rZXMgYGludGVyY2VwdG9yYCB3aXRoIHRoZSBgdmFsdWVgIGFzIHRoZSBmaXJzdCBhcmd1bWVudCwgYW5kIHRoZW5cbiAgICogcmV0dXJucyBgdmFsdWVgLiBUaGUgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2QgY2hhaW4sXG4gICAqIGluIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW4gdGhlIGNoYWluLlxuICAgKlxuICAgKiBAc3RhdGljXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcGFzcyB0byBgaW50ZXJjZXB0b3JgLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBpbnRlcmNlcHRvciBUaGUgZnVuY3Rpb24gdG8gaW52b2tlLlxuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgYHZhbHVlYC5cbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogXyhbMSwgMiwgMywgNF0pXG4gICAqICAuZmlsdGVyKGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtICUgMiA9PSAwOyB9KVxuICAgKiAgLnRhcChhbGVydClcbiAgICogIC5tYXAoZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gKiBudW07IH0pXG4gICAqICAudmFsdWUoKTtcbiAgICogLy8gPT4gLy8gWzIsIDRdIChhbGVydGVkKVxuICAgKiAvLyA9PiBbNCwgMTZdXG4gICAqL1xuICBmdW5jdGlvbiB0YXAodmFsdWUsIGludGVyY2VwdG9yKSB7XG4gICAgaW50ZXJjZXB0b3IodmFsdWUpO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlcyB0aGUgYHRvU3RyaW5nYCByZXN1bHQgb2YgdGhlIHdyYXBwZWQgdmFsdWUuXG4gICAqXG4gICAqIEBuYW1lIHRvU3RyaW5nXG4gICAqIEBtZW1iZXJPZiBfXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBSZXR1cm5zIHRoZSBzdHJpbmcgcmVzdWx0LlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiBfKFsxLCAyLCAzXSkudG9TdHJpbmcoKTtcbiAgICogLy8gPT4gJzEsMiwzJ1xuICAgKi9cbiAgZnVuY3Rpb24gd3JhcHBlclRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9fd3JhcHBlZF9fICsgJyc7XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdHMgdGhlIHdyYXBwZWQgdmFsdWUuXG4gICAqXG4gICAqIEBuYW1lIHZhbHVlT2ZcbiAgICogQG1lbWJlck9mIF9cbiAgICogQGFsaWFzIHZhbHVlXG4gICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xuICAgKiBAcmV0dXJucyB7TWl4ZWR9IFJldHVybnMgdGhlIHdyYXBwZWQgdmFsdWUuXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIF8oWzEsIDIsIDNdKS52YWx1ZU9mKCk7XG4gICAqIC8vID0+IFsxLCAyLCAzXVxuICAgKi9cbiAgZnVuY3Rpb24gd3JhcHBlclZhbHVlT2YoKSB7XG4gICAgcmV0dXJuIHRoaXMuX193cmFwcGVkX187XG4gIH1cblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBhZGQgZnVuY3Rpb25zIHRoYXQgcmV0dXJuIHdyYXBwZWQgdmFsdWVzIHdoZW4gY2hhaW5pbmdcbiAgbG9kYXNoLmFmdGVyID0gYWZ0ZXI7XG4gIGxvZGFzaC5hc3NpZ24gPSBhc3NpZ247XG4gIGxvZGFzaC5hdCA9IGF0O1xuICBsb2Rhc2guYmluZCA9IGJpbmQ7XG4gIGxvZGFzaC5iaW5kQWxsID0gYmluZEFsbDtcbiAgbG9kYXNoLmJpbmRLZXkgPSBiaW5kS2V5O1xuICBsb2Rhc2guY29tcGFjdCA9IGNvbXBhY3Q7XG4gIGxvZGFzaC5jb21wb3NlID0gY29tcG9zZTtcbiAgbG9kYXNoLmNvdW50QnkgPSBjb3VudEJ5O1xuICBsb2Rhc2guZGVib3VuY2UgPSBkZWJvdW5jZTtcbiAgbG9kYXNoLmRlZmF1bHRzID0gZGVmYXVsdHM7XG4gIGxvZGFzaC5kZWZlciA9IGRlZmVyO1xuICBsb2Rhc2guZGVsYXkgPSBkZWxheTtcbiAgbG9kYXNoLmRpZmZlcmVuY2UgPSBkaWZmZXJlbmNlO1xuICBsb2Rhc2guZmlsdGVyID0gZmlsdGVyO1xuICBsb2Rhc2guZmxhdHRlbiA9IGZsYXR0ZW47XG4gIGxvZGFzaC5mb3JFYWNoID0gZm9yRWFjaDtcbiAgbG9kYXNoLmZvckluID0gZm9ySW47XG4gIGxvZGFzaC5mb3JPd24gPSBmb3JPd247XG4gIGxvZGFzaC5mdW5jdGlvbnMgPSBmdW5jdGlvbnM7XG4gIGxvZGFzaC5ncm91cEJ5ID0gZ3JvdXBCeTtcbiAgbG9kYXNoLmluaXRpYWwgPSBpbml0aWFsO1xuICBsb2Rhc2guaW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0aW9uO1xuICBsb2Rhc2guaW52ZXJ0ID0gaW52ZXJ0O1xuICBsb2Rhc2guaW52b2tlID0gaW52b2tlO1xuICBsb2Rhc2gua2V5cyA9IGtleXM7XG4gIGxvZGFzaC5tYXAgPSBtYXA7XG4gIGxvZGFzaC5tYXggPSBtYXg7XG4gIGxvZGFzaC5tZW1vaXplID0gbWVtb2l6ZTtcbiAgbG9kYXNoLm1lcmdlID0gbWVyZ2U7XG4gIGxvZGFzaC5taW4gPSBtaW47XG4gIGxvZGFzaC5vYmplY3QgPSBvYmplY3Q7XG4gIGxvZGFzaC5vbWl0ID0gb21pdDtcbiAgbG9kYXNoLm9uY2UgPSBvbmNlO1xuICBsb2Rhc2gucGFpcnMgPSBwYWlycztcbiAgbG9kYXNoLnBhcnRpYWwgPSBwYXJ0aWFsO1xuICBsb2Rhc2gucGFydGlhbFJpZ2h0ID0gcGFydGlhbFJpZ2h0O1xuICBsb2Rhc2gucGljayA9IHBpY2s7XG4gIGxvZGFzaC5wbHVjayA9IHBsdWNrO1xuICBsb2Rhc2gucmFuZ2UgPSByYW5nZTtcbiAgbG9kYXNoLnJlamVjdCA9IHJlamVjdDtcbiAgbG9kYXNoLnJlc3QgPSByZXN0O1xuICBsb2Rhc2guc2h1ZmZsZSA9IHNodWZmbGU7XG4gIGxvZGFzaC5zb3J0QnkgPSBzb3J0Qnk7XG4gIGxvZGFzaC50YXAgPSB0YXA7XG4gIGxvZGFzaC50aHJvdHRsZSA9IHRocm90dGxlO1xuICBsb2Rhc2gudGltZXMgPSB0aW1lcztcbiAgbG9kYXNoLnRvQXJyYXkgPSB0b0FycmF5O1xuICBsb2Rhc2gudW5pb24gPSB1bmlvbjtcbiAgbG9kYXNoLnVuaXEgPSB1bmlxO1xuICBsb2Rhc2gudmFsdWVzID0gdmFsdWVzO1xuICBsb2Rhc2gud2hlcmUgPSB3aGVyZTtcbiAgbG9kYXNoLndpdGhvdXQgPSB3aXRob3V0O1xuICBsb2Rhc2gud3JhcCA9IHdyYXA7XG4gIGxvZGFzaC56aXAgPSB6aXA7XG5cbiAgLy8gYWRkIGFsaWFzZXNcbiAgbG9kYXNoLmNvbGxlY3QgPSBtYXA7XG4gIGxvZGFzaC5kcm9wID0gcmVzdDtcbiAgbG9kYXNoLmVhY2ggPSBmb3JFYWNoO1xuICBsb2Rhc2guZXh0ZW5kID0gYXNzaWduO1xuICBsb2Rhc2gubWV0aG9kcyA9IGZ1bmN0aW9ucztcbiAgbG9kYXNoLnNlbGVjdCA9IGZpbHRlcjtcbiAgbG9kYXNoLnRhaWwgPSByZXN0O1xuICBsb2Rhc2gudW5pcXVlID0gdW5pcTtcblxuICAvLyBhZGQgZnVuY3Rpb25zIHRvIGBsb2Rhc2gucHJvdG90eXBlYFxuICBtaXhpbihsb2Rhc2gpO1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGFkZCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gdW53cmFwcGVkIHZhbHVlcyB3aGVuIGNoYWluaW5nXG4gIGxvZGFzaC5jbG9uZSA9IGNsb25lO1xuICBsb2Rhc2guY2xvbmVEZWVwID0gY2xvbmVEZWVwO1xuICBsb2Rhc2guY29udGFpbnMgPSBjb250YWlucztcbiAgbG9kYXNoLmVzY2FwZSA9IGVzY2FwZTtcbiAgbG9kYXNoLmV2ZXJ5ID0gZXZlcnk7XG4gIGxvZGFzaC5maW5kID0gZmluZDtcbiAgbG9kYXNoLmhhcyA9IGhhcztcbiAgbG9kYXNoLmlkZW50aXR5ID0gaWRlbnRpdHk7XG4gIGxvZGFzaC5pbmRleE9mID0gaW5kZXhPZjtcbiAgbG9kYXNoLmlzQXJndW1lbnRzID0gaXNBcmd1bWVudHM7XG4gIGxvZGFzaC5pc0FycmF5ID0gaXNBcnJheTtcbiAgbG9kYXNoLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcbiAgbG9kYXNoLmlzRGF0ZSA9IGlzRGF0ZTtcbiAgbG9kYXNoLmlzRWxlbWVudCA9IGlzRWxlbWVudDtcbiAgbG9kYXNoLmlzRW1wdHkgPSBpc0VtcHR5O1xuICBsb2Rhc2guaXNFcXVhbCA9IGlzRXF1YWw7XG4gIGxvZGFzaC5pc0Zpbml0ZSA9IGlzRmluaXRlO1xuICBsb2Rhc2guaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG4gIGxvZGFzaC5pc05hTiA9IGlzTmFOO1xuICBsb2Rhc2guaXNOdWxsID0gaXNOdWxsO1xuICBsb2Rhc2guaXNOdW1iZXIgPSBpc051bWJlcjtcbiAgbG9kYXNoLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG4gIGxvZGFzaC5pc1BsYWluT2JqZWN0ID0gaXNQbGFpbk9iamVjdDtcbiAgbG9kYXNoLmlzUmVnRXhwID0gaXNSZWdFeHA7XG4gIGxvZGFzaC5pc1N0cmluZyA9IGlzU3RyaW5nO1xuICBsb2Rhc2guaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcbiAgbG9kYXNoLmxhc3RJbmRleE9mID0gbGFzdEluZGV4T2Y7XG4gIGxvZGFzaC5taXhpbiA9IG1peGluO1xuICBsb2Rhc2gubm9Db25mbGljdCA9IG5vQ29uZmxpY3Q7XG4gIGxvZGFzaC5yYW5kb20gPSByYW5kb207XG4gIGxvZGFzaC5yZWR1Y2UgPSByZWR1Y2U7XG4gIGxvZGFzaC5yZWR1Y2VSaWdodCA9IHJlZHVjZVJpZ2h0O1xuICBsb2Rhc2gucmVzdWx0ID0gcmVzdWx0O1xuICBsb2Rhc2guc2l6ZSA9IHNpemU7XG4gIGxvZGFzaC5zb21lID0gc29tZTtcbiAgbG9kYXNoLnNvcnRlZEluZGV4ID0gc29ydGVkSW5kZXg7XG4gIGxvZGFzaC50ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuICBsb2Rhc2gudW5lc2NhcGUgPSB1bmVzY2FwZTtcbiAgbG9kYXNoLnVuaXF1ZUlkID0gdW5pcXVlSWQ7XG5cbiAgLy8gYWRkIGFsaWFzZXNcbiAgbG9kYXNoLmFsbCA9IGV2ZXJ5O1xuICBsb2Rhc2guYW55ID0gc29tZTtcbiAgbG9kYXNoLmRldGVjdCA9IGZpbmQ7XG4gIGxvZGFzaC5mb2xkbCA9IHJlZHVjZTtcbiAgbG9kYXNoLmZvbGRyID0gcmVkdWNlUmlnaHQ7XG4gIGxvZGFzaC5pbmNsdWRlID0gY29udGFpbnM7XG4gIGxvZGFzaC5pbmplY3QgPSByZWR1Y2U7XG5cbiAgZm9yT3duKGxvZGFzaCwgZnVuY3Rpb24oZnVuYywgbWV0aG9kTmFtZSkge1xuICAgIGlmICghbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSkge1xuICAgICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncyA9IFt0aGlzLl9fd3JhcHBlZF9fXTtcbiAgICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseShsb2Rhc2gsIGFyZ3MpO1xuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGFkZCBmdW5jdGlvbnMgY2FwYWJsZSBvZiByZXR1cm5pbmcgd3JhcHBlZCBhbmQgdW53cmFwcGVkIHZhbHVlcyB3aGVuIGNoYWluaW5nXG4gIGxvZGFzaC5maXJzdCA9IGZpcnN0O1xuICBsb2Rhc2gubGFzdCA9IGxhc3Q7XG5cbiAgLy8gYWRkIGFsaWFzZXNcbiAgbG9kYXNoLnRha2UgPSBmaXJzdDtcbiAgbG9kYXNoLmhlYWQgPSBmaXJzdDtcblxuICBmb3JPd24obG9kYXNoLCBmdW5jdGlvbihmdW5jLCBtZXRob2ROYW1lKSB7XG4gICAgaWYgKCFsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdKSB7XG4gICAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdPSBmdW5jdGlvbihjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYyh0aGlzLl9fd3JhcHBlZF9fLCBjYWxsYmFjaywgdGhpc0FyZyk7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayA9PSBudWxsIHx8ICh0aGlzQXJnICYmIHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKVxuICAgICAgICAgID8gcmVzdWx0XG4gICAgICAgICAgOiBuZXcgbG9kYXNoKHJlc3VsdCk7XG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIFRoZSBzZW1hbnRpYyB2ZXJzaW9uIG51bWJlci5cbiAgICpcbiAgICogQHN0YXRpY1xuICAgKiBAbWVtYmVyT2YgX1xuICAgKiBAdHlwZSBTdHJpbmdcbiAgICovXG4gIGxvZGFzaC5WRVJTSU9OID0gJzEuMC4yJztcblxuICAvLyBhZGQgXCJDaGFpbmluZ1wiIGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlclxuICBsb2Rhc2gucHJvdG90eXBlLnRvU3RyaW5nID0gd3JhcHBlclRvU3RyaW5nO1xuICBsb2Rhc2gucHJvdG90eXBlLnZhbHVlID0gd3JhcHBlclZhbHVlT2Y7XG4gIGxvZGFzaC5wcm90b3R5cGUudmFsdWVPZiA9IHdyYXBwZXJWYWx1ZU9mO1xuXG4gIC8vIGFkZCBgQXJyYXlgIGZ1bmN0aW9ucyB0aGF0IHJldHVybiB1bndyYXBwZWQgdmFsdWVzXG4gIGVhY2goWydqb2luJywgJ3BvcCcsICdzaGlmdCddLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgdmFyIGZ1bmMgPSBhcnJheVJlZlttZXRob2ROYW1lXTtcbiAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLl9fd3JhcHBlZF9fLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIGFkZCBgQXJyYXlgIGZ1bmN0aW9ucyB0aGF0IHJldHVybiB0aGUgd3JhcHBlZCB2YWx1ZVxuICBlYWNoKFsncHVzaCcsICdyZXZlcnNlJywgJ3NvcnQnLCAndW5zaGlmdCddLCBmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgdmFyIGZ1bmMgPSBhcnJheVJlZlttZXRob2ROYW1lXTtcbiAgICBsb2Rhc2gucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICBmdW5jLmFwcGx5KHRoaXMuX193cmFwcGVkX18sIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICB9KTtcblxuICAvLyBhZGQgYEFycmF5YCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gbmV3IHdyYXBwZWQgdmFsdWVzXG4gIGVhY2goWydjb25jYXQnLCAnc2xpY2UnLCAnc3BsaWNlJ10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcbiAgICB2YXIgZnVuYyA9IGFycmF5UmVmW21ldGhvZE5hbWVdO1xuICAgIGxvZGFzaC5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgbG9kYXNoKGZ1bmMuYXBwbHkodGhpcy5fX3dyYXBwZWRfXywgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gZXhwb3NlIExvLURhc2hcbiAgLy8gc29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgLy8gRXhwb3NlIExvLURhc2ggdG8gdGhlIGdsb2JhbCBvYmplY3QgZXZlbiB3aGVuIGFuIEFNRCBsb2FkZXIgaXMgcHJlc2VudCBpblxuICAgIC8vIGNhc2UgTG8tRGFzaCB3YXMgaW5qZWN0ZWQgYnkgYSB0aGlyZC1wYXJ0eSBzY3JpcHQgYW5kIG5vdCBpbnRlbmRlZCB0byBiZVxuICAgIC8vIGxvYWRlZCBhcyBhIG1vZHVsZS4gVGhlIGdsb2JhbCBhc3NpZ25tZW50IGNhbiBiZSByZXZlcnRlZCBpbiB0aGUgTG8tRGFzaFxuICAgIC8vIG1vZHVsZSB2aWEgaXRzIGBub0NvbmZsaWN0KClgIG1ldGhvZC5cbiAgICB3aW5kb3cuXyA9IGxvZGFzaDtcblxuICAgIC8vIGRlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXG4gICAgLy8gcmVmZXJlbmNlZCBhcyB0aGUgXCJ1bmRlcnNjb3JlXCIgbW9kdWxlXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGxvZGFzaDtcbiAgICB9KTtcbiAgfVxuICAvLyBjaGVjayBmb3IgYGV4cG9ydHNgIGFmdGVyIGBkZWZpbmVgIGluIGNhc2UgYSBidWlsZCBvcHRpbWl6ZXIgYWRkcyBhbiBgZXhwb3J0c2Agb2JqZWN0XG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzKSB7XG4gICAgLy8gaW4gTm9kZS5qcyBvciBSaW5nb0pTIHYwLjguMCtcbiAgICBpZiAoZnJlZU1vZHVsZSkge1xuICAgICAgKGZyZWVNb2R1bGUuZXhwb3J0cyA9IGxvZGFzaCkuXyA9IGxvZGFzaDtcbiAgICB9XG4gICAgLy8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cbiAgICBlbHNlIHtcbiAgICAgIGZyZWVFeHBvcnRzLl8gPSBsb2Rhc2g7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIC8vIGluIGEgYnJvd3NlciBvciBSaGlub1xuICAgIHdpbmRvdy5fID0gbG9kYXNoO1xuICB9XG59KHRoaXMpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvTWNGbHknKTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KCk7XG5cbnZhciBfRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4vRGlzcGF0Y2hlcicpO1xuXG52YXIgX0Rpc3BhdGNoZXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfRGlzcGF0Y2hlcik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTsgfSB9XG5cbmZ1bmN0aW9uIHJlVGhyb3cocmVqZWN0LCBlcnJvcikge1xuICBpZiAoZXJyb3IgJiYgZXJyb3Iuc3RhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKGVycm9yLnN0YWNrKTtcbiAgfVxuICByZXR1cm4gcmVqZWN0KGVycm9yKTtcbn1cblxuLyoqXG4gKiBBY3Rpb24gY2xhc3NcbiAqL1xuXG52YXIgQWN0aW9uID0gZnVuY3Rpb24gKCkge1xuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RzIGFuIEFjdGlvbiBvYmplY3RcbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBtZXRob2QgZm9yIEFjdGlvblxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG5cbiAgZnVuY3Rpb24gQWN0aW9uKGNhbGxiYWNrKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEFjdGlvbik7XG5cbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgY2FsbGJhY2sgbWV0aG9kIGZyb20gRGlzcGF0Y2hlclxuICAgKlxuICAgKiBAcGFyYW0gey4uLip9IGFyZ3VtZW50cyAtIGFyZ3VtZW50cyBmb3IgY2FsbGJhY2sgbWV0aG9kXG4gICAqIEByZXR1cm5zIFByb21pc2Ugb2JqZWN0XG4gICAqL1xuXG5cbiAgX2NyZWF0ZUNsYXNzKEFjdGlvbiwgW3tcbiAgICBrZXk6ICdkaXNwYXRjaCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGRpc3BhdGNoKCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpLnRoZW4oZnVuY3Rpb24gKHBheWxvYWQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICBpZiAoIXBheWxvYWQpIHJldHVybiByZVRocm93KHJlamVjdCwgJ1BheWxvYWQgbmVlZHMgdG8gYmUgYW4gb2JqZWN0Jyk7XG4gICAgICAgICAgaWYgKCFwYXlsb2FkLmFjdGlvblR5cGUpIHJldHVybiByZVRocm93KHJlamVjdCwgJ1BheWxvYWQgb2JqZWN0IHJlcXVpcmVzIGFuIGFjdGlvblR5cGUgcHJvcGVydHknKTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBfRGlzcGF0Y2hlcjIuZGVmYXVsdC5kaXNwYXRjaChwYXlsb2FkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmVUaHJvdyhyZWplY3QsIGVycm9yKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIEFjdGlvbjtcbn0oKTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gQWN0aW9uOyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9BY3Rpb24gPSByZXF1aXJlKCcuL0FjdGlvbicpO1xuXG52YXIgX0FjdGlvbjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9BY3Rpb24pO1xuXG52YXIgX29iamVjdEFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIF9vYmplY3RBc3NpZ24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfb2JqZWN0QXNzaWduKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuLyoqXG4gKiBBY3Rpb25zRmFjdG9yeSBjbGFzc1xuICovXG5cbnZhciBBY3Rpb25zRmFjdG9yeSA9XG5cbi8qKlxuICogQ29uc3RydWN0cyBhbiBBY3Rpb25zRmFjdG9yeSBvYmplY3QgYW5kIHRyYW5zbGF0ZXMgYWN0aW9ucyBwYXJhbWV0ZXIgaW50b1xuICogQWN0aW9uIG9iamVjdHMuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IGFjdGlvbnMgLSBPYmplY3Qgd2l0aCBtZXRob2RzIHRvIGNyZWF0ZSBhY3Rpb25zIHdpdGhcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBBY3Rpb25zRmFjdG9yeShhY3Rpb25zKSB7XG4gIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBBY3Rpb25zRmFjdG9yeSk7XG5cbiAgdmFyIF9hY3Rpb25zID0ge307XG4gIGZvciAodmFyIGEgaW4gYWN0aW9ucykge1xuICAgIGlmIChhY3Rpb25zLmhhc093blByb3BlcnR5KGEpKSB7XG4gICAgICB2YXIgYWN0aW9uID0gbmV3IF9BY3Rpb24yLmRlZmF1bHQoYWN0aW9uc1thXSk7XG4gICAgICBfYWN0aW9uc1thXSA9IGFjdGlvbi5kaXNwYXRjaC5iaW5kKGFjdGlvbik7XG4gICAgfVxuICB9XG4gICgwLCBfb2JqZWN0QXNzaWduMi5kZWZhdWx0KSh0aGlzLCBfYWN0aW9ucyk7XG59O1xuXG5leHBvcnRzLmRlZmF1bHQgPSBBY3Rpb25zRmFjdG9yeTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfZmx1eCA9IHJlcXVpcmUoJ2ZsdXgnKTtcblxuLyoqIENyZWF0ZXMgYSBzaW5nbGFyIGluc3RhbmNlIG9mIEZhY2Vib29rJ3MgRGlzcGF0Y2hlciAqL1xudmFyIGFwcERpc3BhdGNoZXIgPSBuZXcgX2ZsdXguRGlzcGF0Y2hlcigpO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBhcHBEaXNwYXRjaGVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIF9jcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0oKTtcblxudmFyIF9EaXNwYXRjaGVyID0gcmVxdWlyZSgnLi9EaXNwYXRjaGVyJyk7XG5cbnZhciBfRGlzcGF0Y2hlcjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9EaXNwYXRjaGVyKTtcblxudmFyIF9TdG9yZSA9IHJlcXVpcmUoJy4vU3RvcmUnKTtcblxudmFyIF9TdG9yZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9TdG9yZSk7XG5cbnZhciBfQWN0aW9uc0ZhY3RvcnkgPSByZXF1aXJlKCcuL0FjdGlvbnNGYWN0b3J5Jyk7XG5cbnZhciBfQWN0aW9uc0ZhY3RvcnkyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfQWN0aW9uc0ZhY3RvcnkpO1xuXG52YXIgX29iamVjdEFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIF9vYmplY3RBc3NpZ24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfb2JqZWN0QXNzaWduKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuLyoqXG4gKiBNYWluIE1jRmx5IENsYXNzXG4gKi9cblxudmFyIE1jRmx5ID0gZnVuY3Rpb24gKCkge1xuXG4gIC8qKlxuICAgKiBJbnN0YXRpYXRlcyBNY0ZseSBhbG9uZyB3aXRoIGFjdGlvbnMgb2JqZWN0LCBzdG9yZXMgYXJyYXkgYW5kIHNldHNcbiAgICogZGlzcGF0Y2hlciB0byBEaXNwYXRjaGVyLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG5cbiAgZnVuY3Rpb24gTWNGbHkoKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIE1jRmx5KTtcblxuICAgIHRoaXMuYWN0aW9ucyA9IHt9O1xuICAgIHRoaXMuc3RvcmVzID0gW107XG4gICAgdGhpcy5kaXNwYXRjaGVyID0gX0Rpc3BhdGNoZXIyLmRlZmF1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiBhIFN0b3JlLCByZWdpc3RlcnMgdGhlIHN1cHBsaWVkIGNhbGxiYWNrIHdpdGggdGhlXG4gICAqIGRpc3BhdGNoZXIsIGFuZCBwdXNoZXMgaXQgaW50byB0aGUgZ2xvYmFsIGxpc3Qgb2Ygc3RvcmVzXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBtZXRob2RzIC0gUHVibGljIG1ldGhvZHMgZm9yIFN0b3JlIGluc3RhbmNlXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgbWV0aG9kIGZvciBEaXNwYXRjaGVyIGRpc3BhdGNoZXNcbiAgICogQHJldHVybiB7b2JqZWN0fSAtIFJldHVybnMgaW5zdGFuY2Ugb2YgU3RvcmVcbiAgICovXG5cblxuICBfY3JlYXRlQ2xhc3MoTWNGbHksIFt7XG4gICAga2V5OiAnY3JlYXRlU3RvcmUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjcmVhdGVTdG9yZShtZXRob2RzLCBjYWxsYmFjaykge1xuICAgICAgdmFyIHN0b3JlID0gbmV3IF9TdG9yZTIuZGVmYXVsdChtZXRob2RzLCBjYWxsYmFjayk7XG4gICAgICBzdG9yZS5kaXNwYXRjaGVySUQgPSB0aGlzLmRpc3BhdGNoZXIucmVnaXN0ZXIoc3RvcmUuY2FsbGJhY2spO1xuICAgICAgdGhpcy5zdG9yZXMucHVzaChzdG9yZSk7XG4gICAgICByZXR1cm4gc3RvcmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiBhbiBBY3Rpb25zRmFjdG9yeSBhbmQgYWRkcyB0aGUgc3VwcGxpZWQgYWN0aW9uc1xuICAgICAqIHRvIHRoZSBnbG9iYWwgbGlzdCBvZiBhY3Rpb25zXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gYWN0aW9ucyAtIEFjdGlvbiBtZXRob2RzXG4gICAgICogQHJldHVybiB7b2JqZWN0fSAtIFJldHVybnMgaW5zdGFuY2Ugb2YgQWN0aW9uc0ZhY3RvcnlcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiAnY3JlYXRlQWN0aW9ucycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNyZWF0ZUFjdGlvbnMoYWN0aW9ucykge1xuICAgICAgdmFyIGFjdGlvbkZhY3RvcnkgPSBuZXcgX0FjdGlvbnNGYWN0b3J5Mi5kZWZhdWx0KGFjdGlvbnMpO1xuICAgICAgKDAsIF9vYmplY3RBc3NpZ24yLmRlZmF1bHQpKHRoaXMuYWN0aW9ucywgYWN0aW9uRmFjdG9yeSk7XG4gICAgICByZXR1cm4gYWN0aW9uRmFjdG9yeTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gTWNGbHk7XG59KCk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWNGbHk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSgpO1xuXG52YXIgX2V2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpO1xuXG52YXIgX29iamVjdEFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIF9vYmplY3RBc3NpZ24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfb2JqZWN0QXNzaWduKTtcblxudmFyIF9pbnZhcmlhbnQgPSByZXF1aXJlKCdpbnZhcmlhbnQnKTtcblxudmFyIF9pbnZhcmlhbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaW52YXJpYW50KTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuLyoqXG4gKiBTdG9yZSBjbGFzc1xuICovXG5cbnZhciBTdG9yZSA9IGZ1bmN0aW9uICgpIHtcblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhIFN0b3JlIG9iamVjdCwgZXh0ZW5kcyBpdCB3aXRoIEV2ZW50RW1pdHRlciBhbmQgc3VwcGxpZWRcbiAgICogbWV0aG9kcyBwYXJhbWV0ZXIsICBhbmQgY3JlYXRlcyBhIG1peGluIHByb3BlcnR5IGZvciB1c2UgaW4gY29tcG9uZW50cy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IG1ldGhvZHMgLSBQdWJsaWMgbWV0aG9kcyBmb3IgU3RvcmUgaW5zdGFuY2VcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBtZXRob2QgZm9yIERpc3BhdGNoZXIgZGlzcGF0Y2hlc1xuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG5cbiAgZnVuY3Rpb24gU3RvcmUobWV0aG9kcywgY2FsbGJhY2spIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgU3RvcmUpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICAoMCwgX2ludmFyaWFudDIuZGVmYXVsdCkoIW1ldGhvZHMuY2FsbGJhY2ssICdcImNhbGxiYWNrXCIgaXMgYSByZXNlcnZlZCBuYW1lIGFuZCBjYW5ub3QgYmUgdXNlZCBhcyBhIG1ldGhvZCBuYW1lLicpO1xuICAgICgwLCBfaW52YXJpYW50Mi5kZWZhdWx0KSghbWV0aG9kcy5taXhpbiwgJ1wibWl4aW5cIiBpcyBhIHJlc2VydmVkIG5hbWUgYW5kIGNhbm5vdCBiZSB1c2VkIGFzIGEgbWV0aG9kIG5hbWUuJyk7XG4gICAgKDAsIF9vYmplY3RBc3NpZ24yLmRlZmF1bHQpKHRoaXMsIF9ldmVudHMuRXZlbnRFbWl0dGVyLnByb3RvdHlwZSwgbWV0aG9kcyk7XG4gICAgdGhpcy5taXhpbiA9IHtcbiAgICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbiBjb21wb25lbnREaWRNb3VudCgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgICB2YXIgd2FybiA9IHZvaWQgMDtcbiAgICAgICAgdmFyIGNoYW5nZUZuID0gdm9pZCAwO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2FybiA9IChjb25zb2xlLndhcm4gfHwgY29uc29sZS5sb2cpLmJpbmQoY29uc29sZSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICB3YXJuID0gZnVuY3Rpb24gd2FybigpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnN0b3JlRGlkQ2hhbmdlKSB7XG4gICAgICAgICAgd2FybihcIkEgY29tcG9uZW50IHRoYXQgdXNlcyBhIE1jRmx5IFN0b3JlIG1peGluIGlzIG5vdCBpbXBsZW1lbnRpbmcgc3RvcmVEaWRDaGFuZ2UuIG9uQ2hhbmdlIHdpbGwgYmUgY2FsbGVkIGluc3RlYWQsIGJ1dCB0aGlzIHdpbGwgbm8gbG9uZ2VyIGJlIHN1cHBvcnRlZCBmcm9tIHZlcnNpb24gMS4wLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBjaGFuZ2VGbiA9IHRoaXMuc3RvcmVEaWRDaGFuZ2UgfHwgdGhpcy5vbkNoYW5nZTtcbiAgICAgICAgaWYgKCFjaGFuZ2VGbikge1xuICAgICAgICAgIHdhcm4oXCJBIGNoYW5nZSBoYW5kbGVyIGlzIG1pc3NpbmcgZnJvbSBhIGNvbXBvbmVudCB3aXRoIGEgTWNGbHkgbWl4aW4uIE5vdGlmaWNhdGlvbnMgZnJvbSBTdG9yZXMgYXJlIG5vdCBiZWluZyBoYW5kbGVkLlwiKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIF90aGlzLmlzTW91bnRlZCgpICYmIGNoYW5nZUZuKCk7XG4gICAgICAgIH07XG4gICAgICAgIHNlbGYuYWRkQ2hhbmdlTGlzdGVuZXIodGhpcy5saXN0ZW5lcik7XG4gICAgICB9LFxuICAgICAgY29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uIGNvbXBvbmVudFdpbGxVbm1vdW50KCkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyICYmIHNlbGYucmVtb3ZlQ2hhbmdlTGlzdGVuZXIodGhpcy5saXN0ZW5lcik7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGRpc3BhdGNoIHRva2VuXG4gICAqL1xuXG5cbiAgX2NyZWF0ZUNsYXNzKFN0b3JlLCBbe1xuICAgIGtleTogJ2dldERpc3BhdGNoVG9rZW4nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXREaXNwYXRjaFRva2VuKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2hlcklEO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVtaXRzIGNoYW5nZSBldmVudFxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6ICdlbWl0Q2hhbmdlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZW1pdENoYW5nZSgpIHtcbiAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNoYW5nZSBsaXN0ZW5lclxuICAgICAqXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBtZXRob2QgZm9yIGNoYW5nZSBldmVudFxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6ICdhZGRDaGFuZ2VMaXN0ZW5lcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGFkZENoYW5nZUxpc3RlbmVyKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLm9uKCdjaGFuZ2UnLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNoYW5nZSBsaXN0ZW5lclxuICAgICAqXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBtZXRob2QgZm9yIGNoYW5nZSBldmVudFxuICAgICAqL1xuXG4gIH0sIHtcbiAgICBrZXk6ICdyZW1vdmVDaGFuZ2VMaXN0ZW5lcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlbW92ZUNoYW5nZUxpc3RlbmVyKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2UnLCBjYWxsYmFjayk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFN0b3JlO1xufSgpO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBTdG9yZTsiLCIvKiFcbiAqIG51bWVyYWwuanNcbiAqIHZlcnNpb24gOiAxLjUuM1xuICogYXV0aG9yIDogQWRhbSBEcmFwZXJcbiAqIGxpY2Vuc2UgOiBNSVRcbiAqIGh0dHA6Ly9hZGFtd2RyYXBlci5naXRodWIuY29tL051bWVyYWwtanMvXG4gKi9cblxuKGZ1bmN0aW9uICgpIHtcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgQ29uc3RhbnRzXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgdmFyIG51bWVyYWwsXG4gICAgICAgIFZFUlNJT04gPSAnMS41LjMnLFxuICAgICAgICAvLyBpbnRlcm5hbCBzdG9yYWdlIGZvciBsYW5ndWFnZSBjb25maWcgZmlsZXNcbiAgICAgICAgbGFuZ3VhZ2VzID0ge30sXG4gICAgICAgIGN1cnJlbnRMYW5ndWFnZSA9ICdlbicsXG4gICAgICAgIHplcm9Gb3JtYXQgPSBudWxsLFxuICAgICAgICBkZWZhdWx0Rm9ybWF0ID0gJzAsMCcsXG4gICAgICAgIC8vIGNoZWNrIGZvciBub2RlSlNcbiAgICAgICAgaGFzTW9kdWxlID0gKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKTtcblxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBDb25zdHJ1Y3RvcnNcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuICAgIC8vIE51bWVyYWwgcHJvdG90eXBlIG9iamVjdFxuICAgIGZ1bmN0aW9uIE51bWVyYWwgKG51bWJlcikge1xuICAgICAgICB0aGlzLl92YWx1ZSA9IG51bWJlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbXBsZW1lbnRhdGlvbiBvZiB0b0ZpeGVkKCkgdGhhdCB0cmVhdHMgZmxvYXRzIG1vcmUgbGlrZSBkZWNpbWFsc1xuICAgICAqXG4gICAgICogRml4ZXMgYmluYXJ5IHJvdW5kaW5nIGlzc3VlcyAoZWcuICgwLjYxNSkudG9GaXhlZCgyKSA9PT0gJzAuNjEnKSB0aGF0IHByZXNlbnRcbiAgICAgKiBwcm9ibGVtcyBmb3IgYWNjb3VudGluZy0gYW5kIGZpbmFuY2UtcmVsYXRlZCBzb2Z0d2FyZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB0b0ZpeGVkICh2YWx1ZSwgcHJlY2lzaW9uLCByb3VuZGluZ0Z1bmN0aW9uLCBvcHRpb25hbHMpIHtcbiAgICAgICAgdmFyIHBvd2VyID0gTWF0aC5wb3coMTAsIHByZWNpc2lvbiksXG4gICAgICAgICAgICBvcHRpb25hbHNSZWdFeHAsXG4gICAgICAgICAgICBvdXRwdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgLy9yb3VuZGluZ0Z1bmN0aW9uID0gKHJvdW5kaW5nRnVuY3Rpb24gIT09IHVuZGVmaW5lZCA/IHJvdW5kaW5nRnVuY3Rpb24gOiBNYXRoLnJvdW5kKTtcbiAgICAgICAgLy8gTXVsdGlwbHkgdXAgYnkgcHJlY2lzaW9uLCByb3VuZCBhY2N1cmF0ZWx5LCB0aGVuIGRpdmlkZSBhbmQgdXNlIG5hdGl2ZSB0b0ZpeGVkKCk6XG4gICAgICAgIG91dHB1dCA9IChyb3VuZGluZ0Z1bmN0aW9uKHZhbHVlICogcG93ZXIpIC8gcG93ZXIpLnRvRml4ZWQocHJlY2lzaW9uKTtcblxuICAgICAgICBpZiAob3B0aW9uYWxzKSB7XG4gICAgICAgICAgICBvcHRpb25hbHNSZWdFeHAgPSBuZXcgUmVnRXhwKCcwezEsJyArIG9wdGlvbmFscyArICd9JCcpO1xuICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnJlcGxhY2Uob3B0aW9uYWxzUmVnRXhwLCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRm9ybWF0dGluZ1xuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIC8vIGRldGVybWluZSB3aGF0IHR5cGUgb2YgZm9ybWF0dGluZyB3ZSBuZWVkIHRvIGRvXG4gICAgZnVuY3Rpb24gZm9ybWF0TnVtZXJhbCAobiwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHZhciBvdXRwdXQ7XG5cbiAgICAgICAgLy8gZmlndXJlIG91dCB3aGF0IGtpbmQgb2YgZm9ybWF0IHdlIGFyZSBkZWFsaW5nIHdpdGhcbiAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCckJykgPiAtMSkgeyAvLyBjdXJyZW5jeSEhISEhXG4gICAgICAgICAgICBvdXRwdXQgPSBmb3JtYXRDdXJyZW5jeShuLCBmb3JtYXQsIHJvdW5kaW5nRnVuY3Rpb24pO1xuICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdC5pbmRleE9mKCclJykgPiAtMSkgeyAvLyBwZXJjZW50YWdlXG4gICAgICAgICAgICBvdXRwdXQgPSBmb3JtYXRQZXJjZW50YWdlKG4sIGZvcm1hdCwgcm91bmRpbmdGdW5jdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAoZm9ybWF0LmluZGV4T2YoJzonKSA+IC0xKSB7IC8vIHRpbWVcbiAgICAgICAgICAgIG91dHB1dCA9IGZvcm1hdFRpbWUobiwgZm9ybWF0KTtcbiAgICAgICAgfSBlbHNlIHsgLy8gcGxhaW4gb2wnIG51bWJlcnMgb3IgYnl0ZXNcbiAgICAgICAgICAgIG91dHB1dCA9IGZvcm1hdE51bWJlcihuLl92YWx1ZSwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJldHVybiBzdHJpbmdcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICAvLyByZXZlcnQgdG8gbnVtYmVyXG4gICAgZnVuY3Rpb24gdW5mb3JtYXROdW1lcmFsIChuLCBzdHJpbmcpIHtcbiAgICAgICAgdmFyIHN0cmluZ09yaWdpbmFsID0gc3RyaW5nLFxuICAgICAgICAgICAgdGhvdXNhbmRSZWdFeHAsXG4gICAgICAgICAgICBtaWxsaW9uUmVnRXhwLFxuICAgICAgICAgICAgYmlsbGlvblJlZ0V4cCxcbiAgICAgICAgICAgIHRyaWxsaW9uUmVnRXhwLFxuICAgICAgICAgICAgc3VmZml4ZXMgPSBbJ0tCJywgJ01CJywgJ0dCJywgJ1RCJywgJ1BCJywgJ0VCJywgJ1pCJywgJ1lCJ10sXG4gICAgICAgICAgICBieXRlc011bHRpcGxpZXIgPSBmYWxzZSxcbiAgICAgICAgICAgIHBvd2VyO1xuXG4gICAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignOicpID4gLTEpIHtcbiAgICAgICAgICAgIG4uX3ZhbHVlID0gdW5mb3JtYXRUaW1lKHN0cmluZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3RyaW5nID09PSB6ZXJvRm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgbi5fdmFsdWUgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uZGVsaW1pdGVycy5kZWNpbWFsICE9PSAnLicpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5nID0gc3RyaW5nLnJlcGxhY2UoL1xcLi9nLCcnKS5yZXBsYWNlKGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmRlbGltaXRlcnMuZGVjaW1hbCwgJy4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZWUgaWYgYWJicmV2aWF0aW9ucyBhcmUgdGhlcmUgc28gdGhhdCB3ZSBjYW4gbXVsdGlwbHkgdG8gdGhlIGNvcnJlY3QgbnVtYmVyXG4gICAgICAgICAgICAgICAgdGhvdXNhbmRSZWdFeHAgPSBuZXcgUmVnRXhwKCdbXmEtekEtWl0nICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uYWJicmV2aWF0aW9ucy50aG91c2FuZCArICcoPzpcXFxcKXwoXFxcXCcgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5jdXJyZW5jeS5zeW1ib2wgKyAnKT8oPzpcXFxcKSk/KT8kJyk7XG4gICAgICAgICAgICAgICAgbWlsbGlvblJlZ0V4cCA9IG5ldyBSZWdFeHAoJ1teYS16QS1aXScgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLm1pbGxpb24gKyAnKD86XFxcXCl8KFxcXFwnICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uY3VycmVuY3kuc3ltYm9sICsgJyk/KD86XFxcXCkpPyk/JCcpO1xuICAgICAgICAgICAgICAgIGJpbGxpb25SZWdFeHAgPSBuZXcgUmVnRXhwKCdbXmEtekEtWl0nICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uYWJicmV2aWF0aW9ucy5iaWxsaW9uICsgJyg/OlxcXFwpfChcXFxcJyArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbCArICcpPyg/OlxcXFwpKT8pPyQnKTtcbiAgICAgICAgICAgICAgICB0cmlsbGlvblJlZ0V4cCA9IG5ldyBSZWdFeHAoJ1teYS16QS1aXScgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLnRyaWxsaW9uICsgJyg/OlxcXFwpfChcXFxcJyArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbCArICcpPyg/OlxcXFwpKT8pPyQnKTtcblxuICAgICAgICAgICAgICAgIC8vIHNlZSBpZiBieXRlcyBhcmUgdGhlcmUgc28gdGhhdCB3ZSBjYW4gbXVsdGlwbHkgdG8gdGhlIGNvcnJlY3QgbnVtYmVyXG4gICAgICAgICAgICAgICAgZm9yIChwb3dlciA9IDA7IHBvd2VyIDw9IHN1ZmZpeGVzLmxlbmd0aDsgcG93ZXIrKykge1xuICAgICAgICAgICAgICAgICAgICBieXRlc011bHRpcGxpZXIgPSAoc3RyaW5nLmluZGV4T2Yoc3VmZml4ZXNbcG93ZXJdKSA+IC0xKSA/IE1hdGgucG93KDEwMjQsIHBvd2VyICsgMSkgOiBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnl0ZXNNdWx0aXBsaWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGRvIHNvbWUgbWF0aCB0byBjcmVhdGUgb3VyIG51bWJlclxuICAgICAgICAgICAgICAgIG4uX3ZhbHVlID0gKChieXRlc011bHRpcGxpZXIpID8gYnl0ZXNNdWx0aXBsaWVyIDogMSkgKiAoKHN0cmluZ09yaWdpbmFsLm1hdGNoKHRob3VzYW5kUmVnRXhwKSkgPyBNYXRoLnBvdygxMCwgMykgOiAxKSAqICgoc3RyaW5nT3JpZ2luYWwubWF0Y2gobWlsbGlvblJlZ0V4cCkpID8gTWF0aC5wb3coMTAsIDYpIDogMSkgKiAoKHN0cmluZ09yaWdpbmFsLm1hdGNoKGJpbGxpb25SZWdFeHApKSA/IE1hdGgucG93KDEwLCA5KSA6IDEpICogKChzdHJpbmdPcmlnaW5hbC5tYXRjaCh0cmlsbGlvblJlZ0V4cCkpID8gTWF0aC5wb3coMTAsIDEyKSA6IDEpICogKChzdHJpbmcuaW5kZXhPZignJScpID4gLTEpID8gMC4wMSA6IDEpICogKCgoc3RyaW5nLnNwbGl0KCctJykubGVuZ3RoICsgTWF0aC5taW4oc3RyaW5nLnNwbGl0KCcoJykubGVuZ3RoLTEsIHN0cmluZy5zcGxpdCgnKScpLmxlbmd0aC0xKSkgJSAyKT8gMTogLTEpICogTnVtYmVyKHN0cmluZy5yZXBsYWNlKC9bXjAtOVxcLl0rL2csICcnKSk7XG5cbiAgICAgICAgICAgICAgICAvLyByb3VuZCBpZiB3ZSBhcmUgdGFsa2luZyBhYm91dCBieXRlc1xuICAgICAgICAgICAgICAgIG4uX3ZhbHVlID0gKGJ5dGVzTXVsdGlwbGllcikgPyBNYXRoLmNlaWwobi5fdmFsdWUpIDogbi5fdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG4uX3ZhbHVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcm1hdEN1cnJlbmN5IChuLCBmb3JtYXQsIHJvdW5kaW5nRnVuY3Rpb24pIHtcbiAgICAgICAgdmFyIHN5bWJvbEluZGV4ID0gZm9ybWF0LmluZGV4T2YoJyQnKSxcbiAgICAgICAgICAgIG9wZW5QYXJlbkluZGV4ID0gZm9ybWF0LmluZGV4T2YoJygnKSxcbiAgICAgICAgICAgIG1pbnVzU2lnbkluZGV4ID0gZm9ybWF0LmluZGV4T2YoJy0nKSxcbiAgICAgICAgICAgIHNwYWNlID0gJycsXG4gICAgICAgICAgICBzcGxpY2VJbmRleCxcbiAgICAgICAgICAgIG91dHB1dDtcblxuICAgICAgICAvLyBjaGVjayBmb3Igc3BhY2UgYmVmb3JlIG9yIGFmdGVyIGN1cnJlbmN5XG4gICAgICAgIGlmIChmb3JtYXQuaW5kZXhPZignICQnKSA+IC0xKSB7XG4gICAgICAgICAgICBzcGFjZSA9ICcgJztcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCcgJCcsICcnKTtcbiAgICAgICAgfSBlbHNlIGlmIChmb3JtYXQuaW5kZXhPZignJCAnKSA+IC0xKSB7XG4gICAgICAgICAgICBzcGFjZSA9ICcgJztcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCckICcsICcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCckJywgJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9ybWF0IHRoZSBudW1iZXJcbiAgICAgICAgb3V0cHV0ID0gZm9ybWF0TnVtYmVyKG4uX3ZhbHVlLCBmb3JtYXQsIHJvdW5kaW5nRnVuY3Rpb24pO1xuXG4gICAgICAgIC8vIHBvc2l0aW9uIHRoZSBzeW1ib2xcbiAgICAgICAgaWYgKHN5bWJvbEluZGV4IDw9IDEpIHtcbiAgICAgICAgICAgIGlmIChvdXRwdXQuaW5kZXhPZignKCcpID4gLTEgfHwgb3V0cHV0LmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnNwbGl0KCcnKTtcbiAgICAgICAgICAgICAgICBzcGxpY2VJbmRleCA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKHN5bWJvbEluZGV4IDwgb3BlblBhcmVuSW5kZXggfHwgc3ltYm9sSW5kZXggPCBtaW51c1NpZ25JbmRleCl7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzeW1ib2wgYXBwZWFycyBiZWZvcmUgdGhlIFwiKFwiIG9yIFwiLVwiXG4gICAgICAgICAgICAgICAgICAgIHNwbGljZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3V0cHV0LnNwbGljZShzcGxpY2VJbmRleCwgMCwgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uY3VycmVuY3kuc3ltYm9sICsgc3BhY2UpO1xuICAgICAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dC5qb2luKCcnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uY3VycmVuY3kuc3ltYm9sICsgc3BhY2UgKyBvdXRwdXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAob3V0cHV0LmluZGV4T2YoJyknKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnNwbGl0KCcnKTtcbiAgICAgICAgICAgICAgICBvdXRwdXQuc3BsaWNlKC0xLCAwLCBzcGFjZSArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbCk7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LmpvaW4oJycpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQgPSBvdXRwdXQgKyBzcGFjZSArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0UGVyY2VudGFnZSAobiwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHZhciBzcGFjZSA9ICcnLFxuICAgICAgICAgICAgb3V0cHV0LFxuICAgICAgICAgICAgdmFsdWUgPSBuLl92YWx1ZSAqIDEwMDtcblxuICAgICAgICAvLyBjaGVjayBmb3Igc3BhY2UgYmVmb3JlICVcbiAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCcgJScpID4gLTEpIHtcbiAgICAgICAgICAgIHNwYWNlID0gJyAnO1xuICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJyAlJywgJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJyUnLCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQgPSBmb3JtYXROdW1iZXIodmFsdWUsIGZvcm1hdCwgcm91bmRpbmdGdW5jdGlvbik7XG4gICAgICAgIFxuICAgICAgICBpZiAob3V0cHV0LmluZGV4T2YoJyknKSA+IC0xICkge1xuICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnNwbGl0KCcnKTtcbiAgICAgICAgICAgIG91dHB1dC5zcGxpY2UoLTEsIDAsIHNwYWNlICsgJyUnKTtcbiAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dC5qb2luKCcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dCArIHNwYWNlICsgJyUnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmb3JtYXRUaW1lIChuKSB7XG4gICAgICAgIHZhciBob3VycyA9IE1hdGguZmxvb3Iobi5fdmFsdWUvNjAvNjApLFxuICAgICAgICAgICAgbWludXRlcyA9IE1hdGguZmxvb3IoKG4uX3ZhbHVlIC0gKGhvdXJzICogNjAgKiA2MCkpLzYwKSxcbiAgICAgICAgICAgIHNlY29uZHMgPSBNYXRoLnJvdW5kKG4uX3ZhbHVlIC0gKGhvdXJzICogNjAgKiA2MCkgLSAobWludXRlcyAqIDYwKSk7XG4gICAgICAgIHJldHVybiBob3VycyArICc6JyArICgobWludXRlcyA8IDEwKSA/ICcwJyArIG1pbnV0ZXMgOiBtaW51dGVzKSArICc6JyArICgoc2Vjb25kcyA8IDEwKSA/ICcwJyArIHNlY29uZHMgOiBzZWNvbmRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1bmZvcm1hdFRpbWUgKHN0cmluZykge1xuICAgICAgICB2YXIgdGltZUFycmF5ID0gc3RyaW5nLnNwbGl0KCc6JyksXG4gICAgICAgICAgICBzZWNvbmRzID0gMDtcbiAgICAgICAgLy8gdHVybiBob3VycyBhbmQgbWludXRlcyBpbnRvIHNlY29uZHMgYW5kIGFkZCB0aGVtIGFsbCB1cFxuICAgICAgICBpZiAodGltZUFycmF5Lmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgLy8gaG91cnNcbiAgICAgICAgICAgIHNlY29uZHMgPSBzZWNvbmRzICsgKE51bWJlcih0aW1lQXJyYXlbMF0pICogNjAgKiA2MCk7XG4gICAgICAgICAgICAvLyBtaW51dGVzXG4gICAgICAgICAgICBzZWNvbmRzID0gc2Vjb25kcyArIChOdW1iZXIodGltZUFycmF5WzFdKSAqIDYwKTtcbiAgICAgICAgICAgIC8vIHNlY29uZHNcbiAgICAgICAgICAgIHNlY29uZHMgPSBzZWNvbmRzICsgTnVtYmVyKHRpbWVBcnJheVsyXSk7XG4gICAgICAgIH0gZWxzZSBpZiAodGltZUFycmF5Lmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgLy8gbWludXRlc1xuICAgICAgICAgICAgc2Vjb25kcyA9IHNlY29uZHMgKyAoTnVtYmVyKHRpbWVBcnJheVswXSkgKiA2MCk7XG4gICAgICAgICAgICAvLyBzZWNvbmRzXG4gICAgICAgICAgICBzZWNvbmRzID0gc2Vjb25kcyArIE51bWJlcih0aW1lQXJyYXlbMV0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBOdW1iZXIoc2Vjb25kcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0TnVtYmVyICh2YWx1ZSwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHZhciBuZWdQID0gZmFsc2UsXG4gICAgICAgICAgICBzaWduZWQgPSBmYWxzZSxcbiAgICAgICAgICAgIG9wdERlYyA9IGZhbHNlLFxuICAgICAgICAgICAgYWJiciA9ICcnLFxuICAgICAgICAgICAgYWJicksgPSBmYWxzZSwgLy8gZm9yY2UgYWJicmV2aWF0aW9uIHRvIHRob3VzYW5kc1xuICAgICAgICAgICAgYWJick0gPSBmYWxzZSwgLy8gZm9yY2UgYWJicmV2aWF0aW9uIHRvIG1pbGxpb25zXG4gICAgICAgICAgICBhYmJyQiA9IGZhbHNlLCAvLyBmb3JjZSBhYmJyZXZpYXRpb24gdG8gYmlsbGlvbnNcbiAgICAgICAgICAgIGFiYnJUID0gZmFsc2UsIC8vIGZvcmNlIGFiYnJldmlhdGlvbiB0byB0cmlsbGlvbnNcbiAgICAgICAgICAgIGFiYnJGb3JjZSA9IGZhbHNlLCAvLyBmb3JjZSBhYmJyZXZpYXRpb25cbiAgICAgICAgICAgIGJ5dGVzID0gJycsXG4gICAgICAgICAgICBvcmQgPSAnJyxcbiAgICAgICAgICAgIGFicyA9IE1hdGguYWJzKHZhbHVlKSxcbiAgICAgICAgICAgIHN1ZmZpeGVzID0gWydCJywgJ0tCJywgJ01CJywgJ0dCJywgJ1RCJywgJ1BCJywgJ0VCJywgJ1pCJywgJ1lCJ10sXG4gICAgICAgICAgICBtaW4sXG4gICAgICAgICAgICBtYXgsXG4gICAgICAgICAgICBwb3dlcixcbiAgICAgICAgICAgIHcsXG4gICAgICAgICAgICBwcmVjaXNpb24sXG4gICAgICAgICAgICB0aG91c2FuZHMsXG4gICAgICAgICAgICBkID0gJycsXG4gICAgICAgICAgICBuZWcgPSBmYWxzZTtcblxuICAgICAgICAvLyBjaGVjayBpZiBudW1iZXIgaXMgemVybyBhbmQgYSBjdXN0b20gemVybyBmb3JtYXQgaGFzIGJlZW4gc2V0XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gMCAmJiB6ZXJvRm9ybWF0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gemVyb0Zvcm1hdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNlZSBpZiB3ZSBzaG91bGQgdXNlIHBhcmVudGhlc2VzIGZvciBuZWdhdGl2ZSBudW1iZXIgb3IgaWYgd2Ugc2hvdWxkIHByZWZpeCB3aXRoIGEgc2lnblxuICAgICAgICAgICAgLy8gaWYgYm90aCBhcmUgcHJlc2VudCB3ZSBkZWZhdWx0IHRvIHBhcmVudGhlc2VzXG4gICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJygnKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgbmVnUCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnNsaWNlKDEsIC0xKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZm9ybWF0LmluZGV4T2YoJysnKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc2lnbmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgvXFwrL2csICcnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2VlIGlmIGFiYnJldmlhdGlvbiBpcyB3YW50ZWRcbiAgICAgICAgICAgIGlmIChmb3JtYXQuaW5kZXhPZignYScpID4gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBhYmJyZXZpYXRpb24gaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgYWJicksgPSBmb3JtYXQuaW5kZXhPZignYUsnKSA+PSAwO1xuICAgICAgICAgICAgICAgIGFiYnJNID0gZm9ybWF0LmluZGV4T2YoJ2FNJykgPj0gMDtcbiAgICAgICAgICAgICAgICBhYmJyQiA9IGZvcm1hdC5pbmRleE9mKCdhQicpID49IDA7XG4gICAgICAgICAgICAgICAgYWJiclQgPSBmb3JtYXQuaW5kZXhPZignYVQnKSA+PSAwO1xuICAgICAgICAgICAgICAgIGFiYnJGb3JjZSA9IGFiYnJLIHx8IGFiYnJNIHx8IGFiYnJCIHx8IGFiYnJUO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgZm9yIHNwYWNlIGJlZm9yZSBhYmJyZXZpYXRpb25cbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJyBhJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBhYmJyID0gJyAnO1xuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgnIGEnLCAnJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJ2EnLCAnJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGFicyA+PSBNYXRoLnBvdygxMCwgMTIpICYmICFhYmJyRm9yY2UgfHwgYWJiclQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdHJpbGxpb25cbiAgICAgICAgICAgICAgICAgICAgYWJiciA9IGFiYnIgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLnRyaWxsaW9uO1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlIC8gTWF0aC5wb3coMTAsIDEyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFicyA8IE1hdGgucG93KDEwLCAxMikgJiYgYWJzID49IE1hdGgucG93KDEwLCA5KSAmJiAhYWJickZvcmNlIHx8IGFiYnJCKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGJpbGxpb25cbiAgICAgICAgICAgICAgICAgICAgYWJiciA9IGFiYnIgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLmJpbGxpb247XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgLyBNYXRoLnBvdygxMCwgOSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhYnMgPCBNYXRoLnBvdygxMCwgOSkgJiYgYWJzID49IE1hdGgucG93KDEwLCA2KSAmJiAhYWJickZvcmNlIHx8IGFiYnJNKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG1pbGxpb25cbiAgICAgICAgICAgICAgICAgICAgYWJiciA9IGFiYnIgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLm1pbGxpb247XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgLyBNYXRoLnBvdygxMCwgNik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhYnMgPCBNYXRoLnBvdygxMCwgNikgJiYgYWJzID49IE1hdGgucG93KDEwLCAzKSAmJiAhYWJickZvcmNlIHx8IGFiYnJLKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRob3VzYW5kXG4gICAgICAgICAgICAgICAgICAgIGFiYnIgPSBhYmJyICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uYWJicmV2aWF0aW9ucy50aG91c2FuZDtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSAvIE1hdGgucG93KDEwLCAzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNlZSBpZiB3ZSBhcmUgZm9ybWF0dGluZyBieXRlc1xuICAgICAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCdiJykgPiAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGFjZSBiZWZvcmVcbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJyBiJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBieXRlcyA9ICcgJztcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJyBiJywgJycpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCdiJywgJycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAocG93ZXIgPSAwOyBwb3dlciA8PSBzdWZmaXhlcy5sZW5ndGg7IHBvd2VyKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWluID0gTWF0aC5wb3coMTAyNCwgcG93ZXIpO1xuICAgICAgICAgICAgICAgICAgICBtYXggPSBNYXRoLnBvdygxMDI0LCBwb3dlcisxKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUgPj0gbWluICYmIHZhbHVlIDwgbWF4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBieXRlcyA9IGJ5dGVzICsgc3VmZml4ZXNbcG93ZXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pbiA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlIC8gbWluO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNlZSBpZiBvcmRpbmFsIGlzIHdhbnRlZFxuICAgICAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCdvJykgPiAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGFjZSBiZWZvcmVcbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJyBvJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBvcmQgPSAnICc7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCcgbycsICcnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgnbycsICcnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvcmQgPSBvcmQgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5vcmRpbmFsKHZhbHVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCdbLl0nKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb3B0RGVjID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgnWy5dJywgJy4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdyA9IHZhbHVlLnRvU3RyaW5nKCkuc3BsaXQoJy4nKVswXTtcbiAgICAgICAgICAgIHByZWNpc2lvbiA9IGZvcm1hdC5zcGxpdCgnLicpWzFdO1xuICAgICAgICAgICAgdGhvdXNhbmRzID0gZm9ybWF0LmluZGV4T2YoJywnKTtcblxuICAgICAgICAgICAgaWYgKHByZWNpc2lvbikge1xuICAgICAgICAgICAgICAgIGlmIChwcmVjaXNpb24uaW5kZXhPZignWycpID4gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gcHJlY2lzaW9uLnJlcGxhY2UoJ10nLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIHByZWNpc2lvbiA9IHByZWNpc2lvbi5zcGxpdCgnWycpO1xuICAgICAgICAgICAgICAgICAgICBkID0gdG9GaXhlZCh2YWx1ZSwgKHByZWNpc2lvblswXS5sZW5ndGggKyBwcmVjaXNpb25bMV0ubGVuZ3RoKSwgcm91bmRpbmdGdW5jdGlvbiwgcHJlY2lzaW9uWzFdLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZCA9IHRvRml4ZWQodmFsdWUsIHByZWNpc2lvbi5sZW5ndGgsIHJvdW5kaW5nRnVuY3Rpb24pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHcgPSBkLnNwbGl0KCcuJylbMF07XG5cbiAgICAgICAgICAgICAgICBpZiAoZC5zcGxpdCgnLicpWzFdLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBkID0gbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uZGVsaW1pdGVycy5kZWNpbWFsICsgZC5zcGxpdCgnLicpWzFdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGQgPSAnJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0RGVjICYmIE51bWJlcihkLnNsaWNlKDEpKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBkID0gJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3ID0gdG9GaXhlZCh2YWx1ZSwgbnVsbCwgcm91bmRpbmdGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBudW1iZXJcbiAgICAgICAgICAgIGlmICh3LmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgdyA9IHcuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgbmVnID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRob3VzYW5kcyA+IC0xKSB7XG4gICAgICAgICAgICAgICAgdyA9IHcudG9TdHJpbmcoKS5yZXBsYWNlKC8oXFxkKSg/PShcXGR7M30pKyg/IVxcZCkpL2csICckMScgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5kZWxpbWl0ZXJzLnRob3VzYW5kcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmb3JtYXQuaW5kZXhPZignLicpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdyA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gKChuZWdQICYmIG5lZykgPyAnKCcgOiAnJykgKyAoKCFuZWdQICYmIG5lZykgPyAnLScgOiAnJykgKyAoKCFuZWcgJiYgc2lnbmVkKSA/ICcrJyA6ICcnKSArIHcgKyBkICsgKChvcmQpID8gb3JkIDogJycpICsgKChhYmJyKSA/IGFiYnIgOiAnJykgKyAoKGJ5dGVzKSA/IGJ5dGVzIDogJycpICsgKChuZWdQICYmIG5lZykgPyAnKScgOiAnJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFRvcCBMZXZlbCBGdW5jdGlvbnNcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBudW1lcmFsID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIGlmIChudW1lcmFsLmlzTnVtZXJhbChpbnB1dCkpIHtcbiAgICAgICAgICAgIGlucHV0ID0gaW5wdXQudmFsdWUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dCA9PT0gMCB8fCB0eXBlb2YgaW5wdXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpbnB1dCA9IDA7XG4gICAgICAgIH0gZWxzZSBpZiAoIU51bWJlcihpbnB1dCkpIHtcbiAgICAgICAgICAgIGlucHV0ID0gbnVtZXJhbC5mbi51bmZvcm1hdChpbnB1dCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IE51bWVyYWwoTnVtYmVyKGlucHV0KSk7XG4gICAgfTtcblxuICAgIC8vIHZlcnNpb24gbnVtYmVyXG4gICAgbnVtZXJhbC52ZXJzaW9uID0gVkVSU0lPTjtcblxuICAgIC8vIGNvbXBhcmUgbnVtZXJhbCBvYmplY3RcbiAgICBudW1lcmFsLmlzTnVtZXJhbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIE51bWVyYWw7XG4gICAgfTtcblxuICAgIC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBsb2FkIGxhbmd1YWdlcyBhbmQgdGhlbiBzZXQgdGhlIGdsb2JhbCBsYW5ndWFnZS4gIElmXG4gICAgLy8gbm8gYXJndW1lbnRzIGFyZSBwYXNzZWQgaW4sIGl0IHdpbGwgc2ltcGx5IHJldHVybiB0aGUgY3VycmVudCBnbG9iYWxcbiAgICAvLyBsYW5ndWFnZSBrZXkuXG4gICAgbnVtZXJhbC5sYW5ndWFnZSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlcykge1xuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRMYW5ndWFnZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXkgJiYgIXZhbHVlcykge1xuICAgICAgICAgICAgaWYoIWxhbmd1YWdlc1trZXldKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGxhbmd1YWdlIDogJyArIGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjdXJyZW50TGFuZ3VhZ2UgPSBrZXk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWVzIHx8ICFsYW5ndWFnZXNba2V5XSkge1xuICAgICAgICAgICAgbG9hZExhbmd1YWdlKGtleSwgdmFsdWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudW1lcmFsO1xuICAgIH07XG4gICAgXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBwcm92aWRlcyBhY2Nlc3MgdG8gdGhlIGxvYWRlZCBsYW5ndWFnZSBkYXRhLiAgSWZcbiAgICAvLyBubyBhcmd1bWVudHMgYXJlIHBhc3NlZCBpbiwgaXQgd2lsbCBzaW1wbHkgcmV0dXJuIHRoZSBjdXJyZW50XG4gICAgLy8gZ2xvYmFsIGxhbmd1YWdlIG9iamVjdC5cbiAgICBudW1lcmFsLmxhbmd1YWdlRGF0YSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgaWYgKCFrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFsYW5ndWFnZXNba2V5XSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGxhbmd1YWdlIDogJyArIGtleSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBsYW5ndWFnZXNba2V5XTtcbiAgICB9O1xuXG4gICAgbnVtZXJhbC5sYW5ndWFnZSgnZW4nLCB7XG4gICAgICAgIGRlbGltaXRlcnM6IHtcbiAgICAgICAgICAgIHRob3VzYW5kczogJywnLFxuICAgICAgICAgICAgZGVjaW1hbDogJy4nXG4gICAgICAgIH0sXG4gICAgICAgIGFiYnJldmlhdGlvbnM6IHtcbiAgICAgICAgICAgIHRob3VzYW5kOiAnaycsXG4gICAgICAgICAgICBtaWxsaW9uOiAnbScsXG4gICAgICAgICAgICBiaWxsaW9uOiAnYicsXG4gICAgICAgICAgICB0cmlsbGlvbjogJ3QnXG4gICAgICAgIH0sXG4gICAgICAgIG9yZGluYWw6IGZ1bmN0aW9uIChudW1iZXIpIHtcbiAgICAgICAgICAgIHZhciBiID0gbnVtYmVyICUgMTA7XG4gICAgICAgICAgICByZXR1cm4gKH5+IChudW1iZXIgJSAxMDAgLyAxMCkgPT09IDEpID8gJ3RoJyA6XG4gICAgICAgICAgICAgICAgKGIgPT09IDEpID8gJ3N0JyA6XG4gICAgICAgICAgICAgICAgKGIgPT09IDIpID8gJ25kJyA6XG4gICAgICAgICAgICAgICAgKGIgPT09IDMpID8gJ3JkJyA6ICd0aCc7XG4gICAgICAgIH0sXG4gICAgICAgIGN1cnJlbmN5OiB7XG4gICAgICAgICAgICBzeW1ib2w6ICckJ1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBudW1lcmFsLnplcm9Gb3JtYXQgPSBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIHplcm9Gb3JtYXQgPSB0eXBlb2YoZm9ybWF0KSA9PT0gJ3N0cmluZycgPyBmb3JtYXQgOiBudWxsO1xuICAgIH07XG5cbiAgICBudW1lcmFsLmRlZmF1bHRGb3JtYXQgPSBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIGRlZmF1bHRGb3JtYXQgPSB0eXBlb2YoZm9ybWF0KSA9PT0gJ3N0cmluZycgPyBmb3JtYXQgOiAnMC4wJztcbiAgICB9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBIZWxwZXJzXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZnVuY3Rpb24gbG9hZExhbmd1YWdlKGtleSwgdmFsdWVzKSB7XG4gICAgICAgIGxhbmd1YWdlc1trZXldID0gdmFsdWVzO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRmxvYXRpbmctcG9pbnQgaGVscGVyc1xuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIC8vIFRoZSBmbG9hdGluZy1wb2ludCBoZWxwZXIgZnVuY3Rpb25zIGFuZCBpbXBsZW1lbnRhdGlvblxuICAgIC8vIGJvcnJvd3MgaGVhdmlseSBmcm9tIHNpbmZ1bC5qczogaHR0cDovL2d1aXBuLmdpdGh1Yi5pby9zaW5mdWwuanMvXG5cbiAgICAvKipcbiAgICAgKiBBcnJheS5wcm90b3R5cGUucmVkdWNlIGZvciBicm93c2VycyB0aGF0IGRvbid0IHN1cHBvcnQgaXRcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9SZWR1Y2UjQ29tcGF0aWJpbGl0eVxuICAgICAqL1xuICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgQXJyYXkucHJvdG90eXBlLnJlZHVjZSkge1xuICAgICAgICBBcnJheS5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gICAgICAgICAgICAndXNlIHN0cmljdCc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChudWxsID09PSB0aGlzIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgdGhpcykge1xuICAgICAgICAgICAgICAgIC8vIEF0IHRoZSBtb21lbnQgYWxsIG1vZGVybiBicm93c2VycywgdGhhdCBzdXBwb3J0IHN0cmljdCBtb2RlLCBoYXZlXG4gICAgICAgICAgICAgICAgLy8gbmF0aXZlIGltcGxlbWVudGF0aW9uIG9mIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UuIEZvciBpbnN0YW5jZSwgSUU4XG4gICAgICAgICAgICAgICAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdHJpY3QgbW9kZSwgc28gdGhpcyBjaGVjayBpcyBhY3R1YWxseSB1c2VsZXNzLlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FycmF5LnByb3RvdHlwZS5yZWR1Y2UgY2FsbGVkIG9uIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGNhbGxiYWNrICsgJyBpcyBub3QgYSBmdW5jdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgaW5kZXgsXG4gICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gdGhpcy5sZW5ndGggPj4+IDAsXG4gICAgICAgICAgICAgICAgaXNWYWx1ZVNldCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoMSA8IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IG9wdF9pbml0aWFsVmFsdWU7XG4gICAgICAgICAgICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoaW5kZXggPSAwOyBsZW5ndGggPiBpbmRleDsgKytpbmRleCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KGluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNWYWx1ZVNldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBjYWxsYmFjayh2YWx1ZSwgdGhpc1tpbmRleF0sIGluZGV4LCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpc1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpc1ZhbHVlU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpc1ZhbHVlU2V0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgXG4gICAgLyoqXG4gICAgICogQ29tcHV0ZXMgdGhlIG11bHRpcGxpZXIgbmVjZXNzYXJ5IHRvIG1ha2UgeCA+PSAxLFxuICAgICAqIGVmZmVjdGl2ZWx5IGVsaW1pbmF0aW5nIG1pc2NhbGN1bGF0aW9ucyBjYXVzZWQgYnlcbiAgICAgKiBmaW5pdGUgcHJlY2lzaW9uLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG11bHRpcGxpZXIoeCkge1xuICAgICAgICB2YXIgcGFydHMgPSB4LnRvU3RyaW5nKCkuc3BsaXQoJy4nKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBNYXRoLnBvdygxMCwgcGFydHNbMV0ubGVuZ3RoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHaXZlbiBhIHZhcmlhYmxlIG51bWJlciBvZiBhcmd1bWVudHMsIHJldHVybnMgdGhlIG1heGltdW1cbiAgICAgKiBtdWx0aXBsaWVyIHRoYXQgbXVzdCBiZSB1c2VkIHRvIG5vcm1hbGl6ZSBhbiBvcGVyYXRpb24gaW52b2x2aW5nXG4gICAgICogYWxsIG9mIHRoZW0uXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29ycmVjdGlvbkZhY3RvcigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gYXJncy5yZWR1Y2UoZnVuY3Rpb24gKHByZXYsIG5leHQpIHtcbiAgICAgICAgICAgIHZhciBtcCA9IG11bHRpcGxpZXIocHJldiksXG4gICAgICAgICAgICAgICAgbW4gPSBtdWx0aXBsaWVyKG5leHQpO1xuICAgICAgICByZXR1cm4gbXAgPiBtbiA/IG1wIDogbW47XG4gICAgICAgIH0sIC1JbmZpbml0eSk7XG4gICAgfSAgICAgICAgXG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgTnVtZXJhbCBQcm90b3R5cGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuICAgIG51bWVyYWwuZm4gPSBOdW1lcmFsLnByb3RvdHlwZSA9IHtcblxuICAgICAgICBjbG9uZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudW1lcmFsKHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGZvcm1hdCA6IGZ1bmN0aW9uIChpbnB1dFN0cmluZywgcm91bmRpbmdGdW5jdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdE51bWVyYWwodGhpcywgXG4gICAgICAgICAgICAgICAgICBpbnB1dFN0cmluZyA/IGlucHV0U3RyaW5nIDogZGVmYXVsdEZvcm1hdCwgXG4gICAgICAgICAgICAgICAgICAocm91bmRpbmdGdW5jdGlvbiAhPT0gdW5kZWZpbmVkKSA/IHJvdW5kaW5nRnVuY3Rpb24gOiBNYXRoLnJvdW5kXG4gICAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdW5mb3JtYXQgOiBmdW5jdGlvbiAoaW5wdXRTdHJpbmcpIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5wdXRTdHJpbmcpID09PSAnW29iamVjdCBOdW1iZXJdJykgeyBcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5wdXRTdHJpbmc7IFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHVuZm9ybWF0TnVtZXJhbCh0aGlzLCBpbnB1dFN0cmluZyA/IGlucHV0U3RyaW5nIDogZGVmYXVsdEZvcm1hdCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdmFsdWUgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdmFsdWVPZiA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQgOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhbHVlID0gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFkZCA6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdmFyIGNvcnJGYWN0b3IgPSBjb3JyZWN0aW9uRmFjdG9yLmNhbGwobnVsbCwgdGhpcy5fdmFsdWUsIHZhbHVlKTtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGNiYWNrKGFjY3VtLCBjdXJyLCBjdXJySSwgTykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhY2N1bSArIGNvcnJGYWN0b3IgKiBjdXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSBbdGhpcy5fdmFsdWUsIHZhbHVlXS5yZWR1Y2UoY2JhY2ssIDApIC8gY29yckZhY3RvcjtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIHN1YnRyYWN0IDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgY29yckZhY3RvciA9IGNvcnJlY3Rpb25GYWN0b3IuY2FsbChudWxsLCB0aGlzLl92YWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgZnVuY3Rpb24gY2JhY2soYWNjdW0sIGN1cnIsIGN1cnJJLCBPKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjY3VtIC0gY29yckZhY3RvciAqIGN1cnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl92YWx1ZSA9IFt2YWx1ZV0ucmVkdWNlKGNiYWNrLCB0aGlzLl92YWx1ZSAqIGNvcnJGYWN0b3IpIC8gY29yckZhY3RvcjsgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIG11bHRpcGx5IDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBjYmFjayhhY2N1bSwgY3VyciwgY3VyckksIE8pIHtcbiAgICAgICAgICAgICAgICB2YXIgY29yckZhY3RvciA9IGNvcnJlY3Rpb25GYWN0b3IoYWNjdW0sIGN1cnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoYWNjdW0gKiBjb3JyRmFjdG9yKSAqIChjdXJyICogY29yckZhY3RvcikgL1xuICAgICAgICAgICAgICAgICAgICAoY29yckZhY3RvciAqIGNvcnJGYWN0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSBbdGhpcy5fdmFsdWUsIHZhbHVlXS5yZWR1Y2UoY2JhY2ssIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZGl2aWRlIDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBjYmFjayhhY2N1bSwgY3VyciwgY3VyckksIE8pIHtcbiAgICAgICAgICAgICAgICB2YXIgY29yckZhY3RvciA9IGNvcnJlY3Rpb25GYWN0b3IoYWNjdW0sIGN1cnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoYWNjdW0gKiBjb3JyRmFjdG9yKSAvIChjdXJyICogY29yckZhY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl92YWx1ZSA9IFt0aGlzLl92YWx1ZSwgdmFsdWVdLnJlZHVjZShjYmFjayk7ICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICBkaWZmZXJlbmNlIDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5hYnMobnVtZXJhbCh0aGlzLl92YWx1ZSkuc3VidHJhY3QodmFsdWUpLnZhbHVlKCkpO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBFeHBvc2luZyBOdW1lcmFsXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLy8gQ29tbW9uSlMgbW9kdWxlIGlzIGRlZmluZWRcbiAgICBpZiAoaGFzTW9kdWxlKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbnVtZXJhbDtcbiAgICB9XG5cbiAgICAvKmdsb2JhbCBlbmRlcjpmYWxzZSAqL1xuICAgIGlmICh0eXBlb2YgZW5kZXIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIC8vIGhlcmUsIGB0aGlzYCBtZWFucyBgd2luZG93YCBpbiB0aGUgYnJvd3Nlciwgb3IgYGdsb2JhbGAgb24gdGhlIHNlcnZlclxuICAgICAgICAvLyBhZGQgYG51bWVyYWxgIGFzIGEgZ2xvYmFsIG9iamVjdCB2aWEgYSBzdHJpbmcgaWRlbnRpZmllcixcbiAgICAgICAgLy8gZm9yIENsb3N1cmUgQ29tcGlsZXIgJ2FkdmFuY2VkJyBtb2RlXG4gICAgICAgIHRoaXNbJ251bWVyYWwnXSA9IG51bWVyYWw7XG4gICAgfVxuXG4gICAgLypnbG9iYWwgZGVmaW5lOmZhbHNlICovXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudW1lcmFsO1xuICAgICAgICB9KTtcbiAgICB9XG59KS5jYWxsKHRoaXMpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgcHJvcElzRW51bWVyYWJsZSA9IE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbmZ1bmN0aW9uIHRvT2JqZWN0KHZhbCkge1xuXHRpZiAodmFsID09PSBudWxsIHx8IHZhbCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0LmFzc2lnbiBjYW5ub3QgYmUgY2FsbGVkIHdpdGggbnVsbCBvciB1bmRlZmluZWQnKTtcblx0fVxuXG5cdHJldHVybiBPYmplY3QodmFsKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkVXNlTmF0aXZlKCkge1xuXHR0cnkge1xuXHRcdGlmICghT2JqZWN0LmFzc2lnbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIERldGVjdCBidWdneSBwcm9wZXJ0eSBlbnVtZXJhdGlvbiBvcmRlciBpbiBvbGRlciBWOCB2ZXJzaW9ucy5cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTQxMThcblx0XHR2YXIgdGVzdDEgPSBuZXcgU3RyaW5nKCdhYmMnKTsgIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHR0ZXN0MVs1XSA9ICdkZSc7XG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlc3QxKVswXSA9PT0gJzUnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MiA9IHt9O1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykge1xuXHRcdFx0dGVzdDJbJ18nICsgU3RyaW5nLmZyb21DaGFyQ29kZShpKV0gPSBpO1xuXHRcdH1cblx0XHR2YXIgb3JkZXIyID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDIpLm1hcChmdW5jdGlvbiAobikge1xuXHRcdFx0cmV0dXJuIHRlc3QyW25dO1xuXHRcdH0pO1xuXHRcdGlmIChvcmRlcjIuam9pbignJykgIT09ICcwMTIzNDU2Nzg5Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTMwNTZcblx0XHR2YXIgdGVzdDMgPSB7fTtcblx0XHQnYWJjZGVmZ2hpamtsbW5vcHFyc3QnLnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uIChsZXR0ZXIpIHtcblx0XHRcdHRlc3QzW2xldHRlcl0gPSBsZXR0ZXI7XG5cdFx0fSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKE9iamVjdC5hc3NpZ24oe30sIHRlc3QzKSkuam9pbignJykgIT09XG5cdFx0XHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIFdlIGRvbid0IGV4cGVjdCBhbnkgb2YgdGhlIGFib3ZlIHRvIHRocm93LCBidXQgYmV0dGVyIHRvIGJlIHNhZmUuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2hvdWxkVXNlTmF0aXZlKCkgPyBPYmplY3QuYXNzaWduIDogZnVuY3Rpb24gKHRhcmdldCwgc291cmNlKSB7XG5cdHZhciBmcm9tO1xuXHR2YXIgdG8gPSB0b09iamVjdCh0YXJnZXQpO1xuXHR2YXIgc3ltYm9scztcblxuXHRmb3IgKHZhciBzID0gMTsgcyA8IGFyZ3VtZW50cy5sZW5ndGg7IHMrKykge1xuXHRcdGZyb20gPSBPYmplY3QoYXJndW1lbnRzW3NdKTtcblxuXHRcdGZvciAodmFyIGtleSBpbiBmcm9tKSB7XG5cdFx0XHRpZiAoaGFzT3duUHJvcGVydHkuY2FsbChmcm9tLCBrZXkpKSB7XG5cdFx0XHRcdHRvW2tleV0gPSBmcm9tW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRcdHN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKGZyb20pO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwcm9wSXNFbnVtZXJhYmxlLmNhbGwoZnJvbSwgc3ltYm9sc1tpXSkpIHtcblx0XHRcdFx0XHR0b1tzeW1ib2xzW2ldXSA9IGZyb21bc3ltYm9sc1tpXV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIkxhenlMb2FkLmpzKFtgJHtoVS5iYXNlVVJMfWpzL3ZlbmRvcnMuanNgXSwgKCkgPT4ge1xuXG4gIGNvbnN0IHthc3NpZ259ID0gcmVxdWlyZSgnbG9kYXNoJyk7XG5cbiAgZ2xvYmFsLlJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcbiAgYXNzaWduKGdsb2JhbC5SZWFjdCwgcmVxdWlyZSgncmVhY3QtZG9tJykpO1xuICBcbiAgZ2xvYmFsLmpRdWVyeSA9IHJlcXVpcmUoJ2pxdWVyeScpO1xuICBnbG9iYWwuJCA9IGpRdWVyeTtcblxuICBMYXp5TG9hZC5qcyhbYCR7aFUuYmFzZVVSTH12ZW5kb3JzL3NsaWNrL3NsaWNrLm1pbi5qc2BdLCAoKSA9PiByZXF1aXJlKCcuL3JvdXRlcicpKTtcbn0pO1xuIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHthY3Rpb25zLCBzdG9yZX0gZnJvbSAnLi8uLi9mbHV4J1xuaW1wb3J0IExvYWRpbmcgZnJvbSAnLi9Mb2FkaW5nJ1xuaW1wb3J0IE9mZmVycyBmcm9tICcuL09mZmVycydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSG9tZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5zdGF0ZSA9IHsgbG9hZGluZzogdHJ1ZSB9O1xuICB9XG5cbiAgY29tcG9uZW50RGlkTW91bnQoKSB7XG5cbiAgICBhY3Rpb25zLm9mZmVycy5saXN0KClcbiAgICAgIC50aGVuKCgpID0+IHRoaXMuc2V0U3RhdGUoe2xvYWRpbmc6IGZhbHNlfSkpO1xuICB9ICBcblxuICByZW5kZXIoKSB7XG5cbiAgICBjb25zdCB7bG9hZGluZ30gPSB0aGlzLnN0YXRlO1xuICAgIGNvbnN0IG9mZmVycyA9IHN0b3JlLm9mZmVycy5nZXRPZmZlcnMoKTtcblxuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGlkPVwiSG9tZVwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuXHRcdCAgICAgIDxoMSBjbGFzc05hbWU9XCJzZWN0aW9uLXRpdGxlXCI+T2ZlcnRhcyBkZSB2aWFnZW5zPC9oMT5cbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2FkaW5nID8gPExvYWRpbmcgLz4gOiA8T2ZmZXJzIG9mZmVycz17b2ZmZXJzfSAvPlxuICAgICAgICAgIH1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIExvYWRpbmcgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gIHJlbmRlcigpIHtcblxuICAgIHJldHVybihcbiAgICAgIDxkaXYgaWQ9XCJMb2FkaW5nXCI+XG4gICAgICAgIDxwPkNhcnJlZ2FuZG8uLi48L3A+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IHtMaW5rLCBSb3V0ZUhhbmRsZXJ9IGZyb20gJ3JlYWN0LXBhZ2UnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYWluIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcblxuICByZW5kZXIoKSB7XG5cbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBpZD1cIk1haW5cIj5cbiAgICAgICAgPGhlYWRlcj5cbiAgICAgICAgICA8aDE+XG4gICAgICAgICAgICA8TGluayB0bz1cImFwcFwiPjxpbWcgc3JjPVwiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxQSE4yWnlCNGJXeHVjejBpYUhSMGNEb3ZMM2QzZHk1M015NXZjbWN2TWpBd01DOXpkbWNpSUhkcFpIUm9QU0l4T0RBdU1qUTVJaUJvWldsbmFIUTlJak14TGpnek15SStQR2NnWm1sc2JEMGlJMFpHUmlJK1BIQmhkR2dnWkQwaVRURTJNQzR4SURFeExqRTRPR010TWk0eE9USWdNQzAwTGpBMUxqRXlNeTAwTGprM0xqTTVNeTB1TURNM0xqQXhMUzR3TnpNdU1ESTJMUzR4TURjdU1EUXRMakF5TXk0d01UUXRMakEwTlM0d01pMHVNRFkxTGpBek15MHVNamczTGpFek5TMHVORGczTGpRd05DMHVORGd5TGpjNWRpNHdNVE5zTFM0d01EVXRMakF3TkM0d01EWWdNVEF1TVRaak1DQXVNVGszTGpFek5pNDBOalV1TkRZdU5EWTFhREl1TWpFMFl5NHpNeUF3SUM0ME5DMHVNamd1TkRRdExqUTNiQzB1TURJdE9DNDFNemhqTGpjNUxTNHhOQ0F5TGpFNE55MHVNVFEySURJdU1UZzNMUzR4TkRZZ015NHdOQzR3TWpNZ01pNDVPU0F5TGpNM0lESXVPVGtnTWk0ek4zWTJMak0yTkdNd0lDNHlNVGN1TVRneUxqUTBOUzQwTkRjdU5EUTFiREl1TWk0d01ESmpMakkzTkNBd0lDNDBPREl0TGpFNE9DNDBPREl0TGpRME15NHdNRFV0TGpBNE1pNHdNUzAwTGpZd05DMHVNREUwTFRZdU9UQTJMUzR3TXkweUxqYzBOeTB5TGpBNE55MDBMalUyT0MwMUxqYzJMVFF1TlRZNGVrMHhNek11TWpBMklERXhMakl5Tm1NdE1TNHhOak1nTUMweUxqVXlNeTR6T1RVdE1pNDFNak11TXprMWJDNHdNRE10TXk0d016aGpNQzB1TVRnNExTNHhOUzB1TkRVekxTNDBORFV0TGpRMU0yZ3RNaTR4TTJNdExqRTRNeUF3TFM0ME56UXVNVEE0TFM0ME56UXVORGhzTFM0d01EVWdNVE11TkRFemFDNHdNRFJqTUNBdU1ERXRMakF3TXk0d01UUXRMakF3TXk0d01qTXVNREEyTGpRek5DNHpNVE11TnprekxqY3lOUzQ0TnpNdU1EQTFJREFnTGpBd09DNHdNRFV1TURFeUxqQXdOU0F5TGpBd01pNHpNellnTXk0NU16SXVNekV5SURNdU9UTXlMak14TWlBeUxqUTVJREFnTmk0M056SXRMalE0SURZdU56Y3lMVFl1TURBNElEQXROUzQxTWpRdE5DNDNNRFV0Tmk0d01EUXROUzQ0TmpZdE5pNHdNRFI2YlMweUxqUTJPQ0E1TGpRd05Hd3RMakF5TlMwMkxqSTJOSE11TmpndExqYzVJREl1TURrMExTNDNPV014TGpReE9DQXdJRE11TVRRZ01TNHhOVE1nTXk0eE5DQXpMalUySURBZ01pNDFOUzB1T0RjMklEUXVNRGMwTFRVdU1qRWdNeTQwT1RSNlRUVXpMalF3TlNBNExqRXpTRFV3TGprNFl5MHVNVGcxTGpBd05pMHVNelF1TVRJM0xTNHpOREl1TXpNMlZqRTBMakEyT0dndE5TNDVPR3d0TGpBd015MDFMalEzTldNd0xTNHlOeTB1TWpFNExTNDBOak10TGpRMU5pMHVORFl6U0RReUxqQTBZeTB1TVRVM0lEQXRMalEyTWk0eExTNDBOakl1TkRrNGRqRXpMamMwTkMwdU1ESXpMak14WXpBZ0xqSTJMakl5T0M0ME16SXVORFF1TkRNeWJDNHdNRFF1TURBeWFESXVNVGcxYkMwdU1qWXpMakF3Tmk0eU9DMHVNREEyWXk0eU1UY2dNQ0F1TkRNMkxTNHhPVFV1TkRNMkxTNDBORFYyTFRZdU1UQXlhRFV1T1RneWRqWXVNVEUzWXpBZ0xqSTJOaTR5TlRVdU5ETXVORFl5TGpRemJESXVNVGd1TURBMll5NHpORE1nTUNBdU5EVTNMUzR5Tmk0ME5qTXRMalEzYkM0d01EUXRNVFF1TVRab0xTNHdNRE5qTFM0d01ETXRMakU1TFM0eE5UUXRMak0wTWkwdU16UXlMUzR6TkhwTk9UZ3VNalV6SURJd0xqZzFPR013TFM0ek5EUXRMakk0TmkwdU5EWTNMUzQwTnpVdExqUTJiQzB4TGpFNU55NHhZeTB4TGpjMU55NHhORFF0TVM0M01qZ3RMamczTmkweExqY3lPQzB1T0RjMmJDMHVNREEwTFRFeFl6QXRMak14TmkwdU1qWTFMUzQwTXpndExqUTFMUzQwTXpoc0xUSXVNakV6TFM0d01EUmpMUzR4T0M0d01USXRMalExTGpFeU5TMHVORFV1TkRaMk1UQXVOakV5WXpBZ015NDBNRElnTWk0Mk1EY2dNeTQ1T1RZZ05DNHdPQ0F6TGprNU5pNHpNek1nTUNBdU5qUXlMUzR3TVRJdU9USXRMakF5Tnk0MU5EVXRMakF5T0M0NE5UZ3RMakEzSURFdU1URTNMUzR4TVM0d01pMHVNREF5TFM0d01ETWdNQ0F1TURFdExqQXdOaTR5TWkwdU1ESTFMak01TWkwdU1qTXlMak01TWkwdU5ESTBkaTB4TGpneU1ucE5OelV1T1RrMUlESXdMak01TjB3M05DNDRJREl3TGpWakxURXVOelUzTGpFME1pMHhMamN6TFM0NE56Z3RNUzQzTXkwdU9EYzRkaTAyTGpBM2JESXVORFV5TFM0d01ESmpMak14TWlBd0lDNDBOamd0TGpJek1pNDBOamd0TGpRek5Hd3VNREF6TFRFdU5EWXpZekF0TGpNeU9DMHVNamN5TFM0ME56Y3RMalEyTFM0ME56TnNMVEl1TkRZeUxqQXdNaTB1TURBMkxUSXVNelpqTUMwdU5EY3lMUzR6T0MwdU5UY3RMalU0T0MwdU5URTNiQzB4TGpnM09DNHpPVFYyTGpBd05HTXRMak0xTlM0d09UUXRMall5TlM0ek56Y3RMalkwTGpnd05XZ3RMakF3TTNZdU1ETTJiQzB1TURBeUxqQXdPQzR3TURJdU1ERjJPUzQyT1dNd0lETXVOQ0F5TGpZd05pQXpMams1TlNBMExqQTRJRE11T1RrMUxqTXpNaUF3SUM0Mk5DMHVNREV6TGpreE5pMHVNREk0TGpVMU15MHVNRE11T0RjekxTNHdOeklnTVM0eE15MHVNVEV1TURNdExqQXdOeUF3SUM0d01ETXVNREl0TGpBd055NHlPVFF0TGpBME5TNHpOamN0TGpNeUxqTTJOeTB1TkRZM2JDMHVNREF5TFRFdU56WTBZekF0TGpNMk15MHVNamczTFM0ME9ESXRMalEzTFM0ME56ZDZUVEV5TlM0NE16VWdNVEV1T0RVell5NHdNell0TGpJNUxTNHhPVFF0TGpRMk15MHVNelkyTFM0ME9TMHVNREUxTFM0d01EZ3RMamM1TFM0eE1ESXRNUzR6TnpJdExqRTFPQzB1TWpjMUxTNHdNeTB1TnpNdExqQTJNaTB4TGpBMk5TMHVNRFl5TFRFdU5EYzBJREF0TXk0NU1UUXVOalF6TFRNdU9URTBJRFF1TURRemRqRXVOVFUyYkM0d01ESWdOUzQ0T0Rkak1DQXVNakk0TGpFMUxqUTNOQzQwTmk0ME56Um9NaTR5TWpSakxqRTROaTB1TURBMExqUXpMUzR4TlRndU5ETXRMalEyVmpFMExqWXlPSE10TGpFMkxURXVNRGswSURFdU56TXRMamc0WXpBZ01DQXhMakF6TGpBNU55QXhMakUwTkM0eE1EWXVNVGcyTGpBeE9DNDBNVE10TGpBNUxqUTRMUzR6TmpVdExqQXdNeUF3SUM0eU5EVXRNUzQyTXpJdU1qUTFMVEV1TmpNMWVrMHhOemt1TmprM0lERTNMak16TjJNd0xUWXVORE15TFRZdU1EQTRMVFl1TVRjdE5pNHdNRGd0Tmk0eE4yZ3RMakkyWXkweExqTTBMakExTFRVdU5qZzFMall5TlMwMUxqWTROU0EyTGpBNU1pQXdJREF0TGpNM015QTJMakF5TmlBMUxqZ3hJRFl1TURJMmFDNDBObU0yTGpFNElEQWdOUzQyT0RJdE5TNDVOU0ExTGpZNE1pMDFMamsxZW0wdE5TNDVNRGNnTXk0MU1UWmpMVElnTUMwekxqQXhOUzB4TGpVNE5pMHpMakF4TlMwekxqVTFjeTQ1TnpNdE15NDJOVE1nTWk0NE9EY3RNeTQyTlROak1TNDVORFFnTUNBekxqQXpOaUF4TGpZNE9DQXpMakF6TmlBekxqWTFNbk10TGprMk1pQXpMalUxTFRJdU9UQTRJRE11TlRWNlRUWXhMamczTnlBeE1TNHhOamRvTFM0eU5UaGpMVEV1TXpRekxqQTFMVFV1TmpnMUxqWXlOUzAxTGpZNE5TQTJMakE1TWlBd0lEQXRMak0zTXlBMkxqQXlOaUExTGpneElEWXVNREkyYUM0ME5UaGpOaTR4T0RJZ01DQTFMalk0TWkwMUxqazFJRFV1TmpneUxUVXVPVFVnTUMwMkxqUXpMVFl1TURBNExUWXVNVGN0Tmk0d01EZ3ROaTR4TjNwdExqRXdNeUE1TGpZNE5tTXRNaTR3TURRZ01DMHpMakF4TmkweExqVTROaTB6TGpBeE5pMHpMalUxY3k0NU56SXRNeTQyTlRNZ01pNDRPRFV0TXk0Mk5UTmpNUzQ1TkRNZ01DQXpMakF6TlNBeExqWTRPQ0F6TGpBek5TQXpMalkxTW5NdExqazJJRE11TlRVdE1pNDVNRFVnTXk0MU5YcE5NVEUyTGpVd05DQTRMalUzTldNd0xTNHhPQzB1TVRJdExqUTFMUzQwTnpjdExqUTFiQzB5TGpBNU55MHVNREExWXkwdU1qSXpJREF0TGpRMk9DNHhORE10TGpRMk9DNDBOamRzTGpBd055QXhNUzQ1TldndE15NDFNVE5qTFRFdU5UazNJREF0TWk0ek9UVXRMamM0TkMweUxqTTVOUzB5TGpNME4yd3RMakF4TkMwNUxqWXpZekF0TGpJeU5DMHVNalEwTFM0ME5EUXRMalF6TXkwdU5EUnNMVEl1TWpJeUxqQXdOR010TGpNZ01DMHVORGcxTGpJekxTNDBPUzQwTXpKc0xTNHdNRGNnT1M0M01EZGpNQ0F1TnpFdU1UVTRJREV1TXpNNExqUXpOeUF4TGpreU5ITXVOalUxSURFdU1Ea3lJREV1TVRNMElERXVOVEU0WXk0ME9DNDBNeUF4TGpBME5pNDNOaUF4TGpjdU9Ua3lMalkxTGpJeU55QXhMak0xTGpNME9DQXlMakV1TXpRNGJEVXVPRFl0TGpBd05tTXVNREUxSURBZ0xqQXlOaTB1TURBMUxqQTBMUzR3TURjdU5EWXlMUzR3TWpjdU9ETTFMUzR6T0RVdU9EUTRMUzQ0TlRKMkxTNHdNVE5qTGpBd01pQXdMUzR3TVMweE15NDFPUzB1TURFdE1UTXVOVGt5ZWswNE15NDNPVElnTVRFdU1UWTFZeTAxTGpNNElEQXROUzQ1TnpRZ05DNHpPRE10TlM0NU56UWdOUzQzT1hNdU1ERTBJRFl1TWpjZ05pNDBNeUEyTGpJM1l6QWdNQ0F5TGpJek5DNHdPU0EwTGpRMExTNDNNRFpzTGpBeU55MHVNREZqTGpJeExTNHdOak11TXpRMkxTNHpNVEl1TWpjNExTNDFPRGRzTFM0eU56TXRNUzR5TlRaakxTNHdOamd0TGpJek9DMHVNekUxTFM0ek9UTXRMalUyTFM0ek16Z2dNQ0F3TFRFdU56WTFMalV0TXk0Mk56Y3VOUzB6TGpRMklEQXRNeTQyTWpZdE1pNDJOaTB6TGpZeU5pMHlMalkyYkRjdU9UQTNMUzR3TUROakxqRTVPQ0F3SUM0ME5qZ3RMakV4TlM0ME5qZ3RMalV3Tm13dU1EQXpMVEV1TkRBM2N6QXROUzR3T0RndE5TNDBORE10TlM0d09EaDZiUzB5TGprME55QTBMamN4TjNNdU1UZ3RNaTR6TURjZ01pNDROeTB5TGpNd04yTXlMalE1T0NBd0lESXVOVFkwSURJdU16QTNJREl1TlRZMElESXVNekEzYUMwMUxqUXpOWHBOTVRRMkxqTTBOU0F4TVM0eE56TmpMVEl1TXpFNExqQXdNaTAwTGpNNU5pNDNORFF0TkM0ek9UWXVOelEwYkMwdU1EWXpMakF5WXkwdU1UZzJMakEyTFM0ek56UXVNamd0TGpJNU5pNDFOMnd1TkRBMklERXVNemszWXk0d056WXVNamMxTGpNekxqTTRNeTQxT1RjdU16RTJJREFnTUNBeExqYzJMUzQyTXlBekxqWTNNeTB1TmpneUlESXVPVFF6TFM0d056WWdNaTQzTnlBeExqTXdNeUF5TGpjM0lERXVPVGN1TURBMExqSXlOaUF3SUM0eE5UY2dNQ0F1TVRVM2JDMHVNall1TURBeWFDMDBMakl3Tm5NdE15NDRPRGN0TGpBNU5DMHpMamc0TnlBekxqZ3lPR013SURNdU9EVTNJRFF1TnpJNElETXVOamt6SURRdU56STRJRE11TmpreklEVXVOVFkwTGpBM01pQTFMamsxTWkwdU1TQTFMamsxTWkwdU1YTXVOamcxSURBZ0xqWTROUzB1T0RBM2RpMDNMakEyWXpBdExqa3VNakExTFRRdU1EUTNMVFV1TnpBeUxUUXVNRFEzZW0wdE1TNHhPRFlnT1M0MU9ITXRNUzQyTURRdU1EUXRNUzQyTURRdE1TNHpPV013TFRFdU5UYzFJREV1T0RFdE1TNDBPU0F4TGpneExURXVORGxvTXk0Mk16aHNMakF4SURJdU9EWTBMVE11T0RVMUxqQXhObm9pTHo0OEwyYytQR2NnWm1sc2JEMGlJMFpHUmlJK1BIQmhkR2dnWkQwaVRUTTNMakU0TGpJeU5XTXRMakV3T0MwdU1UUXRMakl5TnkwdU1UUXpMUzR6TURNdExqRTBNMHd6TXk0MU5pNHdPRFpqTFRFdU56TWdNQzB5TGpnek15NDVOQzB6TGpJM05pQXlMamd4YkMwMUxqQTRJREkzTGprek5XTXRMakF5TlM0eE1qUXRMakF6TGpJMU5TNHdOUzR6TlRVdU1EYzNMakE1TWk0eU5UTXVNVE0xTGpNeU5DNHhNelZzTWk0eE1pNHdNV011T0RreklEQWdNaTQxTnpNdExqVXlOU0F6TGpBNE9DMHlMall6TjB3ek55NHlNalF1TlRWakxqQXhNaTB1TURjdU1ETTNMUzR5TWkwdU1EUTBMUzR6TWpWNlRUZ3VOemszSURFeUxqWXpOV3d0TGpBeU5pMHVNVFZNTnk0d015QXlMamczTTBNMkxqVTVJREV1TURJMUlEVXVORGc0TGpBNE15QXpMamMxT0M0d09ETk1MalF4T0M0d056ZElMalF3TlVNdU16SXVNRGM0TGpJd05DNHhOREl1TVRNdU1qTXVNRFkwTGpNeExqQTNOQzQwTlRNdU1Ea3VOVEkzYkRZdU5EUXlJREk0TGpFM1l5NDBOemdnTWk0d01pQXlMakUySURJdU5qSTFJRE11TURVMUlESXVOakkxYkRJdU1UZ3RMakF3T0dNdU1EY2dNQ0F1TWpFekxTNHdNeTR5T1MwdU1USXpMakE0TFM0d09UY3VNRGd0TGpJMExqQTFOaTB1TXpac0xURXVOQzAzTGpZeVl5MHVNRFUxTFM0eU5qVXVNRFV0TGpRd015NHdOUzB1TkRBekxqRTFMUzR4Tmk0ek5UTXRMakV1TXpVekxTNHhJREl1TVRFeUxqY3lNeUF6TGprM01pNDJOVFFnTXk0NU56SXVOalUwSURZdU1UQTJJREFnT1M0ME1EZ3ROQzR6TmpnZ09TNDBNRGd0TkM0ek5qZ3RNUzQxTmpjZ01TNHlNUzB6TGpnNU5pQXhMamswTFRVdU9EUTFJREV1T1RRdE5DNDVOU0F3TFRrdU1EWTNMVE11TlRrMkxUa3VPRFV6TFRndU1qazNlaUl2UGp3dlp6NDhjR0YwYUNCbWFXeHNQU0lqUmtKQ01ETTBJaUJrUFNKTk1UZ3VOall5SURFNUxqZGpOQzQzTmlBd0lEZ3VOak10TXk0NE55QTRMall6TFRndU5qTXlJREF0TVM0M05EUXRMalV5TFRNdU16Y3RNUzQwTVRZdE5DNDNNelF0TVM0MU5EUXRNaTR6TkRZdE5DNHlNREl0TXk0NE9UWXROeTR5TVRRdE15NDRPVFl0TkM0M05pQXdMVGd1TmpNeUlETXVPRGN6TFRndU5qTXlJRGd1TmpNZ01DQXhMamsxTkM0Mk5TQXpMamMxTlNBeExqYzBOQ0ExTGpJd01pQXhMalUzT0NBeUxqQTROQ0EwTGpBNElETXVORE1nTmk0NE9EZ2dNeTQwTTNwdE1DMHhNeTQ0TkROak1pNDROelFnTUNBMUxqSXhNeUF5TGpNek5pQTFMakl4TXlBMUxqSXhJREFnTWk0NE56Z3RNaTR6TkNBMUxqSXhPQzAxTGpJeE15QTFMakl4T0MweUxqZzNOeUF3TFRVdU1qRTBMVEl1TXpRdE5TNHlNVFF0TlM0eU1UY2dNQzB5TGpnM05TQXlMak16TnkwMUxqSXhJRFV1TWpFMExUVXVNakY2SWk4K1BIQmhkR2dnWm1sc2JEMGlJMFU0TjBReFJTSWdaRDBpVFRFeExqYzVNaUF4Tmk0eU56VmpNUzQxTnpnZ01pNHdPRFFnTkM0d056Y2dNeTQwTXpRZ05pNDRPRGdnTXk0ME16UWdOQzQzTmlBd0lEZ3VOak10TXk0NE56UWdPQzQyTXkwNExqWXpOQ0F3TFRFdU56UTJMUzQxTWkwekxqTTNOUzB4TGpReE55MDBMamN6Tm13dExqRTJOaTB1TWpJM1l5NHlPVFF1T0RFdU5EVTFJREV1TmpndU5EVTFJREl1TlRrZ01DQTBMakUzTkMwekxqTXhPQ0EzTGpVNE1pMDNMalEyTXlBM0xqVTRNbWd0TGpBNU5XTXRNaTQ0TnpZZ01DMDFMakUxTnkweUxqTXpPQzAxTGpFMU55MDFMakl4TXlBd0xUSXVPRGN6SURJdU16TTRMVFV1TWpFZ05TNHlNVFF0TlM0eU1Xd3VNRE0xTGpBd05XTXROQzR4TkRnZ01DMDNMalV4T0NBekxqTTFOUzAzTGpVeE9DQTNMalV3TmlBd0lERXVNREl1TWpBeklERXVPVGswTGpVM015QXlMamc0TTJ3dU1ESXVNREo2SWk4K1BDOXpkbWMrXCIgYWx0PVwiSG90ZWwgVXJiYW5vXCIgdGl0bGU9XCJIb3RlbCBVcmJhbm9cIiAvPjwvTGluaz5cbiAgICAgICAgICA8L2gxPlxuICAgICAgICA8L2hlYWRlcj5cblx0XHQgICAgPFJvdXRlSGFuZGxlciAvPlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxufVxuIiwiaW1wb3J0IFJlYWN0LCB7ZmluZERPTU5vZGV9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHthY3Rpb25zLCBzdG9yZX0gZnJvbSAnLi8uLi9mbHV4J1xuaW1wb3J0IE9wdGlvbnMgZnJvbSAnLi9PcHRpb25zJ1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPZmZlciBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgY29tcG9uZW50RGlkTW91bnQoKSB7XG4gICAgTGF6eUxvYWQuY3NzKFtcbiAgICAgIGAke2hVLmJhc2VVUkx9dmVuZG9ycy9zbGljay9zbGljay5jc3NgLFxuICAgICAgYCR7aFUuYmFzZVVSTH12ZW5kb3JzL3NsaWNrL3NsaWNrLXRoZW1lLmNzc2BcbiAgICBdLCB0aGlzLl9zbGljay5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIF9zbGljaygpIHtcbiAgICAkKGZpbmRET01Ob2RlKHRoaXMucmVmcy5zbGljaykpLnNsaWNrKHtcbiAgICAgIHNsaWRlc1RvU2hvdzogMSxcbiAgICAgIHNsaWRlc1RvU2Nyb2xsOiAxLFxuICAgICAgYXJyb3dzOiBmYWxzZSxcbiAgICAgIGZhZGU6IHRydWUsXG4gICAgICBhc05hdkZvcjogJy5uYXYnXG4gICAgfSk7XG5cbiAgICAkKGZpbmRET01Ob2RlKHRoaXMucmVmcy5zbGlja05hdikpLnNsaWNrKHtcbiAgICAgIHNsaWRlc1RvU2hvdzogMCxcbiAgICAgIHNsaWRlc1RvU2Nyb2xsOiAxLFxuICAgICAgYXNOYXZGb3I6ICcud3JhcHBlcicsXG4gICAgICBmb2N1c09uU2VsZWN0OiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICByZW5kZXIoKSB7XG5cbiAgICBjb25zdCBvZmZlciA9IHN0b3JlLm9mZmVycy5nZXRPZmZlcigpO1xuXG4gICAgcmV0dXJuKFxuICAgICAgPGRpdiBpZD1cIk9mZmVyXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyXCI+XG4gICAgICAgICAgPGhlYWRlcj5cbiAgICAgICAgICAgIDxoMSBjbGFzc05hbWU9XCJ0aXRsZVwiPntvZmZlci50aXRsZX08L2gxPlxuICAgICAgICAgICAgPGgyIGNsYXNzTmFtZT1cImxvY2F0aW9uXCI+e29mZmVyLmxvY2F0aW9ufTwvaDI+XG4gICAgICAgICAgICA8cD57b2ZmZXIuZGVzY3JpcHRpb259PC9wPlxuICAgICAgICAgIDwvaGVhZGVyPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2xpZGVzaG93XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIndyYXBwZXJcIiByZWY9XCJzbGlja1wiPlxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgb2ZmZXIucGhvdG9zLm1hcCgocGhvdG8sIGkpID0+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNsaWRlXCIgIGtleT17aX0gc3R5bGU9e3tiYWNrZ3JvdW5kSW1hZ2U6IGB1cmwoJHtoVS5iYXNlVVJMfSR7cGhvdG99KWB9fT5cbiAgICAgICAgICAgICAgICAgICAgPGltZyBzcmM9e2Ake2hVLmJhc2VVUkx9JHtwaG90b31gfSAvPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmF2XCIgcmVmPVwic2xpY2tOYXZcIj5cbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG9mZmVyLnBob3Rvcy5tYXAoKHBob3RvLCBpKSA9PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzbGlkZVwiICBrZXk9e2l9IHN0eWxlPXt7YmFja2dyb3VuZEltYWdlOiBgdXJsKCR7aFUuYmFzZVVSTH0ke3Bob3RvfSlgfX0+XG4gICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPXtgJHtoVS5iYXNlVVJMfSR7cGhvdG99YH0gLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPE9wdGlvbnMgb3B0aW9ucz17b2ZmZXIub3B0aW9uc30gLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQge0xpbmt9IGZyb20gJ3JlYWN0LXBhZ2UnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9mZmVycyBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgX3JhbmRvbkltYWdlS2V5KG1pbiwgbWF4KSB7XG4gICAgcmV0dXJuIHBhcnNlSW50KE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbik7XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgY29uc3Qge29mZmVyc30gPSB0aGlzLnByb3BzO1xuXG4gICAgcmV0dXJuKFxuICAgICAgPGRpdiBpZD1cIk9mZmVyc1wiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvd1wiPlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG9mZmVycy5tYXAoKHtkZXNjcmlwdGlvbiwgaWQsIGxvY2F0aW9uLCBwaG90b3MsIHRpdGxlfSwgaW5kZXgpID0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sdW1uXCIga2V5PXtpbmRleH0+XG4gICAgICAgICAgICAgICAgPExpbmsgdG89XCJvZmZlclwiIHBhcmFtcz17e2lkOiBpZH19PlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpbWFnZVwiIHN0eWxlPXt7YmFja2dyb3VuZEltYWdlOiBgdXJsKCR7cGhvdG9zW3RoaXMuX3JhbmRvbkltYWdlS2V5KDEsNSldfSlgfX0gLz5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaW5mb1wiPlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJsb2NhdGlvblwiPntsb2NhdGlvbn08L3A+XG4gICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0aXRsZVwiPnt0aXRsZX08L2gyPlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJkZXNjcmlwdGlvblwiPntkZXNjcmlwdGlvbn08L3A+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L0xpbms+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgTnVtZXJhbCBmcm9tICdudW1lcmFsJ1xuaW1wb3J0IHtmbGF0dGVuLCBzb3J0QnksIHVuaXF9IGZyb20gJ2xvZGFzaCdcbmltcG9ydCBXYXJuaW5nIGZyb20gJy4vV2FybmluZydcbmltcG9ydCByYW5kb21LZXkgZnJvbSAnLi8uLi9oZWxwZXJzL3JhbmRvbUtleSdcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgT3B0aW9ucyBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgY29uc3RydWN0b3IocHJvcHMpe1xuICAgIHN1cGVyKHByb3BzKTtcbiAgICB0aGlzLnN0YXRlID0ge29wdGlvbnM6IFtdfVxuICB9XG5cbiAgY29tcG9uZW50RGlkTW91bnQoKSB7XG4gICAgY29uc3Qge29wdGlvbnN9ID0gdGhpcy5wcm9wcztcbiAgICB0aGlzLnNldFN0YXRlKHtvcHRpb25zOiBzb3J0Qnkob3B0aW9ucywgJ3ByaWNlJyl9KTtcbiAgfVxuXG4gIF9kYWlseShvcHRpb25zKSB7XG4gICAgY29uc3QgZGFpbHlBcnIgPSBvcHRpb25zLm1hcCgob3B0aW9uLCBpbmRleCkgPT4gb3B0aW9uLmRhaWx5KTtcbiAgICByZXR1cm4gdW5pcShkYWlseUFycik7XG4gIH1cblxuICBfZGVwYXJ0dXJlcyhvcHRpb25zKSB7XG4gICAgY29uc3QgZGVwYXJ0dXJlc0FyciA9IG9wdGlvbnMubWFwKG9wdGlvbiA9PiBvcHRpb24uZnJvbS5tYXAobG9jYXRpb24gPT4gbG9jYXRpb24pKTtcbiAgICByZXR1cm4gdW5pcShmbGF0dGVuKGRlcGFydHVyZXNBcnIpKS5zb3J0KCk7XG4gIH1cblxuICBfZmlsdGVyRGVwYXJ0dXJlKGUpIHtcbiAgICBjb25zdCB7b3B0aW9uc30gPSB0aGlzLnByb3BzO1xuICAgIGNvbnN0IGZpbHRlcmVkT3B0cyA9IFtdO1xuXG4gICAgb3B0aW9ucy5mb3JFYWNoKChvcHRpb24pID0+IHtcbiAgICAgICAgb3B0aW9uLmZyb20uZm9yRWFjaCgobG9jYXRpb24pID0+e1xuICAgICAgICAgIGlmKGxvY2F0aW9uID09PSBlLnRhcmdldC52YWx1ZSkgZmlsdGVyZWRPcHRzLnB1c2gob3B0aW9uKTtcbiAgICAgICAgfSlcbiAgICAgIH0pO1xuXG4gICAgdGhpcy5zZXRTdGF0ZSh7b3B0aW9uczogc29ydEJ5KGZpbHRlcmVkT3B0cywgJ3ByaWNlJyl9KTtcbiAgfVxuXG4gIF9maWx0ZXJEYWlseShlKSB7XG4gICAgY29uc3Qge29wdGlvbnN9ID0gdGhpcy5wcm9wcztcbiAgICBjb25zdCBmaWx0ZXJlZE9wdHMgPSBbXTtcblxuICAgIG9wdGlvbnMuZm9yRWFjaCgob3B0aW9uKSA9PiB7XG4gICAgICBpZihvcHRpb24uZGFpbHkgPT09IE51bWJlcihlLnRhcmdldC52YWx1ZSkpIGZpbHRlcmVkT3B0cy5wdXNoKG9wdGlvbik7XG4gICAgfSk7XG5cbiAgICB0aGlzLnNldFN0YXRlKHtvcHRpb25zOiBzb3J0QnkoZmlsdGVyZWRPcHRzLCAncHJpY2UnKX0pO1xuICB9XG5cbiAgcmVuZGVyKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLnN0YXRlLm9wdGlvbnMgfHwgW107XG4gICAgY29uc3Qgc3JjRGFpbHkgPSB0aGlzLl9kYWlseSh0aGlzLnByb3BzLm9wdGlvbnMpO1xuICAgIGNvbnN0IHNyY0RlcGFydHVyZXMgPSB0aGlzLl9kZXBhcnR1cmVzKHRoaXMucHJvcHMub3B0aW9ucyk7XG5cbiAgICByZXR1cm4oXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm9wdGlvbnNcIj5cbiAgICAgICAgPGhlYWRlcj5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJzZWN0aW9uLXRpdGxlXCI+RXNjb2xoYSBzdWEgbWVsaG9yIG9ww6fDo288L3A+XG4gICAgICAgICAgPGZvcm0+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvcm0tY29udHJvbFwiPlxuICAgICAgICAgICAgICA8bGFiZWw+U2HDrWRhczogPC9sYWJlbD5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZWxlY3Qtd3JhcHBlclwiPlxuICAgICAgICAgICAgICAgIDxzZWxlY3Qgb25DaGFuZ2U9e3RoaXMuX2ZpbHRlckRlcGFydHVyZS5iaW5kKHRoaXMpfT5cbiAgICAgICAgICAgICAgICAgIDxvcHRpb24+RXNjb2xoYTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzcmNEZXBhcnR1cmVzLm1hcCgoZGVwYXJ0dXJlLCBpKSA9PlxuICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24ga2V5PXtpfSB2YWx1ZT17ZGVwYXJ0dXJlfT57ZGVwYXJ0dXJlfTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZvcm0tY29udHJvbFwiPlxuICAgICAgICAgICAgICA8bGFiZWw+Ti4gZGUgZGnDoXJpYXM6IDwvbGFiZWw+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2VsZWN0LXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICA8c2VsZWN0IG9uQ2hhbmdlPXt0aGlzLl9maWx0ZXJEYWlseS5iaW5kKHRoaXMpfT5cbiAgICAgICAgICAgICAgICAgIDxvcHRpb24+RXNjb2xoYTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzcmNEYWlseS5tYXAoKGRhaWx5LCBpKSA9PlxuICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24ga2V5PXtpfSB2YWx1ZT17ZGFpbHl9PntkYWlseX08L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZm9ybT5cbiAgICAgICAgPC9oZWFkZXI+XG4gICAgICAgIHtcbiAgICAgICAgICBvcHRpb25zLm1hcCgob3B0aW9uLCBpbmRleCkgPT5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwib3B0aW9uXCIga2V5PXtpbmRleH0+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaW5mb1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwid3JhcHBlclwiPlxuICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRpdGxlXCI+e29wdGlvbi50aXRsZX08L2gzPlxuICAgICAgICAgICAgICAgICAgPHA+e29wdGlvbi5kZXNjcmlwdGlvbn08L3A+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImRlcGFydHVyZXNcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIndyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRpdGxlXCI+U2HDrWRhczo8L3A+XG4gICAgICAgICAgICAgICAgICA8dWw+XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBvcHRpb24uZnJvbS5tYXAoKGxvY2FsZSwgaW5kZXgpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGkga2V5PXtpbmRleH0+e2xvY2FsZX08L2xpPlxuICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgPC91bD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BlY3NcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIndyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZGFpbHlcIj5cbiAgICAgICAgICAgICAgICAgICAgPHA+e29wdGlvbi5kYWlseX0gPGkgY2xhc3NOYW1lPVwiaWNvbi1jYWxlbmRhci1kYXlcIj48L2k+PC9wPlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJzbWFsbFwiPkRpw6FyaWFzPC9wPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInBlcnNvblwiPlxuICAgICAgICAgICAgICAgICAgICA8cD4xIDxpIGNsYXNzTmFtZT1cImljb24tdXNlclwiPjwvaT48L3A+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInNtYWxsXCI+UGVzc29hPC9wPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInByaWNlXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3cmFwcGVyXCI+XG4gICAgICAgICAgICAgICAgICA8V2FybmluZyBrPXtyYW5kb21LZXkoMCwyKX0gLz5cbiAgICAgICAgICAgICAgICAgIDxwPlBvciBhcGVuYXM6PC9wPlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwicHJpY2UtdmFsdWVcIj48c3Bhbj5SJDwvc3Bhbj4ge051bWVyYWwob3B0aW9uLnByaWNlKS5mb3JtYXQoJzAsMCcpfTwvcD5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRheGVzXCI+KyB0YXhhcyAgZW0gMTB4PC9wPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJidXlcIj5xdWVybyBpcjwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxufVxuIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHJhbmRvbUtleSBmcm9tICcuLy4uL2hlbHBlcnMvcmFuZG9tS2V5J1xuaW1wb3J0IHdhcm5pbmdzIGZyb20gJy4vLi4vaGVscGVycy93YXJuaW5ncydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2FybmluZyBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgcmVuZGVyKCkge1xuXG4gICAgY29uc3Qge2t9ID0gdGhpcy5wcm9wcztcblxuICAgIHJldHVybihcbiAgICAgIDxwIGNsYXNzTmFtZT17YHdhcm5pbmcgJHt3YXJuaW5nc1trXS5jb2xvcn1gfT57d2FybmluZ3Nba10ubXNnfTwvcD5cbiAgICApXG4gIH1cbn1cbiIsImltcG9ydCBudW1lcmFsIGZyb20gJ251bWVyYWwnO1xuXG5udW1lcmFsLmxhbmd1YWdlKCdwdC1icicsIHtcbiAgY3VycmVuY3k6IHtcbiAgICBzeW1ib2w6ICdSJCdcbiAgfSwgIFxuICBkZWxpbWl0ZXJzOiB7XG4gICAgdGhvdXNhbmRzOiAnLicsXG4gICAgZGVjaW1hbDogJywnXG4gIH1cbn0pO1xuXG5udW1lcmFsLmxhbmd1YWdlKCdwdC1icicpO1xuXG5leHBvcnQge251bWVyYWx9O1xuIiwiaW1wb3J0IE1jRmx5IGZyb20gJ21jZmx5JztcblxuY29uc3QgRmx1eCA9IG5ldyBNY0ZseSgpO1xuXG4vLyBTRVQgQUNUSU9OU1xuY29uc3QgT2ZmZXJzQWN0aW9ucyA9IEZsdXguY3JlYXRlQWN0aW9ucyhcbiAge1xuICAgIGxpc3Q6ICgpID0+IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgJC5nZXQoYCR7aFUuYmFzZVVSTH1hcGkvb2ZmZXJzYClcbiAgICAgICAgLmRvbmUoKGRhdGEpID0+IHJlc29sdmUoZGF0YSkpXG4gICAgICAgIC5mYWlsKChqcXhociwgdGV4dFN0YXR1cywgZXJyb3IpID0+IGNvbnNvbGUubG9nKGVycm9yKSk7XG4gICAgICB9KVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gKHtcbiAgICAgICAgZGF0YTogcmVzdWx0LFxuICAgICAgICBhY3Rpb25UeXBlOiBcIk9GRkVSU1wiXG4gICAgfSkpLFxuXG4gICAgZ2V0OiAoaWQpID0+IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgJC5nZXQoYCR7aFUuYmFzZVVSTH1hcGkvb2ZmZXIvJHtpZH1gKVxuICAgICAgIC5kb25lKChkYXRhKSA9PiByZXNvbHZlKGRhdGEpKVxuICAgICAgIC5mYWlsKChqcXhociwgdGV4dFN0YXR1cywgZXJyb3IpID0+IGNvbnNvbGUubG9nKGVycm9yKSk7XG4gICAgICB9KVxuICAgIC50aGVuKChyZXN1bHQpID0+ICh7XG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgICBhY3Rpb25UeXBlOiBcIk9GRkVSXCJcbiAgICB9KSlcbiAgfVxuKTtcblxuLy8gU0VUIFNUT1JFU1xuY29uc3QgT2ZmZXJzU3RvcmUgPSBGbHV4LmNyZWF0ZVN0b3JlKFxuICB7XG4gICAgc2V0T2ZmZXJzOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB0aGlzLm9mZmVycyA9IGRhdGE7XG4gICAgfSxcblxuICAgIGdldE9mZmVyczogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5vZmZlcnM7XG4gICAgfSxcblxuICAgIHNldE9mZmVyOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICB0aGlzLm9mZmVyID0gZGF0YTsgICAgICBcbiAgICB9LFxuXG4gICAgZ2V0T2ZmZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMub2ZmZXI7XG4gICAgfVxuICB9LFxuXG4gIGZ1bmN0aW9uKHBheWxvYWQpe1xuICAgIHN3aXRjaChwYXlsb2FkLmFjdGlvblR5cGUpIHtcbiAgICAgIGNhc2UgJ09GRkVSUyc6XG4gICAgICAgIE9mZmVyc1N0b3JlLnNldE9mZmVycyhwYXlsb2FkLmRhdGEpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnT0ZGRVInOlxuICAgICAgICBPZmZlcnNTdG9yZS5zZXRPZmZlcihwYXlsb2FkLmRhdGEpO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG4pO1xuXG4vLyBIRUxQRVJcbmNvbnN0IGFsaWFzZXMgPSB7XG4gIGFjdGlvbnM6IHtcbiAgICBvZmZlcnM6IE9mZmVyc0FjdGlvbnNcbiAgfSxcblxuICBzdG9yZToge1xuICAgIG9mZmVyczogT2ZmZXJzU3RvcmVcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFsaWFzZXM7XG4iLCJjb25zdCByYW5kb21LZXkgPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgIHJldHVybiBwYXJzZUludChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikgKyBtaW4pO1xuICB9XG5cbmV4cG9ydCBkZWZhdWx0IHJhbmRvbUtleTtcbiIsImNvbnN0IHdhcm5pbmdzID0gW1xuICB7XG4gICAgbXNnOiAnJCBUYXJpZmEgbsOjbyByZWVtYm9sc8OhdmVsJyxcbiAgICBjb2xvcjogJ29yYW5nZSdcbiAgfSxcbiAge1xuICAgIG1zZzogJyQgQ2FuY2VsYW1lbnRvIGdyw6F0aXMnLFxuICAgIGNvbG9yOiAnZ3JlZW4nXG4gIH1cbl07XG5cbmV4cG9ydCBkZWZhdWx0IHdhcm5pbmdzO1xuIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0JztcbmltcG9ydCBSZWFjdERPTSBmcm9tICdyZWFjdC1kb20nO1xuaW1wb3J0IFBhZ2UgZnJvbSAncmVhY3QtcGFnZSc7XG5cbmltcG9ydCB7YWN0aW9ucywgc3RvcmV9IGZyb20gJy4vZmx1eCc7XG5pbXBvcnQgTWFpbiBmcm9tICcuL2NvbXBvbmVudHMvTWFpbic7XG5pbXBvcnQgSG9tZSBmcm9tICcuL2NvbXBvbmVudHMvSG9tZSc7XG5pbXBvcnQgT2ZmZXIgZnJvbSAnLi9jb21wb25lbnRzL09mZmVyJztcblxuaW1wb3J0IG51bWVyYWwgZnJvbSAnLi9jb25maWcvbnVtZXJhbCc7XG5cbnZhciByZW5kZXIgPSBSb290Q29tcG9uZW50ID0+IFJlYWN0RE9NLnJlbmRlcig8Um9vdENvbXBvbmVudCAvPixcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FwcCcpKTtcblxuUGFnZS5zZXQocmVuZGVyKVxuIC53aXRoKE1haW4pXG4gIC5vbihcbiAgICAnYXBwJyxcbiAgICAnLycsXG4gICAgSG9tZVxuICApXG4gIC5vbihcbiAgICAnb2ZmZXInLFxuICAgICcvb2ZmZXIvOmlkJyxcbiAgICBQYWdlLndoZW4oXG4gICAgICAoe3BhcmFtc30pID0+IGFjdGlvbnMub2ZmZXJzLmdldChwYXJhbXMuaWQpLFxuICAgICAgT2ZmZXIsXG4gICAgICBudWxsLFxuICAgICAgbnVsbFxuICAgIClcbiAgKVxuICAucnVuKCk7XG4iXX0=
