import json
from googletrans import Translator
import time
import os

def translate_interface():
    # Create output directory if it doesn't exist
    output_dir = 'translations'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Load the English JSON
    with open('interface_languages.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Get the English strings
    en_strings = data['fr']
    
    # Language name mapping that googletrans actually expects
    language_name_map = {
        'af': 'afrikaans', 'sq': 'albanian', 'am': 'amharic', 'ar': 'arabic', 'hy': 'armenian',
        'az': 'azerbaijani', 'eu': 'basque', 'be': 'belarusian', 'bn': 'bengali', 'bs': 'bosnian',
        'bg': 'bulgarian', 'ca': 'catalan', 'ceb': 'cebuano', 'ny': 'chichewa', 'zh-cn': 'chinese (simplified)',
        'zh-tw': 'chinese (traditional)', 'co': 'corsican', 'hr': 'croatian', 'cs': 'czech',
        'da': 'danish', 'nl': 'dutch', 'en': 'english', 'eo': 'esperanto', 'et': 'estonian',
        'tl': 'filipino', 'fi': 'finnish',  'fy': 'frisian', 'gl': 'galician',
        'ka': 'georgian', 'de': 'german', 'el': 'greek', 'gu': 'gujarati', 'ht': 'haitian creole',
        'ha': 'hausa', 'haw': 'hawaiian', 'iw': 'hebrew', 'he': 'hebrew', 'hi': 'hindi',
        'hmn': 'hmong', 'hu': 'hungarian', 'is': 'icelandic', 'ig': 'igbo', 'id': 'indonesian',
        'ga': 'irish', 'it': 'italian', 'ja': 'japanese', 'jw': 'javanese', 'kn': 'kannada',
        'kk': 'kazakh', 'km': 'khmer', 'ko': 'korean', 'ku': 'kurdish (kurmanji)', 'ky': 'kyrgyz',
        'lo': 'lao', 'la': 'latin', 'lv': 'latvian', 'lt': 'lithuanian', 'lb': 'luxembourgish',
        'mk': 'macedonian', 'mg': 'malagasy', 'ms': 'malay', 'ml': 'malayalam', 'mt': 'maltese',
        'mi': 'maori', 'mr': 'marathi', 'mn': 'mongolian', 'my': 'myanmar (burmese)', 'ne': 'nepali',
        'no': 'norwegian', 'or': 'odia', 'ps': 'pashto', 'fa': 'persian', 'pl': 'polish',
        'pt': 'portuguese', 'pa': 'punjabi', 'ro': 'romanian', 'ru': 'russian', 'sm': 'samoan',
        'gd': 'scots gaelic', 'sr': 'serbian', 'st': 'sesotho', 'sn': 'shona', 'sd': 'sindhi',
        'si': 'sinhala', 'sk': 'slovak', 'sl': 'slovenian', 'so': 'somali', 'es': 'spanish',
        'su': 'sundanese', 'sw': 'swahili', 'sv': 'swedish', 'tg': 'tajik', 'ta': 'tamil',
        'te': 'telugu', 'th': 'thai', 'tr': 'turkish', 'uk': 'ukrainian', 'ur': 'urdu', 'ug': 'uyghur',
        'uz': 'uzbek', 'vi': 'vietnamese', 'cy': 'welsh', 'xh': 'xhosa', 'yi': 'yiddish',
        'yo': 'yoruba', 'zu': 'zulu' #'fr': 'french',
    }
    
    translator = Translator()
    
    # Load existing translations if available
    translated_file = 'interface_languages_translated.json'
    if os.path.exists(translated_file):
        with open(translated_file, 'r', encoding='utf-8') as f:
            result = json.load(f)
        print(f"Loaded existing translations from {translated_file}")
    else:
        result = {'fr': data['fr']}  # Start with French
    
    # Save French to its own file first
    with open(f'{output_dir}/fr.json', 'w', encoding='utf-8') as f:
        json.dump(data['fr'], f, ensure_ascii=False, indent=4)
    
    total_languages = len(language_name_map)
    completed = 0
    
    # Translate to each language
    for lang_code, lang_name in language_name_map.items():
        completed += 1
        print(f"[{completed}/{total_languages}] Translating to {lang_name} ({lang_code})...")
        
        # Get existing translations for this language
        translated_strings = result.get(lang_code, {})
        
        # Find new keys that need translation
        new_keys_to_translate = {k: v for k, v in en_strings.items() if k not in translated_strings}
        
        if not new_keys_to_translate:
            print(f"  No new keys to translate for {lang_name}. Skipping.")
            continue
        
        print(f"  Found {len(new_keys_to_translate)} new keys to translate for {lang_name}.")
        
        for key, value in new_keys_to_translate.items():
            # Skip appTitle as requested
            if key == 'appTitle':
                translated_strings[key] = 'Hablas'
                continue
                
            try:
                # Add delay to avoid hitting rate limits
                time.sleep(0.5)
                translation = translator.translate(value, src='fr', dest=lang_code)
                translated_strings[key] = translation.text
                print(f"  Translated: {key} '{value}' to '{translation.text}'")
            except Exception as e:
                print(f"  Error translating {key} to {lang_name}: {e}")
                translated_strings[key] = value  # Fallback to French
        
        # Save this language to its own file
        lang_file = f'{output_dir}/{lang_code}.json'
        with open(lang_file, 'w', encoding='utf-8') as f:
            json.dump(translated_strings, f, ensure_ascii=False, indent=4)
        print(f"  Saved {lang_name} translation to {lang_file}")
        
        result[lang_code] = translated_strings
    
    # Save the combined result
    with open(translated_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=4)
    
    print(f"\nTranslation completed!")
    print(f"- Individual language files saved in '{output_dir}/' directory")
    print(f"- Combined file saved as 'interface_languages_translated.json'")
    print(f"- Total languages processed: {total_languages}")

if __name__ == "__main__":
    translate_interface()