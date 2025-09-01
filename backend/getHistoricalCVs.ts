import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand, GetObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const TABLE = process.env.TABLE!;
const BUCKET = process.env.BUCKET!;

const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});

export const main = async (event: any) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing userId" }) };
    }

    const queryCmd = new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": { S: userId } },
      ScanIndexForward: false, 
    });

    const result = await dynamo.send(queryCmd);
    const items = result.Items || [];

    const historicalCVs = await Promise.all(
      items.map(async (item) => {
        const s3Key = item.s3TailoredKey.S!;
        const fileName = item.fileName.S!;
        const timestamp = item.timestamp.S!;

        const getObjectParams: GetObjectCommandInput = {
          Bucket: BUCKET,
          Key: s3Key,
        };

        const signedUrl = await getSignedUrl(s3, new GetObjectCommand(getObjectParams), { expiresIn: 3600 }); // 1 hour

        return { fileName, timestamp, url: signedUrl };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ historicalCVs }),
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
