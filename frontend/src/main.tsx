import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports.js";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(awsExports);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Authenticator>
      {({ signOut, user }) => (
        <App user={user} signOut={signOut ?? (() => {})} />
      )}
    </Authenticator>
  </StrictMode>
);
