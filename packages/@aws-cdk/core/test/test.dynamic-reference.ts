import { Test } from 'nodeunit';
import { CfnDynamicReference, CfnDynamicReferenceService } from '../lib';
import { TestStack } from './util';

export = {
  'can create dynamic references with service and key with colons'(test: Test) {
    // GIVEN
    const stack = new TestStack();

    // WHEN
    const ref = new CfnDynamicReference(CfnDynamicReferenceService.SSM, 'a:b:c');

    // THEN
    test.equal(stack.resolve(ref), '{{resolve:ssm:a:b:c}}');

    test.done();
  },
};
