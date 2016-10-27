'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const AWS = require('aws-sdk');

const annotator = require('../index.js');

const mockEvent = {Records: [{s3: {object: {key: 'test.jpg'}}}]};
const mockContext = {};

describe('Google Vision Annotation', function(){

  it('should get annotations for an image', function(done){
    this.timeout(10000);
    annotator.handler(mockEvent, mockContext, function(err, result){
      expect(err).to.be.null;
      expect(result).to.exist;
      expect(result).to.be.instanceof(Array);
      expect(result).to.have.lengthOf(1);

      const response = result[0];
      expect(response.labelAnnotations).to.be.instanceof(Array);
      expect(response.labelAnnotations).to.have.length.of.at.least(1);
      expect(response.textAnnotations).to.be.instanceof(Array);
      expect(response.textAnnotations).to.have.length.of.at.least(1);
      done();
    });
  });

});