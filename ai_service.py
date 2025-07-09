#!/usr/bin/env python3
"""
Hablas AI Service
Dedicated service for handling AI processing tasks:
- Speech-to-Text (STT) using Wav2Vec2
- Text-to-Speech (TTS) using Google TTS
- Translation using Google Translate
- Text comparison using Levenshtein distance
"""

import asyncio
import base64
import json
import time
import os
import tempfile
from datetime import datetime
from pathlib import Path
import traceback

import torch
import librosa
import numpy as np
import soundfile as sf
from torch.cuda.amp import autocast
from torch.nn.parallel import DataParallel
import threading
import queue
from concurrent.futures import ThreadPoolExecutor

# FastAPI imports
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uvicorn

# AI/ML imports
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
from gtts import gTTS
from googletrans import Translator
import Levenshtein
import difflib

# Configuration
PORT = int(os.environ.get('AI_SERVICE_PORT', 8001))
HOST = os.environ.get('AI_SERVICE_HOST', '0.0.0.0')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'info')

# Language configuration
language_name_map = {
    "francais": "fr",
    "english": "en",
    "español": "es",
    "espagnol": "es", 
    "spanish": "es",
    "deutsch": "de",
    "italiano": "it",
    "turkish": "tr",
    "português": "pt",
    "portuguese": "pt",
}

language_dict = {
    "en": "jonatasgrosman/wav2vec2-large-xlsr-53-english",
    "fr": "jonatasgrosman/wav2vec2-large-xlsr-53-french", 
    "es": "jonatasgrosman/wav2vec2-large-xlsr-53-spanish",
    "it": "jonatasgrosman/wav2vec2-large-xlsr-53-french",
    "de": "jonatasgrosman/wav2vec2-large-xlsr-53-german",
    "tr": "m3hrdadfi/wav2vec2-large-xlsr-turkish",
    "pt": "jonatasgrosman/wav2vec2-large-xlsr-53-portuguese",
}

# FastAPI app
app = FastAPI(title="Hablas AI Service", version="1.0.0")

# Global instances
translator = Translator()

# Pydantic models for API
class STTRequest(BaseModel):
    audio_base64: str
    language: str
    expected_sentence: Optional[str] = None

class STTResponse(BaseModel):
    transcription: str
    predicted_sentence: str
    points: int
    total_words: int
    wrong_words: int
    similarity_ratio: float
    processing_time: float

class TTSRequest(BaseModel):
    text: str
    language: str

class TTSResponse(BaseModel):
    status: str
    audio: Optional[str] = None
    language: str
    message: Optional[str] = None

class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str

class TranslateResponse(BaseModel):
    status: str
    translated_text: Optional[str] = None
    message: Optional[str] = None

class ModelManager:
    def __init__(self):
        self.loaded_processors = {}
        self.loaded_models = {}
        self.batch_queue = queue.Queue()
        self.batch_size = 8  # Adjust based on your GPU memory
        self.processing_thread = threading.Thread(target=self._process_batch, daemon=True)
        self.processing_thread.start()
        self.lock = threading.Lock()

    def get_or_load_model(self, lang):
        """Thread-safe model loading with GPU optimization"""
        with self.lock:
            if lang not in self.loaded_processors:
                print(f"[AI_SERVICE] Loading model for language: {lang}")
                MODEL_ID = language_dict[lang]
                self.loaded_processors[lang] = Wav2Vec2Processor.from_pretrained(MODEL_ID)
                model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID)

                # Enable GPU parallel processing if multiple GPUs are available
                if torch.cuda.device_count() > 1:
                    model = DataParallel(model)
                model = model.to('cuda')
                model.eval()  # Set to evaluation mode
                self.loaded_models[lang] = model
                print(f"[AI_SERVICE] Model loaded successfully for language: {lang}")

            return self.loaded_processors[lang], self.loaded_models[lang]

    def _process_batch(self):
        """Process batches of audio in background"""
        while True:
            batch = []
            try:
                # Collect batch_size items or wait for timeout
                while len(batch) < self.batch_size:
                    try:
                        item = self.batch_queue.get(timeout=0.1)
                        batch.append(item)
                    except queue.Empty:
                        if batch:  # Process partial batch
                            break
                        continue

                if batch:
                    self._process_items(batch)

            except Exception as e:
                print(f"[AI_SERVICE] Batch processing error: {e}")

    def _process_items(self, batch):
        """Process a batch of audio files"""
        try:
            # Group by language
            by_language = {}
            for item in batch:
                lang = item['lang']
                if lang not in by_language:
                    by_language[lang] = []
                by_language[lang].append(item)

            # Process each language batch
            for lang, items in by_language.items():
                processor, model = self.get_or_load_model(lang)

                # Prepare batch inputs
                audio_inputs = []
                attention_masks = []

                for item in items:
                    audio = librosa.load(item['audio_path'], sr=16_000)[0]
                    inputs = processor(audio, sampling_rate=16_000, return_tensors="pt", padding=True)
                    audio_inputs.append(inputs.input_values)
                    attention_masks.append(inputs.attention_mask)

                # Stack batch inputs
                batched_inputs = torch.cat(audio_inputs).to('cuda')
                batched_attention_mask = torch.cat(attention_masks).to('cuda')

                # Run inference with automatic mixed precision
                with autocast():
                    with torch.no_grad():
                        logits = model(batched_inputs, attention_mask=batched_attention_mask).logits

                # Process results
                predicted_ids = torch.argmax(logits, dim=-1)
                predicted_sentences = processor.batch_decode(predicted_ids)

                # Update results
                for item, sentence in zip(items, predicted_sentences):
                    item['future'].set_result(sentence)

        except Exception as e:
            print(f"[AI_SERVICE] Error processing batch: {e}")
            # Set error result for all items in batch
            for item in batch:
                item['future'].set_exception(e)

