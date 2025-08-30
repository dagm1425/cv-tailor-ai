// App.tsx
import React, { useState } from "react";
import { Auth } from "aws-amplify";

const apiEndpoint = "YOUR_API_GATEWAY_URL"; // replace with CfnOutput from CDK

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobPost, setJobPost] = useState("");
  const [tailoredCV, setTailoredCV] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Get Cognito userId
  const getUserId = async (): Promise<string> => {
    const user = await Auth.currentAuthenticatedUser();
    return user.attributes.sub; // unique Cognito ID
  };

  // 2. Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result?.toString().split(",")[1];
        if (base64) resolve(base64);
        else reject("Failed to convert file to Base64");
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 3. Handle submit
  const handleSubmit = async () => {
    if (!file || !jobPost) return alert("Select a CV and enter job post");

    setLoading(true);
    try {
      const userId = await getUserId();
      const cvBase64 = await fileToBase64(file);

      const payload = {
        userId,
        fileName: file.name,
        cvBase64,
        jobPost,
      };

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTailoredCV(data.tailoredCV || "");
      alert("CV tailored successfully!");
    } catch (err) {
      console.error(err);
      alert("Error generating tailored CV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>CV Tailor AI</h1>

      <div style={{ marginBottom: "1rem" }}>
        <label>Upload CV (PDF or Word): </label>
        <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Job Posting Text: </label>
        <textarea
          value={jobPost}
          onChange={(e) => setJobPost(e.target.value)}
          rows={8}
          style={{ width: "100%" }}
        />
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Generating..." : "Tailor CV"}
      </button>

      {tailoredCV && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Tailored CV Preview</h2>
          <textarea rows={15} value={tailoredCV} readOnly style={{ width: "100%" }} />
        </div>
      )}
    </div>
  );
};

export default App;
