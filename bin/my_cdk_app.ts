#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyCdkAppStack } from '../lib/my_cdk_app-stack';

const app = new cdk.App();

new MyCdkAppStack(app, 'MyCdkAppStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});





