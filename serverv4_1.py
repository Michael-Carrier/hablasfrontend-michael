import asyncio, time #multiprocesser good for sockets

import websockets , json # the json is bc we're sending a json object from the website
import base64
import os #library for anything that has to do with your hard-drive
import sqlite3
import ssl  # Add this import at the top
import secrets  # Add secrets to generate tokens
from datetime import datetime, timedelta
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import shutil
import mimetypes
from PIL import Image, ImageDraw, ImageFont
import uuid  # Add this import for UUID generation
import ipaddress
import orjson # <--- Add this import
import stripe # Add stripe library
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiohttp  # Add this import for HTTP requests to AI service

# AI Service configuration
AI_SERVICE_URL = os.environ.get('AI_SERVICE_URL', 'http://localhost:8001')

# Map language codes to standard codes if needed
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

EPUB_DIR = Path("epub")
COVERS_DIR = Path("covers")
DEFAULT_COVER = "default-cover.png"
RECORDINGS_DIR = Path("recordings")

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Email configuration for bug reports
EMAIL_HOST = 'smtp.gmail.com'  # Change to your SMTP server
EMAIL_PORT = 587
EMAIL_USER = os.environ.get('BUG_REPORT_EMAIL_USER')  # Your email
EMAIL_PASSWORD = os.environ.get('BUG_REPORT_EMAIL_PASSWORD')  # Your email password/app password
BUG_REPORT_TO_EMAIL = os.environ.get('BUG_REPORT_TO_EMAIL', EMAIL_USER)  # Where to send bug reports

WEBSOCKET_LOG_FILE = "websocket_activity.log"
WEBSOCKET_LOG = open(WEBSOCKET_LOG_FILE, "a")
db = None
interface_language_json = json.load(open("interface_languages_translated.json"))

# Add this language mapping dictionary at the top level with other dictionaries




async def call_ai_service_stt(audio_base64, language, expected_sentence=None):
    """Call external AI service for speech-to-text processing"""
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "audio_base64": audio_base64,
                "language": language,
                "expected_sentence": expected_sentence
            }
            
            async with session.post(f"{AI_SERVICE_URL}/stt", json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_text = await response.text()
                    raise Exception(f"AI service error: {response.status} - {error_text}")
                    
    except aiohttp.ClientError as e:
        raise Exception(f"Failed to connect to AI service: {str(e)}")
    except Exception as e:
        raise Exception(f"AI service call failed: {str(e)}")

async def call_ai_service_tts(text, language):
    """Call external AI service for text-to-speech"""
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "text": text,
                "language": language
            }
            
            async with session.post(f"{AI_SERVICE_URL}/tts", json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_text = await response.text()
                    raise Exception(f"AI service error: {response.status} - {error_text}")
                    
    except aiohttp.ClientError as e:
        raise Exception(f"Failed to connect to AI service: {str(e)}")
    except Exception as e:
        raise Exception(f"AI service call failed: {str(e)}")

async def call_ai_service_translate(text, source_lang, target_lang):
    """Call external AI service for translation"""
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "text": text,
                "source_lang": source_lang,
                "target_lang": target_lang
            }
            
            async with session.post(f"{AI_SERVICE_URL}/translate", json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_text = await response.text()
                    raise Exception(f"AI service error: {response.status} - {error_text}")
                    
    except aiohttp.ClientError as e:
        raise Exception(f"Failed to connect to AI service: {str(e)}")
    except Exception as e:
        raise Exception(f"AI service call failed: {str(e)}")



async def stt_task_with_ai_service(data_object):
    """New STT task that uses external AI service"""
    try:
        print(f"[STT_AI] Starting STT processing for user: {data_object.get('username', 'unknown')}")
        start_time = time.time()
        
        # Map language name to code if needed
        lang = data_object['language'].lower()
        print(f"[STT_AI] Processing language: {lang}")
        if lang in language_name_map:
            lang = language_name_map[lang]
            print(f"[STT_AI] Mapped to language code: {lang}")

        # Check if blob exists in data_object
        if "blob" not in data_object:
            print("[STT_AI] Error: Missing audio data (blob) in request")
            return {"error": "Missing audio data (blob) in request"}

        # Save audio file for record keeping (optional)
        user_id = data_object.get('username', None)
        if not user_id:
            user_id = f"ip_{data_object.get('ip', 'unknown')}"
        
        book_name = data_object.get('book', '').replace('.epub', '')
        
        print(f"[STT_AI] Creating directories for user: {user_id}, book: {book_name}")
        user_dir = RECORDINGS_DIR / user_id
        book_dir = user_dir / book_name if book_name else user_dir / "general"
        book_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        fpath = book_dir / f"recording_{timestamp}.wav"
        print(f"[STT_AI] Saving audio to: {fpath}")
        
        try:
            with open(fpath, "wb") as audio_file:
                base64_string = data_object["blob"]
                actual_base64 = base64_string.split(',')[1]
                binary_data = base64.b64decode(actual_base64)
                audio_file.write(binary_data)
            print(f"[STT_AI] Audio file saved successfully")
        except Exception as e:
            print(f"[STT_AI] Error saving audio file: {str(e)}")
            return {"error": f"Error saving audio file: {str(e)}"}

        # Call external AI service
        print(f"[STT_AI] Calling external AI service")
        try:
            expected_sentence = data_object.get("sentence")
            ai_result = await call_ai_service_stt(
                audio_base64=data_object["blob"], 
                language=lang, 
                expected_sentence=expected_sentence
            )
            print(f"[STT_AI] AI service call completed successfully")
        except Exception as e:
            print(f"[STT_AI] Error calling AI service: {str(e)}")
            # AI service failed, return error
            return {"error": f"AI service unavailable: {str(e)}"}

        # Extract results from AI service response
        predicted_sentence = ai_result.get("predicted_sentence", "")
        points = ai_result.get("points", 0)
        total_words = ai_result.get("total_words", 0)
        wrong_words = ai_result.get("wrong_words", 0)

        # Update database as before
        if data_object.get("book", "").endswith(".epub"):
            print(f"[STT_AI] Updating book task in database")
            db.set_current_book_task(data_object, fpath, predicted_sentence)
        else:
            print(f"[STT_AI] Updating pagele data")
            user_data = db.get_user_data(data_object.get("username"))
            if type(user_data["pagele"]) == str:
                pagele_data = json.loads(user_data["pagele"])
            else:
                pagele_data = user_data["pagele"]
            pagele_data["current_pagele"] = data_object.get("book")
            pagele_data["current_chapter"] = data_object.get("chapter")
            pagele_book = pagele_data["books"][data_object.get("book")]["completed_indices"]
            pagele_book[data_object.get("chapter")][str(data_object.get("currentSentenceIndex"))] = points
            total_points = 0
            for chapter in pagele_book.keys():
                try:
                    for sentence in pagele_book[chapter].keys():
                        total_points += pagele_book[chapter][sentence]
                except Exception as e:
                    print(f"[STT_AI] Error calculating points for chapter {chapter}: {str(e)}")
                    continue
            print(f"[STT_AI] Total points: {total_points}")
            pagele_data["books"][data_object.get("book")]["total_points"] = total_points
            user_data["pagele"] = json.dumps(pagele_data)
            db.update_pagele_data(user_data)
            print(f"[STT_AI] Pagele data updated successfully")
        
        message_returned = {
            "pred_sentence": predicted_sentence,
            "points": points,
            "total_words": total_words,
            "wrong_words": wrong_words,
        }
        print(f"[STT_AI] message_returned: {message_returned}")
        print(f"[STT_AI] STT processing completed in {time.time() - start_time:.4f}s")
        return message_returned

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[STT_AI] Critical error in STT processing: {str(e)}")
        print(f"[STT_AI] Error traceback: {error_trace}")
        return {"error": f"STT processing failed: {str(e)}"}

def extract_epub_cover(epub_path: Path, cover_dir: Path) -> str:
    """Extract cover image from EPUB file using the same approach as the PHP code"""
    try:
        with zipfile.ZipFile(epub_path) as zip_file:
            try:
                container = ET.fromstring(zip_file.read('META-INF/container.xml'))
                rootfile_path = container.find('.//{urn:oasis:names:tc:opendocol:xmlns:container}rootfile').get('full-path')

                # Read content.opf
                opf = ET.fromstring(zip_file.read(rootfile_path))

                # Look for cover image in manifest
                manifest = opf.find('.//{*}manifest')
                if manifest is not None:
                    # First try items with id containing 'cover'
                    for item in manifest.findall('.//{*}item'):
                        if 'cover' in item.get('id', '').lower():
                            href = item.get('href')
                            if href:
                                # Handle relative paths
                                if not href.startswith('/'):
                                    opf_dir = Path(rootfile_path).parent
                                    href = str(opf_dir / href)

                                # Extract and save the cover
                                try:
                                    image_data = zip_file.read(href.lstrip('/'))
                                    cover_dir.mkdir(parents=True, exist_ok=True)
                                    output_path = cover_dir / f"{epub_path.stem}.jpg"
                                    output_path.write_bytes(image_data)
                                    return str(output_path.relative_to(COVERS_DIR.parent))
                                except Exception as e:
                                    continue

                    # If no cover found, try first image in manifest
                    for item in manifest.findall('.//{*}item'):
                        media_type = item.get('media-type', '')
                        if media_type.startswith('image/'):
                            href = item.get('href')
                            if href:
                                # Handle relative paths
                                if not href.startswith('/'):
                                    opf_dir = Path(rootfile_path).parent
                                    href = str(opf_dir / href)

                                # Extract and save the cover
                                try:
                                    image_data = zip_file.read(href.lstrip('/'))
                                    cover_dir.mkdir(parents=True, exist_ok=True)
                                    output_path = cover_dir / f"{epub_path.stem}.jpg"
                                    output_path.write_bytes(image_data)
                                    return str(output_path.relative_to(COVERS_DIR.parent))
                                except Exception as e:
                                    continue

            except Exception as e:
                # Try direct image search as fallback
                for filename in zip_file.namelist():
                    if any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png']):
                        try:
                            image_data = zip_file.read(filename)
                            cover_dir.mkdir(parents=True, exist_ok=True)
                            output_path = cover_dir / f"{epub_path.stem}.jpg"
                            output_path.write_bytes(image_data)
                            return str(output_path.relative_to(COVERS_DIR.parent))
                        except Exception as e:
                            continue

    except Exception as e:
        print(f"Error extracting cover from {epub_path}: {e}")

    return DEFAULT_COVER

def get_file_as_base64(file_path: Path) -> str:
    """Convert a file to base64 string with proper mime type prefix"""
    try:
        mime_type = mimetypes.guess_type(str(file_path))[0]
        with open(file_path, 'rb') as file:
            b64_data = base64.b64encode(file.read()).decode('utf-8')
            return f"data:{mime_type};base64,{b64_data}"
    except Exception as e:
        return ""

async def get_available_books():
    """Get list of available EPUB books and their covers"""
    books = []

    try:
        # Make sure default cover exists
        default_cover_path = Path("images/default-cover.png")
        if not default_cover_path.exists():
            img = Image.new('RGB', (120, 180), color='lightgray')
            d = ImageDraw.Draw(img)
            d.text((10,10), "No\nCover", fill='black')
            default_cover_path.parent.mkdir(parents=True, exist_ok=True)
            img.save(default_cover_path)

        # Process books
        for lang_dir in EPUB_DIR.glob("*"):
            if lang_dir.is_dir():
                language = lang_dir.name

                for epub_path in lang_dir.glob("*.epub"):
                    cover_dir = COVERS_DIR / language
                    cover_path = extract_epub_cover(epub_path, cover_dir)

                    try:
                        if cover_path == DEFAULT_COVER:
                            cover_file = default_cover_path
                        else:
                            cover_file = COVERS_DIR.parent / cover_path

                        cover_base64 = get_file_as_base64(cover_file)

                        books.append({
                            "filename": epub_path.name,
                            "language": language,
                            "path": str(epub_path.relative_to(EPUB_DIR.parent)),
                            "cover": cover_base64
                            # Removed the epub base64 data to make the response lighter
                        })
                    except Exception as e:
                        print(f"Error processing book {epub_path.name}: {e}")
                        continue

        return books
    except Exception as e:
        return []

async def get_book_data(data_object):
    """Get specific book data by filename and language"""
    try:
        filename = data_object.get("filename")

        if not filename :
            return {"status": "error", "message": "Missing filename or language"}

        epubs = os.walk(EPUB_DIR)
        for root, dirs, files in epubs:
            for file in files:
                if file == filename:
                    epub_path = Path(root) / file
                    break
        language = epub_path.parent.name
        if not epub_path.exists():
            return {"status": "error", "message": f"Book not found: {filename}"}

        # Convert the EPUB file to base64
        epub_base64 = get_file_as_base64(epub_path)

        return {
            "status": "success",
            "filename": filename,
            "language": language,
            "epub": epub_base64
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}



async def login_task(self, data_object):
    print(f"[LOGIN] Starting login process for user: {data_object.get('username')}")
    start_time = time.time()
    
    conn = sqlite3.connect(self.DB_PATH)
    cursor = conn.cursor()

    username = data_object.get("username")
    password = data_object.get("password")

    # Get column names
    print(f"[LOGIN] Getting table columns")
    column_start = time.time()
    cursor.execute("PRAGMA table_info(users)")
    columns = [column[1] for column in cursor.fetchall()]
    print(f"[LOGIN] Got columns in {time.time() - column_start:.4f}s")

    print(f"[LOGIN] Checking credentials")
    auth_start = time.time()
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?",
                (username, password))
    user_row = cursor.fetchone()
    print(f"[LOGIN] Credential check completed in {time.time() - auth_start:.4f}s")

    if user_row:
        # Convert row to dictionary
        user = dict(zip(columns, user_row))
        
        # Generate new token using UUID and set expiry to 24 hours from now
        print(f"[LOGIN] Generating token")
        token_start = time.time()
        token = str(uuid.uuid4())
        expiry = datetime.now() + timedelta(days=10000)

        cursor.execute("""
            UPDATE users
            SET login_token = ?, token_expiry = ?
            WHERE username = ?""",
            (token, expiry, username))
        conn.commit()
        print(f"[LOGIN] Token generated and saved in {time.time() - token_start:.4f}s")

        message = {
            "status": "success",
            "token": token,
            "username": username,
            "current_book": user.get("current_book", ""),
            "cfi": user.get("cfi", ""),  # Use CFI instead of page
            "preferred_language": user.get("preferred_language", "en"),
            "pagele": json.loads(user.get("pagele", "{}")),
            "type": "login"
        }

        # Only add epub and language if there's a current book
        if user.get("current_book"):
            print(f"[LOGIN] Loading current book: {user.get('current_book')}")
            book_start = time.time()
            epub = None
            language = None
            epubs = os.walk(EPUB_DIR)
            for root, dirs, files in epubs:
                for file in files:
                    if file == user["current_book"]:
                        book_path = Path(root) / file
                        break
            if book_path.exists():
                language = book_path.parent.name
                print(f"[LOGIN] Loading book content")
                with open(book_path, "rb") as f:
                    book_data = f.read()
                    book_base64 = base64.b64encode(book_data).decode('utf-8')
                    epub = f"data:application/epub+zip;base64,{book_base64}"
            print(f"[LOGIN] Book loaded in {time.time() - book_start:.4f}s")

            if epub and language:
                message["epub"] = epub
                message["language"] = language

    else:
        message = {
            "status": "error",
            "message": "Invalid credentials"
        }

    conn.close()
    print(f"[LOGIN] Total login process took {time.time() - start_time:.4f}s")
    return message

