import * as cxapi from '@aws-cdk/cx-api';
import { Test } from 'nodeunit';
import { FeatureFlags } from '../lib';
import { TestStack } from './util';

export = {
  isEnabled: {
    'returns true when the flag is enabled'(test: Test) {
      const stack = new TestStack();
      stack.node.setContext(cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT, true);

      const actual = FeatureFlags.of(stack).isEnabled(cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT);
      test.equals(actual, true);
      test.done();
    },

    'falls back to the default'(test: Test) {
      const stack = new TestStack();

      test.equals(FeatureFlags.of(stack).isEnabled(cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT),
        cxapi.futureFlagDefault(cxapi.NEW_STYLE_STACK_SYNTHESIS_CONTEXT));
      test.done();
    },

    'invalid flag'(test: Test) {
      const stack = new TestStack();

      test.equals(FeatureFlags.of(stack).isEnabled('non-existent-flag'), undefined);
      test.done();
    },
  },
}