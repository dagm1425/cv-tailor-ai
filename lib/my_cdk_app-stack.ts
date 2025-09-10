import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class MyCdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'CVBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN, 
      autoDeleteObjects: true,
    });

    const table = new dynamodb.Table(this, 'CVMetadataTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN, 
    });

    const api = new apigateway.RestApi(this, 'CVApi', {
      restApiName: 'CV Service',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'], 
        allowMethods: ['GET', 'POST', 'OPTIONS'],
      },
    });

    const tailorLambda = new lambda.Function(this, 'TailorCVLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'tailorCv.main',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        BUCKET: bucket.bucketName,
        TABLE: table.tableName,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
      },
    });

    const tailorResource = api.root.resourceForPath('tailor-cv');
    tailorResource.addMethod('POST', new apigateway.LambdaIntegration(tailorLambda));
    tailorResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST', 'OPTIONS'],
    });

    const historicalLambda = new lambda.Function(this, 'GetHistoricalCVsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getHistoricalCVs.main',
      code: lambda.Code.fromAsset('backend/dist'),
      environment: {
        BUCKET: bucket.bucketName,
        TABLE: table.tableName,
      },
    });

    const historicalResource = api.root.resourceForPath('historical-cvs');
    historicalResource.addMethod('GET', new apigateway.LambdaIntegration(historicalLambda));
    historicalResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['GET', 'OPTIONS'],
    });

    bucket.grantReadWrite(tailorLambda);
    bucket.grantRead(historicalLambda);

    table.grantReadWriteData(tailorLambda);
    table.grantReadData(historicalLambda);

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
    });
  }
}
