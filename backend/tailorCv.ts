import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const BUCKET = process.env.BUCKET!;
const TABLE = process.env.TABLE!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const s3 = new S3Client({});
const dynamo = new DynamoDBClient({});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const generatePDFBuffer = async (text: string) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;

  let y = height - 50;
  for (const line of text.split("\n")) {
    page.drawText(line, { x: 50, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize + 4;
    if (y < 50) break;
  }

  return pdfDoc.save();
};

export const main = async (event: any) => {
  try {
    const body = JSON.parse(event.body);
    const { userId, cvBase64, jobPost } = body;

    const buffer = Buffer.from(cvBase64, "base64");

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

    const systemPrompt = "You are an expert CV writer.";

    const userPrompt = `Your task is to revise the provided CV to align perfectly with the job description.
      Focus on the following areas:
      - Highlight relevant skills and experiences.
      - Rephrase bullet points to use keywords from the job description.
      - Ensure the summary or objective is directly relevant to the role.

      Do not add new information not present in the original CV. Return the tailored CV text only, without any conversational or introductory text.

      Job Description:
      ${jobPost}

      Original CV:
      ${cvText}
    `;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 1500,
    });
    const tailoredCV = aiResponse.choices[0].message?.content || "";

    const timestamp = Date.now();
    const pdfBuffer = await generatePDFBuffer(tailoredCV);
    const tailoredKey = `tailored/${userId}-${timestamp}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: tailoredKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

   await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        userId: { S: userId },
        timestamp: { S: new Date(timestamp).toISOString() },
        fileName: { S: `tailored-cv-${new Date(timestamp).toISOString().split("T")[0]}.pdf` },
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

