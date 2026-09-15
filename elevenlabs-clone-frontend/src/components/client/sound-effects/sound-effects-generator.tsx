"use client";

import { useEffect, useState } from "react";
import { useAudioStore } from "~/stores/audio-store";
import { GenerateButton } from "../generate-button";
import { BiDoorOpen } from "react-icons/bi";
import {
  IoCarSportOutline,
  IoThunderstormOutline,
  IoLeafOutline,
  IoPeopleOutline,
  IoWaterOutline,
  IoHardwareChipOutline,
  IoAirplaneOutline,
} from "react-icons/io5";
import {
  generateSoundEffect,
  generationStatus,
} from "~/actions/generate-speech";

const MAX_CHARS = 500;

export function SoundEffectsGenerator({ credits: _credits }: { credits?: number }) {
  const [textContent, setTextContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activePlaceholder, setActivePlaceholder] = useState(
    "Describe your sound effect and then click generate...",
  );
  const [loading, setLoading] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const { playAudio } = useAudioStore();

  const isTextEmpty = textContent.trim() === "";

  const handleGenerateSoundEffect = async () => {
    if (isTextEmpty) return;

    try {
      setLoading(true);
      const { audioId } = await generateSoundEffect(textContent);
      setCurrentAudioId(audioId);
    } catch (error) {
      console.error("Error generating sound effect: ", error);
      setLoading(false);
    }
  };

  const templateTexts = {
    "Car engine revving":
      "A powerful sports car engine revving up, starting low and building to a high-pitched roar with the sound of turbocharger spooling",
    "Heavy rainstorm":
      "Heavy rain pouring down with occasional thunder in the background, rain hitting windows and roof",
    "Forest ambience":
      "Peaceful forest sounds with birds chirping, leaves rustling in the wind, and a small stream flowing nearby",
    "Stadium crowd cheering":
      "A large stadium crowd erupting in cheers and applause after a goal or touchdown, with whistles and horns",
    "Ocean waves":
      "Ocean waves crashing against a rocky shore, with the rhythmic sound of water rushing in and receding",
    "Robot sounds":
      "Futuristic robot powering up with mechanical servo sounds, beeps, and electronic processing noises",
    "Creaky door":
      "Old wooden door slowly opening with an eerie creak, hinges squeaking in a haunted house",
    "Helicopter flyby":
      "Helicopter approaching from a distance, passing overhead with loud rotor blades, then flying away",
  };

  useEffect(() => {
    if (!currentAudioId || !loading) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await generationStatus(currentAudioId);

        if (status.success && status.audioUrl) {
          clearInterval(pollInterval);
          setLoading(false);

          const newAudio = {
            id: currentAudioId,
            title:
              textContent.substring(0, 50) +
              (textContent.length > 50 ? "..." : ""),
            audioUrl: status.audioUrl,
            voice: "",
            duration: "0:30",
            progress: 0,
            service: "make-an-audio",
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
  }, [currentAudioId, loading, playAudio, textContent]);

  return (
    <div className="relative flex h-full w-full flex-col items-center">
      {/* Ambient background glow */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 transform pointer-events-none">
        <div className="h-[250px] w-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-30 blur-[90px]" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center gap-8 md:pt-10">
        {/* Prompt Card */}
        <div
          className="h-fit w-full max-w-2xl rounded-xl border border-[#23252a] bg-[#141519] p-4 transition-colors focus-within:border-zinc-600"
        >
          <div className="flex flex-col">
            <textarea
              value={textContent}
              onChange={(e) => {
                const text = e.target.value;
                if (text.length <= MAX_CHARS) {
                  setTextContent(text);
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              maxLength={MAX_CHARS}
              placeholder={activePlaceholder}
              className="h-20 resize-none rounded-lg bg-transparent p-1 text-zinc-100 placeholder:text-zinc-600 focus:outline-none text-sm leading-relaxed"
            />
            <div className="mt-1 flex w-full justify-end">
              <span className="text-xs text-zinc-500">
                {textContent.length}/{MAX_CHARS}
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              <GenerateButton
                onGenerate={handleGenerateSoundEffect}
                isDisabled={isTextEmpty || loading}
                isLoading={loading}
                buttonText="Generate Sound"
                showDownload={false}
                fullWidth={false}
              />
            </div>
          </div>
        </div>

        {/* Examples Card */}
        <div className="h-fit w-full max-w-2xl rounded-xl border border-[#23252a] bg-[#141519] p-4">
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Presets
          </p>

          <div className="flex flex-wrap gap-1.5">
            {[
              { text: "Car engine revving", icon: <IoCarSportOutline /> },
              { text: "Heavy rainstorm", icon: <IoThunderstormOutline /> },
              { text: "Forest ambience", icon: <IoLeafOutline /> },
              { text: "Stadium crowd cheering", icon: <IoPeopleOutline /> },
              { text: "Ocean waves", icon: <IoWaterOutline /> },
              { text: "Robot sounds", icon: <IoHardwareChipOutline /> },
              { text: "Creaky door", icon: <BiDoorOpen /> },
              { text: "Helicopter flyby", icon: <IoAirplaneOutline /> },
            ].map(({ text, icon }) => (
              <button
                className="flex items-center gap-1.5 rounded-md border border-[#23252a] bg-[#17181d] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                key={text}
                onMouseEnter={() =>
                  setActivePlaceholder(
                    templateTexts[text as keyof typeof templateTexts],
                  )
                }
                onMouseLeave={() =>
                  setActivePlaceholder(
                    "Describe your sound effect and then click generate...",
                  )
                }
                onClick={() => {
                  const content =
                    templateTexts[text as keyof typeof templateTexts];
                  if (content.length <= MAX_CHARS) {
                    setTextContent(content);
                  } else {
                    setTextContent(content.substring(0, MAX_CHARS));
                  }
                }}
              >
                <span className="text-zinc-500">{icon}</span>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
