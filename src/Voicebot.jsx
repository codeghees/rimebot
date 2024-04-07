import React, { useState, useEffect, useRef } from "react";
import OpenAI from "openai";
import "./Voicebot.css";
import RimeSpeechTechLogo from './RimeSpeechTech_Logo.2582e20f.svg';
const openai = new OpenAI(
    {
        apiKey: "API_KEY",
        dangerouslyAllowBrowser: true,
    }
);

console.log("openai", process.env);

const Voicebot = () => {
  const [transcript, setTranscript] = useState("");
  const [botResponse, setBotResponse] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([
    { role: "system", content: "You are a helpful assistant. You are a text to speech system and keep your responses UNDER 3 sentences" },
  ]);
  const audioRef = useRef(null);
  const messagesRef = useRef(messages);


  useEffect(() => {
    messagesRef.current = messages;
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcriptValue = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setTranscript(transcriptValue);

      // Send the transcribed text to your LLM (GPT-4) API for processing
      processQuery(transcriptValue);
    };

    recognition.onspeechend = () => {
      setIsListening(false);
    };

    const toggleListen = () => {
      setIsListening((prevState) => !prevState);
      if (!isListening) {
        recognition.start();
      } else {
        recognition.stop();
      }
    };

    const processQuery = async (query) => {
      const response = await fetchFromLLM(query);
      setBotResponse(response.content);

      // Use Rime to synthesize the bot's response
      console.log(response.content);
      const rimeAudio = await fetchFromRimeTTS(response.content);
      playAudio(rimeAudio);
    };

    const fetchFromLLM = async (query) => {
      const userMessage = { role: "user", content: query };
      console.log("messages", messages)
      const updatedMessages = [...messagesRef.current, userMessage];
      setMessages(updatedMessages);
      console.log("updatedMessages", updatedMessages);

      const completion = await openai.chat.completions.create({
        messages: updatedMessages,
        model: "gpt-3.5-turbo",
      });

      const assistantResponse = completion.choices[0].message;
      const updatedMessagesWithResponse = [
        ...updatedMessages,
        assistantResponse,
      ];
      setMessages(updatedMessagesWithResponse);
      console.log("updatedMessagesWithResponse", updatedMessagesWithResponse);

      return assistantResponse;
    };

    const fetchFromRimeTTS = async (text) => {
      const options = {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer API_KEY",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          speaker: "Antoine",
          text: text,
          modelId: "mist",
          audioFormat: "wav",
          samplingRate: 22050,
          speedAlpha: 1.0,
          reduceLatency: false,
        }),
      };

      let response = await fetch(
        "https://users.rime.ai/v1/rime-tts",
        options,
      );
      let data = await response.json();

      // Check if the error is due to text being too long
      if (data.error && data.error.message.includes("text is too long")) {
        // If so, retry with the first half of the text
        options.body = JSON.stringify({
          ...JSON.parse(options.body),
          text: text.slice(0, Math.floor(text.length / 2)),
        });

        response = await fetch(
          "https://users.rime.ai/v1/rime-tts",
          options,
        );
        data = await response.json();
      }

      return data.audioContent;
    };

    const playAudio = (base64Audio) => {
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      audioRef.current.onended = () => {
        setIsListening(true);
        recognition.start();
      };
    };

    // Add event listener for the voice input button
    const voiceInputButton = document.getElementById("voiceInputButton");
    voiceInputButton.addEventListener("click", toggleListen);

    return () => {
      voiceInputButton.removeEventListener("click", toggleListen);
    };
  }, [isListening, messages]);

  return (
    <div className="App">
      <div className="voicebot-container">
        <div className="voicebot-circle">
        <img src={RimeSpeechTechLogo} alt="Rime Speech Tech Logo" />

        </div>
        <div className="transcript">{transcript}</div>
        <div className="bot-response">{botResponse}</div>
        <audio ref={audioRef} />
        <button id="voiceInputButton" className="voice-input-button">
          {isListening ? "Stop Listening" : "Start Listening"}
        </button>
      </div>
    </div>
  );
};

export default Voicebot;
