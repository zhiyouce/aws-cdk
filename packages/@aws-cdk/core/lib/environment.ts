import { Aws } from "./cfn-pseudo";

/**
 * The deployment environment for a stack.
 */
export interface Environment {
  /**
   * The AWS account ID for this environment.
   *
   * This can be either a concrete value such as `585191031104` or `Aws.accountId` which
   * indicates that account ID will only be determined during deployment (it
   * will resolve to the CloudFormation intrinsic `{"Ref":"AWS::AccountId"}`).
   * Note that certain features, such as cross-stack references and
   * environmental context providers require concerete region information and
   * will cause this stack to emit synthesis errors.
   *
   * @default Aws.accountId which means that the stack will be account-agnostic.
   */
  readonly account?: string;

  /**
   * The AWS region for this environment.
   *
   * This can be either a concrete value such as `eu-west-2` or `Aws.region`
   * which indicates that account ID will only be determined during deployment
   * (it will resolve to the CloudFormation intrinsic `{"Ref":"AWS::Region"}`).
   * Note that certain features, such as cross-stack references and
   * environmental context providers require concerete region information and
   * will cause this stack to emit synthesis errors.
   *
   * @default Aws.region which means that the stack will be region-agnostic.
   */
  readonly region?: string;
}

/**
 * Static helper routines around environments
 */
export abstract class Environments {
  /**
   * An agnostic environment
   *
   * Stacks created using an agnostic environment can be deployed to any
   * account and region.
   *
   * The flip side is that they cannot be effectively specialized for the
   * target environment, and may not be able to take advantage of all of CDK's
   * features.
   */
  public static agnostic(): Environment {
    return {
      account: Aws.ACCOUNT_ID,
      region: Aws.REGION,
    };
  }

  /**
   * An environment that gets its target from the current AWS credentials
   *
   * The environment will be determined by the current AWS credentials and
   * configuration (such as configured using the `AWS_*` environment variables,
   * or in `~/.aws/config`) available to the CDK CLI.
   *
   * It is an error if there are no such credentials available.
   */
  public static fromAwsCredentials(): Environment {
    const account = process.env.DEFAULT_CDK_ACCOUNT;
    const region = process.env.DEFAULT_CDK_REGION;
    if (!account) {
      throw new Error(`Environments.fromAwsCredentials(): $DEFAULT_CDK_ACCOUNT is not set, are you running with AWS credentials?`);
    }
    if (!region) {
      // Actually can't happen because the CLI will always default to 'us-east-1', check
      // for it regardless in case we have other runners.
      throw new Error(`Environments.fromAwsCredentials(): $DEFAULT_CDK_REGION is not set, are you running with AWS credentials?`);
    }

    return { account, region };
  }

  private constructor() {
  }
}