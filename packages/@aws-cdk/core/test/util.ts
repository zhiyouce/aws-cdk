import * as cxapi from '@aws-cdk/cx-api';
import { Stack, Construct, StackProps } from '../lib';
import { synthesize } from '../lib/private/synthesis';

/**
 * A stack that doesn't include the Metadata Resource by default
 *
 * This is necessary because mosts of the tests in this module do a deepEqual()
 * on the synthesized template, so we can't have extraneous resources
 * added to it.
 */
export class TestStack extends Stack {
  constructor(scope?: Construct, id?: string, props?: StackProps) {
    super(scope, id, props);
    this.node.setContext(cxapi.DISABLE_VERSION_REPORTING, true);
  }
}

export function toCloudFormation(stack: Stack): any {
  return synthesize(stack, { skipValidation: true }).getStackByName(stack.stackName).template;
}

export function reEnableStackTraceCollection(): any {
  const previousValue = process.env.CDK_DISABLE_STACK_TRACE;
  process.env.CDK_DISABLE_STACK_TRACE = '';
  return previousValue;
}

export function restoreStackTraceColection(previousValue: any): void {
  process.env.CDK_DISABLE_STACK_TRACE = previousValue;
}
