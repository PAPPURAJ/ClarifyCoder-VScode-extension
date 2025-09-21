import json

jsonl_file = "FINAL_finetuning_data_ques_only.jsonl"
json_file = "FINAL_finetuning_data_ques_only.json"

with open(jsonl_file, "r", encoding="utf-8") as infile:
    data = [json.loads(line) for line in infile]

with open(json_file, "w", encoding="utf-8") as outfile:
    json.dump(data, outfile, indent=4)

print(f"Converted {jsonl_file} to {json_file} successfully!")
