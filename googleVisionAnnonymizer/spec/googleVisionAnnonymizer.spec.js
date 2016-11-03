'use strict';

const chai = require('chai');
const expect = chai.expect;
const AWS = require('aws-sdk');

const annonymizer = require('../index.js');

const mockEvent = {Records: [{s3: {object: {key: 'face-test.jpg'}}}]};
const mockContext = {};

describe('Google Vision Annonymizer', function(){

  it('should get bounding polys of any face found in an image', function(done){
    this.timeout(15000);
    annonymizer.handler(mockEvent, mockContext, function(err, result){
      expect(err).to.be.null;
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      done();
    });
  });

});