async def verify_token_task(data_object):
    """Verify a login token and return user data if valid (uses in-memory cache)"""
    token = data_object.get("token")
    if not token:
        return {"status": "error", "message": "No token provided"}

    print(f"[VERIFY] Verifying token: {token}")
    # db.get_user_data now handles token validation (existence, matching, expiry)
    user_data = db.get_user_data(token) 

    if not user_data:
        print(f"[VERIFY] Token invalid or expired based on db.get_user_data.")
        return {"status": "error", "message": "Invalid or expired token"}

    print(f"[VERIFY] Token valid. User: {user_data.get('username')}")

    epub = None
    language = None
    current_book_filename = user_data.get("current_book")

    if current_book_filename:
        book_path = None
        # Find book path using os.walk, similar to original logic
        for root, dirs, files in os.walk(EPUB_DIR):
            if current_book_filename in files:
                book_path = Path(root) / current_book_filename
                break 
        
        if book_path and book_path.exists():
            language = book_path.parent.name 
            try:
                with open(book_path, "rb") as f:
                    book_content = f.read()
                    book_base64 = base64.b64encode(book_content).decode('utf-8')
                    epub = f"data:application/epub+zip;base64,{book_base64}"
            except Exception as e:
                print(f"[VERIFY] Error reading book file {book_path}: {e}")
                # epub will remain None, language might be set

    # Check actual Stripe subscription status
    stripe_subscription_id = user_data.get("stripe_subscription_id")
    actual_subscription_status = "none"
    
    if stripe_subscription_id:
        try:
            print(f"[VERIFY] Checking Stripe subscription status for: {stripe_subscription_id}")
            subscription = stripe.Subscription.retrieve(stripe_subscription_id)
            actual_subscription_status = subscription.status
            print(f"[VERIFY] Stripe subscription status: {actual_subscription_status}")
            
            # Update local database if status has changed
            if user_data.get("subscription_status") != actual_subscription_status:
                print(f"[VERIFY] Updating local status from '{user_data.get('subscription_status')}' to '{actual_subscription_status}'")
                user_data["subscription_status"] = actual_subscription_status
                db.dirty_users.add(user_data.get("username"))
                db.save_to_db()
                
        except stripe.error.StripeError as e:
            print(f"[VERIFY] Stripe error checking subscription: {str(e)}")
            # Keep local status if Stripe is unavailable
            actual_subscription_status = user_data.get("subscription_status", "none")
        except Exception as e:
            print(f"[VERIFY] Error checking subscription status: {str(e)}")
            actual_subscription_status = user_data.get("subscription_status", "none")
    
    response = {
        "success": True,  # Frontend expects "success" not "status" for token verification
        "type": "token_verification_result",
        "user_data": {
            "username": user_data.get("username", ""),
            "current_book": current_book_filename,
            "cfi": user_data.get("cfi", ""),
            "preferred_language": user_data.get("preferred_language", "en"),
            "points": user_data.get("points", 0),
        },
        "token": token, 
        "language": language, 
        "subscription_status": actual_subscription_status,  # Use actual Stripe status
        "special_access": user_data.get("special_access", "none"),
        "has_special_access": False,  # Will be calculated below
    }
    
    # Check if user has active special access
    special_access = user_data.get("special_access", "none")
    special_access_expiry = user_data.get("special_access_expiry")
    
    if special_access == "lifetime_free":
        response["has_special_access"] = True
    elif special_access in ["free_month", "premium_trial"] and special_access_expiry:
        expiry_dt = None
        if isinstance(special_access_expiry, str):
            try:
                if '.' in special_access_expiry:
                    expiry_dt = datetime.strptime(special_access_expiry, '%Y-%m-%d %H:%M:%S.%f')
                else:
                    expiry_dt = datetime.strptime(special_access_expiry, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                print(f"[VERIFY] Invalid special access expiry format for user {user_data.get('username')}: {special_access_expiry}")
        elif isinstance(special_access_expiry, datetime):
            expiry_dt = special_access_expiry
            
        if expiry_dt and expiry_dt > datetime.now():
            response["has_special_access"] = True
        else:
            # Expired special access, reset to none
            user_data["special_access"] = "none"
            user_data["special_access_expiry"] = None
            db.dirty_users.add(user_data.get("username"))
            response["special_access"] = "none"
    
    if epub: 
        response["epub"] = epub

    # Ensure pagele data is consistent with login_task response
    pagele_data_in_user = user_data.get("pagele", {})
    response["pagele"] = pagele_data_in_user if isinstance(pagele_data_in_user, dict) else {}

    # Log a summary of the response for easier debugging
    response_summary = {k: (v[:30] + '...' if isinstance(v, str) and v and len(v) > 30 else v) for k, v in response.items()}
    return response

def pagele_task(data_object):
    """Get sentences from EPUB book for the Pagele game"""
    try:
        # Get user data
        username = data_object.get("username")
        book = data_object.get("book")
        cfi = data_object.get("cfi")

        if not all([username, book]):
            return {"status": "error", "message": "Missing required data"}

        # Find the book file
        book_path = None
        for root, _, files in os.walk(EPUB_DIR):
            if book in files:
                book_path = Path(root) / book
                break

        if not book_path or not book_path.exists():
            return {"status": "error", "message": "Book not found"}

        # Extract text from EPUB
        with zipfile.ZipFile(book_path) as zip_file:
            # Find the content files (usually XHTML/HTML files)
            content_files = [f for f in zip_file.namelist() if f.endswith(('.xhtml', '.html'))]
            
            all_text = []
            for content_file in content_files:
                content = zip_file.read(content_file).decode('utf-8')
                # Parse HTML and extract text
                root = ET.fromstring(content)
                # Remove script and style elements
                for elem in root.findall(".//script"):
                    elem.clear()
                for elem in root.findall(".//style"):
                    elem.clear()
                
                # Get text content
                text = "".join(root.itertext())
                # Split into sentences (basic implementation)
                sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 20]
                all_text.extend(sentences)

            # Find current position using CFI if provided
            start_index = 0
            if cfi:
                # Simple implementation - just use it as an index
                try:
                    start_index = int(cfi)
                except ValueError:
                    start_index = 0

            # Get next 10 sentences
            selected_sentences = all_text[start_index:start_index + 10]
            next_cfi = str(start_index + len(selected_sentences))

            return {
                "status": "success",
                "sentences": selected_sentences,
                "next_cfi": next_cfi,
                "total_sentences": len(all_text)
            }

    except Exception as e:
        return {"status": "error", "message": str(e)}



