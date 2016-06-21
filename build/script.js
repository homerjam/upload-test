(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function (exports) {
  'use strict'

  var i
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var lookup = []
  for (i = 0; i < code.length; i++) {
    lookup[i] = code[i]
  }
  var revLookup = []

  for (i = 0; i < code.length; ++i) {
    revLookup[code.charCodeAt(i)] = i
  }
  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

  function decode (elt) {
    var v = revLookup[elt.charCodeAt(0)]
    return v !== undefined ? v : -1
  }

  function b64ToByteArray (b64) {
    var i, j, l, tmp, placeHolders, arr

    if (b64.length % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    var len = b64.length
    placeHolders = b64.charAt(len - 2) === '=' ? 2 : b64.charAt(len - 1) === '=' ? 1 : 0

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(b64.length * 3 / 4 - placeHolders)

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? b64.length - 4 : b64.length

    var L = 0

    function push (v) {
      arr[L++] = v
    }

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
      push((tmp & 0xFF0000) >> 16)
      push((tmp & 0xFF00) >> 8)
      push(tmp & 0xFF)
    }

    if (placeHolders === 2) {
      tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
      push(tmp & 0xFF)
    } else if (placeHolders === 1) {
      tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
      push((tmp >> 8) & 0xFF)
      push(tmp & 0xFF)
    }

    return arr
  }

  function encode (num) {
    return lookup[num]
  }

  function tripletToBase64 (num) {
    return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
  }

  function encodeChunk (uint8, start, end) {
    var temp
    var output = []
    for (var i = start; i < end; i += 3) {
      temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
      output.push(tripletToBase64(temp))
    }
    return output.join('')
  }

  function uint8ToBase64 (uint8) {
    var i
    var extraBytes = uint8.length % 3 // if we have 1 byte left, pad 2 bytes
    var output = ''
    var parts = []
    var temp, length
    var maxChunkLength = 16383 // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later

    for (i = 0, length = uint8.length - extraBytes; i < length; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > length ? length : (i + maxChunkLength)))
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    switch (extraBytes) {
      case 1:
        temp = uint8[uint8.length - 1]
        output += encode(temp >> 2)
        output += encode((temp << 4) & 0x3F)
        output += '=='
        break
      case 2:
        temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
        output += encode(temp >> 10)
        output += encode((temp >> 4) & 0x3F)
        output += encode((temp << 2) & 0x3F)
        output += '='
        break
      default:
        break
    }

    parts.push(output)

    return parts.join('')
  }

  exports.toByteArray = b64ToByteArray
  exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":4,"isarray":3}],3:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
module.exports = arrayBufferConcat

function arrayBufferConcat () {
  var length = 0
  var buffer = null

  for (var i in arguments) {
    buffer = arguments[i]
    length += buffer.byteLength
  }

  var joined = new Uint8Array(length)
  var offset = 0

  for (var i in arguments) {
    buffer = arguments[i]
    joined.set(new Uint8Array(buffer), offset)
    offset += buffer.byteLength
  }

  return joined.buffer
}

},{}],6:[function(require,module,exports){
/*
 * JavaScript Canvas to Blob
 * https://github.com/blueimp/JavaScript-Canvas-to-Blob
 *
 * Copyright 2012, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 *
 * Based on stackoverflow user Stoive's code snippet:
 * http://stackoverflow.com/q/4998908
 */

/*global window, atob, Blob, ArrayBuffer, Uint8Array, define, module */

;(function (window) {
  'use strict'

  var CanvasPrototype = window.HTMLCanvasElement &&
                          window.HTMLCanvasElement.prototype
  var hasBlobConstructor = window.Blob && (function () {
    try {
      return Boolean(new Blob())
    } catch (e) {
      return false
    }
  }())
  var hasArrayBufferViewSupport = hasBlobConstructor && window.Uint8Array &&
    (function () {
      try {
        return new Blob([new Uint8Array(100)]).size === 100
      } catch (e) {
        return false
      }
    }())
  var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder ||
                      window.MozBlobBuilder || window.MSBlobBuilder
  var dataURIPattern = /^data:((.*?)(;charset=.*?)?)(;base64)?,/
  var dataURLtoBlob = (hasBlobConstructor || BlobBuilder) && window.atob &&
    window.ArrayBuffer && window.Uint8Array &&
    function (dataURI) {
      var matches,
        mediaType,
        isBase64,
        dataString,
        byteString,
        arrayBuffer,
        intArray,
        i,
        bb
      // Parse the dataURI components as per RFC 2397
      matches = dataURI.match(dataURIPattern)
      if (!matches) {
        throw new Error('invalid data URI')
      }
      // Default to text/plain;charset=US-ASCII
      mediaType = matches[2]
        ? matches[1]
        : 'text/plain' + (matches[3] || ';charset=US-ASCII')
      isBase64 = !!matches[4]
      dataString = dataURI.slice(matches[0].length)
      if (isBase64) {
        // Convert base64 to raw binary data held in a string:
        byteString = atob(dataString)
      } else {
        // Convert base64/URLEncoded data component to raw binary:
        byteString = decodeURIComponent(dataString)
      }
      // Write the bytes of the string to an ArrayBuffer:
      arrayBuffer = new ArrayBuffer(byteString.length)
      intArray = new Uint8Array(arrayBuffer)
      for (i = 0; i < byteString.length; i += 1) {
        intArray[i] = byteString.charCodeAt(i)
      }
      // Write the ArrayBuffer (or ArrayBufferView) to a blob:
      if (hasBlobConstructor) {
        return new Blob(
          [hasArrayBufferViewSupport ? intArray : arrayBuffer],
          {type: mediaType}
        )
      }
      bb = new BlobBuilder()
      bb.append(arrayBuffer)
      return bb.getBlob(mediaType)
    }
  if (window.HTMLCanvasElement && !CanvasPrototype.toBlob) {
    if (CanvasPrototype.mozGetAsFile) {
      CanvasPrototype.toBlob = function (callback, type, quality) {
        if (quality && CanvasPrototype.toDataURL && dataURLtoBlob) {
          callback(dataURLtoBlob(this.toDataURL(type, quality)))
        } else {
          callback(this.mozGetAsFile('blob', type))
        }
      }
    } else if (CanvasPrototype.toDataURL && dataURLtoBlob) {
      CanvasPrototype.toBlob = function (callback, type, quality) {
        callback(dataURLtoBlob(this.toDataURL(type, quality)))
      }
    }
  }
  if (typeof define === 'function' && define.amd) {
    define(function () {
      return dataURLtoBlob
    })
  } else if (typeof module === 'object' && module.exports) {
    module.exports = dataURLtoBlob
  } else {
    window.dataURLtoBlob = dataURLtoBlob
  }
}(window))

},{}],7:[function(require,module,exports){
module.exports = require('./js/load-image')

require('./js/load-image-exif')
require('./js/load-image-exif-map')
require('./js/load-image-meta')
require('./js/load-image-orientation')

},{"./js/load-image":12,"./js/load-image-exif":9,"./js/load-image-exif-map":8,"./js/load-image-meta":10,"./js/load-image-orientation":11}],8:[function(require,module,exports){
/*
 * JavaScript Load Image Exif Map
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Exif tags mapping based on
 * https://github.com/jseidelin/exif-js
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, require, window */

;(function (factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image', './load-image-exif'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'), require('./load-image-exif'))
  } else {
    // Browser globals:
    factory(window.loadImage)
  }
}(function (loadImage) {
  'use strict'

  loadImage.ExifMap.prototype.tags = {
    // =================
    // TIFF tags (IFD0):
    // =================
    0x0100: 'ImageWidth',
    0x0101: 'ImageHeight',
    0x8769: 'ExifIFDPointer',
    0x8825: 'GPSInfoIFDPointer',
    0xA005: 'InteroperabilityIFDPointer',
    0x0102: 'BitsPerSample',
    0x0103: 'Compression',
    0x0106: 'PhotometricInterpretation',
    0x0112: 'Orientation',
    0x0115: 'SamplesPerPixel',
    0x011C: 'PlanarConfiguration',
    0x0212: 'YCbCrSubSampling',
    0x0213: 'YCbCrPositioning',
    0x011A: 'XResolution',
    0x011B: 'YResolution',
    0x0128: 'ResolutionUnit',
    0x0111: 'StripOffsets',
    0x0116: 'RowsPerStrip',
    0x0117: 'StripByteCounts',
    0x0201: 'JPEGInterchangeFormat',
    0x0202: 'JPEGInterchangeFormatLength',
    0x012D: 'TransferFunction',
    0x013E: 'WhitePoint',
    0x013F: 'PrimaryChromaticities',
    0x0211: 'YCbCrCoefficients',
    0x0214: 'ReferenceBlackWhite',
    0x0132: 'DateTime',
    0x010E: 'ImageDescription',
    0x010F: 'Make',
    0x0110: 'Model',
    0x0131: 'Software',
    0x013B: 'Artist',
    0x8298: 'Copyright',
    // ==================
    // Exif Sub IFD tags:
    // ==================
    0x9000: 'ExifVersion', // EXIF version
    0xA000: 'FlashpixVersion', // Flashpix format version
    0xA001: 'ColorSpace', // Color space information tag
    0xA002: 'PixelXDimension', // Valid width of meaningful image
    0xA003: 'PixelYDimension', // Valid height of meaningful image
    0xA500: 'Gamma',
    0x9101: 'ComponentsConfiguration', // Information about channels
    0x9102: 'CompressedBitsPerPixel', // Compressed bits per pixel
    0x927C: 'MakerNote', // Any desired information written by the manufacturer
    0x9286: 'UserComment', // Comments by user
    0xA004: 'RelatedSoundFile', // Name of related sound file
    0x9003: 'DateTimeOriginal', // Date and time when the original image was generated
    0x9004: 'DateTimeDigitized', // Date and time when the image was stored digitally
    0x9290: 'SubSecTime', // Fractions of seconds for DateTime
    0x9291: 'SubSecTimeOriginal', // Fractions of seconds for DateTimeOriginal
    0x9292: 'SubSecTimeDigitized', // Fractions of seconds for DateTimeDigitized
    0x829A: 'ExposureTime', // Exposure time (in seconds)
    0x829D: 'FNumber',
    0x8822: 'ExposureProgram', // Exposure program
    0x8824: 'SpectralSensitivity', // Spectral sensitivity
    0x8827: 'PhotographicSensitivity', // EXIF 2.3, ISOSpeedRatings in EXIF 2.2
    0x8828: 'OECF', // Optoelectric conversion factor
    0x8830: 'SensitivityType',
    0x8831: 'StandardOutputSensitivity',
    0x8832: 'RecommendedExposureIndex',
    0x8833: 'ISOSpeed',
    0x8834: 'ISOSpeedLatitudeyyy',
    0x8835: 'ISOSpeedLatitudezzz',
    0x9201: 'ShutterSpeedValue', // Shutter speed
    0x9202: 'ApertureValue', // Lens aperture
    0x9203: 'BrightnessValue', // Value of brightness
    0x9204: 'ExposureBias', // Exposure bias
    0x9205: 'MaxApertureValue', // Smallest F number of lens
    0x9206: 'SubjectDistance', // Distance to subject in meters
    0x9207: 'MeteringMode', // Metering mode
    0x9208: 'LightSource', // Kind of light source
    0x9209: 'Flash', // Flash status
    0x9214: 'SubjectArea', // Location and area of main subject
    0x920A: 'FocalLength', // Focal length of the lens in mm
    0xA20B: 'FlashEnergy', // Strobe energy in BCPS
    0xA20C: 'SpatialFrequencyResponse',
    0xA20E: 'FocalPlaneXResolution', // Number of pixels in width direction per FPRUnit
    0xA20F: 'FocalPlaneYResolution', // Number of pixels in height direction per FPRUnit
    0xA210: 'FocalPlaneResolutionUnit', // Unit for measuring the focal plane resolution
    0xA214: 'SubjectLocation', // Location of subject in image
    0xA215: 'ExposureIndex', // Exposure index selected on camera
    0xA217: 'SensingMethod', // Image sensor type
    0xA300: 'FileSource', // Image source (3 == DSC)
    0xA301: 'SceneType', // Scene type (1 == directly photographed)
    0xA302: 'CFAPattern', // Color filter array geometric pattern
    0xA401: 'CustomRendered', // Special processing
    0xA402: 'ExposureMode', // Exposure mode
    0xA403: 'WhiteBalance', // 1 = auto white balance, 2 = manual
    0xA404: 'DigitalZoomRatio', // Digital zoom ratio
    0xA405: 'FocalLengthIn35mmFilm',
    0xA406: 'SceneCaptureType', // Type of scene
    0xA407: 'GainControl', // Degree of overall image gain adjustment
    0xA408: 'Contrast', // Direction of contrast processing applied by camera
    0xA409: 'Saturation', // Direction of saturation processing applied by camera
    0xA40A: 'Sharpness', // Direction of sharpness processing applied by camera
    0xA40B: 'DeviceSettingDescription',
    0xA40C: 'SubjectDistanceRange', // Distance to subject
    0xA420: 'ImageUniqueID', // Identifier assigned uniquely to each image
    0xA430: 'CameraOwnerName',
    0xA431: 'BodySerialNumber',
    0xA432: 'LensSpecification',
    0xA433: 'LensMake',
    0xA434: 'LensModel',
    0xA435: 'LensSerialNumber',
    // ==============
    // GPS Info tags:
    // ==============
    0x0000: 'GPSVersionID',
    0x0001: 'GPSLatitudeRef',
    0x0002: 'GPSLatitude',
    0x0003: 'GPSLongitudeRef',
    0x0004: 'GPSLongitude',
    0x0005: 'GPSAltitudeRef',
    0x0006: 'GPSAltitude',
    0x0007: 'GPSTimeStamp',
    0x0008: 'GPSSatellites',
    0x0009: 'GPSStatus',
    0x000A: 'GPSMeasureMode',
    0x000B: 'GPSDOP',
    0x000C: 'GPSSpeedRef',
    0x000D: 'GPSSpeed',
    0x000E: 'GPSTrackRef',
    0x000F: 'GPSTrack',
    0x0010: 'GPSImgDirectionRef',
    0x0011: 'GPSImgDirection',
    0x0012: 'GPSMapDatum',
    0x0013: 'GPSDestLatitudeRef',
    0x0014: 'GPSDestLatitude',
    0x0015: 'GPSDestLongitudeRef',
    0x0016: 'GPSDestLongitude',
    0x0017: 'GPSDestBearingRef',
    0x0018: 'GPSDestBearing',
    0x0019: 'GPSDestDistanceRef',
    0x001A: 'GPSDestDistance',
    0x001B: 'GPSProcessingMethod',
    0x001C: 'GPSAreaInformation',
    0x001D: 'GPSDateStamp',
    0x001E: 'GPSDifferential',
    0x001F: 'GPSHPositioningError'
  }

  loadImage.ExifMap.prototype.stringValues = {
    ExposureProgram: {
      0: 'Undefined',
      1: 'Manual',
      2: 'Normal program',
      3: 'Aperture priority',
      4: 'Shutter priority',
      5: 'Creative program',
      6: 'Action program',
      7: 'Portrait mode',
      8: 'Landscape mode'
    },
    MeteringMode: {
      0: 'Unknown',
      1: 'Average',
      2: 'CenterWeightedAverage',
      3: 'Spot',
      4: 'MultiSpot',
      5: 'Pattern',
      6: 'Partial',
      255: 'Other'
    },
    LightSource: {
      0: 'Unknown',
      1: 'Daylight',
      2: 'Fluorescent',
      3: 'Tungsten (incandescent light)',
      4: 'Flash',
      9: 'Fine weather',
      10: 'Cloudy weather',
      11: 'Shade',
      12: 'Daylight fluorescent (D 5700 - 7100K)',
      13: 'Day white fluorescent (N 4600 - 5400K)',
      14: 'Cool white fluorescent (W 3900 - 4500K)',
      15: 'White fluorescent (WW 3200 - 3700K)',
      17: 'Standard light A',
      18: 'Standard light B',
      19: 'Standard light C',
      20: 'D55',
      21: 'D65',
      22: 'D75',
      23: 'D50',
      24: 'ISO studio tungsten',
      255: 'Other'
    },
    Flash: {
      0x0000: 'Flash did not fire',
      0x0001: 'Flash fired',
      0x0005: 'Strobe return light not detected',
      0x0007: 'Strobe return light detected',
      0x0009: 'Flash fired, compulsory flash mode',
      0x000D: 'Flash fired, compulsory flash mode, return light not detected',
      0x000F: 'Flash fired, compulsory flash mode, return light detected',
      0x0010: 'Flash did not fire, compulsory flash mode',
      0x0018: 'Flash did not fire, auto mode',
      0x0019: 'Flash fired, auto mode',
      0x001D: 'Flash fired, auto mode, return light not detected',
      0x001F: 'Flash fired, auto mode, return light detected',
      0x0020: 'No flash function',
      0x0041: 'Flash fired, red-eye reduction mode',
      0x0045: 'Flash fired, red-eye reduction mode, return light not detected',
      0x0047: 'Flash fired, red-eye reduction mode, return light detected',
      0x0049: 'Flash fired, compulsory flash mode, red-eye reduction mode',
      0x004D: 'Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected',
      0x004F: 'Flash fired, compulsory flash mode, red-eye reduction mode, return light detected',
      0x0059: 'Flash fired, auto mode, red-eye reduction mode',
      0x005D: 'Flash fired, auto mode, return light not detected, red-eye reduction mode',
      0x005F: 'Flash fired, auto mode, return light detected, red-eye reduction mode'
    },
    SensingMethod: {
      1: 'Undefined',
      2: 'One-chip color area sensor',
      3: 'Two-chip color area sensor',
      4: 'Three-chip color area sensor',
      5: 'Color sequential area sensor',
      7: 'Trilinear sensor',
      8: 'Color sequential linear sensor'
    },
    SceneCaptureType: {
      0: 'Standard',
      1: 'Landscape',
      2: 'Portrait',
      3: 'Night scene'
    },
    SceneType: {
      1: 'Directly photographed'
    },
    CustomRendered: {
      0: 'Normal process',
      1: 'Custom process'
    },
    WhiteBalance: {
      0: 'Auto white balance',
      1: 'Manual white balance'
    },
    GainControl: {
      0: 'None',
      1: 'Low gain up',
      2: 'High gain up',
      3: 'Low gain down',
      4: 'High gain down'
    },
    Contrast: {
      0: 'Normal',
      1: 'Soft',
      2: 'Hard'
    },
    Saturation: {
      0: 'Normal',
      1: 'Low saturation',
      2: 'High saturation'
    },
    Sharpness: {
      0: 'Normal',
      1: 'Soft',
      2: 'Hard'
    },
    SubjectDistanceRange: {
      0: 'Unknown',
      1: 'Macro',
      2: 'Close view',
      3: 'Distant view'
    },
    FileSource: {
      3: 'DSC'
    },
    ComponentsConfiguration: {
      0: '',
      1: 'Y',
      2: 'Cb',
      3: 'Cr',
      4: 'R',
      5: 'G',
      6: 'B'
    },
    Orientation: {
      1: 'top-left',
      2: 'top-right',
      3: 'bottom-right',
      4: 'bottom-left',
      5: 'left-top',
      6: 'right-top',
      7: 'right-bottom',
      8: 'left-bottom'
    }
  }

  loadImage.ExifMap.prototype.getText = function (id) {
    var value = this.get(id)
    switch (id) {
      case 'LightSource':
      case 'Flash':
      case 'MeteringMode':
      case 'ExposureProgram':
      case 'SensingMethod':
      case 'SceneCaptureType':
      case 'SceneType':
      case 'CustomRendered':
      case 'WhiteBalance':
      case 'GainControl':
      case 'Contrast':
      case 'Saturation':
      case 'Sharpness':
      case 'SubjectDistanceRange':
      case 'FileSource':
      case 'Orientation':
        return this.stringValues[id][value]
      case 'ExifVersion':
      case 'FlashpixVersion':
        return String.fromCharCode(value[0], value[1], value[2], value[3])
      case 'ComponentsConfiguration':
        return this.stringValues[id][value[0]] +
        this.stringValues[id][value[1]] +
        this.stringValues[id][value[2]] +
        this.stringValues[id][value[3]]
      case 'GPSVersionID':
        return value[0] + '.' + value[1] + '.' + value[2] + '.' + value[3]
    }
    return String(value)
  }

  ;(function (exifMapPrototype) {
    var tags = exifMapPrototype.tags
    var map = exifMapPrototype.map
    var prop
    // Map the tag names to tags:
    for (prop in tags) {
      if (tags.hasOwnProperty(prop)) {
        map[tags[prop]] = prop
      }
    }
  }(loadImage.ExifMap.prototype))

  loadImage.ExifMap.prototype.getAll = function () {
    var map = {}
    var prop
    var id
    for (prop in this) {
      if (this.hasOwnProperty(prop)) {
        id = this.tags[prop]
        if (id) {
          map[id] = this.getText(id)
        }
      }
    }
    return map
  }
}))

},{"./load-image":12,"./load-image-exif":9}],9:[function(require,module,exports){
/*
 * JavaScript Load Image Exif Parser
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, require, window, console */

;(function (factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image', './load-image-meta'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'), require('./load-image-meta'))
  } else {
    // Browser globals:
    factory(window.loadImage)
  }
}(function (loadImage) {
  'use strict'

  loadImage.ExifMap = function () {
    return this
  }

  loadImage.ExifMap.prototype.map = {
    'Orientation': 0x0112
  }

  loadImage.ExifMap.prototype.get = function (id) {
    return this[id] || this[this.map[id]]
  }

  loadImage.getExifThumbnail = function (dataView, offset, length) {
    var hexData,
      i,
      b
    if (!length || offset + length > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid thumbnail data.')
      return
    }
    hexData = []
    for (i = 0; i < length; i += 1) {
      b = dataView.getUint8(offset + i)
      hexData.push((b < 16 ? '0' : '') + b.toString(16))
    }
    return 'data:image/jpeg,%' + hexData.join('%')
  }

  loadImage.exifTagTypes = {
    // byte, 8-bit unsigned int:
    1: {
      getValue: function (dataView, dataOffset) {
        return dataView.getUint8(dataOffset)
      },
      size: 1
    },
    // ascii, 8-bit byte:
    2: {
      getValue: function (dataView, dataOffset) {
        return String.fromCharCode(dataView.getUint8(dataOffset))
      },
      size: 1,
      ascii: true
    },
    // short, 16 bit int:
    3: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getUint16(dataOffset, littleEndian)
      },
      size: 2
    },
    // long, 32 bit int:
    4: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getUint32(dataOffset, littleEndian)
      },
      size: 4
    },
    // rational = two long values, first is numerator, second is denominator:
    5: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getUint32(dataOffset, littleEndian) /
        dataView.getUint32(dataOffset + 4, littleEndian)
      },
      size: 8
    },
    // slong, 32 bit signed int:
    9: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getInt32(dataOffset, littleEndian)
      },
      size: 4
    },
    // srational, two slongs, first is numerator, second is denominator:
    10: {
      getValue: function (dataView, dataOffset, littleEndian) {
        return dataView.getInt32(dataOffset, littleEndian) /
        dataView.getInt32(dataOffset + 4, littleEndian)
      },
      size: 8
    }
  }
  // undefined, 8-bit byte, value depending on field:
  loadImage.exifTagTypes[7] = loadImage.exifTagTypes[1]

  loadImage.getExifValue = function (dataView, tiffOffset, offset, type, length, littleEndian) {
    var tagType = loadImage.exifTagTypes[type]
    var tagSize
    var dataOffset
    var values
    var i
    var str
    var c
    if (!tagType) {
      console.log('Invalid Exif data: Invalid tag type.')
      return
    }
    tagSize = tagType.size * length
    // Determine if the value is contained in the dataOffset bytes,
    // or if the value at the dataOffset is a pointer to the actual data:
    dataOffset = tagSize > 4
      ? tiffOffset + dataView.getUint32(offset + 8, littleEndian)
      : (offset + 8)
    if (dataOffset + tagSize > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid data offset.')
      return
    }
    if (length === 1) {
      return tagType.getValue(dataView, dataOffset, littleEndian)
    }
    values = []
    for (i = 0; i < length; i += 1) {
      values[i] = tagType.getValue(dataView, dataOffset + i * tagType.size, littleEndian)
    }
    if (tagType.ascii) {
      str = ''
      // Concatenate the chars:
      for (i = 0; i < values.length; i += 1) {
        c = values[i]
        // Ignore the terminating NULL byte(s):
        if (c === '\u0000') {
          break
        }
        str += c
      }
      return str
    }
    return values
  }

  loadImage.parseExifTag = function (dataView, tiffOffset, offset, littleEndian, data) {
    var tag = dataView.getUint16(offset, littleEndian)
    data.exif[tag] = loadImage.getExifValue(
      dataView,
      tiffOffset,
      offset,
      dataView.getUint16(offset + 2, littleEndian), // tag type
      dataView.getUint32(offset + 4, littleEndian), // tag length
      littleEndian
    )
  }

  loadImage.parseExifTags = function (dataView, tiffOffset, dirOffset, littleEndian, data) {
    var tagsNumber,
      dirEndOffset,
      i
    if (dirOffset + 6 > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid directory offset.')
      return
    }
    tagsNumber = dataView.getUint16(dirOffset, littleEndian)
    dirEndOffset = dirOffset + 2 + 12 * tagsNumber
    if (dirEndOffset + 4 > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid directory size.')
      return
    }
    for (i = 0; i < tagsNumber; i += 1) {
      this.parseExifTag(
        dataView,
        tiffOffset,
        dirOffset + 2 + 12 * i, // tag offset
        littleEndian,
        data
      )
    }
    // Return the offset to the next directory:
    return dataView.getUint32(dirEndOffset, littleEndian)
  }

  loadImage.parseExifData = function (dataView, offset, length, data, options) {
    if (options.disableExif) {
      return
    }
    var tiffOffset = offset + 10
    var littleEndian
    var dirOffset
    var thumbnailData
    // Check for the ASCII code for "Exif" (0x45786966):
    if (dataView.getUint32(offset + 4) !== 0x45786966) {
      // No Exif data, might be XMP data instead
      return
    }
    if (tiffOffset + 8 > dataView.byteLength) {
      console.log('Invalid Exif data: Invalid segment size.')
      return
    }
    // Check for the two null bytes:
    if (dataView.getUint16(offset + 8) !== 0x0000) {
      console.log('Invalid Exif data: Missing byte alignment offset.')
      return
    }
    // Check the byte alignment:
    switch (dataView.getUint16(tiffOffset)) {
      case 0x4949:
        littleEndian = true
        break
      case 0x4D4D:
        littleEndian = false
        break
      default:
        console.log('Invalid Exif data: Invalid byte alignment marker.')
        return
    }
    // Check for the TIFF tag marker (0x002A):
    if (dataView.getUint16(tiffOffset + 2, littleEndian) !== 0x002A) {
      console.log('Invalid Exif data: Missing TIFF marker.')
      return
    }
    // Retrieve the directory offset bytes, usually 0x00000008 or 8 decimal:
    dirOffset = dataView.getUint32(tiffOffset + 4, littleEndian)
    // Create the exif object to store the tags:
    data.exif = new loadImage.ExifMap()
    // Parse the tags of the main image directory and retrieve the
    // offset to the next directory, usually the thumbnail directory:
    dirOffset = loadImage.parseExifTags(
      dataView,
      tiffOffset,
      tiffOffset + dirOffset,
      littleEndian,
      data
    )
    if (dirOffset && !options.disableExifThumbnail) {
      thumbnailData = {exif: {}}
      dirOffset = loadImage.parseExifTags(
        dataView,
        tiffOffset,
        tiffOffset + dirOffset,
        littleEndian,
        thumbnailData
      )
      // Check for JPEG Thumbnail offset:
      if (thumbnailData.exif[0x0201]) {
        data.exif.Thumbnail = loadImage.getExifThumbnail(
          dataView,
          tiffOffset + thumbnailData.exif[0x0201],
          thumbnailData.exif[0x0202] // Thumbnail data length
        )
      }
    }
    // Check for Exif Sub IFD Pointer:
    if (data.exif[0x8769] && !options.disableExifSub) {
      loadImage.parseExifTags(
        dataView,
        tiffOffset,
        tiffOffset + data.exif[0x8769], // directory offset
        littleEndian,
        data
      )
    }
    // Check for GPS Info IFD Pointer:
    if (data.exif[0x8825] && !options.disableExifGps) {
      loadImage.parseExifTags(
        dataView,
        tiffOffset,
        tiffOffset + data.exif[0x8825], // directory offset
        littleEndian,
        data
      )
    }
  }

  // Registers the Exif parser for the APP1 JPEG meta data segment:
  loadImage.metaDataParsers.jpeg[0xffe1].push(loadImage.parseExifData)

  // Adds the following properties to the parseMetaData callback data:
  // * exif: The exif tags, parsed by the parseExifData method

  // Adds the following options to the parseMetaData method:
  // * disableExif: Disables Exif parsing.
  // * disableExifThumbnail: Disables parsing of the Exif Thumbnail.
  // * disableExifSub: Disables parsing of the Exif Sub IFD.
  // * disableExifGps: Disables parsing of the Exif GPS Info IFD.
}))

},{"./load-image":12,"./load-image-meta":10}],10:[function(require,module,exports){
/*
 * JavaScript Load Image Meta
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Image meta data handling implementation
 * based on the help and contribution of
 * Achim Stöhr.
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

  /*global define, module, require, window, DataView, Blob, Uint8Array, console */(function (factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image'], factory);
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'));
  } else {
    // Browser globals:
    factory(window.loadImage);
  }
}(function (loadImage) {
  'use strict';

  var hasblobSlice = window.Blob && (Blob.prototype.slice ||
    Blob.prototype.webkitSlice || Blob.prototype.mozSlice);

  loadImage.blobSlice = hasblobSlice && function () {
      var slice = this.slice || this.webkitSlice || this.mozSlice;
      return slice.apply(this, arguments);
  };

  loadImage.metaDataParsers = {
    jpeg: {
      // 0xffe0: [], // APP0 marker
      0xffe1: [], // APP1 marker
      // 0xffe2: [], // APP2 marker
      // 0xffe3: [], // APP3 marker
      // 0xffec: [], // APP12 marker
      // 0xffed: [], // APP13 marker
      // 0xffee: [], // APP14 marker
    }
  };

  // Parses image meta data and calls the callback with an object argument
  // with the following properties:
  // * imageHead: The complete image head as ArrayBuffer (Uint8Array for IE10)
  // The options arguments accepts an object and supports the following properties:
  // * maxMetaDataSize: Defines the maximum number of bytes to parse.
  // * disableImageHead: Disables creating the imageHead property.
  loadImage.parseMetaData = function (file, callback, options) {
    options = options || {};
    var that = this;
    // 256 KiB should contain all EXIF/ICC/IPTC segments:
    var maxMetaDataSize = options.maxMetaDataSize || 262144;
    maxMetaDataSize = Math.min(file.size, maxMetaDataSize);
    var data = {};
    var noMetaData = !(window.DataView && file && file.size >= 12 &&
      file.type === 'image/jpeg' && loadImage.blobSlice);
    if (noMetaData || !loadImage.readFile(
        loadImage.blobSlice.call(file, 0, maxMetaDataSize),
        function (e) {
          if (e.target.error) {
            // FileReader error
            console.log(e.target.error);
            callback(data);
            return;
          }
          // Note on endianness:
          // Since the marker and length bytes in JPEG files are always
          // stored in big endian order, we can leave the endian parameter
          // of the DataView methods undefined, defaulting to big endian.
          var buffer = e.target.result;
          var dataView = new DataView(buffer);
          var offset = 2;
          var maxOffset = dataView.byteLength - 4;
          var headLength = offset;
          var markerBytes;
          var markerLength;
          var parsers;
          var i;
          // Check for the JPEG marker (0xffd8):
          if (dataView.getUint16(0) === 0xffd8) {
            while (offset < maxOffset) {
              markerBytes = dataView.getUint16(offset);
              // Search for APPn (0xffeN) and COM (0xfffe) markers,
              // which contain application-specific meta-data like
              // Exif, ICC and IPTC data and text comments:
              if ((markerBytes >= 0xffe0 && markerBytes <= 0xffed) ||
                markerBytes === 0xfffe) {
                // The marker bytes (2) are always followed by
                // the length bytes (2), indicating the length of the
                // marker segment, which includes the length bytes,
                // but not the marker bytes, so we add 2:
                markerLength = dataView.getUint16(offset + 2) + 2;

                if (offset + markerLength > dataView.byteLength) {
                  console.log('Invalid meta data: Invalid segment size.');
                  break;
                }

                parsers = loadImage.metaDataParsers.jpeg[markerBytes];

                if (parsers) {
                  for (i = 0; i < parsers.length; i += 1) {
                    parsers[i].call(
                      that,
                      dataView,
                      offset,
                      markerLength,
                      data,
                      options
                    );
                  }
                }

                offset += markerLength;
                headLength = offset;
              } else {
                // Not an APPn or COM marker, probably safe to
                // assume that this is the end of the meta data
                break;
              }
            }
            // Meta length must be longer than JPEG marker (2)
            // plus APPn marker (2), followed by length bytes (2):
            if (!options.disableImageHead && headLength > 6) {
              if (buffer.slice) {
                data.imageHead = buffer.slice(0, headLength);
              } else {
                // Workaround for IE10, which does not yet
                // support ArrayBuffer.slice:
                data.imageHead = new Uint8Array(buffer)
                  .subarray(0, headLength);
              }
            }
          } else {
            console.log('Invalid JPEG file: Missing JPEG marker.');
          }
          callback(data);
        },
        'readAsArrayBuffer'
      )) {
      callback(data);
    }
  };
}));

},{"./load-image":12}],11:[function(require,module,exports){
/*
 * JavaScript Load Image Orientation
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2013, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, require, window */

;(function (factory) {
  'use strict'
  if (typeof define === 'function' && define.amd) {
    // Register as an anonymous AMD module:
    define(['./load-image'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('./load-image'))
  } else {
    // Browser globals:
    factory(window.loadImage)
  }
}(function (loadImage) {
  'use strict'

  var originalHasCanvasOption = loadImage.hasCanvasOption
  var originalTransformCoordinates = loadImage.transformCoordinates
  var originalGetTransformedOptions = loadImage.getTransformedOptions

  // This method is used to determine if the target image
  // should be a canvas element:
  loadImage.hasCanvasOption = function (options) {
    return !!options.orientation ||
      originalHasCanvasOption.call(loadImage, options)
  }

  // Transform image orientation based on
  // the given EXIF orientation option:
  loadImage.transformCoordinates = function (canvas, options) {
    originalTransformCoordinates.call(loadImage, canvas, options)
    var ctx = canvas.getContext('2d')
    var width = canvas.width
    var height = canvas.height
    var styleWidth = canvas.style.width
    var styleHeight = canvas.style.height
    var orientation = options.orientation
    if (!orientation || orientation > 8) {
      return
    }
    if (orientation > 4) {
      canvas.width = height
      canvas.height = width
      canvas.style.width = styleHeight
      canvas.style.height = styleWidth
    }
    switch (orientation) {
      case 2:
        // horizontal flip
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        break
      case 3:
        // 180° rotate left
        ctx.translate(width, height)
        ctx.rotate(Math.PI)
        break
      case 4:
        // vertical flip
        ctx.translate(0, height)
        ctx.scale(1, -1)
        break
      case 5:
        // vertical flip + 90 rotate right
        ctx.rotate(0.5 * Math.PI)
        ctx.scale(1, -1)
        break
      case 6:
        // 90° rotate right
        ctx.rotate(0.5 * Math.PI)
        ctx.translate(0, -height)
        break
      case 7:
        // horizontal flip + 90 rotate right
        ctx.rotate(0.5 * Math.PI)
        ctx.translate(width, -height)
        ctx.scale(-1, 1)
        break
      case 8:
        // 90° rotate left
        ctx.rotate(-0.5 * Math.PI)
        ctx.translate(-width, 0)
        break
    }
  }

  // Transforms coordinate and dimension options
  // based on the given orientation option:
  loadImage.getTransformedOptions = function (img, opts) {
    var options = originalGetTransformedOptions.call(loadImage, img, opts)
    var orientation = options.orientation
    var newOptions
    var i
    if (!orientation || orientation > 8 || orientation === 1) {
      return options
    }
    newOptions = {}
    for (i in options) {
      if (options.hasOwnProperty(i)) {
        newOptions[i] = options[i]
      }
    }
    switch (options.orientation) {
      case 2:
        // horizontal flip
        newOptions.left = options.right
        newOptions.right = options.left
        break
      case 3:
        // 180° rotate left
        newOptions.left = options.right
        newOptions.top = options.bottom
        newOptions.right = options.left
        newOptions.bottom = options.top
        break
      case 4:
        // vertical flip
        newOptions.top = options.bottom
        newOptions.bottom = options.top
        break
      case 5:
        // vertical flip + 90 rotate right
        newOptions.left = options.top
        newOptions.top = options.left
        newOptions.right = options.bottom
        newOptions.bottom = options.right
        break
      case 6:
        // 90° rotate right
        newOptions.left = options.top
        newOptions.top = options.right
        newOptions.right = options.bottom
        newOptions.bottom = options.left
        break
      case 7:
        // horizontal flip + 90 rotate right
        newOptions.left = options.bottom
        newOptions.top = options.right
        newOptions.right = options.top
        newOptions.bottom = options.left
        break
      case 8:
        // 90° rotate left
        newOptions.left = options.bottom
        newOptions.top = options.left
        newOptions.right = options.top
        newOptions.bottom = options.right
        break
    }
    if (options.orientation > 4) {
      newOptions.maxWidth = options.maxHeight
      newOptions.maxHeight = options.maxWidth
      newOptions.minWidth = options.minHeight
      newOptions.minHeight = options.minWidth
      newOptions.sourceWidth = options.sourceHeight
      newOptions.sourceHeight = options.sourceWidth
    }
    return newOptions
  }
}))

},{"./load-image":12}],12:[function(require,module,exports){
/*
 * JavaScript Load Image
 * https://github.com/blueimp/JavaScript-Load-Image
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

/*global define, module, window, document, URL, webkitURL, FileReader */

;(function ($) {
  'use strict'

  // Loads an image for a given File object.
  // Invokes the callback with an img or optional canvas
  // element (if supported by the browser) as parameter:
  var loadImage = function (file, callback, options) {
    var img = document.createElement('img')
    var url
    var oUrl
    img.onerror = callback
    img.onload = function () {
      if (oUrl && !(options && options.noRevoke)) {
        loadImage.revokeObjectURL(oUrl)
      }
      if (callback) {
        callback(loadImage.scale(img, options))
      }
    }
    if (loadImage.isInstanceOf('Blob', file) ||
      // Files are also Blob instances, but some browsers
      // (Firefox 3.6) support the File API but not Blobs:
      loadImage.isInstanceOf('File', file)) {
      url = oUrl = loadImage.createObjectURL(file)
      // Store the file type for resize processing:
      img._type = file.type
    } else if (typeof file === 'string') {
      url = file
      if (options && options.crossOrigin) {
        img.crossOrigin = options.crossOrigin
      }
    } else {
      return false
    }
    if (url) {
      img.src = url
      return img
    }
    return loadImage.readFile(file, function (e) {
      var target = e.target
      if (target && target.result) {
        img.src = target.result
      } else {
        if (callback) {
          callback(e)
        }
      }
    })
  }
  // The check for URL.revokeObjectURL fixes an issue with Opera 12,
  // which provides URL.createObjectURL but doesn't properly implement it:
  var urlAPI = (window.createObjectURL && window) ||
                (window.URL && URL.revokeObjectURL && URL) ||
                (window.webkitURL && webkitURL)

  loadImage.isInstanceOf = function (type, obj) {
    // Cross-frame instanceof check
    return Object.prototype.toString.call(obj) === '[object ' + type + ']'
  }

  // Transform image coordinates, allows to override e.g.
  // the canvas orientation based on the orientation option,
  // gets canvas, options passed as arguments:
  loadImage.transformCoordinates = function () {
    return
  }

  // Returns transformed options, allows to override e.g.
  // maxWidth, maxHeight and crop options based on the aspectRatio.
  // gets img, options passed as arguments:
  loadImage.getTransformedOptions = function (img, options) {
    var aspectRatio = options.aspectRatio
    var newOptions
    var i
    var width
    var height
    if (!aspectRatio) {
      return options
    }
    newOptions = {}
    for (i in options) {
      if (options.hasOwnProperty(i)) {
        newOptions[i] = options[i]
      }
    }
    newOptions.crop = true
    width = img.naturalWidth || img.width
    height = img.naturalHeight || img.height
    if (width / height > aspectRatio) {
      newOptions.maxWidth = height * aspectRatio
      newOptions.maxHeight = height
    } else {
      newOptions.maxWidth = width
      newOptions.maxHeight = width / aspectRatio
    }
    return newOptions
  }

  // Canvas render method, allows to implement a different rendering algorithm:
  loadImage.renderImageToCanvas = function (
    canvas,
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destX,
    destY,
    destWidth,
    destHeight
  ) {
    canvas.getContext('2d').drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destWidth,
      destHeight
    )
    return canvas
  }

  // This method is used to determine if the target image
  // should be a canvas element:
  loadImage.hasCanvasOption = function (options) {
    return options.canvas || options.crop || !!options.aspectRatio
  }

  // Scales and/or crops the given image (img or canvas HTML element)
  // using the given options.
  // Returns a canvas object if the browser supports canvas
  // and the hasCanvasOption method returns true or a canvas
  // object is passed as image, else the scaled image:
  loadImage.scale = function (img, options) {
    options = options || {}
    var canvas = document.createElement('canvas')
    var useCanvas = img.getContext ||
                    (loadImage.hasCanvasOption(options) && canvas.getContext)
    var width = img.naturalWidth || img.width
    var height = img.naturalHeight || img.height
    var destWidth = width
    var destHeight = height
    var maxWidth
    var maxHeight
    var minWidth
    var minHeight
    var sourceWidth
    var sourceHeight
    var sourceX
    var sourceY
    var pixelRatio
    var downsamplingRatio
    var tmp
    function scaleUp () {
      var scale = Math.max(
        (minWidth || destWidth) / destWidth,
        (minHeight || destHeight) / destHeight
      )
      if (scale > 1) {
        destWidth *= scale
        destHeight *= scale
      }
    }
    function scaleDown () {
      var scale = Math.min(
        (maxWidth || destWidth) / destWidth,
        (maxHeight || destHeight) / destHeight
      )
      if (scale < 1) {
        destWidth *= scale
        destHeight *= scale
      }
    }
    if (useCanvas) {
      options = loadImage.getTransformedOptions(img, options)
      sourceX = options.left || 0
      sourceY = options.top || 0
      if (options.sourceWidth) {
        sourceWidth = options.sourceWidth
        if (options.right !== undefined && options.left === undefined) {
          sourceX = width - sourceWidth - options.right
        }
      } else {
        sourceWidth = width - sourceX - (options.right || 0)
      }
      if (options.sourceHeight) {
        sourceHeight = options.sourceHeight
        if (options.bottom !== undefined && options.top === undefined) {
          sourceY = height - sourceHeight - options.bottom
        }
      } else {
        sourceHeight = height - sourceY - (options.bottom || 0)
      }
      destWidth = sourceWidth
      destHeight = sourceHeight
    }
    maxWidth = options.maxWidth
    maxHeight = options.maxHeight
    minWidth = options.minWidth
    minHeight = options.minHeight
    if (useCanvas && maxWidth && maxHeight && options.crop) {
      destWidth = maxWidth
      destHeight = maxHeight
      tmp = sourceWidth / sourceHeight - maxWidth / maxHeight
      if (tmp < 0) {
        sourceHeight = maxHeight * sourceWidth / maxWidth
        if (options.top === undefined && options.bottom === undefined) {
          sourceY = (height - sourceHeight) / 2
        }
      } else if (tmp > 0) {
        sourceWidth = maxWidth * sourceHeight / maxHeight
        if (options.left === undefined && options.right === undefined) {
          sourceX = (width - sourceWidth) / 2
        }
      }
    } else {
      if (options.contain || options.cover) {
        minWidth = maxWidth = maxWidth || minWidth
        minHeight = maxHeight = maxHeight || minHeight
      }
      if (options.cover) {
        scaleDown()
        scaleUp()
      } else {
        scaleUp()
        scaleDown()
      }
    }
    if (useCanvas) {
      pixelRatio = options.pixelRatio
      if (pixelRatio > 1) {
        canvas.style.width = destWidth + 'px'
        canvas.style.height = destHeight + 'px'
        destWidth *= pixelRatio
        destHeight *= pixelRatio
        canvas.getContext('2d').scale(pixelRatio, pixelRatio)
      }
      downsamplingRatio = options.downsamplingRatio
      if (downsamplingRatio > 0 && downsamplingRatio < 1 &&
            destWidth < sourceWidth && destHeight < sourceHeight) {
        while (sourceWidth * downsamplingRatio > destWidth) {
          canvas.width = sourceWidth * downsamplingRatio
          canvas.height = sourceHeight * downsamplingRatio
          loadImage.renderImageToCanvas(
            canvas,
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
          )
          sourceWidth = canvas.width
          sourceHeight = canvas.height
          img = document.createElement('canvas')
          img.width = sourceWidth
          img.height = sourceHeight
          loadImage.renderImageToCanvas(
            img,
            canvas,
            0,
            0,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
          )
        }
      }
      canvas.width = destWidth
      canvas.height = destHeight
      loadImage.transformCoordinates(
        canvas,
        options
      )
      return loadImage.renderImageToCanvas(
        canvas,
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        destWidth,
        destHeight
      )
    }
    img.width = destWidth
    img.height = destHeight
    return img
  }

  loadImage.createObjectURL = function (file) {
    return urlAPI ? urlAPI.createObjectURL(file) : false
  }

  loadImage.revokeObjectURL = function (url) {
    return urlAPI ? urlAPI.revokeObjectURL(url) : false
  }

  // Loads a given File object via FileReader interface,
  // invokes the callback with the event object (load or error).
  // The result can be read via event.target.result:
  loadImage.readFile = function (file, callback, method) {
    if (window.FileReader) {
      var fileReader = new FileReader()
      fileReader.onload = fileReader.onerror = callback
      method = method || 'readAsDataURL'
      if (fileReader[method]) {
        fileReader[method](file)
        return fileReader
      }
    }
    return false
  }

  if (typeof define === 'function' && define.amd) {
    define(function () {
      return loadImage
    })
  } else if (typeof module === 'object' && module.exports) {
    module.exports = loadImage
  } else {
    $.loadImage = loadImage
  }
}(window))

},{}],13:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.1.20160328
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /Version\/[\d\.]+.*Safari/.test(navigator.userAgent)
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			/* // Take note W3C:
			var
			  uri = typeof file === "string" ? file : file.toURL()
			, revoker = function(evt) {
				// idealy DownloadFinishedEvent.data would be the URL requested
				if (evt.data === uri) {
					if (typeof file === "string") { // file is an object URL
						get_URL().revokeObjectURL(file);
					} else { // file is a File
						file.remove();
					}
				}
			}
			;
			view.addEventListener("downloadfinished", revoker);
			*/
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob(["\ufeff", blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if (target_view && is_safari && typeof FileReader !== "undefined") {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var base64Data = reader.result;
							target_view.location.href = "data:attachment/file" + base64Data.slice(base64Data.search(/[,;]/));
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab === undefined && is_safari) {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name, no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name || "download");
		};
	}

	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define([], function() {
    return saveAs;
  });
}

},{}],14:[function(require,module,exports){
'use strict';

// http://www.color.org/profileheader.xalter

var versionMap = {
  0x02000000: '2.0',
  0x02100000: '2.1',
  0x02400000: '2.4',
  0x04000000: '4.0',
  0x04200000: '4.2'
};

var intentMap = {
  0: 'Perceptual',
  1: 'Relative',
  2: 'Saturation',
  3: 'Absolute'
};

var valueMap = {
  // Device
  'scnr': 'Scanner',
  'mntr': 'Monitor',
  'prtr': 'Printer',
  'link': 'Link',
  'abst': 'Abstract',
  'spac': 'Space',
  'nmcl': 'Named color',
  // Platform
  'appl': 'Apple',
  'adbe': 'Adobe',
  'msft': 'Microsoft',
  'sunw': 'Sun Microsystems',
  'sgi' : 'Silicon Graphics',
  'tgnt': 'Taligent'
};

var tagMap = {
  'desc': 'description',
  'cprt': 'copyright',
  'dmdd': 'deviceModelDescription',
  'vued': 'viewingConditionsDescription'
};

var getContentAtOffsetAsString = function(buffer, offset) {
  var value = buffer.slice(offset, offset + 4).toString().trim();
  return (value.toLowerCase() in valueMap) ? valueMap[value.toLowerCase()] : value;
};

var hasContentAtOffset = function(buffer, offset) {
  return (buffer.readUInt32BE(offset) !== 0);
};

module.exports.parse = function(buffer) {
  // Verify expected length
  var size = buffer.readUInt32BE(0);
  if (size !== buffer.length) {
    throw new Error('Invalid ICC profile: length mismatch');
  }
  // Verify 'acsp' signature
  var signature = buffer.slice(36, 40).toString();
  if (signature !== 'acsp') {
    throw new Error('Invalid ICC profile: missing signature');
  }
  // Integer attributes
  var profile = {
    version: versionMap[buffer.readUInt32BE(8)],
    intent: intentMap[buffer.readUInt32BE(64)]
  };
  // Four-byte string attributes
  [
    [ 4, 'cmm'],
    [12, 'deviceClass'],
    [16, 'colorSpace'],
    [20, 'connectionSpace'],
    [40, 'platform'],
    [48, 'manufacturer'],
    [52, 'model'],
    [80, 'creator']
  ].forEach(function(attr) {
    if (hasContentAtOffset(buffer, attr[0])) {
      profile[attr[1]] = getContentAtOffsetAsString(buffer, attr[0]);
    }
  });
  // Tags
  var tagCount = buffer.readUInt32BE(128);
  var tagHeaderOffset = 132;
  for (var i = 0; i < tagCount; i++) {
    var tagSignature = getContentAtOffsetAsString(buffer, tagHeaderOffset);
    if (tagSignature in tagMap) {
      var tagOffset = buffer.readUInt32BE(tagHeaderOffset + 4);
      var tagSize = buffer.readUInt32BE(tagHeaderOffset + 8);
      if (tagOffset > buffer.length) {
        throw new Error('Invalid ICC profile: Tag offset out of bounds');
      }
      var tagType = getContentAtOffsetAsString(buffer, tagOffset);
      // desc
      if (tagType === 'desc') {
        var tagValueSize = buffer.readUInt32BE(tagOffset + 8);
        if (tagValueSize > tagSize) {
          throw new Error('Invalid ICC profile: Description tag value size out of bounds for ' + tagSignature);
        }
        profile[tagMap[tagSignature]] = buffer.slice(tagOffset + 12, tagOffset + tagValueSize + 11).toString();
      }
      // text
      if (tagType === 'text') {
        profile[tagMap[tagSignature]] = buffer.slice(tagOffset + 8, tagOffset + tagSize - 7).toString();
      }
    }
    tagHeaderOffset = tagHeaderOffset + 12;
  }
  return profile;
};

},{}],15:[function(require,module,exports){
var icc = require('icc');
var Buffer = require('buffer').Buffer;
var arrayBufferConcat = require('array-buffer-concat');
var loadImage = require('blueimp-load-image');
var saveAs = require('browser-filesaver').saveAs;
require('blueimp-canvas-to-blob');

loadImage.metaDataParsers.jpeg[0xffe2] = [];

loadImage.metaDataParsers.jpeg[0xffe2].push(function (dataView, offset, length, data, options) {
  var iccChunk = dataView.buffer.slice(offset + 18, offset + length);

  if (iccChunk.byteLength > 0) {
    if (data.iccProfile) {
      data.iccProfile = arrayBufferConcat(data.iccProfile, iccChunk);
    } else {
      data.iccProfile = iccChunk;
    }
  }
});

function fileHandler(event) {
  event.preventDefault();

  event = event.originalEvent || event;

  var target = event.dataTransfer || event.target;

  var fileOrBlob = target && target.files && target.files[0];

  if (!fileOrBlob) {
    return;
  }

  loadImage.parseMetaData(fileOrBlob, function (data) {
    if (!data.imageHead) {
      console.error('No image header', fileOrBlob);
      return;
    }

    console.log(data);

    var exif = data.exif.getAll();

    // console.log(exif);

    if (data.iccProfile) {
      var buffer = new Buffer(data.iccProfile.byteLength);
      var view = new Uint8Array(data.iccProfile);
      for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
      }

      var profile = icc.parse(buffer);
      console.dir(profile);

      var iccBlob = new Blob([data.iccProfile], { type: 'application/vnd.iccprofile' });

      saveAs(iccBlob, 'profile.icc');
    }

    loadImage(fileOrBlob, function (resizedImageCanvas) {
      resizedImageCanvas.toBlob(function (resizedBlob) {
        // // Do something with the blob object,
        // // e.g. creating a multipart form for file uploads:
        // var formData = new FormData();
        // formData.append('file', blob, fileName);
        // /* ... */

        // Combine data.imageHead with the image body of a resized file
        // to create scaled images with the original image meta data, e.g.:
        var blob = new Blob([data.imageHead,
        // Resized images always have a head size of 20 bytes,
        // including the JPEG marker and a minimal JFIF header:
        loadImage.blobSlice.call(resizedBlob, 20)], {
          type: resizedBlob.type
        });

        saveAs(blob, 'image.jpg');
      }, 'image/jpeg');
    }, {
      maxWidth: 500,
      maxHeight: 500,
      canvas: true
    });
  }, {
    maxMetaDataSize: 1024000,
    disableImageHead: false
  });
}

document.getElementById('file-input').addEventListener('change', fileHandler);

},{"array-buffer-concat":5,"blueimp-canvas-to-blob":6,"blueimp-load-image":7,"browser-filesaver":13,"buffer":2,"icc":14}]},{},[15])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5ub2RlL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi4uLy4uLy4uLy5ub2RlL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiLi4vLi4vLi4vLm5vZGUvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiLi4vLi4vLi4vLm5vZGUvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwiLi4vLi4vLi4vLm5vZGUvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hcnJheS1idWZmZXItY29uY2F0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2JsdWVpbXAtY2FudmFzLXRvLWJsb2IvanMvY2FudmFzLXRvLWJsb2IuanMiLCJub2RlX21vZHVsZXMvYmx1ZWltcC1sb2FkLWltYWdlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2JsdWVpbXAtbG9hZC1pbWFnZS9qcy9sb2FkLWltYWdlLWV4aWYtbWFwLmpzIiwibm9kZV9tb2R1bGVzL2JsdWVpbXAtbG9hZC1pbWFnZS9qcy9sb2FkLWltYWdlLWV4aWYuanMiLCJub2RlX21vZHVsZXMvYmx1ZWltcC1sb2FkLWltYWdlL2pzL2xvYWQtaW1hZ2UtbWV0YS5qcyIsIm5vZGVfbW9kdWxlcy9ibHVlaW1wLWxvYWQtaW1hZ2UvanMvbG9hZC1pbWFnZS1vcmllbnRhdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9ibHVlaW1wLWxvYWQtaW1hZ2UvanMvbG9hZC1pbWFnZS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyLWZpbGVzYXZlci9GaWxlU2F2ZXIuanMiLCJub2RlX21vZHVsZXMvaWNjL2luZGV4LmpzIiwic3JjL3NjcmlwdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN0N0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEEsSUFBSSxNQUFNLFFBQVEsS0FBUixDQUFWO0FBQ0EsSUFBSSxTQUFTLFFBQVEsUUFBUixFQUFrQixNQUEvQjtBQUNBLElBQUksb0JBQW9CLFFBQVEscUJBQVIsQ0FBeEI7QUFDQSxJQUFJLFlBQVksUUFBUSxvQkFBUixDQUFoQjtBQUNBLElBQUksU0FBUyxRQUFRLG1CQUFSLEVBQTZCLE1BQTFDO0FBQ0EsUUFBUSx3QkFBUjs7QUFFQSxVQUFVLGVBQVYsQ0FBMEIsSUFBMUIsQ0FBK0IsTUFBL0IsSUFBeUMsRUFBekM7O0FBRUEsVUFBVSxlQUFWLENBQTBCLElBQTFCLENBQStCLE1BQS9CLEVBQXVDLElBQXZDLENBQTRDLFVBQVUsUUFBVixFQUFvQixNQUFwQixFQUE0QixNQUE1QixFQUFvQyxJQUFwQyxFQUEwQyxPQUExQyxFQUFtRDtBQUM3RixNQUFJLFdBQVcsU0FBUyxNQUFULENBQWdCLEtBQWhCLENBQXNCLFNBQVMsRUFBL0IsRUFBbUMsU0FBUyxNQUE1QyxDQUFmOztBQUVBLE1BQUksU0FBUyxVQUFULEdBQXNCLENBQTFCLEVBQTZCO0FBQzNCLFFBQUksS0FBSyxVQUFULEVBQXFCO0FBQ25CLFdBQUssVUFBTCxHQUFrQixrQkFBa0IsS0FBSyxVQUF2QixFQUFtQyxRQUFuQyxDQUFsQjtBQUNELEtBRkQsTUFFTztBQUNMLFdBQUssVUFBTCxHQUFrQixRQUFsQjtBQUNEO0FBQ0Y7QUFDRixDQVZEOztBQVlBLFNBQVMsV0FBVCxDQUFzQixLQUF0QixFQUE2QjtBQUMzQixRQUFNLGNBQU47O0FBRUEsVUFBUSxNQUFNLGFBQU4sSUFBdUIsS0FBL0I7O0FBRUEsTUFBSSxTQUFTLE1BQU0sWUFBTixJQUFzQixNQUFNLE1BQXpDOztBQUVBLE1BQUksYUFBYSxVQUFVLE9BQU8sS0FBakIsSUFBMEIsT0FBTyxLQUFQLENBQWEsQ0FBYixDQUEzQzs7QUFFQSxNQUFJLENBQUMsVUFBTCxFQUFpQjtBQUNmO0FBQ0Q7O0FBRUQsWUFBVSxhQUFWLENBQXdCLFVBQXhCLEVBQW9DLFVBQVUsSUFBVixFQUFnQjtBQUNsRCxRQUFJLENBQUMsS0FBSyxTQUFWLEVBQXFCO0FBQ25CLGNBQVEsS0FBUixDQUFjLGlCQUFkLEVBQWlDLFVBQWpDO0FBQ0E7QUFDRDs7QUFFRCxZQUFRLEdBQVIsQ0FBWSxJQUFaOztBQUVBLFFBQUksT0FBTyxLQUFLLElBQUwsQ0FBVSxNQUFWLEVBQVg7Ozs7QUFJQSxRQUFJLEtBQUssVUFBVCxFQUFxQjtBQUNuQixVQUFJLFNBQVMsSUFBSSxNQUFKLENBQVcsS0FBSyxVQUFMLENBQWdCLFVBQTNCLENBQWI7QUFDQSxVQUFJLE9BQU8sSUFBSSxVQUFKLENBQWUsS0FBSyxVQUFwQixDQUFYO0FBQ0EsV0FBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLE9BQU8sTUFBM0IsRUFBbUMsRUFBRSxDQUFyQyxFQUF3QztBQUN0QyxlQUFPLENBQVAsSUFBWSxLQUFLLENBQUwsQ0FBWjtBQUNEOztBQUVELFVBQUksVUFBVSxJQUFJLEtBQUosQ0FBVSxNQUFWLENBQWQ7QUFDQSxjQUFRLEdBQVIsQ0FBWSxPQUFaOztBQUVBLFVBQUksVUFBVSxJQUFJLElBQUosQ0FBUyxDQUFDLEtBQUssVUFBTixDQUFULEVBQTRCLEVBQUMsTUFBTSw0QkFBUCxFQUE1QixDQUFkOztBQUVBLGFBQU8sT0FBUCxFQUFnQixhQUFoQjtBQUNEOztBQUVELGNBQVUsVUFBVixFQUFzQixVQUFVLGtCQUFWLEVBQThCO0FBQ2xELHlCQUFtQixNQUFuQixDQUEwQixVQUFVLFdBQVYsRUFBdUI7Ozs7Ozs7OztBQVMvQyxZQUFJLE9BQU8sSUFBSSxJQUFKLENBQVMsQ0FDbEIsS0FBSyxTQURhOzs7QUFJbEIsa0JBQVUsU0FBVixDQUFvQixJQUFwQixDQUF5QixXQUF6QixFQUFzQyxFQUF0QyxDQUprQixDQUFULEVBS1I7QUFDRCxnQkFBTSxZQUFZO0FBRGpCLFNBTFEsQ0FBWDs7QUFTQSxlQUFPLElBQVAsRUFBYSxXQUFiO0FBRUQsT0FwQkQsRUFxQkUsWUFyQkY7QUF3QkQsS0F6QkQsRUF5Qkc7QUFDRCxnQkFBVSxHQURUO0FBRUQsaUJBQVcsR0FGVjtBQUdELGNBQVE7QUFIUCxLQXpCSDtBQStCRCxHQTFERCxFQTBERztBQUNELHFCQUFpQixPQURoQjtBQUVELHNCQUFrQjtBQUZqQixHQTFESDtBQStERDs7QUFFRCxTQUFTLGNBQVQsQ0FBd0IsWUFBeEIsRUFBc0MsZ0JBQXRDLENBQXVELFFBQXZELEVBQWlFLFdBQWpFIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgdmFyIGlcbiAgdmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbiAgdmFyIGxvb2t1cCA9IFtdXG4gIGZvciAoaSA9IDA7IGkgPCBjb2RlLmxlbmd0aDsgaSsrKSB7XG4gICAgbG9va3VwW2ldID0gY29kZVtpXVxuICB9XG4gIHZhciByZXZMb29rdXAgPSBbXVxuXG4gIGZvciAoaSA9IDA7IGkgPCBjb2RlLmxlbmd0aDsgKytpKSB7XG4gICAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG4gIH1cbiAgcmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG4gIHJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuICBmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuICAgIHZhciB2ID0gcmV2TG9va3VwW2VsdC5jaGFyQ29kZUF0KDApXVxuICAgIHJldHVybiB2ICE9PSB1bmRlZmluZWQgPyB2IDogLTFcbiAgfVxuXG4gIGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcbiAgICB2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG4gICAgaWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgICB9XG5cbiAgICAvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuICAgIC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcbiAgICAvLyByZXByZXNlbnQgb25lIGJ5dGVcbiAgICAvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcbiAgICAvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG4gICAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcbiAgICBwbGFjZUhvbGRlcnMgPSBiNjQuY2hhckF0KGxlbiAtIDIpID09PSAnPScgPyAyIDogYjY0LmNoYXJBdChsZW4gLSAxKSA9PT0gJz0nID8gMSA6IDBcblxuICAgIC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuICAgIGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG4gICAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICAgIGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cbiAgICB2YXIgTCA9IDBcblxuICAgIGZ1bmN0aW9uIHB1c2ggKHYpIHtcbiAgICAgIGFycltMKytdID0gdlxuICAgIH1cblxuICAgIGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcbiAgICAgIHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG4gICAgICBwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG4gICAgICBwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG4gICAgICBwdXNoKHRtcCAmIDB4RkYpXG4gICAgfVxuXG4gICAgaWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG4gICAgICBwdXNoKHRtcCAmIDB4RkYpXG4gICAgfSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcbiAgICAgIHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuICAgICAgcHVzaCgodG1wID4+IDgpICYgMHhGRilcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9XG5cbiAgICByZXR1cm4gYXJyXG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuICAgIHJldHVybiBsb29rdXBbbnVtXVxuICB9XG5cbiAgZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgICByZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICAgIHZhciB0ZW1wXG4gICAgdmFyIG91dHB1dCA9IFtdXG4gICAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICAgIHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodGVtcCkpXG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQuam9pbignJylcbiAgfVxuXG4gIGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG4gICAgdmFyIGlcbiAgICB2YXIgZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgICB2YXIgb3V0cHV0ID0gJydcbiAgICB2YXIgcGFydHMgPSBbXVxuICAgIHZhciB0ZW1wLCBsZW5ndGhcbiAgICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAgIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblxuICAgIGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsodWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuZ3RoID8gbGVuZ3RoIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICAgIH1cblxuICAgIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgICBzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgdGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9ICc9PSdcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgdGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG4gICAgICAgIG91dHB1dCArPSAnPSdcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgICByZXR1cm4gcGFydHMuam9pbignJylcbiAgfVxuXG4gIGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuICBleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpc2FycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciByb290UGFyZW50ID0ge31cblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVCAhPT0gdW5kZWZpbmVkXG4gID8gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgOiB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgLy8gQXZvaWQgZ29pbmcgdGhyb3VnaCBhbiBBcmd1bWVudHNBZGFwdG9yVHJhbXBvbGluZSBpbiB0aGUgY29tbW9uIGNhc2UuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGFyZ3VtZW50c1sxXSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcpXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpcy5sZW5ndGggPSAwXG4gICAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gZnJvbU51bWJlcih0aGlzLCBhcmcpXG4gIH1cblxuICAvLyBTbGlnaHRseSBsZXNzIGNvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGlzLCBhcmcsIGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDogJ3V0ZjgnKVxuICB9XG5cbiAgLy8gVW51c3VhbC5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhpcywgYXJnKVxufVxuXG4vLyBUT0RPOiBMZWdhY3ksIG5vdCBuZWVkZWQgYW55bW9yZS4gUmVtb3ZlIGluIG5leHQgbWFqb3IgdmVyc2lvbi5cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiBmcm9tTnVtYmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChsZW5ndGgpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIC8vIEFzc3VtcHRpb246IGJ5dGVMZW5ndGgoKSByZXR1cm4gdmFsdWUgaXMgYWx3YXlzIDwga01heExlbmd0aC5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmplY3QpKSByZXR1cm4gZnJvbUJ1ZmZlcih0aGF0LCBvYmplY3QpXG5cbiAgaWYgKGlzQXJyYXkob2JqZWN0KSkgcmV0dXJuIGZyb21BcnJheSh0aGF0LCBvYmplY3QpXG5cbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAob2JqZWN0LmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbVR5cGVkQXJyYXkodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgICBpZiAob2JqZWN0IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgb2JqZWN0KVxuICAgIH1cbiAgfVxuXG4gIGlmIChvYmplY3QubGVuZ3RoKSByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmplY3QpXG5cbiAgcmV0dXJuIGZyb21Kc29uT2JqZWN0KHRoYXQsIG9iamVjdClcbn1cblxuZnVuY3Rpb24gZnJvbUJ1ZmZlciAodGhhdCwgYnVmZmVyKSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGJ1ZmZlci5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBidWZmZXIuY29weSh0aGF0LCAwLCAwLCBsZW5ndGgpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIER1cGxpY2F0ZSBvZiBmcm9tQXJyYXkoKSB0byBrZWVwIGZyb21BcnJheSgpIG1vbm9tb3JwaGljLlxuZnVuY3Rpb24gZnJvbVR5cGVkQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIC8vIFRydW5jYXRpbmcgdGhlIGVsZW1lbnRzIGlzIHByb2JhYmx5IG5vdCB3aGF0IHBlb3BsZSBleHBlY3QgZnJvbSB0eXBlZFxuICAvLyBhcnJheXMgd2l0aCBCWVRFU19QRVJfRUxFTUVOVCA+IDEgYnV0IGl0J3MgY29tcGF0aWJsZSB3aXRoIHRoZSBiZWhhdmlvclxuICAvLyBvZiB0aGUgb2xkIEJ1ZmZlciBjb25zdHJ1Y3Rvci5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAodGhhdCwgYXJyYXkpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbVR5cGVkQXJyYXkodGhhdCwgbmV3IFVpbnQ4QXJyYXkoYXJyYXkpKVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEZXNlcmlhbGl6ZSB7IHR5cGU6ICdCdWZmZXInLCBkYXRhOiBbMSwyLDMsLi4uXSB9IGludG8gYSBCdWZmZXIgb2JqZWN0LlxuLy8gUmV0dXJucyBhIHplcm8tbGVuZ3RoIGJ1ZmZlciBmb3IgaW5wdXRzIHRoYXQgZG9uJ3QgY29uZm9ybSB0byB0aGUgc3BlYy5cbmZ1bmN0aW9uIGZyb21Kc29uT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgdmFyIGFycmF5XG4gIHZhciBsZW5ndGggPSAwXG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iamVjdC5kYXRhKSkge1xuICAgIGFycmF5ID0gb2JqZWN0LmRhdGFcbiAgICBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIH1cbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgICAvLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgICB2YWx1ZTogbnVsbCxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pXG4gIH1cbn0gZWxzZSB7XG4gIC8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG4gIEJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG4gIEJ1ZmZlci5wcm90b3R5cGUucGFyZW50ID0gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIGFsbG9jYXRlICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHZhciBmcm9tUG9vbCA9IGxlbmd0aCAhPT0gMCAmJiBsZW5ndGggPD0gQnVmZmVyLnBvb2xTaXplID4+PiAxXG4gIGlmIChmcm9tUG9vbCkgdGhhdC5wYXJlbnQgPSByb290UGFyZW50XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU2xvd0J1ZmZlcikpIHJldHVybiBuZXcgU2xvd0J1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcbiAgZGVsZXRlIGJ1Zi5wYXJlbnRcbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgdmFyIGkgPSAwXG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSBicmVha1xuXG4gICAgKytpXG4gIH1cblxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0IGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycy4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykgc3RyaW5nID0gJycgKyBzdHJpbmdcblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIC8vIERlcHJlY2F0ZWRcbiAgICAgIGNhc2UgJ3Jhdyc6XG4gICAgICBjYXNlICdyYXdzJzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICBzdGFydCA9IHN0YXJ0IHwgMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPT09IEluZmluaXR5ID8gdGhpcy5sZW5ndGggOiBlbmQgfCAwXG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcbiAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKGVuZCA8PSBzdGFydCkgcmV0dXJuICcnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoZSBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIGFuZCBgaXMtYnVmZmVyYCAoaW4gU2FmYXJpIDUtNykgdG8gZGV0ZWN0XG4vLyBCdWZmZXIgaW5zdGFuY2VzLlxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCB8IDBcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiAwXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICBieXRlT2Zmc2V0ID4+PSAwXG5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVybiAtMVxuXG4gIC8vIE5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gTWF0aC5tYXgodGhpcy5sZW5ndGggKyBieXRlT2Zmc2V0LCAwKVxuXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSByZXR1cm4gLTEgLy8gc3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcgYWx3YXlzIGZhaWxzXG4gICAgcmV0dXJuIFN0cmluZy5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgfVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgWyB2YWwgXSwgYnl0ZU9mZnNldClcbiAgfVxuXG4gIGZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yICh2YXIgaSA9IDA7IGJ5dGVPZmZzZXQgKyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYXJyW2J5dGVPZmZzZXQgKyBpXSA9PT0gdmFsW2ZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4XSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbC5sZW5ndGgpIHJldHVybiBieXRlT2Zmc2V0ICsgZm91bmRJbmRleFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoIHwgMFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdhdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBhcnJheUJ1ZmZlckNvbmNhdFxuXG5mdW5jdGlvbiBhcnJheUJ1ZmZlckNvbmNhdCAoKSB7XG4gIHZhciBsZW5ndGggPSAwXG4gIHZhciBidWZmZXIgPSBudWxsXG5cbiAgZm9yICh2YXIgaSBpbiBhcmd1bWVudHMpIHtcbiAgICBidWZmZXIgPSBhcmd1bWVudHNbaV1cbiAgICBsZW5ndGggKz0gYnVmZmVyLmJ5dGVMZW5ndGhcbiAgfVxuXG4gIHZhciBqb2luZWQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gIHZhciBvZmZzZXQgPSAwXG5cbiAgZm9yICh2YXIgaSBpbiBhcmd1bWVudHMpIHtcbiAgICBidWZmZXIgPSBhcmd1bWVudHNbaV1cbiAgICBqb2luZWQuc2V0KG5ldyBVaW50OEFycmF5KGJ1ZmZlciksIG9mZnNldClcbiAgICBvZmZzZXQgKz0gYnVmZmVyLmJ5dGVMZW5ndGhcbiAgfVxuXG4gIHJldHVybiBqb2luZWQuYnVmZmVyXG59XG4iLCIvKlxuICogSmF2YVNjcmlwdCBDYW52YXMgdG8gQmxvYlxuICogaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1DYW52YXMtdG8tQmxvYlxuICpcbiAqIENvcHlyaWdodCAyMDEyLCBTZWJhc3RpYW4gVHNjaGFuXG4gKiBodHRwczovL2JsdWVpbXAubmV0XG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqXG4gKiBCYXNlZCBvbiBzdGFja292ZXJmbG93IHVzZXIgU3RvaXZlJ3MgY29kZSBzbmlwcGV0OlxuICogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3EvNDk5ODkwOFxuICovXG5cbi8qZ2xvYmFsIHdpbmRvdywgYXRvYiwgQmxvYiwgQXJyYXlCdWZmZXIsIFVpbnQ4QXJyYXksIGRlZmluZSwgbW9kdWxlICovXG5cbjsoZnVuY3Rpb24gKHdpbmRvdykge1xuICAndXNlIHN0cmljdCdcblxuICB2YXIgQ2FudmFzUHJvdG90eXBlID0gd2luZG93LkhUTUxDYW52YXNFbGVtZW50ICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5IVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGVcbiAgdmFyIGhhc0Jsb2JDb25zdHJ1Y3RvciA9IHdpbmRvdy5CbG9iICYmIChmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBCb29sZWFuKG5ldyBCbG9iKCkpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9KCkpXG4gIHZhciBoYXNBcnJheUJ1ZmZlclZpZXdTdXBwb3J0ID0gaGFzQmxvYkNvbnN0cnVjdG9yICYmIHdpbmRvdy5VaW50OEFycmF5ICYmXG4gICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBuZXcgQmxvYihbbmV3IFVpbnQ4QXJyYXkoMTAwKV0pLnNpemUgPT09IDEwMFxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9KCkpXG4gIHZhciBCbG9iQnVpbGRlciA9IHdpbmRvdy5CbG9iQnVpbGRlciB8fCB3aW5kb3cuV2ViS2l0QmxvYkJ1aWxkZXIgfHxcbiAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuTW96QmxvYkJ1aWxkZXIgfHwgd2luZG93Lk1TQmxvYkJ1aWxkZXJcbiAgdmFyIGRhdGFVUklQYXR0ZXJuID0gL15kYXRhOigoLio/KSg7Y2hhcnNldD0uKj8pPykoO2Jhc2U2NCk/LC9cbiAgdmFyIGRhdGFVUkx0b0Jsb2IgPSAoaGFzQmxvYkNvbnN0cnVjdG9yIHx8IEJsb2JCdWlsZGVyKSAmJiB3aW5kb3cuYXRvYiAmJlxuICAgIHdpbmRvdy5BcnJheUJ1ZmZlciAmJiB3aW5kb3cuVWludDhBcnJheSAmJlxuICAgIGZ1bmN0aW9uIChkYXRhVVJJKSB7XG4gICAgICB2YXIgbWF0Y2hlcyxcbiAgICAgICAgbWVkaWFUeXBlLFxuICAgICAgICBpc0Jhc2U2NCxcbiAgICAgICAgZGF0YVN0cmluZyxcbiAgICAgICAgYnl0ZVN0cmluZyxcbiAgICAgICAgYXJyYXlCdWZmZXIsXG4gICAgICAgIGludEFycmF5LFxuICAgICAgICBpLFxuICAgICAgICBiYlxuICAgICAgLy8gUGFyc2UgdGhlIGRhdGFVUkkgY29tcG9uZW50cyBhcyBwZXIgUkZDIDIzOTdcbiAgICAgIG1hdGNoZXMgPSBkYXRhVVJJLm1hdGNoKGRhdGFVUklQYXR0ZXJuKVxuICAgICAgaWYgKCFtYXRjaGVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBkYXRhIFVSSScpXG4gICAgICB9XG4gICAgICAvLyBEZWZhdWx0IHRvIHRleHQvcGxhaW47Y2hhcnNldD1VUy1BU0NJSVxuICAgICAgbWVkaWFUeXBlID0gbWF0Y2hlc1syXVxuICAgICAgICA/IG1hdGNoZXNbMV1cbiAgICAgICAgOiAndGV4dC9wbGFpbicgKyAobWF0Y2hlc1szXSB8fCAnO2NoYXJzZXQ9VVMtQVNDSUknKVxuICAgICAgaXNCYXNlNjQgPSAhIW1hdGNoZXNbNF1cbiAgICAgIGRhdGFTdHJpbmcgPSBkYXRhVVJJLnNsaWNlKG1hdGNoZXNbMF0ubGVuZ3RoKVxuICAgICAgaWYgKGlzQmFzZTY0KSB7XG4gICAgICAgIC8vIENvbnZlcnQgYmFzZTY0IHRvIHJhdyBiaW5hcnkgZGF0YSBoZWxkIGluIGEgc3RyaW5nOlxuICAgICAgICBieXRlU3RyaW5nID0gYXRvYihkYXRhU3RyaW5nKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQ29udmVydCBiYXNlNjQvVVJMRW5jb2RlZCBkYXRhIGNvbXBvbmVudCB0byByYXcgYmluYXJ5OlxuICAgICAgICBieXRlU3RyaW5nID0gZGVjb2RlVVJJQ29tcG9uZW50KGRhdGFTdHJpbmcpXG4gICAgICB9XG4gICAgICAvLyBXcml0ZSB0aGUgYnl0ZXMgb2YgdGhlIHN0cmluZyB0byBhbiBBcnJheUJ1ZmZlcjpcbiAgICAgIGFycmF5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ5dGVTdHJpbmcubGVuZ3RoKVxuICAgICAgaW50QXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheUJ1ZmZlcilcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBieXRlU3RyaW5nLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGludEFycmF5W2ldID0gYnl0ZVN0cmluZy5jaGFyQ29kZUF0KGkpXG4gICAgICB9XG4gICAgICAvLyBXcml0ZSB0aGUgQXJyYXlCdWZmZXIgKG9yIEFycmF5QnVmZmVyVmlldykgdG8gYSBibG9iOlxuICAgICAgaWYgKGhhc0Jsb2JDb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gbmV3IEJsb2IoXG4gICAgICAgICAgW2hhc0FycmF5QnVmZmVyVmlld1N1cHBvcnQgPyBpbnRBcnJheSA6IGFycmF5QnVmZmVyXSxcbiAgICAgICAgICB7dHlwZTogbWVkaWFUeXBlfVxuICAgICAgICApXG4gICAgICB9XG4gICAgICBiYiA9IG5ldyBCbG9iQnVpbGRlcigpXG4gICAgICBiYi5hcHBlbmQoYXJyYXlCdWZmZXIpXG4gICAgICByZXR1cm4gYmIuZ2V0QmxvYihtZWRpYVR5cGUpXG4gICAgfVxuICBpZiAod2luZG93LkhUTUxDYW52YXNFbGVtZW50ICYmICFDYW52YXNQcm90b3R5cGUudG9CbG9iKSB7XG4gICAgaWYgKENhbnZhc1Byb3RvdHlwZS5tb3pHZXRBc0ZpbGUpIHtcbiAgICAgIENhbnZhc1Byb3RvdHlwZS50b0Jsb2IgPSBmdW5jdGlvbiAoY2FsbGJhY2ssIHR5cGUsIHF1YWxpdHkpIHtcbiAgICAgICAgaWYgKHF1YWxpdHkgJiYgQ2FudmFzUHJvdG90eXBlLnRvRGF0YVVSTCAmJiBkYXRhVVJMdG9CbG9iKSB7XG4gICAgICAgICAgY2FsbGJhY2soZGF0YVVSTHRvQmxvYih0aGlzLnRvRGF0YVVSTCh0eXBlLCBxdWFsaXR5KSkpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2sodGhpcy5tb3pHZXRBc0ZpbGUoJ2Jsb2InLCB0eXBlKSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoQ2FudmFzUHJvdG90eXBlLnRvRGF0YVVSTCAmJiBkYXRhVVJMdG9CbG9iKSB7XG4gICAgICBDYW52YXNQcm90b3R5cGUudG9CbG9iID0gZnVuY3Rpb24gKGNhbGxiYWNrLCB0eXBlLCBxdWFsaXR5KSB7XG4gICAgICAgIGNhbGxiYWNrKGRhdGFVUkx0b0Jsb2IodGhpcy50b0RhdGFVUkwodHlwZSwgcXVhbGl0eSkpKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBkYXRhVVJMdG9CbG9iXG4gICAgfSlcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZGF0YVVSTHRvQmxvYlxuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5kYXRhVVJMdG9CbG9iID0gZGF0YVVSTHRvQmxvYlxuICB9XG59KHdpbmRvdykpXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vanMvbG9hZC1pbWFnZScpXG5cbnJlcXVpcmUoJy4vanMvbG9hZC1pbWFnZS1leGlmJylcbnJlcXVpcmUoJy4vanMvbG9hZC1pbWFnZS1leGlmLW1hcCcpXG5yZXF1aXJlKCcuL2pzL2xvYWQtaW1hZ2UtbWV0YScpXG5yZXF1aXJlKCcuL2pzL2xvYWQtaW1hZ2Utb3JpZW50YXRpb24nKVxuIiwiLypcbiAqIEphdmFTY3JpcHQgTG9hZCBJbWFnZSBFeGlmIE1hcFxuICogaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1Mb2FkLUltYWdlXG4gKlxuICogQ29weXJpZ2h0IDIwMTMsIFNlYmFzdGlhbiBUc2NoYW5cbiAqIGh0dHBzOi8vYmx1ZWltcC5uZXRcbiAqXG4gKiBFeGlmIHRhZ3MgbWFwcGluZyBiYXNlZCBvblxuICogaHR0cHM6Ly9naXRodWIuY29tL2pzZWlkZWxpbi9leGlmLWpzXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmUsIG1vZHVsZSwgcmVxdWlyZSwgd2luZG93ICovXG5cbjsoZnVuY3Rpb24gKGZhY3RvcnkpIHtcbiAgJ3VzZSBzdHJpY3QnXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgQU1EIG1vZHVsZTpcbiAgICBkZWZpbmUoWycuL2xvYWQtaW1hZ2UnLCAnLi9sb2FkLWltYWdlLWV4aWYnXSwgZmFjdG9yeSlcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIGZhY3RvcnkocmVxdWlyZSgnLi9sb2FkLWltYWdlJyksIHJlcXVpcmUoJy4vbG9hZC1pbWFnZS1leGlmJykpXG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzOlxuICAgIGZhY3Rvcnkod2luZG93LmxvYWRJbWFnZSlcbiAgfVxufShmdW5jdGlvbiAobG9hZEltYWdlKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIGxvYWRJbWFnZS5FeGlmTWFwLnByb3RvdHlwZS50YWdzID0ge1xuICAgIC8vID09PT09PT09PT09PT09PT09XG4gICAgLy8gVElGRiB0YWdzIChJRkQwKTpcbiAgICAvLyA9PT09PT09PT09PT09PT09PVxuICAgIDB4MDEwMDogJ0ltYWdlV2lkdGgnLFxuICAgIDB4MDEwMTogJ0ltYWdlSGVpZ2h0JyxcbiAgICAweDg3Njk6ICdFeGlmSUZEUG9pbnRlcicsXG4gICAgMHg4ODI1OiAnR1BTSW5mb0lGRFBvaW50ZXInLFxuICAgIDB4QTAwNTogJ0ludGVyb3BlcmFiaWxpdHlJRkRQb2ludGVyJyxcbiAgICAweDAxMDI6ICdCaXRzUGVyU2FtcGxlJyxcbiAgICAweDAxMDM6ICdDb21wcmVzc2lvbicsXG4gICAgMHgwMTA2OiAnUGhvdG9tZXRyaWNJbnRlcnByZXRhdGlvbicsXG4gICAgMHgwMTEyOiAnT3JpZW50YXRpb24nLFxuICAgIDB4MDExNTogJ1NhbXBsZXNQZXJQaXhlbCcsXG4gICAgMHgwMTFDOiAnUGxhbmFyQ29uZmlndXJhdGlvbicsXG4gICAgMHgwMjEyOiAnWUNiQ3JTdWJTYW1wbGluZycsXG4gICAgMHgwMjEzOiAnWUNiQ3JQb3NpdGlvbmluZycsXG4gICAgMHgwMTFBOiAnWFJlc29sdXRpb24nLFxuICAgIDB4MDExQjogJ1lSZXNvbHV0aW9uJyxcbiAgICAweDAxMjg6ICdSZXNvbHV0aW9uVW5pdCcsXG4gICAgMHgwMTExOiAnU3RyaXBPZmZzZXRzJyxcbiAgICAweDAxMTY6ICdSb3dzUGVyU3RyaXAnLFxuICAgIDB4MDExNzogJ1N0cmlwQnl0ZUNvdW50cycsXG4gICAgMHgwMjAxOiAnSlBFR0ludGVyY2hhbmdlRm9ybWF0JyxcbiAgICAweDAyMDI6ICdKUEVHSW50ZXJjaGFuZ2VGb3JtYXRMZW5ndGgnLFxuICAgIDB4MDEyRDogJ1RyYW5zZmVyRnVuY3Rpb24nLFxuICAgIDB4MDEzRTogJ1doaXRlUG9pbnQnLFxuICAgIDB4MDEzRjogJ1ByaW1hcnlDaHJvbWF0aWNpdGllcycsXG4gICAgMHgwMjExOiAnWUNiQ3JDb2VmZmljaWVudHMnLFxuICAgIDB4MDIxNDogJ1JlZmVyZW5jZUJsYWNrV2hpdGUnLFxuICAgIDB4MDEzMjogJ0RhdGVUaW1lJyxcbiAgICAweDAxMEU6ICdJbWFnZURlc2NyaXB0aW9uJyxcbiAgICAweDAxMEY6ICdNYWtlJyxcbiAgICAweDAxMTA6ICdNb2RlbCcsXG4gICAgMHgwMTMxOiAnU29mdHdhcmUnLFxuICAgIDB4MDEzQjogJ0FydGlzdCcsXG4gICAgMHg4Mjk4OiAnQ29weXJpZ2h0JyxcbiAgICAvLyA9PT09PT09PT09PT09PT09PT1cbiAgICAvLyBFeGlmIFN1YiBJRkQgdGFnczpcbiAgICAvLyA9PT09PT09PT09PT09PT09PT1cbiAgICAweDkwMDA6ICdFeGlmVmVyc2lvbicsIC8vIEVYSUYgdmVyc2lvblxuICAgIDB4QTAwMDogJ0ZsYXNocGl4VmVyc2lvbicsIC8vIEZsYXNocGl4IGZvcm1hdCB2ZXJzaW9uXG4gICAgMHhBMDAxOiAnQ29sb3JTcGFjZScsIC8vIENvbG9yIHNwYWNlIGluZm9ybWF0aW9uIHRhZ1xuICAgIDB4QTAwMjogJ1BpeGVsWERpbWVuc2lvbicsIC8vIFZhbGlkIHdpZHRoIG9mIG1lYW5pbmdmdWwgaW1hZ2VcbiAgICAweEEwMDM6ICdQaXhlbFlEaW1lbnNpb24nLCAvLyBWYWxpZCBoZWlnaHQgb2YgbWVhbmluZ2Z1bCBpbWFnZVxuICAgIDB4QTUwMDogJ0dhbW1hJyxcbiAgICAweDkxMDE6ICdDb21wb25lbnRzQ29uZmlndXJhdGlvbicsIC8vIEluZm9ybWF0aW9uIGFib3V0IGNoYW5uZWxzXG4gICAgMHg5MTAyOiAnQ29tcHJlc3NlZEJpdHNQZXJQaXhlbCcsIC8vIENvbXByZXNzZWQgYml0cyBwZXIgcGl4ZWxcbiAgICAweDkyN0M6ICdNYWtlck5vdGUnLCAvLyBBbnkgZGVzaXJlZCBpbmZvcm1hdGlvbiB3cml0dGVuIGJ5IHRoZSBtYW51ZmFjdHVyZXJcbiAgICAweDkyODY6ICdVc2VyQ29tbWVudCcsIC8vIENvbW1lbnRzIGJ5IHVzZXJcbiAgICAweEEwMDQ6ICdSZWxhdGVkU291bmRGaWxlJywgLy8gTmFtZSBvZiByZWxhdGVkIHNvdW5kIGZpbGVcbiAgICAweDkwMDM6ICdEYXRlVGltZU9yaWdpbmFsJywgLy8gRGF0ZSBhbmQgdGltZSB3aGVuIHRoZSBvcmlnaW5hbCBpbWFnZSB3YXMgZ2VuZXJhdGVkXG4gICAgMHg5MDA0OiAnRGF0ZVRpbWVEaWdpdGl6ZWQnLCAvLyBEYXRlIGFuZCB0aW1lIHdoZW4gdGhlIGltYWdlIHdhcyBzdG9yZWQgZGlnaXRhbGx5XG4gICAgMHg5MjkwOiAnU3ViU2VjVGltZScsIC8vIEZyYWN0aW9ucyBvZiBzZWNvbmRzIGZvciBEYXRlVGltZVxuICAgIDB4OTI5MTogJ1N1YlNlY1RpbWVPcmlnaW5hbCcsIC8vIEZyYWN0aW9ucyBvZiBzZWNvbmRzIGZvciBEYXRlVGltZU9yaWdpbmFsXG4gICAgMHg5MjkyOiAnU3ViU2VjVGltZURpZ2l0aXplZCcsIC8vIEZyYWN0aW9ucyBvZiBzZWNvbmRzIGZvciBEYXRlVGltZURpZ2l0aXplZFxuICAgIDB4ODI5QTogJ0V4cG9zdXJlVGltZScsIC8vIEV4cG9zdXJlIHRpbWUgKGluIHNlY29uZHMpXG4gICAgMHg4MjlEOiAnRk51bWJlcicsXG4gICAgMHg4ODIyOiAnRXhwb3N1cmVQcm9ncmFtJywgLy8gRXhwb3N1cmUgcHJvZ3JhbVxuICAgIDB4ODgyNDogJ1NwZWN0cmFsU2Vuc2l0aXZpdHknLCAvLyBTcGVjdHJhbCBzZW5zaXRpdml0eVxuICAgIDB4ODgyNzogJ1Bob3RvZ3JhcGhpY1NlbnNpdGl2aXR5JywgLy8gRVhJRiAyLjMsIElTT1NwZWVkUmF0aW5ncyBpbiBFWElGIDIuMlxuICAgIDB4ODgyODogJ09FQ0YnLCAvLyBPcHRvZWxlY3RyaWMgY29udmVyc2lvbiBmYWN0b3JcbiAgICAweDg4MzA6ICdTZW5zaXRpdml0eVR5cGUnLFxuICAgIDB4ODgzMTogJ1N0YW5kYXJkT3V0cHV0U2Vuc2l0aXZpdHknLFxuICAgIDB4ODgzMjogJ1JlY29tbWVuZGVkRXhwb3N1cmVJbmRleCcsXG4gICAgMHg4ODMzOiAnSVNPU3BlZWQnLFxuICAgIDB4ODgzNDogJ0lTT1NwZWVkTGF0aXR1ZGV5eXknLFxuICAgIDB4ODgzNTogJ0lTT1NwZWVkTGF0aXR1ZGV6enonLFxuICAgIDB4OTIwMTogJ1NodXR0ZXJTcGVlZFZhbHVlJywgLy8gU2h1dHRlciBzcGVlZFxuICAgIDB4OTIwMjogJ0FwZXJ0dXJlVmFsdWUnLCAvLyBMZW5zIGFwZXJ0dXJlXG4gICAgMHg5MjAzOiAnQnJpZ2h0bmVzc1ZhbHVlJywgLy8gVmFsdWUgb2YgYnJpZ2h0bmVzc1xuICAgIDB4OTIwNDogJ0V4cG9zdXJlQmlhcycsIC8vIEV4cG9zdXJlIGJpYXNcbiAgICAweDkyMDU6ICdNYXhBcGVydHVyZVZhbHVlJywgLy8gU21hbGxlc3QgRiBudW1iZXIgb2YgbGVuc1xuICAgIDB4OTIwNjogJ1N1YmplY3REaXN0YW5jZScsIC8vIERpc3RhbmNlIHRvIHN1YmplY3QgaW4gbWV0ZXJzXG4gICAgMHg5MjA3OiAnTWV0ZXJpbmdNb2RlJywgLy8gTWV0ZXJpbmcgbW9kZVxuICAgIDB4OTIwODogJ0xpZ2h0U291cmNlJywgLy8gS2luZCBvZiBsaWdodCBzb3VyY2VcbiAgICAweDkyMDk6ICdGbGFzaCcsIC8vIEZsYXNoIHN0YXR1c1xuICAgIDB4OTIxNDogJ1N1YmplY3RBcmVhJywgLy8gTG9jYXRpb24gYW5kIGFyZWEgb2YgbWFpbiBzdWJqZWN0XG4gICAgMHg5MjBBOiAnRm9jYWxMZW5ndGgnLCAvLyBGb2NhbCBsZW5ndGggb2YgdGhlIGxlbnMgaW4gbW1cbiAgICAweEEyMEI6ICdGbGFzaEVuZXJneScsIC8vIFN0cm9iZSBlbmVyZ3kgaW4gQkNQU1xuICAgIDB4QTIwQzogJ1NwYXRpYWxGcmVxdWVuY3lSZXNwb25zZScsXG4gICAgMHhBMjBFOiAnRm9jYWxQbGFuZVhSZXNvbHV0aW9uJywgLy8gTnVtYmVyIG9mIHBpeGVscyBpbiB3aWR0aCBkaXJlY3Rpb24gcGVyIEZQUlVuaXRcbiAgICAweEEyMEY6ICdGb2NhbFBsYW5lWVJlc29sdXRpb24nLCAvLyBOdW1iZXIgb2YgcGl4ZWxzIGluIGhlaWdodCBkaXJlY3Rpb24gcGVyIEZQUlVuaXRcbiAgICAweEEyMTA6ICdGb2NhbFBsYW5lUmVzb2x1dGlvblVuaXQnLCAvLyBVbml0IGZvciBtZWFzdXJpbmcgdGhlIGZvY2FsIHBsYW5lIHJlc29sdXRpb25cbiAgICAweEEyMTQ6ICdTdWJqZWN0TG9jYXRpb24nLCAvLyBMb2NhdGlvbiBvZiBzdWJqZWN0IGluIGltYWdlXG4gICAgMHhBMjE1OiAnRXhwb3N1cmVJbmRleCcsIC8vIEV4cG9zdXJlIGluZGV4IHNlbGVjdGVkIG9uIGNhbWVyYVxuICAgIDB4QTIxNzogJ1NlbnNpbmdNZXRob2QnLCAvLyBJbWFnZSBzZW5zb3IgdHlwZVxuICAgIDB4QTMwMDogJ0ZpbGVTb3VyY2UnLCAvLyBJbWFnZSBzb3VyY2UgKDMgPT0gRFNDKVxuICAgIDB4QTMwMTogJ1NjZW5lVHlwZScsIC8vIFNjZW5lIHR5cGUgKDEgPT0gZGlyZWN0bHkgcGhvdG9ncmFwaGVkKVxuICAgIDB4QTMwMjogJ0NGQVBhdHRlcm4nLCAvLyBDb2xvciBmaWx0ZXIgYXJyYXkgZ2VvbWV0cmljIHBhdHRlcm5cbiAgICAweEE0MDE6ICdDdXN0b21SZW5kZXJlZCcsIC8vIFNwZWNpYWwgcHJvY2Vzc2luZ1xuICAgIDB4QTQwMjogJ0V4cG9zdXJlTW9kZScsIC8vIEV4cG9zdXJlIG1vZGVcbiAgICAweEE0MDM6ICdXaGl0ZUJhbGFuY2UnLCAvLyAxID0gYXV0byB3aGl0ZSBiYWxhbmNlLCAyID0gbWFudWFsXG4gICAgMHhBNDA0OiAnRGlnaXRhbFpvb21SYXRpbycsIC8vIERpZ2l0YWwgem9vbSByYXRpb1xuICAgIDB4QTQwNTogJ0ZvY2FsTGVuZ3RoSW4zNW1tRmlsbScsXG4gICAgMHhBNDA2OiAnU2NlbmVDYXB0dXJlVHlwZScsIC8vIFR5cGUgb2Ygc2NlbmVcbiAgICAweEE0MDc6ICdHYWluQ29udHJvbCcsIC8vIERlZ3JlZSBvZiBvdmVyYWxsIGltYWdlIGdhaW4gYWRqdXN0bWVudFxuICAgIDB4QTQwODogJ0NvbnRyYXN0JywgLy8gRGlyZWN0aW9uIG9mIGNvbnRyYXN0IHByb2Nlc3NpbmcgYXBwbGllZCBieSBjYW1lcmFcbiAgICAweEE0MDk6ICdTYXR1cmF0aW9uJywgLy8gRGlyZWN0aW9uIG9mIHNhdHVyYXRpb24gcHJvY2Vzc2luZyBhcHBsaWVkIGJ5IGNhbWVyYVxuICAgIDB4QTQwQTogJ1NoYXJwbmVzcycsIC8vIERpcmVjdGlvbiBvZiBzaGFycG5lc3MgcHJvY2Vzc2luZyBhcHBsaWVkIGJ5IGNhbWVyYVxuICAgIDB4QTQwQjogJ0RldmljZVNldHRpbmdEZXNjcmlwdGlvbicsXG4gICAgMHhBNDBDOiAnU3ViamVjdERpc3RhbmNlUmFuZ2UnLCAvLyBEaXN0YW5jZSB0byBzdWJqZWN0XG4gICAgMHhBNDIwOiAnSW1hZ2VVbmlxdWVJRCcsIC8vIElkZW50aWZpZXIgYXNzaWduZWQgdW5pcXVlbHkgdG8gZWFjaCBpbWFnZVxuICAgIDB4QTQzMDogJ0NhbWVyYU93bmVyTmFtZScsXG4gICAgMHhBNDMxOiAnQm9keVNlcmlhbE51bWJlcicsXG4gICAgMHhBNDMyOiAnTGVuc1NwZWNpZmljYXRpb24nLFxuICAgIDB4QTQzMzogJ0xlbnNNYWtlJyxcbiAgICAweEE0MzQ6ICdMZW5zTW9kZWwnLFxuICAgIDB4QTQzNTogJ0xlbnNTZXJpYWxOdW1iZXInLFxuICAgIC8vID09PT09PT09PT09PT09XG4gICAgLy8gR1BTIEluZm8gdGFnczpcbiAgICAvLyA9PT09PT09PT09PT09PVxuICAgIDB4MDAwMDogJ0dQU1ZlcnNpb25JRCcsXG4gICAgMHgwMDAxOiAnR1BTTGF0aXR1ZGVSZWYnLFxuICAgIDB4MDAwMjogJ0dQU0xhdGl0dWRlJyxcbiAgICAweDAwMDM6ICdHUFNMb25naXR1ZGVSZWYnLFxuICAgIDB4MDAwNDogJ0dQU0xvbmdpdHVkZScsXG4gICAgMHgwMDA1OiAnR1BTQWx0aXR1ZGVSZWYnLFxuICAgIDB4MDAwNjogJ0dQU0FsdGl0dWRlJyxcbiAgICAweDAwMDc6ICdHUFNUaW1lU3RhbXAnLFxuICAgIDB4MDAwODogJ0dQU1NhdGVsbGl0ZXMnLFxuICAgIDB4MDAwOTogJ0dQU1N0YXR1cycsXG4gICAgMHgwMDBBOiAnR1BTTWVhc3VyZU1vZGUnLFxuICAgIDB4MDAwQjogJ0dQU0RPUCcsXG4gICAgMHgwMDBDOiAnR1BTU3BlZWRSZWYnLFxuICAgIDB4MDAwRDogJ0dQU1NwZWVkJyxcbiAgICAweDAwMEU6ICdHUFNUcmFja1JlZicsXG4gICAgMHgwMDBGOiAnR1BTVHJhY2snLFxuICAgIDB4MDAxMDogJ0dQU0ltZ0RpcmVjdGlvblJlZicsXG4gICAgMHgwMDExOiAnR1BTSW1nRGlyZWN0aW9uJyxcbiAgICAweDAwMTI6ICdHUFNNYXBEYXR1bScsXG4gICAgMHgwMDEzOiAnR1BTRGVzdExhdGl0dWRlUmVmJyxcbiAgICAweDAwMTQ6ICdHUFNEZXN0TGF0aXR1ZGUnLFxuICAgIDB4MDAxNTogJ0dQU0Rlc3RMb25naXR1ZGVSZWYnLFxuICAgIDB4MDAxNjogJ0dQU0Rlc3RMb25naXR1ZGUnLFxuICAgIDB4MDAxNzogJ0dQU0Rlc3RCZWFyaW5nUmVmJyxcbiAgICAweDAwMTg6ICdHUFNEZXN0QmVhcmluZycsXG4gICAgMHgwMDE5OiAnR1BTRGVzdERpc3RhbmNlUmVmJyxcbiAgICAweDAwMUE6ICdHUFNEZXN0RGlzdGFuY2UnLFxuICAgIDB4MDAxQjogJ0dQU1Byb2Nlc3NpbmdNZXRob2QnLFxuICAgIDB4MDAxQzogJ0dQU0FyZWFJbmZvcm1hdGlvbicsXG4gICAgMHgwMDFEOiAnR1BTRGF0ZVN0YW1wJyxcbiAgICAweDAwMUU6ICdHUFNEaWZmZXJlbnRpYWwnLFxuICAgIDB4MDAxRjogJ0dQU0hQb3NpdGlvbmluZ0Vycm9yJ1xuICB9XG5cbiAgbG9hZEltYWdlLkV4aWZNYXAucHJvdG90eXBlLnN0cmluZ1ZhbHVlcyA9IHtcbiAgICBFeHBvc3VyZVByb2dyYW06IHtcbiAgICAgIDA6ICdVbmRlZmluZWQnLFxuICAgICAgMTogJ01hbnVhbCcsXG4gICAgICAyOiAnTm9ybWFsIHByb2dyYW0nLFxuICAgICAgMzogJ0FwZXJ0dXJlIHByaW9yaXR5JyxcbiAgICAgIDQ6ICdTaHV0dGVyIHByaW9yaXR5JyxcbiAgICAgIDU6ICdDcmVhdGl2ZSBwcm9ncmFtJyxcbiAgICAgIDY6ICdBY3Rpb24gcHJvZ3JhbScsXG4gICAgICA3OiAnUG9ydHJhaXQgbW9kZScsXG4gICAgICA4OiAnTGFuZHNjYXBlIG1vZGUnXG4gICAgfSxcbiAgICBNZXRlcmluZ01vZGU6IHtcbiAgICAgIDA6ICdVbmtub3duJyxcbiAgICAgIDE6ICdBdmVyYWdlJyxcbiAgICAgIDI6ICdDZW50ZXJXZWlnaHRlZEF2ZXJhZ2UnLFxuICAgICAgMzogJ1Nwb3QnLFxuICAgICAgNDogJ011bHRpU3BvdCcsXG4gICAgICA1OiAnUGF0dGVybicsXG4gICAgICA2OiAnUGFydGlhbCcsXG4gICAgICAyNTU6ICdPdGhlcidcbiAgICB9LFxuICAgIExpZ2h0U291cmNlOiB7XG4gICAgICAwOiAnVW5rbm93bicsXG4gICAgICAxOiAnRGF5bGlnaHQnLFxuICAgICAgMjogJ0ZsdW9yZXNjZW50JyxcbiAgICAgIDM6ICdUdW5nc3RlbiAoaW5jYW5kZXNjZW50IGxpZ2h0KScsXG4gICAgICA0OiAnRmxhc2gnLFxuICAgICAgOTogJ0ZpbmUgd2VhdGhlcicsXG4gICAgICAxMDogJ0Nsb3VkeSB3ZWF0aGVyJyxcbiAgICAgIDExOiAnU2hhZGUnLFxuICAgICAgMTI6ICdEYXlsaWdodCBmbHVvcmVzY2VudCAoRCA1NzAwIC0gNzEwMEspJyxcbiAgICAgIDEzOiAnRGF5IHdoaXRlIGZsdW9yZXNjZW50IChOIDQ2MDAgLSA1NDAwSyknLFxuICAgICAgMTQ6ICdDb29sIHdoaXRlIGZsdW9yZXNjZW50IChXIDM5MDAgLSA0NTAwSyknLFxuICAgICAgMTU6ICdXaGl0ZSBmbHVvcmVzY2VudCAoV1cgMzIwMCAtIDM3MDBLKScsXG4gICAgICAxNzogJ1N0YW5kYXJkIGxpZ2h0IEEnLFxuICAgICAgMTg6ICdTdGFuZGFyZCBsaWdodCBCJyxcbiAgICAgIDE5OiAnU3RhbmRhcmQgbGlnaHQgQycsXG4gICAgICAyMDogJ0Q1NScsXG4gICAgICAyMTogJ0Q2NScsXG4gICAgICAyMjogJ0Q3NScsXG4gICAgICAyMzogJ0Q1MCcsXG4gICAgICAyNDogJ0lTTyBzdHVkaW8gdHVuZ3N0ZW4nLFxuICAgICAgMjU1OiAnT3RoZXInXG4gICAgfSxcbiAgICBGbGFzaDoge1xuICAgICAgMHgwMDAwOiAnRmxhc2ggZGlkIG5vdCBmaXJlJyxcbiAgICAgIDB4MDAwMTogJ0ZsYXNoIGZpcmVkJyxcbiAgICAgIDB4MDAwNTogJ1N0cm9iZSByZXR1cm4gbGlnaHQgbm90IGRldGVjdGVkJyxcbiAgICAgIDB4MDAwNzogJ1N0cm9iZSByZXR1cm4gbGlnaHQgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDA5OiAnRmxhc2ggZmlyZWQsIGNvbXB1bHNvcnkgZmxhc2ggbW9kZScsXG4gICAgICAweDAwMEQ6ICdGbGFzaCBmaXJlZCwgY29tcHVsc29yeSBmbGFzaCBtb2RlLCByZXR1cm4gbGlnaHQgbm90IGRldGVjdGVkJyxcbiAgICAgIDB4MDAwRjogJ0ZsYXNoIGZpcmVkLCBjb21wdWxzb3J5IGZsYXNoIG1vZGUsIHJldHVybiBsaWdodCBkZXRlY3RlZCcsXG4gICAgICAweDAwMTA6ICdGbGFzaCBkaWQgbm90IGZpcmUsIGNvbXB1bHNvcnkgZmxhc2ggbW9kZScsXG4gICAgICAweDAwMTg6ICdGbGFzaCBkaWQgbm90IGZpcmUsIGF1dG8gbW9kZScsXG4gICAgICAweDAwMTk6ICdGbGFzaCBmaXJlZCwgYXV0byBtb2RlJyxcbiAgICAgIDB4MDAxRDogJ0ZsYXNoIGZpcmVkLCBhdXRvIG1vZGUsIHJldHVybiBsaWdodCBub3QgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDFGOiAnRmxhc2ggZmlyZWQsIGF1dG8gbW9kZSwgcmV0dXJuIGxpZ2h0IGRldGVjdGVkJyxcbiAgICAgIDB4MDAyMDogJ05vIGZsYXNoIGZ1bmN0aW9uJyxcbiAgICAgIDB4MDA0MTogJ0ZsYXNoIGZpcmVkLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlJyxcbiAgICAgIDB4MDA0NTogJ0ZsYXNoIGZpcmVkLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlLCByZXR1cm4gbGlnaHQgbm90IGRldGVjdGVkJyxcbiAgICAgIDB4MDA0NzogJ0ZsYXNoIGZpcmVkLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlLCByZXR1cm4gbGlnaHQgZGV0ZWN0ZWQnLFxuICAgICAgMHgwMDQ5OiAnRmxhc2ggZmlyZWQsIGNvbXB1bHNvcnkgZmxhc2ggbW9kZSwgcmVkLWV5ZSByZWR1Y3Rpb24gbW9kZScsXG4gICAgICAweDAwNEQ6ICdGbGFzaCBmaXJlZCwgY29tcHVsc29yeSBmbGFzaCBtb2RlLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlLCByZXR1cm4gbGlnaHQgbm90IGRldGVjdGVkJyxcbiAgICAgIDB4MDA0RjogJ0ZsYXNoIGZpcmVkLCBjb21wdWxzb3J5IGZsYXNoIG1vZGUsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUsIHJldHVybiBsaWdodCBkZXRlY3RlZCcsXG4gICAgICAweDAwNTk6ICdGbGFzaCBmaXJlZCwgYXV0byBtb2RlLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlJyxcbiAgICAgIDB4MDA1RDogJ0ZsYXNoIGZpcmVkLCBhdXRvIG1vZGUsIHJldHVybiBsaWdodCBub3QgZGV0ZWN0ZWQsIHJlZC1leWUgcmVkdWN0aW9uIG1vZGUnLFxuICAgICAgMHgwMDVGOiAnRmxhc2ggZmlyZWQsIGF1dG8gbW9kZSwgcmV0dXJuIGxpZ2h0IGRldGVjdGVkLCByZWQtZXllIHJlZHVjdGlvbiBtb2RlJ1xuICAgIH0sXG4gICAgU2Vuc2luZ01ldGhvZDoge1xuICAgICAgMTogJ1VuZGVmaW5lZCcsXG4gICAgICAyOiAnT25lLWNoaXAgY29sb3IgYXJlYSBzZW5zb3InLFxuICAgICAgMzogJ1R3by1jaGlwIGNvbG9yIGFyZWEgc2Vuc29yJyxcbiAgICAgIDQ6ICdUaHJlZS1jaGlwIGNvbG9yIGFyZWEgc2Vuc29yJyxcbiAgICAgIDU6ICdDb2xvciBzZXF1ZW50aWFsIGFyZWEgc2Vuc29yJyxcbiAgICAgIDc6ICdUcmlsaW5lYXIgc2Vuc29yJyxcbiAgICAgIDg6ICdDb2xvciBzZXF1ZW50aWFsIGxpbmVhciBzZW5zb3InXG4gICAgfSxcbiAgICBTY2VuZUNhcHR1cmVUeXBlOiB7XG4gICAgICAwOiAnU3RhbmRhcmQnLFxuICAgICAgMTogJ0xhbmRzY2FwZScsXG4gICAgICAyOiAnUG9ydHJhaXQnLFxuICAgICAgMzogJ05pZ2h0IHNjZW5lJ1xuICAgIH0sXG4gICAgU2NlbmVUeXBlOiB7XG4gICAgICAxOiAnRGlyZWN0bHkgcGhvdG9ncmFwaGVkJ1xuICAgIH0sXG4gICAgQ3VzdG9tUmVuZGVyZWQ6IHtcbiAgICAgIDA6ICdOb3JtYWwgcHJvY2VzcycsXG4gICAgICAxOiAnQ3VzdG9tIHByb2Nlc3MnXG4gICAgfSxcbiAgICBXaGl0ZUJhbGFuY2U6IHtcbiAgICAgIDA6ICdBdXRvIHdoaXRlIGJhbGFuY2UnLFxuICAgICAgMTogJ01hbnVhbCB3aGl0ZSBiYWxhbmNlJ1xuICAgIH0sXG4gICAgR2FpbkNvbnRyb2w6IHtcbiAgICAgIDA6ICdOb25lJyxcbiAgICAgIDE6ICdMb3cgZ2FpbiB1cCcsXG4gICAgICAyOiAnSGlnaCBnYWluIHVwJyxcbiAgICAgIDM6ICdMb3cgZ2FpbiBkb3duJyxcbiAgICAgIDQ6ICdIaWdoIGdhaW4gZG93bidcbiAgICB9LFxuICAgIENvbnRyYXN0OiB7XG4gICAgICAwOiAnTm9ybWFsJyxcbiAgICAgIDE6ICdTb2Z0JyxcbiAgICAgIDI6ICdIYXJkJ1xuICAgIH0sXG4gICAgU2F0dXJhdGlvbjoge1xuICAgICAgMDogJ05vcm1hbCcsXG4gICAgICAxOiAnTG93IHNhdHVyYXRpb24nLFxuICAgICAgMjogJ0hpZ2ggc2F0dXJhdGlvbidcbiAgICB9LFxuICAgIFNoYXJwbmVzczoge1xuICAgICAgMDogJ05vcm1hbCcsXG4gICAgICAxOiAnU29mdCcsXG4gICAgICAyOiAnSGFyZCdcbiAgICB9LFxuICAgIFN1YmplY3REaXN0YW5jZVJhbmdlOiB7XG4gICAgICAwOiAnVW5rbm93bicsXG4gICAgICAxOiAnTWFjcm8nLFxuICAgICAgMjogJ0Nsb3NlIHZpZXcnLFxuICAgICAgMzogJ0Rpc3RhbnQgdmlldydcbiAgICB9LFxuICAgIEZpbGVTb3VyY2U6IHtcbiAgICAgIDM6ICdEU0MnXG4gICAgfSxcbiAgICBDb21wb25lbnRzQ29uZmlndXJhdGlvbjoge1xuICAgICAgMDogJycsXG4gICAgICAxOiAnWScsXG4gICAgICAyOiAnQ2InLFxuICAgICAgMzogJ0NyJyxcbiAgICAgIDQ6ICdSJyxcbiAgICAgIDU6ICdHJyxcbiAgICAgIDY6ICdCJ1xuICAgIH0sXG4gICAgT3JpZW50YXRpb246IHtcbiAgICAgIDE6ICd0b3AtbGVmdCcsXG4gICAgICAyOiAndG9wLXJpZ2h0JyxcbiAgICAgIDM6ICdib3R0b20tcmlnaHQnLFxuICAgICAgNDogJ2JvdHRvbS1sZWZ0JyxcbiAgICAgIDU6ICdsZWZ0LXRvcCcsXG4gICAgICA2OiAncmlnaHQtdG9wJyxcbiAgICAgIDc6ICdyaWdodC1ib3R0b20nLFxuICAgICAgODogJ2xlZnQtYm90dG9tJ1xuICAgIH1cbiAgfVxuXG4gIGxvYWRJbWFnZS5FeGlmTWFwLnByb3RvdHlwZS5nZXRUZXh0ID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHZhbHVlID0gdGhpcy5nZXQoaWQpXG4gICAgc3dpdGNoIChpZCkge1xuICAgICAgY2FzZSAnTGlnaHRTb3VyY2UnOlxuICAgICAgY2FzZSAnRmxhc2gnOlxuICAgICAgY2FzZSAnTWV0ZXJpbmdNb2RlJzpcbiAgICAgIGNhc2UgJ0V4cG9zdXJlUHJvZ3JhbSc6XG4gICAgICBjYXNlICdTZW5zaW5nTWV0aG9kJzpcbiAgICAgIGNhc2UgJ1NjZW5lQ2FwdHVyZVR5cGUnOlxuICAgICAgY2FzZSAnU2NlbmVUeXBlJzpcbiAgICAgIGNhc2UgJ0N1c3RvbVJlbmRlcmVkJzpcbiAgICAgIGNhc2UgJ1doaXRlQmFsYW5jZSc6XG4gICAgICBjYXNlICdHYWluQ29udHJvbCc6XG4gICAgICBjYXNlICdDb250cmFzdCc6XG4gICAgICBjYXNlICdTYXR1cmF0aW9uJzpcbiAgICAgIGNhc2UgJ1NoYXJwbmVzcyc6XG4gICAgICBjYXNlICdTdWJqZWN0RGlzdGFuY2VSYW5nZSc6XG4gICAgICBjYXNlICdGaWxlU291cmNlJzpcbiAgICAgIGNhc2UgJ09yaWVudGF0aW9uJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nVmFsdWVzW2lkXVt2YWx1ZV1cbiAgICAgIGNhc2UgJ0V4aWZWZXJzaW9uJzpcbiAgICAgIGNhc2UgJ0ZsYXNocGl4VmVyc2lvbic6XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlWzBdLCB2YWx1ZVsxXSwgdmFsdWVbMl0sIHZhbHVlWzNdKVxuICAgICAgY2FzZSAnQ29tcG9uZW50c0NvbmZpZ3VyYXRpb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5zdHJpbmdWYWx1ZXNbaWRdW3ZhbHVlWzBdXSArXG4gICAgICAgIHRoaXMuc3RyaW5nVmFsdWVzW2lkXVt2YWx1ZVsxXV0gK1xuICAgICAgICB0aGlzLnN0cmluZ1ZhbHVlc1tpZF1bdmFsdWVbMl1dICtcbiAgICAgICAgdGhpcy5zdHJpbmdWYWx1ZXNbaWRdW3ZhbHVlWzNdXVxuICAgICAgY2FzZSAnR1BTVmVyc2lvbklEJzpcbiAgICAgICAgcmV0dXJuIHZhbHVlWzBdICsgJy4nICsgdmFsdWVbMV0gKyAnLicgKyB2YWx1ZVsyXSArICcuJyArIHZhbHVlWzNdXG4gICAgfVxuICAgIHJldHVybiBTdHJpbmcodmFsdWUpXG4gIH1cblxuICA7KGZ1bmN0aW9uIChleGlmTWFwUHJvdG90eXBlKSB7XG4gICAgdmFyIHRhZ3MgPSBleGlmTWFwUHJvdG90eXBlLnRhZ3NcbiAgICB2YXIgbWFwID0gZXhpZk1hcFByb3RvdHlwZS5tYXBcbiAgICB2YXIgcHJvcFxuICAgIC8vIE1hcCB0aGUgdGFnIG5hbWVzIHRvIHRhZ3M6XG4gICAgZm9yIChwcm9wIGluIHRhZ3MpIHtcbiAgICAgIGlmICh0YWdzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgIG1hcFt0YWdzW3Byb3BdXSA9IHByb3BcbiAgICAgIH1cbiAgICB9XG4gIH0obG9hZEltYWdlLkV4aWZNYXAucHJvdG90eXBlKSlcblxuICBsb2FkSW1hZ2UuRXhpZk1hcC5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBtYXAgPSB7fVxuICAgIHZhciBwcm9wXG4gICAgdmFyIGlkXG4gICAgZm9yIChwcm9wIGluIHRoaXMpIHtcbiAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgIGlkID0gdGhpcy50YWdzW3Byb3BdXG4gICAgICAgIGlmIChpZCkge1xuICAgICAgICAgIG1hcFtpZF0gPSB0aGlzLmdldFRleHQoaWQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG1hcFxuICB9XG59KSlcbiIsIi8qXG4gKiBKYXZhU2NyaXB0IExvYWQgSW1hZ2UgRXhpZiBQYXJzZXJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTG9hZC1JbWFnZVxuICpcbiAqIENvcHlyaWdodCAyMDEzLCBTZWJhc3RpYW4gVHNjaGFuXG4gKiBodHRwczovL2JsdWVpbXAubmV0XG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmUsIG1vZHVsZSwgcmVxdWlyZSwgd2luZG93LCBjb25zb2xlICovXG5cbjsoZnVuY3Rpb24gKGZhY3RvcnkpIHtcbiAgJ3VzZSBzdHJpY3QnXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgQU1EIG1vZHVsZTpcbiAgICBkZWZpbmUoWycuL2xvYWQtaW1hZ2UnLCAnLi9sb2FkLWltYWdlLW1ldGEnXSwgZmFjdG9yeSlcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIGZhY3RvcnkocmVxdWlyZSgnLi9sb2FkLWltYWdlJyksIHJlcXVpcmUoJy4vbG9hZC1pbWFnZS1tZXRhJykpXG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzOlxuICAgIGZhY3Rvcnkod2luZG93LmxvYWRJbWFnZSlcbiAgfVxufShmdW5jdGlvbiAobG9hZEltYWdlKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIGxvYWRJbWFnZS5FeGlmTWFwID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBsb2FkSW1hZ2UuRXhpZk1hcC5wcm90b3R5cGUubWFwID0ge1xuICAgICdPcmllbnRhdGlvbic6IDB4MDExMlxuICB9XG5cbiAgbG9hZEltYWdlLkV4aWZNYXAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIHJldHVybiB0aGlzW2lkXSB8fCB0aGlzW3RoaXMubWFwW2lkXV1cbiAgfVxuXG4gIGxvYWRJbWFnZS5nZXRFeGlmVGh1bWJuYWlsID0gZnVuY3Rpb24gKGRhdGFWaWV3LCBvZmZzZXQsIGxlbmd0aCkge1xuICAgIHZhciBoZXhEYXRhLFxuICAgICAgaSxcbiAgICAgIGJcbiAgICBpZiAoIWxlbmd0aCB8fCBvZmZzZXQgKyBsZW5ndGggPiBkYXRhVmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IEludmFsaWQgdGh1bWJuYWlsIGRhdGEuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBoZXhEYXRhID0gW11cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIGIgPSBkYXRhVmlldy5nZXRVaW50OChvZmZzZXQgKyBpKVxuICAgICAgaGV4RGF0YS5wdXNoKChiIDwgMTYgPyAnMCcgOiAnJykgKyBiLnRvU3RyaW5nKDE2KSlcbiAgICB9XG4gICAgcmV0dXJuICdkYXRhOmltYWdlL2pwZWcsJScgKyBoZXhEYXRhLmpvaW4oJyUnKVxuICB9XG5cbiAgbG9hZEltYWdlLmV4aWZUYWdUeXBlcyA9IHtcbiAgICAvLyBieXRlLCA4LWJpdCB1bnNpZ25lZCBpbnQ6XG4gICAgMToge1xuICAgICAgZ2V0VmFsdWU6IGZ1bmN0aW9uIChkYXRhVmlldywgZGF0YU9mZnNldCkge1xuICAgICAgICByZXR1cm4gZGF0YVZpZXcuZ2V0VWludDgoZGF0YU9mZnNldClcbiAgICAgIH0sXG4gICAgICBzaXplOiAxXG4gICAgfSxcbiAgICAvLyBhc2NpaSwgOC1iaXQgYnl0ZTpcbiAgICAyOiB7XG4gICAgICBnZXRWYWx1ZTogZnVuY3Rpb24gKGRhdGFWaWV3LCBkYXRhT2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFWaWV3LmdldFVpbnQ4KGRhdGFPZmZzZXQpKVxuICAgICAgfSxcbiAgICAgIHNpemU6IDEsXG4gICAgICBhc2NpaTogdHJ1ZVxuICAgIH0sXG4gICAgLy8gc2hvcnQsIDE2IGJpdCBpbnQ6XG4gICAgMzoge1xuICAgICAgZ2V0VmFsdWU6IGZ1bmN0aW9uIChkYXRhVmlldywgZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gICAgICAgIHJldHVybiBkYXRhVmlldy5nZXRVaW50MTYoZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKVxuICAgICAgfSxcbiAgICAgIHNpemU6IDJcbiAgICB9LFxuICAgIC8vIGxvbmcsIDMyIGJpdCBpbnQ6XG4gICAgNDoge1xuICAgICAgZ2V0VmFsdWU6IGZ1bmN0aW9uIChkYXRhVmlldywgZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gICAgICAgIHJldHVybiBkYXRhVmlldy5nZXRVaW50MzIoZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKVxuICAgICAgfSxcbiAgICAgIHNpemU6IDRcbiAgICB9LFxuICAgIC8vIHJhdGlvbmFsID0gdHdvIGxvbmcgdmFsdWVzLCBmaXJzdCBpcyBudW1lcmF0b3IsIHNlY29uZCBpcyBkZW5vbWluYXRvcjpcbiAgICA1OiB7XG4gICAgICBnZXRWYWx1ZTogZnVuY3Rpb24gKGRhdGFWaWV3LCBkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgICAgICAgcmV0dXJuIGRhdGFWaWV3LmdldFVpbnQzMihkYXRhT2Zmc2V0LCBsaXR0bGVFbmRpYW4pIC9cbiAgICAgICAgZGF0YVZpZXcuZ2V0VWludDMyKGRhdGFPZmZzZXQgKyA0LCBsaXR0bGVFbmRpYW4pXG4gICAgICB9LFxuICAgICAgc2l6ZTogOFxuICAgIH0sXG4gICAgLy8gc2xvbmcsIDMyIGJpdCBzaWduZWQgaW50OlxuICAgIDk6IHtcbiAgICAgIGdldFZhbHVlOiBmdW5jdGlvbiAoZGF0YVZpZXcsIGRhdGFPZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICAgICAgICByZXR1cm4gZGF0YVZpZXcuZ2V0SW50MzIoZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKVxuICAgICAgfSxcbiAgICAgIHNpemU6IDRcbiAgICB9LFxuICAgIC8vIHNyYXRpb25hbCwgdHdvIHNsb25ncywgZmlyc3QgaXMgbnVtZXJhdG9yLCBzZWNvbmQgaXMgZGVub21pbmF0b3I6XG4gICAgMTA6IHtcbiAgICAgIGdldFZhbHVlOiBmdW5jdGlvbiAoZGF0YVZpZXcsIGRhdGFPZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICAgICAgICByZXR1cm4gZGF0YVZpZXcuZ2V0SW50MzIoZGF0YU9mZnNldCwgbGl0dGxlRW5kaWFuKSAvXG4gICAgICAgIGRhdGFWaWV3LmdldEludDMyKGRhdGFPZmZzZXQgKyA0LCBsaXR0bGVFbmRpYW4pXG4gICAgICB9LFxuICAgICAgc2l6ZTogOFxuICAgIH1cbiAgfVxuICAvLyB1bmRlZmluZWQsIDgtYml0IGJ5dGUsIHZhbHVlIGRlcGVuZGluZyBvbiBmaWVsZDpcbiAgbG9hZEltYWdlLmV4aWZUYWdUeXBlc1s3XSA9IGxvYWRJbWFnZS5leGlmVGFnVHlwZXNbMV1cblxuICBsb2FkSW1hZ2UuZ2V0RXhpZlZhbHVlID0gZnVuY3Rpb24gKGRhdGFWaWV3LCB0aWZmT2Zmc2V0LCBvZmZzZXQsIHR5cGUsIGxlbmd0aCwgbGl0dGxlRW5kaWFuKSB7XG4gICAgdmFyIHRhZ1R5cGUgPSBsb2FkSW1hZ2UuZXhpZlRhZ1R5cGVzW3R5cGVdXG4gICAgdmFyIHRhZ1NpemVcbiAgICB2YXIgZGF0YU9mZnNldFxuICAgIHZhciB2YWx1ZXNcbiAgICB2YXIgaVxuICAgIHZhciBzdHJcbiAgICB2YXIgY1xuICAgIGlmICghdGFnVHlwZSkge1xuICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgRXhpZiBkYXRhOiBJbnZhbGlkIHRhZyB0eXBlLicpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdGFnU2l6ZSA9IHRhZ1R5cGUuc2l6ZSAqIGxlbmd0aFxuICAgIC8vIERldGVybWluZSBpZiB0aGUgdmFsdWUgaXMgY29udGFpbmVkIGluIHRoZSBkYXRhT2Zmc2V0IGJ5dGVzLFxuICAgIC8vIG9yIGlmIHRoZSB2YWx1ZSBhdCB0aGUgZGF0YU9mZnNldCBpcyBhIHBvaW50ZXIgdG8gdGhlIGFjdHVhbCBkYXRhOlxuICAgIGRhdGFPZmZzZXQgPSB0YWdTaXplID4gNFxuICAgICAgPyB0aWZmT2Zmc2V0ICsgZGF0YVZpZXcuZ2V0VWludDMyKG9mZnNldCArIDgsIGxpdHRsZUVuZGlhbilcbiAgICAgIDogKG9mZnNldCArIDgpXG4gICAgaWYgKGRhdGFPZmZzZXQgKyB0YWdTaXplID4gZGF0YVZpZXcuYnl0ZUxlbmd0aCkge1xuICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgRXhpZiBkYXRhOiBJbnZhbGlkIGRhdGEgb2Zmc2V0LicpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKGxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIHRhZ1R5cGUuZ2V0VmFsdWUoZGF0YVZpZXcsIGRhdGFPZmZzZXQsIGxpdHRsZUVuZGlhbilcbiAgICB9XG4gICAgdmFsdWVzID0gW11cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIHZhbHVlc1tpXSA9IHRhZ1R5cGUuZ2V0VmFsdWUoZGF0YVZpZXcsIGRhdGFPZmZzZXQgKyBpICogdGFnVHlwZS5zaXplLCBsaXR0bGVFbmRpYW4pXG4gICAgfVxuICAgIGlmICh0YWdUeXBlLmFzY2lpKSB7XG4gICAgICBzdHIgPSAnJ1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGNoYXJzOlxuICAgICAgZm9yIChpID0gMDsgaSA8IHZhbHVlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBjID0gdmFsdWVzW2ldXG4gICAgICAgIC8vIElnbm9yZSB0aGUgdGVybWluYXRpbmcgTlVMTCBieXRlKHMpOlxuICAgICAgICBpZiAoYyA9PT0gJ1xcdTAwMDAnKSB7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBzdHIgKz0gY1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0clxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzXG4gIH1cblxuICBsb2FkSW1hZ2UucGFyc2VFeGlmVGFnID0gZnVuY3Rpb24gKGRhdGFWaWV3LCB0aWZmT2Zmc2V0LCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgZGF0YSkge1xuICAgIHZhciB0YWcgPSBkYXRhVmlldy5nZXRVaW50MTYob2Zmc2V0LCBsaXR0bGVFbmRpYW4pXG4gICAgZGF0YS5leGlmW3RhZ10gPSBsb2FkSW1hZ2UuZ2V0RXhpZlZhbHVlKFxuICAgICAgZGF0YVZpZXcsXG4gICAgICB0aWZmT2Zmc2V0LFxuICAgICAgb2Zmc2V0LFxuICAgICAgZGF0YVZpZXcuZ2V0VWludDE2KG9mZnNldCArIDIsIGxpdHRsZUVuZGlhbiksIC8vIHRhZyB0eXBlXG4gICAgICBkYXRhVmlldy5nZXRVaW50MzIob2Zmc2V0ICsgNCwgbGl0dGxlRW5kaWFuKSwgLy8gdGFnIGxlbmd0aFxuICAgICAgbGl0dGxlRW5kaWFuXG4gICAgKVxuICB9XG5cbiAgbG9hZEltYWdlLnBhcnNlRXhpZlRhZ3MgPSBmdW5jdGlvbiAoZGF0YVZpZXcsIHRpZmZPZmZzZXQsIGRpck9mZnNldCwgbGl0dGxlRW5kaWFuLCBkYXRhKSB7XG4gICAgdmFyIHRhZ3NOdW1iZXIsXG4gICAgICBkaXJFbmRPZmZzZXQsXG4gICAgICBpXG4gICAgaWYgKGRpck9mZnNldCArIDYgPiBkYXRhVmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IEludmFsaWQgZGlyZWN0b3J5IG9mZnNldC4nKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHRhZ3NOdW1iZXIgPSBkYXRhVmlldy5nZXRVaW50MTYoZGlyT2Zmc2V0LCBsaXR0bGVFbmRpYW4pXG4gICAgZGlyRW5kT2Zmc2V0ID0gZGlyT2Zmc2V0ICsgMiArIDEyICogdGFnc051bWJlclxuICAgIGlmIChkaXJFbmRPZmZzZXQgKyA0ID4gZGF0YVZpZXcuYnl0ZUxlbmd0aCkge1xuICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgRXhpZiBkYXRhOiBJbnZhbGlkIGRpcmVjdG9yeSBzaXplLicpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IHRhZ3NOdW1iZXI7IGkgKz0gMSkge1xuICAgICAgdGhpcy5wYXJzZUV4aWZUYWcoXG4gICAgICAgIGRhdGFWaWV3LFxuICAgICAgICB0aWZmT2Zmc2V0LFxuICAgICAgICBkaXJPZmZzZXQgKyAyICsgMTIgKiBpLCAvLyB0YWcgb2Zmc2V0XG4gICAgICAgIGxpdHRsZUVuZGlhbixcbiAgICAgICAgZGF0YVxuICAgICAgKVxuICAgIH1cbiAgICAvLyBSZXR1cm4gdGhlIG9mZnNldCB0byB0aGUgbmV4dCBkaXJlY3Rvcnk6XG4gICAgcmV0dXJuIGRhdGFWaWV3LmdldFVpbnQzMihkaXJFbmRPZmZzZXQsIGxpdHRsZUVuZGlhbilcbiAgfVxuXG4gIGxvYWRJbWFnZS5wYXJzZUV4aWZEYXRhID0gZnVuY3Rpb24gKGRhdGFWaWV3LCBvZmZzZXQsIGxlbmd0aCwgZGF0YSwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLmRpc2FibGVFeGlmKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdmFyIHRpZmZPZmZzZXQgPSBvZmZzZXQgKyAxMFxuICAgIHZhciBsaXR0bGVFbmRpYW5cbiAgICB2YXIgZGlyT2Zmc2V0XG4gICAgdmFyIHRodW1ibmFpbERhdGFcbiAgICAvLyBDaGVjayBmb3IgdGhlIEFTQ0lJIGNvZGUgZm9yIFwiRXhpZlwiICgweDQ1Nzg2OTY2KTpcbiAgICBpZiAoZGF0YVZpZXcuZ2V0VWludDMyKG9mZnNldCArIDQpICE9PSAweDQ1Nzg2OTY2KSB7XG4gICAgICAvLyBObyBFeGlmIGRhdGEsIG1pZ2h0IGJlIFhNUCBkYXRhIGluc3RlYWRcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAodGlmZk9mZnNldCArIDggPiBkYXRhVmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBFeGlmIGRhdGE6IEludmFsaWQgc2VnbWVudCBzaXplLicpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgLy8gQ2hlY2sgZm9yIHRoZSB0d28gbnVsbCBieXRlczpcbiAgICBpZiAoZGF0YVZpZXcuZ2V0VWludDE2KG9mZnNldCArIDgpICE9PSAweDAwMDApIHtcbiAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIEV4aWYgZGF0YTogTWlzc2luZyBieXRlIGFsaWdubWVudCBvZmZzZXQuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICAvLyBDaGVjayB0aGUgYnl0ZSBhbGlnbm1lbnQ6XG4gICAgc3dpdGNoIChkYXRhVmlldy5nZXRVaW50MTYodGlmZk9mZnNldCkpIHtcbiAgICAgIGNhc2UgMHg0OTQ5OlxuICAgICAgICBsaXR0bGVFbmRpYW4gPSB0cnVlXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDB4NEQ0RDpcbiAgICAgICAgbGl0dGxlRW5kaWFuID0gZmFsc2VcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIEV4aWYgZGF0YTogSW52YWxpZCBieXRlIGFsaWdubWVudCBtYXJrZXIuJylcbiAgICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIENoZWNrIGZvciB0aGUgVElGRiB0YWcgbWFya2VyICgweDAwMkEpOlxuICAgIGlmIChkYXRhVmlldy5nZXRVaW50MTYodGlmZk9mZnNldCArIDIsIGxpdHRsZUVuZGlhbikgIT09IDB4MDAyQSkge1xuICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgRXhpZiBkYXRhOiBNaXNzaW5nIFRJRkYgbWFya2VyLicpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgLy8gUmV0cmlldmUgdGhlIGRpcmVjdG9yeSBvZmZzZXQgYnl0ZXMsIHVzdWFsbHkgMHgwMDAwMDAwOCBvciA4IGRlY2ltYWw6XG4gICAgZGlyT2Zmc2V0ID0gZGF0YVZpZXcuZ2V0VWludDMyKHRpZmZPZmZzZXQgKyA0LCBsaXR0bGVFbmRpYW4pXG4gICAgLy8gQ3JlYXRlIHRoZSBleGlmIG9iamVjdCB0byBzdG9yZSB0aGUgdGFnczpcbiAgICBkYXRhLmV4aWYgPSBuZXcgbG9hZEltYWdlLkV4aWZNYXAoKVxuICAgIC8vIFBhcnNlIHRoZSB0YWdzIG9mIHRoZSBtYWluIGltYWdlIGRpcmVjdG9yeSBhbmQgcmV0cmlldmUgdGhlXG4gICAgLy8gb2Zmc2V0IHRvIHRoZSBuZXh0IGRpcmVjdG9yeSwgdXN1YWxseSB0aGUgdGh1bWJuYWlsIGRpcmVjdG9yeTpcbiAgICBkaXJPZmZzZXQgPSBsb2FkSW1hZ2UucGFyc2VFeGlmVGFncyhcbiAgICAgIGRhdGFWaWV3LFxuICAgICAgdGlmZk9mZnNldCxcbiAgICAgIHRpZmZPZmZzZXQgKyBkaXJPZmZzZXQsXG4gICAgICBsaXR0bGVFbmRpYW4sXG4gICAgICBkYXRhXG4gICAgKVxuICAgIGlmIChkaXJPZmZzZXQgJiYgIW9wdGlvbnMuZGlzYWJsZUV4aWZUaHVtYm5haWwpIHtcbiAgICAgIHRodW1ibmFpbERhdGEgPSB7ZXhpZjoge319XG4gICAgICBkaXJPZmZzZXQgPSBsb2FkSW1hZ2UucGFyc2VFeGlmVGFncyhcbiAgICAgICAgZGF0YVZpZXcsXG4gICAgICAgIHRpZmZPZmZzZXQsXG4gICAgICAgIHRpZmZPZmZzZXQgKyBkaXJPZmZzZXQsXG4gICAgICAgIGxpdHRsZUVuZGlhbixcbiAgICAgICAgdGh1bWJuYWlsRGF0YVxuICAgICAgKVxuICAgICAgLy8gQ2hlY2sgZm9yIEpQRUcgVGh1bWJuYWlsIG9mZnNldDpcbiAgICAgIGlmICh0aHVtYm5haWxEYXRhLmV4aWZbMHgwMjAxXSkge1xuICAgICAgICBkYXRhLmV4aWYuVGh1bWJuYWlsID0gbG9hZEltYWdlLmdldEV4aWZUaHVtYm5haWwoXG4gICAgICAgICAgZGF0YVZpZXcsXG4gICAgICAgICAgdGlmZk9mZnNldCArIHRodW1ibmFpbERhdGEuZXhpZlsweDAyMDFdLFxuICAgICAgICAgIHRodW1ibmFpbERhdGEuZXhpZlsweDAyMDJdIC8vIFRodW1ibmFpbCBkYXRhIGxlbmd0aFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuICAgIC8vIENoZWNrIGZvciBFeGlmIFN1YiBJRkQgUG9pbnRlcjpcbiAgICBpZiAoZGF0YS5leGlmWzB4ODc2OV0gJiYgIW9wdGlvbnMuZGlzYWJsZUV4aWZTdWIpIHtcbiAgICAgIGxvYWRJbWFnZS5wYXJzZUV4aWZUYWdzKFxuICAgICAgICBkYXRhVmlldyxcbiAgICAgICAgdGlmZk9mZnNldCxcbiAgICAgICAgdGlmZk9mZnNldCArIGRhdGEuZXhpZlsweDg3NjldLCAvLyBkaXJlY3Rvcnkgb2Zmc2V0XG4gICAgICAgIGxpdHRsZUVuZGlhbixcbiAgICAgICAgZGF0YVxuICAgICAgKVxuICAgIH1cbiAgICAvLyBDaGVjayBmb3IgR1BTIEluZm8gSUZEIFBvaW50ZXI6XG4gICAgaWYgKGRhdGEuZXhpZlsweDg4MjVdICYmICFvcHRpb25zLmRpc2FibGVFeGlmR3BzKSB7XG4gICAgICBsb2FkSW1hZ2UucGFyc2VFeGlmVGFncyhcbiAgICAgICAgZGF0YVZpZXcsXG4gICAgICAgIHRpZmZPZmZzZXQsXG4gICAgICAgIHRpZmZPZmZzZXQgKyBkYXRhLmV4aWZbMHg4ODI1XSwgLy8gZGlyZWN0b3J5IG9mZnNldFxuICAgICAgICBsaXR0bGVFbmRpYW4sXG4gICAgICAgIGRhdGFcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICAvLyBSZWdpc3RlcnMgdGhlIEV4aWYgcGFyc2VyIGZvciB0aGUgQVBQMSBKUEVHIG1ldGEgZGF0YSBzZWdtZW50OlxuICBsb2FkSW1hZ2UubWV0YURhdGFQYXJzZXJzLmpwZWdbMHhmZmUxXS5wdXNoKGxvYWRJbWFnZS5wYXJzZUV4aWZEYXRhKVxuXG4gIC8vIEFkZHMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzIHRvIHRoZSBwYXJzZU1ldGFEYXRhIGNhbGxiYWNrIGRhdGE6XG4gIC8vICogZXhpZjogVGhlIGV4aWYgdGFncywgcGFyc2VkIGJ5IHRoZSBwYXJzZUV4aWZEYXRhIG1ldGhvZFxuXG4gIC8vIEFkZHMgdGhlIGZvbGxvd2luZyBvcHRpb25zIHRvIHRoZSBwYXJzZU1ldGFEYXRhIG1ldGhvZDpcbiAgLy8gKiBkaXNhYmxlRXhpZjogRGlzYWJsZXMgRXhpZiBwYXJzaW5nLlxuICAvLyAqIGRpc2FibGVFeGlmVGh1bWJuYWlsOiBEaXNhYmxlcyBwYXJzaW5nIG9mIHRoZSBFeGlmIFRodW1ibmFpbC5cbiAgLy8gKiBkaXNhYmxlRXhpZlN1YjogRGlzYWJsZXMgcGFyc2luZyBvZiB0aGUgRXhpZiBTdWIgSUZELlxuICAvLyAqIGRpc2FibGVFeGlmR3BzOiBEaXNhYmxlcyBwYXJzaW5nIG9mIHRoZSBFeGlmIEdQUyBJbmZvIElGRC5cbn0pKVxuIiwiLypcbiAqIEphdmFTY3JpcHQgTG9hZCBJbWFnZSBNZXRhXG4gKiBodHRwczovL2dpdGh1Yi5jb20vYmx1ZWltcC9KYXZhU2NyaXB0LUxvYWQtSW1hZ2VcbiAqXG4gKiBDb3B5cmlnaHQgMjAxMywgU2ViYXN0aWFuIFRzY2hhblxuICogaHR0cHM6Ly9ibHVlaW1wLm5ldFxuICpcbiAqIEltYWdlIG1ldGEgZGF0YSBoYW5kbGluZyBpbXBsZW1lbnRhdGlvblxuICogYmFzZWQgb24gdGhlIGhlbHAgYW5kIGNvbnRyaWJ1dGlvbiBvZlxuICogQWNoaW0gU3TDtmhyLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZTpcbiAqIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXG4gKi9cblxuICAvKmdsb2JhbCBkZWZpbmUsIG1vZHVsZSwgcmVxdWlyZSwgd2luZG93LCBEYXRhVmlldywgQmxvYiwgVWludDhBcnJheSwgY29uc29sZSAqLyhmdW5jdGlvbiAoZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCc7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgQU1EIG1vZHVsZTpcbiAgICBkZWZpbmUoWycuL2xvYWQtaW1hZ2UnXSwgZmFjdG9yeSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICBmYWN0b3J5KHJlcXVpcmUoJy4vbG9hZC1pbWFnZScpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHM6XG4gICAgZmFjdG9yeSh3aW5kb3cubG9hZEltYWdlKTtcbiAgfVxufShmdW5jdGlvbiAobG9hZEltYWdlKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgaGFzYmxvYlNsaWNlID0gd2luZG93LkJsb2IgJiYgKEJsb2IucHJvdG90eXBlLnNsaWNlIHx8XG4gICAgQmxvYi5wcm90b3R5cGUud2Via2l0U2xpY2UgfHwgQmxvYi5wcm90b3R5cGUubW96U2xpY2UpO1xuXG4gIGxvYWRJbWFnZS5ibG9iU2xpY2UgPSBoYXNibG9iU2xpY2UgJiYgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHNsaWNlID0gdGhpcy5zbGljZSB8fCB0aGlzLndlYmtpdFNsaWNlIHx8IHRoaXMubW96U2xpY2U7XG4gICAgICByZXR1cm4gc2xpY2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfTtcblxuICBsb2FkSW1hZ2UubWV0YURhdGFQYXJzZXJzID0ge1xuICAgIGpwZWc6IHtcbiAgICAgIC8vIDB4ZmZlMDogW10sIC8vIEFQUDAgbWFya2VyXG4gICAgICAweGZmZTE6IFtdLCAvLyBBUFAxIG1hcmtlclxuICAgICAgLy8gMHhmZmUyOiBbXSwgLy8gQVBQMiBtYXJrZXJcbiAgICAgIC8vIDB4ZmZlMzogW10sIC8vIEFQUDMgbWFya2VyXG4gICAgICAvLyAweGZmZWM6IFtdLCAvLyBBUFAxMiBtYXJrZXJcbiAgICAgIC8vIDB4ZmZlZDogW10sIC8vIEFQUDEzIG1hcmtlclxuICAgICAgLy8gMHhmZmVlOiBbXSwgLy8gQVBQMTQgbWFya2VyXG4gICAgfVxuICB9O1xuXG4gIC8vIFBhcnNlcyBpbWFnZSBtZXRhIGRhdGEgYW5kIGNhbGxzIHRoZSBjYWxsYmFjayB3aXRoIGFuIG9iamVjdCBhcmd1bWVudFxuICAvLyB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgLy8gKiBpbWFnZUhlYWQ6IFRoZSBjb21wbGV0ZSBpbWFnZSBoZWFkIGFzIEFycmF5QnVmZmVyIChVaW50OEFycmF5IGZvciBJRTEwKVxuICAvLyBUaGUgb3B0aW9ucyBhcmd1bWVudHMgYWNjZXB0cyBhbiBvYmplY3QgYW5kIHN1cHBvcnRzIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgLy8gKiBtYXhNZXRhRGF0YVNpemU6IERlZmluZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGJ5dGVzIHRvIHBhcnNlLlxuICAvLyAqIGRpc2FibGVJbWFnZUhlYWQ6IERpc2FibGVzIGNyZWF0aW5nIHRoZSBpbWFnZUhlYWQgcHJvcGVydHkuXG4gIGxvYWRJbWFnZS5wYXJzZU1ldGFEYXRhID0gZnVuY3Rpb24gKGZpbGUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIC8vIDI1NiBLaUIgc2hvdWxkIGNvbnRhaW4gYWxsIEVYSUYvSUNDL0lQVEMgc2VnbWVudHM6XG4gICAgdmFyIG1heE1ldGFEYXRhU2l6ZSA9IG9wdGlvbnMubWF4TWV0YURhdGFTaXplIHx8IDI2MjE0NDtcbiAgICBtYXhNZXRhRGF0YVNpemUgPSBNYXRoLm1pbihmaWxlLnNpemUsIG1heE1ldGFEYXRhU2l6ZSk7XG4gICAgdmFyIGRhdGEgPSB7fTtcbiAgICB2YXIgbm9NZXRhRGF0YSA9ICEod2luZG93LkRhdGFWaWV3ICYmIGZpbGUgJiYgZmlsZS5zaXplID49IDEyICYmXG4gICAgICBmaWxlLnR5cGUgPT09ICdpbWFnZS9qcGVnJyAmJiBsb2FkSW1hZ2UuYmxvYlNsaWNlKTtcbiAgICBpZiAobm9NZXRhRGF0YSB8fCAhbG9hZEltYWdlLnJlYWRGaWxlKFxuICAgICAgICBsb2FkSW1hZ2UuYmxvYlNsaWNlLmNhbGwoZmlsZSwgMCwgbWF4TWV0YURhdGFTaXplKSxcbiAgICAgICAgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICBpZiAoZS50YXJnZXQuZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEZpbGVSZWFkZXIgZXJyb3JcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGUudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBOb3RlIG9uIGVuZGlhbm5lc3M6XG4gICAgICAgICAgLy8gU2luY2UgdGhlIG1hcmtlciBhbmQgbGVuZ3RoIGJ5dGVzIGluIEpQRUcgZmlsZXMgYXJlIGFsd2F5c1xuICAgICAgICAgIC8vIHN0b3JlZCBpbiBiaWcgZW5kaWFuIG9yZGVyLCB3ZSBjYW4gbGVhdmUgdGhlIGVuZGlhbiBwYXJhbWV0ZXJcbiAgICAgICAgICAvLyBvZiB0aGUgRGF0YVZpZXcgbWV0aG9kcyB1bmRlZmluZWQsIGRlZmF1bHRpbmcgdG8gYmlnIGVuZGlhbi5cbiAgICAgICAgICB2YXIgYnVmZmVyID0gZS50YXJnZXQucmVzdWx0O1xuICAgICAgICAgIHZhciBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgICAgICAgIHZhciBvZmZzZXQgPSAyO1xuICAgICAgICAgIHZhciBtYXhPZmZzZXQgPSBkYXRhVmlldy5ieXRlTGVuZ3RoIC0gNDtcbiAgICAgICAgICB2YXIgaGVhZExlbmd0aCA9IG9mZnNldDtcbiAgICAgICAgICB2YXIgbWFya2VyQnl0ZXM7XG4gICAgICAgICAgdmFyIG1hcmtlckxlbmd0aDtcbiAgICAgICAgICB2YXIgcGFyc2VycztcbiAgICAgICAgICB2YXIgaTtcbiAgICAgICAgICAvLyBDaGVjayBmb3IgdGhlIEpQRUcgbWFya2VyICgweGZmZDgpOlxuICAgICAgICAgIGlmIChkYXRhVmlldy5nZXRVaW50MTYoMCkgPT09IDB4ZmZkOCkge1xuICAgICAgICAgICAgd2hpbGUgKG9mZnNldCA8IG1heE9mZnNldCkge1xuICAgICAgICAgICAgICBtYXJrZXJCeXRlcyA9IGRhdGFWaWV3LmdldFVpbnQxNihvZmZzZXQpO1xuICAgICAgICAgICAgICAvLyBTZWFyY2ggZm9yIEFQUG4gKDB4ZmZlTikgYW5kIENPTSAoMHhmZmZlKSBtYXJrZXJzLFxuICAgICAgICAgICAgICAvLyB3aGljaCBjb250YWluIGFwcGxpY2F0aW9uLXNwZWNpZmljIG1ldGEtZGF0YSBsaWtlXG4gICAgICAgICAgICAgIC8vIEV4aWYsIElDQyBhbmQgSVBUQyBkYXRhIGFuZCB0ZXh0IGNvbW1lbnRzOlxuICAgICAgICAgICAgICBpZiAoKG1hcmtlckJ5dGVzID49IDB4ZmZlMCAmJiBtYXJrZXJCeXRlcyA8PSAweGZmZWQpIHx8XG4gICAgICAgICAgICAgICAgbWFya2VyQnl0ZXMgPT09IDB4ZmZmZSkge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBtYXJrZXIgYnl0ZXMgKDIpIGFyZSBhbHdheXMgZm9sbG93ZWQgYnlcbiAgICAgICAgICAgICAgICAvLyB0aGUgbGVuZ3RoIGJ5dGVzICgyKSwgaW5kaWNhdGluZyB0aGUgbGVuZ3RoIG9mIHRoZVxuICAgICAgICAgICAgICAgIC8vIG1hcmtlciBzZWdtZW50LCB3aGljaCBpbmNsdWRlcyB0aGUgbGVuZ3RoIGJ5dGVzLFxuICAgICAgICAgICAgICAgIC8vIGJ1dCBub3QgdGhlIG1hcmtlciBieXRlcywgc28gd2UgYWRkIDI6XG4gICAgICAgICAgICAgICAgbWFya2VyTGVuZ3RoID0gZGF0YVZpZXcuZ2V0VWludDE2KG9mZnNldCArIDIpICsgMjtcblxuICAgICAgICAgICAgICAgIGlmIChvZmZzZXQgKyBtYXJrZXJMZW5ndGggPiBkYXRhVmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBtZXRhIGRhdGE6IEludmFsaWQgc2VnbWVudCBzaXplLicpO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcGFyc2VycyA9IGxvYWRJbWFnZS5tZXRhRGF0YVBhcnNlcnMuanBlZ1ttYXJrZXJCeXRlc107XG5cbiAgICAgICAgICAgICAgICBpZiAocGFyc2Vycykge1xuICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHBhcnNlcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyc2Vyc1tpXS5jYWxsKFxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQsXG4gICAgICAgICAgICAgICAgICAgICAgZGF0YVZpZXcsXG4gICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICAgIG1hcmtlckxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbWFya2VyTGVuZ3RoO1xuICAgICAgICAgICAgICAgIGhlYWRMZW5ndGggPSBvZmZzZXQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm90IGFuIEFQUG4gb3IgQ09NIG1hcmtlciwgcHJvYmFibHkgc2FmZSB0b1xuICAgICAgICAgICAgICAgIC8vIGFzc3VtZSB0aGF0IHRoaXMgaXMgdGhlIGVuZCBvZiB0aGUgbWV0YSBkYXRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE1ldGEgbGVuZ3RoIG11c3QgYmUgbG9uZ2VyIHRoYW4gSlBFRyBtYXJrZXIgKDIpXG4gICAgICAgICAgICAvLyBwbHVzIEFQUG4gbWFya2VyICgyKSwgZm9sbG93ZWQgYnkgbGVuZ3RoIGJ5dGVzICgyKTpcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5kaXNhYmxlSW1hZ2VIZWFkICYmIGhlYWRMZW5ndGggPiA2KSB7XG4gICAgICAgICAgICAgIGlmIChidWZmZXIuc2xpY2UpIHtcbiAgICAgICAgICAgICAgICBkYXRhLmltYWdlSGVhZCA9IGJ1ZmZlci5zbGljZSgwLCBoZWFkTGVuZ3RoKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXb3JrYXJvdW5kIGZvciBJRTEwLCB3aGljaCBkb2VzIG5vdCB5ZXRcbiAgICAgICAgICAgICAgICAvLyBzdXBwb3J0IEFycmF5QnVmZmVyLnNsaWNlOlxuICAgICAgICAgICAgICAgIGRhdGEuaW1hZ2VIZWFkID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKVxuICAgICAgICAgICAgICAgICAgLnN1YmFycmF5KDAsIGhlYWRMZW5ndGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIEpQRUcgZmlsZTogTWlzc2luZyBKUEVHIG1hcmtlci4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgIH0sXG4gICAgICAgICdyZWFkQXNBcnJheUJ1ZmZlcidcbiAgICAgICkpIHtcbiAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgIH1cbiAgfTtcbn0pKTtcbiIsIi8qXG4gKiBKYXZhU2NyaXB0IExvYWQgSW1hZ2UgT3JpZW50YXRpb25cbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTG9hZC1JbWFnZVxuICpcbiAqIENvcHlyaWdodCAyMDEzLCBTZWJhc3RpYW4gVHNjaGFuXG4gKiBodHRwczovL2JsdWVpbXAubmV0XG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmUsIG1vZHVsZSwgcmVxdWlyZSwgd2luZG93ICovXG5cbjsoZnVuY3Rpb24gKGZhY3RvcnkpIHtcbiAgJ3VzZSBzdHJpY3QnXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgQU1EIG1vZHVsZTpcbiAgICBkZWZpbmUoWycuL2xvYWQtaW1hZ2UnXSwgZmFjdG9yeSlcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIGZhY3RvcnkocmVxdWlyZSgnLi9sb2FkLWltYWdlJykpXG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzOlxuICAgIGZhY3Rvcnkod2luZG93LmxvYWRJbWFnZSlcbiAgfVxufShmdW5jdGlvbiAobG9hZEltYWdlKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIHZhciBvcmlnaW5hbEhhc0NhbnZhc09wdGlvbiA9IGxvYWRJbWFnZS5oYXNDYW52YXNPcHRpb25cbiAgdmFyIG9yaWdpbmFsVHJhbnNmb3JtQ29vcmRpbmF0ZXMgPSBsb2FkSW1hZ2UudHJhbnNmb3JtQ29vcmRpbmF0ZXNcbiAgdmFyIG9yaWdpbmFsR2V0VHJhbnNmb3JtZWRPcHRpb25zID0gbG9hZEltYWdlLmdldFRyYW5zZm9ybWVkT3B0aW9uc1xuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHRoZSB0YXJnZXQgaW1hZ2VcbiAgLy8gc2hvdWxkIGJlIGEgY2FudmFzIGVsZW1lbnQ6XG4gIGxvYWRJbWFnZS5oYXNDYW52YXNPcHRpb24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiAhIW9wdGlvbnMub3JpZW50YXRpb24gfHxcbiAgICAgIG9yaWdpbmFsSGFzQ2FudmFzT3B0aW9uLmNhbGwobG9hZEltYWdlLCBvcHRpb25zKVxuICB9XG5cbiAgLy8gVHJhbnNmb3JtIGltYWdlIG9yaWVudGF0aW9uIGJhc2VkIG9uXG4gIC8vIHRoZSBnaXZlbiBFWElGIG9yaWVudGF0aW9uIG9wdGlvbjpcbiAgbG9hZEltYWdlLnRyYW5zZm9ybUNvb3JkaW5hdGVzID0gZnVuY3Rpb24gKGNhbnZhcywgb3B0aW9ucykge1xuICAgIG9yaWdpbmFsVHJhbnNmb3JtQ29vcmRpbmF0ZXMuY2FsbChsb2FkSW1hZ2UsIGNhbnZhcywgb3B0aW9ucylcbiAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcbiAgICB2YXIgd2lkdGggPSBjYW52YXMud2lkdGhcbiAgICB2YXIgaGVpZ2h0ID0gY2FudmFzLmhlaWdodFxuICAgIHZhciBzdHlsZVdpZHRoID0gY2FudmFzLnN0eWxlLndpZHRoXG4gICAgdmFyIHN0eWxlSGVpZ2h0ID0gY2FudmFzLnN0eWxlLmhlaWdodFxuICAgIHZhciBvcmllbnRhdGlvbiA9IG9wdGlvbnMub3JpZW50YXRpb25cbiAgICBpZiAoIW9yaWVudGF0aW9uIHx8IG9yaWVudGF0aW9uID4gOCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChvcmllbnRhdGlvbiA+IDQpIHtcbiAgICAgIGNhbnZhcy53aWR0aCA9IGhlaWdodFxuICAgICAgY2FudmFzLmhlaWdodCA9IHdpZHRoXG4gICAgICBjYW52YXMuc3R5bGUud2lkdGggPSBzdHlsZUhlaWdodFxuICAgICAgY2FudmFzLnN0eWxlLmhlaWdodCA9IHN0eWxlV2lkdGhcbiAgICB9XG4gICAgc3dpdGNoIChvcmllbnRhdGlvbikge1xuICAgICAgY2FzZSAyOlxuICAgICAgICAvLyBob3Jpem9udGFsIGZsaXBcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSh3aWR0aCwgMClcbiAgICAgICAgY3R4LnNjYWxlKC0xLCAxKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAzOlxuICAgICAgICAvLyAxODDCsCByb3RhdGUgbGVmdFxuICAgICAgICBjdHgudHJhbnNsYXRlKHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIGN0eC5yb3RhdGUoTWF0aC5QSSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNDpcbiAgICAgICAgLy8gdmVydGljYWwgZmxpcFxuICAgICAgICBjdHgudHJhbnNsYXRlKDAsIGhlaWdodClcbiAgICAgICAgY3R4LnNjYWxlKDEsIC0xKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA1OlxuICAgICAgICAvLyB2ZXJ0aWNhbCBmbGlwICsgOTAgcm90YXRlIHJpZ2h0XG4gICAgICAgIGN0eC5yb3RhdGUoMC41ICogTWF0aC5QSSlcbiAgICAgICAgY3R4LnNjYWxlKDEsIC0xKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA2OlxuICAgICAgICAvLyA5MMKwIHJvdGF0ZSByaWdodFxuICAgICAgICBjdHgucm90YXRlKDAuNSAqIE1hdGguUEkpXG4gICAgICAgIGN0eC50cmFuc2xhdGUoMCwgLWhlaWdodClcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNzpcbiAgICAgICAgLy8gaG9yaXpvbnRhbCBmbGlwICsgOTAgcm90YXRlIHJpZ2h0XG4gICAgICAgIGN0eC5yb3RhdGUoMC41ICogTWF0aC5QSSlcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSh3aWR0aCwgLWhlaWdodClcbiAgICAgICAgY3R4LnNjYWxlKC0xLCAxKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSA4OlxuICAgICAgICAvLyA5MMKwIHJvdGF0ZSBsZWZ0XG4gICAgICAgIGN0eC5yb3RhdGUoLTAuNSAqIE1hdGguUEkpXG4gICAgICAgIGN0eC50cmFuc2xhdGUoLXdpZHRoLCAwKVxuICAgICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIC8vIFRyYW5zZm9ybXMgY29vcmRpbmF0ZSBhbmQgZGltZW5zaW9uIG9wdGlvbnNcbiAgLy8gYmFzZWQgb24gdGhlIGdpdmVuIG9yaWVudGF0aW9uIG9wdGlvbjpcbiAgbG9hZEltYWdlLmdldFRyYW5zZm9ybWVkT3B0aW9ucyA9IGZ1bmN0aW9uIChpbWcsIG9wdHMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IG9yaWdpbmFsR2V0VHJhbnNmb3JtZWRPcHRpb25zLmNhbGwobG9hZEltYWdlLCBpbWcsIG9wdHMpXG4gICAgdmFyIG9yaWVudGF0aW9uID0gb3B0aW9ucy5vcmllbnRhdGlvblxuICAgIHZhciBuZXdPcHRpb25zXG4gICAgdmFyIGlcbiAgICBpZiAoIW9yaWVudGF0aW9uIHx8IG9yaWVudGF0aW9uID4gOCB8fCBvcmllbnRhdGlvbiA9PT0gMSkge1xuICAgICAgcmV0dXJuIG9wdGlvbnNcbiAgICB9XG4gICAgbmV3T3B0aW9ucyA9IHt9XG4gICAgZm9yIChpIGluIG9wdGlvbnMpIHtcbiAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIG5ld09wdGlvbnNbaV0gPSBvcHRpb25zW2ldXG4gICAgICB9XG4gICAgfVxuICAgIHN3aXRjaCAob3B0aW9ucy5vcmllbnRhdGlvbikge1xuICAgICAgY2FzZSAyOlxuICAgICAgICAvLyBob3Jpem9udGFsIGZsaXBcbiAgICAgICAgbmV3T3B0aW9ucy5sZWZ0ID0gb3B0aW9ucy5yaWdodFxuICAgICAgICBuZXdPcHRpb25zLnJpZ2h0ID0gb3B0aW9ucy5sZWZ0XG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDM6XG4gICAgICAgIC8vIDE4MMKwIHJvdGF0ZSBsZWZ0XG4gICAgICAgIG5ld09wdGlvbnMubGVmdCA9IG9wdGlvbnMucmlnaHRcbiAgICAgICAgbmV3T3B0aW9ucy50b3AgPSBvcHRpb25zLmJvdHRvbVxuICAgICAgICBuZXdPcHRpb25zLnJpZ2h0ID0gb3B0aW9ucy5sZWZ0XG4gICAgICAgIG5ld09wdGlvbnMuYm90dG9tID0gb3B0aW9ucy50b3BcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNDpcbiAgICAgICAgLy8gdmVydGljYWwgZmxpcFxuICAgICAgICBuZXdPcHRpb25zLnRvcCA9IG9wdGlvbnMuYm90dG9tXG4gICAgICAgIG5ld09wdGlvbnMuYm90dG9tID0gb3B0aW9ucy50b3BcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNTpcbiAgICAgICAgLy8gdmVydGljYWwgZmxpcCArIDkwIHJvdGF0ZSByaWdodFxuICAgICAgICBuZXdPcHRpb25zLmxlZnQgPSBvcHRpb25zLnRvcFxuICAgICAgICBuZXdPcHRpb25zLnRvcCA9IG9wdGlvbnMubGVmdFxuICAgICAgICBuZXdPcHRpb25zLnJpZ2h0ID0gb3B0aW9ucy5ib3R0b21cbiAgICAgICAgbmV3T3B0aW9ucy5ib3R0b20gPSBvcHRpb25zLnJpZ2h0XG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIDY6XG4gICAgICAgIC8vIDkwwrAgcm90YXRlIHJpZ2h0XG4gICAgICAgIG5ld09wdGlvbnMubGVmdCA9IG9wdGlvbnMudG9wXG4gICAgICAgIG5ld09wdGlvbnMudG9wID0gb3B0aW9ucy5yaWdodFxuICAgICAgICBuZXdPcHRpb25zLnJpZ2h0ID0gb3B0aW9ucy5ib3R0b21cbiAgICAgICAgbmV3T3B0aW9ucy5ib3R0b20gPSBvcHRpb25zLmxlZnRcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgNzpcbiAgICAgICAgLy8gaG9yaXpvbnRhbCBmbGlwICsgOTAgcm90YXRlIHJpZ2h0XG4gICAgICAgIG5ld09wdGlvbnMubGVmdCA9IG9wdGlvbnMuYm90dG9tXG4gICAgICAgIG5ld09wdGlvbnMudG9wID0gb3B0aW9ucy5yaWdodFxuICAgICAgICBuZXdPcHRpb25zLnJpZ2h0ID0gb3B0aW9ucy50b3BcbiAgICAgICAgbmV3T3B0aW9ucy5ib3R0b20gPSBvcHRpb25zLmxlZnRcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgODpcbiAgICAgICAgLy8gOTDCsCByb3RhdGUgbGVmdFxuICAgICAgICBuZXdPcHRpb25zLmxlZnQgPSBvcHRpb25zLmJvdHRvbVxuICAgICAgICBuZXdPcHRpb25zLnRvcCA9IG9wdGlvbnMubGVmdFxuICAgICAgICBuZXdPcHRpb25zLnJpZ2h0ID0gb3B0aW9ucy50b3BcbiAgICAgICAgbmV3T3B0aW9ucy5ib3R0b20gPSBvcHRpb25zLnJpZ2h0XG4gICAgICAgIGJyZWFrXG4gICAgfVxuICAgIGlmIChvcHRpb25zLm9yaWVudGF0aW9uID4gNCkge1xuICAgICAgbmV3T3B0aW9ucy5tYXhXaWR0aCA9IG9wdGlvbnMubWF4SGVpZ2h0XG4gICAgICBuZXdPcHRpb25zLm1heEhlaWdodCA9IG9wdGlvbnMubWF4V2lkdGhcbiAgICAgIG5ld09wdGlvbnMubWluV2lkdGggPSBvcHRpb25zLm1pbkhlaWdodFxuICAgICAgbmV3T3B0aW9ucy5taW5IZWlnaHQgPSBvcHRpb25zLm1pbldpZHRoXG4gICAgICBuZXdPcHRpb25zLnNvdXJjZVdpZHRoID0gb3B0aW9ucy5zb3VyY2VIZWlnaHRcbiAgICAgIG5ld09wdGlvbnMuc291cmNlSGVpZ2h0ID0gb3B0aW9ucy5zb3VyY2VXaWR0aFxuICAgIH1cbiAgICByZXR1cm4gbmV3T3B0aW9uc1xuICB9XG59KSlcbiIsIi8qXG4gKiBKYXZhU2NyaXB0IExvYWQgSW1hZ2VcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9ibHVlaW1wL0phdmFTY3JpcHQtTG9hZC1JbWFnZVxuICpcbiAqIENvcHlyaWdodCAyMDExLCBTZWJhc3RpYW4gVHNjaGFuXG4gKiBodHRwczovL2JsdWVpbXAubmV0XG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmUsIG1vZHVsZSwgd2luZG93LCBkb2N1bWVudCwgVVJMLCB3ZWJraXRVUkwsIEZpbGVSZWFkZXIgKi9cblxuOyhmdW5jdGlvbiAoJCkge1xuICAndXNlIHN0cmljdCdcblxuICAvLyBMb2FkcyBhbiBpbWFnZSBmb3IgYSBnaXZlbiBGaWxlIG9iamVjdC5cbiAgLy8gSW52b2tlcyB0aGUgY2FsbGJhY2sgd2l0aCBhbiBpbWcgb3Igb3B0aW9uYWwgY2FudmFzXG4gIC8vIGVsZW1lbnQgKGlmIHN1cHBvcnRlZCBieSB0aGUgYnJvd3NlcikgYXMgcGFyYW1ldGVyOlxuICB2YXIgbG9hZEltYWdlID0gZnVuY3Rpb24gKGZpbGUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgdmFyIGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpXG4gICAgdmFyIHVybFxuICAgIHZhciBvVXJsXG4gICAgaW1nLm9uZXJyb3IgPSBjYWxsYmFja1xuICAgIGltZy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAob1VybCAmJiAhKG9wdGlvbnMgJiYgb3B0aW9ucy5ub1Jldm9rZSkpIHtcbiAgICAgICAgbG9hZEltYWdlLnJldm9rZU9iamVjdFVSTChvVXJsKVxuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGxvYWRJbWFnZS5zY2FsZShpbWcsIG9wdGlvbnMpKVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobG9hZEltYWdlLmlzSW5zdGFuY2VPZignQmxvYicsIGZpbGUpIHx8XG4gICAgICAvLyBGaWxlcyBhcmUgYWxzbyBCbG9iIGluc3RhbmNlcywgYnV0IHNvbWUgYnJvd3NlcnNcbiAgICAgIC8vIChGaXJlZm94IDMuNikgc3VwcG9ydCB0aGUgRmlsZSBBUEkgYnV0IG5vdCBCbG9iczpcbiAgICAgIGxvYWRJbWFnZS5pc0luc3RhbmNlT2YoJ0ZpbGUnLCBmaWxlKSkge1xuICAgICAgdXJsID0gb1VybCA9IGxvYWRJbWFnZS5jcmVhdGVPYmplY3RVUkwoZmlsZSlcbiAgICAgIC8vIFN0b3JlIHRoZSBmaWxlIHR5cGUgZm9yIHJlc2l6ZSBwcm9jZXNzaW5nOlxuICAgICAgaW1nLl90eXBlID0gZmlsZS50eXBlXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZmlsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHVybCA9IGZpbGVcbiAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuY3Jvc3NPcmlnaW4pIHtcbiAgICAgICAgaW1nLmNyb3NzT3JpZ2luID0gb3B0aW9ucy5jcm9zc09yaWdpblxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYgKHVybCkge1xuICAgICAgaW1nLnNyYyA9IHVybFxuICAgICAgcmV0dXJuIGltZ1xuICAgIH1cbiAgICByZXR1cm4gbG9hZEltYWdlLnJlYWRGaWxlKGZpbGUsIGZ1bmN0aW9uIChlKSB7XG4gICAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXRcbiAgICAgIGlmICh0YXJnZXQgJiYgdGFyZ2V0LnJlc3VsdCkge1xuICAgICAgICBpbWcuc3JjID0gdGFyZ2V0LnJlc3VsdFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2soZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pXG4gIH1cbiAgLy8gVGhlIGNoZWNrIGZvciBVUkwucmV2b2tlT2JqZWN0VVJMIGZpeGVzIGFuIGlzc3VlIHdpdGggT3BlcmEgMTIsXG4gIC8vIHdoaWNoIHByb3ZpZGVzIFVSTC5jcmVhdGVPYmplY3RVUkwgYnV0IGRvZXNuJ3QgcHJvcGVybHkgaW1wbGVtZW50IGl0OlxuICB2YXIgdXJsQVBJID0gKHdpbmRvdy5jcmVhdGVPYmplY3RVUkwgJiYgd2luZG93KSB8fFxuICAgICAgICAgICAgICAgICh3aW5kb3cuVVJMICYmIFVSTC5yZXZva2VPYmplY3RVUkwgJiYgVVJMKSB8fFxuICAgICAgICAgICAgICAgICh3aW5kb3cud2Via2l0VVJMICYmIHdlYmtpdFVSTClcblxuICBsb2FkSW1hZ2UuaXNJbnN0YW5jZU9mID0gZnVuY3Rpb24gKHR5cGUsIG9iaikge1xuICAgIC8vIENyb3NzLWZyYW1lIGluc3RhbmNlb2YgY2hlY2tcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0ICcgKyB0eXBlICsgJ10nXG4gIH1cblxuICAvLyBUcmFuc2Zvcm0gaW1hZ2UgY29vcmRpbmF0ZXMsIGFsbG93cyB0byBvdmVycmlkZSBlLmcuXG4gIC8vIHRoZSBjYW52YXMgb3JpZW50YXRpb24gYmFzZWQgb24gdGhlIG9yaWVudGF0aW9uIG9wdGlvbixcbiAgLy8gZ2V0cyBjYW52YXMsIG9wdGlvbnMgcGFzc2VkIGFzIGFyZ3VtZW50czpcbiAgbG9hZEltYWdlLnRyYW5zZm9ybUNvb3JkaW5hdGVzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgLy8gUmV0dXJucyB0cmFuc2Zvcm1lZCBvcHRpb25zLCBhbGxvd3MgdG8gb3ZlcnJpZGUgZS5nLlxuICAvLyBtYXhXaWR0aCwgbWF4SGVpZ2h0IGFuZCBjcm9wIG9wdGlvbnMgYmFzZWQgb24gdGhlIGFzcGVjdFJhdGlvLlxuICAvLyBnZXRzIGltZywgb3B0aW9ucyBwYXNzZWQgYXMgYXJndW1lbnRzOlxuICBsb2FkSW1hZ2UuZ2V0VHJhbnNmb3JtZWRPcHRpb25zID0gZnVuY3Rpb24gKGltZywgb3B0aW9ucykge1xuICAgIHZhciBhc3BlY3RSYXRpbyA9IG9wdGlvbnMuYXNwZWN0UmF0aW9cbiAgICB2YXIgbmV3T3B0aW9uc1xuICAgIHZhciBpXG4gICAgdmFyIHdpZHRoXG4gICAgdmFyIGhlaWdodFxuICAgIGlmICghYXNwZWN0UmF0aW8pIHtcbiAgICAgIHJldHVybiBvcHRpb25zXG4gICAgfVxuICAgIG5ld09wdGlvbnMgPSB7fVxuICAgIGZvciAoaSBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBuZXdPcHRpb25zW2ldID0gb3B0aW9uc1tpXVxuICAgICAgfVxuICAgIH1cbiAgICBuZXdPcHRpb25zLmNyb3AgPSB0cnVlXG4gICAgd2lkdGggPSBpbWcubmF0dXJhbFdpZHRoIHx8IGltZy53aWR0aFxuICAgIGhlaWdodCA9IGltZy5uYXR1cmFsSGVpZ2h0IHx8IGltZy5oZWlnaHRcbiAgICBpZiAod2lkdGggLyBoZWlnaHQgPiBhc3BlY3RSYXRpbykge1xuICAgICAgbmV3T3B0aW9ucy5tYXhXaWR0aCA9IGhlaWdodCAqIGFzcGVjdFJhdGlvXG4gICAgICBuZXdPcHRpb25zLm1heEhlaWdodCA9IGhlaWdodFxuICAgIH0gZWxzZSB7XG4gICAgICBuZXdPcHRpb25zLm1heFdpZHRoID0gd2lkdGhcbiAgICAgIG5ld09wdGlvbnMubWF4SGVpZ2h0ID0gd2lkdGggLyBhc3BlY3RSYXRpb1xuICAgIH1cbiAgICByZXR1cm4gbmV3T3B0aW9uc1xuICB9XG5cbiAgLy8gQ2FudmFzIHJlbmRlciBtZXRob2QsIGFsbG93cyB0byBpbXBsZW1lbnQgYSBkaWZmZXJlbnQgcmVuZGVyaW5nIGFsZ29yaXRobTpcbiAgbG9hZEltYWdlLnJlbmRlckltYWdlVG9DYW52YXMgPSBmdW5jdGlvbiAoXG4gICAgY2FudmFzLFxuICAgIGltZyxcbiAgICBzb3VyY2VYLFxuICAgIHNvdXJjZVksXG4gICAgc291cmNlV2lkdGgsXG4gICAgc291cmNlSGVpZ2h0LFxuICAgIGRlc3RYLFxuICAgIGRlc3RZLFxuICAgIGRlc3RXaWR0aCxcbiAgICBkZXN0SGVpZ2h0XG4gICkge1xuICAgIGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLmRyYXdJbWFnZShcbiAgICAgIGltZyxcbiAgICAgIHNvdXJjZVgsXG4gICAgICBzb3VyY2VZLFxuICAgICAgc291cmNlV2lkdGgsXG4gICAgICBzb3VyY2VIZWlnaHQsXG4gICAgICBkZXN0WCxcbiAgICAgIGRlc3RZLFxuICAgICAgZGVzdFdpZHRoLFxuICAgICAgZGVzdEhlaWdodFxuICAgIClcbiAgICByZXR1cm4gY2FudmFzXG4gIH1cblxuICAvLyBUaGlzIG1ldGhvZCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB0aGUgdGFyZ2V0IGltYWdlXG4gIC8vIHNob3VsZCBiZSBhIGNhbnZhcyBlbGVtZW50OlxuICBsb2FkSW1hZ2UuaGFzQ2FudmFzT3B0aW9uID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gb3B0aW9ucy5jYW52YXMgfHwgb3B0aW9ucy5jcm9wIHx8ICEhb3B0aW9ucy5hc3BlY3RSYXRpb1xuICB9XG5cbiAgLy8gU2NhbGVzIGFuZC9vciBjcm9wcyB0aGUgZ2l2ZW4gaW1hZ2UgKGltZyBvciBjYW52YXMgSFRNTCBlbGVtZW50KVxuICAvLyB1c2luZyB0aGUgZ2l2ZW4gb3B0aW9ucy5cbiAgLy8gUmV0dXJucyBhIGNhbnZhcyBvYmplY3QgaWYgdGhlIGJyb3dzZXIgc3VwcG9ydHMgY2FudmFzXG4gIC8vIGFuZCB0aGUgaGFzQ2FudmFzT3B0aW9uIG1ldGhvZCByZXR1cm5zIHRydWUgb3IgYSBjYW52YXNcbiAgLy8gb2JqZWN0IGlzIHBhc3NlZCBhcyBpbWFnZSwgZWxzZSB0aGUgc2NhbGVkIGltYWdlOlxuICBsb2FkSW1hZ2Uuc2NhbGUgPSBmdW5jdGlvbiAoaW1nLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJylcbiAgICB2YXIgdXNlQ2FudmFzID0gaW1nLmdldENvbnRleHQgfHxcbiAgICAgICAgICAgICAgICAgICAgKGxvYWRJbWFnZS5oYXNDYW52YXNPcHRpb24ob3B0aW9ucykgJiYgY2FudmFzLmdldENvbnRleHQpXG4gICAgdmFyIHdpZHRoID0gaW1nLm5hdHVyYWxXaWR0aCB8fCBpbWcud2lkdGhcbiAgICB2YXIgaGVpZ2h0ID0gaW1nLm5hdHVyYWxIZWlnaHQgfHwgaW1nLmhlaWdodFxuICAgIHZhciBkZXN0V2lkdGggPSB3aWR0aFxuICAgIHZhciBkZXN0SGVpZ2h0ID0gaGVpZ2h0XG4gICAgdmFyIG1heFdpZHRoXG4gICAgdmFyIG1heEhlaWdodFxuICAgIHZhciBtaW5XaWR0aFxuICAgIHZhciBtaW5IZWlnaHRcbiAgICB2YXIgc291cmNlV2lkdGhcbiAgICB2YXIgc291cmNlSGVpZ2h0XG4gICAgdmFyIHNvdXJjZVhcbiAgICB2YXIgc291cmNlWVxuICAgIHZhciBwaXhlbFJhdGlvXG4gICAgdmFyIGRvd25zYW1wbGluZ1JhdGlvXG4gICAgdmFyIHRtcFxuICAgIGZ1bmN0aW9uIHNjYWxlVXAgKCkge1xuICAgICAgdmFyIHNjYWxlID0gTWF0aC5tYXgoXG4gICAgICAgIChtaW5XaWR0aCB8fCBkZXN0V2lkdGgpIC8gZGVzdFdpZHRoLFxuICAgICAgICAobWluSGVpZ2h0IHx8IGRlc3RIZWlnaHQpIC8gZGVzdEhlaWdodFxuICAgICAgKVxuICAgICAgaWYgKHNjYWxlID4gMSkge1xuICAgICAgICBkZXN0V2lkdGggKj0gc2NhbGVcbiAgICAgICAgZGVzdEhlaWdodCAqPSBzY2FsZVxuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBzY2FsZURvd24gKCkge1xuICAgICAgdmFyIHNjYWxlID0gTWF0aC5taW4oXG4gICAgICAgIChtYXhXaWR0aCB8fCBkZXN0V2lkdGgpIC8gZGVzdFdpZHRoLFxuICAgICAgICAobWF4SGVpZ2h0IHx8IGRlc3RIZWlnaHQpIC8gZGVzdEhlaWdodFxuICAgICAgKVxuICAgICAgaWYgKHNjYWxlIDwgMSkge1xuICAgICAgICBkZXN0V2lkdGggKj0gc2NhbGVcbiAgICAgICAgZGVzdEhlaWdodCAqPSBzY2FsZVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodXNlQ2FudmFzKSB7XG4gICAgICBvcHRpb25zID0gbG9hZEltYWdlLmdldFRyYW5zZm9ybWVkT3B0aW9ucyhpbWcsIG9wdGlvbnMpXG4gICAgICBzb3VyY2VYID0gb3B0aW9ucy5sZWZ0IHx8IDBcbiAgICAgIHNvdXJjZVkgPSBvcHRpb25zLnRvcCB8fCAwXG4gICAgICBpZiAob3B0aW9ucy5zb3VyY2VXaWR0aCkge1xuICAgICAgICBzb3VyY2VXaWR0aCA9IG9wdGlvbnMuc291cmNlV2lkdGhcbiAgICAgICAgaWYgKG9wdGlvbnMucmlnaHQgIT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLmxlZnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHNvdXJjZVggPSB3aWR0aCAtIHNvdXJjZVdpZHRoIC0gb3B0aW9ucy5yaWdodFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzb3VyY2VXaWR0aCA9IHdpZHRoIC0gc291cmNlWCAtIChvcHRpb25zLnJpZ2h0IHx8IDApXG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5zb3VyY2VIZWlnaHQpIHtcbiAgICAgICAgc291cmNlSGVpZ2h0ID0gb3B0aW9ucy5zb3VyY2VIZWlnaHRcbiAgICAgICAgaWYgKG9wdGlvbnMuYm90dG9tICE9PSB1bmRlZmluZWQgJiYgb3B0aW9ucy50b3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHNvdXJjZVkgPSBoZWlnaHQgLSBzb3VyY2VIZWlnaHQgLSBvcHRpb25zLmJvdHRvbVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzb3VyY2VIZWlnaHQgPSBoZWlnaHQgLSBzb3VyY2VZIC0gKG9wdGlvbnMuYm90dG9tIHx8IDApXG4gICAgICB9XG4gICAgICBkZXN0V2lkdGggPSBzb3VyY2VXaWR0aFxuICAgICAgZGVzdEhlaWdodCA9IHNvdXJjZUhlaWdodFxuICAgIH1cbiAgICBtYXhXaWR0aCA9IG9wdGlvbnMubWF4V2lkdGhcbiAgICBtYXhIZWlnaHQgPSBvcHRpb25zLm1heEhlaWdodFxuICAgIG1pbldpZHRoID0gb3B0aW9ucy5taW5XaWR0aFxuICAgIG1pbkhlaWdodCA9IG9wdGlvbnMubWluSGVpZ2h0XG4gICAgaWYgKHVzZUNhbnZhcyAmJiBtYXhXaWR0aCAmJiBtYXhIZWlnaHQgJiYgb3B0aW9ucy5jcm9wKSB7XG4gICAgICBkZXN0V2lkdGggPSBtYXhXaWR0aFxuICAgICAgZGVzdEhlaWdodCA9IG1heEhlaWdodFxuICAgICAgdG1wID0gc291cmNlV2lkdGggLyBzb3VyY2VIZWlnaHQgLSBtYXhXaWR0aCAvIG1heEhlaWdodFxuICAgICAgaWYgKHRtcCA8IDApIHtcbiAgICAgICAgc291cmNlSGVpZ2h0ID0gbWF4SGVpZ2h0ICogc291cmNlV2lkdGggLyBtYXhXaWR0aFxuICAgICAgICBpZiAob3B0aW9ucy50b3AgPT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLmJvdHRvbSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc291cmNlWSA9IChoZWlnaHQgLSBzb3VyY2VIZWlnaHQpIC8gMlxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRtcCA+IDApIHtcbiAgICAgICAgc291cmNlV2lkdGggPSBtYXhXaWR0aCAqIHNvdXJjZUhlaWdodCAvIG1heEhlaWdodFxuICAgICAgICBpZiAob3B0aW9ucy5sZWZ0ID09PSB1bmRlZmluZWQgJiYgb3B0aW9ucy5yaWdodCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc291cmNlWCA9ICh3aWR0aCAtIHNvdXJjZVdpZHRoKSAvIDJcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3B0aW9ucy5jb250YWluIHx8IG9wdGlvbnMuY292ZXIpIHtcbiAgICAgICAgbWluV2lkdGggPSBtYXhXaWR0aCA9IG1heFdpZHRoIHx8IG1pbldpZHRoXG4gICAgICAgIG1pbkhlaWdodCA9IG1heEhlaWdodCA9IG1heEhlaWdodCB8fCBtaW5IZWlnaHRcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLmNvdmVyKSB7XG4gICAgICAgIHNjYWxlRG93bigpXG4gICAgICAgIHNjYWxlVXAoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2NhbGVVcCgpXG4gICAgICAgIHNjYWxlRG93bigpXG4gICAgICB9XG4gICAgfVxuICAgIGlmICh1c2VDYW52YXMpIHtcbiAgICAgIHBpeGVsUmF0aW8gPSBvcHRpb25zLnBpeGVsUmF0aW9cbiAgICAgIGlmIChwaXhlbFJhdGlvID4gMSkge1xuICAgICAgICBjYW52YXMuc3R5bGUud2lkdGggPSBkZXN0V2lkdGggKyAncHgnXG4gICAgICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSBkZXN0SGVpZ2h0ICsgJ3B4J1xuICAgICAgICBkZXN0V2lkdGggKj0gcGl4ZWxSYXRpb1xuICAgICAgICBkZXN0SGVpZ2h0ICo9IHBpeGVsUmF0aW9cbiAgICAgICAgY2FudmFzLmdldENvbnRleHQoJzJkJykuc2NhbGUocGl4ZWxSYXRpbywgcGl4ZWxSYXRpbylcbiAgICAgIH1cbiAgICAgIGRvd25zYW1wbGluZ1JhdGlvID0gb3B0aW9ucy5kb3duc2FtcGxpbmdSYXRpb1xuICAgICAgaWYgKGRvd25zYW1wbGluZ1JhdGlvID4gMCAmJiBkb3duc2FtcGxpbmdSYXRpbyA8IDEgJiZcbiAgICAgICAgICAgIGRlc3RXaWR0aCA8IHNvdXJjZVdpZHRoICYmIGRlc3RIZWlnaHQgPCBzb3VyY2VIZWlnaHQpIHtcbiAgICAgICAgd2hpbGUgKHNvdXJjZVdpZHRoICogZG93bnNhbXBsaW5nUmF0aW8gPiBkZXN0V2lkdGgpIHtcbiAgICAgICAgICBjYW52YXMud2lkdGggPSBzb3VyY2VXaWR0aCAqIGRvd25zYW1wbGluZ1JhdGlvXG4gICAgICAgICAgY2FudmFzLmhlaWdodCA9IHNvdXJjZUhlaWdodCAqIGRvd25zYW1wbGluZ1JhdGlvXG4gICAgICAgICAgbG9hZEltYWdlLnJlbmRlckltYWdlVG9DYW52YXMoXG4gICAgICAgICAgICBjYW52YXMsXG4gICAgICAgICAgICBpbWcsXG4gICAgICAgICAgICBzb3VyY2VYLFxuICAgICAgICAgICAgc291cmNlWSxcbiAgICAgICAgICAgIHNvdXJjZVdpZHRoLFxuICAgICAgICAgICAgc291cmNlSGVpZ2h0LFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBjYW52YXMud2lkdGgsXG4gICAgICAgICAgICBjYW52YXMuaGVpZ2h0XG4gICAgICAgICAgKVxuICAgICAgICAgIHNvdXJjZVdpZHRoID0gY2FudmFzLndpZHRoXG4gICAgICAgICAgc291cmNlSGVpZ2h0ID0gY2FudmFzLmhlaWdodFxuICAgICAgICAgIGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpXG4gICAgICAgICAgaW1nLndpZHRoID0gc291cmNlV2lkdGhcbiAgICAgICAgICBpbWcuaGVpZ2h0ID0gc291cmNlSGVpZ2h0XG4gICAgICAgICAgbG9hZEltYWdlLnJlbmRlckltYWdlVG9DYW52YXMoXG4gICAgICAgICAgICBpbWcsXG4gICAgICAgICAgICBjYW52YXMsXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIHNvdXJjZVdpZHRoLFxuICAgICAgICAgICAgc291cmNlSGVpZ2h0LFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBzb3VyY2VXaWR0aCxcbiAgICAgICAgICAgIHNvdXJjZUhlaWdodFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2FudmFzLndpZHRoID0gZGVzdFdpZHRoXG4gICAgICBjYW52YXMuaGVpZ2h0ID0gZGVzdEhlaWdodFxuICAgICAgbG9hZEltYWdlLnRyYW5zZm9ybUNvb3JkaW5hdGVzKFxuICAgICAgICBjYW52YXMsXG4gICAgICAgIG9wdGlvbnNcbiAgICAgIClcbiAgICAgIHJldHVybiBsb2FkSW1hZ2UucmVuZGVySW1hZ2VUb0NhbnZhcyhcbiAgICAgICAgY2FudmFzLFxuICAgICAgICBpbWcsXG4gICAgICAgIHNvdXJjZVgsXG4gICAgICAgIHNvdXJjZVksXG4gICAgICAgIHNvdXJjZVdpZHRoLFxuICAgICAgICBzb3VyY2VIZWlnaHQsXG4gICAgICAgIDAsXG4gICAgICAgIDAsXG4gICAgICAgIGRlc3RXaWR0aCxcbiAgICAgICAgZGVzdEhlaWdodFxuICAgICAgKVxuICAgIH1cbiAgICBpbWcud2lkdGggPSBkZXN0V2lkdGhcbiAgICBpbWcuaGVpZ2h0ID0gZGVzdEhlaWdodFxuICAgIHJldHVybiBpbWdcbiAgfVxuXG4gIGxvYWRJbWFnZS5jcmVhdGVPYmplY3RVUkwgPSBmdW5jdGlvbiAoZmlsZSkge1xuICAgIHJldHVybiB1cmxBUEkgPyB1cmxBUEkuY3JlYXRlT2JqZWN0VVJMKGZpbGUpIDogZmFsc2VcbiAgfVxuXG4gIGxvYWRJbWFnZS5yZXZva2VPYmplY3RVUkwgPSBmdW5jdGlvbiAodXJsKSB7XG4gICAgcmV0dXJuIHVybEFQSSA/IHVybEFQSS5yZXZva2VPYmplY3RVUkwodXJsKSA6IGZhbHNlXG4gIH1cblxuICAvLyBMb2FkcyBhIGdpdmVuIEZpbGUgb2JqZWN0IHZpYSBGaWxlUmVhZGVyIGludGVyZmFjZSxcbiAgLy8gaW52b2tlcyB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgZXZlbnQgb2JqZWN0IChsb2FkIG9yIGVycm9yKS5cbiAgLy8gVGhlIHJlc3VsdCBjYW4gYmUgcmVhZCB2aWEgZXZlbnQudGFyZ2V0LnJlc3VsdDpcbiAgbG9hZEltYWdlLnJlYWRGaWxlID0gZnVuY3Rpb24gKGZpbGUsIGNhbGxiYWNrLCBtZXRob2QpIHtcbiAgICBpZiAod2luZG93LkZpbGVSZWFkZXIpIHtcbiAgICAgIHZhciBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgICAgZmlsZVJlYWRlci5vbmxvYWQgPSBmaWxlUmVhZGVyLm9uZXJyb3IgPSBjYWxsYmFja1xuICAgICAgbWV0aG9kID0gbWV0aG9kIHx8ICdyZWFkQXNEYXRhVVJMJ1xuICAgICAgaWYgKGZpbGVSZWFkZXJbbWV0aG9kXSkge1xuICAgICAgICBmaWxlUmVhZGVyW21ldGhvZF0oZmlsZSlcbiAgICAgICAgcmV0dXJuIGZpbGVSZWFkZXJcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBsb2FkSW1hZ2VcbiAgICB9KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBsb2FkSW1hZ2VcbiAgfSBlbHNlIHtcbiAgICAkLmxvYWRJbWFnZSA9IGxvYWRJbWFnZVxuICB9XG59KHdpbmRvdykpXG4iLCIvKiBGaWxlU2F2ZXIuanNcbiAqIEEgc2F2ZUFzKCkgRmlsZVNhdmVyIGltcGxlbWVudGF0aW9uLlxuICogMS4xLjIwMTYwMzI4XG4gKlxuICogQnkgRWxpIEdyZXksIGh0dHA6Ly9lbGlncmV5LmNvbVxuICogTGljZW5zZTogTUlUXG4gKiAgIFNlZSBodHRwczovL2dpdGh1Yi5jb20vZWxpZ3JleS9GaWxlU2F2ZXIuanMvYmxvYi9tYXN0ZXIvTElDRU5TRS5tZFxuICovXG5cbi8qZ2xvYmFsIHNlbGYgKi9cbi8qanNsaW50IGJpdHdpc2U6IHRydWUsIGluZGVudDogNCwgbGF4YnJlYWs6IHRydWUsIGxheGNvbW1hOiB0cnVlLCBzbWFydHRhYnM6IHRydWUsIHBsdXNwbHVzOiB0cnVlICovXG5cbi8qISBAc291cmNlIGh0dHA6Ly9wdXJsLmVsaWdyZXkuY29tL2dpdGh1Yi9GaWxlU2F2ZXIuanMvYmxvYi9tYXN0ZXIvRmlsZVNhdmVyLmpzICovXG5cbnZhciBzYXZlQXMgPSBzYXZlQXMgfHwgKGZ1bmN0aW9uKHZpZXcpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdC8vIElFIDwxMCBpcyBleHBsaWNpdGx5IHVuc3VwcG9ydGVkXG5cdGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmIC9NU0lFIFsxLTldXFwuLy50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdHZhclxuXHRcdCAgZG9jID0gdmlldy5kb2N1bWVudFxuXHRcdCAgLy8gb25seSBnZXQgVVJMIHdoZW4gbmVjZXNzYXJ5IGluIGNhc2UgQmxvYi5qcyBoYXNuJ3Qgb3ZlcnJpZGRlbiBpdCB5ZXRcblx0XHQsIGdldF9VUkwgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB2aWV3LlVSTCB8fCB2aWV3LndlYmtpdFVSTCB8fCB2aWV3O1xuXHRcdH1cblx0XHQsIHNhdmVfbGluayA9IGRvYy5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sXCIsIFwiYVwiKVxuXHRcdCwgY2FuX3VzZV9zYXZlX2xpbmsgPSBcImRvd25sb2FkXCIgaW4gc2F2ZV9saW5rXG5cdFx0LCBjbGljayA9IGZ1bmN0aW9uKG5vZGUpIHtcblx0XHRcdHZhciBldmVudCA9IG5ldyBNb3VzZUV2ZW50KFwiY2xpY2tcIik7XG5cdFx0XHRub2RlLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuXHRcdH1cblx0XHQsIGlzX3NhZmFyaSA9IC9WZXJzaW9uXFwvW1xcZFxcLl0rLipTYWZhcmkvLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudClcblx0XHQsIHdlYmtpdF9yZXFfZnMgPSB2aWV3LndlYmtpdFJlcXVlc3RGaWxlU3lzdGVtXG5cdFx0LCByZXFfZnMgPSB2aWV3LnJlcXVlc3RGaWxlU3lzdGVtIHx8IHdlYmtpdF9yZXFfZnMgfHwgdmlldy5tb3pSZXF1ZXN0RmlsZVN5c3RlbVxuXHRcdCwgdGhyb3dfb3V0c2lkZSA9IGZ1bmN0aW9uKGV4KSB7XG5cdFx0XHQodmlldy5zZXRJbW1lZGlhdGUgfHwgdmlldy5zZXRUaW1lb3V0KShmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhyb3cgZXg7XG5cdFx0XHR9LCAwKTtcblx0XHR9XG5cdFx0LCBmb3JjZV9zYXZlYWJsZV90eXBlID0gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIlxuXHRcdCwgZnNfbWluX3NpemUgPSAwXG5cdFx0Ly8gdGhlIEJsb2IgQVBJIGlzIGZ1bmRhbWVudGFsbHkgYnJva2VuIGFzIHRoZXJlIGlzIG5vIFwiZG93bmxvYWRmaW5pc2hlZFwiIGV2ZW50IHRvIHN1YnNjcmliZSB0b1xuXHRcdCwgYXJiaXRyYXJ5X3Jldm9rZV90aW1lb3V0ID0gMTAwMCAqIDQwIC8vIGluIG1zXG5cdFx0LCByZXZva2UgPSBmdW5jdGlvbihmaWxlKSB7XG5cdFx0XHR2YXIgcmV2b2tlciA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAodHlwZW9mIGZpbGUgPT09IFwic3RyaW5nXCIpIHsgLy8gZmlsZSBpcyBhbiBvYmplY3QgVVJMXG5cdFx0XHRcdFx0Z2V0X1VSTCgpLnJldm9rZU9iamVjdFVSTChmaWxlKTtcblx0XHRcdFx0fSBlbHNlIHsgLy8gZmlsZSBpcyBhIEZpbGVcblx0XHRcdFx0XHRmaWxlLnJlbW92ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0LyogLy8gVGFrZSBub3RlIFczQzpcblx0XHRcdHZhclxuXHRcdFx0ICB1cmkgPSB0eXBlb2YgZmlsZSA9PT0gXCJzdHJpbmdcIiA/IGZpbGUgOiBmaWxlLnRvVVJMKClcblx0XHRcdCwgcmV2b2tlciA9IGZ1bmN0aW9uKGV2dCkge1xuXHRcdFx0XHQvLyBpZGVhbHkgRG93bmxvYWRGaW5pc2hlZEV2ZW50LmRhdGEgd291bGQgYmUgdGhlIFVSTCByZXF1ZXN0ZWRcblx0XHRcdFx0aWYgKGV2dC5kYXRhID09PSB1cmkpIHtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGZpbGUgPT09IFwic3RyaW5nXCIpIHsgLy8gZmlsZSBpcyBhbiBvYmplY3QgVVJMXG5cdFx0XHRcdFx0XHRnZXRfVVJMKCkucmV2b2tlT2JqZWN0VVJMKGZpbGUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7IC8vIGZpbGUgaXMgYSBGaWxlXG5cdFx0XHRcdFx0XHRmaWxlLnJlbW92ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0O1xuXHRcdFx0dmlldy5hZGRFdmVudExpc3RlbmVyKFwiZG93bmxvYWRmaW5pc2hlZFwiLCByZXZva2VyKTtcblx0XHRcdCovXG5cdFx0XHRzZXRUaW1lb3V0KHJldm9rZXIsIGFyYml0cmFyeV9yZXZva2VfdGltZW91dCk7XG5cdFx0fVxuXHRcdCwgZGlzcGF0Y2ggPSBmdW5jdGlvbihmaWxlc2F2ZXIsIGV2ZW50X3R5cGVzLCBldmVudCkge1xuXHRcdFx0ZXZlbnRfdHlwZXMgPSBbXS5jb25jYXQoZXZlbnRfdHlwZXMpO1xuXHRcdFx0dmFyIGkgPSBldmVudF90eXBlcy5sZW5ndGg7XG5cdFx0XHR3aGlsZSAoaS0tKSB7XG5cdFx0XHRcdHZhciBsaXN0ZW5lciA9IGZpbGVzYXZlcltcIm9uXCIgKyBldmVudF90eXBlc1tpXV07XG5cdFx0XHRcdGlmICh0eXBlb2YgbGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRsaXN0ZW5lci5jYWxsKGZpbGVzYXZlciwgZXZlbnQgfHwgZmlsZXNhdmVyKTtcblx0XHRcdFx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0XHRcdFx0dGhyb3dfb3V0c2lkZShleCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdCwgYXV0b19ib20gPSBmdW5jdGlvbihibG9iKSB7XG5cdFx0XHQvLyBwcmVwZW5kIEJPTSBmb3IgVVRGLTggWE1MIGFuZCB0ZXh0LyogdHlwZXMgKGluY2x1ZGluZyBIVE1MKVxuXHRcdFx0aWYgKC9eXFxzKig/OnRleHRcXC9cXFMqfGFwcGxpY2F0aW9uXFwveG1sfFxcUypcXC9cXFMqXFwreG1sKVxccyo7LipjaGFyc2V0XFxzKj1cXHMqdXRmLTgvaS50ZXN0KGJsb2IudHlwZSkpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBCbG9iKFtcIlxcdWZlZmZcIiwgYmxvYl0sIHt0eXBlOiBibG9iLnR5cGV9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBibG9iO1xuXHRcdH1cblx0XHQsIEZpbGVTYXZlciA9IGZ1bmN0aW9uKGJsb2IsIG5hbWUsIG5vX2F1dG9fYm9tKSB7XG5cdFx0XHRpZiAoIW5vX2F1dG9fYm9tKSB7XG5cdFx0XHRcdGJsb2IgPSBhdXRvX2JvbShibG9iKTtcblx0XHRcdH1cblx0XHRcdC8vIEZpcnN0IHRyeSBhLmRvd25sb2FkLCB0aGVuIHdlYiBmaWxlc3lzdGVtLCB0aGVuIG9iamVjdCBVUkxzXG5cdFx0XHR2YXJcblx0XHRcdFx0ICBmaWxlc2F2ZXIgPSB0aGlzXG5cdFx0XHRcdCwgdHlwZSA9IGJsb2IudHlwZVxuXHRcdFx0XHQsIGJsb2JfY2hhbmdlZCA9IGZhbHNlXG5cdFx0XHRcdCwgb2JqZWN0X3VybFxuXHRcdFx0XHQsIHRhcmdldF92aWV3XG5cdFx0XHRcdCwgZGlzcGF0Y2hfYWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0ZGlzcGF0Y2goZmlsZXNhdmVyLCBcIndyaXRlc3RhcnQgcHJvZ3Jlc3Mgd3JpdGUgd3JpdGVlbmRcIi5zcGxpdChcIiBcIikpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIG9uIGFueSBmaWxlc3lzIGVycm9ycyByZXZlcnQgdG8gc2F2aW5nIHdpdGggb2JqZWN0IFVSTHNcblx0XHRcdFx0LCBmc19lcnJvciA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICh0YXJnZXRfdmlldyAmJiBpc19zYWZhcmkgJiYgdHlwZW9mIEZpbGVSZWFkZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdFx0XHRcdC8vIFNhZmFyaSBkb2Vzbid0IGFsbG93IGRvd25sb2FkaW5nIG9mIGJsb2IgdXJsc1xuXHRcdFx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cdFx0XHRcdFx0XHRyZWFkZXIub25sb2FkZW5kID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBiYXNlNjREYXRhID0gcmVhZGVyLnJlc3VsdDtcblx0XHRcdFx0XHRcdFx0dGFyZ2V0X3ZpZXcubG9jYXRpb24uaHJlZiA9IFwiZGF0YTphdHRhY2htZW50L2ZpbGVcIiArIGJhc2U2NERhdGEuc2xpY2UoYmFzZTY0RGF0YS5zZWFyY2goL1ssO10vKSk7XG5cdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdFx0XHRcdGRpc3BhdGNoX2FsbCgpO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuXHRcdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuSU5JVDtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gZG9uJ3QgY3JlYXRlIG1vcmUgb2JqZWN0IFVSTHMgdGhhbiBuZWVkZWRcblx0XHRcdFx0XHRpZiAoYmxvYl9jaGFuZ2VkIHx8ICFvYmplY3RfdXJsKSB7XG5cdFx0XHRcdFx0XHRvYmplY3RfdXJsID0gZ2V0X1VSTCgpLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRhcmdldF92aWV3KSB7XG5cdFx0XHRcdFx0XHR0YXJnZXRfdmlldy5sb2NhdGlvbi5ocmVmID0gb2JqZWN0X3VybDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dmFyIG5ld190YWIgPSB2aWV3Lm9wZW4ob2JqZWN0X3VybCwgXCJfYmxhbmtcIik7XG5cdFx0XHRcdFx0XHRpZiAobmV3X3RhYiA9PT0gdW5kZWZpbmVkICYmIGlzX3NhZmFyaSkge1xuXHRcdFx0XHRcdFx0XHQvL0FwcGxlIGRvIG5vdCBhbGxvdyB3aW5kb3cub3Blbiwgc2VlIGh0dHA6Ly9iaXQubHkvMWtaZmZSSVxuXHRcdFx0XHRcdFx0XHR2aWV3LmxvY2F0aW9uLmhyZWYgPSBvYmplY3RfdXJsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdFx0ZGlzcGF0Y2hfYWxsKCk7XG5cdFx0XHRcdFx0cmV2b2tlKG9iamVjdF91cmwpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdCwgYWJvcnRhYmxlID0gZnVuY3Rpb24oZnVuYykge1xuXHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmIChmaWxlc2F2ZXIucmVhZHlTdGF0ZSAhPT0gZmlsZXNhdmVyLkRPTkUpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdCwgY3JlYXRlX2lmX25vdF9mb3VuZCA9IHtjcmVhdGU6IHRydWUsIGV4Y2x1c2l2ZTogZmFsc2V9XG5cdFx0XHRcdCwgc2xpY2Vcblx0XHRcdDtcblx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLklOSVQ7XG5cdFx0XHRpZiAoIW5hbWUpIHtcblx0XHRcdFx0bmFtZSA9IFwiZG93bmxvYWRcIjtcblx0XHRcdH1cblx0XHRcdGlmIChjYW5fdXNlX3NhdmVfbGluaykge1xuXHRcdFx0XHRvYmplY3RfdXJsID0gZ2V0X1VSTCgpLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblx0XHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRzYXZlX2xpbmsuaHJlZiA9IG9iamVjdF91cmw7XG5cdFx0XHRcdFx0c2F2ZV9saW5rLmRvd25sb2FkID0gbmFtZTtcblx0XHRcdFx0XHRjbGljayhzYXZlX2xpbmspO1xuXHRcdFx0XHRcdGRpc3BhdGNoX2FsbCgpO1xuXHRcdFx0XHRcdHJldm9rZShvYmplY3RfdXJsKTtcblx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gT2JqZWN0IGFuZCB3ZWIgZmlsZXN5c3RlbSBVUkxzIGhhdmUgYSBwcm9ibGVtIHNhdmluZyBpbiBHb29nbGUgQ2hyb21lIHdoZW5cblx0XHRcdC8vIHZpZXdlZCBpbiBhIHRhYiwgc28gSSBmb3JjZSBzYXZlIHdpdGggYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXG5cdFx0XHQvLyBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD05MTE1OFxuXHRcdFx0Ly8gVXBkYXRlOiBHb29nbGUgZXJyYW50bHkgY2xvc2VkIDkxMTU4LCBJIHN1Ym1pdHRlZCBpdCBhZ2Fpbjpcblx0XHRcdC8vIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0zODk2NDJcblx0XHRcdGlmICh2aWV3LmNocm9tZSAmJiB0eXBlICYmIHR5cGUgIT09IGZvcmNlX3NhdmVhYmxlX3R5cGUpIHtcblx0XHRcdFx0c2xpY2UgPSBibG9iLnNsaWNlIHx8IGJsb2Iud2Via2l0U2xpY2U7XG5cdFx0XHRcdGJsb2IgPSBzbGljZS5jYWxsKGJsb2IsIDAsIGJsb2Iuc2l6ZSwgZm9yY2Vfc2F2ZWFibGVfdHlwZSk7XG5cdFx0XHRcdGJsb2JfY2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHQvLyBTaW5jZSBJIGNhbid0IGJlIHN1cmUgdGhhdCB0aGUgZ3Vlc3NlZCBtZWRpYSB0eXBlIHdpbGwgdHJpZ2dlciBhIGRvd25sb2FkXG5cdFx0XHQvLyBpbiBXZWJLaXQsIEkgYXBwZW5kIC5kb3dubG9hZCB0byB0aGUgZmlsZW5hbWUuXG5cdFx0XHQvLyBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NjU0NDBcblx0XHRcdGlmICh3ZWJraXRfcmVxX2ZzICYmIG5hbWUgIT09IFwiZG93bmxvYWRcIikge1xuXHRcdFx0XHRuYW1lICs9IFwiLmRvd25sb2FkXCI7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZSA9PT0gZm9yY2Vfc2F2ZWFibGVfdHlwZSB8fCB3ZWJraXRfcmVxX2ZzKSB7XG5cdFx0XHRcdHRhcmdldF92aWV3ID0gdmlldztcblx0XHRcdH1cblx0XHRcdGlmICghcmVxX2ZzKSB7XG5cdFx0XHRcdGZzX2Vycm9yKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZzX21pbl9zaXplICs9IGJsb2Iuc2l6ZTtcblx0XHRcdHJlcV9mcyh2aWV3LlRFTVBPUkFSWSwgZnNfbWluX3NpemUsIGFib3J0YWJsZShmdW5jdGlvbihmcykge1xuXHRcdFx0XHRmcy5yb290LmdldERpcmVjdG9yeShcInNhdmVkXCIsIGNyZWF0ZV9pZl9ub3RfZm91bmQsIGFib3J0YWJsZShmdW5jdGlvbihkaXIpIHtcblx0XHRcdFx0XHR2YXIgc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGlyLmdldEZpbGUobmFtZSwgY3JlYXRlX2lmX25vdF9mb3VuZCwgYWJvcnRhYmxlKGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdFx0XHRcdFx0ZmlsZS5jcmVhdGVXcml0ZXIoYWJvcnRhYmxlKGZ1bmN0aW9uKHdyaXRlcikge1xuXHRcdFx0XHRcdFx0XHRcdHdyaXRlci5vbndyaXRlZW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRhcmdldF92aWV3LmxvY2F0aW9uLmhyZWYgPSBmaWxlLnRvVVJMKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzcGF0Y2goZmlsZXNhdmVyLCBcIndyaXRlZW5kXCIsIGV2ZW50KTtcblx0XHRcdFx0XHRcdFx0XHRcdHJldm9rZShmaWxlKTtcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRcdHdyaXRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgZXJyb3IgPSB3cml0ZXIuZXJyb3I7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZXJyb3IuY29kZSAhPT0gZXJyb3IuQUJPUlRfRVJSKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGZzX2Vycm9yKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRcIndyaXRlc3RhcnQgcHJvZ3Jlc3Mgd3JpdGUgYWJvcnRcIi5zcGxpdChcIiBcIikuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0d3JpdGVyW1wib25cIiArIGV2ZW50XSA9IGZpbGVzYXZlcltcIm9uXCIgKyBldmVudF07XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLndyaXRlKGJsb2IpO1xuXHRcdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0d3JpdGVyLmFib3J0KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuV1JJVElORztcblx0XHRcdFx0XHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHRcdFx0XHRcdH0pLCBmc19lcnJvcik7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRkaXIuZ2V0RmlsZShuYW1lLCB7Y3JlYXRlOiBmYWxzZX0sIGFib3J0YWJsZShmdW5jdGlvbihmaWxlKSB7XG5cdFx0XHRcdFx0XHQvLyBkZWxldGUgZmlsZSBpZiBpdCBhbHJlYWR5IGV4aXN0c1xuXHRcdFx0XHRcdFx0ZmlsZS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdHNhdmUoKTtcblx0XHRcdFx0XHR9KSwgYWJvcnRhYmxlKGZ1bmN0aW9uKGV4KSB7XG5cdFx0XHRcdFx0XHRpZiAoZXguY29kZSA9PT0gZXguTk9UX0ZPVU5EX0VSUikge1xuXHRcdFx0XHRcdFx0XHRzYXZlKCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRmc19lcnJvcigpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHRcdH0pLCBmc19lcnJvcik7XG5cdFx0fVxuXHRcdCwgRlNfcHJvdG8gPSBGaWxlU2F2ZXIucHJvdG90eXBlXG5cdFx0LCBzYXZlQXMgPSBmdW5jdGlvbihibG9iLCBuYW1lLCBub19hdXRvX2JvbSkge1xuXHRcdFx0cmV0dXJuIG5ldyBGaWxlU2F2ZXIoYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pO1xuXHRcdH1cblx0O1xuXHQvLyBJRSAxMCsgKG5hdGl2ZSBzYXZlQXMpXG5cdGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmIG5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKSB7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKGJsb2IsIG5hbWUsIG5vX2F1dG9fYm9tKSB7XG5cdFx0XHRpZiAoIW5vX2F1dG9fYm9tKSB7XG5cdFx0XHRcdGJsb2IgPSBhdXRvX2JvbShibG9iKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYihibG9iLCBuYW1lIHx8IFwiZG93bmxvYWRcIik7XG5cdFx0fTtcblx0fVxuXG5cdEZTX3Byb3RvLmFib3J0ID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGZpbGVzYXZlciA9IHRoaXM7XG5cdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuRE9ORTtcblx0XHRkaXNwYXRjaChmaWxlc2F2ZXIsIFwiYWJvcnRcIik7XG5cdH07XG5cdEZTX3Byb3RvLnJlYWR5U3RhdGUgPSBGU19wcm90by5JTklUID0gMDtcblx0RlNfcHJvdG8uV1JJVElORyA9IDE7XG5cdEZTX3Byb3RvLkRPTkUgPSAyO1xuXG5cdEZTX3Byb3RvLmVycm9yID1cblx0RlNfcHJvdG8ub253cml0ZXN0YXJ0ID1cblx0RlNfcHJvdG8ub25wcm9ncmVzcyA9XG5cdEZTX3Byb3RvLm9ud3JpdGUgPVxuXHRGU19wcm90by5vbmFib3J0ID1cblx0RlNfcHJvdG8ub25lcnJvciA9XG5cdEZTX3Byb3RvLm9ud3JpdGVlbmQgPVxuXHRcdG51bGw7XG5cblx0cmV0dXJuIHNhdmVBcztcbn0oXG5cdCAgIHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiICYmIHNlbGZcblx0fHwgdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiAmJiB3aW5kb3dcblx0fHwgdGhpcy5jb250ZW50XG4pKTtcbi8vIGBzZWxmYCBpcyB1bmRlZmluZWQgaW4gRmlyZWZveCBmb3IgQW5kcm9pZCBjb250ZW50IHNjcmlwdCBjb250ZXh0XG4vLyB3aGlsZSBgdGhpc2AgaXMgbnNJQ29udGVudEZyYW1lTWVzc2FnZU1hbmFnZXJcbi8vIHdpdGggYW4gYXR0cmlidXRlIGBjb250ZW50YCB0aGF0IGNvcnJlc3BvbmRzIHRvIHRoZSB3aW5kb3dcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgbW9kdWxlLmV4cG9ydHMuc2F2ZUFzID0gc2F2ZUFzO1xufSBlbHNlIGlmICgodHlwZW9mIGRlZmluZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBkZWZpbmUgIT09IG51bGwpICYmIChkZWZpbmUuYW1kICE9PSBudWxsKSkge1xuICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBzYXZlQXM7XG4gIH0pO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBodHRwOi8vd3d3LmNvbG9yLm9yZy9wcm9maWxlaGVhZGVyLnhhbHRlclxuXG52YXIgdmVyc2lvbk1hcCA9IHtcbiAgMHgwMjAwMDAwMDogJzIuMCcsXG4gIDB4MDIxMDAwMDA6ICcyLjEnLFxuICAweDAyNDAwMDAwOiAnMi40JyxcbiAgMHgwNDAwMDAwMDogJzQuMCcsXG4gIDB4MDQyMDAwMDA6ICc0LjInXG59O1xuXG52YXIgaW50ZW50TWFwID0ge1xuICAwOiAnUGVyY2VwdHVhbCcsXG4gIDE6ICdSZWxhdGl2ZScsXG4gIDI6ICdTYXR1cmF0aW9uJyxcbiAgMzogJ0Fic29sdXRlJ1xufTtcblxudmFyIHZhbHVlTWFwID0ge1xuICAvLyBEZXZpY2VcbiAgJ3NjbnInOiAnU2Nhbm5lcicsXG4gICdtbnRyJzogJ01vbml0b3InLFxuICAncHJ0cic6ICdQcmludGVyJyxcbiAgJ2xpbmsnOiAnTGluaycsXG4gICdhYnN0JzogJ0Fic3RyYWN0JyxcbiAgJ3NwYWMnOiAnU3BhY2UnLFxuICAnbm1jbCc6ICdOYW1lZCBjb2xvcicsXG4gIC8vIFBsYXRmb3JtXG4gICdhcHBsJzogJ0FwcGxlJyxcbiAgJ2FkYmUnOiAnQWRvYmUnLFxuICAnbXNmdCc6ICdNaWNyb3NvZnQnLFxuICAnc3Vudyc6ICdTdW4gTWljcm9zeXN0ZW1zJyxcbiAgJ3NnaScgOiAnU2lsaWNvbiBHcmFwaGljcycsXG4gICd0Z250JzogJ1RhbGlnZW50J1xufTtcblxudmFyIHRhZ01hcCA9IHtcbiAgJ2Rlc2MnOiAnZGVzY3JpcHRpb24nLFxuICAnY3BydCc6ICdjb3B5cmlnaHQnLFxuICAnZG1kZCc6ICdkZXZpY2VNb2RlbERlc2NyaXB0aW9uJyxcbiAgJ3Z1ZWQnOiAndmlld2luZ0NvbmRpdGlvbnNEZXNjcmlwdGlvbidcbn07XG5cbnZhciBnZXRDb250ZW50QXRPZmZzZXRBc1N0cmluZyA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0KSB7XG4gIHZhciB2YWx1ZSA9IGJ1ZmZlci5zbGljZShvZmZzZXQsIG9mZnNldCArIDQpLnRvU3RyaW5nKCkudHJpbSgpO1xuICByZXR1cm4gKHZhbHVlLnRvTG93ZXJDYXNlKCkgaW4gdmFsdWVNYXApID8gdmFsdWVNYXBbdmFsdWUudG9Mb3dlckNhc2UoKV0gOiB2YWx1ZTtcbn07XG5cbnZhciBoYXNDb250ZW50QXRPZmZzZXQgPSBmdW5jdGlvbihidWZmZXIsIG9mZnNldCkge1xuICByZXR1cm4gKGJ1ZmZlci5yZWFkVUludDMyQkUob2Zmc2V0KSAhPT0gMCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5wYXJzZSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAvLyBWZXJpZnkgZXhwZWN0ZWQgbGVuZ3RoXG4gIHZhciBzaXplID0gYnVmZmVyLnJlYWRVSW50MzJCRSgwKTtcbiAgaWYgKHNpemUgIT09IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSUNDIHByb2ZpbGU6IGxlbmd0aCBtaXNtYXRjaCcpO1xuICB9XG4gIC8vIFZlcmlmeSAnYWNzcCcgc2lnbmF0dXJlXG4gIHZhciBzaWduYXR1cmUgPSBidWZmZXIuc2xpY2UoMzYsIDQwKS50b1N0cmluZygpO1xuICBpZiAoc2lnbmF0dXJlICE9PSAnYWNzcCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSUNDIHByb2ZpbGU6IG1pc3Npbmcgc2lnbmF0dXJlJyk7XG4gIH1cbiAgLy8gSW50ZWdlciBhdHRyaWJ1dGVzXG4gIHZhciBwcm9maWxlID0ge1xuICAgIHZlcnNpb246IHZlcnNpb25NYXBbYnVmZmVyLnJlYWRVSW50MzJCRSg4KV0sXG4gICAgaW50ZW50OiBpbnRlbnRNYXBbYnVmZmVyLnJlYWRVSW50MzJCRSg2NCldXG4gIH07XG4gIC8vIEZvdXItYnl0ZSBzdHJpbmcgYXR0cmlidXRlc1xuICBbXG4gICAgWyA0LCAnY21tJ10sXG4gICAgWzEyLCAnZGV2aWNlQ2xhc3MnXSxcbiAgICBbMTYsICdjb2xvclNwYWNlJ10sXG4gICAgWzIwLCAnY29ubmVjdGlvblNwYWNlJ10sXG4gICAgWzQwLCAncGxhdGZvcm0nXSxcbiAgICBbNDgsICdtYW51ZmFjdHVyZXInXSxcbiAgICBbNTIsICdtb2RlbCddLFxuICAgIFs4MCwgJ2NyZWF0b3InXVxuICBdLmZvckVhY2goZnVuY3Rpb24oYXR0cikge1xuICAgIGlmIChoYXNDb250ZW50QXRPZmZzZXQoYnVmZmVyLCBhdHRyWzBdKSkge1xuICAgICAgcHJvZmlsZVthdHRyWzFdXSA9IGdldENvbnRlbnRBdE9mZnNldEFzU3RyaW5nKGJ1ZmZlciwgYXR0clswXSk7XG4gICAgfVxuICB9KTtcbiAgLy8gVGFnc1xuICB2YXIgdGFnQ291bnQgPSBidWZmZXIucmVhZFVJbnQzMkJFKDEyOCk7XG4gIHZhciB0YWdIZWFkZXJPZmZzZXQgPSAxMzI7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGFnQ291bnQ7IGkrKykge1xuICAgIHZhciB0YWdTaWduYXR1cmUgPSBnZXRDb250ZW50QXRPZmZzZXRBc1N0cmluZyhidWZmZXIsIHRhZ0hlYWRlck9mZnNldCk7XG4gICAgaWYgKHRhZ1NpZ25hdHVyZSBpbiB0YWdNYXApIHtcbiAgICAgIHZhciB0YWdPZmZzZXQgPSBidWZmZXIucmVhZFVJbnQzMkJFKHRhZ0hlYWRlck9mZnNldCArIDQpO1xuICAgICAgdmFyIHRhZ1NpemUgPSBidWZmZXIucmVhZFVJbnQzMkJFKHRhZ0hlYWRlck9mZnNldCArIDgpO1xuICAgICAgaWYgKHRhZ09mZnNldCA+IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIElDQyBwcm9maWxlOiBUYWcgb2Zmc2V0IG91dCBvZiBib3VuZHMnKTtcbiAgICAgIH1cbiAgICAgIHZhciB0YWdUeXBlID0gZ2V0Q29udGVudEF0T2Zmc2V0QXNTdHJpbmcoYnVmZmVyLCB0YWdPZmZzZXQpO1xuICAgICAgLy8gZGVzY1xuICAgICAgaWYgKHRhZ1R5cGUgPT09ICdkZXNjJykge1xuICAgICAgICB2YXIgdGFnVmFsdWVTaXplID0gYnVmZmVyLnJlYWRVSW50MzJCRSh0YWdPZmZzZXQgKyA4KTtcbiAgICAgICAgaWYgKHRhZ1ZhbHVlU2l6ZSA+IHRhZ1NpemUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSUNDIHByb2ZpbGU6IERlc2NyaXB0aW9uIHRhZyB2YWx1ZSBzaXplIG91dCBvZiBib3VuZHMgZm9yICcgKyB0YWdTaWduYXR1cmUpO1xuICAgICAgICB9XG4gICAgICAgIHByb2ZpbGVbdGFnTWFwW3RhZ1NpZ25hdHVyZV1dID0gYnVmZmVyLnNsaWNlKHRhZ09mZnNldCArIDEyLCB0YWdPZmZzZXQgKyB0YWdWYWx1ZVNpemUgKyAxMSkudG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICAgIC8vIHRleHRcbiAgICAgIGlmICh0YWdUeXBlID09PSAndGV4dCcpIHtcbiAgICAgICAgcHJvZmlsZVt0YWdNYXBbdGFnU2lnbmF0dXJlXV0gPSBidWZmZXIuc2xpY2UodGFnT2Zmc2V0ICsgOCwgdGFnT2Zmc2V0ICsgdGFnU2l6ZSAtIDcpLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRhZ0hlYWRlck9mZnNldCA9IHRhZ0hlYWRlck9mZnNldCArIDEyO1xuICB9XG4gIHJldHVybiBwcm9maWxlO1xufTtcbiIsInZhciBpY2MgPSByZXF1aXJlKCdpY2MnKTtcbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG52YXIgYXJyYXlCdWZmZXJDb25jYXQgPSByZXF1aXJlKCdhcnJheS1idWZmZXItY29uY2F0Jyk7XG52YXIgbG9hZEltYWdlID0gcmVxdWlyZSgnYmx1ZWltcC1sb2FkLWltYWdlJyk7XG52YXIgc2F2ZUFzID0gcmVxdWlyZSgnYnJvd3Nlci1maWxlc2F2ZXInKS5zYXZlQXM7XG5yZXF1aXJlKCdibHVlaW1wLWNhbnZhcy10by1ibG9iJyk7XG5cbmxvYWRJbWFnZS5tZXRhRGF0YVBhcnNlcnMuanBlZ1sweGZmZTJdID0gW107XG5cbmxvYWRJbWFnZS5tZXRhRGF0YVBhcnNlcnMuanBlZ1sweGZmZTJdLnB1c2goZnVuY3Rpb24gKGRhdGFWaWV3LCBvZmZzZXQsIGxlbmd0aCwgZGF0YSwgb3B0aW9ucykge1xuICB2YXIgaWNjQ2h1bmsgPSBkYXRhVmlldy5idWZmZXIuc2xpY2Uob2Zmc2V0ICsgMTgsIG9mZnNldCArIGxlbmd0aCk7XG5cbiAgaWYgKGljY0NodW5rLmJ5dGVMZW5ndGggPiAwKSB7XG4gICAgaWYgKGRhdGEuaWNjUHJvZmlsZSkge1xuICAgICAgZGF0YS5pY2NQcm9maWxlID0gYXJyYXlCdWZmZXJDb25jYXQoZGF0YS5pY2NQcm9maWxlLCBpY2NDaHVuayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEuaWNjUHJvZmlsZSA9IGljY0NodW5rO1xuICAgIH1cbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGZpbGVIYW5kbGVyIChldmVudCkge1xuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gIGV2ZW50ID0gZXZlbnQub3JpZ2luYWxFdmVudCB8fCBldmVudDtcblxuICB2YXIgdGFyZ2V0ID0gZXZlbnQuZGF0YVRyYW5zZmVyIHx8IGV2ZW50LnRhcmdldDtcblxuICB2YXIgZmlsZU9yQmxvYiA9IHRhcmdldCAmJiB0YXJnZXQuZmlsZXMgJiYgdGFyZ2V0LmZpbGVzWzBdO1xuXG4gIGlmICghZmlsZU9yQmxvYikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxvYWRJbWFnZS5wYXJzZU1ldGFEYXRhKGZpbGVPckJsb2IsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgaWYgKCFkYXRhLmltYWdlSGVhZCkge1xuICAgICAgY29uc29sZS5lcnJvcignTm8gaW1hZ2UgaGVhZGVyJywgZmlsZU9yQmxvYik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coZGF0YSk7XG5cbiAgICB2YXIgZXhpZiA9IGRhdGEuZXhpZi5nZXRBbGwoKTtcblxuICAgIC8vIGNvbnNvbGUubG9nKGV4aWYpO1xuXG4gICAgaWYgKGRhdGEuaWNjUHJvZmlsZSkge1xuICAgICAgdmFyIGJ1ZmZlciA9IG5ldyBCdWZmZXIoZGF0YS5pY2NQcm9maWxlLmJ5dGVMZW5ndGgpO1xuICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShkYXRhLmljY1Byb2ZpbGUpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgYnVmZmVyW2ldID0gdmlld1tpXTtcbiAgICAgIH1cblxuICAgICAgdmFyIHByb2ZpbGUgPSBpY2MucGFyc2UoYnVmZmVyKTtcbiAgICAgIGNvbnNvbGUuZGlyKHByb2ZpbGUpO1xuXG4gICAgICB2YXIgaWNjQmxvYiA9IG5ldyBCbG9iKFtkYXRhLmljY1Byb2ZpbGVdLCB7dHlwZTogJ2FwcGxpY2F0aW9uL3ZuZC5pY2Nwcm9maWxlJ30pO1xuXG4gICAgICBzYXZlQXMoaWNjQmxvYiwgJ3Byb2ZpbGUuaWNjJyk7XG4gICAgfVxuXG4gICAgbG9hZEltYWdlKGZpbGVPckJsb2IsIGZ1bmN0aW9uIChyZXNpemVkSW1hZ2VDYW52YXMpIHtcbiAgICAgIHJlc2l6ZWRJbWFnZUNhbnZhcy50b0Jsb2IoZnVuY3Rpb24gKHJlc2l6ZWRCbG9iKSB7XG4gICAgICAgIC8vIC8vIERvIHNvbWV0aGluZyB3aXRoIHRoZSBibG9iIG9iamVjdCxcbiAgICAgICAgLy8gLy8gZS5nLiBjcmVhdGluZyBhIG11bHRpcGFydCBmb3JtIGZvciBmaWxlIHVwbG9hZHM6XG4gICAgICAgIC8vIHZhciBmb3JtRGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgICAgICAvLyBmb3JtRGF0YS5hcHBlbmQoJ2ZpbGUnLCBibG9iLCBmaWxlTmFtZSk7XG4gICAgICAgIC8vIC8qIC4uLiAqL1xuXG4gICAgICAgIC8vIENvbWJpbmUgZGF0YS5pbWFnZUhlYWQgd2l0aCB0aGUgaW1hZ2UgYm9keSBvZiBhIHJlc2l6ZWQgZmlsZVxuICAgICAgICAvLyB0byBjcmVhdGUgc2NhbGVkIGltYWdlcyB3aXRoIHRoZSBvcmlnaW5hbCBpbWFnZSBtZXRhIGRhdGEsIGUuZy46XG4gICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IoW1xuICAgICAgICAgIGRhdGEuaW1hZ2VIZWFkLFxuICAgICAgICAgIC8vIFJlc2l6ZWQgaW1hZ2VzIGFsd2F5cyBoYXZlIGEgaGVhZCBzaXplIG9mIDIwIGJ5dGVzLFxuICAgICAgICAgIC8vIGluY2x1ZGluZyB0aGUgSlBFRyBtYXJrZXIgYW5kIGEgbWluaW1hbCBKRklGIGhlYWRlcjpcbiAgICAgICAgICBsb2FkSW1hZ2UuYmxvYlNsaWNlLmNhbGwocmVzaXplZEJsb2IsIDIwKSxcbiAgICAgICAgXSwge1xuICAgICAgICAgIHR5cGU6IHJlc2l6ZWRCbG9iLnR5cGUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNhdmVBcyhibG9iLCAnaW1hZ2UuanBnJyk7XG5cbiAgICAgIH0sXG4gICAgICAgICdpbWFnZS9qcGVnJ1xuICAgICAgKTtcblxuICAgIH0sIHtcbiAgICAgIG1heFdpZHRoOiA1MDAsXG4gICAgICBtYXhIZWlnaHQ6IDUwMCxcbiAgICAgIGNhbnZhczogdHJ1ZSxcbiAgICB9KTtcblxuICB9LCB7XG4gICAgbWF4TWV0YURhdGFTaXplOiAxMDI0MDAwLFxuICAgIGRpc2FibGVJbWFnZUhlYWQ6IGZhbHNlLFxuICB9XG4gICk7XG59XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWxlLWlucHV0JykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZmlsZUhhbmRsZXIpO1xuIl19