class TextComparator:
    @staticmethod
    def generate_html_report(text1, text2):
        def normalize_text(text):
            text = text.lower()
            for char in ',.!?;:«»""()[]{}':
                text = text.replace(char, ' ')
            text = text.replace("'", "'")
            return [word for word in text.split() if word]

        original_words = normalize_text(text1)
        spoken_words = normalize_text(text2)

        m, n = len(original_words), len(spoken_words)
        score = [[0 for _ in range(n+1)] for _ in range(m+1)]
        traceback = [[None for _ in range(n+1)] for _ in range(m+1)]
        
        for i in range(m+1):
            score[i][0] = -i
            if i > 0:
                traceback[i][0] = "up"

        for j in range(n+1):
            score[0][j] = -j
            if j > 0:
                traceback[0][j] = "left"
                
        for i in range(1, m+1):
            for j in range(1, n+1):
                word_similarity = 1 - Levenshtein.distance(original_words[i-1], spoken_words[j-1]) / max(len(original_words[i-1]), len(spoken_words[j-1]))

                match_score = score[i-1][j-1] + (2 * word_similarity - 1)  # Reward for similar words, penalty for different
                delete_score = score[i-1][j] - 0.5  # Gap penalty
                insert_score = score[i][j-1] - 0.5  # Gap penalty

                best_score = max(match_score, delete_score, insert_score)
                score[i][j] = best_score

                if best_score == match_score:
                    traceback[i][j] = "diag"
                elif best_score == delete_score:
                    traceback[i][j] = "up"
                else:
                    traceback[i][j] = "left"

        # Traceback to find the alignment
        aligned_original = []
        aligned_spoken = []
        i, j = m, n

        while i > 0 or j > 0:
            if i > 0 and j > 0 and traceback[i][j] == "diag":
                aligned_original.append(original_words[i-1])
                aligned_spoken.append(spoken_words[j-1])
                i -= 1
                j -= 1
            elif i > 0 and traceback[i][j] == "up":
                aligned_original.append(original_words[i-1])
                aligned_spoken.append(None)  # Gap in spoken
                i -= 1
            else:  # traceback[i][j] == "left"
                aligned_original.append(None)  # Gap in original
                aligned_spoken.append(spoken_words[j-1])
                j -= 1

        # Reverse the alignments
        aligned_original.reverse()
        aligned_spoken.reverse()

        # Generate HTML output
        marked_output = []

        for orig, spoken in zip(aligned_original, aligned_spoken):
            if orig is None:
                # Extra word in spoken text
                marked_output.append(f'<span id="" class="wrong">{spoken}</span>')
            elif spoken is None:
                # Missing word in spoken text (optional to include)
                continue
            else:
                # Both words exist - check similarity
                distance = Levenshtein.distance(orig, spoken)
                max_len = max(len(orig), len(spoken))
                ratio = distance / max_len if max_len > 0 else 0

                if distance > 1 and ratio > 0.2:
                    marked_output.append(f'<span id="{orig}" class="wrong">{spoken}</span>')
                else:
                    marked_output.append(spoken)

        # Join the marked words back into text
        marked_text = ' '.join(marked_output)
        # Calculate overall similarity
        similarity_ratio = difflib.SequenceMatcher(None, original_words, spoken_words).ratio()

        return marked_text, similarity_ratio, original_words, spoken_words

# Initialize model manager
model_manager = ModelManager()

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Hablas AI Service",
        "models_loaded": len(model_manager.loaded_models),
        "gpu_available": torch.cuda.is_available(),
        "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0
    }