async def init_pagele_task(data_object):
    print(f"[PAGELE] Starting pagele initialization")
    start_time = time.time()
    
    token = data_object["token"]
    pagele_filename = data_object["pagele_filename"]
    language = data_object["language"]
    
    print(f"[PAGELE] Getting user data for token")
    user_start = time.time()
    user_data = db.get_user_data(token)
    if not user_data:
        return {"status": "error", "message": "Invalid token or user not found"}
    print(f"[PAGELE] Got user data in {time.time() - user_start:.4f}s")
    
    # Get pagele data from user
    pagele_data = user_data.get("pagele", {})
    if isinstance(pagele_data, str):
        try:
            pagele_data = json.loads(pagele_data)
        except json.JSONDecodeError:
            pagele_data = {}
    
    # Ensure pagele_data is a dictionary
    if not isinstance(pagele_data, dict):
        pagele_data = {}
    
    # Get pagele file data
    print(f"[PAGELE] Loading pagele file data")
    file_start = time.time()
    pagele_json = db.get_pagele_file(language, pagele_filename)
    if not pagele_json:
        return {"status": "error", "message": "Failed to load pagele file"}
    print(f"[PAGELE] Loaded pagele file in {time.time() - file_start:.4f}s")
   
    print(f"[PAGELE] Updating user pagele data")
    update_start = time.time()
    if "books" in pagele_data and pagele_filename in list(pagele_data["books"].keys()):
        pagele_data["current_pagele"] = pagele_filename
    else:
        print(f"[PAGELE] Initializing completed indices")
        completed_indices = init_completed_indices(pagele_json)
        pagele_data["current_pagele"] = pagele_filename
        pagele_data["current_index"] = 0
        if "books" not in pagele_data:
            pagele_data["books"] = {}
        pagele_data["books"][pagele_filename] = {"completed_indices": completed_indices, "total_points": 0, "last_played": ""}

    # Update user data in memory
    user_data["pagele"] = pagele_data
    print(f"[PAGELE] Updated user data in {time.time() - update_start:.4f}s")
    
    # Update database (memory only, no disk write)
    db_start = time.time()
    db.update_pagele_data(user_data)
    print(f"[PAGELE] Updated in-memory database in {time.time() - db_start:.4f}s")
    
    print(f"[PAGELE] Total pagele initialization took {time.time() - start_time:.4f}s")
    return {"status": "success", "pagele_data": pagele_json, "index": pagele_data["current_index"], "type": "get_pagele", "user_pagele": pagele_data}

def init_completed_indices(pagele_json):
    completed_indices = {}
    for chapter in pagele_json:
        completed_indices[chapter] = {}
        for idx, sentence in enumerate(pagele_json[chapter]):
            completed_indices[chapter][str(idx)] = 0
    return completed_indices

async def get_available_pagele():
    pagele_books = []  # Initialize the list to store pagele data
    
    try:
        # Look for pagele JSON files in each language directory
        for lang_dir in EPUB_DIR.glob("*"):
            if lang_dir.is_dir():
                language = lang_dir.name
                
                # Look for pagele JSON files
                for pagele_path in lang_dir.glob("*.json"):
                    
                    try:
                        # Load the pagele JSON file
                        
                        book_name = pagele_path.stem.replace('.json', '')
                        book_path = lang_dir / f"{book_name}.epub"
                        book_cover = f"covers/{language}/{book_name}.jpg"
                        # Get cover image if the book exists
                        cover_base64 = ""
                        if os.path.isfile(book_cover):
                            cover_base64 = get_file_as_base64(book_cover)
                        else:
                        # Get cover image if the book exists
                            if book_path.exists():
                                cover_dir = COVERS_DIR / language
                                cover_path = extract_epub_cover(book_path, cover_dir)
                                
                                if cover_path == DEFAULT_COVER:
                                    cover_file = Path("images/default-cover.png")
                                else:
                                    cover_file = COVERS_DIR.parent / cover_path
                                    
                                cover_base64 = get_file_as_base64(cover_file)
                        
                        # Add pagele information to the list
                        pagele_books.append({
                            "filename": pagele_path.name,
                            "book_name": book_name,
                            "language": language,
                            "path": str(pagele_path.relative_to(EPUB_DIR.parent)),
                            "cover": cover_base64,
                        })
                    except Exception as e:
                        continue
        return pagele_books
    except Exception as e:
        return []
def update_interface_language_task(data_object):
    print(f"[UPDATE_INTERFACE_LANGUAGE] data_object: {data_object}")
    language = data_object.get("language")
    newLang = interface_language_json.get(language)
    db.change_settings_task(data_object)
    return {"status": "success", "interface_language": newLang}

async def handle_connection(websocket):
    print(f"[SERVER] New connection from {websocket.remote_address}")
    start_time = time.time()
    
    try:
        print(f"[SERVER] Waiting for data")
        recv_start = time.time()
        data = await websocket.recv()
        print(f"[SERVER] Received data in {time.time() - recv_start:.4f}s")
        
        print(f"[SERVER] Parsing JSON")
        parse_start = time.time()
        # Use orjson for loading if preferred, though standard json.loads is usually less of a bottleneck
        data_object = json.loads(data) 
        print(f"[SERVER] Parsed JSON in {time.time() - parse_start:.4f}s")
        
        client_ip = websocket.remote_address[0]
        data_object['ip'] = client_ip
        message_returned = {"error": "Invalid task"}  # Default message

        task = data_object.get("task")
        print(f"[SERVER] Processing task: {task}")
        task_start = time.time()
        
        if task == "get_books":
            books = await get_available_books()
            message_returned = {"books": books}
        elif task == "get_book_data":
            message_returned = await get_book_data(data_object)
        elif task == "stt":
            message_returned = await stt_task_with_ai_service(data_object)
        elif task == "tts":
            message_returned = await tts_task_with_ai_service(data_object)
        elif task == "login":
            message_returned = await db.login_task(data_object)
        elif task == "signup":
            message_returned = db.signup_task(data_object)
        elif task == "change_settings":
            message_returned = db.change_settings_task(data_object)
        elif task == "translate":
            message_returned = await translate_task_with_ai_service(data_object)
        elif task == "verify_token":
            message_returned = await verify_token_task(data_object)
        elif task == "pagele":
            message_returned = await pagele_task(data_object)
        elif task == "get_pagele_list":
            message_returned = await get_available_pagele()
        elif task == "init_pagele":
            message_returned = await init_pagele_task(data_object)
        elif task == "tip":
            message_returned = await tip_task(data_object)
        elif task == "create_setup_intent":
            message_returned = await create_setup_intent_task(data_object)
        
        elif task == "create_subscription":
            message_returned = await create_subscription_task(data_object)
        elif task == "cancel_subscription":
            message_returned = await cancel_subscription_task(data_object)
        elif task == "get_subscription_status":
            message_returned = await get_subscription_status_task(data_object)
        elif task == "sync_subscription_status":
            message_returned = await sync_subscription_status_task(data_object)
        elif task == "send_bug_report":
            message_returned = await send_bug_report_task(data_object)
        elif task == "update_interface_language":
            message_returned = update_interface_language_task(data_object)
        elif task == "grant_special_access":
            message_returned = await grant_special_access_task(data_object)
        elif task == "check_special_access":
            message_returned = await check_special_access_task(data_object)
        elif task == "revoke_special_access":
            message_returned = await revoke_special_access_task(data_object)
        print(f"[SERVER] Task {task} processed in {time.time() - task_start:.4f}s")

        print(f"[SERVER] Serializing response to JSON with orjson")
        json_dump_start = time.time()
        # Use orjson.dumps() which returns bytes
        response_bytes = orjson.dumps(message_returned) 
        print(f"[SERVER] Serialized JSON with orjson in {time.time() - json_dump_start:.4f}s")
        
        print(f"[SERVER] Sending response")
        send_start = time.time()
        # Send the bytes directly. Most WebSocket libraries handle this.
        # If your library needs a string, use: await websocket.send(response_bytes.decode())
        await websocket.send(response_bytes) 
        
        print(f"[SERVER] Response sent in {time.time() - send_start:.4f}s")

    except Exception as e:
        print(f"[SERVER] Error: {e}")
        error_message = str(e)
        if len(error_message) > 500: # Truncate very long error messages
            error_message = error_message[:500] + "... (truncated)"
        await websocket.send(orjson.dumps({"error": error_message}))
    finally:
        print(f"[SERVER] Connection handled in {time.time() - start_time:.4f}s")
        dtowrite = {"time": recv_start,"ip": client_ip, "received": data_object}
        if task == "stt":
            dtowrite["received"]["blob"] = "REDACTED"
            dtowrite["sent"] = message_returned
        WEBSOCKET_LOG.write(json.dumps(dtowrite) + "\n")
        WEBSOCKET_LOG.flush()
        print("[SERVER] Client disconnected Log writte")



