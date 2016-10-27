'use strict';

const AWS = require('aws-sdk'),
      fs = require('fs'),
      https = require('https');

const s3 = new AWS.S3(),
      s3Bucket = 'coblr-vision-annotated',
      s3Params = {Bucket: s3Bucket},

      // the results get stored in the annotations array
      annotations = [],

      // prefixed with 'g', stuff we need to identify
      // and request data from the Google Cloud API.
      gAPIKey = process.env.GOOGLE_CLOUD_API_KEY,
      gHTTPOptions = {
        method: 'POST',
        host: `vision.googleapis.com`,
        path: `/v1/images:annotate?key=${gAPIKey}`,
        headers: {'Content-Type': 'application/json'}
      },
      gPayload = {
        'requests': [{
          'image': {'content': null},
          'features': [{'type': 'LABEL_DETECTION','maxResults': 10},{'type': 'TEXT_DETECTION','maxResults': 10}]
        }]
      };

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
    gPayload.requests[0].image.content = data.Body.toString('base64');
    getAnnotations();
  });
}

function getAnnotations(){
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
  const final = _parseAnnotations(annotations);

  const copyParams = JSON.parse(JSON.stringify(s3Params));
  copyParams.CopySource = `${s3Params.Bucket}/${s3Params.Key}`;
  copyParams.MetadataDirective = 'REPLACE';
  copyParams.Metadata = s3Params.Metadata || {};
  copyParams.Metadata['x-amz-google-annotations'] = JSON.stringify(final);

  s3.copyObject(copyParams, function(err, data){
    if(err){
      console.error(err);
      return handlerCallback(err);

    }
    console.log('copy successful');
    return handlerCallback(null, final);
  });
}

function _parseAnnotations(annotations){
  // the annotations object is actually a complete
  // response from the google API, so we need to prepare it.
  const responses = JSON.parse(annotations.join('')).responses;

  // reduce the depth of coords for text bounding polys
  // it saves space in the meta data
  for(let a=0, a1=responses.length; a<a1; a++){
    const response = responses[a];
    const textAnnotations = response.textAnnotations;
    for(let b=0, b1=textAnnotations.length; b<b1; b++){
      const annotation = textAnnotations[b];
      const poly = annotation.boundingPoly;
      for(let c=0, c1=poly.vertices.length; c<c1; c++){
        const vert = poly.vertices[c];
        poly.x = poly.x || [];
        poly.x.push(vert.x);
        poly.y = poly.y || [];
        poly.y.push(vert.y);
      }
      delete poly.vertices;
    }
  }
  return responses;
}