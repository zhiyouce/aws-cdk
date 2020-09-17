import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ssm from '@aws-cdk/aws-ssm';
import {
  App, BootstraplessSynthesizer, Construct, ConstructNode, DefaultStackSynthesizer, IStackSynthesizer,
  ResourceEnvironment, Stack, StackProps, Token,
} from '@aws-cdk/core';
import * as resources from '@aws-cdk/custom-resources';

/** Properties for creating a Lambda@Edge function */
export interface EdgeFunctionProps extends lambda.FunctionProps { }

/**
 * A Lambda@Edge function.
 *
 * Convenience construct for requesting a Lambda function in the 'us-east-1' region for use with Lambda@Edge.
 * Implements several restrictions enforced by Lambda@Edge.
 */
export class EdgeFunction extends Construct implements lambda.IVersion {

  private static readonly EDGE_REGION: string = 'us-east-1';

  public readonly edgeArn: string;
  public readonly functionName: string;
  public readonly functionArn: string;
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly isBoundToVpc = false;
  public readonly lambda: lambda.IFunction;
  public readonly permissionsNode: ConstructNode;
  public readonly role?: iam.IRole;
  public readonly version: string;

  public readonly stack: Stack;
  public readonly env: ResourceEnvironment;

  private readonly functionStack: CrossRegionLambdaStack;
  private readonly currentVersion: lambda.IVersion;

  constructor(scope: Construct, id: string, props: EdgeFunctionProps) {
    super(scope, id);

    this.stack = Stack.of(this);
    this.env = {
      account: this.stack.account,
      region: this.stack.region,
    };

    this.functionStack = this.getOrCreateEdgeStack();
    this.stack.addDependency(this.functionStack);

    const parameterName = `EdgeFunctionArn-${id}`;
    const { edgeFunction, currentVersion } = this.functionStack.addEdgeFunction(id, parameterName, props);
    this.currentVersion = currentVersion;

    const parameterArn = this.stack.formatArn({
      service: 'ssm',
      region: EdgeFunction.EDGE_REGION,
      resource: 'parameter',
      resourceName: parameterName,
    });

    const customResource = new resources.AwsCustomResource(scope, `${id}FunctionArnReader`, {
      policy: resources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameter'],
          resources: [parameterArn],
        }),
      ]),
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: { Name: parameterName },
        region: EdgeFunction.EDGE_REGION,
        // Update physical id to always fetch the latest version
        physicalResourceId: resources.PhysicalResourceId.of(Date.now().toString()),
      },
    });

    this.functionArn = customResource.getResponseField('Parameter.Value');
    // this.lambda = lambda.Function.fromFunctionArn(this, 'ImportedFn', this.functionArn);
    this.lambda = edgeFunction;
    this.functionName = this.lambda.functionName;
    this.grantPrincipal = this.lambda.role!; // TODO - Does this work, or does it need to be imported?
    this.permissionsNode = this.lambda.permissionsNode;
    this.edgeArn = this.functionArn;
    this.version = lambda.extractQualifierFromArn(this.functionArn);
  }

  /**
   * Not supported. Connections are only applicable to VPC-enabled functions.
   */
  public get connections(): ec2.Connections {
    throw new Error('Lambda@Edge does not support connections');
  }
  public get latestVersion(): lambda.IVersion {
    throw new Error('$LATEST function version cannot be used for Lambda@Edge');
  }

  public addEventSourceMapping(id: string, options: lambda.EventSourceMappingOptions): lambda.EventSourceMapping {
    return this.lambda.addEventSourceMapping(id, options);
  }
  public addPermission(id: string, permission: lambda.Permission): void {
    return this.lambda.addPermission(id, permission);
  }
  public addToRolePolicy(statement: iam.PolicyStatement): void {
    return this.lambda.addToRolePolicy(statement);
  }
  public grantInvoke(identity: iam.IGrantable): iam.Grant {
    return this.lambda.grantInvoke(identity);
  }
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metric(metricName, { ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricDuration({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricErrors({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricInvocations({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricThrottles(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricThrottles({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public addEventSource(source: lambda.IEventSource): void {
    return this.lambda.addEventSource(source);
  }
  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    return this.lambda.configureAsyncInvoke(options);
  }

  public addAlias(aliasName: string, options: lambda.AliasOptions = {}): lambda.Alias {
    return new lambda.Alias(this.functionStack, `Alias${aliasName}`, {
      aliasName,
      version: this.currentVersion,
      ...options,
    });
  }

  private getOrCreateEdgeStack(): CrossRegionLambdaStack {
    const app = this.node.root;
    if (!app || !App.isApp(app)) {
      throw new Error('Stacks which use EdgeFunctions must be part of a CDK app');
    }
    const region = this.env.region;
    if (Token.isUnresolved(region)) {
      throw new Error('Stacks which use EdgeFunctions must have an explicitly set region');
    }

    const edgeStackId = `edge-lambda-stack-${region}`;
    let edgeStack = app.node.tryFindChild(edgeStackId) as CrossRegionLambdaStack;
    if (!edgeStack) {
      edgeStack = new CrossRegionLambdaStack(this, edgeStackId, {
        synthesizer: this.getCrossRegionSupportSynthesizer(),
        env: { region: EdgeFunction.EDGE_REGION },
      });
    }
    return edgeStack;
  }

  // Stolen from `@aws-cdk/aws-codepipeline`'s `Pipeline`.
  private getCrossRegionSupportSynthesizer(): IStackSynthesizer | undefined {
    // If we have the new synthesizer we need a bootstrapless copy of it,
    // because we don't want to require bootstrapping the environment
    // of the account in this replication region.
    // Otheriwse, return undefined to use the default.
    return (this.stack.synthesizer instanceof DefaultStackSynthesizer)
      ? new BootstraplessSynthesizer({
        deployRoleArn: this.stack.synthesizer.deployRoleArn,
        cloudFormationExecutionRoleArn: this.stack.synthesizer.cloudFormationExecutionRoleArn,
      })
      : undefined;
  }
}

class CrossRegionLambdaStack extends Stack {

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
  }

  public addEdgeFunction(id: string, parameterName: string, props: lambda.FunctionProps) {
    const role = props.role || new iam.Role(this, `${id}FnServiceRole`, {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('edgelambda.amazonaws.com'),
      ),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const edgeFunction = new lambda.Function(this, `${id}Fn`, {
      ...props,
      role,
    });
    const currentVersion = edgeFunction.currentVersion;

    new ssm.StringParameter(this, `${id}ArnParameter`, {
      parameterName,
      stringValue: currentVersion.functionArn,
    });

    return { edgeFunction, currentVersion };
  }
}