@app.post("/stt", response_model=STTResponse)
async def speech_to_text(request: STTRequest):
    """Speech-to-Text endpoint"""
    start_time = time.time()
    
    try:
        print(f"[AI_SERVICE] STT request received for language: {request.language}")
        
        # Map language name to code if needed
        lang = request.language.lower()
        if lang in language_name_map:
            lang = language_name_map[lang]
        
        if lang not in language_dict:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")
        
        # Decode base64 audio
        try:
            if ',' in request.audio_base64:
                actual_base64 = request.audio_base64.split(',')[1]
            else:
                actual_base64 = request.audio_base64
            binary_data = base64.b64decode(actual_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {str(e)}")
        
        # Save audio to temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_file.write(binary_data)
            temp_path = temp_file.name
        
        try:
            # Load model
            processor, model = model_manager.get_or_load_model(lang)
            
            # Load and process audio
            audio = librosa.load(temp_path, sr=16_000)[0]
            inputs = processor(audio, sampling_rate=16_000, return_tensors="pt", padding=True)
            
            # Move inputs to GPU
            input_values = inputs.input_values.to('cuda')
            attention_mask = inputs.attention_mask.to('cuda')
            
            # Run inference with automatic mixed precision
            with autocast():
                with torch.no_grad():
                    logits = model(input_values, attention_mask=attention_mask).logits
            
            # Process results
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = processor.batch_decode(predicted_ids)[0]
            
            print(f"[AI_SERVICE] Transcription: {transcription[:50]}...")
            
            # Compare with expected sentence if provided
            if request.expected_sentence:
                predicted_sentence, similarity_ratio, original_words, spoken_words = TextComparator.generate_html_report(
                    request.expected_sentence, transcription)
                
                # Calculate points
                total_words = len(spoken_words)
                wrong_words = predicted_sentence.count('class="wrong"')
                points = total_words - wrong_words
            else:
                predicted_sentence = transcription
                similarity_ratio = 0.0
                original_words = []
                spoken_words = transcription.split()
                total_words = len(spoken_words)
                wrong_words = 0
                points = total_words
            
            processing_time = time.time() - start_time
            print(f"[AI_SERVICE] STT completed in {processing_time:.4f}s")
            
            return STTResponse(
                transcription=transcription,
                predicted_sentence=predicted_sentence,
                points=points,
                total_words=total_words,
                wrong_words=wrong_words,
                similarity_ratio=similarity_ratio,
                processing_time=processing_time
            )
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI_SERVICE] STT error: {str(e)}")
        print(f"[AI_SERVICE] STT traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"STT processing failed: {str(e)}")

@app.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """Text-to-Speech endpoint"""
    try:
        print(f"[AI_SERVICE] TTS request received for language: {request.language}")
        
        if not request.text:
            raise HTTPException(status_code=400, detail="No text provided for TTS conversion")
        
        # Map language name to code if needed
        lang = request.language.lower()
        if lang in language_name_map:
            lang = language_name_map[lang]
        
        # Generate a unique filename
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Generate speech using gTTS
            tts = gTTS(text=request.text, lang=lang, slow=False)
            tts.save(temp_path)
            
            # Convert the audio file to base64
            with open(temp_path, "rb") as audio_file:
                audio_data = audio_file.read()
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            print(f"[AI_SERVICE] TTS completed successfully")
            
            return TTSResponse(
                status="success",
                audio=f"data:audio/mp3;base64,{audio_base64}",
                language=lang
            )
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI_SERVICE] TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS processing failed: {str(e)}")

@app.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """Translation endpoint"""
    try:
        print(f"[AI_SERVICE] Translation request: {request.source_lang} -> {request.target_lang}")
        
        if request.source_lang == request.target_lang:
            return TranslateResponse(
                status="success",
                translated_text=request.text
            )
        
        # Map language names to codes if needed
        source_lang = request.source_lang
        if source_lang in language_name_map:
            source_lang = language_name_map[source_lang]
        
        # Use Google Translate
        result = translator.translate(request.text, src=source_lang, dest=request.target_lang)
        
        if hasattr(result, 'text'):
            print(f"[AI_SERVICE] Translation completed successfully")
            return TranslateResponse(
                status="success",
                translated_text=result.text
            )
        else:
            raise HTTPException(status_code=500, detail="Translation failed: No result text")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI_SERVICE] Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.get("/models/preload")
async def preload_models():
    """Preload all language models"""
    try:
        print("[AI_SERVICE] Starting model preload...")
        start_time = time.time()
        
        for lang in language_dict:
            print(f"[AI_SERVICE] Loading {lang} model...")
            model_manager.get_or_load_model(lang)
        
        total_time = time.time() - start_time
        print(f"[AI_SERVICE] All models loaded in {total_time:.2f}s")
        
        return {
            "status": "success",
            "message": f"Preloaded {len(language_dict)} models",
            "models": list(language_dict.keys()),
            "loading_time": total_time
        }
        
    except Exception as e:
        print(f"[AI_SERVICE] Model preload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model preload failed: {str(e)}")

def preload_all_models():
    """Preload all language models at startup"""
    print("[AI_SERVICE] Preloading all language models at startup...")
    for lang in language_dict:
        print(f"[AI_SERVICE] Loading {lang} model...")
        model_manager.get_or_load_model(lang)
    print("[AI_SERVICE] All models loaded!")

if __name__ == "__main__":
    # Preload models at startup
    if torch.cuda.is_available():
        print(f"[AI_SERVICE] CUDA available with {torch.cuda.device_count()} GPU(s)")
        preload_all_models()
    else:
        print("[AI_SERVICE] WARNING: CUDA not available, running on CPU")
    
    print(f"[AI_SERVICE] Starting AI service on {HOST}:{PORT}")
    uvicorn.run(
        app, 
        host=HOST, 
        port=PORT, 
        log_level=LOG_LEVEL,
        access_log=True
    ) 