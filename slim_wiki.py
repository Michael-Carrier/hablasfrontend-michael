import json
from tqdm import tqdm
raw = open("raw-wiktextract-data.jsonl", "r", encoding="utf-8")
print("getting total lines")
total_lines = sum(1 for _ in raw)
raw.seek(0)
print(f"total lines: {total_lines}")

new_json = {}
for line in tqdm(raw, total=total_lines):
    data = json.loads(line)
    if "word" not in data or "lang_code" not in data or "translations" not in data: continue
    
    first_letter = data["word"][0].lower()
    if first_letter not in new_json:
        new_json[first_letter] = {}
    
    new_json[first_letter][data["word"]] = {"word": data["word"], 
                            "lang_code": data["lang_code"], 
                            "translations": data["translations"]}

with open("slim_wiki.json", "w", encoding="utf-8") as f:
    json.dump(new_json, f, ensure_ascii=False)


