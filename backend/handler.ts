import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { Configuration, OpenAIApi } from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const BUCKET = process.env.BUCKET!;
const TABLE = process.env.TABLE!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const s3 = new S3Client({});
const dynamo = new DynamoDBClient({});
const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));

export const main = async (event: any) => {
  try {
    const body = JSON.parse(event.body);
    const { userId, cvBase64, jobPost } = body;

    // Decode Base64 to buffer
    const buffer = Buffer.from(cvBase64, "base64");

    // Detect file type (simple check)
    let cvText = "";
    if (body.fileName?.endsWith(".pdf")) {
      const pdfData = await pdfParse(buffer);
      cvText = pdfData.text;
    } else if (body.fileName?.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      cvText = result.value;
    } else {
      throw new Error("Unsupported file type. Only PDF or DOCX allowed.");
    }

    // Call OpenAI to tailor CV
    const aiResponse = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an expert CV writer." },
        {
          role: "user",
          content: `Tailor this CV to the following job:\n${jobPost}\n\nCV:\n${cvText}`,
        },
      ],
      max_tokens: 1500,
    });

    const tailoredCV = aiResponse.data.choices[0].message?.content || "";

    // Save original CV to S3
    const timestamp = Date.now();
    const originalKey = `original/${userId}-${timestamp}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: originalKey,
        Body: buffer,
      })
    );

    // Save tailored CV to S3
    const tailoredKey = `tailored/${userId}-${timestamp}.txt`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: tailoredKey,
        Body: tailoredCV,
      })
    );

    // Store metadata in DynamoDB
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          userId: { S: userId },
          timestamp: { S: new Date(timestamp).toISOString() },
          s3OriginalKey: { S: originalKey },
          s3TailoredKey: { S: tailoredKey },
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ tailoredCV, s3Key: tailoredKey }),
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
