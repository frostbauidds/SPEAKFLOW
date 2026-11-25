import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export interface UseVoiceRecognitionOptions {
  debounceMs?: number;
  onCommitTranscript: (transcript: string) => void;
  onVoiceError?: (message: string) => void;
}

export interface UseVoiceRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  pendingTranscript: string;
  isDebouncePending: boolean;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  flushNow: () => void;
  clearPending: () => void;
}

export function useVoiceRecognition({
  debounceMs = 900,
  onCommitTranscript,
  onVoiceError,
}: UseVoiceRecognitionOptions): UseVoiceRecognitionReturn {
  const [isSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionCtor()));
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [isDebouncePending, setIsDebouncePending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const finalBufferRef = useRef('');
  const debounceTimerRef = useRef<number | null>(null);
  const commitCallbackRef = useRef(onCommitTranscript);
  const errorCallbackRef = useRef(onVoiceError);

  useEffect(() => {
    commitCallbackRef.current = onCommitTranscript;
  }, [onCommitTranscript]);

  useEffect(() => {
    errorCallbackRef.current = onVoiceError;
  }, [onVoiceError]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setIsDebouncePending(false);
  }, []);

  const flushNow = useCallback(() => {
    clearDebounceTimer();
    const combined = finalBufferRef.current.trim();
    finalBufferRef.current = '';
    setPendingTranscript('');
    setInterimTranscript('');
    if (combined) {
      commitCallbackRef.current(combined);
    }
  }, [clearDebounceTimer]);

  const clearPending = useCallback(() => {
    clearDebounceTimer();
    finalBufferRef.current = '';
    setPendingTranscript('');
    setInterimTranscript('');
  }, [clearDebounceTimer]);

  const scheduleDebounceCommit = useCallback(() => {
    clearDebounceTimer();
    if (!finalBufferRef.current.trim()) return;
    setIsDebouncePending(true);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      setIsDebouncePending(false);
      const textToSend = finalBufferRef.current.trim();
      finalBufferRef.current = '';
      setPendingTranscript('');
      setInterimTranscript('');
      if (textToSend) {
        commitCallbackRef.current(textToSend);
      }
    }, debounceMs);
  }, [clearDebounceTimer, debounceMs]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if already ended
      }
    }
    // If there's finalized speech buffered, commit it immediately when stopping
    if (finalBufferRef.current.trim()) {
      flushNow();
    } else {
      clearDebounceTimer();
      setInterimTranscript('');
    }
  }, [clearDebounceTimer, flushNow]);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      const msg = 'Web Speech API is unavailable in this browser. Use the text bar below.';
      setErrorMessage(msg);
      errorCallbackRef.current?.(msg);
      return;
    }

    setErrorMessage(null);
    shouldKeepListeningRef.current = true;

    if (!recognitionRef.current) {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let newlyFinalized = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const segment = result[0]?.transcript ?? '';
          if (result.isFinal) {
            newlyFinalized += `${segment} `;
          } else {
            interim += segment;
          }
        }

        setInterimTranscript(interim.trim());

        if (newlyFinalized.trim()) {
          finalBufferRef.current = `${finalBufferRef.current} ${newlyFinalized}`.trim();
          setPendingTranscript(finalBufferRef.current);
          scheduleDebounceCommit();
        } else if (interim.trim() && debounceTimerRef.current !== null) {
          // User kept speaking — reset silence timer while waiting for next final phrase
          clearDebounceTimer();
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        let friendly = 'Microphone capture encountered an error.';
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          friendly = 'Microphone permission denied. Allow microphone access or use the text input.';
          shouldKeepListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === 'audio-capture') {
          friendly = 'No microphone detected. Type your instructions in the command bar.';
          shouldKeepListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === 'network') {
          friendly = 'Speech recognition network error. You can continue typing below.';
        }
        setErrorMessage(friendly);
        errorCallbackRef.current?.(friendly);
      };

      recognition.onend = () => {
        if (shouldKeepListeningRef.current) {
          // Chrome automatically ends continuous recognition after long silence; gently restart
          window.setTimeout(() => {
            if (!shouldKeepListeningRef.current || !recognitionRef.current) return;
            try {
              recognitionRef.current.start();
            } catch {
              setIsListening(false);
              shouldKeepListeningRef.current = false;
            }
          }, 180);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started
      setIsListening(true);
    }
  }, [clearDebounceTimer, scheduleDebounceCommit]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore teardown errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    pendingTranscript,
    isDebouncePending,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
    flushNow,
    clearPending,
  };
}
