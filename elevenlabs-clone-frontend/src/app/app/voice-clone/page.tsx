import { PageLayout } from "~/components/client/page-layout";
import { VoiceCloneStudio } from "~/components/client/voice-clone/voice-clone-studio";

export default function VoiceClonePage() {
  const voiceCloneTabs = [
    {
      name: "Studio",
      path: "/app/voice-clone",
    },
  ];

  return (
    <PageLayout
      title="Instant Voice Clone AI"
      showSidebar={false}
      tabs={voiceCloneTabs}
      service="styletts2"
    >
      <VoiceCloneStudio />
    </PageLayout>
  );
}
