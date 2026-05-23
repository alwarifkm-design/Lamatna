import { Route, Routes } from "react-router-dom";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { AdminPage } from "./pages/AdminPage";
import { DisplayPage } from "./pages/DisplayPage";
import { PlayPage } from "./pages/PlayPage";

export default function App() {
  return (
    <>
      <ConnectionBanner />
      <Routes>
      <Route path="/" element={<DisplayPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/play" element={<PlayPage />} />
      </Routes>
    </>
  );
}
