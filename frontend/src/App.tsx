import { useEffect, useState } from "react";
import jsPDF from "jspdf";

const apiEndpoint = "YOUR_API_GATEWAY_URL"; 
const tailorEndpoint = `${apiEndpoint}/tailor-cv`;
const historicalEndpoint = `${apiEndpoint}/historical-cvs`;


interface AppProps {
  user: any;
  signOut: () => void;
}

interface HistoricalCV {
  fileName: string;
  timestamp: string;
  url: string;
}


const App: React.FC<AppProps> = ({ user, signOut }) => {
  const [file, setFile] = useState<File | null>(null);
  const [jobPost, setJobPost] = useState<string>("");
  const [tailoredCV, setTailoredCV] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [historicalCVs, setHistoricalCVs] = useState<HistoricalCV[]>([]);

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

  const handleSubmit = async () => {
    if (!file || !jobPost) return alert("Select a CV and enter job post");

    const maxFileSize = 5 * 1024 * 1024; 
    if (file.size > maxFileSize) {
      return alert("File size must be less than 5 MB");
    }

    if (jobPost.length < 50) {
      return alert("Job post text is too short (min 50 characters).");
    }
    if (jobPost.length > 2000) {
      return alert("Job post text is too long (max 2000 characters).");
    }

    setLoading(true);
    
    try {
      const userId = user.attributes.sub;
      const cvBase64 = await fileToBase64(file);

      const payload = {
        userId,
        fileName: file.name,
        cvBase64,
        jobPost,
      };

      const res = await fetch(tailorEndpoint, {
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

  const downloadPDF = () => {
    if (!tailoredCV) return;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(tailoredCV, 180);
    doc.text(lines, 10, 10);
    doc.save("Tailored_CV.pdf");
  };

  const fetchHistoricalCVs = async () => {
    if (!user) return;
    try {
      const userId = user.attributes.sub;
      const res = await fetch(`${historicalEndpoint}?userId=${userId}`);
      const json = await res.json();
      const data: HistoricalCV[] = json.historicalCVs || [];
      setHistoricalCVs(data);
    } catch (err) {
      console.error("Error fetching historical CVs:", err);
    }
  };

  const downloadHistoricalCV = (cv: HistoricalCV) => {
    if (!cv.url) return;
    window.open(cv.url, "_blank");
  };

  useEffect(() => {
    fetchHistoricalCVs();
  }, [user]);


  return (
        <>
      <div>
        <h1>Welcome {user?.username}</h1>
        <button onClick={signOut}>Sign out</button>
      </div>

      <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
        <h1>CV Tailor AI</h1>

        <div style={{ marginBottom: "1rem" }}>
          <label>Upload CV (PDF or Word): </label>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
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
            <button
              onClick={downloadPDF}
              style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
            >
              Download as PDF
            </button>
          </div>
        )}

        {historicalCVs.length > 0 && (
          <div style={{ marginTop: "3rem" }}>
            <h2>Historical Tailored CVs</h2>
            <ul>
              {historicalCVs.map((cv, i) => (
                <li key={i} style={{ marginBottom: "0.5rem" }}>
                  <span>{cv.fileName} ({new Date(cv.timestamp).toLocaleDateString()}) </span>
                  <button onClick={() => downloadHistoricalCV(cv)}>Download</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
