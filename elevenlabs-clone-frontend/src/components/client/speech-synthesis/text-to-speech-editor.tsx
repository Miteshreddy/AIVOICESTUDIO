"use client";

import { useEffect, useState } from "react";
import {
  IoBookOutline,
  IoFilmOutline,
  IoHappyOutline,
  IoLanguageOutline,
  IoLeafOutline,
  IoMegaphoneOutline,
  IoMicOutline,
} from "react-icons/io5";
import { type ServiceType } from "~/types/services";
import { GenerateButton } from "../generate-button";
import {
  generateTextToSpeech,
  generationStatus,
} from "~/actions/generate-speech";
import { useVoiceStore } from "~/stores/voice-store";
import { useAudioStore } from "~/stores/audio-store";

export function TextToSpeechEditor({
  service,
}: {
  service: ServiceType;
  credits?: number;
}) {
  const [textContent, setTextContent] = useState("");
  const [activePlaceholder, setActivePlaceholder] = useState(
    "Start typing here or paste any text you want to turn into lifelike speech with KAIZ neural engine...",
  );
  const [loading, setLoading] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);

  const getSelectedVoice = useVoiceStore((state) => state.getSelectedVoice);
  const { playAudio } = useAudioStore();

  useEffect(() => {
    if (!currentAudioId || !loading) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await generationStatus(currentAudioId);

        const selectedVoice = getSelectedVoice("styletts2");
        if (status.success && status.audioUrl && selectedVoice) {
          clearInterval(pollInterval);
          setLoading(false);

          const newAudio = {
            id: currentAudioId,
            title:
              textContent.substring(0, 50) +
              (textContent.length > 50 ? "..." : ""),
            audioUrl: status.audioUrl,
            voice: selectedVoice.id,
            duration: "0:30",
            progress: 0,
            service: service,
            createdAt: new Date().toLocaleDateString(),
          };

          playAudio(newAudio);
          setCurrentAudioId(null);
        } else if (!status.success) {
          clearInterval(pollInterval);
          setLoading(false);
          setCurrentAudioId(null);
        }
      } catch (error) {
        clearInterval(pollInterval);
        setLoading(false);
        setCurrentAudioId(null);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [
    currentAudioId,
    loading,
    getSelectedVoice,
    playAudio,
    textContent,
    service,
  ]);

  const templateTexts = {
    "Narrate a story":
      "Once upon a time in a forest shrouded in mist, a young adventurer discovered an ancient doorway hidden beneath twisted roots. As they reached out to touch the weathered stone, the forest fell silent. What secrets would be revealed beyond this mysterious threshold?",
    "Tell a silly joke":
      "Why don't scientists trust atoms? Because they make up everything! Speaking of making things up, I once convinced my friend that the moon was just the back of the sun. He believed me until nighttime when both were visible in the sky.",
    "Record an advertisement":
      "Introducing TranquilSleep, the revolutionary mattress designed with cutting-edge comfort technology. Experience the perfect balance of support and softness that adapts to your body. Wake up refreshed and energized every morning! Order now and get 30% off your first purchase.",
    "Speak in different languages":
      "Hello! Hola! Bonjour! Ciao! Konnichiwa! Guten Tag! I can help you communicate your message in multiple languages. Perfect for reaching a global audience or adding an international flair to your content.",
    "Direct a dramatic movie scene":
      "The rain beats against the windows as Sarah stares at the faded photograph. 'I never thought it would end this way,' she whispers, her voice barely audible above the storm. Behind her, the door slowly opens. 'It doesn't have to,' says a familiar voice she never expected to hear again.",
    "Hear from a video game character":
      "Greetings, adventurer! I am Captain Varrick of the Starship Horizon. Our mission to explore the outer reaches of the Andromeda galaxy has led us to this mysterious planet. The energy readings are off the charts, and we need your help to investigate the ancient ruins ahead.",
    "Introduce your podcast":
      "Welcome to 'Unexplained Phenomena,' the podcast where we explore the mysteries that science has yet to solve. I'm your host, Alex Morgan, and today we're diving into the fascinating world of synchronicity – those meaningful coincidences that seem to defy the laws of probability.",
    "Guide a meditation class":
      "Settle into a comfortable position and gently close your eyes. Take a deep breath in through your nose, filling your lungs completely. Hold for a moment, and then exhale slowly through your mouth, releasing any tension you've been carrying. Feel your body becoming heavier with each breath, melting into the surface beneath you.",
  };

  const handleButtonHover = (text: string) => {
    setActivePlaceholder(templateTexts[text as keyof typeof templateTexts]);
  };

  const handleButtonClick = (text: string) => {
    setTextContent(templateTexts[text as keyof typeof templateTexts]);
  };

  const handleGenerateSpeech = async () => {
    const selectedVoice = getSelectedVoice("styletts2");

    if (textContent.trim().length === 0 || !selectedVoice) return;

    try {
      setLoading(true);
      const { audioId } = await generateTextToSpeech(
        textContent,
        selectedVoice?.id,
      );

      setCurrentAudioId(audioId);
    } catch (error) {
      console.error("Error generating speech: ", error);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Editor Box */}
      <div className="relative flex-1 rounded-xl border border-[#23252a] bg-[#141519] p-4 transition-colors focus-within:border-zinc-600">
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder={activePlaceholder}
          disabled={loading}
          className="w-full h-full resize-none bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none text-sm leading-relaxed"
        />
      </div>

      {/* Prompts or Generate Button */}
      <div>
        {textContent.length === 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Examples
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { text: "Narrate a story", icon: <IoBookOutline /> },
                { text: "Tell a silly joke", icon: <IoHappyOutline /> },
                {
                  text: "Record an advertisement",
                  icon: <IoMegaphoneOutline />,
                },
                {
                  text: "Speak in different languages",
                  icon: <IoLanguageOutline />,
                },
                {
                  text: "Direct a movie scene",
                  icon: <IoFilmOutline />,
                },
                {
                  text: "Introduce your podcast",
                  icon: <IoMicOutline />,
                },
                {
                  text: "Guide a meditation",
                  icon: <IoLeafOutline />,
                },
              ].map(({ text, icon }) => (
                <button
                  key={text}
                  className="flex items-center gap-1.5 rounded-md border border-[#23252a] bg-[#141519] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-[#1a1b21] transition-colors"
                  onMouseEnter={() => handleButtonHover(text)}
                  onMouseLeave={() =>
                    setActivePlaceholder(
                      "Type or paste any text to turn into speech...",
                    )
                  }
                  onClick={() => handleButtonClick(text)}
                >
                  <span className="text-zinc-500">{icon}</span>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <GenerateButton
            onGenerate={handleGenerateSpeech}
            isDisabled={textContent.trim().length === 0 || loading}
            isLoading={loading}
            showDownload={true}
            characterCount={textContent.length}
            characterLimit={5000}
            showCharacterCount={true}
          />
        )}
      </div>
    </div>
  );
}
