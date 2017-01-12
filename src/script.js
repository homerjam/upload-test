var icc = require('icc');
var Buffer = require('buffer').Buffer;
var arrayBufferConcat = require('array-buffer-concat');
var loadImage = require('blueimp-load-image');
var saveAs = require('browser-filesaver').saveAs;
require('blueimp-canvas-to-blob');

// Create parser array for APP2 segment
loadImage.metaDataParsers.jpeg[0xffe2] = [];

// Add parser
loadImage.metaDataParsers.jpeg[0xffe2].push(function (dataView, offset, length, data, options) {
  // Grab the ICC profile from the APP2 segment(s) of the header
  var iccChunk = dataView.buffer.slice(offset + 18, offset + length);

  if (iccChunk.byteLength > 0) {
    if (data.iccProfile) {
      // Profile is split accross multiple segments so we need to concatenate the chunks
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
    // if (!data.imageHead) {
    //   console.error('No image header');
    //   return;
    // }

    var exif = data.exif.getAll();
    console.log('exif:');
    console.dir(exif);

    if (data.iccProfile) {
      // Convert the profile ArrayBuffer into a normal buffer for the `icc` parser module
      var buffer = new Buffer(data.iccProfile.byteLength);
      var view = new Uint8Array(data.iccProfile);
      for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
      }

      // Parse the profile
      var profile = icc.parse(buffer);
      console.log('profile:');
      console.dir(profile);

      // Just for fun convert the profile into a blob for download
      var iccBlob = new Blob([data.iccProfile], {
        type: 'application/vnd.iccprofile'
      });

      saveAs(iccBlob, 'profile.icc');
    }

    loadImage(fileOrBlob, function (resizedImageCanvas) {
      resizedImageCanvas.toBlob(function (resizedBlob) {
          var parts = [];

          if (data.imageHead) {
            // Combine data.imageHead with the image body of a resized file
            // to create scaled images with the original image meta data, e.g.:
            parts.push(data.imageHead);

            // Resized images always have a head size of 20 bytes,
            // including the JPEG marker and a minimal JFIF header:
            parts.push(loadImage.blobSlice.call(resizedBlob, 20));

          } else {
            parts.push(resizedBlob);
          }

          var blob = new Blob(parts, {
            type: resizedBlob.type,
          });

          // Download the resized image
          saveAs(blob, fileOrBlob.type.replace('/', '.'));

        },
        fileOrBlob.type
      );

    }, {
      maxWidth: 500,
      maxHeight: 500,
      canvas: true,
    });

  }, {
    // Increase the metadata size for CMYK profiles
    // these are larger as they contain more info
    // required to convert the colorspace(?):
    maxMetaDataSize: 1024000,
    disableImageHead: false,
  });
}

document.getElementById('file-input').addEventListener('change', fileHandler);