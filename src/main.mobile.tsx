import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AndroidApp } from "./mobile/AndroidApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AndroidApp />
  </StrictMode>,
);
