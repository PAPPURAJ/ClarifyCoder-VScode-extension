import json

from transformers import AutoTokenizer
import matplotlib.pyplot as plt

tokenizer = AutoTokenizer.from_pretrained("deepseek-ai/deepseek-coder-6.7b-instruct")

texts = []

with open("DATASET PATH", "r") as file:
    for line in file:
        data = json.loads(line)
        concatenated_text = data.get("problem", "") + " " + data.get("answer", "")
        texts.append(concatenated_text)

token_lengths = [len(tokenizer.encode(text, truncation=False)) for text in texts]

if token_lengths:
    average_length = sum(token_lengths) / len(token_lengths)
    max_length = max(token_lengths)
    min_length = min(token_lengths)
    
    print(f"Average token length: {average_length}")
    print(f"Largest token length: {max_length}")
    print(f"Smallest token length: {min_length}")
else:
    print("No data to process.")
