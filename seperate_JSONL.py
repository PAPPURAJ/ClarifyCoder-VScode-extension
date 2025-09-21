import json
import random
from pathlib import Path

def oversample_data(data, target_count):
    return random.choices(data, k=target_count) if target_count > len(data) else random.sample(data, target_count)
def downsample_data(data, target_count):
    return random.sample(data, min(target_count, len(data)))
def generate_original_type(file_path, output_dir, output_filename="original.jsonl"):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = [json.loads(line) for line in f]

    original_data = [item for item in data if item.get('type') == "Original"]

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    output_file = Path(output_dir) / output_filename

    with open(output_file, 'w', encoding='utf-8') as f:
        for item in original_data:
            f.write(json.dumps(item) + '\n')

    print(f"Filtered data saved to: {output_file}")

def split_and_save_jsonl(file_path, output_dir, ratio, sampling_mode):
    with open(file_path, 'r') as f:
        data = [json.loads(line) for line in f]
    
    original_data = [item for item in data if item.get('type') == "Original"]
    other_data = [item for item in data if item.get('type') != "Original"]

    total_desired_samples = min(len(original_data) / (ratio[0] / 100), len(other_data) / (ratio[1] / 100))
    total_desired_samples = int(total_desired_samples)

    original_count = int(ratio[0] / 100 * total_desired_samples)
    other_count = int(ratio[1] / 100 * total_desired_samples)

    if sampling_mode == "oversample":
        selected_original = oversample_data(original_data, original_count)
        selected_other = oversample_data(other_data, other_count)
    elif sampling_mode == "downsample":
        selected_original = downsample_data(original_data, original_count)
        selected_other = downsample_data(other_data, other_count)
    else:
        raise ValueError("Invalid sampling_mode. Choose 'oversample' or 'downsample'.")

    combined_data = selected_original + selected_other
    random.shuffle(combined_data)

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    output_file = Path(output_dir) / f"split_{ratio[0]}_{ratio[1]}_{sampling_mode}.jsonl"
    with open(output_file, 'w') as f:
        for item in combined_data:
            f.write(json.dumps(item) + '\n')
    
    print(f"{sampling_mode} with {ratio[0]}% original and {ratio[1]}% other")
    print(f"Original Samples: {len(selected_original)}/{len(combined_data)}")
    print(f"Other Samples: {len(selected_other)}/{len(combined_data)}")
    print(f"Saved and split data to {output_file}")
input_file = "FINAL_finetuning_everything.jsonl"
output_dir_splits = "output_splits"
output_dir_original = "output_original"

desired_ratio = (40, 60)

split_and_save_jsonl(input_file, output_dir_splits, desired_ratio, "oversample")
generate_original_type(input_file, output_dir_original)