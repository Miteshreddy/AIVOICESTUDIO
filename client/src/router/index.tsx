import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/app/layout/AppLayout";
import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";

// Auth (LoginPage, SignupPage, ProtectedRoute) and the marketing HomePage are built and kept
// in the codebase, but unrouted for now — this is a personal, single-user local build.
// See client/src/features/auth and client/src/features/home to re-enable them later.

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const VoiceStudioPage = lazy(() => import("@/features/voice-studio/VoiceStudioPage"));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage"));
const VoiceLibraryPage = lazy(() => import("@/features/voice-library/VoiceLibraryPage"));
const VoiceClonePage = lazy(() => import("@/features/voice-clone/VoiceClonePage"));
const GenerateSpeechPage = lazy(() => import("@/features/generate-speech/GenerateSpeechPage"));
const AudioCleanupPage = lazy(() => import("@/features/audio-cleanup/AudioCleanupPage"));
const AudioEditorPage = lazy(() => import("@/features/audio-editor/AudioEditorPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const AccountPage = lazy(() => import("@/features/settings/AccountPage"));

function PageFallback() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <AnimatedWaveform bars={16} className="h-8 opacity-60" />
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/dashboard" replace /> },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: "dashboard", element: withSuspense(<DashboardPage />) },
      { path: "voice-studio", element: withSuspense(<VoiceStudioPage />) },
      { path: "voice-studio/:voiceId", element: withSuspense(<VoiceStudioPage />) },
      { path: "projects", element: withSuspense(<ProjectsPage />) },
      { path: "voice-library", element: withSuspense(<VoiceLibraryPage />) },
      { path: "voice-clone", element: withSuspense(<VoiceClonePage />) },
      { path: "generate-speech", element: withSuspense(<GenerateSpeechPage />) },
      { path: "audio-cleanup", element: withSuspense(<AudioCleanupPage />) },
      { path: "audio-editor", element: withSuspense(<AudioEditorPage />) },
      { path: "audio-editor/:projectId", element: withSuspense(<AudioEditorPage />) },
      { path: "settings", element: withSuspense(<SettingsPage />) },
      { path: "account", element: withSuspense(<AccountPage />) },
    ],
  },
  { path: "*", element: <Navigate to="/app/dashboard" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
