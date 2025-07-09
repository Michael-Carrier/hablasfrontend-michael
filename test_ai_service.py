#!/usr/bin/env python3
"""
Test script for Hablas AI Service
Tests STT, TTS, and Translation endpoints using the provided audio file
"""

import asyncio
import aiohttp
import base64
import json
import time
import sys
from pathlib import Path

# Configuration
AI_SERVICE_URL = "http://localhost:8001"
AUDIO_FILE = "recording_2025-06-16_08-20-58.wav"

async def test_health_check():
    """Test the health check endpoint"""
    print("🏥 Testing health check...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{AI_SERVICE_URL}/health") as response:
                if response.status == 200:
                    result = await response.json()
                    print("✅ Health check passed!")
                    print(f"   Status: {result['status']}")
                    print(f"   Models loaded: {result['models_loaded']}")
                    print(f"   GPU available: {result['gpu_available']}")
                    print(f"   GPU count: {result['gpu_count']}")
                    return True
                else:
                    print(f"❌ Health check failed: {response.status}")
                    return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

async def test_stt(audio_file_path, language="en", expected_sentence=None):
    """Test Speech-to-Text endpoint"""
    print(f"\n🎤 Testing STT with {audio_file_path}...")
    
    # Check if file exists
    if not Path(audio_file_path).exists():
        print(f"❌ Audio file not found: {audio_file_path}")
        return False
    
    try:
        # Convert audio file to base64
        with open(audio_file_path, "rb") as audio_file:
            audio_data = audio_file.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            audio_with_header = f"data:audio/wav;base64,{audio_base64}"
        
        print(f"   📁 Loaded audio file ({len(audio_data)} bytes)")
        
        # Prepare request
        payload = {
            "audio_base64": audio_with_header,
            "language": language,
            "expected_sentence": expected_sentence
        }
        
        # Send request
        start_time = time.time()
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{AI_SERVICE_URL}/stt", json=payload, timeout=60) as response:
                if response.status == 200:
                    result = await response.json()
                    processing_time = time.time() - start_time
                    
                    print("✅ STT test passed!")
                    print(f"   🗣️  Transcription: '{result['transcription']}'")
                    print(f"   📊 Processing time: {processing_time:.2f}s (Service: {result['processing_time']:.2f}s)")
                    print(f"   📈 Points: {result['points']}/{result['total_words']}")
                    print(f"   ❌ Wrong words: {result['wrong_words']}")
                    print(f"   📏 Similarity: {result['similarity_ratio']:.2f}")
                    
                    if expected_sentence:
                        print(f"   📝 Expected: '{expected_sentence}'")
                        print(f"   🎯 Predicted: {result['predicted_sentence']}")
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ STT test failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ STT test error: {e}")
        return False

async def test_tts(text="Hello, this is a test of the text to speech system.", language="en"):
    """Test Text-to-Speech endpoint"""
    print(f"\n🔊 Testing TTS...")
    
    try:
        payload = {
            "text": text,
            "language": language
        }
        
        start_time = time.time()
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{AI_SERVICE_URL}/tts", json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    processing_time = time.time() - start_time
                    
                    print("✅ TTS test passed!")
                    print(f"   📝 Text: '{text}'")
                    print(f"   🌍 Language: {result['language']}")
                    print(f"   ⏱️  Processing time: {processing_time:.2f}s")
                    print(f"   🎵 Audio data length: {len(result['audio'])} chars")
                    
                    # Save the audio file for verification
                    if result.get('audio'):
                        audio_data = result['audio'].split(',')[1]  # Remove data:audio/mp3;base64,
                        audio_bytes = base64.b64decode(audio_data)
                        
                        output_file = f"test_tts_output_{int(time.time())}.mp3"
                        with open(output_file, "wb") as f:
                            f.write(audio_bytes)
                        print(f"   💾 Saved audio to: {output_file}")
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ TTS test failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ TTS test error: {e}")
        return False

async def test_translation(text="Hello, how are you today?", source_lang="en", target_lang="fr"):
    """Test Translation endpoint"""
    print(f"\n🌍 Testing Translation...")
    
    try:
        payload = {
            "text": text,
            "source_lang": source_lang,
            "target_lang": target_lang
        }
        
        start_time = time.time()
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{AI_SERVICE_URL}/translate", json=payload, timeout=15) as response:
                if response.status == 200:
                    result = await response.json()
                    processing_time = time.time() - start_time
                    
                    print("✅ Translation test passed!")
                    print(f"   📝 Original ({source_lang}): '{text}'")
                    print(f"   🔄 Translated ({target_lang}): '{result['translated_text']}'")
                    print(f"   ⏱️  Processing time: {processing_time:.2f}s")
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Translation test failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ Translation test error: {e}")
        return False

async def test_model_preload():
    """Test model preloading"""
    print(f"\n🧠 Testing model preload...")
    
    try:
        start_time = time.time()
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{AI_SERVICE_URL}/models/preload", timeout=120) as response:
                if response.status == 200:
                    result = await response.json()
                    processing_time = time.time() - start_time
                    
                    print("✅ Model preload test passed!")
                    print(f"   📊 Models loaded: {len(result['models'])}")
                    print(f"   🧠 Models: {', '.join(result['models'])}")
                    print(f"   ⏱️  Loading time: {result['loading_time']:.2f}s")
                    print(f"   🕐 Total time: {processing_time:.2f}s")
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Model preload test failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ Model preload test error: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Starting Hablas AI Service Tests")
    print("=" * 50)
    
    results = {}
    
    # Test 1: Health Check
    results['health'] = await test_health_check()
    
    # Test 2: Model Preload (optional, models load on demand)
    # results['preload'] = await test_model_preload()
    
    # Test 3: STT with your audio file
    if Path(AUDIO_FILE).exists():
        # Test without expected sentence first
        results['stt_basic'] = await test_stt(AUDIO_FILE, language="en")
        
        # Test with expected sentence (you can modify this based on what's in your audio)
        # results['stt_comparison'] = await test_stt(
        #     AUDIO_FILE, 
        #     language="en", 
        #     expected_sentence="Hello, this is a test recording."
        # )
    else:
        print(f"\n⚠️  Audio file {AUDIO_FILE} not found, skipping STT test")
        print(f"   Please make sure the file is in the current directory")
        results['stt_basic'] = False
    
    # Test 4: TTS
    results['tts'] = await test_tts()
    
    # Test 5: Translation
    results['translation'] = await test_translation()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! AI Service is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the logs above for details.")
        
    return passed_tests == total_tests

if __name__ == "__main__":
    # Check if audio file exists
    if len(sys.argv) > 1:
        AUDIO_FILE = sys.argv[1]
    
    print(f"Using audio file: {AUDIO_FILE}")
    
    # Run tests
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        sys.exit(1) 