import json
import os
import re
import time
import string
from tqdm import tqdm
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from translate import Translator

# NLLB language codes for common languages
NLLB_LANG_CODES = {
    'english': 'eng_Latn',
    'francais': 'fra_Latn',
    'espagnol': 'spa_Latn',
    'deutsch': 'deu_Latn',
    'italiano': 'ita_Latn',
    'portuguese': 'por_Latn',
    'turkish': 'tur_Latn',
    # Add more as needed
}
word_dict = json.load(open("slim_wiki.json", "r", encoding="utf-8"))
MODEL_NAME = "facebook/nllb-200-distilled-600M"
# Add src_lang to tokenizer
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)

def nllb_translate(text, src_lang, tgt_lang, max_length=1024):
    tokenizer.src_lang = src_lang
    # Split text into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    translated_text = ""
    buffer = []
    
    for sentence in sentences:
        # Check if adding the next sentence to the buffer would exceed the token limit.
        buffer_text = " ".join(buffer)
        if len(tokenizer(buffer_text + " " + sentence)['input_ids']) > max_length and buffer:
            # If the buffer is full, translate its contents.
            model_inputs = tokenizer(buffer_text, return_tensors="pt", padding=True, truncation=True).to(device)
            translated_tokens = model.generate(
                **model_inputs,
                forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_lang),
                max_length=max_length
            )
            translation = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)
            translated_text += translation[0] + " "
            buffer = [sentence]
        else:
            # Otherwise, add the sentence to the buffer.
            buffer.append(sentence)
            
    # Translate any remaining text in the buffer.
    if buffer:
        buffer_text = " ".join(buffer)
        model_inputs = tokenizer(buffer_text, return_tensors="pt", padding=True, truncation=True).to(device)
        translated_tokens = model.generate(
            **model_inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_lang),
            max_length=max_length
        )
        translation = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)
        translated_text += translation[0]
        
    return translated_text.strip()

def get_translation_from_list(translations, target_lang_code):
    """Finds a translation for a specific language code from a list of translations."""
    for t in translations:
        if t.get('code') == target_lang_code:
            return t.get('word')
    return None

def create_translation_structure(text, src_lang, tgt_lang):
    full_translation = nllb_translate(text, src_lang, tgt_lang)
    
    # Restore individual word translations
    text_no_punct = text.translate(str.maketrans('', '', string.punctuation))
    words = text_no_punct.split()
    word_mapping = {}
    for idx, word in enumerate(words, 1):
        if word.strip():
            # word_dict is structured by first letter, then the word
            first_letter = word[0].lower()
            if first_letter in word_dict and word.lower() in word_dict[first_letter]:
                translations = word_dict[first_letter][word.lower()].get("translations", [])
                
                # We need to map tgt_lang (e.g., 'eng_Latn') to a 2-letter code (e.g., 'en')
                # This is a simplification; a more robust mapping might be needed.
                target_code = tgt_lang.split('_')[0] 
                
                translated_word = get_translation_from_list(translations, target_code)
                
                if translated_word:
                    word_mapping[str(idx)] = [translated_word]
                else:
                    # Fallback to NLLB if no translation is found
                    word_mapping[str(idx)] = [nllb_translate(word, src_lang, tgt_lang)]
            else:
                translated_word = nllb_translate(word, src_lang, tgt_lang)
                word_mapping[str(idx)] = [translated_word]
           
    return {
        "original": text,
        "translation": full_translation,
        "words": word_mapping
    }

def process_json_file(input_file, output_file, src_lang, tgt_lang):
    print(f"{src_lang} to {tgt_lang}")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    translated_data = {}
    for chapter, content in tqdm(data.items(), total=len(data)):
        print(f"Processing chapter: {chapter}")
        translated_data[chapter] = []
        for i, text in tqdm(enumerate(content)):
            translation = create_translation_structure(text, src_lang, tgt_lang)
            translated_data[chapter].append(translation)
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, ensure_ascii=False, indent=2)
           

def main():
    # Only process languages that are in NLLB_LANG_CODES
    for lang_dir in os.listdir('epub'):
        if not os.path.isdir(f"./epub/{lang_dir}"):
            continue
        src_lang = NLLB_LANG_CODES.get(lang_dir.lower())
        if not src_lang:
            print(f"Skipping {lang_dir}, not in NLLB_LANG_CODES")
            continue
        for lang_target, tgt_lang in NLLB_LANG_CODES.items():
            if lang_dir.lower() == lang_target:
                continue
            input_dir = os.path.join('epub', lang_dir)
            output_dir = os.path.join('nllb_translations', lang_target)
            os.makedirs(output_dir, exist_ok=True)
            for json_file in os.listdir(input_dir):
                if "DonQuijote" in json_file:
                    continue
                if json_file.endswith('.json') and not os.path.exists(os.path.join(output_dir, json_file)):
                    input_file = os.path.join(input_dir, json_file)
                    output_file = os.path.join(output_dir, json_file)
                    print(f"Processing {input_file}...")
                    process_json_file(input_file, output_file, src_lang, tgt_lang)
                    print(f"Created translation at {output_file}")

if __name__ == "__main__":
    main()


