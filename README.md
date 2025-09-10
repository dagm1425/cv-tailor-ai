# CV Tailor AI

CV Tailor AI is a web app that uses AI to tailor user CVs to specific job postings

## Features

- Upload a PDF or Word CV and a job posting description.
- Tailor the CV using OpenAI’s GPT-4 API.
- Generate and download the tailored CV as a PDF.
- Save tailored CVs in AWS S3 and store metadata in DynamoDB.
- Retrieve historical tailored CVs with presigned download links.
- Full AWS infrastructure managed via AWS CDK.

## Technologies & Tools

- **Frontend:** React, TypeScript, jsPDF
- **Backend:** AWS Lambda (Node.js 18)
- **Cloud & Infrastructure:** AWS CDK, API Gateway, S3, DynamoDB
- **AI Integration:** OpenAI GPT-4 API
- **File Handling:** PDF and DOCX parsing for CV text extraction

## AWS CDK Resources

- **S3 Bucket:** Stores tailored CV PDFs.
- **DynamoDB Table:** Stores metadata for historical CVs including userId, timestamp, and file name.
- **Lambda Functions:**
  - `TailorCVLambda` – Processes and tailors CVs using OpenAI API.
  - `GetHistoricalCVsLambda` – Retrieves historical CVs and generates presigned download URLs.
- **API Gateway:** Exposes endpoints for CV tailoring (`/tailor-cv`) and historical CV retrieval (`/historical-cvs`) with CORS enabled.

  > The app’s core functionalities are fully implemented; only final styling and deployment remain. 

