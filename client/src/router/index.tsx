import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/app/layout/AppLayout";

const SpeechPage = lazy(() => import("@/features/speech/SpeechPage"));
const VoicesPage = lazy(() => import("@/features/voices/VoicesPage"));
const VoiceChangerPage = lazy(() => import("@/features/voice-changer/VoiceChangerPage"));
const SoundEffectsPage = lazy(() => import("@/features/sound-effects/SoundEffectsPage"));
const HistoryPage = lazy(() => import("@/features/history/HistoryPage"));

function page(element: React.ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: page(<SpeechPage />) },
      { path: "voices", element: page(<VoicesPage />) },
      { path: "voice-changer", element: page(<VoiceChangerPage />) },
      { path: "sound-effects", element: page(<SoundEffectsPage />) },
      { path: "history", element: page(<HistoryPage />) },
      // Old URLs from the previous layout.
      { path: "app/voice-library", element: <Navigate to="/voices" replace /> },
      { path: "app/voice-clone", element: <Navigate to="/voices?clone=1" replace /> },
      { path: "app/voice-changer", element: <Navigate to="/voice-changer" replace /> },
      { path: "app/sound-effects", element: <Navigate to="/sound-effects" replace /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