class DatabaseManager:
    def __init__(self, db_path):
        self.DB_PATH = db_path
        self.connection = None
        
        # In-memory data store
        self.users = {}  # username -> complete user data
        self.tokens = {}  # token -> username mapping
        self.pagele_files = {}  # language/filename -> pagele data
        
        # Dirty flags to track what needs saving
        self.dirty_users = set()
        self.last_save_time = time.time()
    
    def get_connection(self):
        """Get a database connection"""
        if self.connection is None:
            self.connection = sqlite3.connect(self.DB_PATH)
            # Enable WAL mode for better concurrency
            self.connection.execute('PRAGMA journal_mode=WAL')
            # Increase cache size for better performance
            self.connection.execute('PRAGMA cache_size=-10000')  # ~10MB cache
        
        return self.connection
    
    def close_connection(self):
        """Close the database connection"""
        # Save any pending changes first
        self.save_to_db()
        
        if self.connection:
            self.connection.close()
            self.connection = None
            
    def init_database(self):
        """Initialize the SQLite database with necessary tables"""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Create users table with CFI instead of page
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            current_book TEXT DEFAULT '',
            cfi TEXT DEFAULT '',  -- Changed from page to cfi
            utterrance_fname TEXT DEFAULT '',
            predicted_sentence TEXT DEFAULT '',
            preferred_language TEXT DEFAULT 'en',
            login_token TEXT,
            token_expiry TIMESTAMP,
            pagele TEXT DEFAULT '{}',  -- New column for storing pagele data as JSON
            stripe_customer_id TEXT DEFAULT '',
            stripe_subscription_id TEXT DEFAULT '',
            subscription_status TEXT DEFAULT 'none',
            email TEXT DEFAULT '',
            special_access TEXT DEFAULT 'none',  -- 'none', 'lifetime_free', 'free_month', 'premium_trial'
            special_access_expiry TIMESTAMP NULL,
            granted_by TEXT DEFAULT '',
            access_notes TEXT DEFAULT ''
        )
        ''')
        
        # Create index on login_token for faster token lookups
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_login_token ON users(login_token)')
        
        # Check if columns exist, add them if they don't
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'pagele' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN pagele TEXT DEFAULT '{}'")
        if 'stripe_customer_id' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT ''")
        if 'stripe_subscription_id' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT DEFAULT ''")
        if 'subscription_status' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'none'")
        if 'email' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
            
        # Add special access columns
        if 'special_access' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN special_access TEXT DEFAULT 'none'")
        if 'special_access_expiry' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN special_access_expiry TIMESTAMP NULL")
        if 'granted_by' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN granted_by TEXT DEFAULT ''")
        if 'access_notes' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN access_notes TEXT DEFAULT ''")
            
        conn.commit()

        conn.commit()
        
        # Load all users into memory
        self._load_all_users()
        
    def _load_all_users(self):
        """Load all users into memory and only valid tokens"""
        print("[DB] Loading all users into memory...")
        start_time = time.time()
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users")
        rows = cursor.fetchall()
        
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        self.users.clear() # Clear existing in-memory users
        self.tokens.clear() # Clear existing in-memory tokens

        for row in rows:
            user_data = dict(zip(columns, row))
            username = user_data["username"]
            
            if user_data.get("pagele"):
                try:
                    pagele_data_loaded = json.loads(user_data["pagele"])
                    if isinstance(pagele_data_loaded, dict) and "books" in pagele_data_loaded:
                        for book_name, book_data in pagele_data_loaded.get("books", {}).items():
                            if isinstance(book_data, dict) and "completed_indices" in book_data:
                                completed_indices = book_data.get("completed_indices", {})
                                if isinstance(completed_indices, dict):
                                    new_completed_indices = {}
                                    for chapter_key, chapter_value in completed_indices.items():
                                        # Ensure chapter_key is string
                                        str_chapter_key = str(chapter_key)
                                        if isinstance(chapter_value, dict):
                                            # Ensure sentence indices are strings
                                            new_sentence_dict = {str(sentence_idx): score for sentence_idx, score in chapter_value.items()}
                                            new_completed_indices[str_chapter_key] = new_sentence_dict
                                        else:
                                            # Preserve structure if chapter_value is not a dict (e.g. already processed or different format)
                                            new_completed_indices[str_chapter_key] = chapter_value
                                    book_data["completed_indices"] = new_completed_indices
                    user_data["pagele"] = pagele_data_loaded
                except (json.JSONDecodeError, TypeError):
                    user_data["pagele"] = {} # Default to empty dict on error
            else:
                user_data["pagele"] = {}
            
            self.users[username] = user_data # Store user data

            # Validate and store token
            token = user_data.get("login_token")
            expiry_str = user_data.get("token_expiry")

            if token and expiry_str:
                expiry_dt = None
                try:
                    # Attempt to parse expiry string, accommodating formats with or without microseconds
                    if '.' in expiry_str:
                        expiry_dt = datetime.strptime(expiry_str, '%Y-%m-%d %H:%M:%S.%f')
                    else:
                        expiry_dt = datetime.strptime(expiry_str, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    print(f"[DB] Invalid token expiry format for user {username}: '{expiry_str}'")


                if expiry_dt and expiry_dt > datetime.now():
                    self.tokens[token] = username
                else:
                    # Token is expired, invalid, or has bad format; clear it from this user's in-memory data
                    user_data["login_token"] = None
                    user_data["token_expiry"] = None
            else:
                # No token or no expiry string, ensure they are cleared in memory
                user_data["login_token"] = None
                user_data["token_expiry"] = None
        
        print(f"[DB] Loaded {len(self.users)} users into memory. Active tokens in cache: {len(self.tokens)}. Time: {time.time() - start_time:.4f}s")

    def save_to_db(self):
        """Save dirty users to database"""
        if not self.dirty_users:
            return
            
        print(f"[DB] Saving {len(self.dirty_users)} users to database...")
        start_time = time.time()
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        for username in self.dirty_users:
            if username not in self.users:
                continue
                
            user_data = self.users[username]
            
            # Convert pagele to JSON if it's a dict
            pagele_json = user_data.get("pagele", {})
            if not isinstance(pagele_json, str):
                pagele_json = json.dumps(pagele_json)
            
            cursor.execute("""
                UPDATE users SET 
                    current_book = ?,
                    cfi = ?,
                    utterrance_fname = ?,
                    predicted_sentence = ?,
                    preferred_language = ?,
                    login_token = ?,
                    token_expiry = ?,
                    pagele = ?,
                    stripe_customer_id = ?,
                    stripe_subscription_id = ?,
                    subscription_status = ?,
                    email = ?,
                    special_access = ?,
                    special_access_expiry = ?,
                    granted_by = ?,
                    access_notes = ?
                WHERE username = ?
            """, (
                user_data.get("current_book", ""),
                user_data.get("cfi", ""),
                user_data.get("utterrance_fname", ""),
                user_data.get("predicted_sentence", ""),
                user_data.get("preferred_language", "en"),
                user_data.get("login_token", ""),
                user_data.get("token_expiry", ""),
                pagele_json,
                user_data.get("stripe_customer_id", ""),
                user_data.get("stripe_subscription_id", ""),
                user_data.get("subscription_status", "none"),
                user_data.get("email", ""),
                user_data.get("special_access", "none"),
                user_data.get("special_access_expiry", None),
                user_data.get("granted_by", ""),
                user_data.get("access_notes", ""),
                username
            ))
        
        conn.commit()
        self.dirty_users.clear()
        self.last_save_time = time.time()
        
        print(f"[DB] Save completed in {time.time() - start_time:.4f}s")

    def update_pagele_data(self, user_data):
        """Update pagele data in memory only"""
        print(f"[DB] Updating pagele data for user: {user_data.get('username')}")
        start_time = time.time()
        
        username = user_data.get("username")
        if not username or username not in self.users:
            print(f"[DB] User not found: {username}")
            return
        
        # Update in memory only
        self.users[username]["pagele"] = user_data["pagele"]
        
        # Mark as dirty for later saving
        self.dirty_users.add(username)
        
        print(f"[DB] Memory update completed in {time.time() - start_time:.4f}s")
    
    def get_user_data(self, identifier):
        """Get user data from memory, validating token and expiry if identifier is a token."""
        # Shorten identifier for logging if it's long (like a token)
        log_identifier = identifier[:15] + '...' if identifier and len(identifier) > 15 else identifier
        print(f"[DB] Getting user data for: {log_identifier}")
        start_time = time.time()
        
        # Case 1: Identifier is a username
        if identifier in self.users:
            print(f"[DB] User '{identifier}' found by username in {time.time() - start_time:.4f}s")
            return self.users[identifier]
        
        # Case 2: Identifier is (potentially) a token
        if identifier in self.tokens:
            username = self.tokens[identifier]
            user = self.users.get(username)

            if user and user.get("login_token") == identifier:
                # Token in self.tokens matches the one stored for the user. Now check expiry.
                token_expiry = user.get("token_expiry") # This could be datetime object or string
                
                if token_expiry:
                    expiry_dt = None
                    if isinstance(token_expiry, str):
                        try:
                            if '.' in token_expiry: # Format with microseconds
                                expiry_dt = datetime.strptime(token_expiry, '%Y-%m-%d %H:%M:%S.%f')
                            else: # Format without microseconds
                                expiry_dt = datetime.strptime(token_expiry, '%Y-%m-%d %H:%M:%S')
                        except ValueError as e_parse:
                            print(f"[DB] Error parsing token_expiry string '{token_expiry}' for user '{username}': {e_parse}")
                            return None # Invalid expiry format
                    elif isinstance(token_expiry, datetime):
                        expiry_dt = token_expiry
                    else:
                        print(f"[DB] Invalid token_expiry type for user '{username}': {type(token_expiry)}")
                        return None 

                    if expiry_dt and expiry_dt > datetime.now():
                        print(f"[DB] User '{username}' found by valid token '{log_identifier}' in {time.time() - start_time:.4f}s")
                        return user
                    else:
                        print(f"[DB] Token '{log_identifier}' for user '{username}' expired or invalid. Expiry: {expiry_dt}")
                        return None 
                else:
                    print(f"[DB] No token_expiry field for user '{username}' with matching token '{log_identifier}'.")
                    return None
            else:
                # Mismatch or user not found, indicating a stale token in self.tokens or inconsistent state
                if not user:
                     print(f"[DB] Token '{log_identifier}' maps to username '{username}', but user not found in self.users.")
                else: # user.get("login_token") != identifier
                     print(f"[DB] Token '{log_identifier}' maps to username '{username}', but user's current token is '{user.get('login_token')}'. Mismatch.")
                # Consider removing the stale token: if identifier in self.tokens: del self.tokens[identifier]
                return None
        
        print(f"[DB] Identifier '{log_identifier}' not found as username or valid token. Lookup took {time.time() - start_time:.4f}s")
        return None

    async def login_task(self, data_object):
        print(f"[LOGIN] Starting login process for user: {data_object.get('username')}")
        start_time = time.time()
        
        username = data_object.get("username")
        password = data_object.get("password")
        
        user_data = self.users.get(username)

        if user_data and user_data.get("password") == password:
            # Valid credentials
            old_token = user_data.get("login_token")
            if old_token and old_token in self.tokens:
                # Remove the old token from the central token map
                del self.tokens[old_token]
                print(f"[LOGIN] Removed old token {old_token[:8]}... for user {username}")

            # Generate new token
            new_token = str(uuid.uuid4())
            # Store expiry as datetime object in memory for precise comparison
            expiry = datetime.now() + timedelta(days=10000) 
            
            user_data["login_token"] = new_token
            user_data["token_expiry"] = expiry # Stored as datetime object
            
            # Update token mapping
            self.tokens[new_token] = username
            
            self.dirty_users.add(username) # Mark as dirty for later saving
            
            # Check if user has active special access
            special_access = user_data.get("special_access", "none")
            special_access_expiry = user_data.get("special_access_expiry")
            has_active_special_access = False
            
            if special_access == "lifetime_free":
                has_active_special_access = True
            elif special_access in ["free_month", "premium_trial"] and special_access_expiry:
                expiry_dt = None
                if isinstance(special_access_expiry, str):
                    try:
                        if '.' in special_access_expiry:
                            expiry_dt = datetime.strptime(special_access_expiry, '%Y-%m-%d %H:%M:%S.%f')
                        else:
                            expiry_dt = datetime.strptime(special_access_expiry, '%Y-%m-%d %H:%M:%S')
                    except ValueError:
                        print(f"[LOGIN] Invalid special access expiry format for user {username}: {special_access_expiry}")
                elif isinstance(special_access_expiry, datetime):
                    expiry_dt = special_access_expiry
                    
                if expiry_dt and expiry_dt > datetime.now():
                    has_active_special_access = True
                else:
                    # Expired special access, reset to none
                    user_data["special_access"] = "none"
                    user_data["special_access_expiry"] = None
                    self.dirty_users.add(username)

            message = {
                "status": "success",
                "token": new_token,
                "username": username,
                "current_book": user_data.get("current_book", ""),
                "cfi": user_data.get("cfi", ""),
                "preferred_language": user_data.get("preferred_language", "en"),
                "pagele": user_data.get("pagele", {}), # pagele is already a dict here
                "subscription_status": user_data.get("subscription_status", "none"),
                "special_access": special_access,
                "has_special_access": has_active_special_access,
                "type": "login"
            }
            
            if user_data.get("current_book"):
                epub = None
                language = None
                book_path = None
                
                for root, dirs, files in os.walk(EPUB_DIR):
                    for file_in_dir in files: # Renamed 'file' to 'file_in_dir' to avoid conflict
                        if file_in_dir == user_data["current_book"]:
                            book_path = Path(root) / file_in_dir
                            break
                    if book_path:
                        break
                        
                if book_path and book_path.exists():
                    language = book_path.parent.name
                    try:
                        with open(book_path, "rb") as f:
                            book_file_data = f.read() # Renamed to avoid conflict
                            book_base64 = base64.b64encode(book_file_data).decode('utf-8')
                            epub = f"data:application/epub+zip;base64,{book_base64}"
                    except Exception as e:
                        print(f"[LOGIN] Error reading book file {book_path} for user {username}: {e}")
                        
                if epub and language:
                    message["epub"] = epub
                    message["language"] = language
            
            print(f"[LOGIN] Login successful for {username}. New token: {new_token[:8]}... Total time: {time.time() - start_time:.4f}s")
            return message
        else:
            print(f"[LOGIN] Invalid credentials for user: {username}. Time: {time.time() - start_time:.4f}s")
            return {"status": "error", "message": "Invalid credentials"}

    def signup_task(self, data_object):
        """Create a new user in memory and database"""
        username = data_object.get("username")
        password = data_object.get("password")
        
        # Check if username already exists
        if username in self.users:
            return {"status": "error", "message": "Username already exists"}
        
        # Generate token for new user
        token = str(uuid.uuid4())
        expiry = datetime.now() + timedelta(days=10000)
        
        # Create new user in memory
        user_data = {
            "username": username,
            "password": password,
            "login_token": token,
            "token_expiry": expiry,
            "current_book": "",
            "cfi": "",
            "utterrance_fname": "",
            "predicted_sentence": "",
            "preferred_language": "en",
            "pagele": {}
        }
        
        # Store in memory
        self.users[username] = user_data
        self.tokens[token] = username
        
        # Mark as dirty for later saving
        self.dirty_users.add(username)
        
        # Also save immediately to database
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO users (username, password, login_token, token_expiry)
            VALUES (?, ?, ?, ?)""",
            (username, password, token, expiry))
        conn.commit()
        
        return {
            "status": "success",
            "message": "User created successfully",
            "token": token,
            "username": username
        }

    def set_current_book_task(self, data_object, utterrance_fname, predicted_sentence):
        """Update current book info in memory"""
        username = data_object.get("username")
        if not username or username not in self.users:
            return False
            
        current_book = data_object.get("book", data_object.get("current_book", ""))
        cfi = data_object.get("cfi", "")
        
        # Update in memory
        self.users[username]["current_book"] = current_book
        self.users[username]["cfi"] = cfi
        self.users[username]["utterrance_fname"] = utterrance_fname
        self.users[username]["predicted_sentence"] = predicted_sentence
        
        # Mark as dirty for later saving
        self.dirty_users.add(username)
        
        return True

    def change_settings_task(self, data_object):
        """Update user settings in memory"""
        token = data_object.get("token")
        if not token or token not in self.tokens:
            return {"status": "error", "message": "Invalid token"}
            
        username = self.tokens[token]
        user_data = self.users[username]
        
        # Update settings
        if "current_book" in data_object:
            user_data["current_book"] = data_object["current_book"]
        if "cfi" in data_object:
            user_data["cfi"] = data_object["cfi"]
        if "preferred_language" in data_object:
            user_data["preferred_language"] = data_object["preferred_language"]
        if "language" in data_object:
            user_data["preferred_language"] = data_object["language"]
            
        # Mark as dirty for later saving
        self.dirty_users.add(username)
        
        return {"status": "success", "message": "Settings updated successfully"}

    def get_pagele_file(self, language, filename):
        """Get pagele file data from memory cache or load from disk"""
        cache_key = f"{language}/{filename}"
        
        if cache_key in self.pagele_files:
            return self.pagele_files[cache_key]
            
        # Load from disk
        pagele_path = f"{EPUB_DIR}/{language}/{filename}"
        try:
            with open(pagele_path, "r") as f:
                pagele_data = json.load(f)
                
            # Cache for future use
            self.pagele_files[cache_key] = pagele_data
            return pagele_data
        except Exception as e:
            print(f"[DB] Error loading pagele file {pagele_path}: {e}")
            return None



async def tip_task(data_object):
    """Create a Stripe PaymentIntent for a tip."""
    try:
        amount_str = data_object.get("amount")
        if not amount_str:
            return {"status": "error", "message": "Amount not provided for tip."}

        try:
            # Stripe expects the amount in the smallest currency unit (e.g., cents for USD)
            amount_in_cents = int(float(amount_str) * 100)
        except ValueError:
            return {"status": "error", "message": "Invalid amount format."}

        if amount_in_cents <= 0: # Basic validation for amount
            return {"status": "error", "message": "Tip amount must be positive."}

        print(f"[TIP] Creating PaymentIntent for amount: {amount_in_cents} cents")
        
        # Create a PaymentIntent with the order amount and currency
        intent = stripe.PaymentIntent.create(
            amount=amount_in_cents,
            currency='gbp', # You can change this to your desired currency
            automatic_payment_methods={
                'enabled': True,
            },
        )
        print(f"[TIP] PaymentIntent created successfully. ID: {intent.id}")
        return {
            "status": "success",
            "client_secret": intent.client_secret
        }
    except stripe.error.StripeError as e:
        print(f"[TIP] Stripe error: {str(e)}")
        return {"status": "error", "message": f"Stripe error: {str(e)}"}
    except Exception as e:
        print(f"[TIP] Error creating PaymentIntent: {str(e)}")
        return {"status": "error", "message": f"Error processing tip: {str(e)}"}

async def update_stripe_customer_name(user_data):
    """Update existing Stripe customer with proper name if missing"""
    try:
        stripe_customer_id = user_data.get("stripe_customer_id")
        username = user_data.get("username")
        
        if stripe_customer_id and username:
            # Get current customer info
            customer = stripe.Customer.retrieve(stripe_customer_id)
            
            # Update name if it's missing or empty
            if not customer.get('name'):
                name = username.split('@')[0].title()
                stripe.Customer.modify(
                    stripe_customer_id,
                    name=name
                )
                print(f"[STRIPE] Updated customer {stripe_customer_id} with name: {name}")
                
    except Exception as e:
        print(f"[STRIPE] Error updating customer name: {str(e)}")

async def create_setup_intent_task(data_object):
    """Create a SetupIntent for collecting payment method information."""
    try:
        token = data_object.get("token")
        
        if not token:
            return {"status": "error", "message": "Token required for setup intent"}
        
        # Get user data
        user_data = db.get_user_data(token)
        if not user_data:
            return {"status": "error", "message": "Invalid token"}
        
        username = user_data.get("username")
        # Use username as email if no separate email field exists
        email = user_data.get("email", username)
        
        print(f"[SETUP_INTENT] Creating setup intent for user: {username}")
        
        # Create or get Stripe customer
        stripe_customer_id = user_data.get("stripe_customer_id")
        
        if not stripe_customer_id:
            # Create new customer with proper name and email
            customer = stripe.Customer.create(
                name=username.split('@')[0].title(),  # Use part before @ as name, capitalized
                email=email,
                metadata={'username': username}
            )
            stripe_customer_id = customer.id
            
            # Store customer ID in database
            user_data["stripe_customer_id"] = stripe_customer_id
            db.dirty_users.add(username)
            print(f"[SETUP_INTENT] Created new Stripe customer: {stripe_customer_id}")
        else:
            print(f"[SETUP_INTENT] Using existing Stripe customer: {stripe_customer_id}")
            # Update customer name if missing
            await update_stripe_customer_name(user_data)
        
        # Create SetupIntent
        setup_intent = stripe.SetupIntent.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            usage='off_session'  # For future payments
        )
        
        print(f"[SETUP_INTENT] Created setup intent: {setup_intent.id}")
        
        return {
            "status": "success",
            "setup_intent_client_secret": setup_intent.client_secret
        }
        
    except stripe.error.StripeError as e:
        print(f"[SETUP_INTENT] Stripe error: {str(e)}")
        return {"status": "error", "message": f"Stripe error: {str(e)}"}
    except Exception as e:
        print(f"[SETUP_INTENT] Error creating setup intent: {str(e)}")
        return {"status": "error", "message": f"Error creating setup intent: {str(e)}"}

async def create_subscription_task(data_object):
    """Create a monthly subscription for a user."""
    try:
        token = data_object.get("token")
        payment_method_id = data_object.get("payment_method_id")
        
        if not token:
            return {"status": "error", "message": "Token required for subscription"}
        
        if not payment_method_id:
            return {"status": "error", "message": "Payment method required"}
        
        # Get user data
        user_data = db.get_user_data(token)
        if not user_data:
            return {"status": "error", "message": "Invalid token"}
        
        username = user_data.get("username")
        # Use username as email if no separate email field exists
        email = user_data.get("email", username)
        
        print(f"[SUBSCRIPTION] Creating subscription for user: {username}")
        
        # Create or get Stripe customer
        stripe_customer_id = user_data.get("stripe_customer_id")
        
        if not stripe_customer_id:
            # Create new customer with proper name and email
            customer = stripe.Customer.create(
                name=username.split('@')[0].title(),  # Use part before @ as name, capitalized
                email=email,
                metadata={'username': username}
            )
            stripe_customer_id = customer.id
            
            # Store customer ID in database
            user_data["stripe_customer_id"] = stripe_customer_id
            db.dirty_users.add(username)
            print(f"[SUBSCRIPTION] Created new Stripe customer: {stripe_customer_id}")
        else:
            print(f"[SUBSCRIPTION] Using existing Stripe customer: {stripe_customer_id}")
            # Update customer name if missing
            await update_stripe_customer_name(user_data)
        
        # Attach payment method to customer
        stripe.PaymentMethod.attach(
            payment_method_id,
            customer=stripe_customer_id,
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            stripe_customer_id,
            invoice_settings={'default_payment_method': payment_method_id},
        )
        
        # Create subscription
        # Replace 'price_xxxxx' with your actual Price ID from Stripe Dashboard
        subscription = stripe.Subscription.create(
            customer=stripe_customer_id,
            items=[
                {
                    'price': 'price_1RifVyH6FESgUvUmOA6tkFLG',  # Replace with your actual Price ID
                },
            ],
            default_payment_method=payment_method_id,  # Use the payment method from SetupIntent
            expand=['latest_invoice.payment_intent'],
        )
        
        # Store subscription info
        user_data["stripe_subscription_id"] = subscription.id
        user_data["subscription_status"] = subscription.status
        db.dirty_users.add(username)
        
        # Force immediate database save for subscription changes
        db.save_to_db()
        print(f"[SUBSCRIPTION] Saved subscription status '{subscription.status}' to database for user {username}")
        
        print(f"[SUBSCRIPTION] Created subscription: {subscription.id}")
        print(f"[SUBSCRIPTION] Subscription status: {subscription.status}")
        print(f"[SUBSCRIPTION] Has latest_invoice: {subscription.latest_invoice is not None}")
        
        # Safely extract client_secret
        client_secret = None
        if subscription.latest_invoice:
            print(f"[SUBSCRIPTION] Latest invoice: {subscription.latest_invoice.id}")
            # Use getattr to safely check for payment_intent
            payment_intent = getattr(subscription.latest_invoice, 'payment_intent', None)
            if payment_intent:
                print(f"[SUBSCRIPTION] Payment intent: {payment_intent.id}")
                if hasattr(payment_intent, 'client_secret'):
                    client_secret = payment_intent.client_secret
                    print(f"[SUBSCRIPTION] Client secret extracted successfully")
                else:
                    print(f"[SUBSCRIPTION] Payment intent has no client_secret attribute")
            else:
                print(f"[SUBSCRIPTION] No payment intent on latest invoice")
        else:
            print(f"[SUBSCRIPTION] No latest_invoice on subscription")
        
        response = {
            "status": "success",
            "subscription_id": subscription.id,
            "subscription_status": subscription.status
        }
        
        if client_secret:
            response["client_secret"] = client_secret
            
        return response
        
    except stripe.error.StripeError as e:
        print(f"[SUBSCRIPTION] Stripe error: {str(e)}")
        print(f"[SUBSCRIPTION] Stripe error type: {type(e).__name__}")
        if hasattr(e, 'error'):
            print(f"[SUBSCRIPTION] Stripe error details: {e.error}")
        return {"status": "error", "message": f"Stripe error: {str(e)}"}
    except Exception as e:
        import traceback
        print(f"[SUBSCRIPTION] Error creating subscription: {str(e)}")
        print(f"[SUBSCRIPTION] Error type: {type(e).__name__}")
        print(f"[SUBSCRIPTION] Traceback: {traceback.format_exc()}")
        return {"status": "error", "message": f"Error creating subscription: {str(e)}"}

async def cancel_subscription_task(data_object):
    """Cancel a user's subscription."""
    try:
        token = data_object.get("token")
        
        if not token:
            return {"status": "error", "message": "Token required"}
        
        user_data = db.get_user_data(token)
        if not user_data:
            return {"status": "error", "message": "Invalid token"}
        
        subscription_id = user_data.get("stripe_subscription_id")
        if not subscription_id:
            return {"status": "error", "message": "No active subscription found"}
        
        # Cancel the subscription
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )
        
        # Update user data
        user_data["subscription_status"] = "canceling"
        db.dirty_users.add(user_data.get("username"))
        
        # Force immediate database save
        db.save_to_db()
        print(f"[SUBSCRIPTION] Saved canceling status to database for user {user_data.get('username')}")
        
        print(f"[SUBSCRIPTION] Cancelled subscription: {subscription_id}")
        
        # Safely get period end
        period_end = getattr(subscription, 'current_period_end', None)
        
        return {
            "status": "success",
            "message": "Subscription will cancel at the end of the current period",
            "period_end": period_end
        }
        
    except stripe.error.StripeError as e:
        print(f"[SUBSCRIPTION] Stripe error: {str(e)}")
        print(f"[SUBSCRIPTION] Stripe error type: {type(e).__name__}")
        if hasattr(e, 'error'):
            print(f"[SUBSCRIPTION] Stripe error details: {e.error}")
        return {"status": "error", "message": f"Stripe error: {str(e)}"}
    except Exception as e:
        import traceback
        print(f"[SUBSCRIPTION] Error cancelling subscription: {str(e)}")
        print(f"[SUBSCRIPTION] Error type: {type(e).__name__}")
        print(f"[SUBSCRIPTION] Traceback: {traceback.format_exc()}")
        return {"status": "error", "message": f"Error cancelling subscription: {str(e)}"}

async def get_subscription_status_task(data_object):
    """Get the current subscription status for a user."""
    try:
        token = data_object.get("token")
        
        if not token:
            return {"status": "error", "message": "Token required"}
        
        user_data = db.get_user_data(token)
        if not user_data:
            return {"status": "error", "message": "Invalid token"}
        
        subscription_id = user_data.get("stripe_subscription_id")
        if not subscription_id:
            return {
                "status": "success",
                "subscription_status": "none",
                "message": "No subscription found"
            }
        
        # Get current subscription from Stripe
        subscription = stripe.Subscription.retrieve(subscription_id)
        
        # Update local status
        user_data["subscription_status"] = subscription.status
        db.dirty_users.add(user_data.get("username"))
        
        # Force immediate database save
        db.save_to_db()
        print(f"[SUBSCRIPTION] Updated subscription status to '{subscription.status}' for user {user_data.get('username')}")
        
        # Safely get subscription attributes
        current_period_end = getattr(subscription, 'current_period_end', None)
        cancel_at_period_end = getattr(subscription, 'cancel_at_period_end', False)
        
        return {
            "status": "success",
            "subscription_status": subscription.status,
            "current_period_end": current_period_end,
            "cancel_at_period_end": cancel_at_period_end
        }
        
    except stripe.error.StripeError as e:
        print(f"[SUBSCRIPTION] Stripe error: {str(e)}")
        print(f"[SUBSCRIPTION] Stripe error type: {type(e).__name__}")
        if hasattr(e, 'error'):
            print(f"[SUBSCRIPTION] Stripe error details: {e.error}")
        return {"status": "error", "message": f"Stripe error: {str(e)}"}
    except Exception as e:
        import traceback
        print(f"[SUBSCRIPTION] Error getting subscription status: {str(e)}")
        print(f"[SUBSCRIPTION] Error type: {type(e).__name__}")
        print(f"[SUBSCRIPTION] Traceback: {traceback.format_exc()}")
        return {"status": "error", "message": f"Error getting subscription status: {str(e)}"}

async def sync_subscription_status_task(data_object):
    """Manually sync subscription status with Stripe (for debugging/fixing sync issues)"""
    try:
        token = data_object.get("token")
        
        if not token:
            return {"status": "error", "message": "Token required"}
        
        user_data = db.get_user_data(token)
        if not user_data:
            return {"status": "error", "message": "Invalid token"}
        
        stripe_subscription_id = user_data.get("stripe_subscription_id")
        if not stripe_subscription_id:
            return {
                "status": "success",
                "subscription_status": "none",
                "message": "No subscription found"
            }
        
        print(f"[SYNC] Manually syncing subscription status for: {stripe_subscription_id}")
        
        # Get current subscription from Stripe
        subscription = stripe.Subscription.retrieve(stripe_subscription_id)
        
        old_status = user_data.get("subscription_status", "none")
        new_status = subscription.status
        
        # Update local status
        user_data["subscription_status"] = new_status
        db.dirty_users.add(user_data.get("username"))
        db.save_to_db()
        
        print(f"[SYNC] Updated subscription status from '{old_status}' to '{new_status}'")
        
        return {
            "status": "success",
            "old_status": old_status,
            "new_status": new_status,
            "subscription_status": new_status,
            "message": f"Subscription status synced: {old_status} → {new_status}"
        }
        
    except stripe.error.StripeError as e:
        print(f"[SYNC] Stripe error: {str(e)}")
        return {"status": "error", "message": f"Stripe error: {str(e)}"}
    except Exception as e:
        print(f"[SYNC] Error syncing subscription status: {str(e)}")
        return {"status": "error", "message": f"Error syncing subscription status: {str(e)}"}

async def handle_stripe_webhook(data_object):
    """Handle Stripe webhook events."""
    try:
        # This would typically be called from a separate HTTP endpoint
        # But including here for reference
        event_type = data_object.get("type")
        event_data = data_object.get("data", {}).get("object", {})
        
        if event_type == "invoice.payment_succeeded":
            # Handle successful subscription payment
            subscription_id = event_data.get("subscription")
            customer_id = event_data.get("customer")
            
            # Find user by customer ID and update subscription status
            for username, user_data in db.users.items():
                if user_data.get("stripe_customer_id") == customer_id:
                    user_data["subscription_status"] = "active"
                    db.dirty_users.add(username)
                    print(f"[WEBHOOK] Payment succeeded for user: {username}")
                    break
                    
        elif event_type == "invoice.payment_failed":
            # Handle failed subscription payment
            subscription_id = event_data.get("subscription")
            customer_id = event_data.get("customer")
            
            for username, user_data in db.users.items():
                if user_data.get("stripe_customer_id") == customer_id:
                    user_data["subscription_status"] = "past_due"
                    db.dirty_users.add(username)
                    print(f"[WEBHOOK] Payment failed for user: {username}")
                    break
                    
        elif event_type == "customer.subscription.deleted":
            # Handle subscription cancellation
            subscription_id = event_data.get("id")
            customer_id = event_data.get("customer")
            
            for username, user_data in db.users.items():
                if user_data.get("stripe_subscription_id") == subscription_id:
                    user_data["subscription_status"] = "canceled"
                    db.dirty_users.add(username)
                    print(f"[WEBHOOK] Subscription canceled for user: {username}")
                    break
        
        return {"status": "success", "message": "Webhook processed"}
        
    except Exception as e:
        print(f"[WEBHOOK] Error processing webhook: {str(e)}")
        return {"status": "error", "message": f"Error processing webhook: {str(e)}"}

async def send_bug_report_task(data_object):
    """Send bug report email with user logs and system information"""
    try:
        print("[BUG_REPORT] Processing bug report")
        start_time = time.time()
        
        # Extract data from the request
        system_info = data_object.get("systemInfo", {})
        logs = data_object.get("logs", [])
        token = data_object.get("token")
        
        # Get user info if token provided
        user_info = {}
        if token:
            user_data = db.get_user_data(token)
            if user_data:
                user_info = {
                    "username": user_data.get("username", "Unknown"),
                    "current_book": user_data.get("current_book", "None"),
                    "preferred_language": user_data.get("preferred_language", "en")
                }
        
        # Format the email content using string concatenation
        timestamp_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
        user_info_str = json.dumps(user_info, indent=2) if user_info else "Anonymous user (no token provided)"
        system_info_str = json.dumps(system_info, indent=2)
        
        formatted_email = "Bug Report from Hablas App\n"
        formatted_email += "==========================\n"
        formatted_email += f"Report Time: {timestamp_str}\n\n"
        formatted_email += "USER INFORMATION:\n"
        formatted_email += user_info_str + "\n\n"
        formatted_email += "SYSTEM INFORMATION:\n"
        formatted_email += system_info_str + "\n\n"
        formatted_email += f"SESSION LOGS ({len(logs)} entries):\n"
        formatted_email += "=" * 50 + "\n"
        
        # Add formatted logs
        for log_entry in logs:
            timestamp = log_entry.get("timestamp", "Unknown time")
            log_type = log_entry.get("type", "unknown").upper()
            message = log_entry.get("message", "")
            args = log_entry.get("args", [])
            
            formatted_email += f"[{timestamp}] {log_type}: {message}"
            if args:
                formatted_email += " | Args: " + " ".join(str(arg) for arg in args)
            formatted_email += "\n"
        
        formatted_email += "\n" + "=" * 50 + "\nEND OF LOGS\n"
        
        # Check if email configuration is available
        if not all([EMAIL_USER, EMAIL_PASSWORD, BUG_REPORT_TO_EMAIL]):
            print("[BUG_REPORT] Email not configured properly. Missing environment variables.")
            print("[BUG_REPORT] Bug report content saved to server logs instead.")
            print(f"[BUG_REPORT] Content:\n{formatted_email}")
            return {"type": "bug_report_sent", "status": "success", "message": "Bug report logged on server"}
        
        # Create email message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USER
        msg['To'] = BUG_REPORT_TO_EMAIL
        msg['Subject'] = f"Hablas Bug Report - {system_info.get('timestamp', 'Unknown time')}"
        
        # Add body to email
        msg.attach(MIMEText(formatted_email, 'plain'))
        
        # Send email
        print(f"[BUG_REPORT] Sending email to {BUG_REPORT_TO_EMAIL}")
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_USER, BUG_REPORT_TO_EMAIL, text)
        server.quit()
        
        print(f"[BUG_REPORT] Bug report sent successfully in {time.time() - start_time:.4f}s")
        return {
            "type": "bug_report_sent", 
            "status": "success", 
            "message": "Bug report sent successfully"
        }
        
    except Exception as e:
        print(f"[BUG_REPORT] Error sending bug report: {str(e)}")
        # Still log the content to server logs as fallback
        try:
            system_info = data_object.get("systemInfo", {})
            logs = data_object.get("logs", [])
            print("[BUG_REPORT] FALLBACK - Bug report content:")
            print(f"[BUG_REPORT] System: {json.dumps(system_info, indent=2)}")
            print(f"[BUG_REPORT] Logs ({len(logs)} entries):")
            for log_entry in logs[-10:]:  # Last 10 log entries
                print(f"[BUG_REPORT] {log_entry}")
        except:
            pass
            
        return {
            "type": "bug_report_sent",
            "status": "error", 
            "message": f"Error sending bug report: {str(e)}"
        }

async def main():
    global db
    db = DatabaseManager("usersHablas.db")
    db.init_database()

    # Register cleanup handler
    def cleanup():
        print("Saving data to database and closing connections...")
        db.save_to_db()  # Make sure all in-memory data is saved
        db.close_connection()
    
    import atexit
    atexit.register(cleanup)
    
    """ # Create SSL context
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(
        '/media/nas/SSLCerts/carriertech.uk/fullchain.pem',
        '/media/nas/SSLCerts/carriertech.uk/privkey.pem'
    )"""

    # Start the WebSocket server with SSL
    async with websockets.serve(
        handle_connection,
        "0.0.0.0",  # Changed from localhost to accept external connections
        8675,
        #ssl=ssl_context,
        origins=["https://hablas.app", "https://carriertech.uk",  "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8008"],  # Specify allowed origins here
        max_size=10 * 1024 * 1024  # Allow up to 10MB messages
    ):
        print("WebSocket server started on wss://carriertech.uk:8675")
        await asyncio.Future()  # Run forever

async def grant_special_access_task(data_object):
    """Grant special access to a user (admin function)"""
    try:
        admin_token = data_object.get("admin_token")
        target_username = data_object.get("target_username")
        access_type = data_object.get("access_type")  # 'lifetime_free', 'free_month', 'premium_trial'
        duration_days = data_object.get("duration_days", 30)  # Default 30 days for timed access
        notes = data_object.get("notes", "")
        
        # Verify admin token (you should implement proper admin authentication)
        admin_user = db.get_user_data(admin_token)
        if not admin_user or admin_user.get("username") != "admin":  # Replace with your admin logic
            return {"status": "error", "message": "Unauthorized: Admin access required"}
        
        # Get target user
        target_user = None
        for username, user_data in db.users.items():
            if username == target_username:
                target_user = user_data
                break
                
        if not target_user:
            return {"status": "error", "message": "User not found"}
        
        # Set special access
        target_user["special_access"] = access_type
        target_user["granted_by"] = admin_user.get("username", "admin")
        target_user["access_notes"] = notes
        
        # Set expiry for timed access
        if access_type in ["free_month", "premium_trial"]:
            expiry_date = datetime.now() + timedelta(days=duration_days)
            target_user["special_access_expiry"] = expiry_date
        else:
            target_user["special_access_expiry"] = None
            
        # Mark as dirty for database save
        db.dirty_users.add(target_username)
        
        print(f"[ADMIN] Granted {access_type} access to {target_username} by {admin_user.get('username')}")
        
        return {
            "status": "success",
            "message": f"Granted {access_type} access to {target_username}",
            "access_type": access_type,
            "expiry": target_user["special_access_expiry"].isoformat() if target_user["special_access_expiry"] else None
        }
        
    except Exception as e:
        print(f"[ADMIN] Error granting special access: {str(e)}")
        return {"status": "error", "message": f"Error granting access: {str(e)}"}

async def check_special_access_task(data_object):
    """Check if user has active special access"""
    try:
        token = data_object.get("token")
        
        if not token:
            return {"status": "error", "message": "Token required"}
        
        user_data = db.get_user_data(token)
        if not user_data:
            return {"status": "error", "message": "Invalid token"}
        
        special_access = user_data.get("special_access", "none")
        special_access_expiry = user_data.get("special_access_expiry")
        
        # Check if special access is still valid
        has_active_special_access = False
        access_info = {
            "type": special_access,
            "active": False,
            "expiry": None,
            "granted_by": user_data.get("granted_by", ""),
            "notes": user_data.get("access_notes", "")
        }
        
        if special_access == "lifetime_free":
            has_active_special_access = True
            access_info["active"] = True
        elif special_access in ["free_month", "premium_trial"] and special_access_expiry:
            expiry_dt = None
            if isinstance(special_access_expiry, str):
                try:
                    if '.' in special_access_expiry:
                        expiry_dt = datetime.strptime(special_access_expiry, '%Y-%m-%d %H:%M:%S.%f')
                    else:
                        expiry_dt = datetime.strptime(special_access_expiry, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    print(f"[SPECIAL_ACCESS] Invalid expiry format: {special_access_expiry}")
            elif isinstance(special_access_expiry, datetime):
                expiry_dt = special_access_expiry
                
            if expiry_dt and expiry_dt > datetime.now():
                has_active_special_access = True
                access_info["active"] = True
                access_info["expiry"] = expiry_dt.isoformat()
            else:
                # Expired special access, reset to none
                user_data["special_access"] = "none"
                user_data["special_access_expiry"] = None
                db.dirty_users.add(user_data.get("username"))
        
        return {
            "status": "success",
            "has_special_access": has_active_special_access,
            "access_info": access_info
        }
        
    except Exception as e:
        print(f"[SPECIAL_ACCESS] Error checking special access: {str(e)}")
        return {"status": "error", "message": f"Error checking access: {str(e)}"}

async def revoke_special_access_task(data_object):
    """Revoke special access from a user (admin function)"""
    try:
        admin_token = data_object.get("admin_token")
        target_username = data_object.get("target_username")
        
        # Verify admin token
        admin_user = db.get_user_data(admin_token)
        if not admin_user or admin_user.get("username") != "admin":  # Replace with your admin logic
            return {"status": "error", "message": "Unauthorized: Admin access required"}
        
        # Get target user
        target_user = None
        for username, user_data in db.users.items():
            if username == target_username:
                target_user = user_data
                break
                
        if not target_user:
            return {"status": "error", "message": "User not found"}
        
        # Revoke special access
        old_access = target_user.get("special_access", "none")
        target_user["special_access"] = "none"
        target_user["special_access_expiry"] = None
        target_user["access_notes"] = f"Revoked by {admin_user.get('username')} on {datetime.now().isoformat()}"
        
        # Mark as dirty for database save
        db.dirty_users.add(target_username)
        
        print(f"[ADMIN] Revoked {old_access} access from {target_username} by {admin_user.get('username')}")
        
        return {
            "status": "success",
            "message": f"Revoked special access from {target_username}",
            "previous_access": old_access
        }
        
    except Exception as e:
        print(f"[ADMIN] Error revoking special access: {str(e)}")
        return {"status": "error", "message": f"Error revoking access: {str(e)}"}

async def tts_task_with_ai_service(data_object):
    """TTS task that uses external AI service with fallback to local processing"""
    try:
        print(f"[TTS_AI] Starting TTS processing")
        start_time = time.time()
        
        text = data_object.get("text", "")
        lang = data_object.get("language", "en")
        
        # Map language name to code if needed
        if lang.lower() in language_name_map:
            lang = language_name_map[lang.lower()]
        
        if not text:
            return {"status": "error", "message": "No text provided for TTS conversion"}
        
        # Try AI service first
        try:
            print(f"[TTS_AI] Calling external AI service")
            ai_result = await call_ai_service_tts(text, lang)
            print(f"[TTS_AI] AI service call completed in {time.time() - start_time:.4f}s")
            return ai_result
        except Exception as e:
            print(f"[TTS_AI] Error calling AI service: {str(e)}")
            # AI service failed, return error
            return {"status": "error", "message": f"AI service unavailable: {str(e)}"}
            
    except Exception as e:
        print(f"[TTS_AI] Error in TTS processing: {str(e)}")
        return {"status": "error", "message": str(e)}

async def translate_task_with_ai_service(data_object):
    """Translation task that uses external AI service with fallback to local processing"""
    try:
        print(f"[TRANSLATE_AI] Starting translation processing")
        start_time = time.time()
        
        source_text = data_object["text"]
        source_lang = data_object["source_lang"]
        target_lang = data_object["target_lang"]
        print(f"[TRANSLATE_AI] source_text: {source_text}")
        print(f"[TRANSLATE_AI] source_lang: {source_lang}")
        print(f"[TRANSLATE_AI] target_lang: {target_lang}")
        
        current_book = data_object.get("current_book", "")
        cfi = data_object.get("cfi", "")
        username = data_object.get("username", "")

        if source_lang == target_lang:
            return {"status": "success", "translated_text": source_text}

        # Map language names to codes if needed
        if source_lang in language_name_map.keys():
            source_lang = language_name_map[source_lang]
        
        # Try AI service first
        try:
            print(f"[TRANSLATE_AI] Calling external AI service")
            ai_result = await call_ai_service_translate(source_text, source_lang, target_lang)
            
            # Update book tracking if username provided
            if username != "" and current_book != "":
                db.set_current_book_task({
                    "username": username,
                    "book": current_book,
                    "cfi": cfi,
                }, "", "")
            
            # Add additional data to AI result
            if "translated_text" in ai_result:
                ai_result.update({
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "current_book": current_book,
                    "cfi": cfi
                })
            
            print(f"[TRANSLATE_AI] AI service call completed in {time.time() - start_time:.4f}s")
            return ai_result
            
        except Exception as e:
            print(f"[TRANSLATE_AI] Error calling AI service: {str(e)}")
            # AI service failed, return error
            return {"status": "error", "message": f"AI service unavailable: {str(e)}"}
            
    except Exception as e:
        print(f"[TRANSLATE_AI] Error in translation processing: {str(e)}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__": #when you use a multi processer load, you use this so it doesnt crash. with asyncio you always have to do it
    asyncio.run(main())

