import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Configuration, OpenAIApi } from 'openai';
import pdfParse from 'pdf-parse';

const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient();

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

interface CVRequestBody {
  jobDescription: string;
  fileName: string;
  fileContentBase64: string;
  userId: string;
}

export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) throw new Error('Missing request body');

    const body: CVRequestBody = JSON.parse(event.body);
    const { jobDescription, fileName, fileContentBase64, userId } = body;

    const buffer = Buffer.from(fileContentBase64, 'base64');

    // parse PDF or text
    const textContent = fileName.endsWith('.pdf') ? (await pdfParse(buffer)).text : buffer.toString('utf-8');

    // OpenAI API
    const prompt = `Job Description:\n${jobDescription}\n\nCandidate CV:\n${textContent}\n\nGenerate a tailored CV emphasizing relevant skills and experiences.`;

    const aiResponse = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });

    const tailoredCV = aiResponse.data.choices[0].message?.content || '';

    // Save to S3
    const origKey = `original/${userId}/${fileName}`;
    const tailoredKey = `tailored/${userId}/${fileName}`;

    await s3.putObject({ Bucket: process.env.BUCKET!, Key: origKey, Body: buffer }).promise();
    await s3.putObject({ Bucket: process.env.BUCKET!, Key: tailoredKey, Body: tailoredCV }).promise();

    // Save metadata
    await dynamo.put({
      TableName: process.env.TABLE!,
      Item: { userId, timestamp: new Date().toISOString(), jobTitle: 'Uploaded CV', originalKey: origKey, tailoredKey },
    }).promise();

    return { statusCode: 200, body: JSON.stringify({ tailoredCV, downloadKey: tailoredKey }) };

  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
