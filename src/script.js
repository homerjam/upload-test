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

function fileHandler (event) {
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

      var iccBlob = new Blob([data.iccProfile], {type: 'application/vnd.iccprofile'});

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
        var blob = new Blob([
          data.imageHead,
          // Resized images always have a head size of 20 bytes,
          // including the JPEG marker and a minimal JFIF header:
          loadImage.blobSlice.call(resizedBlob, 20),
        ], {
          type: resizedBlob.type,
        });

        saveAs(blob, 'image.jpg');

      },
        'image/jpeg'
      );

    }, {
      maxWidth: 500,
      maxHeight: 500,
      canvas: true,
    });

  }, {
    maxMetaDataSize: 1024000,
    disableImageHead: false,
  }
  );
}

document.getElementById('file-input').addEventListener('change', fileHandler);
