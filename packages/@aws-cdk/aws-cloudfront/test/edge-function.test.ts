import '@aws-cdk/assert/jest';
import * as lambda from '@aws-cdk/aws-lambda';
import { App, Stack } from '@aws-cdk/core';
import { EdgeFunction } from '../lib';

let app: App;
let stack: Stack;

beforeEach(() => {
  app = new App();
  stack = new Stack(app, 'Stack', {
    env: { account: '111111111111', region: 'testregion' },
  });
});

describe('stacks', () => {
  test('creates a custom resource and supporting resources in main stack', () => {
    new EdgeFunction(stack, 'MyFn', defaultEdgeFunctionProps());

    expect(stack).toHaveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [{
          Action: 'ssm:GetParameter',
          Effect: 'Allow',
          Resource:
          {
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':ssm:us-east-1:111111111111:parameter/EdgeFunctionArn-MyFn']],
          },
        }],
        Version: '2012-10-17',
      },
    });
    expect(stack).toHaveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
        }],
        Version: '2012-10-17',
      },
      ManagedPolicyArns: [
        { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']] },
      ],
    });
    expect(stack).toHaveResource('Custom::AWS', {
      ServiceToken: { 'Fn::GetAtt': ['AWS679f53fac002430cb0da5b7982bd22872D164C4C', 'Arn'] },
      Create: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: 'EdgeFunctionArn-MyFn' },
        region: 'us-east-1',
        physicalResourceId: { id: '1600862714533' },
      },
      Update: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: 'EdgeFunctionArn-MyFn' },
        region: 'us-east-1',
        physicalResourceId: { id: '1600862714533' },
      },
      InstallLatestAwsSdk: true,
    });
  });
});

function defaultEdgeFunctionProps() {
  return {
    code: lambda.Code.fromInline(`exports.handler = ${helloCode}`),
    handler: 'index.handler',
    runtime: lambda.Runtime.NODEJS_12_X,
  };
}

function helloCode(_event: any, _context: any, callback: any) {
  return callback(undefined, {
    statusCode: 200,
    body: 'hello, world!',
  });
}
