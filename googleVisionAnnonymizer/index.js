'use strict';

const AWS = require('aws-sdk');
const fs = require('fs');
const https = require('https');
const gm = require('gm').subClass({imageMagick:true});

const s3 = new AWS.S3();
const s3Bucket = 'coblr-vision-annotated';
const s3Params = {Bucket: s3Bucket};

      // the results get stored in the annotations array
const annotations = [];

      // prefixed with 'g', stuff we need to identify
      // and request data from the Google Cloud API.
const gAPIKey = process.env.GOOGLE_CLOUD_API_KEY;
const gHTTPOptions = {
        method: 'POST',
        host: `vision.googleapis.com`,
        path: `/v1/images:annotate?key=${gAPIKey}`,
        headers: {'Content-Type': 'application/json'}
      };
const gPayload = {
        'requests': [{
          'image': {'content': null},
          'features': [{
            'type': 'FACE_DETECTION','maxResults': 10
          },{
            'type': 'TEXT_DETECTION','maxResults': 10
          },{
            'type': 'LABEL_DETECTION','maxResults': 10
          }]
        }]
      };

// we'll store the image here to manipulate later.
let imageBuffer;

// handlerCallback will be the callback function. we store
// it out here so that it can be used by any method below
// without having to pass it along.
let handlerCallback;

////////////

exports.handler = (event, context, callback) => {
  handlerCallback = callback;
  s3Params.Key = event.Records[0].s3.object.key;
  console.log('Requesting image data from S3...');
  s3.getObject(s3Params, function(err, data){
    console.log('Image data recieved.');
    imageBuffer = data.Body;
    getAnnotations();
  });
}

function getAnnotations(){
  // google is expecting a base64 encoded image
  gPayload.requests[0].image.content = imageBuffer.toString('base64');

  console.log('Requesting annotations from Google Vision API...')
  const req = _buildGoogleRequest();
  req.write(JSON.stringify(gPayload));
  req.end();
}

////////////

function _buildGoogleRequest(){
  const req = https.request(gHTTPOptions, _onGoogleResponse);
  req.on('error', _onGoogleResponseErr);
  return req;
}

function _onGoogleResponse(res){
  res.setEncoding('utf8');
  res.on('data', _onGoogleData);
  res.on('end', _onGoogleEnd);
}

function _onGoogleResponseErr(err){
  console.error('Problem with Google Cloud request:\n', JSON.stringify(err, true, 2));
  handlerCallback(err);
}

function _onGoogleData(chunk){
  annotations.push(chunk);
}

function _onGoogleEnd(){
  console.log('Annotations recieved.');
  const detections = _parseAnnotations(annotations)[0].faceAnnotations;

  // const anonImg = gm(imageBuffer);
  // for(let a=0; a<detections.length; a++){
  //   const polys = detections[a].fdBoundingPoly;
  //   const dWidth = polys.x[1] - polys.x[0];
  //   const dHeight = polys.y[2] - polys.y[1];

  //   anonImg
  //     .region(dWidth, dHeight, polys.x[0], polys.y[0])
  //     .blur(20, 50);
  // }

  // anonImg.toBuffer(function(err, buffer){
  //   const putParams = JSON.parse(JSON.stringify(s3Params));
  //   putParams.Key = putParams.Key.replace(/\.(jpg|jpeg|gif|png)$/, '-annon.$1');
  //   putParams.Body = buffer;

  //   console.log(`Creating '${putParams.Key}' in the '${putParams.Bucket}' bucket.`)
  //   s3.putObject(putParams, function(err, data){
  //     if(err){
  //       console.error(err);
  //       return handlerCallback(err);
  //     }
  //     console.log('Annonymization Successful!');
  //     return handlerCallback(null, buffer);
  //   });
  // });

}

function _parseAnnotations(annotations){
  // the annotations object is actually a complete
  // response from the google API, so we need to prepare it.
  const responses = JSON.parse(annotations.join('')).responses;

  console.log('RESPONSE:', JSON.parse(annotations.join('')).responses[0]);

  // // reduce the depth of coords for text bounding polys
  // // it saves space in the meta data
  // for(let a=0, a1=responses.length; a<a1; a++){
  //   const response = responses[a];
  //   const faceAnnotations = response.faceAnnotations;
  //   for(let b=0, b1=faceAnnotations.length; b<b1; b++){
  //     const annotation = faceAnnotations[b];
  //     const poly = annotation.fdBoundingPoly;
  //     for(let c=0, c1=poly.vertices.length; c<c1; c++){
  //       const vert = poly.vertices[c];
  //       poly.x = poly.x || [];
  //       poly.x.push(vert.x);
  //       poly.y = poly.y || [];
  //       poly.y.push(vert.y);
  //     }
  //     delete poly.vertices;
  //   }
  // }
  return responses;
}